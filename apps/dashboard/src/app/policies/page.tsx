import Link from 'next/link';
import { createServerClient } from '@/lib/supabase-server';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  SectionMarker,
  Tag,
} from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Policies — MandateZ',
  description:
    'Active policies governing your agents. Create from a template or hand-roll a custom policy.',
};

interface PolicyRow {
  id: string;
  owner_id: string;
  name: string;
  rules: unknown;
  created_at: string;
}

interface PolicyView {
  id: string;
  name: string;
  ruleCount: number;
  presetId: string | null;
  createdAt: string;
}

function viewFromRow(row: PolicyRow): PolicyView {
  const raw = row.rules;
  let ruleCount = 0;
  let presetId: string | null = null;

  if (Array.isArray(raw)) {
    ruleCount = raw.length;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.rules)) {
      ruleCount = obj.rules.length;
    }
    if (typeof obj.preset_id === 'string') {
      presetId = obj.preset_id;
    }
  }

  return {
    id: row.id,
    name: row.name,
    ruleCount,
    presetId,
    createdAt: row.created_at,
  };
}

export default async function PoliciesPage() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('policies')
    .select('id, owner_id, name, rules, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const policies = ((data ?? []) as PolicyRow[]).map(viewFromRow);

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <SectionMarker number="01" label="POLICIES" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
              Active policies
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
              Every agent action is evaluated against these policies before
              the spine accepts it. Allow, block, flag — your call.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" asChild>
              <Link href="/policies/templates">Create from template</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/onboarding">Custom policy</Link>
            </Button>
          </div>
        </div>
      </header>

      {error ? (
        <Card variant="danger-tinted">
          <CardContent className="px-6 py-4">
            <p className="text-sm text-accent-danger">
              Failed to load policies: {error.message}
            </p>
          </CardContent>
        </Card>
      ) : policies.length === 0 ? (
        <EmptyState
          title="No policies yet"
          description="Start with a template — HIPAA, fintech, support, code, analytics, sales — or hand-roll a custom policy from the onboarding flow."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" asChild>
                <Link href="/policies/templates">Browse templates</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/onboarding">Custom policy</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">
              {policies.length} polic{policies.length === 1 ? 'y' : 'ies'}
            </h2>
            <Tag variant="neutral">{policies.length} TOTAL</Tag>
          </header>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {policies.map((p) => (
              <PolicyCard key={p.id} policy={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PolicyCard({ policy }: { policy: PolicyView }) {
  return (
    <Card variant="default" className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">
            {policy.name}
          </CardTitle>
          <Tag variant="success">ACTIVE</Tag>
        </div>
        <CardDescription className="font-mono text-[11px] uppercase tracking-wider">
          {policy.id}
          {policy.presetId ? ` · ${policy.presetId}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-wider text-text-muted">
          {policy.ruleCount} RULE{policy.ruleCount !== 1 ? 'S' : ''}
        </span>
        <span className="font-mono uppercase tracking-wider text-text-muted">
          {new Date(policy.createdAt)
            .toISOString()
            .slice(0, 10)
            .toUpperCase()}
        </span>
      </CardContent>
    </Card>
  );
}
