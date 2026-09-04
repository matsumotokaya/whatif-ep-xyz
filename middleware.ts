import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // /imagine/mcp is a human-readable docs page about the MCP endpoint, not the
  // endpoint itself — but its URL looks like one, and a consumer POSTed to it
  // and got a bare 405 with no body, wasting time diagnosing it. MCP clients
  // follow redirects, so turn that dead end into a working connection: any
  // non-GET/HEAD request (POST included) gets a 308, which preserves the
  // method and body, straight to the real endpoint. GET/HEAD pass through so
  // the docs page still renders. This must run before the Supabase session
  // refresh below so it short-circuits instead of paying that cost.
  if (
    request.nextUrl.pathname === '/imagine/mcp' &&
    request.method !== 'GET' &&
    request.method !== 'HEAD'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/api/mcp';
    return NextResponse.redirect(url, 308);
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
