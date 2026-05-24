import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';
import { checkSsrfSafe } from '@/lib/ssrf-guard';
import {
  generateAgentIdentity,
  createSignedEvent,
  PolicyEngine,
  type Policy,
  type AgentEventInput,
} from '@mandatez/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Headers MandateZ reads — they are stripped before forwarding to the target.
const MANDATEZ_HEADER_PREFIX = 'x-mandatez-';
const H_AGENT_ID = 'x-mandatez-agent-id';
const H_OWNER_ID = 'x-mandatez-owner-id';
const H_TARGET_URL = 'x-mandatez-target-url';
const H_ACTION_TYPE = 'x-mandatez-action-type';
const H_RESOURCE = 'x-mandatez-resource';

// Hop-by-hop headers that must not be forwarded (RFC 7230 + a few extras that
// break fetch when forwarded verbatim).
const UNSAFE_FORWARD_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

type ActionType = AgentEventInput['action_type'];
const VALID_ACTION_TYPES: readonly ActionType[] = ['read', 'write', 'export', 'delete', 'call', 'payment'];

// SSRF guard is centralized in @/lib/ssrf-guard. It resolves the hostname
// and blocks any FQDN that maps to a private/loopback/link-local/CGNAT
// address — closing the DNS-rebinding gap that a hostname-pattern-only check
// would leave open. Residual TTL-flip risk MUST be mitigated by outbound
// egress restrictions at the infrastructure layer.

const MAX_PROXY_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

// --- Policy cache ---------------------------------------------------------
// Hitting Supabase on every proxied call is unsustainable for high-traffic
// agents. Cache the per-owner policy list for 30s — stale enough to feel
// real-time, short enough that revoked rules kick in within a cron cycle.
const POLICY_CACHE_TTL_MS = 30_000;
interface PolicyCacheEntry {
  policies: Policy[];
  expiresAt: number;
}
const policyCache = new Map<string, PolicyCacheEntry>();

interface AgentRow {
  id: string;
  owner_id: string;
  public_key: string;
  proxy_private_key: string | null;
  proxy_mode_enabled: boolean | null;
}

interface PolicyRow {
  id: string;
  owner_id: string;
  name: string;
  rules: Policy['rules'];
}

/**
 * Maps a target URL to a canonical resource string the policy engine can match.
 *
 *   https://api.openai.com/v1/chat/completions  → "openai/v1/chat/completions"
 *   https://api.anthropic.com/v1/messages        → "anthropic/v1/messages"
 *   https://api.stripe.com/v1/charges            → "stripe/v1/charges"
 *   https://xyz.supabase.co/rest/v1/users        → "supabase/rest/v1/users"
 *   https://custom.example.com/api/x             → "custom.example.com/api/x"
 */
function deriveResource(targetUrl: string): string {
  let u: URL;
  try {
    u = new URL(targetUrl);
  } catch {
    return targetUrl;
  }

  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/^\/+|\/+$/g, '');

  const wellKnown: Record<string, string> = {
    'api.openai.com': 'openai',
    'api.anthropic.com': 'anthropic',
    'api.stripe.com': 'stripe',
    'api.slack.com': 'slack',
    'slack.com': 'slack',
    'hooks.slack.com': 'slack',
    'api.github.com': 'github',
    'api.twilio.com': 'twilio',
    'api.sendgrid.com': 'sendgrid',
    'api.resend.com': 'resend',
    'api.vercel.com': 'vercel',
  };

  let prefix = wellKnown[host];
  if (!prefix) {
    // supabase projects use subdomain.supabase.co — fold them into one bucket
    if (host.endsWith('.supabase.co')) prefix = 'supabase';
    else prefix = host;
  }

  return path ? `${prefix}/${path}` : prefix;
}

/**
 * Fetch (or provision) the escrowed proxy identity for an agent.
 *
 * First call for any {owner_id, agent_id} generates a keypair and
 * inserts/updates the agents row. Subsequent calls return the existing
 * key. This is what makes Proxy Mode "zero code changes" — the agent
 * never holds a private key, MandateZ does.
 */
