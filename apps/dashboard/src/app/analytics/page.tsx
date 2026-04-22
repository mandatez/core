import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Analytics — MandateZ',
  description: 'Agent behavior trends, trust score evolution, and risk distribution.',
};

const WINDOW_DAYS = 30;

type Outcome = 'allowed' | 'flagged' | 'blocked' | 'pending_approval';
type ActionType = 'read' | 'write' | 'export' | 'delete' | 'call' | 'payment';
type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

interface EventRow {
  agent_id: string;
  timestamp: string;
  action_type: ActionType | string;
  outcome: Outcome | string;
}

interface AgentRow {
  id: string;
  name: string | null;
  trust_score: number | null;
  trust_grade: TrustGrade | null;
  total_events: number | null;
  allowed_ratio: number | null;
  flagged_ratio: number | null;
  blocked_ratio: number | null;
}

const OUTCOME_COLORS: Record<Outcome, string> = {
  allowed: '#22c55e',
  flagged: '#f59e0b',
  blocked: '#ef4444',
  pending_approval: '#3b82f6',
};

const ACTION_COLORS: Record<ActionType, string> = {
  read: '#60a5fa',
  write: '#a78bfa',
  export: '#f472b6',
  delete: '#ef4444',
  call: '#34d399',
  payment: '#fbbf24',
};

