'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

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

const TRUST_GRADE_STYLE: Record<TrustGrade, string> = {
  unverified: 'text-gray-400',
  low:        'text-yellow-400',
  medium:     'text-blue-400',
  high:       'text-green-400',
  verified:   'text-emerald-300',
};

const OUTCOME_STYLES: Record<string, string> = {
  allowed: 'bg-green-900/50 text-green-300 border-green-700',
  blocked: 'bg-red-900/50 text-red-300 border-red-700',
  flagged: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  pending_approval: 'bg-blue-900/50 text-blue-300 border-blue-700',
};

const ACTION_ICONS: Record<string, string> = {
  read: '📖',
  write: '✏️',
  export: '📤',
  delete: '🗑️',
  call: '📡',
  payment: '💳',
};

export function EventFeed({ ownerId }: { ownerId?: string } = {}) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [agentTrust, setAgentTrust] = useState<Record<string, AgentTrust>>({});
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  async function refreshAgents(supabase: ReturnType<typeof getSupabaseBrowser>) {
    const query = supabase
      .from('agents')
      .select('id, trust_score, trust_grade, metadata');
    const { data } = ownerId ? await query.eq('owner_id', ownerId) : await query;
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
          typeof meta.revoked_at === 'string' ? (meta.revoked_at as string) : null,
      };
    }
    setAgentTrust(map);
  }

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    async function fetchEvents() {
      const baseQuery = supabase
        .from('agent_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      const { data, error } = ownerId
        ? await baseQuery.eq('owner_id', ownerId)
        : await baseQuery;

      if (!error && data) {
        setEvents(data as AgentEvent[]);
      }
      setLoading(false);
    }

    fetchEvents();
    refreshAgents(supabase);

    const filter = ownerId ? { filter: `owner_id=eq.${ownerId}` } : {};

    const eventChannel = supabase
      .channel('agent_events_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_events', ...filter },
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

    // Watch agents for revocation updates so badges flip in-place.
    const agentChannel = supabase
      .channel('agents_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agents', ...filter },
        () => {
          refreshAgents(supabase);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventChannel);
      supabase.removeChannel(agentChannel);
    };
  }, [ownerId]);

  async function handleRevoke(agentId: string) {
    setPendingRevoke(agentId);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok && res.status !== 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Optimistic update; realtime will reconfirm.
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

  const uniqueAgentIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.agent_id);
    return set;
  }, [events]);

  const revokedCount = useMemo(
    () => Array.from(uniqueAgentIds).filter((id) => agentTrust[id]?.revoked).length,
    [uniqueAgentIds, agentTrust],
  );

  if (loading) {
    return <div className="text-gray-500 text-center py-12">Loading events...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Live header */}
      <div className="flex items-center gap-3 text-sm border border-gray-800 rounded-lg px-4 py-2.5 bg-gray-950/40">
        <span
          className={`inline-flex items-center gap-2 px-2 py-0.5 rounded border text-xs font-semibold ${
            connected
              ? 'border-green-700 bg-green-900/40 text-green-300'
              : 'border-gray-700 bg-gray-900/60 text-gray-500'
          }`}
          title={connected ? 'Realtime subscription active' : 'Connecting to realtime...'}
        >
          <span className="relative flex h-2 w-2">
            {connected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                connected ? 'bg-green-400' : 'bg-gray-600'
              }`}
            />
          </span>
          {connected ? 'LIVE' : 'Connecting'}
        </span>
        <span className="text-gray-400 text-xs">
          Events update in real time — no refresh required.
        </span>
        <span className="text-gray-600 ml-auto text-xs">
          {events.length} event{events.length !== 1 ? 's' : ''}
          {revokedCount > 0 && (
            <> · <span className="text-red-400">{revokedCount} revoked</span></>
          )}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-gray-500 text-center py-12 border border-gray-800 rounded-lg">
          No events yet. Events will appear here in real time once agents start reporting.
        </div>
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
    </div>
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
  const outcomeStyle =
    OUTCOME_STYLES[event.outcome] ?? 'bg-gray-800 text-gray-300 border-gray-700';
  const icon = ACTION_ICONS[event.action_type] ?? '⚡';
  const time = new Date(event.timestamp).toLocaleString();
  const grade = trust?.trust_grade ?? 'unverified';
  const gradeStyle = TRUST_GRADE_STYLE[grade];
  const revoked = trust?.revoked === true;

  function handleRevokeClick(e: React.MouseEvent) {
    e.stopPropagation();
    const confirmed = window.confirm(
      'Revoking this agent will invalidate all future events from this identity. This cannot be undone.',
    );
    if (confirmed) onRevoke(event.agent_id);
  }

  return (
    <div
      className={`border rounded-lg p-4 transition-colors cursor-pointer ${
        revoked
          ? 'border-red-900/60 bg-red-950/10 hover:border-red-800/80'
          : 'border-gray-800 hover:border-gray-700'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg" title={event.action_type}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-gray-300 truncate">
              {event.agent_id}
            </span>
            {revoked ? (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider bg-red-900/50 text-red-300 border-red-700"
                title={trust?.revoked_at ? `Revoked ${trust.revoked_at}` : 'Revoked'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Revoked
              </span>
            ) : (
              <span
                className={`text-xs font-medium ${gradeStyle}`}
                title={`Trust: ${trust?.trust_score ?? '—'}/100`}
              >
                {trust?.trust_score != null ? `${trust.trust_score}` : '—'} · {grade}
              </span>
            )}
            <span className="text-gray-600">→</span>
            <span className="text-sm text-gray-200 truncate">
              {event.action_type} <span className="text-gray-500">on</span>{' '}
              <span className="font-mono">{event.resource}</span>
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{time}</div>
        </div>

        <span
          className={`text-xs px-2 py-1 rounded border font-medium ${outcomeStyle}`}
        >
          {event.outcome}
        </span>

        {!revoked && (
          <button
            type="button"
            onClick={handleRevokeClick}
            disabled={revokePending}
            className="text-xs px-2.5 py-1 rounded border border-red-900/60 bg-red-950/30 text-red-300 font-medium hover:bg-red-900/40 hover:border-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Revoke this agent's identity — cannot be undone"
          >
            {revokePending ? 'Revoking…' : 'Revoke'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-800 text-sm space-y-1">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Event ID:</span>{' '}
              <span className="font-mono text-gray-400">{event.id}</span>
            </div>
            <div>
              <span className="text-gray-500">Policy:</span>{' '}
              <span className="font-mono text-gray-400">
                {event.policy_id ?? 'none'}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Signature:</span>{' '}
              <span className="font-mono text-gray-400 break-all">
                {event.signature.slice(0, 32)}...
              </span>
            </div>
            {revoked && trust?.revoked_at && (
              <div className="col-span-2">
                <span className="text-gray-500">Agent revoked:</span>{' '}
                <span className="font-mono text-red-300">{trust.revoked_at}</span>
              </div>
            )}
          </div>
          {Object.keys(event.metadata).length > 0 && (
            <div>
              <span className="text-gray-500 text-xs">Metadata:</span>
              <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2 mt-1 overflow-x-auto">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
