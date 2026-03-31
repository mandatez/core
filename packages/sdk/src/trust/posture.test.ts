import { describe, it, expect } from 'vitest';
import { computeTrustScore } from './posture.js';
import type { AgentEvent } from '../events/schema.js';

function makeEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    event_id: crypto.randomUUID(),
    agent_id: 'ag_test123',
    owner_id: 'org_acme',
    timestamp: new Date().toISOString(),
    action_type: 'read',
    resource: 'emails',
    outcome: 'allowed',
    policy_id: null,
    metadata: {},
    signature: 'sig_placeholder',
    public_key: 'pk_placeholder',
    ...overrides,
  };
}

describe('computeTrustScore', () => {
  it('new agent (0 events) scores 0, grade unverified', () => {
    const profile = computeTrustScore([]);

    expect(profile.trust_score).toBe(0);
    expect(profile.trust_grade).toBe('unverified');
    expect(profile.total_events).toBe(0);
    expect(profile.first_seen).toBeNull();
    expect(profile.last_active).toBeNull();
  });

  it('agent with 90+ days and 100% allowed scores 60+', () => {
    const now = Date.now();
    const ninetyOneDaysAgo = new Date(now - 91 * 24 * 60 * 60 * 1000);
    const events: AgentEvent[] = [];

    // Create events spanning 91 days, all allowed
    for (let i = 0; i < 100; i++) {
      const dayOffset = (i / 99) * 91;
      const ts = new Date(ninetyOneDaysAgo.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      events.push(makeEvent({ timestamp: ts.toISOString() }));
    }

    const profile = computeTrustScore(events);

    // behavioral: 40 + longevity: 20 + oversight: 0 + compliance: 15 = 75
    expect(profile.trust_score).toBeGreaterThanOrEqual(60);
    expect(profile.trust_grade).toBe('high');
    expect(profile.allowed_ratio).toBe(1);
    expect(profile.blocked_ratio).toBe(0);
  });

  it('agent with human rejections scores lower', () => {
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Baseline: all allowed, no rejections
    const baselineEvents = Array.from({ length: 50 }, (_, i) => {
      const ts = new Date(thirtyDaysAgo.getTime() + (i / 49) * 30 * 24 * 60 * 60 * 1000);
      return makeEvent({ timestamp: ts.toISOString() });
    });

    // With rejections: same events + human_rejected metadata on some
    const rejectionEvents = Array.from({ length: 50 }, (_, i) => {
      const ts = new Date(thirtyDaysAgo.getTime() + (i / 49) * 30 * 24 * 60 * 60 * 1000);
      const meta = i < 10 ? { human_rejected: true } : {};
      const outcome = i < 10 ? 'blocked' as const : 'allowed' as const;
      return makeEvent({ timestamp: ts.toISOString(), outcome, metadata: meta });
    });

    const baselineProfile = computeTrustScore(baselineEvents);
    const rejectionProfile = computeTrustScore(rejectionEvents);

    expect(rejectionProfile.trust_score).toBeLessThan(baselineProfile.trust_score);
    expect(rejectionProfile.human_rejections).toBe(10);
  });

  it('fresh keypair (Sybil scenario) scores 0', () => {
    // A brand new agent with no events — simulates Sybil attack
    const profile = computeTrustScore([]);

    expect(profile.trust_score).toBe(0);
    expect(profile.trust_grade).toBe('unverified');
    expect(profile.total_events).toBe(0);
    expect(profile.allowed_ratio).toBe(0);
    expect(profile.first_seen).toBeNull();
  });
});