async function ensureProxyIdentity(
  supabase: ReturnType<typeof createServerClient>,
  agentId: string,
  ownerId: string,
): Promise<{ privateKey: string; publicKey: string }> {
  const readRes = await supabase
    .from('agents')
    .select('id, owner_id, public_key, proxy_private_key, proxy_mode_enabled')
    .eq('id', agentId)
    .maybeSingle();

  if (readRes.error) throw new Error(`proxy: failed to read agent: ${readRes.error.message}`);

  const existing = readRes.data as AgentRow | null;

  if (existing?.proxy_private_key && existing.public_key) {
    if (existing.owner_id !== ownerId) {
      throw new Error('proxy: agent_id/owner_id mismatch');
    }
    return { privateKey: existing.proxy_private_key, publicKey: existing.public_key };
  }

  // Provision a new identity. The returned agent_id from the SDK is ignored —
  // we bind the escrowed key to the caller-supplied agentId so the proxy
  // identity is stable across restarts.
  const identity = await generateAgentIdentity();

  if (existing) {
    if (existing.owner_id !== ownerId) {
      throw new Error('proxy: agent_id/owner_id mismatch');
    }
    const { error: updErr } = await supabase
      .from('agents')
      .update({
        proxy_private_key: identity.private_key,
        public_key: existing.public_key || identity.public_key,
        proxy_mode_enabled: true,
        proxy_mode_enabled_at: new Date().toISOString(),
      })
      .eq('id', agentId);
    if (updErr) throw new Error(`proxy: failed to provision key: ${updErr.message}`);
    return {
      privateKey: identity.private_key,
      publicKey: existing.public_key || identity.public_key,
    };
  }

  const { error: insErr } = await supabase.from('agents').insert({
    id: agentId,
    owner_id: ownerId,
    name: agentId,
    public_key: identity.public_key,
    proxy_private_key: identity.private_key,
    proxy_mode_enabled: true,
    proxy_mode_enabled_at: new Date().toISOString(),
    metadata: { provisioned_via: 'proxy' },
  });
  if (insErr) throw new Error(`proxy: failed to register agent: ${insErr.message}`);

  return { privateKey: identity.private_key, publicKey: identity.public_key };
}

async function loadPolicies(
  supabase: ReturnType<typeof createServerClient>,
  ownerId: string,
): Promise<Policy[]> {
  const res = await supabase
    .from('policies')
    .select('id, owner_id, name, rules')
    .eq('owner_id', ownerId);

  if (res.error) throw new Error(`proxy: failed to load policies: ${res.error.message}`);

  const rows = (res.data ?? []) as PolicyRow[];
  return rows.map((row) => ({
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    rules: row.rules,
  }));
}

async function loadPoliciesCached(
  supabase: ReturnType<typeof createServerClient>,
  ownerId: string,
): Promise<Policy[]> {
  const now = Date.now();
  const cached = policyCache.get(ownerId);
  if (cached && cached.expiresAt > now) return cached.policies;

  const fresh = await loadPolicies(supabase, ownerId);
  policyCache.set(ownerId, { policies: fresh, expiresAt: now + POLICY_CACHE_TTL_MS });
  return fresh;
}

function buildForwardHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower.startsWith(MANDATEZ_HEADER_PREFIX)) return;
    if (UNSAFE_FORWARD_HEADERS.has(lower)) return;
    out.set(key, value);
  });
  return out;
}

