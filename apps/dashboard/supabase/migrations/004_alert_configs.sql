-- Webhook Alerts — real-time notifications when agents are flagged,
-- blocked, or change trust grade. One config row per owner.
--
-- Run this in Supabase SQL Editor before deploying.

CREATE TABLE public.alert_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id TEXT NOT NULL UNIQUE,
  slack_webhook_url TEXT,
  email_address TEXT,
  webhook_url TEXT,
  alert_on_blocked BOOLEAN DEFAULT true,
  alert_on_flagged BOOLEAN DEFAULT true,
  alert_on_grade_change BOOLEAN DEFAULT true,
  alert_on_identity_breach BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_configs_owner
  ON public.alert_configs(owner_id);

ALTER TABLE public.alert_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_isolation" ON public.alert_configs
  FOR ALL USING (owner_id = auth.uid()::text);

-- Keep updated_at fresh on writes.
CREATE OR REPLACE FUNCTION public.alert_configs_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alert_configs_set_updated_at
  BEFORE UPDATE ON public.alert_configs
  FOR EACH ROW EXECUTE FUNCTION public.alert_configs_touch_updated_at();