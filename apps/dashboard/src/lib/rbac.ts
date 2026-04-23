import { createServerClient } from './supabase-server';

export type Role = 'admin' | 'security_analyst' | 'viewer';

export const ROLES: readonly Role[] = ['admin', 'security_analyst', 'viewer'] as const;

/**
 * Permission matrix — single source of truth for what each role may do.
 *
 * admin            — full control, including invites and destructive ops.
 * security_analyst — read everything, approve/reject oversight actions,
 *                    cannot touch membership or org settings.
 * viewer           — read-only.
 */
export const PERMISSIONS = {
  admin: [
    'org:read',
    'org:write',
    'org:delete',
    'members:read',
    'members:invite',
    'members:remove',
    'members:change_role',
    'oversight:decide',
    'events:read',
    'agents:read',
    'agents:write',
    'reports:generate',
  ],
  security_analyst: [
    'org:read',
    'members:read',
    'oversight:decide',
    'events:read',
    'agents:read',
    'reports:generate',
  ],
  viewer: [
    'org:read',
    'members:read',
    'events:read',
    'agents:read',
  ],
} as const satisfies Record<Role, readonly string[]>;

export class RbacError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'RbacError';
    this.status = status;
  }
}

/**
 * Look up the caller's role in an organization.
 * Returns null if they are not a member.
 */
export async function getMembership(
  userId: string,
  orgId: string,
): Promise<{ role: Role } | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) {
    throw new RbacError(`Failed to resolve membership: ${error.message}`, 500);
  }
  return data ? { role: data.role as Role } : null;
}

/**
 * Throws RbacError(403) if the user is not a member of orgId with one of
 * the allowed roles. Use at the top of every org-scoped API handler.
 */
export async function requireRole(
  userId: string,
  orgId: string,
  roles: Role[],
): Promise<Role> {
  if (!userId) throw new RbacError('user_id required', 400);
  if (!orgId) throw new RbacError('organization_id required', 400);

  const membership = await getMembership(userId, orgId);
  if (!membership) {
    throw new RbacError('Not a member of this organization', 403);
  }
  if (!roles.includes(membership.role)) {
    throw new RbacError(
      `Requires one of: ${roles.join(', ')}. Current role: ${membership.role}`,
      403,
    );
  }
  return membership.role;
}

/**
 * Non-throwing membership check. Returns true if ownerId is a member of
 * orgId with one of the allowed roles. API key owner_id is the same
 * identity as organization_members.user_id.
 */
export async function checkRole(
  ownerId: string,
  orgId: string,
  roles: Role[],
): Promise<boolean> {
  if (!ownerId || !orgId) return false;
  try {
    const membership = await getMembership(ownerId, orgId);
    if (!membership) return false;
    return roles.includes(membership.role);
  } catch {
    return false;
  }
}

/**
 * Convenience for mapping RbacError into a Next.js JSON response.
 */
export function rbacErrorResponse(
  err: unknown,
): { body: { error: string }; status: number } {
  if (err instanceof RbacError) {
    return { body: { error: err.message }, status: err.status };
  }
  const message = err instanceof Error ? err.message : 'Unauthorized';
  return { body: { error: message }, status: 500 };
}
