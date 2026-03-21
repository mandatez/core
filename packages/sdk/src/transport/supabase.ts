import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AgentEvent } from '../events/schema.js';

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
}
