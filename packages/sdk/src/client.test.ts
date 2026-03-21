import { describe, it, expect, vi } from 'vitest';
import { MandateZClient } from './client.js';
import { generateAgentIdentity } from './identity/index.js';
import { AgentEventSchema } from './events/schema.js';

// Mock the transport layer so tests don't hit Supabase
vi.mock('./transport/supabase.js', () => {
  return {
    SupabaseTransport: class {
      async emitEvent(event: unknown) {
        return event;
      }
    },
  };
});

describe('MandateZClient', () => {
  it('track() returns a valid signed AgentEvent', async () => {
    const identity = await generateAgentIdentity();
    const client = new MandateZClient({
      agentId: identity.agent_id,
      ownerId: 'org_acme',
      privateKey: identity.private_key,
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-key',
    });

    const event = await client.track({
      action_type: 'read',
      resource: 'emails',
      outcome: 'allowed',
    });

    const result = AgentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('track() fills in agent_id and owner_id from constructor', async () => {
    const identity = await generateAgentIdentity();
    const client = new MandateZClient({
      agentId: identity.agent_id,
      ownerId: 'org_acme',
      privateKey: identity.private_key,
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-key',
    });

    const event = await client.track({
      action_type: 'write',
      resource: 'database',
      outcome: 'allowed',
      metadata: { table: 'users' },
    });

    expect(event.agent_id).toBe(identity.agent_id);
    expect(event.owner_id).toBe('org_acme');
  });

  it('track() defaults policy_id to null and metadata to {}', async () => {
    const identity = await generateAgentIdentity();
    const client = new MandateZClient({
      agentId: identity.agent_id,
      ownerId: 'org_acme',
      privateKey: identity.private_key,
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-key',
    });

    const event = await client.track({
      action_type: 'call',
      resource: 'api/stripe',
      outcome: 'flagged',
    });

    expect(event.policy_id).toBeNull();
    expect(event.metadata).toEqual({});
  });

  it('track() passes through policy_id and metadata when provided', async () => {
    const identity = await generateAgentIdentity();
    const client = new MandateZClient({
      agentId: identity.agent_id,
      ownerId: 'org_acme',
      privateKey: identity.private_key,
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-key',
    });

    const event = await client.track({
      action_type: 'export',
      resource: 'reports',
      outcome: 'blocked',
      policy_id: 'pol_no_export',
      metadata: { reason: 'compliance' },
    });

    expect(event.policy_id).toBe('pol_no_export');
    expect(event.metadata).toEqual({ reason: 'compliance' });
  });
});
