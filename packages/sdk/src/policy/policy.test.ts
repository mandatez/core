import { describe, it, expect } from 'vitest';
import { PolicyEngine } from './index.js';
import type { Policy } from './index.js';

const testPolicy: Policy = {
  id: 'pol_test',
  owner_id: 'org_acme',
  name: 'Test Policy',
  rules: [
    { id: 'r1', action_types: ['export', 'delete'], resource_pattern: '*', effect: 'block' },
    { id: 'r2', action_types: ['payment'], resource_pattern: 'api/stripe', effect: 'flag' },
    { id: 'r3', action_types: ['read'], resource_pattern: 'emails', effect: 'allow' },
  ],
};

describe('PolicyEngine', () => {
  it('returns allowed by default when no rules match', () => {
    const engine = new PolicyEngine();
    engine.addPolicy(testPolicy);
    const result = engine.evaluate('call', 'api/openai');

    expect(result.outcome).toBe('allowed');
    expect(result.matched_rule).toBeNull();
    expect(result.policy_id).toBeNull();
  });

  it('blocks export actions matching a block rule', () => {
    const engine = new PolicyEngine();
    engine.addPolicy(testPolicy);
    const result = engine.evaluate('export', 'reports');

    expect(result.outcome).toBe('blocked');
    expect(result.matched_rule?.id).toBe('r1');
    expect(result.policy_id).toBe('pol_test');
  });

  it('blocks delete actions matching a block rule', () => {
    const engine = new PolicyEngine();
    engine.addPolicy(testPolicy);
    const result = engine.evaluate('delete', 'database');

    expect(result.outcome).toBe('blocked');
    expect(result.matched_rule?.id).toBe('r1');
  });

  it('flags payment to api/stripe', () => {
    const engine = new PolicyEngine();
    engine.addPolicy(testPolicy);
    const result = engine.evaluate('payment', 'api/stripe');

    expect(result.outcome).toBe('flagged');
    expect(result.matched_rule?.id).toBe('r2');
  });

  it('allows read on emails', () => {
    const engine = new PolicyEngine();
    engine.addPolicy(testPolicy);
    const result = engine.evaluate('read', 'emails');

    expect(result.outcome).toBe('allowed');
    expect(result.matched_rule?.id).toBe('r3');
    expect(result.policy_id).toBe('pol_test');
  });

  it('first match wins — order matters', () => {
    const engine = new PolicyEngine();
    engine.addPolicy({
      id: 'pol_order',
      owner_id: 'org_acme',
      name: 'Order Test',
      rules: [
        { id: 'block_all', action_types: ['*'], resource_pattern: '*', effect: 'block' },
        { id: 'allow_read', action_types: ['read'], resource_pattern: '*', effect: 'allow' },
      ],
    });
    const result = engine.evaluate('read', 'emails');

    expect(result.outcome).toBe('blocked');
    expect(result.matched_rule?.id).toBe('block_all');
  });

  it('matches wildcard resource pattern api/*', () => {
    const engine = new PolicyEngine();
    engine.addPolicy({
      id: 'pol_wild',
      owner_id: 'org_acme',
      name: 'Wildcard',
      rules: [
        { id: 'flag_api', action_types: ['call'], resource_pattern: 'api/*', effect: 'flag' },
      ],
    });

    expect(engine.evaluate('call', 'api/stripe').outcome).toBe('flagged');
    expect(engine.evaluate('call', 'api/slack').outcome).toBe('flagged');
    expect(engine.evaluate('call', 'emails').outcome).toBe('allowed');
  });

  it('matches recursive wildcard api/**', () => {
    const engine = new PolicyEngine();
    engine.addPolicy({
      id: 'pol_recursive',
      owner_id: 'org_acme',
      name: 'Recursive',
      rules: [
        { id: 'flag_api', action_types: ['call'], resource_pattern: 'api/**', effect: 'flag' },
      ],
    });

    expect(engine.evaluate('call', 'api/stripe').outcome).toBe('flagged');
    expect(engine.evaluate('call', 'api/stripe/charges').outcome).toBe('flagged');
    expect(engine.evaluate('call', 'emails').outcome).toBe('allowed');
  });

  it('does not match single wildcard across path segments', () => {
    const engine = new PolicyEngine();
    engine.addPolicy({
      id: 'pol_single',
      owner_id: 'org_acme',
      name: 'Single',
      rules: [
        { id: 'flag_api', action_types: ['call'], resource_pattern: 'api/*', effect: 'flag' },
      ],
    });

    expect(engine.evaluate('call', 'api/stripe/charges').outcome).toBe('allowed');
  });

  it('removePolicy stops that policy from matching', () => {
    const engine = new PolicyEngine();
    engine.addPolicy(testPolicy);

    expect(engine.evaluate('export', 'reports').outcome).toBe('blocked');

    engine.removePolicy('pol_test');

    expect(engine.evaluate('export', 'reports').outcome).toBe('allowed');
  });

  it('rejects invalid policy with Zod', () => {
    const engine = new PolicyEngine();
    expect(() =>
      engine.addPolicy({ id: '', owner_id: '', name: '', rules: [] } as any),
    ).toThrow();
  });

  it('returns allowed with no policies loaded', () => {
    const engine = new PolicyEngine();
    const result = engine.evaluate('read', 'emails');

    expect(result.outcome).toBe('allowed');
    expect(result.matched_rule).toBeNull();
    expect(result.policy_id).toBeNull();
  });
});
