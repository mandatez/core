'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { ExportEventsDialog } from '@/components/export-events-dialog';
import {
  Button,
  Card,
  EmptyState,
  LoadingSpinner,
  NumberDisplay,
  SectionMarker,
  Tag,
} from '@/components/ui';
import type { TagVariant } from '@/components/ui';

interface AgentEvent {
  id: string;
  agent_id: string;
  owner_id: string;
  timestamp: string;
  action_type: string;
  resource: string;
  outcome: string;
  policy_id: string | null;
  metadata: Record<string, unknown>;
  signature: string;
  public_key: string;
}

type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

interface AgentTrust {
  trust_score: number | null;
  trust_grade: TrustGrade | null;
  revoked: boolean;
  revoked_at: string | null;
}

const OUTCOME_VARIANT: Record<string, TagVariant> = {
  allowed: 'success',
  blocked: 'danger',
  flagged: 'warning',
  pending_approval: 'info',
};

const TRUST_GRADE_STYLE: Record<TrustGrade, string> = {
  unverified: 'text-text-muted',
  low: 'text-accent-warning',
  medium: 'text-accent-primary',
  high: 'text-accent-success',
  verified: 'text-accent-success',
};

const ONBOARDING_DISMISSED_KEY = 'mandatez_onboarding_dismissed';

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <GetStartedBanner />
      <EventFeed />
    </div>
  );
}

/* =========================== Get Started Banner =========================== */

type BannerState =
  | { kind: 'hidden' }
  | { kind: 'welcome' }
  | { kind: 'empty'; ownerId: string };

