import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createServerClient } from '@/lib/supabase-server';
import { POLICY_PRESETS, findPreset } from '@/lib/policy-presets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function policyId(): string {
  return `pol_${randomBytes(10).toString('hex')}`;
}

interface SavePolicyInput {
  owner_id?: string;
  preset?: string;
  name?: string;
  agent_id?: string;
}

export async function GET() {
  return NextResponse.json({ presets: POLICY_PRESETS });
}

export async function POST(request: NextRequest) {
  let body: SavePolicyInput;
  try {
    body = (await request.json()) as SavePolicyInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ownerId = body.owner_id?.trim();
  if (!ownerId) {
    return NextResponse.json({ error: 'owner_id is required' }, { status: 400 });
  }

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
  const { data, error } = await supabase
    .from('policies')
    .insert({
      id,
      owner_id: ownerId,
      name: displayName,
      rules: {
        preset_id: preset.id,
        agent_id: body.agent_id ?? null,
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
