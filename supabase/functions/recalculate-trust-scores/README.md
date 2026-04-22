# recalculate-trust-scores

Hourly edge function that refreshes `trust_score`, `trust_grade`, and the
supporting behavioral fields on every agent that logged at least one event
in the last 24 hours.

The scoring formula mirrors `computeTrustScore()` in
[packages/sdk/src/trust/posture.ts](../../../packages/sdk/src/trust/posture.ts)
exactly — the SDK is the single source of truth for score semantics.

## Deploy

```bash
supabase functions deploy recalculate-trust-scores --no-verify-jwt
```

`--no-verify-jwt` is required because pg_cron invokes this function
with the service role key, not a user JWT.

## Schedule

Run the migration in
[apps/dashboard/supabase/migrations/007_schedule_trust_recalc.sql](../../../apps/dashboard/supabase/migrations/007_schedule_trust_recalc.sql)
to register an hourly pg_cron job that POSTs to this function's URL
via `pg_net`. Fill in `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY`
before running it — the migration is idempotent, so re-running it
with different values just replaces the cron entry.

## Environment

Provided automatically by the Supabase edge runtime — no manual setup:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Manual invocation

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/recalculate-trust-scores" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

The dashboard also exposes `POST /api/trust/recalculate` for
on-demand runs from the UI.
