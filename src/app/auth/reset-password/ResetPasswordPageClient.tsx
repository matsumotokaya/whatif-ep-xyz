'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, type Language } from '@/context/LanguageContext';

const COPY: Record<Language, {
  heading: string;
  lead: string;
  emailLabel: string;
  submit: string;
  backToSignIn: string;
  confirmationSent: string;
}> = {
  en: {
    heading: 'Reset password',
    lead: "Enter your account email and we'll send you a link to reset your password.",
    emailLabel: 'Email',
    submit: 'Send reset link',
    backToSignIn: '← Back to sign in',
    confirmationSent:
      'If an account exists for that email, a reset link has been sent. Please check your inbox.',
  },
  ja: {
    heading: 'パスワードの再設定',
    lead: 'アカウントのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。',
    emailLabel: 'メールアドレス',
    submit: '再設定用リンクを送信',
    backToSignIn: '← サインインに戻る',
    confirmationSent:
      '該当するアカウントが存在する場合、再設定用のリンクを送信しました。受信ボックスをご確認ください。',
  },
  'zh-CN': {
    heading: '重置密码',
    lead: '请输入账户邮箱，我们会发送密码重置链接。',
    emailLabel: '邮箱',
    submit: '发送重置链接',
    backToSignIn: '← 返回登录',
    confirmationSent: '如果该邮箱对应账户存在，重置链接已发送，请查收您的收件箱。',
  },
  'zh-TW': {
    heading: '重設密碼',
    lead: '請輸入帳戶電子郵件，我們會寄送密碼重設連結。',
    emailLabel: '電子郵件',
    submit: '寄送重設連結',
    backToSignIn: '← 返回登入',
    confirmationSent: '若該電子郵件對應帳戶存在，重設連結已寄出，請查看您的收件匣。',
  },
  ko: {
    heading: '비밀번호 재설정',
    lead: '계정 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.',
    emailLabel: '이메일',
    submit: '재설정 링크 보내기',
    backToSignIn: '← 로그인으로 돌아가기',
    confirmationSent:
      '해당 이메일의 계정이 존재하는 경우 재설정 링크를 보냈습니다. 받은편지함을 확인해 주세요.',
  },
};

export default function ResetPasswordPageClient() {
  const { resetPasswordForEmail } = useAuth();
  const { lang } = useLanguage();
  const t = COPY[lang];

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || sent) return;
    setLoading(true);
    // Always show the same confirmation regardless of outcome: whether the
    // email exists or Supabase errors, revealing that distinction here would
    // let an attacker enumerate registered accounts.
    await resetPasswordForEmail(email.trim());
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        {sent ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-border bg-surface px-5 py-8 text-center"
          >
            <p className="text-sm text-foreground">{t.confirmationSent}</p>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-[0.1em] text-foreground">
                {t.heading}
              </h1>
              <p className="mt-3 text-sm text-muted">{t.lead}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted">
                  {t.emailLabel}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder-muted/50 transition-colors focus:border-foreground focus:outline-none"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-press w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {loading ? (
                  <span className="dot-loader inline-flex gap-1">
                    <span /><span /><span />
                  </span>
                ) : t.submit}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              <Link href="/auth/login" className="text-foreground transition-opacity hover:opacity-60">
                {t.backToSignIn}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
