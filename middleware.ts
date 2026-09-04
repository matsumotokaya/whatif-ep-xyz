import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // The MCP docs page lives at /imagine/about-mcp. It used to be /imagine/mcp,
  // which read as an endpoint rather than a page: a consumer POSTed to it and
  // got a bare 405, and an assistant handed the link would take it for the
  // endpoint itself. Hence the rename, plus two redirects here.
  //
  // Both run before the Supabase session refresh below, so they short-circuit
  // instead of paying that cost, and both use 308 because it preserves the
  // method and body — an MCP client that POSTs to either URL follows the
  // redirect and connects for real instead of hitting a dead end.
  const { pathname } = request.nextUrl;
  const isDocsRequest = request.method === 'GET' || request.method === 'HEAD';

  if (pathname === '/imagine/mcp' || pathname === '/imagine/about-mcp') {
    // Anything that is not a page view is meant for the endpoint.
    if (!isDocsRequest) {
      const url = request.nextUrl.clone();
      url.pathname = '/api/mcp';
      return NextResponse.redirect(url, 308);
    }

    // Keep the old page URL working for links already shared.
    if (pathname === '/imagine/mcp') {
      const url = request.nextUrl.clone();
      url.pathname = '/imagine/about-mcp';
      return NextResponse.redirect(url, 308);
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must not write any logic between createServerClient and getUser
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
