import { describe, it, expect } from 'vitest';
import { AgentEventSchema, AgentEventInputSchema } from './schema.js';

const validEvent = {
  event_id: '550e8400-e29b-41d4-a716-446655440000',
  agent_id: 'ag_abc123def456ghi789xyz',
  owner_id: 'org_acme',
  timestamp: '2026-03-21T12:00:00.000Z',
  action_type: 'read' as const,
  resource: 'emails',
  outcome: 'allowed' as const,
  policy_id: null,
  metadata: {},
  signature: 'abc123signature',
  public_key: 'abc123publickey',
};

describe('AgentEventSchema', () => {
  it('accepts a valid event', () => {
    const result = AgentEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('accepts all action_type variants', () => {
    for (const action of ['read', 'write', 'export', 'delete', 'call', 'payment']) {
      const result = AgentEventSchema.safeParse({ ...validEvent, action_type: action });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all outcome variants', () => {
    for (const outcome of ['allowed', 'blocked', 'flagged', 'pending_approval']) {
      const result = AgentEventSchema.safeParse({ ...validEvent, outcome });
      expect(result.success).toBe(true);
    }
  });

  it('accepts a string policy_id', () => {
    const result = AgentEventSchema.safeParse({ ...validEvent, policy_id: 'pol_123' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid event_id (not uuid)', () => {
    const result = AgentEventSchema.safeParse({ ...validEvent, event_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects an agent_id without ag_ prefix', () => {
    const result = AgentEventSchema.safeParse({ ...validEvent, agent_id: 'bad_id' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid action_type', () => {
    const result = AgentEventSchema.safeParse({ ...validEvent, action_type: 'hack' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid outcome', () => {
    const result = AgentEventSchema.safeParse({ ...validEvent, outcome: 'maybe' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing required field', () => {
    const { resource, ...incomplete } = validEvent;
    const result = AgentEventSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it('defaults metadata to empty object', () => {
    const { metadata, ...noMeta } = validEvent;
    const result = AgentEventSchema.safeParse(noMeta);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({});
    }
  });
});

describe('AgentEventInputSchema', () => {
  it('accepts input without event_id, signature, public_key, timestamp', () => {
    const input = {
      agent_id: 'ag_abc123def456ghi789xyz',
      owner_id: 'org_acme',
      action_type: 'write' as const,
      resource: 'database',
      outcome: 'allowed' as const,
      policy_id: null,
      metadata: { table: 'users' },
    };
    const result = AgentEventInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects input with an invalid action_type', () => {
    const input = {
      agent_id: 'ag_abc123',
      owner_id: 'org_acme',
      action_type: 'destroy',
      resource: 'database',
      outcome: 'allowed',
      policy_id: null,
    };
    const result = AgentEventInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
