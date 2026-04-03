import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const next =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/';
  const envBase = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let baseUrl = origin;
  if (envBase && envBase.length > 0) {
    try {
      const envHost = new URL(envBase).host;
      const originHost = new URL(origin).host;
      if (envHost === originHost) {
        baseUrl = envBase;
      }
    } catch {
      baseUrl = origin;
    }
  }
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${normalizedBase}${next}`);
    }
  }

  return NextResponse.redirect(`${normalizedBase}/auth/login?error=auth_failed`);
}
