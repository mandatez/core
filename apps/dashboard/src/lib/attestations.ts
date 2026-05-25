import { createHash, randomBytes } from 'node:crypto';
import { createServerClient } from './supabase-server';
import { getPublicKey, signAttestation, verifyAttestationSignature } from './platform-keys';

export type Verdict = 'clean' | 'flagged' | 'violations_detected';

export interface AttestationViolation {
  event_id: string;
  timestamp: string;
  action_type: string;
  resource: string;
  outcome: 'blocked' | 'flagged';
}

export interface AttestationRecord {
  id: string;
  agent_id: string;
  owner_id: string;
  window_start: string;
  window_end: string;
  event_count: number;
  events_hash: string;
  verdict: Verdict;
  violations: AttestationViolation[];
  platform_signature: string;
  platform_public_key: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface EventRow {
  id: string;
  timestamp: string;
  action_type: string;
  resource: string;
  outcome: 'allowed' | 'blocked' | 'flagged' | 'pending_approval';
  signature: string;
}

interface CreateAttestationOptions {
  /** Extra fields stored alongside the attestation. */
  metadata?: Record<string, unknown>;
}

/**
 * Recursively sorts object keys so the canonical string depends on
 * values only, never on insertion order. Same fix as
 * packages/sdk/src/events/signing.ts — see SCHEMA_AUDIT.md P0-3.
 *
 * The original used JSON.stringify(parts, Object.keys(parts).sort()),
 * which silently dropped every nested key (replacer-array whitelist
 * applies recursively). `violations` was therefore never actually
 * signed — only its array length leaked into the signature.
 */
function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortDeep);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Builds the canonical payload string used for signing and verification.
 *
 * Keys at every depth are sorted alphabetically so the byte sequence
 * survives a JSONB round-trip (which does not preserve key order).
 */
export function canonicalAttestationPayload(parts: {
  id: string;
  agent_id: string;
  owner_id: string;
  window_start: string;
  window_end: string;
  event_count: number;
  events_hash: string;
  verdict: Verdict;
  violations: AttestationViolation[];
  platform_public_key: string;
}): string {
  return JSON.stringify(sortDeep(parts));
}

/**
 * Computes the deterministic verdict from the events in the window.
 *
 * `violations_detected` outranks `flagged` — a blocked event always
 * dominates the verdict even when flagged events are also present.
 */
function computeVerdict(events: EventRow[]): {
  verdict: Verdict;
  violations: AttestationViolation[];
} {
  const violations: AttestationViolation[] = [];
  let hasBlocked = false;
  let hasFlagged = false;

  for (const e of events) {
    if (e.outcome === 'blocked' || e.outcome === 'flagged') {
      violations.push({
        event_id: e.id,
        timestamp: e.timestamp,
        action_type: e.action_type,
        resource: e.resource,
        outcome: e.outcome,
      });
      if (e.outcome === 'blocked') hasBlocked = true;
      if (e.outcome === 'flagged') hasFlagged = true;
    }
  }

  let verdict: Verdict = 'clean';
  if (hasBlocked) verdict = 'violations_detected';
  else if (hasFlagged) verdict = 'flagged';

  return { verdict, violations };
}

/**
 * SHA-256 hash of the concatenated event signatures. Events are sorted
 * by id (UUID) ascending so the same window always yields the same hash
 * regardless of database row order.
 */
function hashEventSignatures(events: EventRow[]): string {
  const sorted = [...events].sort((a, b) => a.id.localeCompare(b.id));
  const h = createHash('sha256');
  for (const e of sorted) {
    h.update(e.signature);
  }
  return h.digest('hex');
}

/**
 * Generates a new attestation id: `att_` + 32 hex chars.
 *
 * Hex (not nanoid) keeps the dashboard app free of an extra direct dep —
 * the entropy is identical (128 bits) and the id is URL-safe by construction.
 */
function newAttestationId(): string {
  return `att_${randomBytes(16).toString('hex')}`;
}

