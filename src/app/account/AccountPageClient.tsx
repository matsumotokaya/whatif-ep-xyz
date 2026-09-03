"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, type Language } from "@/context/LanguageContext";
import { PremiumCrown } from "@/components/PremiumCrown";
import type { MembershipKind } from "@/lib/account/membership";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { ManageSubscriptionButton } from "./ManageSubscriptionButton";

export interface PurchaseView {
  id: string;
  seriesSlug: string | null;
  displayCode: string | null;
  variantNumber: number | null;
  amount: number | null;
  currency: string | null;
  purchasedAt: string | null;
}

export interface AccountView {
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  providers: string[];
  legacyLoginId: string | null;
  createdAt: string | null;
  membership: MembershipKind;
  subscriptionStatus: "active" | "canceling" | "canceled" | null;
  subscriptionExpiresAt: string | null;
  hasStripeCustomer: boolean;
  purchases: PurchaseView[];
}

interface AccountCopy {
  eyebrow: string;
  title: string;
  // Account info section.
  accountInfo: string;
  emailLabel: string;
  loginMethodLabel: string;
  providerEmail: string;
  providerGoogle: string;
  providerLegacy: string;
  legacyIdLabel: string;
  memberSinceLabel: string;
  // Membership section.
  membership: string;
  planFree: string;
  planStripe: string;
  planLegacy: string;
  planImagine: string;
  planFreeDesc: string;
  planStripeDesc: string;
  planStripeCancelingDesc: string;
  planLegacyDesc: string;
  planImagineDesc: string;
  statusActive: string;
  statusCanceling: string;
  statusCancelingDesc: string;
  statusCanceled: string;
  renewsOn: string;
  endsOn: string;
  upgradeCta: string;
  // Subscription management.
  manageBilling: string;
  manageBillingDesc: string;
  // Purchases.
  purchases: string;
  purchasesEmpty: string;
  variant: string;
  // Support.
  support: string;
  supportDesc: string;
  contactCta: string;
  // Session.
  session: string;
  logout: string;
  // Danger zone.
  dangerZone: string;
  deleteAccount: string;
  deleteAccountDesc: string;
}

