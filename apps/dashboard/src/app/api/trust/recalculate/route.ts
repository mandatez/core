import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { computeTrustScore, type AgentEvent } from '@mandatez/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/trust/recalculate
//
// On-demand companion to the recalculate-trust-scores edge function.
// Hourly cron covers the scheduled path; this route lets the dashboard
// trigger a refresh right now — either for every agent with recent activity
// (default) or for an explicit list of agent_ids.
//
// Body (all optional):
//   { agent_ids?: string[]; since_hours?: number; owner_id?: string }
//
// When agent_ids is omitted, behaves like the edge function: picks up every
// agent with at least one event in the last since_hours (default 24).

interface TriggerBody {
  agent_ids?: string[];
  since_hours?: number;
  owner_id?: string;
}

interface RecentEventRow {
  agent_id: string;
}

interface StoredEventRow {
  id: string;
  agent_id: string;
  owner_id: string;
  timestamp: string;
  action_type: AgentEvent['action_type'];
  resource: string;
  outcome: AgentEvent['outcome'];
  policy_id: string | null;
  metadata: Record<string, unknown> | null;
  signature: string;
  public_key: string;
}

function toAgentEvent(row: StoredEventRow): AgentEvent {
  return {
    event_id: row.id,
    agent_id: row.agent_id,
    owner_id: row.owner_id,
    timestamp: row.timestamp,
    action_type: row.action_type,
    resource: row.resource,
    outcome: row.outcome,
    policy_id: row.policy_id ?? null,
    metadata: row.metadata ?? {},
    signature: row.signature,
    public_key: row.public_key,
  };
}

export async function POST(request: NextRequest) {
  let body: TriggerBody = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw) as TriggerBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sinceHours = typeof body.since_hours === 'number' && body.since_hours > 0 ? body.since_hours : 24;
  const explicitIds = Array.isArray(body.agent_ids) ? body.agent_ids.filter((x) => typeof x === 'string') : null;
  const ownerId = body.owner_id?.trim();

  const supabase = createServerClient();
  const startedAt = new Date().toISOString();
  let agentIds: string[];

  if (explicitIds && explicitIds.length > 0) {
    agentIds = [...new Set(explicitIds)];
  } else {
    const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

    let query = supabase.from('agent_events').select('agent_id').gte('timestamp', sinceIso);
    if (ownerId) query = query.eq('owner_id', ownerId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: `Failed to fetch recent events: ${error.message}` }, { status: 500 });
    }
    agentIds = [...new Set(((data ?? []) as RecentEventRow[]).map((r) => r.agent_id))];
  }

  if (agentIds.length === 0) {
    return NextResponse.json({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      processed: 0,
      updated: 0,
      errors: 0,
      message: 'No agents matched the recalculation criteria.',
    });
  }

  const results: Array<
    | { agent_id: string; trust_score: number; trust_grade: string }
    | { agent_id: string; error: string }
  > = [];

  for (const agentId of agentIds) {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('agent_events')
        .select('*')
        .eq('agent_id', agentId)
        .order('timestamp', { ascending: true });

      if (eventsError) {
        results.push({ agent_id: agentId, error: `fetch events: ${eventsError.message}` });
        continue;
      }

      const events = ((eventsData ?? []) as StoredEventRow[]).map(toAgentEvent);
      const profile = computeTrustScore(events);

      const { error: updateError } = await supabase
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

      if (updateError) {
        results.push({ agent_id: agentId, error: `update agent: ${updateError.message}` });
        continue;
      }

      results.push({
        agent_id: agentId,
        trust_score: profile.trust_score,
        trust_grade: profile.trust_grade,
      });
    } catch (err) {
      results.push({
        agent_id: agentId,
        error: err instanceof Error ? err.message : 'unknown error',
      });
    }
  }

  const updated = results.filter((r) => !('error' in r)).length;
  const errors = results.filter((r) => 'error' in r).length;

  return NextResponse.json({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    processed: agentIds.length,
    updated,
    errors,
    results,
  });
}
