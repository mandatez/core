'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';

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
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUser(user);

      const { data, error } = await supabase
        .from('agent_events')
        .select('id, agent_id, owner_id, timestamp, action_type, resource, outcome, policy_id, metadata')
        .eq('owner_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (!error && data) {
        setEvents(data as AgentEvent[]);
      }
      setLoading(false);

      const channel = supabase
        .channel('consumer_events')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_events',
            filter: `owner_id=eq.${user.id}`,
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
    }

    init();
  }, []);

  if (loading) {
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
        <div className="text-gray-500 text-center py-12 border border-gray-800 rounded-lg">
          No activity yet. Once your AI assistants start working, their actions will appear here.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ event }: { event: AgentEvent }) {
  const action = ACTION_LABELS[event.action_type] ?? { icon: '⚡', verb: 'Acted on' };
  const outcome = OUTCOME_LABELS[event.outcome] ?? { label: event.outcome, style: 'bg-gray-800 text-gray-300 border-gray-700' };
  const time = new Date(event.timestamp);
  const ago = getTimeAgo(time);

  return (
    <div className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xl">{action.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200">
            <span className="font-medium">{action.verb}</span>{' '}
            <span className="text-gray-300">{event.resource}</span>
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
