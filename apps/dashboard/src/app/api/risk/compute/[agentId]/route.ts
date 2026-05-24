import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';
import { computeRiskScore } from '@/lib/risk-score';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGENT_ID_RE = /^ag_[A-Za-z0-9_-]+$/;
const DEFAULT_WINDOW_DAYS = 30;
const MIN_WINDOW_DAYS = 1;
const MAX_WINDOW_DAYS = 365;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  if (!AGENT_ID_RE.test(agentId)) {
    return NextResponse.json({ error: 'Invalid agent_id format' }, { status: 400 });
  }

  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServerClient();

  // Tenant check — return 404 on cross-tenant access to avoid leaking
  // whether an agent_id exists under a different owner.
  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('owner_id')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent || agent.owner_id !== auth.ownerId) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  let windowDays = DEFAULT_WINDOW_DAYS;
  try {
    const body = (await request.json().catch(() => null)) as { window_days?: unknown } | null;
    if (body && typeof body.window_days === 'number' && Number.isFinite(body.window_days)) {
      windowDays = Math.floor(body.window_days);
    }
  } catch {
    // Empty body is fine — we fall through to the default.
  }

  if (windowDays < MIN_WINDOW_DAYS || windowDays > MAX_WINDOW_DAYS) {
    return NextResponse.json(
      { error: `window_days must be between ${MIN_WINDOW_DAYS} and ${MAX_WINDOW_DAYS}` },
      { status: 400 },
    );
  }

  try {
    const score = await computeRiskScore(agentId, windowDays, supabase);
    return NextResponse.json(score);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute risk score' },
      { status: 500 },
    );
  }
}
