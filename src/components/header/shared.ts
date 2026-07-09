import type { Language } from "@/context/LanguageContext";

export type SharedHeaderLanguage = Language;
export type SharedNavItemKey =
  | "episodes"
  | "imagine"
  | "club"
  | "store"
  | "about";
export type SharedAccountItemKey =
  | "account"
  | "adminDashboard"
  | "contentFactory"
  | "addEpisode"
  | "logout";

export const sharedNavItems: Array<{
  key: SharedNavItemKey;
  href: string;
  external?: boolean;
}> = [
  { key: "episodes", href: "/works/episode" },
  { key: "imagine", href: "/imagine" },
  { key: "club", href: "/the-club" },
  { key: "store", href: "https://whatif.stores.jp", external: true },
  { key: "about", href: "/about" },
];

export const sharedSocialLinks = [
  {
    href: "https://www.instagram.com/whatif.ep/",
    label: "Instagram",
  },
  {
    href: "https://www.threads.com/@whatif.ep",
    label: "Threads",
  },
];

export const sharedChromeCopy: Record<
  SharedHeaderLanguage,
  Record<
    SharedAccountItemKey | "menu" | "login",
    string
  >
> = {
  en: {
    menu: "Menu",
    login: "Log in",
    logout: "Log out",
    account: "My account",
    adminDashboard: "Admin dashboard",
    contentFactory: "Content Factory",
    addEpisode: "Add episode",
  },
  ja: {
    menu: "メニュー",
    login: "ログイン",
    logout: "ログアウト",
    account: "マイアカウント",
    adminDashboard: "Admin Dashboard",
    contentFactory: "Content Factory",
    addEpisode: "エピソードを追加",
  },
  "zh-CN": {
    menu: "菜单",
    login: "登录",
    logout: "退出登录",
    account: "我的账户",
    adminDashboard: "管理后台",
    contentFactory: "Content Factory",
    addEpisode: "添加作品",
  },
  "zh-TW": {
    menu: "選單",
    login: "登入",
    logout: "登出",
    account: "我的帳戶",
    adminDashboard: "管理後台",
    contentFactory: "Content Factory",
    addEpisode: "新增作品",
  },
  ko: {
    menu: "메뉴",
    login: "로그인",
    logout: "로그아웃",
    account: "내 계정",
    adminDashboard: "관리 대시보드",
    contentFactory: "Content Factory",
    addEpisode: "에피소드 추가",
  },
};

export const sharedNavCopy: Record<
  SharedHeaderLanguage,
  Record<SharedNavItemKey, { label: string; description: string }>
