# @mandatez/sdk + @mandatez/mcp — Production Readiness Audit

Audit date: 2026-05-24
Auditor: Claude (against `@mandatez/sdk@0.1.8`, `@mandatez/mcp@0.1.2`)

This document is the findings record. Fixes land in a separate commit so the
"before" state stays inspectable.

## Severity legend

| Severity | Meaning |
|---|---|
| **Critical** | Ships broken for a stated use case — users hit it on day one. |
| **High** | Real bug or silent failure that bites under load / adverse conditions. |
| **Medium** | Sharp edge: works in the happy path, surprises in adverse cases. |
| **Low** | Note for next round — won't break shipping consumers. |

---

## Critical

### C1 — README "Enterprise mode" example is non-functional

[packages/sdk/README.md:50](packages/sdk/README.md#L50-L56) shows:

```ts
const client = new MandateZClient({
  apiKey: process.env.MANDATEZ_API_KEY!,
  agentId: 'ag_...',
  ownerId: 'your_org_id',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
});
```

But [`MandateZClientConfig`](packages/sdk/src/client.ts#L54-L83) declares
`supabaseUrl: string` and `supabaseAnonKey: string` as **required** fields,
and the constructor instantiates `SupabaseTransport` from them on every
client whether or not `apiKey` is set. A user copy-pasting the README
example gets a TypeScript error and a runtime crash inside the transport.

`apiKey` in the config is only used by `trackBatch()`, `getRiskScore()`,
and `computeRiskScore()` — it does not replace the Supabase credentials
for `track()`.

**Fix:** rewrite the Enterprise example to include the Supabase creds, or
make them genuinely optional (gate the transport behind a "have I got
Supabase creds?" check). Including them is the lower-risk patch.

---

## High

### H1 — No timeouts on any SDK fetch() call

Eleven `fetch()` call sites in the SDK ([grepped from `packages/sdk/src`](packages/sdk/src)):

- [risk/index.ts:74,97](packages/sdk/src/risk/index.ts) — `getRiskScore`, `computeRiskScore`
- [attestations/index.ts:66](packages/sdk/src/attestations/index.ts#L66) — `verifyAttestation`
- [client.ts:365,481](packages/sdk/src/client.ts#L365) — `postBatch`, `verifyAgent`
- [identity/hibp.ts:63](packages/sdk/src/identity/hibp.ts#L63) — `checkIdentity`
- [oversight/alerts.ts:37,62](packages/sdk/src/oversight/alerts.ts#L37) — Slack + webhook alerts
- [exporters/datadog.ts:79](packages/sdk/src/exporters/datadog.ts#L79), [splunk.ts:70](packages/sdk/src/exporters/splunk.ts#L70), [webhook.ts:57](packages/sdk/src/exporters/webhook.ts#L57), [otel.ts:135](packages/sdk/src/exporters/otel.ts#L135)

None pass an `AbortSignal`. A hung TCP socket or a slow downstream stalls
the SDK indefinitely. For exporters this is fire-and-forget so the impact
is "leaked connection"; for `track()`/`postBatch()`/risk-score calls it
blocks the user's main flow.

**Fix:** introduce a `fetchWithTimeout(url, init, timeoutMs)` helper
(default 15 s) and use it everywhere. Pass the timeout through SDK config
for advanced users.

### H2 — Risk SDK throws SyntaxError on non-JSON success response

[risk/index.ts:81,103](packages/sdk/src/risk/index.ts#L81-L103) does:

```ts
if (!res.ok) { /* handles HTML/JSON error body via readError */ }
return (await res.json()) as RiskScoreRecord;
```

The error path is defensive (`readError` catches JSON parse failures).
The **success path** is not — if the dashboard responds 200 with HTML
(load balancer redirect to a login page, cached error page, etc.) the
caller sees a raw `SyntaxError: Unexpected token < in JSON at position 0`
with no context about which call failed or what was returned.

**Fix:** wrap the success-path `res.json()` in a try/catch that throws
a labeled error including the URL and the first ~200 chars of the body.

### H3 — `verifyAttestation` default URL points at non-existent host

[attestations/index.ts:41](packages/sdk/src/attestations/index.ts#L41):

```ts
const DEFAULT_API_URL = 'https://dashboard.mandatez.com';
```

The host has no active deployment as of this audit. The function *is*
configurable (`options.apiUrl`), but a consumer doing
`verifyAttestation('att_abc')` with no options hits a DNS or 4xx error.

**Fix:** read `MANDATEZ_DASHBOARD_URL` env var as the implicit default
when running in Node, throw a clear error if neither option nor env var
is set. (Don't ship a fictional URL as the silent fallback.)

### H4 — Cast `as RiskScoreRecord` is unvalidated

[risk/index.ts:81,103](packages/sdk/src/risk/index.ts#L81) and
[attestations/index.ts:77](packages/sdk/src/attestations/index.ts#L77) both
cast the parsed JSON directly to the typed response. If the server response
shape ever drifts (added/removed field, type narrowed), TypeScript users
will get cryptic property-access errors deep in their code — far from the
SDK call.

The SDK already uses Zod for every event schema; the API response should
be the same defensive boundary. The score JSON is also expensive to
recompute, so we want loud failure if we ever read a corrupt row.

**Fix:** validate via Zod schemas mirroring `RiskScoreRecord` and
`VerifyAttestationResponse` before returning.

---

## Medium

### M1 — MCP `register_agent`/`track_event` rely on `MANDATEZ_OWNER_ID` with default `'default-owner'`

[packages/mcp/src/index.ts:25,72-77](packages/mcp/src/index.ts#L25):

```ts
const OWNER_ID = process.env.MANDATEZ_OWNER_ID ?? 'default-owner';
…
await supabase.from('agents').insert({ owner_id: OWNER_ID, … });
```

Inserts run with the **anon key** (no JWT). The RLS policy on `agents`
([001_schema_and_rls.sql:62-66](apps/dashboard/supabase/migrations/001_schema_and_rls.sql#L62))
is `owner_id = auth.jwt() ->> 'sub'` — with no JWT, that resolves to
`owner_id = null`, so inserting `'default-owner'` is silently denied
unless the user disabled RLS on their project.

**Fix:** fail fast on MCP startup if `MANDATEZ_OWNER_ID` is unset or equals
the default. Print a clear error explaining the required env vars.

### M2 — MCP `verify_agent` duplicates and diverges from SDK's directory call

The SDK's `MandateZClient.verifyAgent` calls
[`https://core-directory.vercel.app/api/agents/verify`](packages/sdk/src/client.ts#L476).
The MCP server's `verify_agent` tool
([packages/mcp/src/index.ts:451-577](packages/mcp/src/index.ts#L451))
re-implements the verification logic against Supabase directly. Two paths
mean two ways to drift. The MCP path also issues a fresh `verification_id`
client-side, which is **not** the directory's record.

**Fix:** route `verify_agent` through the SDK's `verifyAgent` (or fetch the
directory endpoint), so all verifications carry the same provenance.

### M3 — No `engines` field in either package.json

Neither [packages/sdk/package.json](packages/sdk/package.json) nor
[packages/mcp/package.json](packages/mcp/package.json) declares
`"engines": { "node": ">=18" }`. The SDK relies on Node 18+ `fetch` and
`node:crypto.randomUUID`; users on Node 16 get cryptic errors at runtime.

**Fix:** add `engines.node = ">=18"` to both packages.

### M4 — `hono` vulnerabilities reachable via @modelcontextprotocol/sdk

`pnpm audit --prod` reports 3 low-severity issues in `hono` and 1 in
`express-rate-limit` → `ip-address`, all transitive through
`@modelcontextprotocol/sdk@1.29.0`. The MCP server runs over stdio and
never exercises hono's HTTP-server paths, so the practical attack surface
is zero. **No action in this commit**; track upstream MCP SDK for a hono
bump.

---

## Low / Informational

### L1 — `directoryUrl` default is hardcoded to a Vercel preview-style URL

[client.ts:144](packages/sdk/src/client.ts#L144):
`DEFAULT_DIRECTORY_URL = 'https://core-directory.vercel.app'`.

Configurable via `config.directoryUrl`, but the default is a Vercel
auto-URL rather than a vanity domain. Same risk profile as H3 but lower
because cross-agent verification is a niche call path today.

**Fix (deferred):** add env-var fallback (`MANDATEZ_DIRECTORY_URL`); leave
the current default in place to avoid breaking existing consumers.

### L2 — `MandateZAgent` uses `any` in its generic bound

[wrapper/index.ts:52](packages/sdk/src/wrapper/index.ts#L52):

```ts
export function MandateZAgent<T extends (...args: any[]) => any>(…)
```

This is the standard pattern for wrapping arbitrary user functions while
preserving their type — `unknown[]` here breaks inference for the
returned function's signature. **No fix needed.**

### L3 — Exporter fan-out failures only log to `console.warn`

[client.ts:387-397](packages/sdk/src/client.ts#L387). Fine for a free-tier
SDK; teams running this in CI would benefit from a structured callback.
**Not in scope** for this audit.

---

## Type safety — pass with notes

- Single `any` in production code (L2 above) is justified by generics.
- All public exports from `packages/sdk/src/index.ts` have matching `dist/index.d.ts` entries.
- No `as unknown as T` chains, no untyped `Record<string, any>` leaks.

## Dependencies — pass with notes

| Package | Direct deps | Used | Unused | Missing peers | Direct CVEs |
|---|---|---|---|---|---|
| `@mandatez/sdk` | 4 | 4 ✓ | 0 | 0 | 0 |
| `@mandatez/mcp` | 2 | 2 ✓ | 0 | 0 | 3 low (transitive, see M4) |

SDK deps: `@supabase/supabase-js`, `libsodium-wrappers`, `nanoid`, `zod`.
MCP deps: `@mandatez/sdk`, `@modelcontextprotocol/sdk`.

## Package exports — pass

Runtime smoke test confirms all 30 named exports load from `dist/`:

```
exports count: 30
has verifyAttestation: function
has getRiskScore: function
has computeRiskScore: function
has MandateZClient: function
has DatadogExporter: function
```

The `import { verifyAttestation, getRiskScore, computeRiskScore } from '@mandatez/sdk'` shape works as advertised.

## MCP tools — review

| Tool | Input schema vs server | Error UX | Auth path |
|---|---|---|---|
| `register_agent` | ✓ matches Supabase agents insert | Adequate | Anon key + env owner_id — see M1 |
| `track_event` | ✓ matches AgentEvent schema | Adequate | Anon key + env owner_id — see M1 |
| `get_trust_profile` | ✓ pulls all events, computes via SDK | Adequate | Anon key reads |
| `check_policy` | ✓ pure local eval, no API | Adequate | None |
| `get_audit_trail` | ✓ slices last N from SDK transport | Adequate | Anon key reads |
| `check_identity` | ✓ HIBP v3 wrapper | Adequate, surfaces 401/429 cleanly | HIBP key |
| `get_risk_score` | ✓ wraps API correctly | Adequate, propagates server `error` field | API key |

Note: the MCP server has an 8th tool, `verify_agent`, between
`check_identity` and `get_risk_score` — see M2.

---

## What this audit will fix in the next commit

| Finding | Fix |
|---|---|
| C1 | Rewrite README Enterprise example to include Supabase creds |
| H1 | Add `fetchWithTimeout` helper, wire into all SDK fetch sites |
| H2 | Wrap success-path `res.json()` with labeled error |
| H3 | Read `MANDATEZ_DASHBOARD_URL` env var; throw if no URL available |
| H4 | Add Zod schemas for `RiskScoreRecord` and `VerifyAttestationResponse`; validate before returning |
| M1 | Fail-fast on MCP startup when `MANDATEZ_OWNER_ID` is the default |
| M3 | Add `engines.node = ">=18"` to both package.json files |

Deferred to follow-up: M2 (verify_agent unification), M4 (hono upstream),
L1, L3.
