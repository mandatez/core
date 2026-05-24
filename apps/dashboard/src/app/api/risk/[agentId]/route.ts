import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';
import { computeRiskScore, getLatestRiskScore } from '@/lib/risk-score';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGENT_ID_RE = /^ag_[A-Za-z0-9_-]+$/;

export async function GET(
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

  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('owner_id')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent || agent.owner_id !== auth.ownerId) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const existing = await getLatestRiskScore(agentId, supabase);
    if (existing) {
      return NextResponse.json(existing);
    }

    // No score recorded yet — auto-compute one.
    const fresh = await computeRiskScore(agentId, 30, supabase);
    return NextResponse.json(fresh);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load risk score' },
      { status: 500 },
    );
  }
}
