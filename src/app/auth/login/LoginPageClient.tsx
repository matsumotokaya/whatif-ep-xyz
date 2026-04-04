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
        setMessage('確認メールを送信しました。メールをご確認ください。');
      } else {
        router.push(nextPath);
        router.refresh();
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold tracking-wider neon-text-cyan">
            WHATIF
          </Link>
          <p className="mt-2 text-muted text-sm">
            {mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </p>
        </div>

        <button
          onClick={() => signInWithGoogle(nextPath)}
          className="w-full flex items-center justify-center gap-3 py-2.5 bg-surface border border-border rounded-lg text-foreground hover:border-muted transition-colors mb-6"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Googleでログイン
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted">または</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-muted mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-neon-cyan transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-muted mb-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-neon-cyan transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          {message && (
            <p className="text-sm text-neon-cyan">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-neon-cyan text-background font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === 'login' ? (
            <>
              アカウントをお持ちでない方は{' '}
              <button onClick={() => setMode('signup')} className="text-neon-cyan hover:opacity-80">
                新規登録
              </button>
            </>
          ) : (
            <>
              すでにアカウントをお持ちの方は{' '}
              <button onClick={() => setMode('login')} className="text-neon-cyan hover:opacity-80">
                ログイン
              </button>
            </>
          )}
        </p>

        <p className="mt-3 text-center text-sm text-muted">
          <Link href={`/auth/legacy-login?next=${encodeURIComponent(nextPath)}`} className="text-neon-cyan hover:opacity-80">
            Instagramで、サブスクリプションしている方はこちら
          </Link>
        </p>
      </div>
    </div>
  );
}
