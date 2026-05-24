# MandateZ — Schema & Data-Layer Production-Readiness Audit

> Auditor: Claude · Date: 2026-05-24 · Migrations reviewed: 001 → 012
> Scope: `apps/dashboard/supabase/migrations/`, signing flow, RLS, FK integrity,
> index coverage, schema-vs-code drift, attestation chain of trust.

This audit was written **before** any fixes were applied. Fixes land in
follow-up commits that reference the section IDs below. Issues marked
**P0** are production blockers; **P1** are high-priority hardening; **P2**
are clean-up.

---

## P0-1 — Missing `attestations` table migration

**Severity:** Production blocker. Attestation creation/verification will 500 on a
fresh database.

**Evidence:**

- `apps/dashboard/src/lib/attestations.ts:215` — `supabase.from('attestations').insert(row)`
- `apps/dashboard/src/app/api/attestations/[id]/verify/route.ts:27` — `supabase.from('attestations').select('*')`
- `grep -r "create table.*attestation"` over the migrations directory: **zero matches**.
- `apps/dashboard/supabase/migrations/` contains 001-012; no `*_attestations.sql` file.

**Impact:** Every call to `POST /api/attestations` or `GET /api/attestations/:id/verify`
fails with a Postgres "relation does not exist" error against any database
where the migrations are the only source of truth. Tests masquerading as
"working" only do so because dev environments were schema-pushed
manually.

**Fix:** New migration `013_attestations.sql` creates the table with the
exact column set written by `createAttestation()`, plus RLS and indexes.
See follow-up commit.

---

## P0-2 — Event signature does not cover `metadata`

**Severity:** Tamper bypass on the core trust primitive.

**Evidence:** `packages/sdk/src/events/signing.ts:12-14`:

```ts
function canonicalize(event: Omit<AgentEvent, 'signature'>): string {
  return JSON.stringify(event, Object.keys(event).sort());
}
```

When `JSON.stringify`'s second argument is an array of strings, it acts as a
**whitelist of keys applied recursively to every nested object**. The
top-level keys array does not contain `folder`, `table`, `target_host`, etc.,
so every nested object — including `metadata` — is serialized as `{}`.

Verified empirically:

```bash
$ node -e "console.log(JSON.stringify({a:1, metadata:{folder:'inbox'}}, ['a','metadata'].sort()))"
{"a":1,"metadata":{}}
```

**Impact:** The contents of `metadata` are **never signed**. An attacker
with write access to `agent_events` (or a malicious agent populating its
own metadata) can change `metadata.method`, `metadata.target_host`,
`metadata.status_code`, etc. after the fact and `verifyEvent()` still
returns `true`. This is a direct attack on the audit trail — the very
thing MandateZ exists to make tamper-evident.

The unit test `events/signing.test.ts` only exercises a metadata of
`{ folder: 'inbox' }` and never asserts that mutating metadata flips
verification, so the bug has lived undetected.

**Fix:** Replace the replacer-array trick with a true deterministic
serializer that sorts keys at every depth (RFC 8785 JCS-style). See
follow-up commit for the new `canonicalize()` and a red-green test.

---

## P0-3 — Attestation signature does not cover `violations`

**Severity:** Tamper bypass on the neutral-witness primitive.

**Evidence:** `apps/dashboard/src/lib/attestations.ts:52-65`:

```ts
export function canonicalAttestationPayload(parts: { ... }): string {
  return JSON.stringify(parts, Object.keys(parts).sort());
}
```

Same root cause as P0-2. `violations` is an array of objects with keys
`event_id`, `timestamp`, `action_type`, `resource`, `outcome`. None of
those are in the top-level keys array, so each violation object is
serialized as `{}`. The array length is preserved, but **the contents are
not signed**.

**Impact:** A platform-signed attestation that says "violations_detected: 3"
can be retrieved, the actual violation rows blanked or replaced with
unrelated `event_id`s, and the signature still verifies. The verdict
itself (`verdict`, `event_count`, `events_hash`) *is* covered, so the
total damage is bounded — an attacker cannot turn a `violations_detected`
verdict into `clean`, but they can rewrite *which* events the violation
points at, which is enough to confuse an auditor about scope.

**Fix:** Same canonicalize() fix as P0-2, shared via a single utility.

---

## P0-4 — Event verification trusts embedded `public_key` blindly

**Severity:** Forgery of historical events.

**Evidence:** `packages/sdk/src/events/signing.ts:58-72` and
`apps/dashboard/src/app/api/events/batch/route.ts:83`:

