import { describe, it, expect } from 'vitest';
import sodium from 'libsodium-wrappers';
import { generateAgentIdentity } from './index.js';

describe('generateAgentIdentity', () => {
  it('returns an agent_id with ag_ prefix', async () => {
    const identity = await generateAgentIdentity();
    expect(identity.agent_id).toMatch(/^ag_[A-Za-z0-9_-]{21}$/);
  });

  it('returns valid base64-encoded Ed25519 keys', async () => {
    await sodium.ready;
    const identity = await generateAgentIdentity();

    const publicKey = sodium.from_base64(identity.public_key, sodium.base64_variants.ORIGINAL);
    const privateKey = sodium.from_base64(identity.private_key, sodium.base64_variants.ORIGINAL);

    expect(publicKey.length).toBe(sodium.crypto_sign_PUBLICKEYBYTES); // 32
    expect(privateKey.length).toBe(sodium.crypto_sign_SECRETKEYBYTES); // 64
  });

  it('generates unique identities on each call', async () => {
    const a = await generateAgentIdentity();
    const b = await generateAgentIdentity();

    expect(a.agent_id).not.toBe(b.agent_id);
    expect(a.public_key).not.toBe(b.public_key);
    expect(a.private_key).not.toBe(b.private_key);
  });

  it('produces a keypair that can sign and verify', async () => {
    await sodium.ready;
    const identity = await generateAgentIdentity();

    const privateKey = sodium.from_base64(identity.private_key, sodium.base64_variants.ORIGINAL);
    const publicKey = sodium.from_base64(identity.public_key, sodium.base64_variants.ORIGINAL);

    const message = new TextEncoder().encode('test-payload');
    const signature = sodium.crypto_sign_detached(message, privateKey);
    const valid = sodium.crypto_sign_verify_detached(signature, message, publicKey);

    expect(valid).toBe(true);
  });
});
