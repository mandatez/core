/**
 * HaveIBeenPwned v3 API wrapper for Identity Intelligence.
 *
 * Checks whether an email has appeared in known data breaches,
 * then converts the breach list into a numeric risk score + status.
 *
 * API docs: https://haveibeenpwned.com/API/v3
 */

const HIBP_API_BASE = 'https://haveibeenpwned.com/api/v3';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type IdentityStatus = 'clean' | 'flagged' | 'blocked';

export interface HibpBreach {
  name: string;
  /** ISO date string (YYYY-MM-DD) when the breach occurred */
  date: string;
  /** HIBP marks some breaches as "sensitive" — e.g. leaked dating sites */
  sensitive: boolean;
}

export interface IdentityCheckResult {
  status: IdentityStatus;
  risk_score: 0 | 1 | 2 | 3;
  breach_count: number;
  breaches: HibpBreach[];
}

interface HibpRawBreach {
  Name: string;
  Title?: string;
  BreachDate: string;
  IsSensitive?: boolean;
  IsVerified?: boolean;
  IsFabricated?: boolean;
  IsRetired?: boolean;
}

/**
 * Calls HIBP and returns a normalized risk result.
 *
 * Risk scoring:
 * - 0 breaches               → score 0, status 'clean'
 * - 1 breach, all >1yr old   → score 1, status 'clean'
 * - 1-2 recent breaches      → score 2, status 'flagged'
 * - 3+ breaches OR any       → score 3, status 'blocked'
 *   sensitive breach
 */
export async function checkIdentity(
  email: string,
  apiKey: string,
): Promise<IdentityCheckResult> {
  if (!email || !email.includes('@')) {
    throw new Error('checkIdentity: invalid email');
  }
  if (!apiKey) {
    throw new Error('checkIdentity: HIBP API key is required');
  }

  const url = `${HIBP_API_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;

  const response = await fetch(url, {
    headers: {
      'hibp-api-key': apiKey,
      'user-agent': 'MandateZ-IdentityIntelligence',
      accept: 'application/json',
    },
  });

  // 404 = clean (HIBP returns 404 when the account is not in any breach)
  if (response.status === 404) {
    return { status: 'clean', risk_score: 0, breach_count: 0, breaches: [] };
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('HIBP API key is invalid or missing required entitlements');
  }

  if (response.status === 429) {
    throw new Error('HIBP rate limit exceeded — back off and retry');
  }

  if (!response.ok) {
    throw new Error(`HIBP API error: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as HibpRawBreach[];

  const breaches: HibpBreach[] = raw
    .filter((b) => !b.IsFabricated && !b.IsRetired)
    .map((b) => ({
      name: b.Title ?? b.Name,
      date: b.BreachDate,
      sensitive: Boolean(b.IsSensitive),
    }));

  return scoreBreaches(breaches);
}

/**
 * Pure function — given a list of breaches, compute risk_score + status.
 * Exported so callers can re-score cached breach lists without re-hitting HIBP.
 */
export function scoreBreaches(breaches: HibpBreach[]): IdentityCheckResult {
  const count = breaches.length;

  if (count === 0) {
    return { status: 'clean', risk_score: 0, breach_count: 0, breaches: [] };
  }

  const hasSensitive = breaches.some((b) => b.sensitive);
  if (hasSensitive || count >= 3) {
    return { status: 'blocked', risk_score: 3, breach_count: count, breaches };
  }

  const now = Date.now();
  const recentBreaches = breaches.filter((b) => {
    const breachTime = new Date(b.date).getTime();
    if (Number.isNaN(breachTime)) return true; // unknown date → treat as recent
    return now - breachTime < ONE_YEAR_MS;
  });

  if (count === 1 && recentBreaches.length === 0) {
    return { status: 'clean', risk_score: 1, breach_count: 1, breaches };
  }

  // 1-2 recent breaches
  return { status: 'flagged', risk_score: 2, breach_count: count, breaches };
}
