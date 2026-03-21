'use client';

import { useEffect, useState } from 'react';
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

export function EventFeed() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    // Fetch initial events
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('agent_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (!error && data) {
        setEvents(data as AgentEvent[]);
      }
      setLoading(false);
    }

    fetchEvents();

    // Subscribe to realtime inserts
    const channel = supabase
      .channel('agent_events_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_events' },
        (payload) => {
          const newEvent = payload.new as AgentEvent;
          setEvents((prev) => [newEvent, ...prev].slice(0, 200));
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="text-gray-500 text-center py-12">Loading events...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            connected ? 'bg-green-400' : 'bg-gray-600'
          }`}
        />
        <span className="text-gray-500">
          {connected ? 'Live' : 'Connecting...'}
        </span>
        <span className="text-gray-600 ml-auto">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-gray-500 text-center py-12 border border-gray-800 rounded-lg">
          No events yet. Events will appear here in real time once agents start reporting.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  const [expanded, setExpanded] = useState(false);
  const outcomeStyle = OUTCOME_STYLES[event.outcome] ?? 'bg-gray-800 text-gray-300 border-gray-700';
  const icon = ACTION_ICONS[event.action_type] ?? '⚡';
  const time = new Date(event.timestamp).toLocaleString();

  return (
    <div
      className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg" title={event.action_type}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-300 truncate">
              {event.agent_id}
            </span>
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
