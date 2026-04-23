import { NextRequest, NextResponse } from 'next/server';
import { extractApiKey, validateApiKey } from './auth';

export type AuthResult =
  | { ok: true; ownerId: string }
  | { ok: false; response: NextResponse };

/**
 * Require a valid API key. Optionally require the body-supplied
 * owner_id to match the key's owner_id (defense-in-depth).
 */
export async function requireApiKeyAuth(
  request: NextRequest,
  opts: { bodyOwnerId?: string | null } = {},
): Promise<AuthResult> {
  const apiKey = extractApiKey(request.headers);
  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authorization header with Bearer API key is required' },
        { status: 401 },
      ),
    };
  }

  const validation = await validateApiKey(apiKey);
  if (!validation.valid) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `API key ${validation.reason}` },
        { status: 401 },
      ),
    };
  }

  if (opts.bodyOwnerId && opts.bodyOwnerId !== validation.owner_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'owner_id does not match authenticated API key owner' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, ownerId: validation.owner_id! };
}

/**
 * Require a valid API key AND the key's owner to be a member of the
 * given org with at least one of the allowed roles. Depends on rbac.ts
 * from migration 008_organizations.sql.
 */
export async function requireOrgRole(
  request: NextRequest,
  orgId: string,
  allowedRoles: Array<'admin' | 'security_analyst' | 'viewer'>,
): Promise<AuthResult> {
  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth;

  const { checkRole } = await import('./rbac');
  const allowed = await checkRole(auth.ownerId, orgId, allowedRoles);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'insufficient role for this organization' },
        { status: 403 },
      ),
    };
  }
  return auth;
}
