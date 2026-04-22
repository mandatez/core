'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type IdentityStatus = 'clean' | 'flagged' | 'blocked';

export interface BreachSummary {
  name: string;
  date: string;
  sensitive: boolean;
}

export interface IdentityCheckRow {
  id: string;
  owner_id: string;
  agent_id: string;
  email: string;
  risk_score: number;
  breach_count: number;
  breaches: BreachSummary[];
  status: IdentityStatus;
  checked_at: string;
}

const STATUS_STYLE: Record<IdentityStatus, { label: string; badge: string; dot: string }> = {
  clean: {
    label: 'Clean',
    badge: 'bg-green-900/40 text-green-300 border-green-800',
    dot: 'bg-green-400',
  },
  flagged: {
    label: 'Flagged',
    badge: 'bg-amber-900/40 text-amber-300 border-amber-800',
    dot: 'bg-amber-400',
  },
  blocked: {
    label: 'Blocked',
    badge: 'bg-red-900/40 text-red-300 border-red-700',
    dot: 'bg-red-400',
  },
};

function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function IdentityChecksFeed({
  initialChecks,
  ownerId,
}: {
  initialChecks: IdentityCheckRow[];
  ownerId?: string;
}) {
  const [checks, setChecks] = useState<IdentityCheckRow[]>(initialChecks);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const filter = ownerId ? { filter: `owner_id=eq.${ownerId}` } : {};

    const channel = supabase
      .channel('identity_checks_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'identity_checks', ...filter },
        (payload) => {
          const row = payload.new as IdentityCheckRow;
          setChecks((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev;
            return [row, ...prev].slice(0, 200);
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'identity_checks', ...filter },
        (payload) => {
          const row = payload.new as IdentityCheckRow;
          setChecks((prev) => prev.map((c) => (c.id === row.id ? row : c)));
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerId]);

  const stats = {
    total: checks.length,
    clean: checks.filter((c) => c.status === 'clean').length,
    flagged: checks.filter((c) => c.status === 'flagged').length,
    blocked: checks.filter((c) => c.status === 'blocked').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm border border-gray-800 rounded-lg px-4 py-2.5 bg-gray-950/40">
        <span
          className={`inline-flex items-center gap-2 px-2 py-0.5 rounded border text-xs font-semibold ${
            connected
              ? 'border-green-700 bg-green-900/40 text-green-300'
              : 'border-gray-700 bg-gray-900/60 text-gray-500'
          }`}
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
          New identity checks stream in as agents run them.
        </span>
        <span className="text-gray-600 ml-auto text-xs">
          {checks.length} check{checks.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Checks" value={stats.total} color="text-gray-100" />
        <StatCard label="Clean" value={stats.clean} color="text-green-400" />
        <StatCard label="Flagged" value={stats.flagged} color="text-amber-400" />
        <StatCard label="Blocked" value={stats.blocked} color="text-red-400" />
      </div>

      {checks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/60 border-b border-gray-800">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Risk</th>
                  <th className="px-4 py-3 font-medium text-center">Breaches</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {checks.map((check) => {
                  const style = STATUS_STYLE[check.status];
                  return (
                    <tr key={check.id} className="hover:bg-gray-900/30 transition-colors">
                      <td className="px-4 py-3 text-gray-200 font-mono text-xs truncate max-w-[240px]">
                        {check.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${style.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RiskBar score={check.risk_score} />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300 font-mono">
                        {check.breach_count}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-[180px]">
                        {check.agent_id}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatRelativeTime(check.checked_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function RiskBar({ score }: { score: number }) {
  const colors = ['bg-green-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500'];
  const color = colors[Math.min(Math.max(score, 0), 3)];
  return (
    <div className="inline-flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-4 rounded-sm ${i <= score ? color : 'bg-gray-800'}`}
        />
      ))}
      <span className="ml-1 text-xs text-gray-400 font-mono">{score}/3</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 border border-gray-800 rounded-lg">
      <div className="w-16 h-16 rounded-full bg-blue-900/30 flex items-center justify-center mb-6">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-400"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-100">No identity checks yet</h3>
      <p className="text-gray-500 mt-2 mb-6 max-w-md text-center">
        Call <code className="text-gray-400 font-mono text-sm">client.checkIdentity()</code> from your agent to scan
        email addresses for known data breaches before granting access.
      </p>
    </div>
  );
}
