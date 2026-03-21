import { describe, it, expect, vi } from 'vitest';
import { MandateZLangChainCallback } from './index.js';
import { MandateZClient } from '../../client.js';
import { generateAgentIdentity } from '../../identity/index.js';

vi.mock('../../transport/supabase.js', () => ({
  SupabaseTransport: class {
    async emitEvent(event: unknown) {
      return event;
    }
  },
}));

async function makeCallback() {
  const identity = await generateAgentIdentity();
  const client = new MandateZClient({
    agentId: identity.agent_id,
    ownerId: 'org_acme',
    privateKey: identity.private_key,
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-key',
  });
  return new MandateZLangChainCallback(client);
}

describe('MandateZLangChainCallback', () => {
  describe('handleLLMStart', () => {
    it('tracks a call to langchain/llm:{model}', async () => {
      const cb = await makeCallback();
      await cb.handleLLMStart({ name: 'gpt-4' }, ['Hello']);

      const events = cb.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].action_type).toBe('call');
      expect(events[0].resource).toBe('langchain/llm:gpt-4');
      expect(events[0].outcome).toBe('allowed');
    });

    it('falls back to id array if name is missing', async () => {
      const cb = await makeCallback();
      await cb.handleLLMStart({ id: ['openai', 'chat'] }, ['Hello']);

      expect(cb.getEvents()[0].resource).toBe('langchain/llm:openai/chat');
    });

    it('includes prompt count in metadata', async () => {
      const cb = await makeCallback();
      await cb.handleLLMStart({ name: 'claude' }, ['a', 'b', 'c']);

      expect(cb.getEvents()[0].metadata).toMatchObject({
        hook: 'llm_start',
        prompt_count: 3,
      });
    });
  });

  describe('handleToolStart', () => {
    it('tracks a call to langchain/tool:{name} with pending_approval', async () => {
      const cb = await makeCallback();
      await cb.handleToolStart({ name: 'web_search' }, 'query text');

      const events = cb.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].resource).toBe('langchain/tool:web_search');
      expect(events[0].outcome).toBe('pending_approval');
    });

    it('includes input length in metadata', async () => {
      const cb = await makeCallback();
      await cb.handleToolStart({ name: 'calculator' }, '2+2');

      expect(cb.getEvents()[0].metadata).toMatchObject({
        hook: 'tool_start',
        tool: 'calculator',
        input_length: 3,
      });
    });
  });

  describe('handleToolEnd', () => {
    it('tracks an allowed call to langchain/tool', async () => {
      const cb = await makeCallback();
      await cb.handleToolEnd('result data');

      const events = cb.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].resource).toBe('langchain/tool');
      expect(events[0].outcome).toBe('allowed');
      expect(events[0].metadata).toMatchObject({
        hook: 'tool_end',
        output_length: 11,
      });
    });
  });

  describe('handleChainError', () => {
    it('tracks a flagged call to langchain/chain', async () => {
      const cb = await makeCallback();
      await cb.handleChainError(new Error('Rate limit exceeded'));

      const events = cb.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].resource).toBe('langchain/chain');
      expect(events[0].outcome).toBe('flagged');
      expect(events[0].metadata).toMatchObject({
        hook: 'chain_error',
        error: 'Rate limit exceeded',
      });
    });

    it('handles non-Error objects', async () => {
      const cb = await makeCallback();
      await cb.handleChainError('string error');

      expect(cb.getEvents()[0].metadata).toMatchObject({
        error: 'string error',
      });
    });
  });

  describe('getEvents', () => {
    it('accumulates events across multiple callbacks', async () => {
      const cb = await makeCallback();
      await cb.handleLLMStart({ name: 'gpt-4' }, ['Hello']);
      await cb.handleToolStart({ name: 'search' }, 'query');
      await cb.handleToolEnd('result');

      expect(cb.getEvents()).toHaveLength(3);
    });

    it('returns a copy, not the internal array', async () => {
      const cb = await makeCallback();
      await cb.handleLLMStart({ name: 'gpt-4' }, ['Hello']);

      const events = cb.getEvents();
      events.pop();
      expect(cb.getEvents()).toHaveLength(1);
    });
  });
});
