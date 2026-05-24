import { createSignedEvent } from './events/signing.js';
import { SupabaseTransport } from './transport/supabase.js';
import { PolicyEngine } from './policy/index.js';
import { OversightGate } from './oversight/index.js';
import { computeTrustScore } from './trust/posture.js';
import { checkIdentity as hibpCheckIdentity } from './identity/hibp.js';
import {
  getRiskScore as fetchRiskScore,
  computeRiskScore as triggerRiskScoreCompute,
} from './risk/index.js';
import type { AgentTrustProfile } from './trust/posture.js';
import type { AgentEvent, AgentEventInput } from './events/schema.js';
import type { Policy } from './policy/index.js';
import type { OversightConfig } from './oversight/index.js';
import type { IdentityCheckResult } from './identity/hibp.js';
import type { EventExporter } from './exporters/index.js';
import type { RiskScoreRecord } from './risk/index.js';

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

/** Minimal input for a batched event. Each is signed locally before upload. */
export interface TrackBatchInput {
  action_type: AgentEventInput['action_type'];
  resource: string;
  outcome?: AgentEventInput['outcome'];
  policy_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TrackBatchResult {
  accepted: number;
  rejected: number;
  errors?: Array<{ index: number; event_id?: string; reason: string; detail?: string }>;
}

/**
 * Internal buffering config. When enabled, track() returns immediately
 * after signing and queues the event — a background flush posts batches
 * to /api/events/batch when the buffer hits maxSize or maxWaitMs elapses.
 */
export interface BatchConfig {
  enabled: boolean;
  /** Flush when the buffer reaches this many events. */
  maxSize: number;
  /** Flush after this many milliseconds since the first queued event. */
  maxWaitMs: number;
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
  /** HaveIBeenPwned API key — required for checkIdentity() */
  hibpApiKey?: string;
  /** MandateZ directory base URL used by verifyAgent(). Defaults to https://core-directory.vercel.app */
  directoryUrl?: string;
  /**
   * Optional list of downstream exporters. After each track() call the
   * signed event is fanned out to every configured exporter in parallel
   * (fire-and-forget — exporter failures never block or throw from track()).
   */
  exporters?: EventExporter[];
  /**
   * Dashboard API base URL. Required for trackBatch() and for track()
   * buffering mode. Example: 'https://dashboard.mandatez.com'.
   */
  apiUrl?: string;
  /** Optional API key ("mz_live_...") sent to dashboard endpoints. */
  apiKey?: string;
  /** Enable internal batching on track() calls. Off by default. */
  batchConfig?: BatchConfig;
}

export interface CheckIdentityInput {
  email: string;
  /** Override the client's default agentId for this check */
  agentId?: string;
  /** What to do when an identity comes back flagged. Defaults to 'restrict'. */
  onFlagged?: 'restrict' | 'block' | 'allow';
}

export interface CheckIdentityOutput extends IdentityCheckResult {
  /** Effective action to take based on status + onFlagged policy */
  recommendation: 'allow' | 'restrict' | 'block';
}

export type AgentTrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

export interface VerifyAgentInput {
  requestingAgentId: string;
  targetAgentId: string;
  /** Minimum trust score the target must meet. Default 60. */
  requiredMinScore?: number;
  /** Minimum trust grade the target must meet. Default "medium". */
  requiredMinGrade?: AgentTrustGrade;
}

export interface VerifyAgentOutput {
  verified: boolean;
  targetTrustScore: number;
  targetTrustGrade: AgentTrustGrade;
  targetPublicKey: string;
  verificationId: string;
  /** Raw response from the directory for callers that need the full payload */
  raw: VerifyAgentRawResponse;
}

export interface VerifyAgentRawResponse {
  verified: boolean;
  requesting_agent: {
    id: string;
    name: string;
    trust_score: number;
    trust_grade: AgentTrustGrade;
  };
  target_agent: {
    id: string;
    name: string;
    trust_score: number;
    trust_grade: AgentTrustGrade;
    public_key: string;
  };
  verification: {
    score_met: boolean;
    grade_met: boolean;
    required_min_score: number;
    required_min_grade: AgentTrustGrade;
    timestamp: string;
    verification_id: string;
  };
}

const DEFAULT_DIRECTORY_URL = 'https://core-directory.vercel.app';

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
  private hibpApiKey: string | null;
  private directoryUrl: string;
  private exporters: EventExporter[];
  private apiUrl: string | null;
  private apiKey: string | null;
  private batchConfig: BatchConfig | null;
  private buffer: AgentEvent[] = [];
  private bufferFlushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: MandateZClientConfig) {
    this.agentId = config.agentId;
    this.ownerId = config.ownerId;
    this.privateKey = config.privateKey;
    this.hibpApiKey = config.hibpApiKey ?? null;
    this.directoryUrl = (config.directoryUrl ?? DEFAULT_DIRECTORY_URL).replace(/\/+$/, '');
    this.exporters = config.exporters ?? [];
    this.apiUrl = config.apiUrl ? config.apiUrl.replace(/\/+$/, '') : null;
    this.apiKey = config.apiKey ?? null;
    this.batchConfig = config.batchConfig ?? null;
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

    // Buffering mode: queue the signed event and let the batch flush handle
    // delivery. The returned event is authoritative (already signed) even
    // though it has not yet reached the server.
    if (this.batchConfig?.enabled) {
      this.enqueue(signed);
      this.fanOutToExporters(signed);
      return signed;
    }

    const emitted = await this.transport.emitEvent(signed);

    // Fire-and-forget: recompute trust score in background
    this.recomputeTrustScore().catch(() => {});

    // Fire-and-forget: fan out to every configured exporter in parallel.
    // Exporter failures are logged but never block the main flow.
    this.fanOutToExporters(emitted);

    return emitted;
  }

  /**
   * Signs each input event locally and posts the batch to /api/events/batch.
   *
   * Requires `apiUrl` in config. The endpoint rejects the entire batch if
   * any signature or schema check fails, so a returned `rejected` count is
   * either 0 (all accepted) or equal to the input length (nothing inserted).
   */
  async trackBatch(events: TrackBatchInput[]): Promise<TrackBatchResult> {
    if (!this.apiUrl) {
      throw new Error(
        'MandateZClient: apiUrl is required in config to call trackBatch()',
      );
    }
    if (events.length === 0) {
      return { accepted: 0, rejected: 0, errors: [] };
    }

    const signed = await Promise.all(
      events.map((input) =>
        createSignedEvent(
          {
            agent_id: this.agentId,
            owner_id: this.ownerId,
            action_type: input.action_type,
            resource: input.resource,
            outcome: input.outcome ?? 'allowed',
            policy_id: input.policy_id ?? null,
            metadata: input.metadata ?? {},
          },
          this.privateKey,
        ),
      ),
    );

    return this.postBatch(signed);
  }

  /**
   * Flushes any buffered events immediately. Callers should invoke this
   * during graceful shutdown to avoid dropping queued events.
   */
  async flush(): Promise<TrackBatchResult> {
    if (this.bufferFlushTimer) {
      clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }
    const pending = this.buffer;
    this.buffer = [];
    if (pending.length === 0) {
      return { accepted: 0, rejected: 0, errors: [] };
    }
    return this.postBatch(pending);
  }

  private enqueue(event: AgentEvent): void {
    if (!this.batchConfig) return;
    this.buffer.push(event);

    if (this.buffer.length >= this.batchConfig.maxSize) {
      void this.flush().catch(() => {});
      return;
    }

    if (!this.bufferFlushTimer) {
      this.bufferFlushTimer = setTimeout(() => {
        this.bufferFlushTimer = null;
        void this.flush().catch(() => {});
      }, this.batchConfig.maxWaitMs);
    }
  }

  private async postBatch(events: AgentEvent[]): Promise<TrackBatchResult> {
    if (!this.apiUrl) {
      throw new Error(
        'MandateZClient: apiUrl is required to flush batched events',
      );
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.apiUrl}/api/events/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ owner_id: this.ownerId, events }),
    });

    const payload = (await res.json().catch(() => ({}))) as TrackBatchResult & {
      error?: string;
    };

    if (!res.ok) {
      return {
        accepted: payload.accepted ?? 0,
        rejected: payload.rejected ?? events.length,
        errors: payload.errors ?? [
          { index: -1, reason: 'http_error', detail: payload.error ?? `HTTP ${res.status}` },
        ],
      };
    }

    return {
      accepted: payload.accepted ?? 0,
      rejected: payload.rejected ?? 0,
      errors: payload.errors ?? [],
    };
  }

  private fanOutToExporters(event: AgentEvent): void {
    if (this.exporters.length === 0) return;
    for (const exporter of this.exporters) {
      // Each exporter runs independently; one failing cannot affect another.
      exporter.export(event).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.warn(`[mandatez] exporter "${exporter.name}" failed: ${message}`);
      });
    }
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

  /**
   * Checks an email against HaveIBeenPwned, stores the result in
   * Supabase (identity_checks table), and returns a recommendation.
   *
   * Recommendation logic:
   * - status=clean    → allow
   * - status=flagged  → onFlagged (default: 'restrict')
   * - status=blocked  → block (cannot be overridden)
   */
  async checkIdentity(input: CheckIdentityInput): Promise<CheckIdentityOutput> {
    if (!this.hibpApiKey) {
      throw new Error(
        'MandateZClient: hibpApiKey is required in config to call checkIdentity()',
      );
    }

    const result = await hibpCheckIdentity(input.email, this.hibpApiKey);
    const agentId = input.agentId ?? this.agentId;

    // Fire-and-forget persistence — don't let Supabase failures block the caller
    this.transport
      .insertIdentityCheck({
        ownerId: this.ownerId,
        agentId,
        email: input.email,
        result,
      })
      .catch(() => {});

    const onFlagged = input.onFlagged ?? 'restrict';
    let recommendation: 'allow' | 'restrict' | 'block';
    if (result.status === 'blocked') recommendation = 'block';
    else if (result.status === 'flagged') recommendation = onFlagged;
    else recommendation = 'allow';

    return { ...result, recommendation };
  }

  /**
   * Verify another agent's MandateZ credentials before transacting with it.
   *
   * Calls the MandateZ directory's /api/agents/verify endpoint and returns
   * whether the target agent meets the minimum trust score and grade you
   * specified. Use this at the edge of any cross-agent interaction.
   *
   * @example
   * const result = await client.verifyAgent({
   *   requestingAgentId: 'ag_my_agent',
   *   targetAgentId: 'ag_partner_agent',
   *   requiredMinScore: 70,
   * });
   * if (!result.verified) {
   *   throw new Error('Partner agent failed MandateZ verification');
   * }
   */
  async verifyAgent(input: VerifyAgentInput): Promise<VerifyAgentOutput> {
    const res = await fetch(`${this.directoryUrl}/api/agents/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesting_agent_id: input.requestingAgentId,
        target_agent_id: input.targetAgentId,
        required_min_score: input.requiredMinScore,
        required_min_grade: input.requiredMinGrade,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        err.error
          ? `MandateZ verifyAgent failed: ${err.error}`
          : `MandateZ verifyAgent failed: HTTP ${res.status}`,
      );
    }

    const raw = (await res.json()) as VerifyAgentRawResponse;

    return {
      verified: raw.verified,
      targetTrustScore: raw.target_agent.trust_score,
      targetTrustGrade: raw.target_agent.trust_grade,
      targetPublicKey: raw.target_agent.public_key,
      verificationId: raw.verification.verification_id,
      raw,
    };
  }

  /**
   * Fetch the most recent risk score for an agent from the MandateZ
   * dashboard. The server auto-computes a fresh score if none exists yet,
   * so this never returns null.
   *
   * Requires `apiUrl` and `apiKey` in the client config.
   */
  async getRiskScore(agentId: string): Promise<RiskScoreRecord> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error(
        'MandateZClient: apiUrl and apiKey are required in config to call getRiskScore()',
      );
    }
    return fetchRiskScore(agentId, { apiUrl: this.apiUrl, apiKey: this.apiKey });
  }

  /**
   * Trigger a fresh risk-score recomputation for an agent. The returned
   * record is the newly persisted snapshot.
   *
   * Requires `apiUrl` and `apiKey` in the client config.
   */
  async computeRiskScore(agentId: string, windowDays?: number): Promise<RiskScoreRecord> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error(
        'MandateZClient: apiUrl and apiKey are required in config to call computeRiskScore()',
      );
    }
    return triggerRiskScoreCompute(
      agentId,
      { apiUrl: this.apiUrl, apiKey: this.apiKey },
      windowDays,
    );
  }
}
