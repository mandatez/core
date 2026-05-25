# Deploy Audit — 2026-05-25

Scope: build & deployment configuration across the MandateZ monorepo (3 Next.js
apps, 6 packages, supabase functions). Audit performed on `main` at commit
`5c598a3`.

Build verdict: **PASS** — `pnpm -r build` exits 0 across all 8 buildable
projects. No type errors, no compile failures. Two Sentry warnings (see M-4,
L-1) are non-blocking.

## Summary

| ID | Severity | Area | Issue | Status |
|----|----------|------|-------|--------|
| H-1 | High | Security headers | No CSP / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy on any of the three Next apps | Fixed |
| M-1 | Medium | Env examples | `apps/dashboard/.env.production.example` is missing 10 env vars the dashboard actually reads | Fixed |
| M-2 | Medium | Env examples | `apps/consumer/` has no `.env.example` despite reading 6 distinct env vars | Fixed |
| M-3 | Medium | Env examples | `apps/directory/` has no `.env.example` despite reading 4 distinct env vars | Fixed |
| M-4 | Medium | Sentry | Consumer build warns: `onRouterTransitionStart` hook missing from `instrumentation-client.ts` (navigation traces lost) | Fixed |
| L-1 | Low | Sentry | Consumer build warns: no `global-error.tsx` — React render errors won't surface to Sentry | Fixed |
| L-2 | Low | Hardcoded fallbacks | `apps/directory/.../[agent_id]/page.tsx` and `apps/dashboard/src/lib/email.ts` hardcode `*.vercel.app` URLs as fallbacks | Noted, not fixed (defensive defaults — env vars override in prod) |

## Detailed findings

### H-1 — Missing security headers (FIXED)

All three Next.js apps shipped with the minimum config:

```ts
const nextConfig: NextConfig = { reactStrictMode: true };
```

No `headers()` block, no CSP, no clickjacking protection. For a product
positioned as "trust infrastructure for AI agents," missing these is a poor
look — and concretely makes the dashboard exploitable for clickjacking against
the signed-in session.

**Impact:**
- Dashboard pages can be iframed by any origin (no X-Frame-Options / frame-ancestors)
- MIME-sniffing not blocked (no X-Content-Type-Options)
- Referrer leaks across origins (no Referrer-Policy)
- No HSTS preload signal to browsers

**Fix:** Added a shared `securityHeaders` block to all three `next.config.ts`
files:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-DNS-Prefetch-Control: on`

Did **not** add a full CSP — Next.js requires per-app nonce wiring and the
dashboard inlines pdf-generator runtime config. CSP is tracked as a follow-up
and is a larger separate piece of work.

### M-1 — Dashboard env example is stale (FIXED)

[apps/dashboard/.env.production.example](apps/dashboard/.env.production.example)
listed 5 vars. Code actually reads:

| Var | Where used |
|-----|------------|
| `SUPABASE_URL` | listed ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | listed ✓ |
| `SUPABASE_ANON_KEY` | `src/lib/require-auth.ts`, `src/middleware.ts` — **missing** |
| `NEXT_PUBLIC_SUPABASE_URL` | listed ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | listed ✓ |
| `NEXT_PUBLIC_APP_URL` | listed ✓ (no code reference found — kept for parity) |
| `NEXT_PUBLIC_DASHBOARD_URL` | `src/lib/email.ts` — **missing** |
| `RESEND_API_KEY` | `src/lib/email.ts` — **missing** |
| `RESEND_FROM_ADDRESS` | `src/lib/email.ts` — **missing** |
| `CRON_SECRET` | `src/app/api/schedules/trigger/route.ts` — **missing** |
| `MANDATEZ_PLATFORM_PRIVATE_KEY` | `src/lib/platform-keys.ts` — **missing** |
| `MANDATEZ_PLATFORM_PUBLIC_KEY` | `src/lib/platform-keys.ts` — **missing** |

A fresh deployment would silently boot without `CRON_SECRET` (cron fails
closed — H-1 above), without `RESEND_API_KEY` (compliance emails fail), and
without the platform keys (attestation signing would fall back to a
**publicly-known dev seed** if the `NODE_ENV === 'production'` guard didn't
exist).

**Fix:** Rewrote the example file to enumerate every variable read by the
dashboard, grouped by subsystem, with brief inline comments.

### M-2 — Consumer has no env example (FIXED)

`apps/consumer/.env.local` exists locally (gitignored ✓) but no example file.
Code reads:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser)
- `NEXT_PUBLIC_SENTRY_DSN` (error tracking)
- `SENTRY_ORG`, `SENTRY_PROJECT` (build-time source map upload)

**Fix:** Added `apps/consumer/.env.example`.

### M-3 — Directory has no env example (FIXED)

`apps/directory/` reads:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_DASHBOARD_URL`, `NEXT_PUBLIC_DIRECTORY_URL`

**Fix:** Added `apps/directory/.env.example`.

### M-4 — Sentry navigation tracing broken (FIXED)

Consumer build emitted:

