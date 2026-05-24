import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';
import { POLICY_PRESETS, findPreset } from '@/lib/policy-presets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGENT_ID_RE = /^ag_[A-Za-z0-9_-]+$/;

function policyId(): string {
  return `pol_${randomBytes(10).toString('hex')}`;
}

interface SavePolicyInput {
  owner_id?: string;
  preset?: string;
  name?: string;
  agent_id?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ presets: POLICY_PRESETS });
}

export async function POST(request: NextRequest) {
  let body: SavePolicyInput;
  try {
    body = (await request.json()) as SavePolicyInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const auth = await requireApiKeyAuth(request, { bodyOwnerId: body.owner_id?.trim() ?? null });
  if (!auth.ok) return auth.response;
  const ownerId = auth.ownerId;

  const preset = findPreset(body.preset);
  if (!preset) {
    return NextResponse.json(
      {
        error: `Unknown preset. Expected one of: ${POLICY_PRESETS.map((p) => p.id).join(', ')}`,
      },
      { status: 400 },
    );
  }

  const displayName = body.name?.trim() || `${preset.name} (onboarding)`;
  const id = policyId();

  const supabase = createServerClient();

  // Cross-tenant guard: if the caller specifies an agent_id, it must belong
  // to them. Otherwise an attacker could attach a policy to another tenant's
  // agent_id, polluting downstream audit/attribution surfaces. 404 (not 403)
  // mirrors the rest of the app — never confirm/deny IDs across tenants.
  const rawAgentId = body.agent_id?.trim();
  let scopedAgentId: string | null = null;
  if (rawAgentId) {
    if (!AGENT_ID_RE.test(rawAgentId)) {
      return NextResponse.json({ error: 'agent_id must match /^ag_[A-Za-z0-9_-]+$/' }, { status: 400 });
    }
    const { data: agent } = await supabase
      .from('agents')
      .select('id, owner_id')
      .eq('id', rawAgentId)
      .maybeSingle();
    if (!agent || agent.owner_id !== ownerId) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    scopedAgentId = agent.id;
  }

  const { data, error } = await supabase
    .from('policies')
    .insert({
      id,
      owner_id: ownerId,
      name: displayName,
      rules: {
        preset_id: preset.id,
        agent_id: scopedAgentId,
        rules: preset.rules,
      },
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policy: data, preset_id: preset.id });
}
