import sodium from 'libsodium-wrappers';

// Deterministic dev seed — only used when the platform env vars are missing.
// 32 bytes encoded as base64. Identical across dev restarts so locally-issued
// attestations remain verifiable after the process restarts. NEVER ship this
// seed to production: production deployments MUST set the env vars below.
const DEV_SEED_BASE64 = 'bWFuZGF0ZXotZGV2LXBsYXRmb3JtLXNlZWQtMzItYnk='; // 32 bytes

interface PlatformKeypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

let cached: PlatformKeypair | null = null;

async function loadKeypair(): Promise<PlatformKeypair> {
  if (cached) return cached;
  await sodium.ready;

  const envPriv = process.env.MANDATEZ_PLATFORM_PRIVATE_KEY;
  const envPub = process.env.MANDATEZ_PLATFORM_PUBLIC_KEY;

  if (envPriv && envPub) {
    const privateKey = sodium.from_base64(envPriv, sodium.base64_variants.ORIGINAL);
    const publicKey = sodium.from_base64(envPub, sodium.base64_variants.ORIGINAL);
    cached = { privateKey, publicKey };
    return cached;
  }

  // Deterministic dev fallback. Same seed → same keypair, so attestations
  // signed in dev stay verifiable across restarts.
  const seed = sodium.from_base64(DEV_SEED_BASE64, sodium.base64_variants.ORIGINAL);
  const kp = sodium.crypto_sign_seed_keypair(seed);
  cached = { privateKey: kp.privateKey, publicKey: kp.publicKey };
  return cached;
}

/**
 * Signs an attestation payload with the MandateZ platform key.
 *
 * The payload is a canonical string built by the caller (see attestations.ts)
 * — this function intentionally does not canonicalize, so the same byte
 * sequence used at verification time is the byte sequence signed here.
 */
export async function signAttestation(payload: string): Promise<string> {
  await sodium.ready;
  const { privateKey } = await loadKeypair();
  const message = new TextEncoder().encode(payload);
  const sig = sodium.crypto_sign_detached(message, privateKey);
  return sodium.to_base64(sig, sodium.base64_variants.ORIGINAL);
}

/**
 * Returns the MandateZ platform Ed25519 public key, base64-encoded.
 *
 * Embedded in every attestation row so verifiers can check signatures
 * without an out-of-band key lookup.
 */
export async function getPublicKey(): Promise<string> {
  await sodium.ready;
  const { publicKey } = await loadKeypair();
  return sodium.to_base64(publicKey, sodium.base64_variants.ORIGINAL);
}

/**
 * Verifies an attestation signature against a known platform public key.
 *
 * Used by the public verify endpoint — anyone with the attestation row
 * can re-verify it without trusting our database.
 */
export async function verifyAttestationSignature(
  payload: string,
  signature: string,
  publicKey: string,
): Promise<boolean> {
  await sodium.ready;
  try {
    const sig = sodium.from_base64(signature, sodium.base64_variants.ORIGINAL);
    const key = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
    const message = new TextEncoder().encode(payload);
    return sodium.crypto_sign_verify_detached(sig, message, key);
  } catch {
    return false;
  }
}
