import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VALID_ACTION_TYPES = ['read', 'write', 'export', 'delete', 'call', 'payment'] as const;
const VALID_OUTCOMES = ['allowed', 'blocked', 'flagged', 'pending_approval'] as const;

type ActionType = (typeof VALID_ACTION_TYPES)[number];
type Outcome = (typeof VALID_OUTCOMES)[number];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

interface EventRow {
  id: string;
  agent_id: string;
  owner_id: string;
  timestamp: string;
  action_type: string;
  resource: string;
  outcome: string;
  policy_id: string | null;
  metadata: Record<string, unknown>;
  signature: string;
  public_key: string;
}

interface AgentRow {
  id: string;
  name: string | null;
}

interface FiltersApplied {
  owner_id: string;
  q: string | null;
  agent_id: string | null;
  action_types: ActionType[] | null;
  outcomes: Outcome[] | null;
  from: string | null;
  to: string | null;
  policy_id: string | null;
  limit: number;
  offset: number;
}

function parseCsvList<T extends string>(raw: string | null, valid: readonly T[]): T[] | null {
  if (!raw) return null;
  const items = raw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const filtered = items.filter((x): x is T => (valid as readonly string[]).includes(x));
  return filtered.length > 0 ? filtered : null;
}

function parseIsoDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Prepares a user-supplied query string for Postgres ILIKE matching.
 *
 * Strips comma/paren/quote (PostgREST structural chars), collapses
 * whitespace, and escapes the two ILIKE wildcards (% and _) so that
 * user input is always treated as a literal substring. The caller
 * wraps the result in `%...%` for substring search.
 */
function sanitizeQForIlike(q: string): string {
  return q
    .replace(/[,()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([%_])/g, '\\$1');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;
  const ownerId = auth.ownerId;

  const params = request.nextUrl.searchParams;
  const qRaw = params.get('q')?.trim() ?? null;
  const q = qRaw && qRaw.length > 0 ? qRaw : null;

  const agentId = params.get('agent_id')?.trim() || null;
  if (agentId && !/^ag_[A-Za-z0-9_-]+$/.test(agentId)) {
    return NextResponse.json(
      { error: 'agent_id must match /^ag_[A-Za-z0-9_-]+$/' },
      { status: 400 },
    );
  }

  const actionTypes = parseCsvList(params.get('action_type'), VALID_ACTION_TYPES);
  const outcomes = parseCsvList(params.get('outcome'), VALID_OUTCOMES);

  const from = parseIsoDate(params.get('from'));
  const to = parseIsoDate(params.get('to'));
  if (from && to && new Date(from) > new Date(to)) {
    return NextResponse.json({ error: 'from must be before to' }, { status: 400 });
  }

  const policyId = params.get('policy_id')?.trim() || null;

  const limitRaw = Number.parseInt(params.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const offsetRaw = Number.parseInt(params.get('offset') ?? '', 10);
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const supabase = createServerClient();

  // Base query: owner-scoped + filters. We request an exact count so the
  // UI can render accurate pagination without a second round trip.
  let query = supabase
    .from('agent_events')
    .select(
      'id, agent_id, owner_id, timestamp, action_type, resource, outcome, policy_id, metadata, signature, public_key',
      { count: 'exact' },
    )
    .eq('owner_id', ownerId);

  if (agentId) query = query.eq('agent_id', agentId);
  if (policyId) query = query.eq('policy_id', policyId);
  if (from) query = query.gte('timestamp', from);
  if (to) query = query.lte('timestamp', to);
  if (actionTypes && actionTypes.length > 0) query = query.in('action_type', actionTypes);
  if (outcomes && outcomes.length > 0) query = query.in('outcome', outcomes);

  if (q) {
    // Prefer trigram ILIKE over tsvector websearch here: tsvector tokenizes
    // identifier-like strings (ag_xK9m, vercel/v9/projects) badly. Trigram
    // ILIKE on the generated `search_text` column with the gin_trgm_ops
    // index runs in milliseconds and matches the way auditors actually
    // search (substrings of resources, partial agent IDs, policy names).
    const safe = sanitizeQForIlike(q);
    if (safe.length > 0) {
      const pattern = `%${safe}%`;
      query = query.ilike('search_text', pattern);
    }
  }

  query = query.order('timestamp', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []) as EventRow[];

  // Best-effort join for agent names so the UI can render "support-bot"
  // rather than the raw ag_... ID. Failure is non-fatal — we still return
  // the events without names.
  const uniqueAgentIds = Array.from(new Set(events.map((e) => e.agent_id)));
  let agentNameById: Record<string, string> = {};
  if (uniqueAgentIds.length > 0) {
    const { data: agentRows } = await supabase
      .from('agents')
      .select('id, name')
      .in('id', uniqueAgentIds);
    if (agentRows) {
      agentNameById = Object.fromEntries(
        (agentRows as AgentRow[]).map((a) => [a.id, a.name ?? a.id]),
      );
    }
  }

  const filtersApplied: FiltersApplied = {
    owner_id: ownerId,
    q,
    agent_id: agentId,
    action_types: actionTypes,
    outcomes,
    from,
    to,
    policy_id: policyId,
    limit,
    offset,
  };

  return NextResponse.json({
    events: events.map((e) => ({
      ...e,
      agent_name: agentNameById[e.agent_id] ?? null,
    })),
    total: count ?? events.length,
    filters_applied: filtersApplied,
  });
}
