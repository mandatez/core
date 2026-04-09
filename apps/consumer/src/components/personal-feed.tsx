'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
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
}

type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

const TRUST_BADGE_STYLE: Record<TrustGrade, string> = {
  unverified: 'text-gray-500',
  low:        'text-yellow-500',
  medium:     'text-blue-400',
  high:       'text-green-400',
  verified:   'text-emerald-400',
};

const OUTCOME_LABELS: Record<string, { label: string; style: string }> = {
  allowed: { label: 'Allowed', style: 'bg-green-900/50 text-green-300 border-green-700' },
  blocked: { label: 'Blocked', style: 'bg-red-900/50 text-red-300 border-red-700' },
  flagged: { label: 'Flagged', style: 'bg-yellow-900/50 text-yellow-300 border-yellow-700' },
  pending_approval: { label: 'Waiting for you', style: 'bg-blue-900/50 text-blue-300 border-blue-700' },
};

const ACTION_LABELS: Record<string, { icon: string; verb: string }> = {
  read: { icon: '📖', verb: 'Read' },
  write: { icon: '✏️', verb: 'Wrote to' },
  export: { icon: '📤', verb: 'Exported from' },
  delete: { icon: '🗑️', verb: 'Deleted from' },
  call: { icon: '📡', verb: 'Connected to' },
  payment: { icon: '💳', verb: 'Paid via' },
};

export function PersonalFeed() {
  const { user, isLoaded } = useUser();
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [agentGrades, setAgentGrades] = useState<Record<string, TrustGrade>>({});

  useEffect(() => {
    if (!isLoaded || !user) {
      if (isLoaded) setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowser();
    const userId = user.id;

    async function fetchAgentGrades() {
      const { data } = await supabase
        .from('agents')
        .select('id, trust_grade')
        .eq('owner_id', userId);
      if (data) {
        const map: Record<string, TrustGrade> = {};
        for (const a of data as { id: string; trust_grade: TrustGrade | null }[]) map[a.id] = a.trust_grade ?? 'unverified';
        setAgentGrades(map);
      }
    }

    async function fetchEvents() {
      const { data, error } = await supabase
        .from('agent_events')
        .select('id, agent_id, owner_id, timestamp, action_type, resource, outcome, policy_id, metadata')
        .eq('owner_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (!error && data) {
        setEvents(data as AgentEvent[]);
      }
      setLoading(false);
    }

    fetchEvents();
    fetchAgentGrades();

    const channel = supabase
      .channel('consumer_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_events',
          filter: `owner_id=eq.${userId}`,
        },
        (payload) => {
          const newEvent = payload.new as AgentEvent;
          setEvents((prev) => [newEvent, ...prev].slice(0, 100));
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isLoaded]);

  if (loading || !isLoaded) {
    return <div className="text-gray-500 text-center py-12">Loading your activity...</div>;
  }

  if (!user) {
    return <div className="text-gray-500 text-center py-12">Not signed in.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-600'}`} />
        <span className="text-gray-500">{connected ? 'Live' : 'Connecting...'}</span>
      </div>

      {events.length === 0 ? (
        <div className="border border-gray-800 rounded-lg py-16 px-6">
          <div className="max-w-lg mx-auto">
            <h3 className="text-xl font-semibold text-gray-100 text-center">No agents connected yet</h3>
            <p className="text-gray-500 text-center mt-2 mb-10">Get started in three steps.</p>

            <div className="space-y-6">
              <div className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-blue-900/40 text-blue-400 text-xs font-bold flex items-center justify-center">1</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200">Install the SDK</p>
                  <pre className="mt-1.5 text-xs text-gray-400 bg-gray-900 rounded px-3 py-2 overflow-x-auto font-mono">npm install @mandatez/sdk</pre>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-blue-900/40 text-blue-400 text-xs font-bold flex items-center justify-center">2</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-200">Register your agent</p>
                  <pre className="mt-1.5 text-xs text-gray-400 bg-gray-900 rounded px-3 py-2 overflow-x-auto font-mono whitespace-pre">{`import { MandateZClient, generateAgentIdentity } from '@mandatez/sdk';

const agent = await generateAgentIdentity();
const client = new MandateZClient({
  agentId:        agent.agent_id,
  ownerId:        '${user?.id ?? 'your_owner_id'}',
  privateKey:     agent.private_key,
  supabaseUrl:    '<your-supabase-url>',
  supabaseAnonKey:'<your-supabase-anon-key>',
});

await client.track({ action_type: 'call', resource: 'hello/world' });`}</pre>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-blue-900/40 text-blue-400 text-xs font-bold flex items-center justify-center">3</span>
                <div>
                  <p className="text-sm font-medium text-gray-200">Watch events appear here in real time</p>
                  <p className="mt-1 text-xs text-gray-500">Once your agent calls <code className="text-gray-400">client.track()</code>, events stream into this feed automatically.</p>
                </div>
              </div>
            </div>

            <div className="mt-10 text-center">
              <a
                href="https://mandatez.mintlify.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                Read the docs
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17l9.2-9.2M17 17V7H7"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <ActivityRow key={event.id} event={event} grade={agentGrades[event.agent_id]} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ event, grade }: { event: AgentEvent; grade?: TrustGrade }) {
  const action = ACTION_LABELS[event.action_type] ?? { icon: '⚡', verb: 'Acted on' };
  const outcome = OUTCOME_LABELS[event.outcome] ?? { label: event.outcome, style: 'bg-gray-800 text-gray-300 border-gray-700' };
  const time = new Date(event.timestamp);
  const ago = getTimeAgo(time);
  const g = grade ?? 'unverified';
  const gradeStyle = TRUST_BADGE_STYLE[g];

  return (
    <div className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xl">{action.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200">
            <span className="font-medium">{action.verb}</span>{' '}
            <span className="text-gray-300">{event.resource}</span>
            <span className={`ml-2 text-[10px] font-medium ${gradeStyle}`}>{g}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{ago}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border font-medium whitespace-nowrap ${outcome.style}`}>
          {outcome.label}
        </span>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
