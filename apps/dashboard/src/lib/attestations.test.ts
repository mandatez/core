import { describe, it, expect } from 'vitest';
import { canonicalAttestationPayload, type AttestationViolation } from './attestations';

describe('canonicalAttestationPayload', () => {
  const baseParts = {
    id: 'att_deadbeefdeadbeefdeadbeefdeadbeef',
    agent_id: 'ag_test',
    owner_id: 'org_acme',
    window_start: '2026-05-01T00:00:00.000Z',
    window_end: '2026-05-31T00:00:00.000Z',
    event_count: 2,
    events_hash: 'a'.repeat(64),
    verdict: 'violations_detected' as const,
    violations: [
      {
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: '2026-05-10T12:00:00.000Z',
        action_type: 'export',
        resource: 'database/users',
        outcome: 'blocked',
      },
      {
        event_id: '550e8400-e29b-41d4-a716-446655440001',
        timestamp: '2026-05-11T12:00:00.000Z',
        action_type: 'payment',
        resource: 'stripe/charges',
        outcome: 'flagged',
      },
    ] satisfies AttestationViolation[],
    platform_public_key: 'pk_test_base64',
  };

  // Regression: P0-3. Previously canonicalAttestationPayload passed an
  // array of top-level keys as JSON.stringify's second arg, which is a
  // recursive whitelist that dropped every nested key. violations was
  // serialized as `[{},{}]` and was therefore never actually signed.
  it('serializes violation content, not just array length', () => {
    const a = canonicalAttestationPayload(baseParts);
    const b = canonicalAttestationPayload({
      ...baseParts,
      violations: [
        { ...baseParts.violations[0], resource: 'tampered/other-table' },
        baseParts.violations[1],
      ],
    });
    expect(a).not.toEqual(b);
  });

  it('produces identical bytes when violation key insertion order differs', () => {
    const a = canonicalAttestationPayload(baseParts);
    const reordered = {
      ...baseParts,
      violations: baseParts.violations.map((v) => ({
        outcome: v.outcome,
        resource: v.resource,
        action_type: v.action_type,
        timestamp: v.timestamp,
        event_id: v.event_id,
      })) as AttestationViolation[],
    };
    const b = canonicalAttestationPayload(reordered);
    expect(a).toEqual(b);
  });

  it('produces identical bytes when top-level key insertion order differs', () => {
    const a = canonicalAttestationPayload(baseParts);
    const reordered = {
      platform_public_key: baseParts.platform_public_key,
      violations: baseParts.violations,
      verdict: baseParts.verdict,
      events_hash: baseParts.events_hash,
      event_count: baseParts.event_count,
      window_end: baseParts.window_end,
      window_start: baseParts.window_start,
      owner_id: baseParts.owner_id,
      agent_id: baseParts.agent_id,
      id: baseParts.id,
    };
    const b = canonicalAttestationPayload(reordered);
    expect(a).toEqual(b);
  });
});
