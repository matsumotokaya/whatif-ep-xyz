"use client";

import { useLanguage, type Language } from "@/context/LanguageContext";

const introCopy: Record<Language, string[]> = {
  en: [
    "The Club is a members-only download service.",
    "It is available only to subscribers of the WHATIF Instagram account.",
    "If you are an Instagram subscriber, please use the Instagram member entrance link below the login form.",
    "Starting in April 2026, /IMAGINE Premium members can also use The Club features.",
    "/IMAGINE Premium members can log in with the same account and enjoy unlimited downloads.",
  ],
  ja: [
    "The Club は会員制のダウンロードサービスです。",
    "WHATIF の Instagram アカウントにおけるサブスク会員のみに提供されるサービスです。",
    "サブスク会員の方は、ログインフォーム下部にある Instagram 会員専用の入り口からお入りください。",
    "2026年4月より、/IMAGINE のプレミアム会員サービス加入者も The Club の機能をご利用いただけるようになりました。",
    "/IMAGINE のプレミアム会員の方は、同じアカウントでログインいただければダウンロードし放題です。",
  ],
  "zh-CN": [
    "The Club 是会员制的下载服务。",
    "仅向 WHATIF Instagram 账号的订阅会员提供。",
    "订阅会员请通过登录表单下方的 Instagram 会员专用入口进入。",
    "自 2026 年 4 月起，/IMAGINE Premium 会员也可使用 The Club 的功能。",
    "/IMAGINE Premium 会员使用同一账号登录后，即可无限下载。",
  ],
  "zh-TW": [
    "The Club 是會員制的下載服務。",
    "僅向 WHATIF Instagram 帳號的訂閱會員提供。",
    "訂閱會員請透過登入表單下方的 Instagram 會員專用入口進入。",
    "自 2026 年 4 月起，/IMAGINE Premium 會員也可使用 The Club 的功能。",
    "/IMAGINE Premium 會員使用同一帳號登入後，即可無限下載。",
  ],
  ko: [
    "The Club은 회원제 다운로드 서비스입니다.",
    "WHATIF Instagram 계정의 구독 회원에게만 제공됩니다.",
    "구독 회원께서는 로그인 폼 하단의 Instagram 회원 전용 입구를 이용해 주세요.",
    "2026년 4월부터 /IMAGINE Premium 회원도 The Club 기능을 이용하실 수 있습니다.",
    "/IMAGINE Premium 회원은 동일한 계정으로 로그인하면 무제한으로 다운로드할 수 있습니다.",
  ],
};

export function TheClubIntroMessage() {
  const { lang } = useLanguage();

  return (
    <div className="max-w-2xl">
      <div className="space-y-3">
        {introCopy[lang].map((line) => (
          <p key={line} className="text-sm leading-7 text-muted">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