// Full localized strings for the account (My Page) screen, in the 5 supported
// languages. Kept inline (Record<Language, ...>) per the project i18n pattern.
const COPY: Record<Language, AccountCopy> = {
  en: {
    eyebrow: "Account",
    title: "My Account",
    accountInfo: "Account information",
    emailLabel: "Email",
    loginMethodLabel: "Login method",
    providerEmail: "Email & password",
    providerGoogle: "Google",
    providerLegacy: "Legacy member ID",
    legacyIdLabel: "Member ID",
    memberSinceLabel: "Member since",
    membership: "Membership",
    planFree: "Free",
    planStripe: "Premium",
    planLegacy: "Premium (Legacy member)",
    planImagine: "Premium (/IMAGINE)",
    planFreeDesc:
      "You are on the free plan. Upgrading to Premium unlocks unlimited downloads of all paid content in the WHATIF gallery, plus access to premium assets and more in the IMAGINE design tool.",
    planStripeDesc:
      "You have an active premium subscription with unlimited wallpaper downloads.",
    planStripeCancelingDesc:
      "Your subscription is canceled. You can keep using Premium until your current billing period ends.",
    planLegacyDesc:
      "Your premium access comes from your original Instagram subscription membership.",
    planImagineDesc:
      "Your premium access is linked from your /IMAGINE premium account.",
    statusActive: "Active",
    statusCanceling: "Canceled",
    statusCancelingDesc: "Premium access remains available until the date below.",
    statusCanceled: "Canceled",
    renewsOn: "Renews on",
    endsOn: "Ends on",
    upgradeCta: "Premium plan ($3)",
    manageBilling: "Manage subscription",
    manageBillingDesc:
      "Cancel your subscription or update your payment method via the secure Stripe portal.",
    purchases: "Purchase history",
    purchasesEmpty: "No purchases yet.",
    variant: "Variant",
    support: "Support",
    supportDesc: "Questions or issues? Get in touch.",
    contactCta: "Contact us",
    session: "Session",
    logout: "Log out",
    dangerZone: "Danger zone",
    deleteAccount: "Delete account",
    deleteAccountDesc:
      "Permanently delete your account and personal data. This cannot be undone.",
  },
  ja: {
    eyebrow: "アカウント",
    title: "マイアカウント",
    accountInfo: "アカウント情報",
    emailLabel: "メールアドレス",
    loginMethodLabel: "ログイン方法",
    providerEmail: "メールアドレス + パスワード",
    providerGoogle: "Google",
    providerLegacy: "旧会員ID",
    legacyIdLabel: "会員ID",
    memberSinceLabel: "登録日",
    membership: "メンバーシップ",
    planFree: "無料プラン",
    planStripe: "プレミアム",
    planLegacy: "プレミアム（旧会員）",
    planImagine: "プレミアム（/IMAGINE）",
    planFreeDesc:
      "現在は無料プランです。プレミアムプランにアップグレードするとWHATIFギャラリーのすべての有料コンテンツがダウンロードし放題になります。またデザインツール IMAGINE のプレミアムアセットへのアクセスなど、様々な機能が開放されます。",
    planStripeDesc:
      "プレミアムサブスクリプションが有効です。壁紙をダウンロードし放題です。",
    planStripeCancelingDesc:
      "サブスクリプションは解約済みです。現在の契約期間が終わるまでPremiumをご利用いただけます。",
    planLegacyDesc:
      "Instagram サブスク会員からの移行により、プレミアム機能をご利用いただけます。",
    planImagineDesc:
      "/IMAGINE のプレミアムアカウント連携により、プレミアム機能をご利用いただけます。",
    statusActive: "有効",
    statusCanceling: "解約済み",
    statusCancelingDesc: "以下の利用終了日まではPremiumをご利用いただけます。",
    statusCanceled: "解約済み",
    renewsOn: "更新日",
    endsOn: "終了日",
    upgradeCta: "プレミアムプラン ($3)",
    manageBilling: "サブスクリプション管理",
    manageBillingDesc:
      "Stripe のセキュアなポータルから解約や支払い方法の変更ができます。",
    purchases: "購入履歴",
    purchasesEmpty: "購入履歴はまだありません。",
    variant: "バリエーション",
    support: "サポート",
    supportDesc: "ご質問やお困りごとはこちらから。",
    contactCta: "お問い合わせ",
    session: "セッション",
    logout: "ログアウト",
    dangerZone: "危険な操作",
    deleteAccount: "アカウントを削除",
    deleteAccountDesc:
      "アカウントと個人データを完全に削除します。この操作は取り消せません。",
  },
  "zh-CN": {
    eyebrow: "账户",
    title: "我的账户",
    accountInfo: "账户信息",
    emailLabel: "邮箱",
    loginMethodLabel: "登录方式",
    providerEmail: "邮箱 + 密码",
    providerGoogle: "Google",
    providerLegacy: "旧会员 ID",
    legacyIdLabel: "会员 ID",
    memberSinceLabel: "注册日期",
    membership: "会员资格",
    planFree: "免费方案",
    planStripe: "高级会员",
    planLegacy: "高级会员（旧会员）",
    planImagine: "高级会员（/IMAGINE）",
    planFreeDesc:
      "您当前为免费方案。升级到高级方案后，可无限下载 WHATIF 画廊的所有付费内容，并开放设计工具 IMAGINE 的高级素材访问等多项功能。",
    planStripeDesc: "您的高级订阅有效，可无限下载壁纸。",
    planStripeCancelingDesc: "您的订阅已取消。在当前计费周期结束前，仍可使用高级会员功能。",
    planLegacyDesc: "您的高级权限来自原 Instagram 订阅会员。",
    planImagineDesc: "您的高级权限来自 /IMAGINE 高级账户的关联。",
    statusActive: "有效",
    statusCanceling: "已取消",
    statusCancelingDesc: "在以下日期前仍可使用高级会员功能。",
    statusCanceled: "已取消",
    renewsOn: "续费日期",
    endsOn: "结束日期",
    upgradeCta: "高级方案 ($3)",
    manageBilling: "管理订阅",
    manageBillingDesc: "通过安全的 Stripe 门户取消订阅或更新付款方式。",
    purchases: "购买记录",
    purchasesEmpty: "暂无购买记录。",
    variant: "版本",
    support: "支持",
    supportDesc: "有疑问或问题？请联系我们。",
    contactCta: "联系我们",
    session: "会话",
    logout: "退出登录",
    dangerZone: "危险操作",
    deleteAccount: "删除账户",
    deleteAccountDesc: "永久删除您的账户与个人数据。此操作无法撤销。",
  },
  "zh-TW": {
    eyebrow: "帳戶",
    title: "我的帳戶",
    accountInfo: "帳戶資訊",
    emailLabel: "電子郵件",
    loginMethodLabel: "登入方式",
    providerEmail: "電子郵件 + 密碼",
    providerGoogle: "Google",
    providerLegacy: "舊會員 ID",
    legacyIdLabel: "會員 ID",
    memberSinceLabel: "註冊日期",
    membership: "會員資格",
    planFree: "免費方案",
    planStripe: "進階會員",
    planLegacy: "進階會員（舊會員）",
    planImagine: "進階會員（/IMAGINE）",
    planFreeDesc:
      "您目前為免費方案。升級為進階方案後，可無限下載 WHATIF 藝廊的所有付費內容，並開放設計工具 IMAGINE 的進階素材存取等多項功能。",
    planStripeDesc: "您的進階訂閱有效，可無限下載桌布。",
    planStripeCancelingDesc: "您的訂閱已取消。在目前計費週期結束前，仍可使用進階會員功能。",
    planLegacyDesc: "您的進階權限來自原 Instagram 訂閱會員。",
    planImagineDesc: "您的進階權限來自 /IMAGINE 進階帳戶的連結。",
    statusActive: "有效",
    statusCanceling: "已取消",
    statusCancelingDesc: "在以下日期前仍可使用進階會員功能。",
    statusCanceled: "已取消",
    renewsOn: "續訂日期",
    endsOn: "結束日期",
    upgradeCta: "進階方案 ($3)",
    manageBilling: "管理訂閱",
    manageBillingDesc: "透過安全的 Stripe 入口取消訂閱或更新付款方式。",
    purchases: "購買紀錄",
    purchasesEmpty: "尚無購買紀錄。",
    variant: "版本",
    support: "支援",
    supportDesc: "有疑問或問題？請與我們聯絡。",
    contactCta: "聯絡我們",
    session: "工作階段",
    logout: "登出",
    dangerZone: "危險操作",
    deleteAccount: "刪除帳戶",
    deleteAccountDesc: "永久刪除您的帳戶與個人資料。此操作無法復原。",
  },
  ko: {
    eyebrow: "계정",
    title: "내 계정",
    accountInfo: "계정 정보",
    emailLabel: "이메일",
    loginMethodLabel: "로그인 방법",
    providerEmail: "이메일 + 비밀번호",
    providerGoogle: "Google",
    providerLegacy: "기존 회원 ID",
    legacyIdLabel: "회원 ID",
    memberSinceLabel: "가입일",
    membership: "멤버십",
    planFree: "무료 플랜",
    planStripe: "프리미엄",
    planLegacy: "프리미엄(기존 회원)",
    planImagine: "프리미엄(/IMAGINE)",
    planFreeDesc:
      "현재 무료 플랜입니다. 프리미엄 플랜으로 업그레이드하면 WHATIF 갤러리의 모든 유료 콘텐츠를 무제한으로 다운로드할 수 있고, 디자인 툴 IMAGINE의 프리미엄 에셋 이용 등 다양한 기능이 열립니다.",
    planStripeDesc:
      "프리미엄 구독이 활성화되어 있어 배경화면을 무제한 다운로드할 수 있습니다.",
    planStripeCancelingDesc:
      "구독이 해지되었습니다. 현재 결제 기간이 끝날 때까지 프리미엄 기능을 계속 이용할 수 있습니다.",
    planLegacyDesc:
      "기존 Instagram 구독 회원에서 이전되어 프리미엄 기능을 이용하실 수 있습니다.",
    planImagineDesc:
      "/IMAGINE 프리미엄 계정 연동으로 프리미엄 기능을 이용하실 수 있습니다.",
    statusActive: "활성",
    statusCanceling: "해지됨",
    statusCancelingDesc: "아래 날짜까지 프리미엄 기능을 계속 이용할 수 있습니다.",
    statusCanceled: "해지됨",
    renewsOn: "갱신일",
    endsOn: "종료일",
    upgradeCta: "프리미엄 플랜 ($3)",
    manageBilling: "구독 관리",
    manageBillingDesc:
      "안전한 Stripe 포털에서 구독 해지나 결제 수단 변경을 할 수 있습니다.",
    purchases: "구매 내역",
    purchasesEmpty: "아직 구매 내역이 없습니다.",
    variant: "버전",
    support: "지원",
    supportDesc: "문의나 문제가 있으신가요? 연락 주세요.",
    contactCta: "문의하기",
    session: "세션",
    logout: "로그아웃",
    dangerZone: "위험 구역",
    deleteAccount: "계정 삭제",
    deleteAccountDesc:
      "계정과 개인 데이터를 영구적으로 삭제합니다. 되돌릴 수 없습니다.",
  },
};