> [@sentry/nextjs] ACTION REQUIRED: To instrument navigations, the Sentry
> SDK requires you to export an `onRouterTransitionStart` hook from your
> `instrumentation-client.(js|ts)` file.

Without the hook, client-side navigations don't create Sentry transactions
— performance traces only fire on hard loads, defeating most of the point of
Sentry for a Next.js App Router app.

**Fix:** Added `export const onRouterTransitionStart =
Sentry.captureRouterTransitionStart;` to
[apps/consumer/instrumentation-client.ts](apps/consumer/instrumentation-client.ts).

### L-1 — Sentry global-error handler missing (FIXED)

Consumer build emitted:

> [@sentry/nextjs] It seems like you don't have a global error handler set up.
> It is recommended that you add a 'global-error.js' file with Sentry
> instrumentation so that React rendering errors are reported to Sentry.

**Fix:** Added [apps/consumer/src/app/global-error.tsx](apps/consumer/src/app/global-error.tsx)
with `Sentry.captureException` on mount.

### L-2 — Hardcoded vercel.app fallbacks (NOT FIXED)

These fall back to `https://core-dashboard.vercel.app`,
`https://core-dashboard-black.vercel.app`, and `https://core-directory.vercel.app`
when the corresponding `NEXT_PUBLIC_*_URL` env var is unset:

- `apps/directory/src/app/agents/[agent_id]/page.tsx:49,153,154`
- `apps/dashboard/src/lib/email.ts:14`

These are **defensive defaults** — env vars override them in prod and they
keep dev working out of the box. Leaving as-is. If/when MandateZ gets a
stable production URL (e.g., `dashboard.mandatez.com`), update these
fallbacks in one pass.

## What passed

- **TypeScript strictness:** every tsconfig in the workspace has `strict:
  true`. Root `tsconfig.json`, all 3 app configs, all 6 package configs.
- **No `@ts-ignore` / `@ts-expect-error` in source code.** The only matches
  are inside `packages/github-action/dist/index.js` (a generated ncc bundle
  intentionally committed for GitHub Actions runtime — see `.gitignore` line
  78). No real-code escapes.
- **No hardcoded secrets.** Grepped for JWT (`eyJ…`), Stripe (`sk_live_`,
  `sk_test_`), Google (`AIza…`), GitHub PAT (`ghp_…`), Slack (`xoxb-…`),
  and PEM headers. Only match: `pnpm-lock.yaml` (legitimate package
  integrity hashes).
- **All env consumption goes through `process.env`** (or `Deno.env.get` in
  the supabase edge function) — no API keys ever literal in source.
- **`.env*` files are gitignored** — `.gitignore:73-75` excludes `.env`
  and `.env.*` with an exception for `.env.example`. The only `.env*` files
  tracked are `*.example` ones (intentional).
- **`node_modules/` is gitignored** and not tracked.
- **No build artifacts tracked** except `packages/github-action/dist/`
  which is intentionally allowlisted in `.gitignore:78-80` (GitHub Actions
  runs from the repo, not from npm — committing the bundle is required).
- **`pnpm-lock.yaml` is committed** (correct for reproducible installs).
- **Cron endpoint is auth-gated** —
  `apps/dashboard/src/app/api/schedules/trigger/route.ts:37-42` fails closed
  if `CRON_SECRET` is unset, then verifies `Authorization: Bearer
  ${CRON_SECRET}`.
- **Platform key fallback is production-guarded** —
  `apps/dashboard/src/lib/platform-keys.ts:33-37` throws in production if
  the env keys are missing, instead of signing with the in-repo dev seed.

## Largest committed files (informational)

```
1.3 MB  packages/github-action/dist/index.js.map   (ncc bundle map)
1.1 MB  packages/github-action/dist/index.js       (ncc bundle)
194 KB  pnpm-lock.yaml                              (lockfile — required)
 41 KB  packages/github-action/dist/sourcemap-register.js
 38 KB  apps/consumer/src/app/page.tsx
 32 KB  packages/github-action/dist/licenses.txt
```

The github-action dist files are the only oversized artifacts, and they are
required to be committed for the action to run from the repo.

## Build output details

```
Scope: 8 of 9 workspace projects
apps/consumer        ✓ Compiled successfully in 3.1min — 8 routes
apps/directory       ✓ Compiled successfully in 87s   — 4 routes
apps/dashboard       ✓ Compiled successfully in 78s   — 51 routes
packages/sdk         ✓ tsc
packages/cli         ✓ tsc
packages/mcp         ✓ tsc
packages/n8n-nodes-mandatez  ✓ tsc + svg copy
packages/github-action       ✓ ncc bundle (2.5 MB)
```

`@mandatez/compliance` is not buildable (no build script — looks like a
stub package; not blocking).

The only build warning beyond M-4 and L-1 was:

> [webpack.cache.PackFileCacheStrategy] Serializing big strings (140kiB)
> impacts deserialization performance (consider using Buffer instead and
> decode when needed)

This is a Next.js internal webpack warning, not something we can act on.
Ignoring.
