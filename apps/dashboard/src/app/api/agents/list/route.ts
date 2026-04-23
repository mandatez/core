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
  const { data, error, count } = await supabase
    .from('agents')
    .select('id, name, public_key, metadata, created_at', { count: 'exact' })
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    owner_id: ownerId,
    count: count ?? data?.length ?? 0,
    agents: data ?? [],
  });
}
