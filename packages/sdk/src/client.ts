import { createSignedEvent } from './events/signing.js';
import { SupabaseTransport } from './transport/supabase.js';
import { PolicyEngine } from './policy/index.js';
import { OversightGate } from './oversight/index.js';
import { computeTrustScore } from './trust/posture.js';
import type { AgentTrustProfile } from './trust/posture.js';
import type { AgentEvent, AgentEventInput } from './events/schema.js';
import type { Policy } from './policy/index.js';
import type { OversightConfig } from './oversight/index.js';

/** The action fields a developer passes to track() */
export interface TrackInput {
  action_type: AgentEventInput['action_type'];
  resource: string;
  outcome?: AgentEventInput['outcome'];
  policy_id?: string | null;
  metadata?: Record<string, unknown>;
  /** Optional callback for human approval. If oversight requires approval
   *  and this is not provided, timeout_action applies immediately. */
  waitForApproval?: () => Promise<boolean>;
}

export interface MandateZClientConfig {
  agentId: string;
  ownerId: string;
  privateKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Optional policies — if provided, track() evaluates them to determine outcome */
  policies?: Policy[];
  /** Optional oversight config — if provided, flagged actions pause for human approval */
  oversight?: OversightConfig;
}

/**
 * Main SDK surface for developers.
 *
 * Wires together identity, signing, policy, oversight, and transport
 * so a developer can track agent actions with a single method call.
 */
export class MandateZClient {
  private agentId: string;
  private ownerId: string;
  private privateKey: string;
  private transport: SupabaseTransport;
  private policyEngine: PolicyEngine;
  private oversightGate: OversightGate | null;
  private trustProfile: AgentTrustProfile | null = null;

  constructor(config: MandateZClientConfig) {
    this.agentId = config.agentId;
    this.ownerId = config.ownerId;
    this.privateKey = config.privateKey;
    this.transport = new SupabaseTransport({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
    });

    this.policyEngine = new PolicyEngine();
    if (config.policies) {
      for (const policy of config.policies) {
        this.policyEngine.addPolicy(policy);
      }
    }

    this.oversightGate = config.oversight
      ? new OversightGate(config.oversight)
      : null;
  }

  /**
   * Track an agent action.
   *
   * Flow:
   * 1. Evaluate policy engine → determines outcome (allowed/blocked/flagged)
   * 2. If blocked → sign event with 'blocked' outcome, emit, return (action does not proceed)
   * 3. If oversight gate is configured and action requires approval:
   *    - Fire alerts, wait for human decision or timeout
   *    - Override outcome based on approval result
   * 4. Sign event, emit to Supabase, return
   */
  async track(input: TrackInput): Promise<AgentEvent> {
    // Step 1: Policy evaluation
    const policyResult = this.policyEngine.evaluate(input.action_type, input.resource);
    let outcome = input.outcome ?? policyResult.outcome;
    let policyId = input.policy_id ?? policyResult.policy_id;

    // Step 2: If policy says blocked, log it and stop
    if (policyResult.outcome === 'blocked' && !input.outcome) {
      outcome = 'blocked';
      policyId = policyResult.policy_id;
    }

    // Step 3: Oversight gate — check if human approval is needed
    if (
      outcome !== 'blocked' &&
      this.oversightGate &&
      this.oversightGate.requiresApproval(input.action_type)
    ) {
      const oversightResult = await this.oversightGate.requestApproval(
        {
          agent_id: this.agentId,
          action_type: input.action_type,
          resource: input.resource,
          metadata: input.metadata ?? {},
          timestamp: new Date().toISOString(),
          requires_approval: true,
        },
        input.waitForApproval,
      );

      outcome = oversightResult.outcome;
    }

    // Step 4: Sign and emit — include trust_score in metadata
    const metadata = {
      ...(input.metadata ?? {}),
      trust_score: this.trustProfile?.trust_score ?? 0,
    };

    const eventInput: AgentEventInput = {
      agent_id: this.agentId,
      owner_id: this.ownerId,
      action_type: input.action_type,
      resource: input.resource,
      outcome,
      policy_id: policyId ?? null,
      metadata,
    };

    const signed = await createSignedEvent(eventInput, this.privateKey);
    const emitted = await this.transport.emitEvent(signed);

    // Fire-and-forget: recompute trust score in background
    this.recomputeTrustScore().catch(() => {});

    return emitted;
  }

  /**
   * Fetches all events for this agent from Supabase, recomputes
   * the trust score, and updates the agents table.
   */
  async recomputeTrustScore(): Promise<AgentTrustProfile> {
    const events = await this.transport.fetchAgentEvents(this.agentId);
    const profile = computeTrustScore(events);
    this.trustProfile = profile;

    await this.transport.updateAgentTrust(this.agentId, profile);

    return profile;
  }

  /**
   * Returns the last computed trust profile, or null if not yet computed.
   */
  getTrustProfile(): AgentTrustProfile | null {
    return this.trustProfile;
  }
}