function GetStartedBanner() {
  const [state, setState] = useState<BannerState>({ kind: 'hidden' });

  useEffect(() => {
    let cancelled = false;
    if (window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1') return;

    const ownerId = window.localStorage.getItem('mandatez_owner_id');
    if (!ownerId) {
      setState({ kind: 'welcome' });
      return;
    }

    fetch(`/api/agents/list?owner_id=${encodeURIComponent(ownerId)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((json: { count?: number }) => {
        if (cancelled) return;
        setState(
          (json.count ?? 0) === 0
            ? { kind: 'empty', ownerId }
            : { kind: 'hidden' },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'welcome' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'hidden') return null;

  const heading =
    state.kind === 'welcome'
      ? 'Welcome to MandateZ'
      : 'Register your first agent';
  const body =
    state.kind === 'welcome'
      ? "Set up your first governed agent — cryptographic identity, policy, and audit trail in about 5 minutes."
      : `Owner ${state.ownerId} has no registered agents yet. Finish onboarding to start signing events.`;

  return (
    <Card variant="elevated" className="p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl space-y-3">
          <SectionMarker number="00" label="GET STARTED" />
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-text-primary">
            {heading}
          </h2>
          <p className="text-sm md:text-base text-text-secondary leading-relaxed">
            {body}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 font-mono text-[11px] uppercase tracking-widest text-text-muted">
            <BannerBullet>Ed25519 identity</BannerBullet>
            <BannerBullet>Policy preset</BannerBullet>
            <BannerBullet>SDK install snippet</BannerBullet>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
              setState({ kind: 'hidden' });
            }}
          >
            Dismiss
          </Button>
          <Button asChild variant="primary">
            <Link href="/onboarding">Start onboarding</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function BannerBullet({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1 w-1 rounded-full bg-accent-primary" />
      {children}
    </span>
  );
}

/* ================================ Event Feed ============================== */

function EventFeed() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [agentTrust, setAgentTrust] = useState<Record<string, AgentTrust>>({});
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    async function refreshAgents() {
      const { data } = await supabase
        .from('agents')
        .select('id, trust_score, trust_grade, metadata');
      if (!data) return;
      const map: Record<string, AgentTrust> = {};
      for (const raw of data as Array<{
        id: string;
        trust_score: number | null;
        trust_grade: TrustGrade | null;
        metadata: Record<string, unknown> | null;
      }>) {
        const meta = raw.metadata ?? {};
        map[raw.id] = {
          trust_score: raw.trust_score,
          trust_grade: raw.trust_grade,
          revoked: meta.revoked === true,
          revoked_at:
            typeof meta.revoked_at === 'string'
              ? (meta.revoked_at as string)
              : null,
        };
      }
      setAgentTrust(map);
    }

    async function fetchEvents() {
      const { data, error } = await supabase
        .from('agent_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);
      if (!error && data) setEvents(data as AgentEvent[]);
      setLoading(false);
    }

    fetchEvents();
    refreshAgents();

    const eventChannel = supabase
      .channel('agent_events_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_events' },
        (payload) => {
          const newEvent = payload.new as AgentEvent;
          setEvents((prev) => {
            if (prev.some((e) => e.id === newEvent.id)) return prev;
            return [newEvent, ...prev].slice(0, 200);
          });
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    const agentChannel = supabase
      .channel('agents_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agents' },
        () => {
          refreshAgents();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventChannel);
      supabase.removeChannel(agentChannel);
    };
  }, []);

  async function handleRevoke(agentId: string) {
    setPendingRevoke(agentId);
    try {
      const res = await fetch(
        `/api/agents/${encodeURIComponent(agentId)}/revoke`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        },
      );
      if (!res.ok && res.status !== 409) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setAgentTrust((prev) => ({
        ...prev,
        [agentId]: {
          ...(prev[agentId] ?? {
            trust_score: null,
            trust_grade: 'unverified' as TrustGrade,
            revoked: false,
            revoked_at: null,
          }),
          revoked: true,
          revoked_at: new Date().toISOString(),
        },
      }));
    } catch (err) {
      window.alert(
        `Revoke failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setPendingRevoke(null);
    }
  }

  const stats = useMemo(() => {
    const total = events.length;
    const allowed = events.filter((e) => e.outcome === 'allowed').length;
    const allowedPct = total === 0 ? 0 : Math.round((allowed / total) * 100);
    const days = new Set<string>();
    for (const e of events) days.add(e.timestamp.slice(0, 10));
    return { total, allowedPct, activeDays: days.size };
  }, [events]);

  const revokedCount = useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    for (const e of events) {
      if (seen.has(e.agent_id)) continue;
      seen.add(e.agent_id);
      if (agentTrust[e.agent_id]?.revoked) count += 1;
    }
    return count;
  }, [events, agentTrust]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total events" value={stats.total} />
        <StatCard
          label="Allowed"
          value={`${stats.allowedPct}%`}
          accent={stats.allowedPct >= 95 ? 'success' : undefined}
        />
        <StatCard label="Active days" value={stats.activeDays} />
      </div>

      {/* Section header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <SectionMarker number="01" label="LIVE EVENTS" />
          <p className="text-sm text-text-secondary leading-relaxed max-w-xl">
            Signed agent actions stream in here in real time. No refresh
            required.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveTag connected={connected} />
          <span className="font-mono text-xs uppercase tracking-widest text-text-muted">
            {stats.total} {stats.total === 1 ? 'event' : 'events'}
            {revokedCount > 0 ? (
              <span className="ml-2 text-accent-danger">
                · {revokedCount} revoked
              </span>
            ) : null}
          </span>
          <ExportEventsDialog />
        </div>
      </div>

      {/* Empty / populated */}
      {events.length === 0 ? (
        <EmptyState
          icon={<IconActivity />}
          title="No events yet"
          description="Your first event will appear here within 60 seconds of installing the SDK."
          action={
            <Button asChild variant="primary" leftIcon={<IconTerminal />}>
              <Link href="/onboarding">View install snippet</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              trust={agentTrust[event.agent_id]}
              onRevoke={handleRevoke}
              revokePending={pendingRevoke === event.agent_id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------- Event row + helpers -------------------------- */

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'success' | 'danger';
}) {
  return (
    <Card variant="default" className="p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
        {label}
      </div>
      <div className="mt-2">
        <NumberDisplay
          size="sm"
          value={value}
          accent={accent}
        />
      </div>
    </Card>
  );
}

function LiveTag({ connected }: { connected: boolean }) {
  return (
    <Tag
      variant={connected ? 'success' : 'neutral'}
      className="gap-2"
      title={connected ? 'Realtime subscription active' : 'Connecting…'}
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-success opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            connected ? 'bg-accent-success' : 'bg-text-muted'
          }`}
        />
      </span>
      {connected ? 'LIVE' : 'CONNECTING'}
    </Tag>
  );
}

function EventRow({
  event,
  trust,
  onRevoke,
  revokePending,
}: {
  event: AgentEvent;
  trust?: AgentTrust;
  onRevoke: (agentId: string) => void;
  revokePending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const outcomeVariant: TagVariant =
    OUTCOME_VARIANT[event.outcome] ?? 'neutral';
  const grade = trust?.trust_grade ?? 'unverified';
  const gradeStyle = TRUST_GRADE_STYLE[grade];
  const revoked = trust?.revoked === true;
  const time = new Date(event.timestamp).toLocaleString();

  return (
    <Card
      variant={revoked ? 'danger-tinted' : 'default'}
      className="cursor-pointer p-4 transition-colors hover:border-border-strong"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-text-primary truncate">
              {event.agent_id}
            </span>
            {revoked ? (
              <Tag
                variant="danger"
                className="gap-1.5"
                title={
                  trust?.revoked_at ? `Revoked ${trust.revoked_at}` : 'Revoked'
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-danger" />
                Revoked
              </Tag>
            ) : (
              <span
                className={`font-mono text-[11px] uppercase tracking-widest ${gradeStyle}`}
                title={`Trust: ${trust?.trust_score ?? '—'}/100`}
              >
                {trust?.trust_score != null
                  ? `${trust.trust_score} · ${grade}`
                  : `— · ${grade}`}
              </span>
            )}
            <Tag variant="neutral">{event.action_type}</Tag>
            <span className="font-mono text-xs text-text-muted">
              on {event.resource}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-[11px] uppercase tracking-widest text-text-muted">
            {time}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Tag variant={outcomeVariant}>{event.outcome}</Tag>
          {!revoked && (
            <Button
              variant="ghost"
              size="sm"
              loading={revokePending}
              onClick={(e) => {
                e.stopPropagation();
                if (
                  window.confirm(
                    'Revoking this agent will invalidate all future events from this identity. This cannot be undone.',
                  )
                ) {
                  onRevoke(event.agent_id);
                }
              }}
              className="text-accent-danger hover:text-accent-danger"
            >
              {revokePending ? 'Revoking' : 'Revoke'}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border-default pt-4 sm:grid-cols-2">
          <DetailRow label="Event ID" value={event.id} />
          <DetailRow label="Policy" value={event.policy_id ?? 'none'} />
          <DetailRow
            label="Signature"
            value={`${event.signature.slice(0, 32)}…`}
            className="sm:col-span-2"
          />
          {revoked && trust?.revoked_at && (
            <DetailRow
              label="Agent revoked"
              value={trust.revoked_at}
              className="sm:col-span-2 text-accent-danger"
            />
          )}
          {Object.keys(event.metadata).length > 0 && (
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted mb-1.5">
                Metadata
              </div>
              <pre className="overflow-x-auto rounded-md bg-bg-overlay p-3 font-mono text-xs text-text-secondary leading-relaxed">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
        {label}
      </div>
      <div className="mt-1 font-mono text-xs text-text-secondary break-all">
        {value}
      </div>
    </div>
  );
}

/* ================================ Icons ================================== */

function IconActivity() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
