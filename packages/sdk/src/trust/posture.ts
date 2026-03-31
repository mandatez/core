import type { AgentEvent } from '../events/schema.js';

export interface AgentTrustProfile {
  trust_score: number;
  trust_grade: 'unverified' | 'low' | 'medium' | 'high' | 'verified';
  total_events: number;
  allowed_ratio: number;
  flagged_ratio: number;
  blocked_ratio: number;
  human_approvals: number;
  human_rejections: number;
  first_seen: string | null;
  last_active: string | null;
}

function assignGrade(score: number): AgentTrustProfile['trust_grade'] {
  if (score >= 80) return 'verified';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'unverified';
}

/**
 * Computes a trust score (0–100) and profile from an agent's event history.
 *
 * Scoring model:
 * - Behavioral history  40pts: (allowed / total) * 40
 * - Longevity           20pts: min(days_active / 90, 1) * 20
 * - Human oversight     25pts: (approvals / (approvals + rejections + 1)) * 25
 * - Policy compliance   15pts: (1 - blocked_ratio - flagged_ratio * 0.5) * 15
 */
export function computeTrustScore(events: AgentEvent[]): AgentTrustProfile {
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
  const allowed = events.filter(e => e.outcome === 'allowed').length;
  const flagged = events.filter(e => e.outcome === 'flagged').length;
  const blocked = events.filter(e => e.outcome === 'blocked').length;

  const allowedRatio = allowed / total;
  const flaggedRatio = flagged / total;
  const blockedRatio = blocked / total;

  // Human oversight counts from metadata
  let approvals = 0;
  let rejections = 0;
  for (const e of events) {
    if (e.metadata && typeof e.metadata === 'object') {
      if ((e.metadata as Record<string, unknown>).human_approved === true) approvals++;
      if ((e.metadata as Record<string, unknown>).human_rejected === true) rejections++;
    }
  }

  // Longevity — days between first and last event
  const timestamps = events.map(e => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
  const firstSeen = new Date(timestamps[0]);
  const lastActive = new Date(timestamps[timestamps.length - 1]);
  const daysActive = (lastActive.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24);

  // Score components
  const behavioralScore = allowedRatio * 40;
  const longevityScore = Math.min(daysActive / 90, 1) * 20;
  const oversightScore = (approvals / (approvals + rejections + 1)) * 25;
  const complianceScore = Math.max(0, (1 - blockedRatio - flaggedRatio * 0.5)) * 15;

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
