import { promises as dns } from 'node:dns';
import net from 'node:net';

/**
 * Centralized SSRF guard. Used by every route that fetches a caller-supplied
 * URL — currently the proxy and the alerts-test endpoint.
 *
 * Two-layer defense:
 *   1. Block hostnames that are literally private/loopback/link-local IPs.
 *   2. Resolve the hostname and block if ANY resolved address is private.
 *
 * Layer 2 closes the DNS-rebinding gap: an attacker FQDN like
 * `meta.evil.example` with an A-record pointing at 169.254.169.254 passes
 * the hostname regex but fails the resolved-IP check.
 *
 * Residual risk (not fixable in app code): a low-TTL DNS record can flip
 * between the validation lookup and the fetch lookup. Production deployments
 * must restrict outbound egress at the infrastructure layer.
 */

const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^127\./,                              // loopback
  /^10\./,                               // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./,          // RFC1918
  /^192\.168\./,                         // RFC1918
  /^169\.254\./,                         // link-local (AWS/GCP metadata)
  /^0\./,                                // "this" network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
];

const PRIVATE_IPV6_PATTERNS: RegExp[] = [
  /^::1$/,                               // loopback
  /^::ffff:127\./i,                      // IPv4-mapped loopback
  /^::ffff:10\./i,                       // IPv4-mapped RFC1918
  /^::ffff:169\.254\./i,                 // IPv4-mapped link-local
  /^fc/i, /^fd/i,                        // unique-local
  /^fe80:/i,                             // link-local
];

const BLOCKED_HOSTS = new Set<string>([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
]);

function isPrivateIp(addr: string): boolean {
  const family = net.isIP(addr);
  if (family === 4) return PRIVATE_IPV4_PATTERNS.some((re) => re.test(addr));
  if (family === 6) {
    const lower = addr.toLowerCase();
    return PRIVATE_IPV6_PATTERNS.some((re) => re.test(lower));
  }
  return false;
}

export interface SsrfCheckOptions {
  /** Allow http URLs (default: false — https only). */
  allowHttp?: boolean;
}

/**
 * Validates that a target URL is safe to fetch.
 *
 * Returns null when the URL is safe. Returns a human-readable reason string
 * when the URL must be blocked — callers should respond 400 with that reason.
 */
export async function checkSsrfSafe(
  targetUrl: string,
  options: SsrfCheckOptions = {},
): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return 'invalid URL';
  }

  if (url.protocol !== 'https:' && !(options.allowHttp && url.protocol === 'http:')) {
    return 'target must use https';
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(host)) return 'target host is blocked';

  // If the hostname IS an IP literal, check it directly.
  const literalFamily = net.isIP(host);
  if (literalFamily) {
    if (isPrivateIp(host)) {
      return 'target resolves to a private or link-local address';
    }
    return null;
  }

  // Otherwise resolve. dns.lookup returns whatever the system resolver gives
  // — same path fetch() will take, so the lookup matches the connect path
  // (modulo TTL flips, which are the residual-risk caveat above).
  let addrs: Array<{ address: string }>;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    // Refusing to fetch an unresolvable hostname is the safe default.
    return 'target hostname could not be resolved';
  }

  if (addrs.length === 0) return 'target hostname has no resolvable addresses';

  for (const { address } of addrs) {
    if (isPrivateIp(address)) {
      return 'target resolves to a private or link-local address';
    }
  }

  return null;
}
