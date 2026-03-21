import { describe, it, expect, vi } from 'vitest';
import { SupabaseTransport } from './supabase.js';
import { generateAgentIdentity } from '../identity/index.js';
import { createSignedEvent } from '../events/signing.js';
import type { AgentEventInput } from '../events/schema.js';

// Mock @supabase/supabase-js so tests don't need a real Supabase instance
vi.mock('@supabase/supabase-js', () => {
  const insertFn = vi.fn();
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        insert: insertFn,
      })),
    })),
    __mockInsert: insertFn,
  };
});

async function makeSignedEvent() {
  const identity = await generateAgentIdentity();
  const input: AgentEventInput = {
    agent_id: identity.agent_id,
    owner_id: 'org_acme',
    action_type: 'read',
    resource: 'emails',
    outcome: 'allowed',
    policy_id: null,
    metadata: {},
  };
  return createSignedEvent(input, identity.private_key);
}

describe('SupabaseTransport', () => {
  it('inserts the event and returns it on success', async () => {
    const { __mockInsert } = await import('@supabase/supabase-js') as any;
    __mockInsert.mockResolvedValueOnce({ error: null });

    const transport = new SupabaseTransport({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-key',
    });

    const event = await makeSignedEvent();
    const result = await transport.emitEvent(event);

    expect(result).toEqual(event);
    expect(__mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.event_id,
        agent_id: event.agent_id,
        signature: event.signature,
      }),
    );
  });

  it('throws on Supabase error', async () => {
    const { __mockInsert } = await import('@supabase/supabase-js') as any;
    __mockInsert.mockResolvedValueOnce({
      error: { message: 'row level security violation' },
    });

    const transport = new SupabaseTransport({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-key',
    });

    const event = await makeSignedEvent();
    await expect(transport.emitEvent(event)).rejects.toThrow(
      'Failed to emit event: row level security violation',
    );
  });
});
