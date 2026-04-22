-- Compliance Report Auto-Scheduler — lets enterprise customers schedule
-- recurring compliance PDF reports to their auditor inbox.
--
-- Run this in Supabase SQL Editor before deploying.

CREATE TABLE public.report_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id TEXT NOT NULL,
  email TEXT NOT NULL,
  report_types TEXT[] NOT NULL DEFAULT ARRAY['owasp'],
  frequency TEXT NOT NULL DEFAULT 'quarterly'
    CHECK (frequency IN ('monthly', 'quarterly')),
  next_send_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.report_schedules
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_isolation" ON public.report_schedules
  FOR ALL USING (owner_id = auth.uid()::text);

CREATE INDEX idx_report_schedules_next_send
  ON public.report_schedules(next_send_at)
  WHERE active = true;

CREATE INDEX idx_report_schedules_owner
  ON public.report_schedules(owner_id);

-- Generated reports — holding table for PDFs produced by the scheduler.
-- Each row is one delivered report. Emailing is TODO; for now the UI
-- renders a download link that hits /api/reports/generate with these params.
CREATE TABLE public.generated_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES public.report_schedules(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  email TEXT NOT NULL,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending_email'
    CHECK (status IN ('pending_email', 'emailed', 'failed'))
);

ALTER TABLE public.generated_reports
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_isolation" ON public.generated_reports
  FOR ALL USING (owner_id = auth.uid()::text);

CREATE INDEX idx_generated_reports_owner
  ON public.generated_reports(owner_id, delivered_at DESC);