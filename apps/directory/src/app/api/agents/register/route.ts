import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { z } from 'zod';

const RegisterSchema = z.object({
  agent_id: z.string().regex(/^ag_[A-Za-z0-9_-]+$/, 'agent_id must start with ag_ prefix'),
  owner_id: z.string().min(1, 'owner_id is required'),
  name: z.string().min(1, 'name is required'),
  public_key: z.string().min(1, 'public_key is required'),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { agent_id, owner_id, name, public_key } = parsed.data;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('agents')
    .insert({ id: agent_id, owner_id, name, public_key })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Agent already registered', agent_id },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agent: data }, { status: 201 });
}
