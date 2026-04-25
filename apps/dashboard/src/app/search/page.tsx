import { Suspense } from 'react';
import { createServerClient } from '@/lib/supabase-server';
import { LoadingSpinner, SectionMarker } from '@/components/ui';
import { SearchClient } from './search-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Event Search — MandateZ Audit Trail',
  description:
    'Search and filter the full signed audit trail. Free-text query, date range, agent, action type, outcome, and policy filters. Export results as CSV.',
};

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function toStringParam(raw: string | string[] | undefined): string | null {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

async function fetchAgentOptions(ownerId: string | null) {
  if (!ownerId) return [] as Array<{ id: string; name: string }>;
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('agents')
      .select('id, name')
      .eq('owner_id', ownerId)
      .order('name', { ascending: true })
      .limit(500);
    return (data ?? []) as Array<{ id: string; name: string }>;
  } catch {
    return [];
  }
}

async function fetchPolicyOptions(ownerId: string | null) {
  if (!ownerId) return [] as Array<{ id: string; name: string }>;
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('policies')
      .select('id, name')
      .eq('owner_id', ownerId)
      .order('name', { ascending: true })
      .limit(200);
    return (data ?? []) as Array<{ id: string; name: string }>;
  } catch {
    return [];
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  const initialFilters = {
    q: toStringParam(params.q) ?? '',
    owner_id: toStringParam(params.owner_id) ?? '',
    agent_id: toStringParam(params.agent_id) ?? '',
    action_type: toStringParam(params.action_type) ?? '',
    outcome: toStringParam(params.outcome) ?? '',
    from: toStringParam(params.from) ?? '',
    to: toStringParam(params.to) ?? '',
    policy_id: toStringParam(params.policy_id) ?? '',
    offset: Number.parseInt(toStringParam(params.offset) ?? '0', 10) || 0,
  };

  const [agents, policies] = await Promise.all([
    fetchAgentOptions(initialFilters.owner_id || null),
    fetchPolicyOptions(initialFilters.owner_id || null),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <SectionMarker number="01" label="SEARCH" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            Audit trail search
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
            Search every signed{' '}
            <code className="font-mono text-text-primary">AgentEvent</code>{' '}
            for this owner. Free-text matches resource, agent ID, policy,
            action type, outcome, and metadata. All filters are reflected in
            the URL — paste the link to share an exact search with an
            auditor.
          </p>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <LoadingSpinner size="sm" />
            Loading filters…
          </div>
        }
      >
        <SearchClient
          initialFilters={initialFilters}
          initialAgents={agents}
          initialPolicies={policies}
        />
      </Suspense>
    </div>
  );
}
