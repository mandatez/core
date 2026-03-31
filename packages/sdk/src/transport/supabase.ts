import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AgentEvent } from '../events/schema.js';
import type { AgentTrustProfile } from '../trust/posture.js';

export interface SupabaseTransportConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export class SupabaseTransport {
  private client: SupabaseClient;

  constructor(config: SupabaseTransportConfig) {
    this.client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  /**
   * Inserts a signed AgentEvent into the agent_events table.
   * Throws on Supabase errors so callers can handle failures.
   */
  async emitEvent(event: AgentEvent): Promise<AgentEvent> {
    const { error } = await this.client.from('agent_events').insert({
      id: event.event_id,
      agent_id: event.agent_id,
      owner_id: event.owner_id,
      timestamp: event.timestamp,
      action_type: event.action_type,
      resource: event.resource,
      outcome: event.outcome,
      policy_id: event.policy_id,
      metadata: event.metadata,
      signature: event.signature,
      public_key: event.public_key,
    });

    if (error) {
      throw new Error(`Failed to emit event: ${error.message}`);
    }

    return event;
  }

  /**
   * Fetches all events for an agent, ordered by timestamp.
   */
  async fetchAgentEvents(agentId: string): Promise<AgentEvent[]> {
    const { data, error } = await this.client
      .from('agent_events')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch agent events: ${error.message}`);
    }

    return (data ?? []).map((row: Record<string, unknown>) => ({
      event_id: row.id as string,
      agent_id: row.agent_id as string,
      owner_id: row.owner_id as string,
      timestamp: row.timestamp as string,
      action_type: row.action_type as AgentEvent['action_type'],
      resource: row.resource as string,
      outcome: row.outcome as AgentEvent['outcome'],
      policy_id: (row.policy_id as string) ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      signature: row.signature as string,
      public_key: row.public_key as string,
    }));
  }

  /**
   * Updates the agent's trust profile columns in the agents table.
   */
  async updateAgentTrust(agentId: string, profile: AgentTrustProfile): Promise<void> {
    const { error } = await this.client
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

    if (error) {
      throw new Error(`Failed to update agent trust: ${error.message}`);
    }
  }
}
