import { describe, it, expect } from 'vitest';
import { createSignedEvent, verifyEvent } from './signing.js';
import { AgentEventSchema } from './schema.js';
import { generateAgentIdentity } from '../identity/index.js';
import type { AgentEventInput } from './schema.js';

async function makeInput(agentId: string): Promise<AgentEventInput> {
  return {
    agent_id: agentId,
    owner_id: 'org_acme',
    action_type: 'read',
    resource: 'emails',
    outcome: 'allowed',
    policy_id: null,
    metadata: { folder: 'inbox' },
  };
}

describe('createSignedEvent', () => {
  it('returns a valid AgentEvent that passes Zod validation', async () => {
    const identity = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const event = await createSignedEvent(input, identity.private_key);

    const result = AgentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('fills in event_id as a valid UUID', async () => {
    const identity = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const event = await createSignedEvent(input, identity.private_key);

    expect(event.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('fills in timestamp as ISO 8601', async () => {
    const identity = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const event = await createSignedEvent(input, identity.private_key);

    const parsed = Date.parse(event.timestamp);
    expect(parsed).not.toBeNaN();
    expect(Math.abs(parsed - Date.now())).toBeLessThan(5000);
  });

  it('derives the correct public_key from the private_key', async () => {
    const identity = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const event = await createSignedEvent(input, identity.private_key);

    expect(event.public_key).toBe(identity.public_key);
  });

  it('generates unique event_ids on each call', async () => {
    const identity = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const a = await createSignedEvent(input, identity.private_key);
    const b = await createSignedEvent(input, identity.private_key);

    expect(a.event_id).not.toBe(b.event_id);
  });
});

describe('verifyEvent', () => {
  it('returns true for a correctly signed event', async () => {
    const identity = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const event = await createSignedEvent(input, identity.private_key);

    expect(await verifyEvent(event)).toBe(true);
  });

  it('returns false if the resource is tampered with', async () => {
    const identity = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const event = await createSignedEvent(input, identity.private_key);

    const tampered = { ...event, resource: 'bank_account' };
    expect(await verifyEvent(tampered)).toBe(false);
  });

  it('returns false if the signature is tampered with', async () => {
    const identity = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const event = await createSignedEvent(input, identity.private_key);

    const tampered = { ...event, signature: 'AAAA' + event.signature.slice(4) };
    expect(await verifyEvent(tampered)).toBe(false);
  });

  it('returns false if verified against a different agent public key', async () => {
    const identity = await generateAgentIdentity();
    const other = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const event = await createSignedEvent(input, identity.private_key);

    const swapped = { ...event, public_key: other.public_key };
    expect(await verifyEvent(swapped)).toBe(false);
  });

  it('returns false on garbage signature data', async () => {
    const identity = await generateAgentIdentity();
    const input = await makeInput(identity.agent_id);
    const event = await createSignedEvent(input, identity.private_key);

    const broken = { ...event, signature: '!!!not-base64!!!' };
    expect(await verifyEvent(broken)).toBe(false);
  });

  // Regression: P0-2. canonicalize() used to pass an array as the second
  // arg of JSON.stringify, which acts as a whitelist that drops every
  // nested key. metadata was therefore never actually signed and could
  // be mutated after the fact without breaking verification.
  it('returns false when metadata is tampered with after signing', async () => {
    const identity = await generateAgentIdentity();
    const input: AgentEventInput = {
      agent_id: identity.agent_id,
      owner_id: 'org_acme',
      action_type: 'export',
      resource: 'database/users',
      outcome: 'allowed',
      policy_id: null,
      metadata: { row_count: 5, target: 'csv' },
    };
    const event = await createSignedEvent(input, identity.private_key);

    const tampered = { ...event, metadata: { row_count: 5_000_000, target: 'csv' } };
    expect(await verifyEvent(tampered)).toBe(false);
  });

  // Regression: the canonical payload must depend on values only, not on
  // the JS object's insertion order of keys. JSONB roundtrips do not
  // preserve key order, so this is what makes verification survive
  // SELECT-ing an event back out of Postgres.
  it('verifies when metadata key order differs (JSONB round-trip)', async () => {
    const identity = await generateAgentIdentity();
    const input: AgentEventInput = {
      agent_id: identity.agent_id,
      owner_id: 'org_acme',
      action_type: 'call',
      resource: 'stripe/charges',
      outcome: 'allowed',
      policy_id: null,
      metadata: { amount: 1000, currency: 'usd', idempotency_key: 'abc' },
    };
    const event = await createSignedEvent(input, identity.private_key);

    // Rebuild the event with metadata keys in a different insertion order,
    // simulating Postgres handing the row back to the JS client.
    const reordered = {
      ...event,
      metadata: {
        idempotency_key: event.metadata.idempotency_key,
        currency: event.metadata.currency,
        amount: event.metadata.amount,
      },
    };
    expect(await verifyEvent(reordered)).toBe(true);
  });
});
