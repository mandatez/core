import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid key id' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: existing, error: fetchErr } = await supabase
    .from('api_keys')
    .select('id, revoked_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }
  if (existing.revoked_at) {
    return NextResponse.json(
      { error: 'Key already revoked', revoked_at: existing.revoked_at },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('api_keys')
    .update({ revoked_at: nowIso })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: `Failed to revoke: ${updateErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ revoked: true, id, revoked_at: nowIso });
}
