import { MandateZClient } from '../../client.js';
import type { AgentEvent } from '../../events/schema.js';

export interface N8nExecutionContext {
  workflowId: string;
  nodeName: string;
}

function formatResource(ctx: N8nExecutionContext): string {
  return `n8n/workflow:${ctx.workflowId}/node:${ctx.nodeName}`;
}

/**
 * MandateZ hook for n8n workflows.
 *
 * Drop this into any n8n custom node or credential hook to get
 * cryptographically signed audit logs for every workflow execution.
 */
export class MandateZN8nHook {
  private client: MandateZClient;

  constructor(client: MandateZClient) {
    this.client = client;
  }

  /**
   * Call before a node executes. Logs a 'call' action with 'pending_approval'.
   */
  async beforeExecution(
    workflowId: string,
    nodeName: string,
    inputData: Record<string, unknown>,
  ): Promise<AgentEvent> {
    return this.client.track({
      action_type: 'call',
      resource: formatResource({ workflowId, nodeName }),
      outcome: 'pending_approval',
      metadata: { direction: 'before', inputData },
    });
  }

  /**
   * Call after a node executes. Logs a 'call' action with
   * 'allowed' on success or 'flagged' on failure.
   */
  async afterExecution(
    workflowId: string,
    nodeName: string,
    outputData: Record<string, unknown>,
    success: boolean,
  ): Promise<AgentEvent> {
    return this.client.track({
      action_type: 'call',
      resource: formatResource({ workflowId, nodeName }),
      outcome: success ? 'allowed' : 'flagged',
      metadata: { direction: 'after', outputData, success },
    });
  }
}
