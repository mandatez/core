import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ownerId = request.nextUrl.searchParams.get('owner_id')?.trim();
  if (!ownerId) {
    return NextResponse.json(
      { error: 'owner_id query parameter is required' },
      { status: 400 },
    );
  }

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
