/**
 * Shared HTTP helpers used by every SDK fetch site.
 *
 * Wraps the global fetch with:
 *   - AbortController-driven timeout (default 15s)
 *   - Labeled errors that name the call site and include URL + body excerpt
 *   - Defensive JSON parsing on both success and error paths
 *
 * Internal — not re-exported from the package entry point.
 */

import { ZodError, type ZodType } from 'zod';

export const DEFAULT_TIMEOUT_MS = 15_000;

export interface FetchOptions extends RequestInit {
  /** Override timeout in milliseconds. Defaults to 15s. */
  timeoutMs?: number;
}

export class MandateZHttpError extends Error {
  /** HTTP status if the response made it back; 0 for network / abort failures. */
  status: number;
  /** Request URL — included in the message for context. */
  url: string;
  /** First ~200 chars of the response body when available. */
  bodyExcerpt?: string;

  constructor(opts: { label: string; url: string; status: number; reason: string; bodyExcerpt?: string }) {
    super(`${opts.label} (${opts.status} ${opts.url}): ${opts.reason}`);
    this.name = 'MandateZHttpError';
    this.status = opts.status;
    this.url = opts.url;
    if (opts.bodyExcerpt) this.bodyExcerpt = opts.bodyExcerpt;
  }
}

/**
 * fetch wrapped with an AbortController-backed timeout.
 *
 * Surfaces a single MandateZHttpError on timeout / network failure so callers
 * never see a raw "AbortError" or "fetch failed" bubble up from the runtime.
 */
export async function fetchWithTimeout(
  label: string,
  url: string,
  init: FetchOptions = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...requestInit } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...requestInit, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new MandateZHttpError({
        label,
        url,
        status: 0,
        reason: `timed out after ${timeoutMs}ms`,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new MandateZHttpError({ label, url, status: 0, reason: message });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parses a successful JSON response. If the body isn't JSON (load balancer
 * HTML, captured by a CDN, etc.) throws a labeled error with a body excerpt
 * so users can diagnose without re-running with devtools open.
 *
 * When a Zod schema is provided, the parsed payload is validated against it
 * and a clear validation error is raised if the shape drifted.
 */
export async function parseJsonResponse<T>(
  label: string,
  url: string,
  res: Response,
  schema?: ZodType<T>,
): Promise<T> {
  let text: string;
  try {
    text = await res.text();
  } catch (err) {
    throw new MandateZHttpError({
      label,
      url,
      status: res.status,
      reason: `failed to read response body: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new MandateZHttpError({
      label,
      url,
      status: res.status,
      reason: 'response was not JSON',
      bodyExcerpt: text.slice(0, 200),
    });
  }

  if (!schema) return parsed as T;

  try {
    return schema.parse(parsed);
  } catch (err) {
    if (err instanceof ZodError) {
      const detail = err.issues
        .map((iss) => `${iss.path.join('.') || '<root>'}: ${iss.message}`)
        .join('; ');
      throw new MandateZHttpError({
        label,
        url,
        status: res.status,
        reason: `response did not match expected shape: ${detail}`,
      });
    }
    throw err;
  }
}

/**
 * Extracts an `{ error: string }` from a non-OK response, falling back to the
 * HTTP status text. Used by callers that want to surface server error fields
 * verbatim (e.g. `{ "error": "Invalid agent_id format" }`).
 */
export async function readErrorMessage(res: Response, fallback?: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return fallback ?? `HTTP ${res.status}`;
    try {
      const body = JSON.parse(text) as { error?: unknown };
      if (typeof body.error === 'string' && body.error.length > 0) return body.error;
    } catch {
      // Non-JSON error body — include a short excerpt instead.
      return `${fallback ?? `HTTP ${res.status}`}: ${text.slice(0, 200)}`;
    }
    return fallback ?? `HTTP ${res.status}`;
  } catch {
    return fallback ?? `HTTP ${res.status}`;
  }
}
