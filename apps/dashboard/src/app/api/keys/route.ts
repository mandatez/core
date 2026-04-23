import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;
  const ownerId = auth.ownerId;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, key_prefix, name, last_used_at, created_at, revoked_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Failed to list keys: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ keys: data ?? [] });
}
