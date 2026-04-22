import { MandateZAgent } from '../../wrapper/index.js';
import type { MandateZAgentConfig } from '../../wrapper/index.js';

/**
 * Minimal structural type for a LangChain runnable.
 * We don't depend on @langchain/core — anything with invoke/stream works.
 */
interface LangChainRunnable {
  invoke?: (...args: unknown[]) => unknown;
  stream?: (...args: unknown[]) => unknown;
  batch?: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

/**
 * Wrap a LangChain runnable (chain, agent, LLM, tool) with MandateZ governance.
 *
 * Transparently wraps .invoke(), .stream(), and .batch() if present, leaving
 * all other methods untouched. Each invocation emits a signed AgentEvent.
 *
 * @example
 *   const chain = new ChatOpenAI();
 *   const governed = withMandateZ(chain, {
 *     agentId: 'ag_...',
 *     ownerId: 'owner_1',
 *     privateKey: process.env.AGENT_PRIVATE_KEY!,
 *     supabaseUrl: process.env.SUPABASE_URL!,
 *     supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
 *   });
 *   await governed.invoke({ input: 'hello' });
 */
export function withMandateZ<T extends LangChainRunnable>(
  chain: T,
  config: MandateZAgentConfig,
): T {
  const baseName = config.name ?? (chain.constructor?.name ?? 'langchain/runnable');
  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === 'invoke' || prop === 'stream' || prop === 'batch') {
        if (typeof value !== 'function') return value;

        const method = value.bind(target) as (...args: unknown[]) => unknown;
        const wrapped = MandateZAgent(
          async (...args: unknown[]) => method(...args),
          { ...config, name: `${baseName}/${String(prop)}` },
        );
        return wrapped;
      }

      return value;
    },
  };

  return new Proxy(chain, handler);
}
