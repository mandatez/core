import sodium from 'libsodium-wrappers';
import { randomUUID } from 'node:crypto';
import { AgentEventSchema } from './schema.js';
import type { AgentEvent, AgentEventInput } from './schema.js';

/**
 * Builds the canonical payload string for signing/verification.
 *
 * Includes every field except `signature` itself, serialized with
 * sorted keys for deterministic output across platforms.
 */
function canonicalize(event: Omit<AgentEvent, 'signature'>): string {
  return JSON.stringify(event, Object.keys(event).sort());
}

/**
 * Creates a complete, signed AgentEvent from input fields.
 *
 * Fills in event_id (UUIDv4), timestamp (ISO 8601 now), derives the
 * public_key from the private_key, signs the canonical payload with
 * Ed25519, and validates the result through the Zod schema.
 */
export async function createSignedEvent(
  input: AgentEventInput,
  privateKey: string,
): Promise<AgentEvent> {
  await sodium.ready;

  const secretKey = sodium.from_base64(privateKey, sodium.base64_variants.ORIGINAL);
  const publicKey = secretKey.slice(32); // last 32 bytes of Ed25519 secret key

  const unsigned: Omit<AgentEvent, 'signature'> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...input,
    public_key: sodium.to_base64(publicKey, sodium.base64_variants.ORIGINAL),
  };

  const payload = canonicalize(unsigned);
  const message = new TextEncoder().encode(payload);
  const sig = sodium.crypto_sign_detached(message, secretKey);

  const event: AgentEvent = {
    ...unsigned,
    signature: sodium.to_base64(sig, sodium.base64_variants.ORIGINAL),
  };

  // Never skip Zod validation on event schemas
  return AgentEventSchema.parse(event);
}

/**
 * Verifies an AgentEvent's signature against its public_key.
 *
 * Re-canonicalizes the payload (excluding signature), then checks the
 * Ed25519 signature. Returns false on any error (bad key, tampered data).
 */
export async function verifyEvent(event: AgentEvent): Promise<boolean> {
  await sodium.ready;

  try {
    const { signature, ...rest } = event;
    const payload = canonicalize(rest);
    const message = new TextEncoder().encode(payload);
    const sig = sodium.from_base64(signature, sodium.base64_variants.ORIGINAL);
    const publicKey = sodium.from_base64(event.public_key, sodium.base64_variants.ORIGINAL);

    return sodium.crypto_sign_verify_detached(sig, message, publicKey);
  } catch {
    return false;
  }
}
