import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Handles the return leg of a Supabase magic-link sign-in. Supabase
 * appends ?code=<pkce-code> to the redirect URL; we exchange it for a
 * session and set the auth cookies on the outgoing response.
 *
 * Magic-link URLs in Supabase Auth must whitelist this path under the
 * project's "Redirect URLs" setting.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const nextPath = url.searchParams.get('next') ?? '/';

  // Constrain redirect targets to same-origin paths so this endpoint
  // cannot be turned into an open redirect.
  const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//')
    ? nextPath
    : '/';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url));
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL('/login?error=server_not_configured', url));
  }

  const response = NextResponse.redirect(new URL(safeNext, url));

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          response.cookies.set({ name, value, ...options });
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        url,
      ),
    );
  }

  return response;
}
