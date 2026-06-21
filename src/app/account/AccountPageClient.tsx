"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, type Language } from "@/context/LanguageContext";
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
  contactUrl: string | null;
  contactEmail: string | null;
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
  planLegacyDesc: string;
  planImagineDesc: string;
  statusActive: string;
  statusCanceling: string;
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
  // Library / saved works.
  library: string;
  libraryDesc: string;
  libraryCta: string;
  savedWorks: string;
  savedWorksDesc: string;
  savedWorksCta: string;
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
      "You are on the free plan. Upgrade to access The Club wallpaper library.",
    planStripeDesc:
      "You have an active premium subscription with unlimited wallpaper downloads.",
    planLegacyDesc:
      "Your premium access comes from your original Instagram subscription membership.",
    planImagineDesc:
      "Your premium access is linked from your /IMAGINE premium account.",
    statusActive: "Active",
    statusCanceling: "Cancels at period end",
    statusCanceled: "Canceled",
    renewsOn: "Renews on",
    endsOn: "Ends on",
    upgradeCta: "Upgrade in /IMAGINE",
    manageBilling: "Manage subscription",
    manageBillingDesc:
      "Cancel your subscription or update your payment method via the secure Stripe portal.",
    purchases: "Purchase history",
    purchasesEmpty: "No purchases yet.",
    variant: "Variant",
    library: "The Club library",
    libraryDesc: "Browse and download member wallpapers.",
    libraryCta: "Open library",
    savedWorks: "Saved works",
    savedWorksDesc: "Artworks you have bookmarked.",
    savedWorksCta: "View gallery",
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
      "現在は無料プランです。アップグレードするとザ・クラブの壁紙ライブラリを利用できます。",
    planStripeDesc:
      "プレミアムサブスクリプションが有効です。壁紙をダウンロードし放題です。",
    planLegacyDesc:
      "Instagram サブスク会員からの移行により、プレミアム機能をご利用いただけます。",
    planImagineDesc:
      "/IMAGINE のプレミアムアカウント連携により、プレミアム機能をご利用いただけます。",
    statusActive: "有効",
    statusCanceling: "期間終了時に解約予定",
    statusCanceled: "解約済み",
    renewsOn: "更新日",
    endsOn: "終了日",
    upgradeCta: "/IMAGINE でアップグレード",
    manageBilling: "サブスクリプション管理",
    manageBillingDesc:
      "Stripe のセキュアなポータルから解約や支払い方法の変更ができます。",
    purchases: "購入履歴",
    purchasesEmpty: "購入履歴はまだありません。",
    variant: "バリエーション",
    library: "ザ・クラブ ライブラリ",
    libraryDesc: "会員向け壁紙を閲覧・ダウンロードできます。",
    libraryCta: "ライブラリを開く",
    savedWorks: "保存した作品",
    savedWorksDesc: "ブックマークしたアートワークです。",
    savedWorksCta: "ギャラリーを見る",
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
    planFreeDesc: "您当前为免费方案。升级即可使用 The Club 壁纸库。",
    planStripeDesc: "您的高级订阅有效，可无限下载壁纸。",
    planLegacyDesc: "您的高级权限来自原 Instagram 订阅会员。",
    planImagineDesc: "您的高级权限来自 /IMAGINE 高级账户的关联。",
    statusActive: "有效",
    statusCanceling: "将于本期结束时取消",
    statusCanceled: "已取消",
    renewsOn: "续费日期",
    endsOn: "结束日期",
    upgradeCta: "在 /IMAGINE 升级",
    manageBilling: "管理订阅",
    manageBillingDesc: "通过安全的 Stripe 门户取消订阅或更新付款方式。",
    purchases: "购买记录",
    purchasesEmpty: "暂无购买记录。",
    variant: "版本",
    library: "The Club 壁纸库",
    libraryDesc: "浏览并下载会员壁纸。",
    libraryCta: "打开壁纸库",
    savedWorks: "已保存作品",
    savedWorksDesc: "您收藏的作品。",
    savedWorksCta: "查看画廊",
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
    planFreeDesc: "您目前為免費方案。升級即可使用 The Club 桌布庫。",
    planStripeDesc: "您的進階訂閱有效，可無限下載桌布。",
    planLegacyDesc: "您的進階權限來自原 Instagram 訂閱會員。",
    planImagineDesc: "您的進階權限來自 /IMAGINE 進階帳戶的連結。",
    statusActive: "有效",
    statusCanceling: "將於本期結束時取消",
    statusCanceled: "已取消",
    renewsOn: "續訂日期",
    endsOn: "結束日期",
    upgradeCta: "在 /IMAGINE 升級",
    manageBilling: "管理訂閱",
    manageBillingDesc: "透過安全的 Stripe 入口取消訂閱或更新付款方式。",
    purchases: "購買紀錄",
    purchasesEmpty: "尚無購買紀錄。",
    variant: "版本",
    library: "The Club 桌布庫",
    libraryDesc: "瀏覽並下載會員桌布。",
    libraryCta: "開啟桌布庫",
    savedWorks: "已儲存作品",
    savedWorksDesc: "您收藏的作品。",
    savedWorksCta: "查看藝廊",
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
      "현재 무료 플랜입니다. 업그레이드하면 The Club 배경화면 라이브러리를 이용할 수 있습니다.",
    planStripeDesc:
      "프리미엄 구독이 활성화되어 있어 배경화면을 무제한 다운로드할 수 있습니다.",
    planLegacyDesc:
      "기존 Instagram 구독 회원에서 이전되어 프리미엄 기능을 이용하실 수 있습니다.",
    planImagineDesc:
      "/IMAGINE 프리미엄 계정 연동으로 프리미엄 기능을 이용하실 수 있습니다.",
    statusActive: "활성",
    statusCanceling: "기간 종료 시 해지 예정",
    statusCanceled: "해지됨",
    renewsOn: "갱신일",
    endsOn: "종료일",
    upgradeCta: "/IMAGINE에서 업그레이드",
    manageBilling: "구독 관리",
    manageBillingDesc:
      "안전한 Stripe 포털에서 구독 해지나 결제 수단 변경을 할 수 있습니다.",
    purchases: "구매 내역",
    purchasesEmpty: "아직 구매 내역이 없습니다.",
    variant: "버전",
    library: "The Club 라이브러리",
    libraryDesc: "회원 배경화면을 둘러보고 다운로드하세요.",
    libraryCta: "라이브러리 열기",
    savedWorks: "저장한 작품",
    savedWorksDesc: "북마크한 작품입니다.",
    savedWorksCta: "갤러리 보기",
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

