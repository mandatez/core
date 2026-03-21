import sodium from 'libsodium-wrappers';
import { nanoid } from 'nanoid';

export interface AgentIdentity {
  /** Unique agent identifier: ag_ prefix + 21-char nanoid */
  agent_id: string;
  /** Ed25519 public key, base64-encoded */
  public_key: string;
  /** Ed25519 private key (seed), base64-encoded — never transmit or log */
  private_key: string;
}

/**
 * Generates a new agent identity with a unique ID and Ed25519 keypair.
 *
 * The keypair is used to sign every AgentEvent, creating a tamper-proof
 * chain of custody for all agent actions.
 */
export async function generateAgentIdentity(): Promise<AgentIdentity> {
  await sodium.ready;

  const keypair = sodium.crypto_sign_keypair();

  return {
    agent_id: `ag_${nanoid()}`,
    public_key: sodium.to_base64(keypair.publicKey, sodium.base64_variants.ORIGINAL),
    private_key: sodium.to_base64(keypair.privateKey, sodium.base64_variants.ORIGINAL),
  };
}
