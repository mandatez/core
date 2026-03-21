import { MandateZClient } from '../../client.js';
import type { AgentEvent } from '../../events/schema.js';

/**
 * MandateZ callback handler for LangChain.
 *
 * Implements the LangChain BaseCallbackHandler interface structurally —
 * no @langchain/core dependency required. Pass this to any LangChain
 * chain, agent, or LLM via the `callbacks` option.
 *
 * Tracked events:
 *   - handleLLMStart      → action_type: 'call',   resource: 'langchain/llm:{model}'
 *   - handleToolStart     → action_type: 'call',   resource: 'langchain/tool:{name}'
 *   - handleToolEnd       → action_type: 'call',   resource: 'langchain/tool:{name}'
 *   - handleChainError    → action_type: 'call',   resource: 'langchain/chain'
 */
export class MandateZLangChainCallback {
  name = 'MandateZLangChainCallback';

  private client: MandateZClient;
  private events: AgentEvent[] = [];

  constructor(client: MandateZClient) {
    this.client = client;
  }

  /** Returns all events tracked during this callback's lifetime. */
  getEvents(): AgentEvent[] {
    return [...this.events];
  }

  /**
   * Called when an LLM starts processing.
   */
  async handleLLMStart(
    llm: { name?: string; id?: string[] },
    prompts: string[],
  ): Promise<void> {
    const model = llm.name ?? llm.id?.join('/') ?? 'unknown';
    const event = await this.client.track({
      action_type: 'call',
      resource: `langchain/llm:${model}`,
      outcome: 'allowed',
      metadata: {
        hook: 'llm_start',
        model,
        prompt_count: prompts.length,
      },
    });
    this.events.push(event);
  }

  /**
   * Called when a tool starts executing.
   */
  async handleToolStart(
    tool: { name?: string; id?: string },
    input: string,
  ): Promise<void> {
    const toolName = tool.name ?? tool.id ?? 'unknown';
    const event = await this.client.track({
      action_type: 'call',
      resource: `langchain/tool:${toolName}`,
      outcome: 'pending_approval',
      metadata: {
        hook: 'tool_start',
        tool: toolName,
        input_length: input.length,
      },
    });
    this.events.push(event);
  }

  /**
   * Called when a tool finishes executing.
   */
  async handleToolEnd(output: string): Promise<void> {
    const event = await this.client.track({
      action_type: 'call',
      resource: 'langchain/tool',
      outcome: 'allowed',
      metadata: {
        hook: 'tool_end',
        output_length: output.length,
      },
    });
    this.events.push(event);
  }

  /**
   * Called when a chain encounters an error.
   */
  async handleChainError(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const event = await this.client.track({
      action_type: 'call',
      resource: 'langchain/chain',
      outcome: 'flagged',
      metadata: {
        hook: 'chain_error',
        error: message,
      },
    });
    this.events.push(event);
  }
}
