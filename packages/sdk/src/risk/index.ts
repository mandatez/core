export type RiskGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
export type RiskDomain =
  | 'financial'
  | 'communication'
  | 'database'
  | 'external_api'
  | 'storage'
  | 'other';

export type RiskActionType = 'read' | 'write' | 'export' | 'delete' | 'call' | 'payment';

export interface RiskSeverityBucket {
  events: number;
  blocked: number;
  flagged: number;
  deduction: number;
}

export interface RiskIncidentPatterns {
  hourly_spikes: Array<{ hour: string; count: number; ratio_over_average: number }>;
  repeated_blocks: Array<{ resource: string; blocked_count: number }>;
  escalations: Array<{
    resource: string;
    chain: RiskActionType[];
    started_at: string;
    ended_at: string;
  }>;
}

export interface RiskScoreRecord {
  id?: string;
  agent_id: string;
  owner_id: string;
  overall_score: number;
  grade: RiskGrade;
  severity_breakdown: Record<RiskActionType, RiskSeverityBucket>;
  domain_classification: Record<RiskDomain, number>;
  incident_patterns: RiskIncidentPatterns;
  blocked_ratio: number;
  flagged_ratio: number;
  event_count: number;
  window_days: number;
  computed_at: string;
}

export interface RiskClientConfig {
  /** Dashboard API base URL, e.g. 'https://dashboard.mandatez.com'. */
  apiUrl: string;
  /** Bearer API key ("mz_live_..."). */
  apiKey: string;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fetch the most recent risk score for an agent. The dashboard auto-computes
 * a fresh score if none exists yet, so this never returns null.
 */
export async function getRiskScore(
  agentId: string,
  config: RiskClientConfig,
): Promise<RiskScoreRecord> {
  const res = await fetch(`${normalizeUrl(config.apiUrl)}/api/risk/${agentId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });

  if (!res.ok) {
    throw new Error(
      `MandateZ getRiskScore failed: ${await readError(res, `HTTP ${res.status}`)}`,
    );
  }

  return (await res.json()) as RiskScoreRecord;
}

/**
 * Trigger a fresh risk score computation for an agent and return the new record.
 * `windowDays` defaults to the dashboard's server-side default (30) when omitted.
 */
export async function computeRiskScore(
  agentId: string,
  config: RiskClientConfig,
  windowDays?: number,
): Promise<RiskScoreRecord> {
  const res = await fetch(`${normalizeUrl(config.apiUrl)}/api/risk/compute/${agentId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(windowDays != null ? { window_days: windowDays } : {}),
  });

  if (!res.ok) {
    throw new Error(
      `MandateZ computeRiskScore failed: ${await readError(res, `HTTP ${res.status}`)}`,
    );
  }

  return (await res.json()) as RiskScoreRecord;
}
