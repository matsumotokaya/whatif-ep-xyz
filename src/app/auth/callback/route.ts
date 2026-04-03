import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const cookieStore = await cookies();
  const cookieNextParam = cookieStore.get('whatif_auth_next')?.value;
  const nextCandidate = nextParam ?? cookieNextParam ?? '/';
  const next =
    nextCandidate.startsWith('/') && !nextCandidate.startsWith('//')
      ? nextCandidate
      : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      const redirectUrl = isLocalEnv
        ? `${origin}${next}`
        : forwardedHost
          ? `https://${forwardedHost}${next}`
          : `${origin}${next}`;
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete('whatif_auth_next');
      return response;
    }
  }

  const response = NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  response.cookies.delete('whatif_auth_next');
  return response;
}