```ts
export async function verifyEvent(event: AgentEvent): Promise<boolean> {
  // ...
  const publicKey = sodium.from_base64(event.public_key, ...);
  return sodium.crypto_sign_verify_detached(sig, message, publicKey);
}
```

`verifyEvent` only proves the signature is valid for whatever public key is
embedded in the event. It does **not** prove that public key belongs to
the agent named in `agent_id`.

**Impact attack (insert-time):** An attacker with a valid API key can:

1. Generate a brand-new keypair `(pk', sk')` they own.
2. Sign an event for any existing `agent_id` belonging to their owner.
3. Set `public_key = pk'` on the event and POST to `/api/events/batch`.
4. Schema check passes. Owner check passes. `verifyEvent` passes (the
   signature is valid for the embedded `pk'`).
5. Event is inserted. The audit trail now claims an agent did something
   it did not.

The `agents` table holds the canonical `public_key` for each agent.
Verification must also check `event.public_key === agents[event.agent_id].public_key`.

**Fix:** `POST /api/events/batch` now resolves the registered public key
for every distinct `agent_id` in the batch and rejects any event whose
embedded public key does not match. See follow-up commit.

---

## P0-5 — Attestation verification trusts embedded `platform_public_key` blindly

**Severity:** Forgery of platform attestations.

**Evidence:** `apps/dashboard/src/lib/attestations.ts:230-243` and
`apps/dashboard/src/lib/platform-keys.ts:71-85`.

`verifyAttestationRecord` builds its canonical payload from the row
itself, including `platform_public_key`, and verifies the signature
against that same embedded key. A tampered row that swaps both
`platform_signature` and `platform_public_key` for a freshly-signed pair
under any attacker key will verify as `valid: true`.

**Impact:** Anyone with DB write access (e.g. a leaked service role
key) can fabricate "MandateZ-attested clean" rows under their own
keypair and they will pass `verifyAttestationRecord`. The whole point of
the platform key is that it is *the* trust anchor — embedding it in the
verified payload defeats the anchor.

**Fix:** `verifyAttestationRecord` must compare the row's
`platform_public_key` against the platform key returned by
`getPublicKey()` (i.e. the keypair this MandateZ deployment actually
holds) and refuse to verify if they differ. See follow-up commit.

---

## P1-1 — `agent_events` and `agent_risk_scores` allow no UPDATE/DELETE — but only by accident

**Severity:** Tamper-resistance depends on Postgres's "default deny when
RLS is on and no policy matches", which is fragile.

**Evidence:** `001_schema_and_rls.sql:74-79` defines only `events_select_own`
and `events_insert_own` on `agent_events`. `012_agent_risk_scores.sql:32-37`
does the same. There is no explicit `UPDATE`/`DELETE` policy.

Today this means updates/deletes are silently denied for authenticated
users. But (a) the service role bypasses RLS and is used by *every* API
route, so service-role code is the only thing standing between the event
log and tampering, and (b) any future migration that adds a permissive
`FOR ALL` policy (as happens in 003, 004, 005, etc.) would silently open
updates and deletes.

**Fix:** Add explicit `DELETE`/`UPDATE` *deny* policies on `agent_events`,
`agent_risk_scores`, and `attestations` (the immutability triad), and
add a `REVOKE UPDATE, DELETE` on `authenticated` for defence in depth.

---

## P1-2 — `agents.proxy_private_key` is readable by any authenticated user

**Severity:** Private-key exfiltration if a user JWT is ever used to
query `agents`.

**Evidence:** `010_proxy_keys.sql:9-15` adds `proxy_private_key text` to
`agents`. The existing `agents_select_own` policy in 001 is row-level,
not column-level. Any authenticated user who can read their own agents
row gets the proxy private key in plaintext.

