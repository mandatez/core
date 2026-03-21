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

export interface ComplianceReport {
  owner_id: string;
  generated_at: string;
  period: { from: string | null; to: string | null };
  summary: {
    total_events: number;
    by_outcome: {
      allowed: number;
      blocked: number;
      flagged: number;
      pending_approval: number;
    };
    by_action_type: Record<string, number>;
    top_resources: { resource: string; count: number }[];
    unique_agents: number;
  };
  events: EventRow[];
}

export function generateComplianceReport(
  ownerId: string,
  events: EventRow[],
  period: { from: string | null; to: string | null },
): ComplianceReport {
  const byOutcome = { allowed: 0, blocked: 0, flagged: 0, pending_approval: 0 };
  const byActionType: Record<string, number> = {};
  const byResource: Record<string, number> = {};
  const agents = new Set<string>();

  for (const event of events) {
    if (event.outcome in byOutcome) {
      byOutcome[event.outcome as keyof typeof byOutcome]++;
    }

    byActionType[event.action_type] = (byActionType[event.action_type] ?? 0) + 1;
    byResource[event.resource] = (byResource[event.resource] ?? 0) + 1;
    agents.add(event.agent_id);
  }

  const topResources = Object.entries(byResource)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([resource, count]) => ({ resource, count }));

  return {
    owner_id: ownerId,
    generated_at: new Date().toISOString(),
    period,
    summary: {
      total_events: events.length,
      by_outcome: byOutcome,
      by_action_type: byActionType,
      top_resources: topResources,
      unique_agents: agents.size,
    },
    events,
  };
}