const IMAGINE_UPGRADE_URL = "https://app.whatif-ep.xyz/upgrade";

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

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 7l4 4 5-7 5 7 4-4-1.6 11H4.6L3 7zm1.8 13h14.4v1.2a.8.8 0 01-.8.8H5.6a.8.8 0 01-.8-.8V20z" />
    </svg>
  );
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
        ? t.planStripeDesc
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

  const contactHref = view.contactUrl
    ? view.contactUrl
    : view.contactEmail
      ? `mailto:${view.contactEmail}`
      : null;

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
                  <CrownIcon className="h-3.5 w-3.5" />
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
              <CrownIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            )}
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">
                {planLabel}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">{planDesc}</p>

              {statusLabel && (
                <p className="mt-3 text-xs text-muted">
                  <span className="font-medium text-foreground">
                    {statusLabel}
                  </span>
                  {view.subscriptionExpiresAt && (
                    <>
                      {" · "}
                      {view.subscriptionStatus === "canceling" ||
                      view.subscriptionStatus === "canceled"
                        ? t.endsOn
                        : t.renewsOn}{" "}
                      {formatDate(view.subscriptionExpiresAt, lang)}
                    </>
                  )}
                </p>
              )}

              {view.membership === "free" && (
                <a
                  href={IMAGINE_UPGRADE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press mt-4 inline-flex items-center justify-center rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
                >
                  {t.upgradeCta}
                </a>
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

        {/* Library + saved works links */}
        <SectionCard title={t.membership}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/the-club/library"
              className="group flex flex-col rounded-xl border border-border p-4 transition-colors hover:bg-surface-hover"
            >
              <span className="text-sm font-semibold text-foreground">
                {t.library}
              </span>
              <span className="mt-1 text-xs leading-5 text-muted">
                {t.libraryDesc}
              </span>
              <span className="mt-3 text-xs font-medium text-foreground">
                {t.libraryCta} →
              </span>
            </Link>
            <Link
              href="/works/episode"
              className="group flex flex-col rounded-xl border border-border p-4 transition-colors hover:bg-surface-hover"
            >
              <span className="text-sm font-semibold text-foreground">
                {t.savedWorks}
              </span>
              <span className="mt-1 text-xs leading-5 text-muted">
                {t.savedWorksDesc}
              </span>
              <span className="mt-3 text-xs font-medium text-foreground">
                {t.savedWorksCta} →
              </span>
            </Link>
          </div>
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
          {contactHref && (
            <a
              href={contactHref}
              {...(view.contactUrl
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="btn-press mt-4 inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              {t.contactCta}
            </a>
          )}
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
            />
          </div>
        </section>
      </div>
    </div>
  );
}
