import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

const GRADE_RANK: Record<TrustGrade, number> = {
  unverified: 0,
  low: 1,
  medium: 2,
  high: 3,
  verified: 4,
};

const VALID_GRADES: TrustGrade[] = ['unverified', 'low', 'medium', 'high', 'verified'];

function isValidGrade(g: string): g is TrustGrade {
  return (VALID_GRADES as string[]).includes(g);
}

// ---------------------------------------------------------------------------
// GET — lightweight existence check (kept for backwards compatibility)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agent_id');

  if (!agentId) {
    return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 });
  }

  if (!/^ag_[A-Za-z0-9_-]+$/.test(agentId)) {
    return NextResponse.json({ error: 'Invalid agent_id format' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, owner_id, name, public_key, created_at, trust_score, trust_grade')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    return NextResponse.json(
      { verified: false, agent_id: agentId, error: 'Agent not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    verified: true,
    agent_id: agent.id,
    owner_id: agent.owner_id,
    name: agent.name,
    public_key: agent.public_key,
    trust_score: agent.trust_score ?? 0,
    trust_grade: (agent.trust_grade ?? 'unverified') as TrustGrade,
    registered_at: agent.created_at,
  });
}

// ---------------------------------------------------------------------------
// POST — agent-to-agent verification
// ---------------------------------------------------------------------------

interface VerifyRequestBody {
  requesting_agent_id?: string;
  target_agent_id?: string;
  required_min_score?: number;
  required_min_grade?: string;
}

export async function POST(request: NextRequest) {
  let body: VerifyRequestBody;
  try {
    body = (await request.json()) as VerifyRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const requestingId = body.requesting_agent_id?.trim();
  const targetId = body.target_agent_id?.trim();
  const minScore = typeof body.required_min_score === 'number' ? body.required_min_score : 60;
  const minGradeRaw = typeof body.required_min_grade === 'string' ? body.required_min_grade : 'medium';

  if (!requestingId || !targetId) {
    return NextResponse.json(
      { error: 'requesting_agent_id and target_agent_id are required' },
      { status: 400 },
    );
  }

  if (!/^ag_[A-Za-z0-9_-]+$/.test(requestingId) || !/^ag_[A-Za-z0-9_-]+$/.test(targetId)) {
    return NextResponse.json(
      { error: 'agent_id must match format ag_[A-Za-z0-9_-]+' },
      { status: 400 },
    );
  }

  if (!isValidGrade(minGradeRaw)) {
    return NextResponse.json(
      { error: `required_min_grade must be one of: ${VALID_GRADES.join(', ')}` },
      { status: 400 },
    );
  }
  const minGrade: TrustGrade = minGradeRaw;

  const supabase = createServerClient();

  const { data: rows, error } = await supabase
    .from('agents')
    .select('id, name, public_key, trust_score, trust_grade')
    .in('id', [requestingId, targetId]);

  if (error) {
    return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
  }

  const byId = new Map((rows ?? []).map((r: { id: string }) => [r.id, r]));
  const requesting = byId.get(requestingId);
  const target = byId.get(targetId);

  if (!target) {
    return NextResponse.json(
      {
        verified: false,
        error: 'Target agent not registered with MandateZ',
        target_agent_id: targetId,
      },
      { status: 404 },
    );
  }

  if (!requesting) {
    return NextResponse.json(
      {
        verified: false,
        error: 'Requesting agent not registered with MandateZ',
        requesting_agent_id: requestingId,
      },
      { status: 404 },
    );
  }

  type AgentRow = {
    id: string;
    name: string;
    public_key: string;
    trust_score: number | null;
    trust_grade: TrustGrade | null;
  };
  const req = requesting as AgentRow;
  const tgt = target as AgentRow;

  const targetScore = tgt.trust_score ?? 0;
  const targetGrade: TrustGrade = tgt.trust_grade ?? 'unverified';

  const scoreMet = targetScore >= minScore;
  const gradeMet = GRADE_RANK[targetGrade] >= GRADE_RANK[minGrade];
  const verified = scoreMet && gradeMet;

  return NextResponse.json({
    verified,
    requesting_agent: {
      id: req.id,
      name: req.name,
      trust_score: req.trust_score ?? 0,
      trust_grade: (req.trust_grade ?? 'unverified') as TrustGrade,
    },
    target_agent: {
      id: tgt.id,
      name: tgt.name,
      trust_score: targetScore,
      trust_grade: targetGrade,
      public_key: tgt.public_key,
    },
    verification: {
      score_met: scoreMet,
      grade_met: gradeMet,
      required_min_score: minScore,
      required_min_grade: minGrade,
      timestamp: new Date().toISOString(),
      verification_id: randomUUID(),
    },
  });
}