import { createServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ShareButton } from './share-button';

export const dynamic = 'force-dynamic';

type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

const GRADE_COLORS: Record<TrustGrade, { text: string; bg: string; border: string; hex: string }> = {
  verified:   { text: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700', hex: '#10b981' },
  high:       { text: 'text-blue-400',    bg: 'bg-blue-900/30',    border: 'border-blue-700',    hex: '#3b82f6' },
  medium:     { text: 'text-indigo-400',  bg: 'bg-indigo-900/30',  border: 'border-indigo-700',  hex: '#6366f1' },
  low:        { text: 'text-amber-400',   bg: 'bg-amber-900/30',   border: 'border-amber-700',   hex: '#f59e0b' },
  unverified: { text: 'text-gray-400',    bg: 'bg-gray-800/30',    border: 'border-gray-700',    hex: '#6b7280' },
};

const GRADE_LABELS: Record<TrustGrade, string> = {
  verified: 'Verified',
  high: 'High Trust',
  medium: 'Medium Trust',
  low: 'Low Trust',
  unverified: 'Unverified',
};

interface AgentData {
  id: string;
  name: string;
  owner_id: string;
  public_key: string;
  created_at: string;
  trust_score: number | null;
  trust_grade: TrustGrade | null;
  total_events: number | null;
  allowed_ratio: number | null;
  flagged_ratio: number | null;
  blocked_ratio: number | null;
  human_approvals: number | null;
  human_rejections: number | null;
  first_seen: string | null;
  last_active: string | null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ agent_id: string }> },
): Promise<Metadata> {
  const { agent_id } = await params;
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://core-dashboard.vercel.app';

  return {
    title: `Agent ${agent_id} — MandateZ Trust Profile`,
    openGraph: {
      title: `Agent Trust Profile — MandateZ`,
      images: [`${dashboardUrl}/api/trust-card/${agent_id}`],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`${dashboardUrl}/api/trust-card/${agent_id}`],
    },
  };
}

function daysBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return Math.floor(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = (score / 100) * 0.75;
  const dashLen = circumference * arcFraction;
  const gapLen = circumference - dashLen;

  return (
    <svg width="200" height="200" viewBox="-100 -100 200 200" className="mx-auto">
      {/* Background arc */}
      <circle cx="0" cy="0" r={radius} fill="none" stroke="#1f1f1f" strokeWidth="10"
        strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
        strokeDashoffset={circumference * 0.25}
        strokeLinecap="round"
        transform="rotate(135)" />
      {/* Score arc */}
      <circle cx="0" cy="0" r={radius} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dashLen} ${gapLen}`}
        strokeDashoffset={circumference * 0.25}
        strokeLinecap="round"
        transform="rotate(135)"
        style={{ filter: `drop-shadow(0 0 6px ${color}40)` }} />
      {/* Score text */}
      <text x="0" y="5" textAnchor="middle" dominantBaseline="middle"
        className="fill-white text-6xl font-extrabold" style={{ fontSize: '64px', fontWeight: 800 }}>
        {Math.round(score)}
      </text>
      <text x="0" y="35" textAnchor="middle" className="fill-gray-500 text-sm" style={{ fontSize: '13px' }}>
        out of 100
      </text>
    </svg>
  );
}

function ComponentScore({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400 font-mono">{score.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default async function AgentProfilePage(
  { params }: { params: Promise<{ agent_id: string }> },
) {
  const { agent_id } = await params;
  const supabase = createServerClient();

  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agent_id)
    .single();

  if (error || !agent) notFound();

  const a = agent as AgentData;
  const grade: TrustGrade = a.trust_grade ?? 'unverified';
  const colors = GRADE_COLORS[grade];
  const score = a.trust_score ?? 0;
  const totalEvents = a.total_events ?? 0;
  const allowedRatio = a.allowed_ratio ?? 0;
  const flaggedRatio = a.flagged_ratio ?? 0;
  const blockedRatio = a.blocked_ratio ?? 0;
  const approvals = a.human_approvals ?? 0;
  const rejections = a.human_rejections ?? 0;
  const activeDays = daysBetween(a.first_seen, a.last_active);

  // Recompute component scores for display
  const behavioralScore = allowedRatio * 40;
  const longevityScore = Math.min(activeDays / 90, 1) * 20;
  const oversightScore = (approvals / (approvals + rejections + 1)) * 25;
  const complianceScore = (1 - blockedRatio - flaggedRatio * 0.5) * 15;

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://core-dashboard.vercel.app';
  const directoryUrl = process.env.NEXT_PUBLIC_DIRECTORY_URL ?? 'https://core-directory.vercel.app';
  const cardUrl = `${dashboardUrl}/api/trust-card/${a.id}`;
  const profileUrl = `${directoryUrl}/agents/${a.id}`;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="text-center space-y-4 pt-4">
        <div className="flex items-center justify-center gap-3">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-900/40 text-blue-300 text-lg font-bold">
            {a.name.charAt(0).toUpperCase()}
          </span>
          <div className="text-left">
            <h1 className="text-2xl font-bold text-white">{a.name}</h1>
            <p className="text-sm text-gray-500 font-mono">{a.id}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-sm font-semibold ${colors.text} ${colors.bg} ${colors.border}`}>
          {grade === 'verified' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          )}
          {GRADE_LABELS[grade]}
        </span>
      </div>

      {/* Score gauge */}
      <div className="flex justify-center">
        <ScoreGauge score={score} color={colors.hex} />
      </div>

      {/* Component scores */}
      <div className="border border-gray-800 rounded-lg p-6 space-y-5">
        <h3 className="text-lg font-semibold text-white">Score Breakdown</h3>
        <ComponentScore label="Behavioral History" score={behavioralScore} max={40} color="#10b981" />
        <ComponentScore label="Longevity" score={longevityScore} max={20} color="#3b82f6" />
        <ComponentScore label="Human Oversight" score={oversightScore} max={25} color="#8b5cf6" />
        <ComponentScore label="Policy Compliance" score={complianceScore} max={15} color="#f59e0b" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{totalEvents.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Events Logged</div>
        </div>
        <div className="border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{(allowedRatio * 100).toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">Allowed</div>
        </div>
        <div className="border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{activeDays}</div>
          <div className="text-xs text-gray-500 mt-1">Active Days</div>
        </div>
        <div className="border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{approvals}</div>
          <div className="text-xs text-gray-500 mt-1">Human Approvals</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Timeline</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">First seen</span>
            <p className="text-gray-200 font-mono mt-0.5">
              {a.first_seen ? new Date(a.first_seen).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Last active</span>
            <p className="text-gray-200 font-mono mt-0.5">
              {a.last_active ? new Date(a.last_active).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Registered</span>
            <p className="text-gray-200 font-mono mt-0.5">
              {new Date(a.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Owner</span>
            <p className="text-gray-200 font-mono mt-0.5 truncate">{a.owner_id}</p>
          </div>
        </div>
      </div>

      {/* Trust card preview + share */}
      <div className="border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Share This Agent</h3>
        <div className="rounded-lg overflow-hidden border border-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardUrl}
            alt={`MandateZ Trust Score for ${a.name}`}
            width={600}
            height={315}
            className="w-full"
          />
        </div>
        <ShareButton cardUrl={cardUrl} profileUrl={profileUrl} agentId={a.id} />
      </div>
    </div>
  );
}
