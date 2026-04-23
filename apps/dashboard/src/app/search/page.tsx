import { Suspense } from 'react';
import { createServerClient } from '@/lib/supabase-server';
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

  // Prefetch agent + policy options server-side when we already know the
  // owner. The client component gracefully re-fetches when the owner_id
  // changes later in the session.
  const [agents, policies] = await Promise.all([
    fetchAgentOptions(initialFilters.owner_id || null),
    fetchPolicyOptions(initialFilters.owner_id || null),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Audit Trail Search</h1>
        <p className="text-sm text-gray-400 max-w-3xl">
          Search every signed <code className="text-gray-300">AgentEvent</code> for this
          owner. Free-text matches resource, agent ID, policy, action type, outcome, and
          metadata. All filters are reflected in the URL — paste the link into a ticket to
          share an exact search with an auditor.
        </p>
      </header>

      <Suspense fallback={<div className="text-gray-500">Loading filters…</div>}>
        <SearchClient
          initialFilters={initialFilters}
          initialAgents={agents}
          initialPolicies={policies}
        />
      </Suspense>
    </div>
  );
}
