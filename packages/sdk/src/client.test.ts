import { describe, it, expect, vi } from 'vitest';
import { MandateZClient } from './client.js';
import { generateAgentIdentity } from './identity/index.js';
import { AgentEventSchema } from './events/schema.js';
import type { Policy } from './policy/index.js';
import type { AlertChannel, OversightAlert } from './oversight/index.js';

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

function mockChannel(): AlertChannel & { calls: OversightAlert[] } {
  const calls: OversightAlert[] = [];
  return {
    calls,
    send: async (alert: OversightAlert) => { calls.push(alert); },
  };
}

async function makeClient(opts: { policies?: Policy[]; oversight?: any } = {}) {
  const identity = await generateAgentIdentity();
  return new MandateZClient({
    agentId: identity.agent_id,
    ownerId: 'org_acme',
    privateKey: identity.private_key,
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-key',
    ...opts,
  });
}

describe('MandateZClient', () => {
  describe('track() basics', () => {
    it('returns a valid signed AgentEvent', async () => {
      const client = await makeClient();
      const event = await client.track({
        action_type: 'read',
        resource: 'emails',
      });

      expect(AgentEventSchema.safeParse(event).success).toBe(true);
    });

    it('fills in agent_id and owner_id from constructor', async () => {
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
        metadata: { table: 'users' },
      });

      expect(event.agent_id).toBe(identity.agent_id);
      expect(event.owner_id).toBe('org_acme');
    });

    it('defaults policy_id to null and metadata to {}', async () => {
      const client = await makeClient();
      const event = await client.track({
        action_type: 'call',
        resource: 'api/stripe',
      });

      expect(event.policy_id).toBeNull();
      expect(event.metadata).toEqual({});
    });

    it('passes through explicit outcome, policy_id, and metadata', async () => {
      const client = await makeClient();
      const event = await client.track({
        action_type: 'export',
        resource: 'reports',
        outcome: 'blocked',
        policy_id: 'pol_no_export',
        metadata: { reason: 'compliance' },
      });

      expect(event.outcome).toBe('blocked');
      expect(event.policy_id).toBe('pol_no_export');
      expect(event.metadata).toEqual({ reason: 'compliance' });
    });
  });

  describe('track() with policy engine', () => {
    const blockExportPolicy: Policy = {
      id: 'pol_block_export',
      owner_id: 'org_acme',
      name: 'Block Exports',
      rules: [
        { id: 'r1', action_types: ['export'], resource_pattern: '*', effect: 'block' },
      ],
    };

    const flagPaymentPolicy: Policy = {
      id: 'pol_flag_payment',
      owner_id: 'org_acme',
      name: 'Flag Payments',
      rules: [
        { id: 'r1', action_types: ['payment'], resource_pattern: 'api/*', effect: 'flag' },
      ],
    };

    it('blocks action when policy says block', async () => {
      const client = await makeClient({ policies: [blockExportPolicy] });
      const event = await client.track({
        action_type: 'export',
        resource: 'reports',
      });

      expect(event.outcome).toBe('blocked');
      expect(event.policy_id).toBe('pol_block_export');
    });

    it('flags action when policy says flag', async () => {
      const client = await makeClient({ policies: [flagPaymentPolicy] });
      const event = await client.track({
        action_type: 'payment',
        resource: 'api/stripe',
      });

      expect(event.outcome).toBe('flagged');
      expect(event.policy_id).toBe('pol_flag_payment');
    });

    it('allows action when no policy matches', async () => {
      const client = await makeClient({ policies: [blockExportPolicy] });
      const event = await client.track({
        action_type: 'read',
        resource: 'emails',
      });

      expect(event.outcome).toBe('allowed');
      expect(event.policy_id).toBeNull();
    });

    it('explicit outcome overrides policy evaluation', async () => {
      const client = await makeClient({ policies: [blockExportPolicy] });
      const event = await client.track({
        action_type: 'export',
        resource: 'reports',
        outcome: 'allowed',
      });

      expect(event.outcome).toBe('allowed');
    });
  });

  describe('track() with oversight gate', () => {
    it('blocks export when oversight times out with block action', async () => {
      const ch = mockChannel();
      const client = await makeClient({
        oversight: {
          require_human_approval: ['export', 'delete', 'payment'],
          channels: [ch],
          timeout_seconds: 0.05,
          timeout_action: 'block',
        },
      });

      const event = await client.track({
        action_type: 'export',
        resource: 'reports',
      });

      expect(event.outcome).toBe('blocked');
      expect(ch.calls).toHaveLength(1);
      expect(ch.calls[0].requires_approval).toBe(true);
    });

    it('allows export when human approves', async () => {
      const client = await makeClient({
        oversight: {
          require_human_approval: ['export'],
          channels: [mockChannel()],
          timeout_seconds: 5,
          timeout_action: 'block',
        },
      });

      const event = await client.track({
        action_type: 'export',
        resource: 'reports',
        waitForApproval: async () => true,
      });

      expect(event.outcome).toBe('allowed');
    });

    it('blocks export when human rejects', async () => {
      const client = await makeClient({
        oversight: {
          require_human_approval: ['export'],
          channels: [mockChannel()],
          timeout_seconds: 5,
          timeout_action: 'block',
        },
      });

      const event = await client.track({
        action_type: 'export',
        resource: 'reports',
        waitForApproval: async () => false,
      });

      expect(event.outcome).toBe('blocked');
    });

    it('skips oversight for non-configured action types', async () => {
      const ch = mockChannel();
      const client = await makeClient({
        oversight: {
          require_human_approval: ['export'],
          channels: [ch],
          timeout_seconds: 0.05,
          timeout_action: 'block',
        },
      });

      const event = await client.track({
        action_type: 'read',
        resource: 'emails',
      });

      expect(event.outcome).toBe('allowed');
      expect(ch.calls).toHaveLength(0);
    });

    it('skips oversight when policy already blocked the action', async () => {
      const ch = mockChannel();
      const client = await makeClient({
        policies: [{
          id: 'pol_block',
          owner_id: 'org_acme',
          name: 'Block All Exports',
          rules: [{ id: 'r1', action_types: ['export'], resource_pattern: '*', effect: 'block' }],
        }],
        oversight: {
          require_human_approval: ['export'],
          channels: [ch],
          timeout_seconds: 0.05,
          timeout_action: 'block',
        },
      });

      const event = await client.track({
        action_type: 'export',
        resource: 'reports',
      });

      expect(event.outcome).toBe('blocked');
      expect(ch.calls).toHaveLength(0);
    });
  });
});
