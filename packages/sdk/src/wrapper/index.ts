import sodium from 'libsodium-wrappers';
import { MandateZClient } from '../client.js';
import { PolicyEngine } from '../policy/index.js';
import { SupabaseTransport } from '../transport/index.js';
import type { PolicyRule } from '../policy/index.js';

export interface MandateZAgentConfig {
  agentId: string;
  ownerId: string;
  privateKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Human-friendly name stored on the agents row. Defaults to the wrapped function's name. */
  name?: string;
  /** Inline policy rules. Evaluated on every call against action_type 'call' and the function name as resource. */
  policies?: PolicyRule[];
  /** How to treat a 'flag' policy outcome. 'restrict' (default) executes but marks the event flagged. 'block' prevents execution. 'allow' clears the flag. */
  onFlagged?: 'restrict' | 'block' | 'allow';
  /** HaveIBeenPwned API key. If provided and an email is detected in args, the wrapper runs an identity check before execution. */
  hibpApiKey?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function findEmailInArgs(args: unknown[]): string | null {
  for (const arg of args) {
    if (typeof arg === 'string' && EMAIL_REGEX.test(arg)) return arg;
    if (arg && typeof arg === 'object') {
      for (const value of Object.values(arg as Record<string, unknown>)) {
        if (typeof value === 'string' && EMAIL_REGEX.test(value)) return value;
      }
    }
  }
  return null;
}

async function derivePublicKey(privateKey: string): Promise<string> {
  await sodium.ready;
  const secretKey = sodium.from_base64(privateKey, sodium.base64_variants.ORIGINAL);
  const publicKey = secretKey.slice(32);
  return sodium.to_base64(publicKey, sodium.base64_variants.ORIGINAL);
}

/**
 * Wrap any agent function with MandateZ governance.
 *
 * One import, one wrap — the returned function has the same signature as the
 * original, but every invocation is policy-checked, optionally identity-screened
 * (when an email is detected in args and hibpApiKey is configured), and logged
 * as a signed AgentEvent to your MandateZ event stream.
 */
export function MandateZAgent<T extends (...args: any[]) => any>(
  agentFn: T,
  config: MandateZAgentConfig,
): T {
  const resourceName = config.name ?? agentFn.name ?? 'anonymous';
  const onFlagged = config.onFlagged ?? 'restrict';

  const policyEngine = new PolicyEngine();
  if (config.policies && config.policies.length > 0) {
    policyEngine.addPolicy({
      id: `pol_${config.agentId}_inline`,
      owner_id: config.ownerId,
      name: `${resourceName}_inline`,
      rules: config.policies,
    });
  }

  const client = new MandateZClient({
    agentId: config.agentId,
    ownerId: config.ownerId,
    privateKey: config.privateKey,
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    hibpApiKey: config.hibpApiKey,
  });

  const transport = new SupabaseTransport({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
  });

  let registrationPromise: Promise<void> | null = null;
  const ensureRegistered = (): Promise<void> => {
    if (!registrationPromise) {
      registrationPromise = (async () => {
        const publicKey = await derivePublicKey(config.privateKey);
        await transport
          .upsertAgent({
            agentId: config.agentId,
            ownerId: config.ownerId,
            name: resourceName,
            publicKey,
          })
          .catch(() => {});
      })();
    }
    return registrationPromise;
  };

  const wrapped = async function (this: unknown, ...args: unknown[]) {
    await ensureRegistered();

    if (config.hibpApiKey) {
      const email = findEmailInArgs(args);
      if (email) {
        try {
          const check = await client.checkIdentity({
            email,
            onFlagged: onFlagged === 'allow' ? 'allow' : onFlagged,
          });
          if (check.recommendation === 'block') {
            await client
              .track({
                action_type: 'call',
                resource: resourceName,
                outcome: 'blocked',
                metadata: {
                  wrapper: 'MandateZAgent',
                  reason: 'identity_blocked',
                  email,
                  breach_count: check.breach_count,
                },
              })
              .catch(() => {});
            throw new Error(
              `MandateZAgent: identity check blocked execution (${check.breach_count} breaches detected)`,
            );
          }
        } catch (err) {
          if (err instanceof Error && err.message.startsWith('MandateZAgent:')) {
            throw err;
          }
        }
      }
    }

    const policyEval = policyEngine.evaluate('call', resourceName);
    const policyBlocks =
      policyEval.outcome === 'blocked' ||
      (policyEval.outcome === 'flagged' && onFlagged === 'block');

    if (policyBlocks) {
      await client
        .track({
          action_type: 'call',
          resource: resourceName,
          outcome: 'blocked',
          policy_id: policyEval.policy_id,
          metadata: { wrapper: 'MandateZAgent', reason: 'policy_blocked' },
        })
        .catch(() => {});
      throw new Error(`MandateZAgent: policy blocked call to ${resourceName}`);
    }

    const startedAt = Date.now();
    try {
      const result = await agentFn.apply(this, args as Parameters<T>);

      const finalOutcome: 'allowed' | 'flagged' =
        policyEval.outcome === 'flagged' && onFlagged === 'restrict' ? 'flagged' : 'allowed';

      await client
        .track({
          action_type: 'call',
          resource: resourceName,
          outcome: finalOutcome,
          policy_id: policyEval.policy_id,
          metadata: {
            wrapper: 'MandateZAgent',
            duration_ms: Date.now() - startedAt,
            args_count: args.length,
          },
        })
        .catch(() => {});

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await client
        .track({
          action_type: 'call',
          resource: resourceName,
          outcome: 'flagged',
          policy_id: policyEval.policy_id,
          metadata: {
            wrapper: 'MandateZAgent',
            duration_ms: Date.now() - startedAt,
            error: message,
          },
        })
        .catch(() => {});
      throw err;
    }
  };

  return wrapped as unknown as T;
}