> = {
  en: {
    episodes: {
      label: "EPISODES",
      description:
        "A gallery of WHATIF artworks shared on Instagram and Threads. Selected images are available for download.",
    },
    imagine: {
      label: "/IMAGINE",
      description:
        "A free design site where you can create illustrations from 99% complete design kits. Build original designs using WHATIF artwork assets.",
    },
    club: {
      label: "THE CLUB",
      description:
        "A members-only wallpaper download service for Instagram subscription members. Accounts are now shared with Imagine, and paid Imagine users get unlimited wallpaper downloads.",
    },
    store: {
      label: "STORE",
      description:
        "Shop fashion items like T-shirts and sweatshirts featuring WHATIF artwork, plus downloadable items such as wallpapers and digital books.",
    },
    about: {
      label: "ABOUT",
      description:
        "The story behind WHATIF — an AI-driven art project. Learn who we are and what we make.",
    },
  },
  ja: {
    episodes: {
      label: "エピソード",
      description:
        "Instagram と Threads で公開している WHATIF のアートワークギャラリーです。一部画像はダウンロードできます。",
    },
    imagine: {
      label: "Imagine",
      description:
        "99%完成済みのデザインキットから自由にイラストを作れる無料デザインサイトです。WHATIFのアートワーク素材でオリジナルデザインを作成できます。",
    },
    club: {
      label: "ザ・クラブ",
      description:
        "会員制の壁紙ダウンロードサービスです。Instagramサブスク会員向けプランに加え、Imagineとのアカウント共有に対応しています。Imagine有料プランなら壁紙をダウンロードし放題です。",
    },
    store: {
      label: "ストア",
      description:
        "WHATIFアートワークを使ったTシャツやスウェットなどのファッションアイテムに加え、壁紙や電子書籍などのダウンロード商品も購入できます。",
    },
    about: {
      label: "ABOUT",
      description:
        "WHATIF について。AIを活用したアートプロジェクトの背景や、私たちが作っているものを紹介します。",
    },
  },
  "zh-CN": {
    episodes: {
      label: "EPISODES",
      description:
        "在 Instagram 与 Threads 上发布的 WHATIF 作品画廊。部分图片可供下载。",
    },
    imagine: {
      label: "/IMAGINE",
      description:
        "可从 99% 完成的设计套件自由创作插画的免费设计网站。使用 WHATIF 作品素材打造原创设计。",
    },
    club: {
      label: "THE CLUB",
      description:
        "面向 Instagram 订阅会员的会员制壁纸下载服务。账号现已与 Imagine 互通，Imagine 付费用户可无限下载壁纸。",
    },
    store: {
      label: "STORE",
      description:
        "选购采用 WHATIF 作品的 T 恤、卫衣等时尚单品，以及壁纸、电子书等可下载商品。",
    },
    about: {
      label: "ABOUT",
      description:
        "关于 WHATIF。介绍这个由 AI 驱动的艺术项目的背景，以及我们所创作的内容。",
    },
  },
  "zh-TW": {
    episodes: {
      label: "EPISODES",
      description:
        "在 Instagram 與 Threads 上發布的 WHATIF 作品藝廊。部分圖片可供下載。",
    },
    imagine: {
      label: "/IMAGINE",
      description:
        "可從 99% 完成的設計套件自由創作插畫的免費設計網站。使用 WHATIF 作品素材打造原創設計。",
    },
    club: {
      label: "THE CLUB",
      description:
        "面向 Instagram 訂閱會員的會員制桌布下載服務。帳號現已與 Imagine 互通，Imagine 付費使用者可無限下載桌布。",
    },
    store: {
      label: "STORE",
      description:
        "選購採用 WHATIF 作品的 T 恤、衛衣等時尚單品，以及桌布、電子書等可下載商品。",
    },
    about: {
      label: "ABOUT",
      description:
        "關於 WHATIF。介紹這個由 AI 驅動的藝術專案的背景，以及我們所創作的內容。",
    },
  },
  ko: {
    episodes: {
      label: "EPISODES",
      description:
        "Instagram과 Threads에 공개한 WHATIF 아트워크 갤러리입니다. 일부 이미지는 다운로드할 수 있습니다.",
    },
    imagine: {
      label: "/IMAGINE",
      description:
        "99% 완성된 디자인 키트로 자유롭게 일러스트를 만들 수 있는 무료 디자인 사이트입니다. WHATIF 아트워크 소재로 오리지널 디자인을 제작하세요.",
    },
    club: {
      label: "THE CLUB",
      description:
        "Instagram 구독 회원을 위한 회원제 배경화면 다운로드 서비스입니다. 이제 Imagine과 계정을 공유하며, Imagine 유료 회원은 배경화면을 무제한으로 다운로드할 수 있습니다.",
    },
    store: {
      label: "STORE",
      description:
        "WHATIF 아트워크를 활용한 티셔츠, 스웨트셔츠 등 패션 아이템과 배경화면, 전자책 등 다운로드 상품을 구매할 수 있습니다.",
    },
    about: {
      label: "ABOUT",
      description:
        "WHATIF 소개. AI를 활용한 아트 프로젝트의 배경과 우리가 만드는 것을 소개합니다.",
    },
  },
};

export function resolveSharedHeaderLanguage(language: string | undefined): SharedHeaderLanguage {
  if (!language) return "en";
  if (language === "ja") return "ja";
  if (language === "ko") return "ko";
  if (language === "zh-TW" || language === "zh-HK" || language === "zh-Hant") {
    return "zh-TW";
  }
  if (language.startsWith("zh")) return "zh-CN";
  return "en";
}
