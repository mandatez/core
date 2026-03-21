import { createSignedEvent } from './events/signing.js';
import { SupabaseTransport } from './transport/supabase.js';
import type { AgentEvent, AgentEventInput } from './events/schema.js';

/** The action fields a developer passes to track() */
export interface TrackInput {
  action_type: AgentEventInput['action_type'];
  resource: string;
  outcome: AgentEventInput['outcome'];
  policy_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MandateZClientConfig {
  agentId: string;
  ownerId: string;
  privateKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Main SDK surface for developers.
 *
 * Wires together identity, signing, and transport so a developer
 * can track agent actions with a single method call.
 */
export class MandateZClient {
  private agentId: string;
  private ownerId: string;
  private privateKey: string;
  private transport: SupabaseTransport;

  constructor(config: MandateZClientConfig) {
    this.agentId = config.agentId;
    this.ownerId = config.ownerId;
    this.privateKey = config.privateKey;
    this.transport = new SupabaseTransport({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
    });
  }

  /**
   * Track an agent action: sign it, emit it to Supabase, return the event.
   *
   * This is the one method most integrations need.
   */
  async track(input: TrackInput): Promise<AgentEvent> {
    const eventInput: AgentEventInput = {
      agent_id: this.agentId,
      owner_id: this.ownerId,
      action_type: input.action_type,
      resource: input.resource,
      outcome: input.outcome,
      policy_id: input.policy_id ?? null,
      metadata: input.metadata ?? {},
    };

    const signed = await createSignedEvent(eventInput, this.privateKey);
    return this.transport.emitEvent(signed);
  }
}
