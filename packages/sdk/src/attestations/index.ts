export type Verdict = 'clean' | 'flagged' | 'violations_detected';

export interface AttestationViolation {
  event_id: string;
  timestamp: string;
  action_type: string;
  resource: string;
  outcome: 'blocked' | 'flagged';
}

export interface AttestationRecord {
  id: string;
  agent_id: string;
  owner_id: string;
  window_start: string;
  window_end: string;
  event_count: number;
  events_hash: string;
  verdict: Verdict;
  violations: AttestationViolation[];
  platform_signature: string;
  platform_public_key: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface VerifyAttestationResponse {
  valid: boolean;
  attestation: AttestationRecord;
  verified_at: string;
}

export interface VerifyAttestationOptions {
  /**
   * Base URL of the MandateZ dashboard hosting the verify endpoint.
   * Defaults to the public production deployment.
   */
  apiUrl?: string;
}

const DEFAULT_API_URL = 'https://dashboard.mandatez.com';
const ATTESTATION_ID_RE = /^att_[A-Za-z0-9_-]+$/;

/**
 * Fetches and verifies a MandateZ attestation by its id.
 *
 * Public by design: an attestation link is the distribution primitive.
 * The endpoint re-derives the canonical payload and checks the platform
 * signature server-side, so a `valid: true` response from a trusted
 * MandateZ host is sufficient proof that the row is unmodified.
 *
 * @example
 * const result = await verifyAttestation('att_abc123');
 * if (!result.valid) throw new Error('Attestation tampered');
 * console.log(result.attestation.verdict);
 */
export async function verifyAttestation(
  attestationId: string,
  options: VerifyAttestationOptions = {},
): Promise<VerifyAttestationResponse> {
  if (!ATTESTATION_ID_RE.test(attestationId)) {
    throw new Error('verifyAttestation: attestationId must start with att_');
  }

  const base = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
  const res = await fetch(`${base}/api/attestations/${attestationId}/verify`);

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      err.error
        ? `verifyAttestation failed: ${err.error}`
        : `verifyAttestation failed: HTTP ${res.status}`,
    );
  }

  return (await res.json()) as VerifyAttestationResponse;
}
