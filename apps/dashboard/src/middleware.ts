import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Route gate — every request hits this first.
 *
 * We try to resolve a Supabase session from cookies. If there is none,
 * we redirect the browser to /login (carrying a `next` param so the
 * user lands back where they were trying to go). Anything that has to
 * work unauthenticated — the login page itself, the auth callback, the
 * public trust-card SVG — is excluded below.
 *
 * Cookie-refresh side-effect: createServerClient will rotate auth
 * cookies mid-session. We mirror any Set-Cookie onto the outgoing
 * response so the fresh values stick.
 */
export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  // Static assets and Next internals — leave them alone.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.webp')
  ) {
    return NextResponse.next();
  }

  // Public paths — no session required.
  if (
    pathname === '/login' ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/api/trust-card')
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't wired up we can't enforce auth; fail open so
  // local/dev environments without env vars still render.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return response;

  // No session — browser navigations go to /login; API calls get 401
  // so the client-side fetch helpers can surface an auth error without
  // following an HTML redirect.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const redirectUrl = new URL('/login', url);
  if (pathname !== '/') {
    redirectUrl.searchParams.set('next', pathname + url.search);
  }
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  // Everything except obvious static files. The function above filters
  // further at runtime.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