A code-only comment ("service-role only — RLS policies never expose it
to end users") does not enforce anything. The current code path happens
to use the service role, but a future `createBrowserClient()` call from
the dashboard frontend issuing `from('agents').select('*')` would leak
the key over the wire to the user's browser.

**Fix:** `REVOKE SELECT (proxy_private_key) ON agents FROM authenticated`
plus an explicit `GRANT` of all other columns. Documented in 014.

---

## P1-3 — Composite index missing for `agent_events(agent_id, timestamp)`

**Severity:** Query degradation as the event table grows.

**Evidence:** The attestation builder pulls events with
`eq('agent_id', x).gte('timestamp', a).lte('timestamp', b)`
(`apps/dashboard/src/lib/attestations.ts:165-169`) and the risk-score
builder does the same (`lib/risk-score.ts:289-296`). The only indexes are
the single-column `idx_agent_events_agent_id` and
`idx_agent_events_timestamp` from 001 — Postgres can use one but not
both for this combined predicate, so it does a bitmap scan with
post-filter when event volume grows.

**Fix:** Add `idx_agent_events_agent_timestamp` on `(agent_id, timestamp desc)`.

---

## P1-4 — Migrations are not idempotent

**Severity:** Re-running migrations or rebuilding a database fails part-way.

**Evidence (CREATE TABLE without IF NOT EXISTS):**
- `003_identity_checks.sql:3` — `CREATE TABLE public.identity_checks`
- `004_alert_configs.sql:6` — `CREATE TABLE public.alert_configs`
- `005_report_schedules.sql:6` and `:35` — both `CREATE TABLE`s
- `008_organizations.sql:6` and `:16` — both `CREATE TABLE`s

**Evidence (CREATE POLICY without DROP IF EXISTS):**
- Same files create `owner_isolation`, `members_can_read_their_org`,
  `members_can_read_members` policies with no guard.
- `012_agent_risk_scores.sql:32` and `:35` create policies with no guard.

**Evidence (CREATE INDEX without IF NOT EXISTS):**
- `003_identity_checks.sql:17-22`
- `004_alert_configs.sql:20-21`
- `005_report_schedules.sql:25-30`, `:52-53`
- `008_organizations.sql:14`, `:28-29`

Migration 001, 006, 009, 010, 011, 012 use `IF NOT EXISTS` correctly; the
intermediate ones don't. The result: `supabase db reset` partway through
development, or any re-run of the migration set against a database that
already has these tables, errors out.

**Fix:** Cleanup migration 014 wraps the offenders with idempotency
guards via `DROP POLICY IF EXISTS … CREATE POLICY …` and adds
`IF NOT EXISTS` to bare `CREATE INDEX`. The existing table creates are
left untouched (rewriting historical migrations is more dangerous than
the bug) — instead, the project README is updated to warn that
`supabase db reset` is the supported reset path.

---

## P1-5 — Inconsistent owner-id resolution in RLS policies

**Severity:** Confusion, not exploitable.

**Evidence:**
- 001 uses `auth.jwt() ->> 'sub'` on `agents`, `agent_events`, `policies`.
- 003, 004, 005, 006, 008, 012 use `auth.uid()::text`.

`auth.uid()` is a Supabase helper that returns the `sub` claim of the
current JWT, so the two are functionally identical for ordinary users.
The risk: future maintainers seeing both forms will not know which is
canonical and may invent a third.

**Fix:** Document the canonical form (`auth.uid()::text`) in the audit
README at the top of `migrations/` and standardise in migration 014
when policies are recreated for P1-1.

---

## P1-6 — `organization_members` SELECT policy is self-referential

**Severity:** Potential RLS recursion error and worst-case O(n²) plans.

**Evidence:** `008_organizations.sql:42-48`:

```sql
CREATE POLICY "members_can_read_members" ON public.organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()::text
    )
  );
```

The policy on `organization_members` queries `organization_members`.
Postgres applies the policy to the subquery as well, which can either
loop or be silently disabled depending on PG version. Even when it
works, the planner cannot use the subquery index.

**Fix:** Replace with a `SECURITY DEFINER` helper function
`public.user_is_org_member(org_id uuid)` that performs the lookup
without recursing back through RLS. Out of scope for this audit pass —
flagged for a follow-up migration once we have an enterprise customer
with >1 org member exercising this path.

---

## P1-7 — `agent_events.agent_id` FK has no `ON DELETE` clause

**Severity:** Behaviour is correct by default but undocumented.

**Evidence:** `001_schema_and_rls.sql:19` — `agent_id text references agents(id)`.

Postgres's default for FK actions is `NO ACTION`, which means deleting an
agent that has events fails with a constraint violation. This is almost
certainly the desired behaviour (we never want to be able to delete an
event by deleting its parent agent), but it's not stated.

In contrast `012_agent_risk_scores.sql:6` explicitly uses
`on delete cascade`. So an agent delete fails on `agent_events` but
would cascade-delete its `agent_risk_scores` — split behaviour for the
same parent. This works today only because nothing ever deletes agents;
`api/agents/[agent_id]/revoke` only updates a column.

**Fix:** Document the intent in 014. Add `ON DELETE RESTRICT` explicitly
to `agent_events.agent_id` so any future migration that tries to set up
cascading deletes has to think about it. Leave `agent_risk_scores` as
cascade (snapshots tied to a removed agent should die with it; events
should never die).

---

## P1-8 — Platform-key dev fallback silently activates in production if env vars missing

**Severity:** Catastrophic if it ever fires — all attestations signed by a
publicly-known seed are forgeable.

**Evidence:** `apps/dashboard/src/lib/platform-keys.ts:7-36`:

```ts
const DEV_SEED_BASE64 = 'bWFuZGF0ZXotZGV2LXBsYXRmb3JtLXNlZWQtMzItYnk='; // 32 bytes
// ...
if (envPriv && envPub) { /* load real keys */ return; }
// Deterministic dev fallback. Same seed → same keypair...
```

If `MANDATEZ_PLATFORM_PRIVATE_KEY` or `MANDATEZ_PLATFORM_PUBLIC_KEY` is
missing in production, the code silently loads the **hardcoded** dev
seed and starts issuing attestations signed by a key whose private half
is in the repo. There is no `NODE_ENV` check.

**Fix:** Refuse to load the dev seed when `NODE_ENV === 'production'`.
Log loudly on startup which key path was taken so deployers notice.

---

## P2-1 — `identity_checks.agent_id` lacks FK to `agents`

**Severity:** Orphan rows possible.

**Evidence:** `003_identity_checks.sql:6` declares `agent_id TEXT NOT NULL`
with no foreign key. An identity check row can reference an agent that
doesn't exist. Likely no practical impact (identity is owner-keyed, not
agent-keyed) but unprincipled.