const TRUST_GRADE_STYLE: Record<TrustGrade, string> = {
  unverified: 'text-gray-400 border-gray-700 bg-gray-900/40',
  low: 'text-yellow-300 border-yellow-700 bg-yellow-900/30',
  medium: 'text-blue-300 border-blue-700 bg-blue-900/30',
  high: 'text-green-300 border-green-700 bg-green-900/30',
  verified: 'text-emerald-300 border-emerald-700 bg-emerald-900/30',
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shortDay(key: string): string {
  const [, m, d] = key.split('-');
  return `${m}/${d}`;
}

function formatPercentChange(today: number, yesterday: number): { label: string; direction: 'up' | 'down' | 'flat' } {
  if (yesterday === 0) {
    if (today === 0) return { label: 'no change', direction: 'flat' };
    return { label: `+${today}`, direction: 'up' };
  }
  const pct = ((today - yesterday) / yesterday) * 100;
  if (Math.abs(pct) < 0.5) return { label: '~0%', direction: 'flat' };
  return {
    label: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
    direction: pct > 0 ? 'up' : 'down',
  };
}

export default async function AnalyticsPage() {
  const supabase = createServerClient();

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [eventsResult, agentsResult] = await Promise.all([
    supabase
      .from('agent_events')
      .select('agent_id, timestamp, action_type, outcome')
      .gte('timestamp', windowStart.toISOString())
      .order('timestamp', { ascending: true })
      .limit(20000),
    supabase
      .from('agents')
      .select('id, name, trust_score, trust_grade, total_events, allowed_ratio, flagged_ratio, blocked_ratio'),
  ]);

  const events = (eventsResult.data ?? []) as EventRow[];
  const agents = (agentsResult.data ?? []) as AgentRow[];
  const loadError = eventsResult.error?.message ?? agentsResult.error?.message ?? null;

  // --- Bucket events by day ---
  const days: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    days.push(dayKey(d));
  }

  const dailyByOutcome: Record<string, Record<Outcome, number>> = {};
  for (const k of days) {
    dailyByOutcome[k] = { allowed: 0, flagged: 0, blocked: 0, pending_approval: 0 };
  }

  for (const e of events) {
    const k = dayKey(new Date(e.timestamp));
    if (!dailyByOutcome[k]) continue;
    const outcome = (e.outcome as Outcome) in OUTCOME_COLORS ? (e.outcome as Outcome) : null;
    if (outcome) dailyByOutcome[k][outcome] += 1;
  }

  const dailyTotals = days.map((k) => {
    const bucket = dailyByOutcome[k];
    return bucket.allowed + bucket.flagged + bucket.blocked + bucket.pending_approval;
  });
  const maxDaily = Math.max(1, ...dailyTotals);

  // --- Summary stats: today vs yesterday ---
  const todayKey = days[days.length - 1];
  const yesterdayKey = days[days.length - 2];
  const todayCount = dailyTotals[dailyTotals.length - 1];
  const yesterdayCount = yesterdayKey ? dailyTotals[dailyTotals.length - 2] : 0;
  const dayDelta = formatPercentChange(todayCount, yesterdayCount);

  // --- Block rate this week ---
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let weekTotal = 0;
  let weekBlocked = 0;
  for (const e of events) {
    if (new Date(e.timestamp) < weekStart) continue;
    weekTotal += 1;
    if (e.outcome === 'blocked') weekBlocked += 1;
  }
  const weekBlockRate = weekTotal === 0 ? 0 : (weekBlocked / weekTotal) * 100;

  // --- Grade counts ---
  const verifiedCount = agents.filter((a) => a.trust_grade === 'verified').length;
  const attentionCount = agents.filter(
    (a) => a.trust_grade === 'low' || a.trust_grade === 'unverified' || a.trust_grade == null,
  ).length;

  // --- Action type distribution ---
  const actionCounts: Partial<Record<ActionType, number>> = {};
  for (const e of events) {
    const t = e.action_type as ActionType;
    actionCounts[t] = (actionCounts[t] ?? 0) + 1;
  }
  const totalActions = Object.values(actionCounts).reduce((sum, n) => sum + (n ?? 0), 0);

  // --- Trust trend: top 5 most active agents, daily allowed ratio ---
  const perAgentPerDay: Record<string, Record<string, { allowed: number; total: number }>> = {};
  for (const e of events) {
    const k = dayKey(new Date(e.timestamp));
    if (!dailyByOutcome[k]) continue;
    if (!perAgentPerDay[e.agent_id]) perAgentPerDay[e.agent_id] = {};
    if (!perAgentPerDay[e.agent_id][k]) perAgentPerDay[e.agent_id][k] = { allowed: 0, total: 0 };
    perAgentPerDay[e.agent_id][k].total += 1;
    if (e.outcome === 'allowed') perAgentPerDay[e.agent_id][k].allowed += 1;
  }

  const agentActivity = Object.entries(perAgentPerDay)
    .map(([agentId, perDay]) => ({
      agentId,
      total: Object.values(perDay).reduce((s, d) => s + d.total, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const trustTrendSeries = agentActivity.map((entry) => {
    const agent = agents.find((a) => a.id === entry.agentId);
    const points = days.map((k, i) => {
      const d = perAgentPerDay[entry.agentId]?.[k];
      const value = d && d.total > 0 ? Math.round((d.allowed / d.total) * 100) : null;
      return { x: i, y: value };
    });
    return {
      agentId: entry.agentId,
      label: agent?.name ?? entry.agentId,
      points,
    };
  });

  // --- Top risk agents ---
  const topRisk = [...agents]
    .filter((a) => (a.total_events ?? 0) > 0)
    .sort((a, b) => (b.blocked_ratio ?? 0) - (a.blocked_ratio ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold">Analytics</h2>
        <p className="text-gray-400 mt-1">
          Agent behavior over the last {WINDOW_DAYS} days. Data derived from the signed event stream.
        </p>
      </div>

      {loadError && (
        <div className="text-red-400 border border-red-800 rounded-lg p-4 text-sm">
          Failed to load analytics data: {loadError}
        </div>
      )}

      {/* --- Summary stats --- */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Events today"
          value={todayCount.toLocaleString()}
          hint={`vs. ${yesterdayCount.toLocaleString()} yesterday (${dayDelta.label})`}
          accent={dayDelta.direction === 'up' ? 'green' : dayDelta.direction === 'down' ? 'red' : 'gray'}
        />
        <StatCard
          label="Verified agents"
          value={verifiedCount.toString()}
          hint={`of ${agents.length} total`}
          accent="emerald"
        />
        <StatCard
          label="Needs attention"
          value={attentionCount.toString()}
          hint="agents at low / unverified grade"
          accent={attentionCount > 0 ? 'amber' : 'gray'}
        />
        <StatCard
          label="Block rate (7d)"
          value={`${weekBlockRate.toFixed(1)}%`}
          hint={`${weekBlocked.toLocaleString()} of ${weekTotal.toLocaleString()} events blocked`}
          accent={weekBlockRate > 5 ? 'red' : 'gray'}
        />
      </section>

      {/* --- Events over time --- */}
      <section>
        <SectionHeader
          title="Events over time"
          subtitle={`Last ${WINDOW_DAYS} days · stacked by outcome`}
        />
        <div className="border border-gray-800 rounded-lg p-5">
          {events.length === 0 ? (
            <EmptyState label="No events in the last 30 days." />
          ) : (
            <>
              <EventsOverTimeChart
                days={days}
                buckets={dailyByOutcome}
                maxDaily={maxDaily}
              />
              <div className="flex items-center gap-5 mt-4 text-xs text-gray-400">
                <LegendDot color={OUTCOME_COLORS.allowed} label="allowed" />
                <LegendDot color={OUTCOME_COLORS.flagged} label="flagged" />
                <LegendDot color={OUTCOME_COLORS.blocked} label="blocked" />
                <LegendDot color={OUTCOME_COLORS.pending_approval} label="pending" />
              </div>
            </>
          )}
        </div>
      </section>

      {/* --- Trust score trend + Action distribution side by side --- */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SectionHeader
            title="Trust indicator per agent"
            subtitle="Daily allowed ratio for the 5 most active agents"
          />
          <div className="border border-gray-800 rounded-lg p-5 h-full">
            {trustTrendSeries.length === 0 ? (
              <EmptyState label="No agent activity to trend." />
            ) : (
              <TrustTrendChart series={trustTrendSeries} days={days} />
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionHeader
            title="Action type mix"
            subtitle={`${totalActions.toLocaleString()} events in window`}
          />
          <div className="border border-gray-800 rounded-lg p-5 h-full">
            {totalActions === 0 ? (
              <EmptyState label="No events." />
            ) : (
              <ActionDonut counts={actionCounts} total={totalActions} />
            )}
          </div>
        </div>
      </section>

      {/* --- Top risk agents --- */}
      <section>
        <SectionHeader
          title="Top agents by block rate"
          subtitle="Sorted by policy-blocked ratio — these agents need attention"
        />
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          {topRisk.length === 0 ? (
            <div className="p-5">
              <EmptyState label="No agents with recorded events yet." />
            </div>
          ) : (
            <TopRiskTable rows={topRisk} />
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart components (inline SVG / CSS, no dependencies)
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: 'green' | 'red' | 'amber' | 'emerald' | 'gray';
}) {
  const accentMap: Record<typeof accent, string> = {
    green: 'text-green-300',
    red: 'text-red-300',
    amber: 'text-yellow-300',
    emerald: 'text-emerald-300',
    gray: 'text-gray-200',
  };
  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`text-3xl font-semibold mt-1 tabular-nums ${accentMap[accent]}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{hint}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-sm text-gray-500 text-center py-10 border border-dashed border-gray-800 rounded">
      {label}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function EventsOverTimeChart({
  days,
  buckets,
  maxDaily,
}: {
  days: string[];
  buckets: Record<string, Record<Outcome, number>>;
  maxDaily: number;
}) {
  const chartHeight = 180;
  const barWidth = 100 / days.length;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${chartHeight}`}
        preserveAspectRatio="none"
        className="w-full h-48"
        role="img"
        aria-label="Events stacked bar chart over last 30 days"
      >
        {/* Y axis gridlines at 25/50/75/100% */}
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={0}
            x2={100}
            y1={chartHeight - p * chartHeight}
            y2={chartHeight - p * chartHeight}
            stroke="#1f2937"
            strokeWidth={0.2}
          />
        ))}
        {days.map((k, i) => {
          const b = buckets[k];
          const total = b.allowed + b.flagged + b.blocked + b.pending_approval;
          if (total === 0) return null;
          const barHeight = (total / maxDaily) * chartHeight;
          let yOffset = chartHeight - barHeight;
          const segments: Array<[Outcome, number]> = [
            ['allowed', b.allowed],
            ['pending_approval', b.pending_approval],
            ['flagged', b.flagged],
            ['blocked', b.blocked],
          ];
          const x = i * barWidth + barWidth * 0.15;
          const w = barWidth * 0.7;
          return (
            <g key={k}>
              {segments.map(([outcome, count]) => {
                if (count === 0) return null;
                const segH = (count / total) * barHeight;
                const rect = (
                  <rect
                    key={outcome}
                    x={x}
                    y={yOffset}
                    width={w}
                    height={segH}
                    fill={OUTCOME_COLORS[outcome]}
                  >
                    <title>{`${shortDay(k)} · ${outcome}: ${count}`}</title>
                  </rect>
                );
                yOffset += segH;
                return rect;
              })}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1 tabular-nums">
        <span>{shortDay(days[0])}</span>
        <span>{shortDay(days[Math.floor(days.length / 2)])}</span>
        <span>{shortDay(days[days.length - 1])}</span>
      </div>
    </div>
  );
}

function TrustTrendChart({
  series,
  days,
}: {
  series: Array<{ agentId: string; label: string; points: Array<{ x: number; y: number | null }> }>;
  days: string[];
}) {
  const chartHeight = 180;
  const palette = ['#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#fbbf24'];
  const lastIdx = days.length - 1;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${chartHeight}`}
        preserveAspectRatio="none"
        className="w-full h-48"
        role="img"
        aria-label="Trust indicator line chart per agent"
      >
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={0}
            x2={100}
            y1={chartHeight - p * chartHeight}
            y2={chartHeight - p * chartHeight}
            stroke="#1f2937"
            strokeWidth={0.2}
            strokeDasharray="0.5 0.8"
          />
        ))}
        {series.map((s, i) => {
          const color = palette[i % palette.length];
          const segments: string[] = [];
          let current: string[] = [];
          for (const p of s.points) {
            if (p.y == null) {
              if (current.length) segments.push(current.join(' '));
              current = [];
              continue;
            }
            const x = lastIdx === 0 ? 0 : (p.x / lastIdx) * 100;
            const y = chartHeight - (p.y / 100) * chartHeight;
            current.push(`${current.length === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
          }
          if (current.length) segments.push(current.join(' '));
          return segments.map((d, j) => (
            <path
              key={`${s.agentId}-${j}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
          ));
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1 tabular-nums">
        <span>{shortDay(days[0])}</span>
        <span>{shortDay(days[days.length - 1])}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
        {series.map((s, i) => (
          <span key={s.agentId} className="inline-flex items-center gap-1.5 text-gray-400">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: palette[i % palette.length] }}
            />
            <span className="font-mono truncate max-w-[160px]">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ActionDonut({
  counts,
  total,
}: {
  counts: Partial<Record<ActionType, number>>;
  total: number;
}) {
  const ordered: ActionType[] = ['read', 'write', 'export', 'delete', 'call', 'payment'];
  const entries = ordered
    .map((k) => ({ key: k, value: counts[k] ?? 0 }))
    .filter((e) => e.value > 0);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-40 h-40 -rotate-90" aria-label="Action type distribution">
        <circle cx={50} cy={50} r={radius} fill="transparent" stroke="#1f2937" strokeWidth={14} />
        {entries.map((e) => {
          const fraction = e.value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const el = (
            <circle
              key={e.key}
              cx={50}
              cy={50}
              r={radius}
              fill="transparent"
              stroke={ACTION_COLORS[e.key]}
              strokeWidth={14}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
            >
              <title>{`${e.key}: ${e.value} (${(fraction * 100).toFixed(1)}%)`}</title>
            </circle>
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="w-full space-y-1.5 text-xs">
        {entries.map((e) => (
          <div key={e.key} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-gray-300">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: ACTION_COLORS[e.key] }}
              />
              {e.key}
            </span>
            <span className="tabular-nums text-gray-400">
              {e.value.toLocaleString()}{' '}
              <span className="text-gray-600">({((e.value / total) * 100).toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopRiskTable({ rows }: { rows: AgentRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-950/60 text-xs uppercase tracking-wider text-gray-500">
        <tr>
          <th className="text-left px-4 py-2 font-medium">Agent</th>
          <th className="text-left px-4 py-2 font-medium">Grade</th>
          <th className="text-right px-4 py-2 font-medium">Events</th>
          <th className="px-4 py-2 font-medium">Block / Flag / Allow</th>
          <th className="text-right px-4 py-2 font-medium">Block rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((agent) => {
          const grade = (agent.trust_grade ?? 'unverified') as TrustGrade;
          const blocked = agent.blocked_ratio ?? 0;
          const flagged = agent.flagged_ratio ?? 0;
          const allowed = agent.allowed_ratio ?? 0;
          return (
            <tr key={agent.id} className="border-t border-gray-800">
              <td className="px-4 py-2.5">
                <div className="text-gray-200 truncate max-w-[280px]">
                  {agent.name ?? '(unnamed)'}
                </div>
                <div className="font-mono text-xs text-gray-500 truncate max-w-[280px]">
                  {agent.id}
                </div>
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded ${TRUST_GRADE_STYLE[grade]}`}
                >
                  {grade}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
                {(agent.total_events ?? 0).toLocaleString()}
              </td>
              <td className="px-4 py-2.5">
                <RatioBar blocked={blocked} flagged={flagged} allowed={allowed} />
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                <span
                  className={
                    blocked > 0.1
                      ? 'text-red-300'
                      : blocked > 0.02
                        ? 'text-yellow-300'
                        : 'text-gray-400'
                  }
                >
                  {(blocked * 100).toFixed(1)}%
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RatioBar({
  allowed,
  flagged,
  blocked,
}: {
  allowed: number;
  flagged: number;
  blocked: number;
}) {
  const total = allowed + flagged + blocked;
  if (total === 0) {
    return <div className="h-2 bg-gray-800 rounded" />;
  }
  const a = (allowed / total) * 100;
  const f = (flagged / total) * 100;
  const b = (blocked / total) * 100;
  return (
    <div className="flex h-2 rounded overflow-hidden bg-gray-800 min-w-[140px]">
      <span
        style={{ width: `${b}%`, backgroundColor: OUTCOME_COLORS.blocked }}
        title={`blocked ${(blocked * 100).toFixed(1)}%`}
      />
      <span
        style={{ width: `${f}%`, backgroundColor: OUTCOME_COLORS.flagged }}
        title={`flagged ${(flagged * 100).toFixed(1)}%`}
      />
      <span
        style={{ width: `${a}%`, backgroundColor: OUTCOME_COLORS.allowed }}
        title={`allowed ${(allowed * 100).toFixed(1)}%`}
      />
    </div>
  );
}
