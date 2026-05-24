import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';
import { createAttestation } from '@/lib/attestations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGENT_ID_RE = /^ag_[A-Za-z0-9_-]+$/;
const DEFAULT_WINDOW_DAYS = 30;

interface CreateAttestationBody {
  agentId?: string;
  windowStart?: string;
  windowEnd?: string;
}

function parseIsoDate(value: unknown, fallback: Date): { date: Date } | { error: string } {
  if (value === undefined || value === null) return { date: fallback };
  if (typeof value !== 'string') return { error: 'must be an ISO 8601 string' };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: 'invalid ISO 8601 timestamp' };
  return { date: d };
}

export async function POST(request: NextRequest) {
  let body: CreateAttestationBody;
  try {
    body = (await request.json()) as CreateAttestationBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;

  const agentId = body.agentId?.trim();
  if (!agentId || !AGENT_ID_RE.test(agentId)) {
    return NextResponse.json({ error: 'agentId is required and must start with ag_' }, { status: 400 });
  }

  const now = new Date();
  const defaultStart = new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const windowEndOrErr = parseIsoDate(body.windowEnd, now);
  if ('error' in windowEndOrErr) {
    return NextResponse.json({ error: `windowEnd ${windowEndOrErr.error}` }, { status: 400 });
  }
  const windowStartOrErr = parseIsoDate(body.windowStart, defaultStart);
  if ('error' in windowStartOrErr) {
    return NextResponse.json({ error: `windowStart ${windowStartOrErr.error}` }, { status: 400 });
  }
  const windowEnd = windowEndOrErr.date;
  const windowStart = windowStartOrErr.date;

  if (windowEnd.getTime() <= windowStart.getTime()) {
    return NextResponse.json(
      { error: 'windowEnd must be strictly after windowStart' },
      { status: 400 },
    );
  }

  // Ownership check — only the agent's owner may issue attestations for it.
  // Mirrors the 404-on-mismatch pattern from /api/agents/[id]/revoke so we
  // never reveal whether an agent id exists across tenants.
  const supabase = createServerClient();
  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('id, owner_id')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent || agent.owner_id !== auth.ownerId) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const attestation = await createAttestation(agentId, windowStart, windowEnd);
    return NextResponse.json(attestation, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
