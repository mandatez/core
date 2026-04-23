import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';
import { generateAgentIdentity } from '@mandatez/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FRAMEWORKS = [
  'LangChain',
  'n8n',
  'CrewAI',
  'AutoGen',
  'OpenAI SDK',
  'Other',
] as const;
type Framework = (typeof FRAMEWORKS)[number];

const ENVIRONMENTS = ['production', 'staging', 'development'] as const;
type Environment = (typeof ENVIRONMENTS)[number];

interface RegisterInput {
  owner_id?: string;
  name?: string;
  framework?: string;
  environment?: string;
}

function normalizeFramework(value: unknown): Framework {
  if (typeof value === 'string' && (FRAMEWORKS as readonly string[]).includes(value)) {
    return value as Framework;
  }
  return 'Other';
}

function normalizeEnvironment(value: unknown): Environment {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if ((ENVIRONMENTS as readonly string[]).includes(lower)) {
      return lower as Environment;
    }
  }
  return 'development';
}

export async function POST(request: NextRequest) {
  let body: RegisterInput;
  try {
    body = (await request.json()) as RegisterInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const auth = await requireApiKeyAuth(request, { bodyOwnerId: body.owner_id?.trim() ?? null });
  if (!auth.ok) return auth.response;
  const ownerId = auth.ownerId;

  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json(
      { error: 'name must be 80 characters or fewer' },
      { status: 400 },
    );
  }

  const framework = normalizeFramework(body.framework);
  const environment = normalizeEnvironment(body.environment);

  const identity = await generateAgentIdentity();

  const supabase = createServerClient();
  const { error } = await supabase.from('agents').insert({
    id: identity.agent_id,
    owner_id: ownerId,
    name,
    public_key: identity.public_key,
    metadata: { framework, environment, registered_via: 'onboarding' },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Private key is returned once, never stored server-side.
  return NextResponse.json({
    agent_id: identity.agent_id,
    owner_id: ownerId,
    name,
    framework,
    environment,
    public_key: identity.public_key,
    private_key: identity.private_key,
    created_at: new Date().toISOString(),
  });
}
