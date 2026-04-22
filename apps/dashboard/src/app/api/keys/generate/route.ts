import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { generateApiKey } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GenerateRequest {
  owner_id?: string;
  name?: string;
}

export async function POST(request: NextRequest) {
  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ownerId = body.owner_id?.trim();
  const name = body.name?.trim();

  if (!ownerId) {
    return NextResponse.json({ error: 'owner_id is required' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: 'name must be 100 characters or fewer' }, { status: 400 });
  }

  const { plaintext, hash, prefix } = generateApiKey();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      owner_id: ownerId,
      key_hash: hash,
      key_prefix: prefix,
      name,
    })
    .select('id, key_prefix, name, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Failed to create key: ${error?.message ?? 'unknown error'}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      id: data.id,
      key: plaintext,        // plaintext returned exactly once
      prefix: data.key_prefix,
      name: data.name,
      created_at: data.created_at,
      warning: 'Copy this key now — it will not be shown again. Store it in your secret manager.',
    },
    { status: 201 },
  );
}
