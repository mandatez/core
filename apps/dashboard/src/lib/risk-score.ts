import { createServerClient } from './supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActionType = 'read' | 'write' | 'export' | 'delete' | 'call' | 'payment';
export type Outcome = 'allowed' | 'blocked' | 'flagged' | 'pending_approval';
export type RiskGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
export type RiskDomain = 'financial' | 'communication' | 'database' | 'external_api' | 'storage' | 'other';

export const SEVERITY_WEIGHTS: Record<ActionType, number> = {
  payment: 10,
  delete: 8,
  export: 7,
  write: 4,
  call: 3,
  read: 1,
};

const DOMAIN_PATTERNS: Array<{ domain: RiskDomain; pattern: RegExp }> = [
  { domain: 'financial', pattern: /(stripe|payment|invoice|bank|transaction|payout|wallet|paypal|billing|checkout|charge)/i },
  { domain: 'communication', pattern: /(email|gmail|outlook|message|slack|sms|telegram|whatsapp|chat|\bmail\b|inbox|smtp)/i },
  { domain: 'database', pattern: /(database|\bdb\b|sql|postgres|mysql|mongo|query|\btable\b|\brow\b|supabase|firestore)/i },
  { domain: 'storage', pattern: /(\bs3\b|storage|bucket|upload|download|blob|\bfile\b|gcs|dropbox|drive)/i },
  { domain: 'external_api', pattern: /(api\/|^https?:|webhook|external|integration|third[-_ ]party)/i },
];

export function classifyResource(resource: string): RiskDomain {
  for (const { domain, pattern } of DOMAIN_PATTERNS) {
    if (pattern.test(resource)) return domain;
  }
  return 'other';
}

export function assignGrade(score: number): RiskGrade {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}

interface RiskEventRow {
  agent_id: string;
  timestamp: string;
  action_type: ActionType;
  resource: string;
  outcome: Outcome;
  policy_id: string | null;
}

interface SeverityBucket {
  events: number;
  blocked: number;
  flagged: number;
  deduction: number;
}

export interface IncidentPatterns {
  hourly_spikes: Array<{ hour: string; count: number; ratio_over_average: number }>;
  repeated_blocks: Array<{ resource: string; blocked_count: number }>;
  escalations: Array<{ resource: string; chain: ActionType[]; started_at: string; ended_at: string }>;
}

export interface RiskScoreRecord {
  id?: string;
  agent_id: string;
  owner_id: string;
  overall_score: number;
  grade: RiskGrade;
  severity_breakdown: Record<ActionType, SeverityBucket>;
  domain_classification: Record<RiskDomain, number>;
  incident_patterns: IncidentPatterns;
  blocked_ratio: number;
  flagged_ratio: number;
  event_count: number;
  window_days: number;
  computed_at: string;
}

const ESCALATION_ORDER: ActionType[] = ['read', 'write', 'export', 'delete'];
const ESCALATION_WINDOW_MS = 60 * 60 * 1000;

