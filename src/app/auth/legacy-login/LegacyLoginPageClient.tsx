'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LegacyLoginPageClient() {
  const { signInWithLegacyId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const nextPath = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/';

  const [legacyId, setLegacyId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signInWithLegacyId(legacyId, password);
    if (error) {
      setError(error);
    } else {
      router.push(nextPath);
      router.refresh();
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
          <p className="mt-2 text-muted text-sm">ユーザーIDでログイン</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="legacy-id" className="block text-sm text-muted mb-1">
              ユーザーID
            </label>
            <input
              id="legacy-id"
              type="text"
              value={legacyId}
              onChange={(e) => setLegacyId(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-neon-cyan transition-colors"
              placeholder="bam.5878"
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
              minLength={4}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-neon-cyan transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-neon-cyan text-background font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '処理中...' : 'ログイン'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted">
          通常のメールログインは{' '}
          <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className="text-neon-cyan hover:opacity-80">
            こちら
          </Link>
        </div>
      </div>
    </div>
  );
}
