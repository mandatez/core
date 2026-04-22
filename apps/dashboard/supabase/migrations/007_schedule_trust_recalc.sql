-- Schedule the recalculate-trust-scores edge function to run hourly.
--
-- Edge function source: supabase/functions/recalculate-trust-scores/index.ts
-- Deploy first:
--   supabase functions deploy recalculate-trust-scores --no-verify-jwt
--
-- Then fill in the two placeholders below and run this migration. The
-- unschedule-then-schedule pattern makes it safe to re-run if you rotate
-- the service role key or change the URL.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous registration so this migration is idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recalculate-trust-scores-hourly') THEN
    PERFORM cron.unschedule('recalculate-trust-scores-hourly');
  END IF;
END
$$;

-- Register the hourly cron. Replace:
--   YOUR_PROJECT_REF       → e.g. abcdefghijklmnop (from Supabase dashboard → Settings → API)
--   YOUR_SERVICE_ROLE_KEY  → service_role secret from the same page
SELECT cron.schedule(
  'recalculate-trust-scores-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/recalculate-trust-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify with: SELECT * FROM cron.job WHERE jobname = 'recalculate-trust-scores-hourly';
-- Inspect runs with: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