function detectHourlySpikes(events: RiskEventRow[]): IncidentPatterns['hourly_spikes'] {
  if (events.length === 0) return [];

  const buckets = new Map<string, number>();
  for (const e of events) {
    const d = new Date(e.timestamp);
    const hourKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:00:00Z`;
    buckets.set(hourKey, (buckets.get(hourKey) ?? 0) + 1);
  }

  const counts = Array.from(buckets.values());
  const average = counts.reduce((a, b) => a + b, 0) / counts.length;
  if (average <= 0) return [];

  const spikes: IncidentPatterns['hourly_spikes'] = [];
  for (const [hour, count] of buckets.entries()) {
    if (count > average * 3) {
      spikes.push({
        hour,
        count,
        ratio_over_average: Math.round((count / average) * 100) / 100,
      });
    }
  }
  return spikes.sort((a, b) => b.count - a.count);
}

function detectRepeatedBlocks(events: RiskEventRow[]): IncidentPatterns['repeated_blocks'] {
  const blocks = new Map<string, number>();
  for (const e of events) {
    if (e.outcome === 'blocked') {
      blocks.set(e.resource, (blocks.get(e.resource) ?? 0) + 1);
    }
  }
  return Array.from(blocks.entries())
    .filter(([, n]) => n >= 3)
    .map(([resource, blocked_count]) => ({ resource, blocked_count }))
    .sort((a, b) => b.blocked_count - a.blocked_count);
}

function detectEscalations(events: RiskEventRow[]): IncidentPatterns['escalations'] {
  // Group events by resource, scan for read→write→export→delete progressions
  // (any monotonically advancing subsequence of length >=3) within a 1hr window.
  const byResource = new Map<string, RiskEventRow[]>();
  for (const e of events) {
    if (!ESCALATION_ORDER.includes(e.action_type)) continue;
    const list = byResource.get(e.resource) ?? [];
    list.push(e);
    byResource.set(e.resource, list);
  }

  const escalations: IncidentPatterns['escalations'] = [];

  for (const [resource, list] of byResource.entries()) {
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (let i = 0; i < list.length; i++) {
      const startRank = ESCALATION_ORDER.indexOf(list[i].action_type);
      if (startRank < 0) continue;

      const chain: ActionType[] = [list[i].action_type];
      let currentRank = startRank;
      const startTime = new Date(list[i].timestamp).getTime();
      let endTime = startTime;

      for (let j = i + 1; j < list.length; j++) {
        const nextTime = new Date(list[j].timestamp).getTime();
        if (nextTime - startTime > ESCALATION_WINDOW_MS) break;

        const nextRank = ESCALATION_ORDER.indexOf(list[j].action_type);
        if (nextRank > currentRank) {
          chain.push(list[j].action_type);
          currentRank = nextRank;
          endTime = nextTime;
        }
      }

      if (chain.length >= 3) {
        escalations.push({
          resource,
          chain,
          started_at: new Date(startTime).toISOString(),
          ended_at: new Date(endTime).toISOString(),
        });
        // Skip past this escalation to avoid duplicate overlapping chains.
        break;
      }
    }
  }

  return escalations;
}

export function computeRiskScoreFromEvents(params: {
  agentId: string;
  ownerId: string;
  events: RiskEventRow[];
  windowDays: number;
}): RiskScoreRecord {
  const { agentId, ownerId, events, windowDays } = params;

  const severityBreakdown: Record<ActionType, SeverityBucket> = {
    payment: { events: 0, blocked: 0, flagged: 0, deduction: 0 },
    delete: { events: 0, blocked: 0, flagged: 0, deduction: 0 },
    export: { events: 0, blocked: 0, flagged: 0, deduction: 0 },
    write: { events: 0, blocked: 0, flagged: 0, deduction: 0 },
    call: { events: 0, blocked: 0, flagged: 0, deduction: 0 },
    read: { events: 0, blocked: 0, flagged: 0, deduction: 0 },
  };

  const domainCounts: Record<RiskDomain, number> = {
    financial: 0,
    communication: 0,
    database: 0,
    external_api: 0,
    storage: 0,
    other: 0,
  };

  let score = 100;
  let blocked = 0;
  let flagged = 0;

  for (const e of events) {
    const weight = SEVERITY_WEIGHTS[e.action_type] ?? 1;
    const bucket = severityBreakdown[e.action_type];
    if (bucket) {
      bucket.events += 1;
    }

    if (e.outcome === 'blocked') {
      blocked += 1;
      const ded = 5 * weight;
      score -= ded;
      if (bucket) {
        bucket.blocked += 1;
        bucket.deduction += ded;
      }
    } else if (e.outcome === 'flagged') {
      flagged += 1;
      const ded = 2 * weight;
      score -= ded;
      if (bucket) {
        bucket.flagged += 1;
        bucket.deduction += ded;
      }
    }

    if (!e.policy_id) {
      score -= 1;
    }

    domainCounts[classifyResource(e.resource)] += 1;
  }

  const overallScore = Math.max(0, Math.min(100, Math.round(score)));
  const total = events.length;
  const blockedRatio = total === 0 ? 0 : Math.round((blocked / total) * 10000) / 10000;
  const flaggedRatio = total === 0 ? 0 : Math.round((flagged / total) * 10000) / 10000;

  const incidentPatterns: IncidentPatterns = {
    hourly_spikes: detectHourlySpikes(events),
    repeated_blocks: detectRepeatedBlocks(events),
    escalations: detectEscalations(events),
  };

  return {
    agent_id: agentId,
    owner_id: ownerId,
    overall_score: overallScore,
    grade: assignGrade(overallScore),
    severity_breakdown: severityBreakdown,
    domain_classification: domainCounts,
    incident_patterns: incidentPatterns,
    blocked_ratio: blockedRatio,
    flagged_ratio: flaggedRatio,
    event_count: total,
    window_days: windowDays,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Compute a fresh risk score for an agent over the lookback window and
 * insert it into agent_risk_scores. Returns the persisted record.
 *
 * Caller is responsible for authorizing the agent belongs to the owner —
 * this function trusts the (agentId, ownerId) tuple it is given.
 */
export async function computeRiskScore(
  agentId: string,
  windowDays = 30,
  client?: SupabaseClient,
): Promise<RiskScoreRecord> {
  const supabase = client ?? createServerClient();

  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('owner_id')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: eventsErr } = await supabase
    .from('agent_events')
    .select('agent_id, timestamp, action_type, resource, outcome, policy_id')
    .eq('agent_id', agentId)
    .gte('timestamp', sinceIso)
    .order('timestamp', { ascending: true });

  if (eventsErr) {
    throw new Error(`Failed to load events for risk score: ${eventsErr.message}`);
  }

  const record = computeRiskScoreFromEvents({
    agentId,
    ownerId: agent.owner_id as string,
    events: (rows ?? []) as RiskEventRow[],
    windowDays,
  });

  const { data: inserted, error: insertErr } = await supabase
    .from('agent_risk_scores')
    .insert({
      agent_id: record.agent_id,
      owner_id: record.owner_id,
      overall_score: record.overall_score,
      grade: record.grade,
      severity_breakdown: record.severity_breakdown,
      domain_classification: record.domain_classification,
      incident_patterns: record.incident_patterns,
      blocked_ratio: record.blocked_ratio,
      flagged_ratio: record.flagged_ratio,
      event_count: record.event_count,
      window_days: record.window_days,
      computed_at: record.computed_at,
    })
    .select('id')
    .single();

  if (insertErr) {
    throw new Error(`Failed to persist risk score: ${insertErr.message}`);
  }

  return { ...record, id: inserted?.id as string };
}

/**
 * Returns the most recent risk score for an agent, or null if none exists.
 */
export async function getLatestRiskScore(
  agentId: string,
  client?: SupabaseClient,
): Promise<RiskScoreRecord | null> {
  const supabase = client ?? createServerClient();

  const { data, error } = await supabase
    .from('agent_risk_scores')
    .select('*')
    .eq('agent_id', agentId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load risk score: ${error.message}`);
  }
  if (!data) return null;

  return data as RiskScoreRecord;
}
