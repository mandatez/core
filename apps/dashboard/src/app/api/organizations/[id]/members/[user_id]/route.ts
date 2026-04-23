import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { rbacErrorResponse, requireRole, ROLES, type Role } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolves the organization's owner, so we can block removing / demoting
 * the owner. Owner changes must flow through PATCH /organizations/[id].
 */
async function getOrgOwnerId(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .maybeSingle();
  return data?.owner_id ?? null;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; user_id: string }> },
) {
  const { id: orgId, user_id: targetUserId } = await params;
  const callerUserId = request.nextUrl.searchParams.get('user_id')?.trim();

  if (!callerUserId) {
    return NextResponse.json(
      { error: 'user_id query parameter is required' },
      { status: 400 },
    );
  }

  try {
    await requireRole(callerUserId, orgId, ['admin']);
  } catch (err) {
    const { body, status } = rbacErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const supabase = createServerClient();
  const ownerId = await getOrgOwnerId(supabase, orgId);
  if (ownerId === targetUserId) {
    return NextResponse.json(
      {
        error:
          'Cannot remove the organization owner. Transfer ownership first via PATCH /organizations/{id}.',
      },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', targetUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ removed: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; user_id: string }> },
) {
  const { id: orgId, user_id: targetUserId } = await params;

  let body: { user_id?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const callerUserId = body.user_id?.trim();
  if (!callerUserId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const role = body.role?.trim() as Role | undefined;
  if (!role || !ROLES.includes(role)) {
    return NextResponse.json(
      { error: `role must be one of: ${ROLES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    await requireRole(callerUserId, orgId, ['admin']);
  } catch (err) {
    const { body: errBody, status } = rbacErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  const supabase = createServerClient();
  const ownerId = await getOrgOwnerId(supabase, orgId);
  if (ownerId === targetUserId && role !== 'admin') {
    return NextResponse.json(
      {
        error:
          'Cannot demote the organization owner. Transfer ownership first.',
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('organization_id', orgId)
    .eq('user_id', targetUserId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  return NextResponse.json({ member: data, updated: true });
}
