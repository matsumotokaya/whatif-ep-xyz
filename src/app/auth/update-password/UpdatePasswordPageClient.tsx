'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, type Language } from '@/context/LanguageContext';

const COPY: Record<Language, {
  heading: string;
  passwordLabel: string;
  submit: string;
  showPassword: string;
  hidePassword: string;
  invalidLinkHeading: string;
  invalidLinkBody: string;
  requestNewLink: string;
}> = {
  en: {
    heading: 'Set a new password',
    passwordLabel: 'New password',
    submit: 'Update password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    invalidLinkHeading: 'Link expired or invalid',
    invalidLinkBody: 'This password reset link is no longer valid. Please request a new one.',
    requestNewLink: 'Request a new link',
  },
  ja: {
    heading: '新しいパスワードを設定',
    passwordLabel: '新しいパスワード',
    submit: 'パスワードを更新',
    showPassword: 'パスワードを表示',
    hidePassword: 'パスワードを非表示',
    invalidLinkHeading: 'リンクの有効期限が切れています',
    invalidLinkBody: 'このパスワード再設定用リンクは無効です。もう一度リクエストしてください。',
    requestNewLink: '再設定リンクをリクエスト',
  },
  'zh-CN': {
    heading: '设置新密码',
    passwordLabel: '新密码',
    submit: '更新密码',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    invalidLinkHeading: '链接已失效',
    invalidLinkBody: '此密码重置链接已失效，请重新申请。',
    requestNewLink: '重新申请链接',
  },
  'zh-TW': {
    heading: '設定新密碼',
    passwordLabel: '新密碼',
    submit: '更新密碼',
    showPassword: '顯示密碼',
    hidePassword: '隱藏密碼',
    invalidLinkHeading: '連結已失效',
    invalidLinkBody: '此密碼重設連結已失效，請重新申請。',
    requestNewLink: '重新申請連結',
  },
  ko: {
    heading: '새 비밀번호 설정',
    passwordLabel: '새 비밀번호',
    submit: '비밀번호 업데이트',
    showPassword: '비밀번호 표시',
    hidePassword: '비밀번호 숨기기',
    invalidLinkHeading: '링크가 만료되었거나 유효하지 않습니다',
    invalidLinkBody: '이 비밀번호 재설정 링크는 더 이상 유효하지 않습니다. 다시 요청해 주세요.',
    requestNewLink: '새 링크 요청',
  },
};

const AUTH_ERROR_MAP: Record<Language, Record<string, string>> = {
  en: {},
  ja: {
    'Password should be at least 6 characters': 'パスワードは6文字以上で入力してください。',
    'New password should be different from the old password.':
      '新しいパスワードは現在のパスワードと異なるものにしてください。',
  },
  'zh-CN': {
    'Password should be at least 6 characters': '密码需至少6个字符。',
    'New password should be different from the old password.': '新密码需与当前密码不同。',
  },
  'zh-TW': {
    'Password should be at least 6 characters': '密碼須至少6個字元。',
    'New password should be different from the old password.': '新密碼須與目前密碼不同。',
  },
  ko: {
    'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
    'New password should be different from the old password.':
      '새 비밀번호는 현재 비밀번호와 달라야 합니다.',
  },
};

function translateAuthError(message: string, lang: Language): string {
  return AUTH_ERROR_MAP[lang][message] ?? message;
}

export default function UpdatePasswordPageClient() {
  const { user, loading: authLoading, updatePassword } = useAuth();
  const { lang } = useLanguage();
  const t = COPY[lang];
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await updatePassword(password);
    if (error) {
      setError(translateAuthError(error, lang));
      setSubmitting(false);
      return;
    }

    router.push('/account');
    router.refresh();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="h-10 w-48 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  // No recovery session: the link was already used, expired, or the page
  // was opened directly without going through /auth/callback.
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm animate-fade-in-up text-center">
          <h1 className="text-2xl font-bold tracking-[0.1em] text-foreground">
            {t.invalidLinkHeading}
          </h1>
          <p className="mt-3 text-sm text-muted">{t.invalidLinkBody}</p>
          <Link
            href="/auth/reset-password"
            className="btn-press mt-6 inline-flex w-full items-center justify-center rounded-lg border border-border bg-surface py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {t.requestNewLink}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold tracking-[0.1em] text-foreground">
            {t.heading}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-muted">
              {t.passwordLabel}
            </label>
            <div className="relative">
              <input
                id="password"
                name="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-11 text-sm text-foreground placeholder-muted/50 transition-colors focus:border-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-press w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {submitting ? (
              <span className="dot-loader inline-flex gap-1">
                <span /><span /><span />
              </span>
            ) : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