/**
 * Creates a neutral, counter-signed attestation of an agent's activity in a
 * given time window. This is the primitive hyperscalers cannot offer without
 * a conflict of interest — MandateZ independently witnesses what happened.
 *
 * Flow:
 *  1. Verify the agent exists and resolve its owner_id.
 *  2. Pull every agent_event for that agent in [windowStart, windowEnd].
 *  3. Hash the concatenated signatures to bind the attestation to the events.
 *  4. Compute the verdict from outcomes (blocked → violations, flagged → flagged).
 *  5. Sign the canonical payload with the platform Ed25519 key.
 *  6. Persist the row and return it.
 */
export async function createAttestation(
  agentId: string,
  windowStart: Date,
  windowEnd: Date,
  options: CreateAttestationOptions = {},
): Promise<AttestationRecord> {
  if (windowEnd.getTime() <= windowStart.getTime()) {
    throw new Error('window_end must be strictly after window_start');
  }

  const supabase = createServerClient();

  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('id, owner_id')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const windowStartIso = windowStart.toISOString();
  const windowEndIso = windowEnd.toISOString();

  const { data: events, error: eventsErr } = await supabase
    .from('agent_events')
    .select('id, timestamp, action_type, resource, outcome, signature')
    .eq('agent_id', agentId)
    .gte('timestamp', windowStartIso)
    .lte('timestamp', windowEndIso);

  if (eventsErr) {
    throw new Error(`Failed to load events for attestation: ${eventsErr.message}`);
  }

  const eventRows = (events ?? []) as EventRow[];
  const eventsHash = hashEventSignatures(eventRows);
  const { verdict, violations } = computeVerdict(eventRows);

  const id = newAttestationId();
  const platformPublicKey = await getPublicKey();

  const payload = canonicalAttestationPayload({
    id,
    agent_id: agentId,
    owner_id: agent.owner_id,
    window_start: windowStartIso,
    window_end: windowEndIso,
    event_count: eventRows.length,
    events_hash: eventsHash,
    verdict,
    violations,
    platform_public_key: platformPublicKey,
  });

  const platformSignature = await signAttestation(payload);
  const createdAt = new Date().toISOString();
  const metadata = options.metadata ?? {};

  const row: AttestationRecord = {
    id,
    agent_id: agentId,
    owner_id: agent.owner_id,
    window_start: windowStartIso,
    window_end: windowEndIso,
    event_count: eventRows.length,
    events_hash: eventsHash,
    verdict,
    violations,
    platform_signature: platformSignature,
    platform_public_key: platformPublicKey,
    metadata,
    created_at: createdAt,
  };

  const { error: insertErr } = await supabase.from('attestations').insert(row);
  if (insertErr) {
    throw new Error(`Failed to persist attestation: ${insertErr.message}`);
  }

  return row;
}

/**
 * Re-derives the canonical payload from a stored attestation row and
 * verifies the platform signature.
 *
 * Returns true only if BOTH the signature is valid AND the row's
 * platform_public_key matches the key this deployment actually holds.
 * Verifying against the embedded key alone (the original behaviour) is
 * trust-on-first-use: a row tampered to swap signature + public_key
 * for a freshly-signed pair under any attacker key would pass. The
 * platform key is *the* trust anchor — checking it twice (once to
 * verify, once to identity-match) is what makes the anchor load-bearing.
 *
 * SCHEMA_AUDIT.md P0-5.
 */
export async function verifyAttestationRecord(row: AttestationRecord): Promise<boolean> {
  const livePlatformKey = await getPublicKey();
  if (row.platform_public_key !== livePlatformKey) {
    return false;
  }
  const payload = canonicalAttestationPayload({
    id: row.id,
    agent_id: row.agent_id,
    owner_id: row.owner_id,
    window_start: row.window_start,
    window_end: row.window_end,
    event_count: row.event_count,
    events_hash: row.events_hash,
    verdict: row.verdict,
    violations: row.violations,
    platform_public_key: row.platform_public_key,
  });
  return verifyAttestationSignature(payload, row.platform_signature, row.platform_public_key);
}
