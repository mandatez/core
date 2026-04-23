import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { rbacErrorResponse, requireRole, RbacError } from '@/lib/rbac';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = request.nextUrl.searchParams.get('user_id')?.trim();

  if (!userId) {
    return NextResponse.json(
      { error: 'user_id query parameter is required' },
      { status: 400 },
    );
  }

  try {
    await requireRole(userId, id, ['admin', 'security_analyst', 'viewer']);
  } catch (err) {
    const { body, status } = rbacErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const supabase = createServerClient();

  const [orgResult, membersResult] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', id).single(),
    supabase
      .from('organization_members')
      .select('id, user_id, email, role, invited_by, invited_at, accepted_at')
      .eq('organization_id', id)
      .order('invited_at', { ascending: true }),
  ]);

  if (orgResult.error) {
    return NextResponse.json({ error: orgResult.error.message }, { status: 500 });
  }
  if (membersResult.error) {
    return NextResponse.json({ error: membersResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    organization: orgResult.data,
    members: membersResult.data ?? [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { user_id?: string; name?: string; slug?: string; transfer_to_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.user_id?.trim();
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    await requireRole(userId, id, ['admin']);
  } catch (err) {
    const { body: errBody, status } = rbacErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.slug !== undefined) {
    const slug = normalizeSlug(body.slug);
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        { error: 'slug must be 3–48 chars, lowercase letters/digits/hyphens' },
        { status: 400 },
      );
    }
    updates.slug = slug;
  }

  // Transfer ownership — new owner must already be a member.
  if (body.transfer_to_user_id !== undefined) {
    const newOwner = body.transfer_to_user_id.trim();
    if (!newOwner) {
      return NextResponse.json(
        { error: 'transfer_to_user_id cannot be empty' },
        { status: 400 },
      );
    }
    const { data: target, error: lookupError } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', id)
      .eq('user_id', newOwner)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json(
        { error: 'New owner must already be a member of the organization' },
        { status: 400 },
      );
    }
    updates.owner_id = newOwner;

    // New owner should also become admin if they aren't already.
    await supabase
      .from('organization_members')
      .update({ role: 'admin' })
      .eq('organization_id', id)
      .eq('user_id', newOwner);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'slug already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organization: data, updated: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = request.nextUrl.searchParams.get('user_id')?.trim();

  if (!userId) {
    return NextResponse.json(
      { error: 'user_id query parameter is required' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  // Only the owner (not just any admin) can delete the whole org.
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', id)
    .single();

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }
  if (org.owner_id !== userId) {
    const err = new RbacError('Only the organization owner can delete it', 403);
    const { body, status } = rbacErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { error } = await supabase.from('organizations').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
