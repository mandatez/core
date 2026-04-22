// Supabase Edge Function — recalculate-trust-scores
//
// Hourly batch job that refreshes the trust_score column on every agent
// that has logged at least one event in the last 24 hours. The scoring
// formula here mirrors computeTrustScore() in packages/sdk/src/trust/posture.ts
// exactly — the SDK remains the single source of truth for score semantics,
// this file is a Deno-native restatement so the edge runtime can execute it
// without depending on the npm workspace.
//
// Deploy:
//   supabase functions deploy recalculate-trust-scores --no-verify-jwt
//
// Schedule (see supabase/migrations/006_schedule_trust_recalc.sql):
//   pg_cron calls it hourly via pg_net.

// deno-lint-ignore-file no-explicit-any

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

type Outcome = 'allowed' | 'blocked' | 'flagged' | 'pending_approval';
type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

interface AgentEventRow {
  agent_id: string;
  timestamp: string;
  outcome: Outcome;
  metadata: Record<string, unknown> | null;
}

interface TrustProfile {
  trust_score: number;
  trust_grade: TrustGrade;
  total_events: number;
  allowed_ratio: number;
  flagged_ratio: number;
  blocked_ratio: number;
  human_approvals: number;
  human_rejections: number;
  first_seen: string | null;
  last_active: string | null;
}

function assignGrade(score: number): TrustGrade {
  if (score >= 80) return 'verified';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'unverified';
}

function computeTrustScore(events: AgentEventRow[]): TrustProfile {
  if (events.length === 0) {
    return {
      trust_score: 0,
      trust_grade: 'unverified',
      total_events: 0,
      allowed_ratio: 0,
      flagged_ratio: 0,
      blocked_ratio: 0,
      human_approvals: 0,
      human_rejections: 0,
      first_seen: null,
      last_active: null,
    };
  }

  const total = events.length;
  const allowed = events.filter((e) => e.outcome === 'allowed').length;
  const flagged = events.filter((e) => e.outcome === 'flagged').length;
  const blocked = events.filter((e) => e.outcome === 'blocked').length;

  const allowedRatio = allowed / total;
  const flaggedRatio = flagged / total;
  const blockedRatio = blocked / total;

  let approvals = 0;
  let rejections = 0;
  for (const e of events) {
    if (e.metadata && typeof e.metadata === 'object') {
      const m = e.metadata as Record<string, unknown>;
      if (m.human_approved === true) approvals++;
      if (m.human_rejected === true) rejections++;
    }
  }

  const timestamps = events.map((e) => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
  const firstSeen = new Date(timestamps[0]);
  const lastActive = new Date(timestamps[timestamps.length - 1]);
  const daysActive = (lastActive.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24);

  const behavioralScore = allowedRatio * 40;
  const longevityScore = Math.min(daysActive / 90, 1) * 20;
  const oversightScore = (approvals / (approvals + rejections + 1)) * 25;
  const complianceScore = Math.max(0, 1 - blockedRatio - flaggedRatio * 0.5) * 15;

  const rawScore = behavioralScore + longevityScore + oversightScore + complianceScore;
  const trustScore = Math.round(Math.min(100, Math.max(0, rawScore)));

  return {
    trust_score: trustScore,
    trust_grade: assignGrade(trustScore),
    total_events: total,
    allowed_ratio: Math.round(allowedRatio * 10000) / 10000,
    flagged_ratio: Math.round(flaggedRatio * 10000) / 10000,
    blocked_ratio: Math.round(blockedRatio * 10000) / 10000,
    human_approvals: approvals,
    human_rejections: rejections,
    first_seen: firstSeen.toISOString(),
    last_active: lastActive.toISOString(),
  };
}

async function fetchRecentAgentIds(client: SupabaseClient, sinceIso: string): Promise<string[]> {
  const ids = new Set<string>();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from('agent_events')
      .select('agent_id')
      .gte('timestamp', sinceIso)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`fetchRecentAgentIds: ${error.message}`);
    const rows = (data ?? []) as Array<{ agent_id: string }>;
    for (const r of rows) ids.add(r.agent_id);

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return [...ids];
}

async function fetchAgentEvents(client: SupabaseClient, agentId: string): Promise<AgentEventRow[]> {
  const { data, error } = await client
    .from('agent_events')
    .select('agent_id, timestamp, outcome, metadata')
    .eq('agent_id', agentId)
    .order('timestamp', { ascending: true });

  if (error) throw new Error(`fetchAgentEvents(${agentId}): ${error.message}`);
  return (data ?? []) as AgentEventRow[];
}

async function recalculateForAgent(
  client: SupabaseClient,
  agentId: string,
): Promise<{ agent_id: string; trust_score: number; trust_grade: TrustGrade } | { agent_id: string; error: string }> {
  try {
    const events = await fetchAgentEvents(client, agentId);
    const profile = computeTrustScore(events);

    const { error } = await client
      .from('agents')
      .update({
        trust_score: profile.trust_score,
        trust_grade: profile.trust_grade,
        total_events: profile.total_events,
        allowed_ratio: profile.allowed_ratio,
        flagged_ratio: profile.flagged_ratio,
        blocked_ratio: profile.blocked_ratio,
        human_approvals: profile.human_approvals,
        human_rejections: profile.human_rejections,
        first_seen: profile.first_seen,
        last_active: profile.last_active,
      })
      .eq('id', agentId);

    if (error) return { agent_id: agentId, error: error.message };
    return { agent_id: agentId, trust_score: profile.trust_score, trust_grade: profile.trust_grade };
  } catch (err) {
    return {
      agent_id: agentId,
      error: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

// Bounded-concurrency map so we don't open hundreds of Supabase connections
// at once when there's a big backlog of active agents.
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve(async (_req: Request) => {
  const startedAt = new Date().toISOString();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in edge function env',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let agentIds: string[];
  try {
    agentIds = await fetchRecentAgentIds(client, sinceIso);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'fetch failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (agentIds.length === 0) {
    return new Response(
      JSON.stringify({
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        processed: 0,
        updated: 0,
        errors: 0,
        message: 'No agents had events in the last 24 hours.',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  const results = await mapConcurrent(agentIds, 5, (id) => recalculateForAgent(client, id));

  const updated = results.filter((r) => !('error' in r)).length;
  const errors = results.filter((r) => 'error' in r).length;

  return new Response(
    JSON.stringify({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      processed: agentIds.length,
      updated,
      errors,
      results,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
