import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { extractApiKey, validateApiKey } from './auth';

export type AuthResult =
  | { ok: true; ownerId: string }
  | { ok: false; response: NextResponse };

/**
 * Resolve the caller from a Supabase session cookie, if present.
 * Covers the dashboard UI, which ships no API key from the browser.
 * Returns null on any failure so callers fall through to API key auth.
 */
async function tryCookieAuth(): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Route handlers can't mutate cookies during a read — the middleware
        // / server-component layer is responsible for session refresh.
        setAll: () => {},
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Require a valid caller. Accepts either:
 *   1. Supabase session cookie (dashboard UI — cookies travel automatically
 *      when fetch() uses credentials: 'include' on same-origin requests).
 *   2. Bearer API key in Authorization header (CI, SDKs, curl, webhooks).
 *
 * Owner identity is the Supabase user.id when cookie-authed, or the
 * API key's owner_id otherwise. RBAC layers on top via requireRole().
 */
export async function requireApiKeyAuth(
  request: NextRequest,
  opts: { bodyOwnerId?: string | null } = {},
): Promise<AuthResult> {
  // Cookie first — the dashboard UI relies on this.
  const cookieOwner = await tryCookieAuth();
  if (cookieOwner) {
    if (opts.bodyOwnerId && opts.bodyOwnerId !== cookieOwner) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'owner_id does not match authenticated session' },
          { status: 403 },
        ),
      };
    }
    return { ok: true, ownerId: cookieOwner };
  }

  // API key — external callers.
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
