'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, type Language } from '@/context/LanguageContext';

const COPY: Record<Language, {
  googleButton: string;
  or: string;
  emailLabel: string;
  passwordLabel: string;
  submitLogin: string;
  submitSignup: string;
  toggleToSignup: string;
  toggleToLogin: string;
  legacyLoginLink: string;
  confirmationSent: string;
  showPassword: string;
  hidePassword: string;
  forgotPassword: string;
}> = {
  en: {
    googleButton: 'Sign in with Google',
    or: 'or',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submitLogin: 'Sign in',
    submitSignup: 'Create account',
    toggleToSignup: 'No account? Sign up',
    toggleToLogin: 'Already have an account? Sign in',
    legacyLoginLink: 'Instagram subscribers sign in here',
    confirmationSent: 'Confirmation email sent. Please check your inbox.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    forgotPassword: 'Forgot password?',
  },
  ja: {
    googleButton: 'Google でサインイン',
    or: 'または',
    emailLabel: 'メールアドレス',
    passwordLabel: 'パスワード',
    submitLogin: 'サインイン',
    submitSignup: 'アカウントを作成',
    toggleToSignup: 'アカウントをお持ちでない方は新規登録',
    toggleToLogin: 'すでにアカウントをお持ちの方はサインイン',
    legacyLoginLink: 'Instagram登録者の方はこちら',
    confirmationSent: '確認メールを送信しました。受信ボックスをご確認ください。',
    showPassword: 'パスワードを表示',
    hidePassword: 'パスワードを非表示',
    forgotPassword: 'パスワードをお忘れですか？',
  },
  'zh-CN': {
    googleButton: '使用 Google 登录',
    or: '或',
    emailLabel: '邮箱',
    passwordLabel: '密码',
    submitLogin: '登录',
    submitSignup: '创建账户',
    toggleToSignup: '还没有账户？注册',
    toggleToLogin: '已有账户？登录',
    legacyLoginLink: 'Instagram 订阅者请点击这里',
    confirmationSent: '确认邮件已发送，请查收您的收件箱。',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    forgotPassword: '忘记密码？',
  },
  'zh-TW': {
    googleButton: '使用 Google 登入',
    or: '或',
    emailLabel: '電子郵件',
    passwordLabel: '密碼',
    submitLogin: '登入',
    submitSignup: '建立帳戶',
    toggleToSignup: '還沒有帳戶？註冊',
    toggleToLogin: '已有帳戶？登入',
    legacyLoginLink: 'Instagram 訂閱者請由此登入',
    confirmationSent: '確認郵件已寄出，請查看您的收件匣。',
    showPassword: '顯示密碼',
    hidePassword: '隱藏密碼',
    forgotPassword: '忘記密碼？',
  },
  ko: {
    googleButton: 'Google로 로그인',
    or: '또는',
    emailLabel: '이메일',
    passwordLabel: '비밀번호',
    submitLogin: '로그인',
    submitSignup: '계정 만들기',
    toggleToSignup: '계정이 없으신가요? 회원가입',
    toggleToLogin: '이미 계정이 있으신가요? 로그인',
    legacyLoginLink: 'Instagram 구독자는 여기에서 로그인',
    confirmationSent: '확인 이메일을 보냈습니다. 받은편지함을 확인해 주세요.',
    showPassword: '비밀번호 표시',
    hidePassword: '비밀번호 숨기기',
    forgotPassword: '비밀번호를 잊으셨나요?',
  },
};

