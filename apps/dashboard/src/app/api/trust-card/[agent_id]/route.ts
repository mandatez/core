import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

const GRADE_COLORS: Record<TrustGrade, string> = {
  verified: '#10b981',
  high: '#3b82f6',
  medium: '#6366f1',
  low: '#f59e0b',
  unverified: '#6b7280',
};

const GRADE_LABELS: Record<TrustGrade, string> = {
  verified: 'VERIFIED',
  high: 'HIGH TRUST',
  medium: 'MEDIUM TRUST',
  low: 'LOW TRUST',
  unverified: 'UNVERIFIED',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function daysBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const ms = Math.abs(new Date(b).getTime() - new Date(a).getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function generateSvg(agent: {
  name: string;
  id: string;
  trust_score: number;
  trust_grade: TrustGrade;
  total_events: number;
  allowed_ratio: number;
  first_seen: string | null;
  last_active: string | null;
}): string {
  const grade = agent.trust_grade ?? 'unverified';
  const color = GRADE_COLORS[grade];
  const label = GRADE_LABELS[grade];
  const score = Math.round(agent.trust_score ?? 0);
  const activeDays = daysBetween(agent.first_seen, agent.last_active);
  const allowedPct = ((agent.allowed_ratio ?? 0) * 100).toFixed(1);
  const eventsFormatted = formatNumber(agent.total_events ?? 0);
  const name = escapeXml(agent.name);
  const agentId = escapeXml(agent.id);

  // Score arc (270 degrees max)
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = (score / 100) * 0.75; // 270 degrees = 0.75 of circle
  const dashLen = circumference * arcFraction;
  const gapLen = circumference - dashLen;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#111111"/>
    </linearGradient>
    <linearGradient id="scoreGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" rx="16"/>
  <rect width="1200" height="630" fill="none" stroke="#1f1f1f" stroke-width="1" rx="16"/>

  <!-- Subtle grid pattern -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <rect width="40" height="40" fill="none"/>
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-opacity="0.02" stroke-width="0.5"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#grid)" rx="16"/>

  <!-- Top left: MandateZ wordmark -->
  <text x="60" y="60" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="800" fill="#ffffff" letter-spacing="-0.5">
    Mandate<tspan fill="#60a5fa">Z</tspan>
  </text>
  <text x="60" y="82" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#6b7280" letter-spacing="0.5">TRUST SCORE CARD</text>

  <!-- Score circle area -->
  <g transform="translate(600, 250)">
    <!-- Background arc -->
    <circle cx="0" cy="0" r="${radius}" fill="none" stroke="#1f1f1f" stroke-width="8"
      stroke-dasharray="${circumference * 0.75} ${circumference * 0.25}"
      stroke-dashoffset="${circumference * 0.25}"
      stroke-linecap="round"
      transform="rotate(135)"/>

    <!-- Score arc -->
    <circle cx="0" cy="0" r="${radius}" fill="none" stroke="${color}" stroke-width="8"
      stroke-dasharray="${dashLen} ${gapLen}"
      stroke-dashoffset="${circumference * 0.25}"
      stroke-linecap="round"
      transform="rotate(135)"
      filter="url(#glow)"/>

    <!-- Score number -->
    <text x="0" y="8" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${score}</text>
    <text x="0" y="38" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">out of 100</text>
  </g>

  <!-- Grade badge -->
  <g transform="translate(600, 360)">
    <rect x="${-label.length * 7 - 20}" y="-14" width="${label.length * 14 + 40}" height="28" rx="14" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1" stroke-opacity="0.4"/>
    ${grade === 'verified' ? `<path d="M${-label.length * 7 - 4} 0 l-3-3 l6 0 l-3 3z" fill="none"/>
    <g transform="translate(${-label.length * 7 - 6}, -7)">
      <path d="M7 0.5l-4.6 2.4L3 7.4l-3-2.6L-3.5 5 -2 1.2 -4.6-2.4l4.6-.4L7-7l2 4.2 4.6.4-3.4 3.2.8 4.6z" fill="${color}" transform="scale(0.7)"/>
    </g>` : ''}
    <text x="0" y="5" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="2">${label}</text>
  </g>

  <!-- Agent name -->
  <text x="600" y="410" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" fill="#ffffff" text-anchor="middle">${name}</text>
  <text x="600" y="435" font-family="system-ui, -apple-system, monospace" font-size="13" fill="#4b5563" text-anchor="middle">${agentId}</text>

  <!-- Three stats -->
  <g transform="translate(0, 490)">
    <!-- Events logged -->
    <g transform="translate(280, 0)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff" text-anchor="middle">${eventsFormatted}</text>
      <text x="0" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#6b7280" text-anchor="middle">events logged</text>
    </g>

    <!-- Allowed ratio -->
    <g transform="translate(600, 0)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff" text-anchor="middle">${allowedPct}%</text>
      <text x="0" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#6b7280" text-anchor="middle">allowed</text>
    </g>

    <!-- Active days -->
    <g transform="translate(920, 0)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff" text-anchor="middle">${activeDays}</text>
      <text x="0" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#6b7280" text-anchor="middle">active days</text>
    </g>
  </g>

  <!-- Divider line above stats -->
  <line x1="180" y1="460" x2="1020" y2="460" stroke="#1f1f1f" stroke-width="1"/>

  <!-- Bottom: URL -->
  <text x="600" y="590" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#374151" text-anchor="middle" letter-spacing="0.5">mandatez.com</text>

  <!-- Bottom right: timestamp -->
  <text x="1140" y="590" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#374151" text-anchor="end">${new Date().toISOString().split('T')[0]}</text>
</svg>`;
}

// Intentionally public: trust-card SVGs are meant to be embedded in READMEs,
// blog posts, and agent directory profiles. Requiring an API key here would
// break the shareable-badge use case. The endpoint exposes only non-secret
// trust-score data that is also visible in the public agent directory.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agent_id: string }> },
) {
  const { agent_id } = await params;

  if (!agent_id || !agent_id.startsWith('ag_')) {
    return NextResponse.json({ error: 'Invalid agent_id' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, name, trust_score, trust_grade, total_events, allowed_ratio, first_seen, last_active')
    .eq('id', agent_id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const svg = generateSvg({
    name: agent.name,
    id: agent.id,
    trust_score: agent.trust_score ?? 0,
    trust_grade: (agent.trust_grade as TrustGrade) ?? 'unverified',
    total_events: agent.total_events ?? 0,
    allowed_ratio: agent.allowed_ratio ?? 0,
    first_seen: agent.first_seen,
    last_active: agent.last_active,
  });

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
