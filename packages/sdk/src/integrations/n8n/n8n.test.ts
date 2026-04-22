import { describe, it, expect, vi } from 'vitest';
import { MandateZN8nHook } from './index.js';
import { MandateZClient } from '../../client.js';
import { generateAgentIdentity } from '../../identity/index.js';

// Mock transport so no Supabase calls
vi.mock('../../transport/supabase.js', () => ({
  SupabaseTransport: class {
    async emitEvent(event: unknown) {
      return event;
    }
  },
}));

async function makeHook() {
  const identity = await generateAgentIdentity();
  const client = new MandateZClient({
    agentId: identity.agent_id,
    ownerId: 'org_acme',
    privateKey: identity.private_key,
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-key',
  });
  return new MandateZN8nHook(client);
}

describe('MandateZN8nHook', () => {
  describe('beforeExecution', () => {
    it('tracks a call action with pending_approval outcome', async () => {
      const hook = await makeHook();
      const event = await hook.beforeExecution('wf_123', 'HTTP Request', {
        url: 'https://api.example.com',
      });

      expect(event.action_type).toBe('call');
      expect(event.outcome).toBe('pending_approval');
    });

    it('formats resource as n8n/workflow:{id}/node:{name}', async () => {
      const hook = await makeHook();
      const event = await hook.beforeExecution('wf_123', 'HTTP Request', {});

      expect(event.resource).toBe('n8n/workflow:wf_123/node:HTTP Request');
    });

    it('includes inputData in metadata', async () => {
      const hook = await makeHook();
      const input = { url: 'https://api.example.com', method: 'POST' };
      const event = await hook.beforeExecution('wf_123', 'HTTP Request', input);

      expect(event.metadata).toEqual({
        direction: 'before',
        inputData: input,
        trust_score: 0,
      });
    });
  });

  describe('afterExecution', () => {
    it('tracks allowed outcome on success', async () => {
      const hook = await makeHook();
      const event = await hook.afterExecution('wf_123', 'HTTP Request', { status: 200 }, true);

      expect(event.action_type).toBe('call');
      expect(event.outcome).toBe('allowed');
    });

    it('tracks flagged outcome on failure', async () => {
      const hook = await makeHook();
      const event = await hook.afterExecution('wf_123', 'HTTP Request', { error: 'timeout' }, false);

      expect(event.action_type).toBe('call');
      expect(event.outcome).toBe('flagged');
    });

    it('formats resource as n8n/workflow:{id}/node:{name}', async () => {
      const hook = await makeHook();
      const event = await hook.afterExecution('wf_456', 'Slack', {}, true);

      expect(event.resource).toBe('n8n/workflow:wf_456/node:Slack');
    });

    it('includes outputData and success in metadata', async () => {
      const hook = await makeHook();
      const output = { messageId: 'msg_001' };
      const event = await hook.afterExecution('wf_123', 'Slack', output, true);

      expect(event.metadata).toEqual({
        direction: 'after',
        outputData: output,
        success: true,
        trust_score: 0,
      });
    });
  });
});