// Supabase Auth returns fixed English error strings. Map the common ones we
// actually see on this screen; anything unrecognized falls back to the raw
// message rather than silently hiding it.
const AUTH_ERROR_MAP: Record<Language, Record<string, string>> = {
  en: {},
  ja: {
    'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません。',
    'User already registered': 'このメールアドレスはすでに登録されています。',
    'Password should be at least 6 characters': 'パスワードは6文字以上で入力してください。',
    'Unable to validate email address: invalid format': 'メールアドレスの形式が正しくありません。',
    'Email not confirmed': 'メールアドレスがまだ確認されていません。受信ボックスの確認メールをご確認ください。',
  },
  'zh-CN': {
    'Invalid login credentials': '邮箱或密码不正确。',
    'User already registered': '该邮箱已注册。',
    'Password should be at least 6 characters': '密码需至少6个字符。',
    'Unable to validate email address: invalid format': '邮箱格式不正确。',
    'Email not confirmed': '邮箱尚未验证，请查看收件箱中的确认邮件。',
  },
  'zh-TW': {
    'Invalid login credentials': '電子郵件或密碼不正確。',
    'User already registered': '此電子郵件已註冊。',
    'Password should be at least 6 characters': '密碼須至少6個字元。',
    'Unable to validate email address: invalid format': '電子郵件格式不正確。',
    'Email not confirmed': '電子郵件尚未驗證，請查看收件匣中的確認郵件。',
  },
  ko: {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'User already registered': '이미 등록된 이메일입니다.',
    'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
    'Unable to validate email address: invalid format': '이메일 형식이 올바르지 않습니다.',
    'Email not confirmed': '이메일이 아직 확인되지 않았습니다. 받은편지함의 확인 메일을 확인해 주세요.',
  },
};

function translateAuthError(message: string, lang: Language): string {
  return AUTH_ERROR_MAP[lang][message] ?? message;
}

export default function LoginPageClient() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const t = COPY[lang];
  const nextParam = searchParams.get('next');
  const nextPath = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/';

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    // Trim whitespace so a stray leading/trailing space from copy-paste
    // doesn't turn into an "invalid credentials" surprise.
    const trimmedEmail = email.trim();

    if (mode === 'login') {
      const { error } = await signInWithEmail(trimmedEmail, password);
      if (error) {
        setError(translateAuthError(error, lang));
      } else {
        router.push(nextPath);
        router.refresh();
      }
    } else {
      const { error, needsConfirmation } = await signUpWithEmail(
        trimmedEmail,
        password,
        nextPath
      );
      if (error) {
        setError(translateAuthError(error, lang));
      } else if (needsConfirmation) {
        setMessage(t.confirmationSent);
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
        {message ? (
          /* Signup confirmation: replace the whole form so the user can't
             resubmit or re-trigger account creation while the email is
             pending confirmation. */
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-border bg-surface px-5 py-8 text-center"
          >
            <p className="text-sm text-foreground">{message}</p>
          </div>
        ) : (
          <>
            {/* Heading */}
            <div className="mb-10 text-center">
              <h1 className="text-2xl font-bold tracking-[0.1em] text-foreground">
                {mode === 'login' ? t.submitLogin : t.submitSignup}
              </h1>
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
              {t.googleButton}
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted">{t.or}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Form */}
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

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-medium text-muted">
                    {t.passwordLabel}
                  </label>
                  {mode === 'login' && (
                    <Link
                      href="/auth/reset-password"
                      className="text-xs text-muted transition-colors hover:text-foreground"
                    >
                      {t.forgotPassword}
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name={mode === 'login' ? 'current-password' : 'new-password'}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
                disabled={loading}
                className="btn-press w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {loading ? (
                  <span className="dot-loader inline-flex gap-1">
                    <span /><span /><span />
                  </span>
                ) : mode === 'login' ? t.submitLogin : t.submitSignup}
              </button>
            </form>

            {/* Toggle mode */}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="btn-press mt-6 flex w-full items-center justify-center rounded-lg border border-border bg-surface py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              {mode === 'login' ? t.toggleToSignup : t.toggleToLogin}
            </button>

            <p className="mt-3 text-center text-sm text-muted">
              <Link href={`/auth/legacy-login?next=${encodeURIComponent(nextPath)}`} className="text-foreground transition-opacity hover:opacity-60">
                {t.legacyLoginLink}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
