-- Multi-member organizations with admin / security_analyst / viewer roles.
-- Unblocks enterprise deals where the whole security team needs access.
--
-- Run this in Supabase SQL Editor before deploying.

CREATE TABLE public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_owner ON public.organizations(owner_id);

CREATE TABLE public.organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'security_analyst', 'viewer')),
  invited_by TEXT NOT NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_read_their_org" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "members_can_read_members" ON public.organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()::text
    )
  );

-- Migrate existing owner_ids into single-member orgs with 'admin' role so
-- all current data remains accessible to its original owner.
-- md5 keeps the slug URL-safe and unique even when owner_ids collide in
-- their first few characters.
INSERT INTO public.organizations (name, slug, owner_id)
SELECT DISTINCT
  'My Organization',
  'org-' || substr(md5(owner_id), 1, 12),
  owner_id
FROM public.agents
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, email, role, invited_by, accepted_at)
SELECT o.id, o.owner_id, o.owner_id || '@unknown', 'admin', o.owner_id, NOW()
FROM public.organizations o
ON CONFLICT (organization_id, user_id) DO NOTHING;
