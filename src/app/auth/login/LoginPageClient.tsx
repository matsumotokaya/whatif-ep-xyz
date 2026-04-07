'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LoginPageClient() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const nextPath = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/';

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        setError(error);
      } else {
        router.push(nextPath);
        router.refresh();
      }
    } else {
      const { error, needsConfirmation } = await signUpWithEmail(
        email,
        password,
        nextPath
      );
      if (error) {
        setError(error);
      } else if (needsConfirmation) {
        setMessage('Confirmation email sent. Please check your inbox.');
      } else {
        router.push(nextPath);
        router.refresh();
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/" className="text-2xl font-bold tracking-[0.2em] text-foreground">
            WHATIF
          </Link>
          <p className="mt-2 text-sm text-muted">
            {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
          </p>
        </div>

        {/* Google */}
        <button
          onClick={() => signInWithGoogle(nextPath)}
          className="btn-press flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface py-2.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder-muted/50 transition-colors focus:border-foreground focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder-muted/50 transition-colors focus:border-foreground focus:outline-none"
              placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-press w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {loading ? (
              <span className="dot-loader inline-flex gap-1">
                <span /><span /><span />
              </span>
            ) : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="mt-6 text-center text-sm text-muted">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button onClick={() => setMode('signup')} className="font-medium text-foreground transition-opacity hover:opacity-60">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="font-medium text-foreground transition-opacity hover:opacity-60">
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="mt-3 text-center text-sm text-muted">
          <Link href={`/auth/legacy-login?next=${encodeURIComponent(nextPath)}`} className="text-foreground transition-opacity hover:opacity-60">
            Instagram subscribers sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
