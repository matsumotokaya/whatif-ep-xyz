'use client';

// WHATIF-toned contact page. Previously this route rendered the ported
// IMAGINE Contact page (its own Header/Footer via PublicPageLayout), which
// stacked a second IMAGINE header/footer underneath the Gallery's own —
// this component drops that entirely and relies on the Gallery shell
// (root layout Header + Footer) instead. Submission logic (Web3Forms) is
// unchanged from the original.

import { useState } from 'react';
import { useLanguage, type Language } from '@/context/LanguageContext';

const COPY: Record<Language, {
  eyebrow: string;
  title: string;
  description: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  subjectLabel: string;
  subjectPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  submitButton: string;
  sending: string;
  successTitle: string;
  successMessage: string;
  errorTitle: string;
  errorMessage: string;
  directEmail: string;
  directEmailDescription: string;
  businessHours: string;
  businessHoursDescription: string;
  businessHoursNote: string;
}> = {
  en: {
    eyebrow: 'Contact',
    title: 'Contact Us',
    description: 'If you have any questions or requests, please feel free to contact us.',
    nameLabel: 'Name',
    namePlaceholder: 'John Doe',
    emailLabel: 'Email Address',
    subjectLabel: 'Subject',
    subjectPlaceholder: 'Enter the subject of your inquiry',
    messageLabel: 'Message',
    messagePlaceholder: 'Please describe your inquiry in detail',
    submitButton: 'Send',
    sending: 'Sending...',
    successTitle: 'Message Sent',
    successMessage: 'Thank you for your inquiry. We will respond within 1-3 business days.',
    errorTitle: 'Error Sending Message',
    errorMessage: 'Failed to send message. Please try again later.',
    directEmail: 'Send Email Directly',
    directEmailDescription: 'You can also contact us directly at the following email address:',
    businessHours: 'Business Hours',
    businessHoursDescription: 'We will respond to your inquiry within 1-3 business days.',
    businessHoursNote: '(Excluding weekends and holidays)',
  },
  ja: {
    eyebrow: 'Contact',
    title: 'お問い合わせ',
    description: 'ご質問やご要望がございましたら、お気軽にお問い合わせください。',
    nameLabel: 'お名前',
    namePlaceholder: '山田 太郎',
    emailLabel: 'メールアドレス',
    subjectLabel: '件名',
    subjectPlaceholder: 'お問い合わせの件名を入力してください',
    messageLabel: 'お問い合わせ内容',
    messagePlaceholder: 'お問い合わせ内容を詳しくご記入ください',
    submitButton: '送信',
    sending: '送信中...',
    successTitle: '送信完了',
    successMessage: 'お問い合わせありがとうございます。1〜3営業日以内にご返信いたします。',
    errorTitle: '送信エラー',
    errorMessage: '送信に失敗しました。しばらくしてからもう一度お試しください。',
    directEmail: '直接メールで送信',
    directEmailDescription: '下記のメールアドレスに直接お問い合わせいただくことも可能です：',
    businessHours: '営業時間',
    businessHoursDescription: 'お問い合わせへの回答は、通常1〜3営業日以内に行います。',
    businessHoursNote: '（土日祝日を除く）',
  },
  'zh-CN': {
    eyebrow: 'Contact',
    title: '联系我们',
    description: '如果您有任何问题或需求，请随时与我们联系。',
    nameLabel: '姓名',
    namePlaceholder: '张三',
    emailLabel: '邮箱地址',
    subjectLabel: '主题',
    subjectPlaceholder: '请输入咨询主题',
    messageLabel: '咨询内容',
    messagePlaceholder: '请详细描述您的咨询内容',
    submitButton: '发送',
    sending: '发送中...',
    successTitle: '发送成功',
    successMessage: '感谢您的咨询。我们将在1-3个工作日内回复。',
    errorTitle: '发送失败',
    errorMessage: '发送失败，请稍后重试。',
    directEmail: '直接发送邮件',
    directEmailDescription: '您也可以直接通过以下邮箱地址联系我们：',
    businessHours: '工作时间',
    businessHoursDescription: '我们将在1-3个工作日内回复您的咨询。',
    businessHoursNote: '（周末及节假日除外）',
  },
  'zh-TW': {
    eyebrow: 'Contact',
    title: '聯絡我們',
    description: '如果您有任何問題或需求，請隨時與我們聯繫。',
    nameLabel: '姓名',
    namePlaceholder: '王大明',
    emailLabel: '電子信箱',
    subjectLabel: '主旨',
    subjectPlaceholder: '請輸入詢問主旨',
    messageLabel: '詢問內容',
    messagePlaceholder: '請詳細描述您的詢問內容',
    submitButton: '送出',
    sending: '發送中...',
    successTitle: '發送成功',
    successMessage: '感謝您的詢問。我們將在1-3個工作天內回覆。',
    errorTitle: '發送失敗',
    errorMessage: '發送失敗，請稍後重試。',
    directEmail: '直接發送郵件',
    directEmailDescription: '您也可以直接透過以下信箱地址聯繫我們：',
    businessHours: '營業時間',
    businessHoursDescription: '我們將在1-3個工作天內回覆您的詢問。',
    businessHoursNote: '（週末及國定假日除外）',
  },
  ko: {
    eyebrow: 'Contact',
    title: '문의하기',
    description: '질문이나 요청 사항이 있으시면 언제든지 문의해 주세요.',
    nameLabel: '이름',
    namePlaceholder: '홍길동',
    emailLabel: '이메일 주소',
    subjectLabel: '제목',
    subjectPlaceholder: '문의 제목을 입력해 주세요',
    messageLabel: '문의 내용',
    messagePlaceholder: '문의 내용을 자세히 작성해 주세요',
    submitButton: '보내기',
    sending: '전송 중...',
    successTitle: '전송 완료',
    successMessage: '문의해 주셔서 감사합니다. 1-3영업일 이내에 답변드리겠습니다.',
    errorTitle: '전송 실패',
    errorMessage: '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    directEmail: '직접 이메일 보내기',
    directEmailDescription: '아래 이메일 주소로 직접 문의하실 수도 있습니다:',
    businessHours: '업무 시간',
    businessHoursDescription: '문의에 대한 답변은 보통 1-3영업일 이내에 이루어집니다.',
    businessHoursNote: '(주말 및 공휴일 제외)',
  },
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'contact@whatif-ep.xyz';

export default function ContactPageClient() {
  const { lang } = useLanguage();
  const t = COPY[lang];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    try {
      const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY;
      if (!accessKey) {
        throw new Error('Missing NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY');
      }
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_key: accessKey, name, email, subject, message }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus('success');
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
        setTimeout(() => setStatus('idle'), 5000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
      }
    } catch (error) {
      console.error('Contact form submission failed:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <div className="w-full px-4 py-10 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-muted">
            {t.eyebrow}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">{t.description}</p>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          {status === 'success' && (
            <div
              role="status"
              aria-live="polite"
              className="mb-6 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground"
            >
              <p className="font-medium">{t.successTitle}</p>
              <p className="mt-1 text-muted">{t.successMessage}</p>
            </div>
          )}

          {status === 'error' && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              <p className="font-medium">{t.errorTitle}</p>
              <p className="mt-1">{t.errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-muted">
                {t.nameLabel}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted/50 transition-colors focus:border-foreground focus:outline-none"
                placeholder={t.namePlaceholder}
              />
            </div>

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
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted/50 transition-colors focus:border-foreground focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="subject" className="mb-1.5 block text-xs font-medium text-muted">
                {t.subjectLabel}
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted/50 transition-colors focus:border-foreground focus:outline-none"
                placeholder={t.subjectPlaceholder}
              />
            </div>

            <div>
              <label htmlFor="message" className="mb-1.5 block text-xs font-medium text-muted">
                {t.messageLabel}
              </label>
              <textarea
                id="message"
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={8}
                className="w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted/50 transition-colors focus:border-foreground focus:outline-none"
                placeholder={t.messagePlaceholder}
              />
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn-press w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {status === 'sending' ? (
                <span className="dot-loader inline-flex gap-1">
                  <span /><span /><span />
                </span>
              ) : t.submitButton}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            {t.directEmail}
          </h2>
          <p className="mt-3 text-sm text-muted">{t.directEmailDescription}</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-2 inline-block text-sm font-medium text-foreground hover:opacity-70"
          >
            {CONTACT_EMAIL}
          </a>

          <div className="mt-6 border-t border-border pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              {t.businessHours}
            </h2>
            <p className="mt-3 text-sm text-muted">
              {t.businessHoursDescription}
              <br />
              {t.businessHoursNote}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
