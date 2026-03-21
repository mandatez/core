import { z } from 'zod';
import type { AgentEventInput } from '../events/schema.js';

export const PolicyRuleSchema = z.object({
  id: z.string().min(1),
  /** Which action types this rule applies to. '*' means all. */
  action_types: z.array(z.enum(['read', 'write', 'export', 'delete', 'call', 'payment', '*'])),
  /** Glob-like resource pattern. '*' matches everything. */
  resource_pattern: z.string().min(1),
  /** The effect when this rule matches */
  effect: z.enum(['allow', 'block', 'flag']),
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const PolicySchema = z.object({
  id: z.string().min(1),
  owner_id: z.string().min(1),
  name: z.string().min(1),
  rules: z.array(PolicyRuleSchema),
});

export type Policy = z.infer<typeof PolicySchema>;

export type PolicyOutcome = 'allowed' | 'blocked' | 'flagged';

export interface PolicyEvaluation {
  outcome: PolicyOutcome;
  matched_rule: PolicyRule | null;
  policy_id: string | null;
}

/**
 * Matches a resource string against a pattern.
 * Supports '*' as a wildcard segment and '**' as a recursive wildcard.
 *
 *   'emails'          matches 'emails'
 *   'api/*'           matches 'api/stripe', 'api/slack'
 *   'api/**'          matches 'api/stripe', 'api/stripe/charges'
 *   '*'               matches everything
 */
function matchResource(pattern: string, resource: string): boolean {
  if (pattern === '*') return true;

  const patternParts = pattern.split('/');
  const resourceParts = resource.split('/');

  let pi = 0;
  let ri = 0;

  while (pi < patternParts.length && ri < resourceParts.length) {
    if (patternParts[pi] === '**') return true;
    if (patternParts[pi] === '*' || patternParts[pi] === resourceParts[ri]) {
      pi++;
      ri++;
    } else {
      return false;
    }
  }

  return pi === patternParts.length && ri === resourceParts.length;
}

/**
 * Policy engine — evaluates rules against an action.
 *
 * Rules are evaluated in order. First match wins.
 * If no rule matches, the default outcome is 'allowed'.
 */
export class PolicyEngine {
  private policies: Policy[] = [];

  addPolicy(policy: Policy): void {
    PolicySchema.parse(policy);
    this.policies.push(policy);
  }

  removePolicy(policyId: string): void {
    this.policies = this.policies.filter((p) => p.id !== policyId);
  }

  /**
   * Evaluate all policies against an action.
   * First matching rule across all policies wins.
   */
  evaluate(
    actionType: AgentEventInput['action_type'],
    resource: string,
  ): PolicyEvaluation {
    for (const policy of this.policies) {
      for (const rule of policy.rules) {
        const actionMatch =
          rule.action_types.includes('*') || rule.action_types.includes(actionType);
        const resourceMatch = matchResource(rule.resource_pattern, resource);

        if (actionMatch && resourceMatch) {
          return {
            outcome: rule.effect === 'allow' ? 'allowed' : rule.effect === 'block' ? 'blocked' : 'flagged',
            matched_rule: rule,
            policy_id: policy.id,
          };
        }
      }
    }

    return { outcome: 'allowed', matched_rule: null, policy_id: null };
  }
}
