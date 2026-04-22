import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ownerId = request.nextUrl.searchParams.get('owner_id')?.trim();
  if (!ownerId) {
    return NextResponse.json({ error: 'owner_id query param is required' }, { status: 400 });
  }

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