**Fix:** Defer to a future hardening migration once we decide whether
identity checks should survive agent deletion. Not addressed now.

---

## P2-2 — `agent_events.search_text` rebuilds on every metadata write

**Severity:** Write amplification.

**Evidence:** `009_event_search.sql:13-20` declares `search_text` as a
`GENERATED ALWAYS … STORED` column over `coalesce(metadata::text, '')`.
Any update to metadata rewrites the row + GIN index. Today events are
write-once, so the cost is bounded — but it means `metadata` updates
are quietly more expensive than other columns.

**Fix:** None needed while events stay immutable (P1-1 enforces that).
Flag for revisit if we ever start mutating metadata post-insert.

---

## P2-3 — `005_report_schedules` and `004_alert_configs` allow DELETE via `FOR ALL`

**Severity:** Minor audit-trail loss.

**Evidence:** Both files use `CREATE POLICY "owner_isolation" … FOR ALL`,
which grants SELECT/INSERT/UPDATE/DELETE in one stroke. Users can
delete their own alert configs and report schedules. That's fine.
But the same pattern applied to `identity_checks` (003) means users can
also DELETE their breach-check history, which arguably should be
append-only for auditor evidence.

**Fix:** Defer. Lock this down when the first auditor asks for it; for
now, premature.

---

## Index coverage matrix (after fixes)

| Query | Index Used | Status |
|---|---|---|
| `agent_events.owner_id=? ORDER BY timestamp DESC` | `idx_agent_events_owner_timestamp_policy` (009) | OK |
| `agent_events.agent_id=? AND timestamp BETWEEN ?` | `idx_agent_events_agent_timestamp` (014, new) | Fixed |
| `agent_events.search_text ILIKE ?` | `idx_agent_events_search_trgm` (009) | OK |
| `agent_risk_scores.agent_id=? ORDER BY computed_at DESC` | `idx_agent_risk_scores_agent_recent` (012) | OK |
| `attestations.id=?` | PK (013, new) | Fixed |
| `attestations.agent_id=? ORDER BY created_at DESC` | `idx_attestations_agent_created` (013, new) | Fixed |
| `api_keys.key_hash=? WHERE revoked_at IS NULL` | `idx_api_keys_hash` (006) | OK |
| `organization_members.user_id=?` | `idx_org_members_user` (008) | OK |

---

## Schema-vs-code drift summary

| TypeScript shape | DB columns | Status |
|---|---|---|
| `AgentEvent` in `packages/sdk/src/events/schema.ts` | `agent_events` (001) | Match. `event_id` maps to `id`. |
| `RiskScoreRecord` in `lib/risk-score.ts` | `agent_risk_scores` (012) | Match. |
| `AttestationRecord` in `lib/attestations.ts` | `attestations` (none) | **Drift — missing table (P0-1).** |
| `IdentityCheckResult` | `identity_checks` (003) | Match. |
| `AgentTrustProfile` columns updated by `updateAgentTrust` | `agents` trust_* columns (002) | Match. |
| `proxy_private_key`, `proxy_mode_enabled` writes in `api/proxy/route.ts` | `agents` (010) | Match. |

---

## What this audit did not look at

- pg_cron schedule placeholders in 007 (operational, not schema).
- Realtime publication membership beyond `agent_events`.
- The Supabase functions directory under `apps/dashboard/supabase/functions/`.
- Storage buckets and their RLS.
- Database backups / PITR configuration.
