import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { rbacErrorResponse, requireRole, ROLES, type Role } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;

  let body: { user_id?: string; invitee_user_id?: string; email?: string; role?: string };
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
    await requireRole(userId, orgId, ['admin']);
  } catch (err) {
    const { body: errBody, status } = rbacErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  const inviteeUserId = body.invitee_user_id?.trim();
  const email = body.email?.trim();
  const role = body.role?.trim() as Role | undefined;

  if (!inviteeUserId) {
    return NextResponse.json(
      { error: 'invitee_user_id is required' },
      { status: 400 },
    );
  }
  if (!email || !isEmail(email)) {
    return NextResponse.json(
      { error: 'email must be a valid email address' },
      { status: 400 },
    );
  }
  if (!role || !ROLES.includes(role)) {
    return NextResponse.json(
      { error: `role must be one of: ${ROLES.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('organization_members')
    .insert({
      organization_id: orgId,
      user_id: inviteeUserId,
      email,
      role,
      invited_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'This user is already a member of the organization' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ member: data, invited: true });
}