// Locale tags for Intl date/number formatting per app language.
const LOCALE_TAG: Record<Language, string> = {
  en: "en-US",
  ja: "ja-JP",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  ko: "ko-KR",
};

const IMAGINE_UPGRADE_URL = "/plans";

function formatDate(iso: string | null, lang: Language): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE_TAG[lang], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

// Stripe amounts are stored in the currency's minor unit (cents). Format with
// the row's own currency so mixed-currency histories render correctly.
function formatAmount(
  amount: number | null,
  currency: string | null,
  lang: Language
): string {
  if (amount == null || !currency) return "—";
  try {
    return new Intl.NumberFormat(LOCALE_TAG[lang], {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${amount / 100} ${currency.toUpperCase()}`;
  }
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

export default function AccountPageClient({ view }: { view: AccountView }) {
  const { lang } = useLanguage();
  const t = COPY[lang];
  const { signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const isPremium = view.membership !== "free";

  const planLabel =
    view.membership === "free"
      ? t.planFree
      : view.membership === "stripe_premium"
        ? t.planStripe
        : view.membership === "legacy_premium"
          ? t.planLegacy
          : t.planImagine;

  const planDesc =
    view.membership === "free"
      ? t.planFreeDesc
      : view.membership === "stripe_premium"
        ? view.subscriptionStatus === "canceling"
          ? t.planStripeCancelingDesc
          : t.planStripeDesc
        : view.membership === "legacy_premium"
          ? t.planLegacyDesc
          : t.planImagineDesc;

  const providerLabels = view.providers.map((provider) => {
    if (provider === "google") return t.providerGoogle;
    if (provider === "email") return t.providerEmail;
    return provider;
  });
  // Legacy members sign in with an internal email; show the friendly label.
  const loginMethod = view.legacyLoginId
    ? t.providerLegacy
    : providerLabels.length > 0
      ? providerLabels.join(", ")
      : t.providerEmail;

  const statusLabel =
    view.subscriptionStatus === "active"
      ? t.statusActive
      : view.subscriptionStatus === "canceling"
        ? t.statusCanceling
        : view.subscriptionStatus === "canceled"
          ? t.statusCanceled
          : null;

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="w-full px-4 py-10 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {/* Header */}
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-muted">
            {t.eyebrow}
          </p>
          <div className="flex items-center gap-4">
            {view.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.avatarUrl}
                alt={view.displayName}
                className="h-14 w-14 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-xl font-bold text-background">
                {view.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {view.displayName}
              </h1>
              {isPremium && (
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-500">
                  <PremiumCrown className="h-3.5 w-3.5" />
                  {planLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Account information */}
        <SectionCard title={t.accountInfo}>
          <dl>
            <InfoRow label={t.emailLabel} value={view.email ?? "—"} />
            <InfoRow label={t.loginMethodLabel} value={loginMethod} />
            {view.legacyLoginId && (
              <InfoRow label={t.legacyIdLabel} value={view.legacyLoginId} />
            )}
            <InfoRow
              label={t.memberSinceLabel}
              value={formatDate(view.createdAt, lang)}
            />
          </dl>
        </SectionCard>

        {/* Membership */}
        <SectionCard title={t.membership}>
          <div className="flex items-start gap-3">
            {isPremium && (
              <PremiumCrown className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            )}
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">
                {planLabel}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">{planDesc}</p>

              {statusLabel && (
                <div className="mt-3 text-xs text-muted">
                  <p className="font-medium text-foreground">{statusLabel}</p>
                  {view.subscriptionStatus === "canceling" && (
                    <p className="mt-1 leading-5">{t.statusCancelingDesc}</p>
                  )}
                  {view.subscriptionExpiresAt && (
                    <p className="mt-1 tabular-nums">
                      {view.subscriptionStatus === "canceling" ||
                      view.subscriptionStatus === "canceled"
                        ? t.endsOn
                        : t.renewsOn}{" "}
                      {formatDate(view.subscriptionExpiresAt, lang)}
                    </p>
                  )}
                </div>
              )}

              {view.membership === "free" && (
                <Link
                  href={IMAGINE_UPGRADE_URL}
                  className="btn-press mt-4 inline-flex items-center justify-center rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
                >
                  {t.upgradeCta}
                </Link>
              )}
            </div>
          </div>

          {/* Stripe billing portal — only for Stripe-backed subscriptions. */}
          {view.hasStripeCustomer && (
            <div className="mt-6 border-t border-border pt-6">
              <p className="text-sm font-medium text-foreground">
                {t.manageBilling}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {t.manageBillingDesc}
              </p>
              <ManageSubscriptionButton label={t.manageBilling} />
            </div>
          )}
        </SectionCard>

        {/* Purchase history */}
        <SectionCard title={t.purchases}>
          {view.purchases.length === 0 ? (
            <p className="text-sm text-muted">{t.purchasesEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {view.purchases.map((purchase) => {
                const code = purchase.displayCode ?? purchase.id.slice(0, 8);
                const href =
                  purchase.seriesSlug && purchase.displayCode
                    ? `/works/${purchase.seriesSlug}/${purchase.displayCode}/wallpaper${
                        purchase.variantNumber
                          ? `?variant=${purchase.variantNumber}`
                          : ""
                      }`
                    : null;
                const inner = (
                  <>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {code}
                        {purchase.variantNumber
                          ? ` · ${t.variant} ${purchase.variantNumber}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(purchase.purchasedAt, lang)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-foreground">
                      {formatAmount(purchase.amount, purchase.currency, lang)}
                    </span>
                  </>
                );
                return (
                  <li key={purchase.id}>
                    {href ? (
                      <Link
                        href={href}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-surface-hover"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* Support */}
        <SectionCard title={t.support}>
          <p className="text-sm text-muted">{t.supportDesc}</p>
          <Link
            href="/imagine/contact"
            className="btn-press mt-4 inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {t.contactCta}
          </Link>
        </SectionCard>

        {/* Session */}
        <SectionCard title={t.session}>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="btn-press inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            {t.logout}
          </button>
        </SectionCard>

        {/* Danger zone */}
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-red-500">
            {t.dangerZone}
          </h2>
          <div className="mt-5">
            <p className="text-sm font-medium text-foreground">
              {t.deleteAccount}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {t.deleteAccountDesc}
            </p>
            <DeleteAccountDialog
              triggerLabel={t.deleteAccount}
              userEmail={view.email}
              // Only Stripe-backed members can have live billing. Legacy and
              // /IMAGINE premium have nothing to cancel, so they are not blocked.
              subscriptionActive={
                view.hasStripeCustomer &&
                view.subscriptionStatus !== null &&
                view.subscriptionStatus !== "canceled"
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
