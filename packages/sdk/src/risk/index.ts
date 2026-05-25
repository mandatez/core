import { z } from 'zod';
import {
  fetchWithTimeout,
  parseJsonResponse,
  readErrorMessage,
  MandateZHttpError,
} from '../internal/http.js';

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
  /** Optional fetch timeout in ms. Defaults to 15s. */
  timeoutMs?: number;
}

const RiskActionTypeSchema = z.enum(['read', 'write', 'export', 'delete', 'call', 'payment']);

const RiskSeverityBucketSchema = z.object({
  events: z.number(),
  blocked: z.number(),
  flagged: z.number(),
  deduction: z.number(),
});

const RiskIncidentPatternsSchema = z.object({
  hourly_spikes: z.array(
    z.object({
      hour: z.string(),
      count: z.number(),
      ratio_over_average: z.number(),
    }),
  ),
  repeated_blocks: z.array(
    z.object({
      resource: z.string(),
      blocked_count: z.number(),
    }),
  ),
  escalations: z.array(
    z.object({
      resource: z.string(),
      chain: z.array(RiskActionTypeSchema),
      started_at: z.string(),
      ended_at: z.string(),
    }),
  ),
});

const RiskScoreRecordSchema = z.object({
  id: z.string().optional(),
  agent_id: z.string(),
  owner_id: z.string(),
  overall_score: z.number(),
  grade: z.enum(['A+', 'A', 'B', 'C', 'D', 'F']),
  severity_breakdown: z.record(RiskActionTypeSchema, RiskSeverityBucketSchema),
  domain_classification: z.record(
    z.enum(['financial', 'communication', 'database', 'external_api', 'storage', 'other']),
    z.number(),
  ),
  incident_patterns: RiskIncidentPatternsSchema,
  blocked_ratio: z.number(),
  flagged_ratio: z.number(),
  event_count: z.number(),
  window_days: z.number(),
  computed_at: z.string(),
}) satisfies z.ZodType<RiskScoreRecord>;

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Fetch the most recent risk score for an agent. The dashboard auto-computes
 * a fresh score if none exists yet, so this never returns null.
 *
 * Throws {@link MandateZHttpError} on network failure, timeout, non-JSON
 * response, or unexpected response shape.
 */
export async function getRiskScore(
  agentId: string,
  config: RiskClientConfig,
): Promise<RiskScoreRecord> {
  const url = `${normalizeUrl(config.apiUrl)}/api/risk/${agentId}`;
  const res = await fetchWithTimeout('getRiskScore', url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    timeoutMs: config.timeoutMs,
  });

  if (!res.ok) {
    throw new MandateZHttpError({
      label: 'getRiskScore',
      url,
      status: res.status,
      reason: await readErrorMessage(res, `HTTP ${res.status}`),
    });
  }

  return parseJsonResponse('getRiskScore', url, res, RiskScoreRecordSchema);
}

/**
 * Trigger a fresh risk score computation for an agent and return the new record.
 * `windowDays` defaults to the dashboard's server-side default (30) when omitted.
 *
 * Throws {@link MandateZHttpError} on network failure, timeout, non-JSON
 * response, or unexpected response shape.
 */
export async function computeRiskScore(
  agentId: string,
  config: RiskClientConfig,
  windowDays?: number,
): Promise<RiskScoreRecord> {
  const url = `${normalizeUrl(config.apiUrl)}/api/risk/compute/${agentId}`;
  const res = await fetchWithTimeout('computeRiskScore', url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(windowDays != null ? { window_days: windowDays } : {}),
    timeoutMs: config.timeoutMs,
  });

  if (!res.ok) {
    throw new MandateZHttpError({
      label: 'computeRiskScore',
      url,
      status: res.status,
      reason: await readErrorMessage(res, `HTTP ${res.status}`),
    });
  }

  return parseJsonResponse('computeRiskScore', url, res, RiskScoreRecordSchema);
}
