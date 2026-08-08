'use client';

// WHATIF-toned plans page. Previously this route rendered the ported IMAGINE
// UpgradePage (dark theme, its own Header/Footer, react-i18next, a "Guest
// $0" card that read as a real plan). This rewrite:
// - drops the IMAGINE chrome in favor of the Gallery shell (matches the
//   /imagine/contact and about/legal fix earlier in this pass)
// - drops the Guest card (docs/UX_BILLING_FIX_LIST.md P1: "意味の分かりにくい
//   「ゲスト 0円」表示を削除する")
// - explains Free vs. Premium vs. single wallpaper purchase (same doc:
//   "無料・Premium・壁紙単品購入の違いを簡潔に説明する")
// - makes each card's CTA reflect the signed-in user's actual plan instead
//   of always showing a generic "start" action
//
// Checkout/portal calls hit the same Next.js API routes directly (no editor
// utils import), same pattern as /account's ManageSubscriptionButton.

import { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, type Language } from '@/context/LanguageContext';

function resolveReturnTarget(rawTarget: string | null): string | null {
  if (!rawTarget || typeof window === 'undefined') return null;

  try {
    const url = new URL(rawTarget, window.location.origin);
    const allowedOrigins = new Set([
      window.location.origin,
      'https://whatif-ep.xyz',
      'http://localhost:3710',
    ]);

    if (!allowedOrigins.has(url.origin)) return null;
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function openTarget(router: ReturnType<typeof useRouter>, target: string) {
  if (/^https?:\/\//i.test(target)) {
    window.location.href = target;
    return;
  }
  router.push(target);
}

const COPY: Record<Language, {
  eyebrow: string;
  title: string;
  description: string;
  galleryBanner: string;
  freeTitle: string;
  freeDescription: string;
  freeFeatures: string[];
  freeCurrentBadge: string;
  freeCtaLoggedOut: string;
  freeCtaIncludedInPremium: string;
  freeSecondaryPrompt: string;
  freeSecondaryLink: string;
  premiumTitle: string;
  premiumDescription: string;
  premiumFeatures: string[];
  premiumPriceUnit: string;
  premiumCurrentBadge: string;
  premiumCtaLoggedOut: string;
  premiumCtaUpgrade: string;
  premiumCtaManage: string;
  loading: string;
  errorMessage: string;
  singlePurchaseTitle: string;
  singlePurchaseDescription: string;
  singlePurchaseCta: string;
}> = {
  en: {
    eyebrow: 'PLANS',
    title: 'Choose your plan',
    description: 'Start for free, and upgrade to Premium any time you want unlimited wallpaper downloads.',
    galleryBanner: 'Premium gives you unlimited wallpaper downloads. Prefer just one? You can also buy a single wallpaper pack from any artwork page.',
    freeTitle: 'Free',
    freeDescription: 'Create an account to save favorites and manage your purchases.',
    freeFeatures: [
      'Browse the full WHATIF gallery and save favorite artworks',
      'Buy individual wallpaper packs any time',
      'Use free templates in the IMAGINE design tool, save your designs, and upload your own assets',
    ],
    freeCurrentBadge: 'Your current plan',
    freeCtaLoggedOut: 'Create free account',
    freeCtaIncludedInPremium: 'Included in Premium',
    freeSecondaryPrompt: 'Already have an account?',
    freeSecondaryLink: 'Sign in',
    premiumTitle: 'Premium',
    premiumDescription: 'Unlimited downloads and full access to the design tool.',
    premiumFeatures: [
      'Unlimited downloads of all paid wallpapers in the WHATIF gallery',
      'Access to premium assets in the IMAGINE design tool',
      'Unlimited use of every design feature',
      'Access to the Library of saved WHATIF character illustrations',
    ],
    premiumPriceUnit: '/ month',
    premiumCurrentBadge: 'Your current plan',
    premiumCtaLoggedOut: 'Sign in to upgrade',
    premiumCtaUpgrade: 'Upgrade to Premium',
    premiumCtaManage: 'Manage subscription',
    loading: 'Loading...',
    errorMessage: 'Something went wrong. Please try again.',
    singlePurchaseTitle: 'Just want one wallpaper?',
    singlePurchaseDescription: 'Every artwork page lets you buy its wallpaper pack individually — no subscription required.',
    singlePurchaseCta: 'Browse the gallery',
  },
  ja: {
    eyebrow: 'PLANS',
    title: 'プランを選ぶ',
    description: '無料で始められます。壁紙をダウンロードし放題にしたくなったら、いつでもプレミアムにアップグレードできます。',
    galleryBanner: 'プレミアムなら壁紙がダウンロードし放題になります。1点だけで良ければ、各作品ページから単品購入も可能です。',
    freeTitle: '無料プラン',
    freeDescription: 'アカウントを作成すると、お気に入り保存や購入履歴の管理ができます。',
    freeFeatures: [
      'WHATIFギャラリーを閲覧してお気に入りを保存',
      '壁紙をいつでも単品購入',
      'IMAGINEの無料テンプレートでデザインを作成・保存、自分の素材のアップロードも可能',
    ],
    freeCurrentBadge: '現在のプラン',
    freeCtaLoggedOut: '無料でアカウントを作成',
    freeCtaIncludedInPremium: 'プレミアムに含まれています',
    freeSecondaryPrompt: 'すでにアカウントをお持ちの方は',
    freeSecondaryLink: 'サインイン',
    premiumTitle: 'プレミアムプラン',
    premiumDescription: 'ダウンロードし放題に加え、デザインツールも全機能利用できます。',
    premiumFeatures: [
      'WHATIFギャラリーの有料壁紙をダウンロードし放題',
      'IMAGINE のプレミアムアセットへアクセス',
      'デザインツールの全機能を制限なく利用',
      '保存済みキャラクターイラストの「ライブラリ」を利用',
    ],
    premiumPriceUnit: '/ 月',
    premiumCurrentBadge: '現在のプラン',
    premiumCtaLoggedOut: 'サインインしてアップグレード',
    premiumCtaUpgrade: 'プレミアムにアップグレード',
    premiumCtaManage: 'サブスクリプションを管理',
    loading: '処理中...',
    errorMessage: 'エラーが発生しました。もう一度お試しください。',
    singlePurchaseTitle: '壁紙を1点だけ購入したい方へ',
    singlePurchaseDescription: '各作品ページから、壁紙パックをサブスクなしで単品購入できます。',
    singlePurchaseCta: 'ギャラリーを見る',
  },
  'zh-CN': {
    eyebrow: 'PLANS',
    title: '选择方案',
    description: '免费即可开始使用。想要无限下载壁纸时，随时可以升级到高级方案。',
    galleryBanner: '高级方案可无限下载壁纸。如果只需要一张，也可以在各作品页面单独购买。',
    freeTitle: '免费方案',
    freeDescription: '创建账户即可收藏喜欢的作品并管理购买记录。',
    freeFeatures: [
      '浏览完整的 WHATIF 画廊并收藏喜欢的作品',
      '随时单独购买壁纸包',
      '使用 IMAGINE 的免费模板制作并保存设计，还可上传自己的素材',
    ],
    freeCurrentBadge: '您当前的方案',
    freeCtaLoggedOut: '免费创建账户',
    freeCtaIncludedInPremium: '已包含在高级方案中',
    freeSecondaryPrompt: '已有账户？',
    freeSecondaryLink: '登录',
    premiumTitle: '高级方案',
    premiumDescription: '无限下载，并可使用设计工具的全部功能。',
    premiumFeatures: [
      '无限下载 WHATIF 画廊中的所有付费壁纸',
      '访问 IMAGINE 设计工具的高级素材',
      '无限制使用所有设计功能',
      '使用收录 WHATIF 角色插画的「素材库」',
    ],
    premiumPriceUnit: '/ 月',
    premiumCurrentBadge: '您当前的方案',
    premiumCtaLoggedOut: '登录后升级',
    premiumCtaUpgrade: '升级到高级方案',
    premiumCtaManage: '管理订阅',
    loading: '处理中...',
    errorMessage: '发生错误，请重试。',
    singlePurchaseTitle: '只想购买一张壁纸？',
    singlePurchaseDescription: '每个作品页面都可以单独购买壁纸包，无需订阅。',
    singlePurchaseCta: '浏览画廊',
  },
  'zh-TW': {
    eyebrow: 'PLANS',
    title: '選擇方案',
    description: '免費即可開始使用。想要無限下載桌布時，隨時可以升級為進階方案。',
    galleryBanner: '進階方案可無限下載桌布。如果只需要一張，也可以在各作品頁面單獨購買。',
    freeTitle: '免費方案',
    freeDescription: '建立帳戶即可收藏喜歡的作品並管理購買紀錄。',
    freeFeatures: [
      '瀏覽完整的 WHATIF 藝廊並收藏喜歡的作品',
      '隨時單獨購買桌布包',
      '使用 IMAGINE 的免費範本製作並儲存設計，還可上傳自己的素材',
    ],
    freeCurrentBadge: '您目前的方案',
    freeCtaLoggedOut: '免費建立帳戶',
    freeCtaIncludedInPremium: '已包含在進階方案中',
    freeSecondaryPrompt: '已有帳戶？',
    freeSecondaryLink: '登入',
    premiumTitle: '進階方案',
    premiumDescription: '無限下載，並可使用設計工具的完整功能。',
    premiumFeatures: [
      '無限下載 WHATIF 藝廊中的所有付費桌布',
      '存取 IMAGINE 設計工具的進階素材',
      '無限制使用所有設計功能',
      '使用收錄 WHATIF 角色插圖的「素材庫」',
    ],
    premiumPriceUnit: '/ 月',
    premiumCurrentBadge: '您目前的方案',
    premiumCtaLoggedOut: '登入後升級',
    premiumCtaUpgrade: '升級為進階方案',
    premiumCtaManage: '管理訂閱',
    loading: '處理中...',
    errorMessage: '發生錯誤，請重試。',
    singlePurchaseTitle: '只想購買一張桌布？',
    singlePurchaseDescription: '每個作品頁面都可以單獨購買桌布包，無需訂閱。',
    singlePurchaseCta: '瀏覽藝廊',
  },
  ko: {
    eyebrow: 'PLANS',
    title: '플랜 선택',
    description: '무료로 바로 시작할 수 있습니다. 배경화면을 무제한으로 다운로드하고 싶을 때 언제든 프리미엄으로 업그레이드하세요.',
    galleryBanner: '프리미엄이면 배경화면을 무제한 다운로드할 수 있습니다. 한 장만 필요하다면 각 작품 페이지에서 단품으로도 구매할 수 있습니다.',
    freeTitle: '무료 플랜',
    freeDescription: '계정을 만들면 즐겨찾기 저장과 구매 내역 관리를 할 수 있습니다.',
    freeFeatures: [
      'WHATIF 갤러리 전체를 둘러보고 마음에 드는 작품 저장',
      '언제든 배경화면 단품 구매',
      'IMAGINE의 무료 템플릿으로 디자인 제작・저장, 직접 소재 업로드도 가능',
    ],
    freeCurrentBadge: '현재 플랜',
    freeCtaLoggedOut: '무료 계정 만들기',
    freeCtaIncludedInPremium: '프리미엄에 포함되어 있습니다',
    freeSecondaryPrompt: '이미 계정이 있으신가요?',
    freeSecondaryLink: '로그인',
    premiumTitle: '프리미엄 플랜',
    premiumDescription: '무제한 다운로드와 디자인 툴의 모든 기능을 이용할 수 있습니다.',
    premiumFeatures: [
      'WHATIF 갤러리의 모든 유료 배경화면 무제한 다운로드',
      'IMAGINE 디자인 툴의 프리미엄 에셋 이용',
      '모든 디자인 기능 무제한 이용',
      '저장된 WHATIF 캐릭터 일러스트 「라이브러리」 이용',
    ],
    premiumPriceUnit: '/ 월',
    premiumCurrentBadge: '현재 플랜',
    premiumCtaLoggedOut: '로그인 후 업그레이드',
    premiumCtaUpgrade: '프리미엄으로 업그레이드',
    premiumCtaManage: '구독 관리',
    loading: '처리 중...',
    errorMessage: '오류가 발생했습니다. 다시 시도해 주세요.',
    singlePurchaseTitle: '배경화면 한 장만 필요하신가요?',
    singlePurchaseDescription: '각 작품 페이지에서 구독 없이 배경화면 팩을 단품으로 구매할 수 있습니다.',
    singlePurchaseCta: '갤러리 둘러보기',
  },
};

function CheckIcon() {
  return (
    <svg className="mt-0.5 size-4 shrink-0 text-foreground" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface PlanCardProps {
  title: string;
  description: string;
  priceLabel: string;
  priceUnit?: string;
  badgeLabel?: string | null;
  highlighted?: boolean;
  features: string[];
  action: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

function PlanCard({
  title,
  description,
  priceLabel,
  priceUnit,
  badgeLabel,
  highlighted = false,
  features,
  action,
  secondaryAction,
}: PlanCardProps) {
  return (
    <section
      className={`flex h-full flex-col rounded-2xl border p-6 sm:p-7 ${
        highlighted ? 'border-foreground bg-surface' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-balance text-xl font-semibold text-foreground">{title}</h2>
        {badgeLabel ? (
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
            {badgeLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-pretty text-sm leading-6 text-muted">{description}</p>

      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums text-foreground">{priceLabel}</span>
        {priceUnit ? <span className="text-sm text-muted">{priceUnit}</span> : null}
      </p>

      <ul className="mt-6 space-y-3 text-sm text-foreground">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="text-pretty">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 space-y-3">
        {action}
        {secondaryAction}
      </div>
    </section>
  );
}

export default function PlansPageClient() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const t = COPY[lang];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnTarget = useMemo(
    () => resolveReturnTarget(searchParams.get('return_to')),
    [searchParams]
  );
  const fromGallery = searchParams.get('source') === 'gallery';
  const search = searchParams.toString();
  const currentPath = `${pathname}${search ? `?${search}` : ''}`;
  const isPremium = profile?.subscription_tier === 'premium';

  const handleUpgrade = async () => {
    if (!user) {
      router.push(`/auth/login?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const successPath = returnTarget
        ? `/success?return_to=${encodeURIComponent(returnTarget)}`
        : '/success';
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ successPath, cancelPath: currentPath }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (!res.ok || !data?.url) throw new Error('checkout_session_failed');
      window.location.href = data.url;
    } catch (err) {
      console.error('Failed to start upgrade checkout:', err);
      setError(t.errorMessage);
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/account/portal', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(t.errorMessage);
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      setError(t.errorMessage);
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="w-full px-4 py-10 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto h-64 max-w-5xl animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-10 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-muted">{t.eyebrow}</p>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.title}
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-base leading-7 text-muted">
            {t.description}
          </p>
        </div>

        {fromGallery && (
          <div className="rounded-xl border border-border bg-surface px-5 py-4 text-sm leading-6 text-pretty text-foreground">
            {t.galleryBanner}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <PlanCard
            title={t.freeTitle}
            description={t.freeDescription}
            priceLabel="$0"
            badgeLabel={user && !isPremium ? t.freeCurrentBadge : null}
            features={t.freeFeatures}
            action={
              !user ? (
                <button
                  type="button"
                  onClick={() => router.push(`/auth/login?next=${encodeURIComponent(currentPath)}`)}
                  className="btn-press w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
                >
                  {t.freeCtaLoggedOut}
                </button>
              ) : isPremium ? (
                <p className="rounded-lg border border-border px-4 py-3 text-center text-sm text-muted">
                  {t.freeCtaIncludedInPremium}
                </p>
              ) : null
            }
            secondaryAction={
              !user ? (
                <p className="text-center text-sm text-muted">
                  {t.freeSecondaryPrompt}{' '}
                  <Link
                    href={`/auth/login?next=${encodeURIComponent(currentPath)}`}
                    className="font-medium text-foreground transition-opacity hover:opacity-70"
                  >
                    {t.freeSecondaryLink}
                  </Link>
                </p>
              ) : null
            }
          />

          <PlanCard
            title={t.premiumTitle}
            description={t.premiumDescription}
            priceLabel="$3"
            priceUnit={t.premiumPriceUnit}
            badgeLabel={isPremium ? t.premiumCurrentBadge : null}
            highlighted
            features={t.premiumFeatures}
            action={
              <button
                type="button"
                onClick={() => void (isPremium ? handleManageSubscription() : handleUpgrade())}
                disabled={loading}
                className="btn-press w-full rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {loading
                  ? t.loading
                  : !user
                    ? t.premiumCtaLoggedOut
                    : isPremium
                      ? t.premiumCtaManage
                      : t.premiumCtaUpgrade}
              </button>
            }
          />
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6 sm:p-7">
          <h2 className="text-base font-semibold text-foreground">{t.singlePurchaseTitle}</h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-muted">
            {t.singlePurchaseDescription}
          </p>
          <Link
            href="/works/episode"
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {t.singlePurchaseCta}
          </Link>
        </section>
      </div>
    </div>
  );
}
