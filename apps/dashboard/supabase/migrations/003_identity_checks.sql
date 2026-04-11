-- Identity Intelligence Module — tracks HIBP breach checks per email

CREATE TABLE public.identity_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  email TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 3),
  breach_count INTEGER DEFAULT 0,
  breaches JSONB DEFAULT '[]',
  status TEXT DEFAULT 'clean'
    CHECK (status IN ('clean', 'flagged', 'blocked')),
  checked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_identity_checks_email
  ON public.identity_checks(email);
CREATE INDEX idx_identity_checks_owner
  ON public.identity_checks(owner_id);
CREATE INDEX idx_identity_checks_status
  ON public.identity_checks(status);

ALTER TABLE public.identity_checks
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_isolation" ON public.identity_checks
  FOR ALL USING (owner_id = auth.uid()::text);
