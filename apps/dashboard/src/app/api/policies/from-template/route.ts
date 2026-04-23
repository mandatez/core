import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { POLICY_TEMPLATES, POLICY_TEMPLATE_LIST, findTemplate } from '@mandatez/sdk';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function policyId(): string {
  return `pol_${randomBytes(10).toString('hex')}`;
}

interface FromTemplateInput {
  owner_id?: string;
  template_id?: string;
  agent_id?: string | null;
  name?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    templates: POLICY_TEMPLATE_LIST.map((t) => ({
      key: t.key,
      id: t.id,
      name: t.name,
      description: t.description,
      rule_count: t.rules.length,
      rules: t.rules,
    })),
  });
}

export async function POST(request: NextRequest) {
  let body: FromTemplateInput;
  try {
    body = (await request.json()) as FromTemplateInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const auth = await requireApiKeyAuth(request, { bodyOwnerId: body.owner_id?.trim() ?? null });
  if (!auth.ok) return auth.response;
  const ownerId = auth.ownerId;

  const templateRef = body.template_id?.trim();
  if (!templateRef) {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
  }

  const template = findTemplate(templateRef);
  if (!template) {
    const known = Object.keys(POLICY_TEMPLATES).join(', ');
    return NextResponse.json(
      { error: `Unknown template. Expected one of: ${known}` },
      { status: 400 },
    );
  }

  const agentId = body.agent_id?.trim() || null;
  const displayName = body.name?.trim() || `${template.name} policy`;
  const id = policyId();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('policies')
    .insert({
      id,
      owner_id: ownerId,
      name: displayName,
      rules: {
        template_id: template.id,
        template_key: templateRef,
        agent_id: agentId,
        rules: template.rules,
      },
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    policy: data,
    template: { id: template.id, name: template.name, rule_count: template.rules.length },
  });
}
