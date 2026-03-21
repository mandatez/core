import type { AgentEventInput } from '../events/schema.js';
import type { AlertChannel, OversightAlert } from './alerts.js';

export type { AlertChannel, OversightAlert } from './alerts.js';
export { SlackAlertChannel, WebhookAlertChannel } from './alerts.js';

export type TimeoutAction = 'block' | 'allow';

export interface OversightConfig {
  /** Action types that require human approval before proceeding */
  require_human_approval: AgentEventInput['action_type'][];
  /** Alert channels to notify when approval is needed */
  channels: AlertChannel[];
  /** Seconds to wait for human response before timeout_action kicks in */
  timeout_seconds: number;
  /** What to do if no human responds in time */
  timeout_action: TimeoutAction;
}

export type ApprovalDecision = 'approved' | 'rejected' | 'timeout';

export interface OversightResult {
  decision: ApprovalDecision;
  outcome: 'allowed' | 'blocked';
  timed_out: boolean;
}

/**
 * Human oversight gate.
 *
 * When an agent attempts a flagged action type, execution pauses,
 * alerts fire, and we wait for a human decision or timeout.
 *
 * The approval callback is injected by the caller — this keeps the gate
 * transport-agnostic (could be a webhook, a Supabase realtime subscription,
 * a CLI prompt, etc).
 */
export class OversightGate {
  private config: OversightConfig;

  constructor(config: OversightConfig) {
    this.config = config;
  }

  /**
   * Does this action type require human approval?
   */
  requiresApproval(actionType: AgentEventInput['action_type']): boolean {
    return this.config.require_human_approval.includes(actionType);
  }

  /**
   * Fire alerts on all configured channels.
   * Errors on individual channels are collected, not thrown,
   * so one failing channel doesn't block the others.
   */
  async sendAlerts(alert: OversightAlert): Promise<{ errors: Error[] }> {
    const errors: Error[] = [];

    await Promise.all(
      this.config.channels.map(async (channel) => {
        try {
          await channel.send(alert);
        } catch (err) {
          errors.push(err instanceof Error ? err : new Error(String(err)));
        }
      }),
    );

    return { errors };
  }

  /**
   * Request human approval. Fires alerts, then races the approval
   * callback against the timeout.
   *
   * @param alert - The alert payload describing the action
   * @param waitForApproval - Async function that resolves when a human
   *   responds. Should return true for approved, false for rejected.
   *   If not provided, the gate immediately applies timeout_action.
   */
  async requestApproval(
    alert: OversightAlert,
    waitForApproval?: () => Promise<boolean>,
  ): Promise<OversightResult> {
    // Fire alerts (non-blocking on individual channel failures)
    await this.sendAlerts(alert);

    // If no approval callback, immediately apply timeout action
    if (!waitForApproval) {
      return {
        decision: 'timeout',
        outcome: this.config.timeout_action === 'block' ? 'blocked' : 'allowed',
        timed_out: true,
      };
    }

    // Race: human response vs timeout
    const timeoutMs = this.config.timeout_seconds * 1000;

    const result = await Promise.race([
      waitForApproval().then((approved): OversightResult => ({
        decision: approved ? 'approved' : 'rejected',
        outcome: approved ? 'allowed' : 'blocked',
        timed_out: false,
      })),
      new Promise<OversightResult>((resolve) =>
        setTimeout(() => resolve({
          decision: 'timeout',
          outcome: this.config.timeout_action === 'block' ? 'blocked' : 'allowed',
          timed_out: true,
        }), timeoutMs),
      ),
    ]);

    return result;
  }
}
