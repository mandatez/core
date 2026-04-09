import Link from 'next/link';
import { createServerClient } from '@/lib/supabase-server';

type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

interface Agent {
  id: string;
  owner_id: string;
  name: string;
  public_key: string;
  created_at: string;
  metadata: Record<string, unknown>;
  trust_score: number | null;
  trust_grade: TrustGrade | null;
  total_events: number | null;
  allowed_ratio: number | null;
  first_seen: string | null;
  last_active: string | null;
}

const TRUST_BADGE: Record<TrustGrade, { label: string; style: string }> = {
  unverified: { label: 'Unverified', style: 'bg-gray-800/60 text-gray-400 border-gray-700' },
  low:        { label: 'Low Trust', style: 'bg-yellow-900/40 text-yellow-400 border-yellow-800' },
  medium:     { label: 'Medium Trust', style: 'bg-blue-900/40 text-blue-400 border-blue-800' },
  high:       { label: 'High Trust', style: 'bg-green-900/40 text-green-400 border-green-800' },
  verified:   { label: 'Verified', style: 'bg-emerald-900/40 text-emerald-300 border-emerald-700' },
};

const GRADE_COLORS: Record<TrustGrade, string> = {
  verified: '#10b981',
  high: '#3b82f6',
  medium: '#6366f1',
  low: '#f59e0b',
  unverified: '#6b7280',
};

export const dynamic = 'force-dynamic';

export default async function DirectoryPage() {
  const supabase = createServerClient();
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Agent Directory</h2>
        <p className="text-gray-400 mt-1">
          Public registry of MandateZ-verified agents. Free to list, verified on-chain.
        </p>
      </div>

      {error ? (
        <div className="text-red-400 border border-red-800 rounded-lg p-4">
          Failed to load agents: {error.message}
        </div>
      ) : !agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-gray-800 rounded-lg">
          <div className="w-16 h-16 rounded-full bg-blue-900/30 flex items-center justify-center mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-100">No agents listed yet</h3>
          <p className="text-gray-500 mt-2 mb-8">Be the first to register a MandateZ-verified agent.</p>
          <a
            href="https://mandatez.mintlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            Register Your Agent
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17l9.2-9.2M17 17V7H7"/>
            </svg>
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {(agents as Agent[]).map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      <div className="border-t border-gray-800 pt-6 mt-8">
        <h3 className="text-lg font-medium mb-2">Register an Agent</h3>
        <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-4 overflow-x-auto">
{`POST /api/agents/register
Content-Type: application/json

{
  "agent_id": "ag_...",
  "owner_id": "your_org_id",
  "name": "My Agent",
  "public_key": "base64-encoded-ed25519-public-key"
}`}
        </pre>
      </div>
    </div>
  );
}

function MiniScoreArc({ score, grade }: { score: number; grade: TrustGrade }) {
  const color = GRADE_COLORS[grade];
  const r = 20;
  const circ = 2 * Math.PI * r;
  const arcFrac = (score / 100) * 0.75;
  const dash = circ * arcFrac;
  const gap = circ - dash;

  return (
    <svg width="56" height="56" viewBox="-28 -28 56 56" className="shrink-0">
      <circle cx="0" cy="0" r={r} fill="none" stroke="#1f1f1f" strokeWidth="4"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round" transform="rotate(135)" />
      <circle cx="0" cy="0" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round" transform="rotate(135)" />
      <text x="0" y="2" textAnchor="middle" dominantBaseline="middle"
        className="fill-white" style={{ fontSize: '14px', fontWeight: 700 }}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const registered = new Date(agent.created_at).toLocaleDateString();
  const grade: TrustGrade = agent.trust_grade ?? 'unverified';
  const score = agent.trust_score ?? 0;
  const events = agent.total_events ?? 0;
  const allowed = agent.allowed_ratio != null ? (agent.allowed_ratio * 100).toFixed(1) : '0.0';

  return (
    <div className="border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-4">
        <MiniScoreArc score={score} grade={grade} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/agents/${agent.id}`} className="font-medium text-gray-100 hover:underline">
              {agent.name}
            </Link>
            <TrustBadge grade={agent.trust_grade} />
          </div>
          <div className="text-xs text-gray-500 mt-0.5 font-mono">{agent.id}</div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span>{events.toLocaleString()} events</span>
            <span>{allowed}% allowed</span>
            <span>Registered {registered}</span>
          </div>
        </div>
        <Link
          href={`/agents/${agent.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </Link>
        <Link href={`/agents/${agent.id}`} className="shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function TrustBadge({ grade }: { grade: TrustGrade | null }) {
  const g = grade ?? 'unverified';
  const badge = TRUST_BADGE[g];
  const isVerified = g === 'verified';

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium ${badge.style}`}>
      {isVerified ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ) : (
        <span className="shrink-0">●</span>
      )}
      {badge.label}
    </span>
  );
}
