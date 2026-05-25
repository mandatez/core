import sodium from 'libsodium-wrappers';
import { randomUUID } from 'node:crypto';
import { AgentEventSchema } from './schema.js';
import type { AgentEvent, AgentEventInput } from './schema.js';

/**
 * Recursively sorts object keys so JSON.stringify emits a byte sequence
 * that depends only on values, never on insertion order. RFC 8785 JCS
 * is the reference; this is a pragmatic subset (no number normalisation)
 * sufficient for our event payloads.
 *
 * Why this exists: the previous implementation passed
 * `Object.keys(event).sort()` as JSON.stringify's second arg. That
 * silently dropped every nested key (the replacer-array whitelist is
 * applied recursively), so `metadata` was never actually signed. See
 * SCHEMA_AUDIT.md P0-2 and the regression test in signing.test.ts.
 */
function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortDeep);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Builds the canonical payload string for signing/verification.
 *
 * Every field except `signature` itself is included, and keys at every
 * depth are sorted alphabetically so the byte sequence survives a
 * round-trip through JSONB storage (which does not preserve key order).
 */
export function canonicalize(event: Omit<AgentEvent, 'signature'>): string {
  return JSON.stringify(sortDeep(event));
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