function errorResponse(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const started = Date.now();

  const auth = await requireApiKeyAuth(request, {
    bodyOwnerId: request.headers.get(H_OWNER_ID)?.trim() ?? null,
  });
  if (!auth.ok) return auth.response;

  // --- 1. Extract and validate headers -----------------------------------
  const headers = request.headers;
  const agentId = headers.get(H_AGENT_ID)?.trim();
  const ownerId = auth.ownerId;
  const targetUrl = headers.get(H_TARGET_URL)?.trim();

  if (!agentId) return errorResponse(400, { error: `missing required header: ${H_AGENT_ID}` });
  if (!targetUrl) return errorResponse(400, { error: `missing required header: ${H_TARGET_URL}` });

  if (!/^ag_[A-Za-z0-9_-]+$/.test(agentId)) {
    return errorResponse(400, { error: `invalid agent_id — must match /^ag_[A-Za-z0-9_-]+$/` });
  }

  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return errorResponse(400, { error: `invalid X-MandateZ-Target-URL: not a valid URL` });
  }

  const blocked = await checkSsrfSafe(targetUrl);
  if (blocked) {
    return errorResponse(400, { error: blocked });
  }

  const contentLength = Number.parseInt(headers.get('content-length') ?? '0', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_PROXY_BODY_BYTES) {
    return errorResponse(413, { error: 'request body exceeds 5 MB proxy cap' });
  }

  const actionTypeHeader = (headers.get(H_ACTION_TYPE)?.trim() ?? 'call').toLowerCase() as ActionType;
  const actionType: ActionType = VALID_ACTION_TYPES.includes(actionTypeHeader) ? actionTypeHeader : 'call';

  const resource = headers.get(H_RESOURCE)?.trim() || deriveResource(targetUrl);

  // --- 2. Load agent identity + policies --------------------------------
  const supabase = createServerClient();

  // Pre-check: if the agent already exists under another owner, return 404
  // so we do not leak whether the agent_id is taken across tenants.
  const ownershipRes = await supabase
    .from('agents')
    .select('id, owner_id')
    .eq('id', agentId)
    .maybeSingle();
  if (ownershipRes.data && ownershipRes.data.owner_id !== ownerId) {
    return errorResponse(404, { error: 'Agent not found' });
  }

  let identity: { privateKey: string; publicKey: string };
  try {
    identity = await ensureProxyIdentity(supabase, agentId, ownerId);
  } catch (err) {
    return errorResponse(403, {
      blocked: true,
      reason: err instanceof Error ? err.message : 'proxy: identity error',
      agent_id: agentId,
    });
  }

  const policies = await loadPoliciesCached(supabase, ownerId).catch(() => [] as Policy[]);

  const engine = new PolicyEngine();
  for (const p of policies) {
    try {
      engine.addPolicy(p);
    } catch {
      // malformed policy rows don't take the proxy down — skip them
    }
  }

  // --- 3. Evaluate policy -----------------------------------------------
  const evaluation = engine.evaluate(actionType, resource);

  // --- 4. Blocked → log signed event and return 403 ----------------------
  if (evaluation.outcome === 'blocked') {
    const signed = await createSignedEvent(
      {
        agent_id: agentId,
        owner_id: ownerId,
        action_type: actionType,
        resource,
        outcome: 'blocked',
        policy_id: evaluation.policy_id,
        metadata: {
          via: 'proxy',
          target_host: target.hostname,
          target_path: target.pathname,
          method: request.method,
        },
      },
      identity.privateKey,
    );
    await supabase.from('agent_events').insert({
      agent_id: signed.agent_id,
      owner_id: signed.owner_id,
      timestamp: signed.timestamp,
      action_type: signed.action_type,
      resource: signed.resource,
      outcome: signed.outcome,
      policy_id: signed.policy_id,
      metadata: signed.metadata,
      signature: signed.signature,
      public_key: signed.public_key,
    });

    return errorResponse(403, {
      blocked: true,
      policy_id: evaluation.policy_id,
      reason: evaluation.matched_rule
        ? `blocked by rule ${evaluation.matched_rule.id} on pattern "${evaluation.matched_rule.resource_pattern}"`
        : 'blocked by policy',
      agent_id: agentId,
      resource,
      event_id: signed.event_id,
    });
  }

  // --- 5. Forward request to target --------------------------------------
  const forwardHeaders = buildForwardHeaders(headers);

  let bodyBuffer: ArrayBuffer | null = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    bodyBuffer = await request.arrayBuffer();
    if (bodyBuffer.byteLength > MAX_PROXY_BODY_BYTES) {
      return errorResponse(413, { error: 'request body exceeds 5 MB proxy cap' });
    }
  }

  let targetResponse: Response;
  let proxyError: string | null = null;
  try {
    targetResponse = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      redirect: 'manual',
    });
  } catch (err) {
    proxyError = err instanceof Error ? err.message : 'upstream fetch failed';
    targetResponse = new Response(JSON.stringify({ error: proxyError }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const latencyMs = Date.now() - started;

  // --- 6. Sign + log the proxied call ------------------------------------
  const signedOutcome = evaluation.outcome === 'flagged' ? 'flagged' : 'allowed';

  const logMetadata: Record<string, unknown> = {
    via: 'proxy',
    target_host: target.hostname,
    target_path: target.pathname,
    method: request.method,
    status_code: targetResponse.status,
    latency_ms: latencyMs,
  };
  if (proxyError) logMetadata.upstream_error = proxyError;
  if (evaluation.matched_rule) logMetadata.matched_rule_id = evaluation.matched_rule.id;

  try {
    const signed = await createSignedEvent(
      {
        agent_id: agentId,
        owner_id: ownerId,
        action_type: actionType,
        resource,
        outcome: signedOutcome,
        policy_id: evaluation.policy_id,
        metadata: logMetadata,
      },
      identity.privateKey,
    );
    await supabase.from('agent_events').insert({
      agent_id: signed.agent_id,
      owner_id: signed.owner_id,
      timestamp: signed.timestamp,
      action_type: signed.action_type,
      resource: signed.resource,
      outcome: signed.outcome,
      policy_id: signed.policy_id,
      metadata: signed.metadata,
      signature: signed.signature,
      public_key: signed.public_key,
    });
  } catch {
    // Logging failure must never break a legitimate upstream call.
  }

  // --- 7. Relay target response ------------------------------------------
  const responseHeaders = new Headers();
  targetResponse.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (UNSAFE_FORWARD_HEADERS.has(lower)) return;
    responseHeaders.set(key, value);
  });
  responseHeaders.set('x-mandatez-agent-id', agentId);
  responseHeaders.set('x-mandatez-resource', resource);
  responseHeaders.set('x-mandatez-outcome', signedOutcome);
  if (evaluation.policy_id) responseHeaders.set('x-mandatez-policy-id', evaluation.policy_id);

  return new NextResponse(targetResponse.body, {
    status: targetResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'MandateZ Proxy',
    method: 'POST',
    docs: '/proxy',
    required_headers: [H_AGENT_ID, H_OWNER_ID, H_TARGET_URL],
    optional_headers: [H_ACTION_TYPE, H_RESOURCE],
  });
}
