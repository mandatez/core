import { z } from 'zod';
import {
  fetchWithTimeout,
  parseJsonResponse,
  readErrorMessage,
  MandateZHttpError,
} from '../internal/http.js';

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
   * Falls back to the `MANDATEZ_DASHBOARD_URL` env var, then errors if
   * neither is provided. There is intentionally no public-default fallback —
   * the SDK refuses to silently target a host the caller did not pick.
   */
  apiUrl?: string;
  /** Optional fetch timeout in ms. Defaults to 15s. */
  timeoutMs?: number;
}

const ATTESTATION_ID_RE = /^att_[A-Za-z0-9_-]+$/;

const AttestationViolationSchema = z.object({
  event_id: z.string(),
  timestamp: z.string(),
  action_type: z.string(),
  resource: z.string(),
  outcome: z.enum(['blocked', 'flagged']),
});

const AttestationRecordSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  owner_id: z.string(),
  window_start: z.string(),
  window_end: z.string(),
  event_count: z.number(),
  events_hash: z.string(),
  verdict: z.enum(['clean', 'flagged', 'violations_detected']),
  violations: z.array(AttestationViolationSchema),
  platform_signature: z.string(),
  platform_public_key: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
}) satisfies z.ZodType<AttestationRecord>;

const VerifyAttestationResponseSchema = z.object({
  valid: z.boolean(),
  attestation: AttestationRecordSchema,
  verified_at: z.string(),
}) satisfies z.ZodType<VerifyAttestationResponse>;

function resolveApiUrl(optsApiUrl?: string): string {
  const candidate =
    optsApiUrl ??
    (typeof process !== 'undefined' ? process.env?.MANDATEZ_DASHBOARD_URL : undefined);
  if (!candidate) {
    throw new Error(
      'verifyAttestation: apiUrl is required. Pass options.apiUrl or set the MANDATEZ_DASHBOARD_URL environment variable.',
    );
  }
  return candidate.replace(/\/+$/, '');
}

/**
 * Fetches and verifies a MandateZ attestation by its id.
 *
 * Public by design: an attestation link is the distribution primitive.
 * The endpoint re-derives the canonical payload and checks the platform
 * signature server-side, so a `valid: true` response from a trusted
 * MandateZ host is sufficient proof that the row is unmodified.
 *
 * Throws {@link MandateZHttpError} on network failure, timeout, non-JSON
 * response, or unexpected response shape.
 *
 * @example
 * const result = await verifyAttestation('att_abc123', {
 *   apiUrl: 'https://dashboard.example.com',
 * });
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

  const base = resolveApiUrl(options.apiUrl);
  const url = `${base}/api/attestations/${attestationId}/verify`;

  const res = await fetchWithTimeout('verifyAttestation', url, {
    method: 'GET',
    timeoutMs: options.timeoutMs,
  });

  if (!res.ok) {
    throw new MandateZHttpError({
      label: 'verifyAttestation',
      url,
      status: res.status,
      reason: await readErrorMessage(res, `HTTP ${res.status}`),
    });
  }

  return parseJsonResponse('verifyAttestation', url, res, VerifyAttestationResponseSchema);
}
