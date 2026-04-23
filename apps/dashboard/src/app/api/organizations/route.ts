import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[a-z0-9-]{3,48}$/;

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id')?.trim();
  if (!userId) {
    return NextResponse.json(
      { error: 'user_id query parameter is required' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  // Join members → organizations so we return each org with the caller's role.
  const { data, error } = await supabase
    .from('organization_members')
    .select(
      'role, accepted_at, organization:organizations(id, name, slug, owner_id, created_at)',
    )
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const organizations = (data ?? [])
    .filter((row) => row.organization !== null)
    .map((row) => {
      const org = row.organization as unknown as {
        id: string;
        name: string;
        slug: string;
        owner_id: string;
        created_at: string;
      };
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        owner_id: org.owner_id,
        created_at: org.created_at,
        role: row.role as string,
        accepted_at: row.accepted_at as string | null,
      };
    });

  return NextResponse.json({ organizations });
}

export async function POST(request: NextRequest) {
  let body: { name?: string; slug?: string; user_id?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.user_id?.trim();
  const name = body.name?.trim();
  const email = body.email?.trim();
  const slug = body.slug ? normalizeSlug(body.slug) : name ? normalizeSlug(name) : '';

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json(
      { error: 'email is required (the creator becomes the first admin)' },
      { status: 400 },
    );
  }
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: 'slug must be 3–48 chars, lowercase letters/digits/hyphens' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, slug, owner_id: userId })
    .select('*')
    .single();

  if (orgError) {
    if (orgError.code === '23505') {
      return NextResponse.json({ error: 'slug already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: userId,
      email,
      role: 'admin',
      invited_by: userId,
      accepted_at: new Date().toISOString(),
    });

  if (memberError) {
    // Roll back the org so we never end up with a headless organization.
    await supabase.from('organizations').delete().eq('id', org.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ organization: org, created: true });
}
