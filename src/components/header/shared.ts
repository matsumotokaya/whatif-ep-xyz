import type { Language } from "@/context/LanguageContext";

export type SharedHeaderLanguage = Language;
export type SharedNavItemKey =
  | "works"
  | "templates"
  | "club"
  | "about";
export type SharedAccountItemKey =
  | "account"
  | "adminDashboard"
  | "contentFactory"
  | "videoFactory"
  | "lab"
  | "addEpisode"
  | "logout";

// Menu (2026-11-14): Works = the gallery (all series), Design Templates = the
// IMAGINE editor entry (/imagine). The external Store link lives in the footer.
export const sharedNavItems: Array<{
  key: SharedNavItemKey;
  href: string;
  /** Path prefix that marks the item active (defaults to href). */
  activePrefix?: string;
  external?: boolean;
}> = [
  { key: "works", href: "/works/recommend", activePrefix: "/works" },
  { key: "templates", href: "/imagine" },
  { key: "club", href: "/the-club" },
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
    videoFactory: "Video Factory",
    lab: "LAB",
    addEpisode: "Add episode",
  },
  ja: {
    menu: "メニュー",
    login: "サインイン",
    logout: "ログアウト",
    account: "マイアカウント",
    adminDashboard: "Admin Dashboard",
    contentFactory: "Content Factory",
    videoFactory: "Video Factory",
    lab: "LAB",
    addEpisode: "エピソードを追加",
  },
  "zh-CN": {
    menu: "菜单",
    login: "登录",
    logout: "退出登录",
    account: "我的账户",
    adminDashboard: "管理后台",
    contentFactory: "Content Factory",
    videoFactory: "Video Factory",
    lab: "LAB",
    addEpisode: "添加作品",
  },
  "zh-TW": {
    menu: "選單",
    login: "登入",
    logout: "登出",
    account: "我的帳戶",
    adminDashboard: "管理後台",
    contentFactory: "Content Factory",
    videoFactory: "Video Factory",
    lab: "LAB",
    addEpisode: "新增作品",
  },
  ko: {
    menu: "메뉴",
    login: "로그인",
    logout: "로그아웃",
    account: "내 계정",
    adminDashboard: "관리 대시보드",
    contentFactory: "Content Factory",
    videoFactory: "Video Factory",
    lab: "LAB",
    addEpisode: "에피소드 추가",
  },
};

// Menu labels are the same English names in every language (2026-11-14).
export const sharedNavCopy: Record<
  SharedHeaderLanguage,
  Record<SharedNavItemKey, { label: string; description: string }>
> = {
  en: {
    works: {
      label: "WORKS",
      description:
        "A gallery of WHATIF artworks and short videos shared on Instagram and Threads. Selected images are available for download.",
    },
    templates: {
      label: "DESIGN TEMPLATES",
      description:
        "Free design templates built from WHATIF artwork. Start from a 99% complete design and make it your own.",
    },
    club: {
      label: "THE CLUB",
      description:
        "A members-only wallpaper download service for Instagram subscription members. Accounts are now shared with Imagine, and paid Imagine users get unlimited wallpaper downloads.",
    },
    about: {
      label: "ABOUT",
      description:
        "The story behind WHATIF — an AI-driven art project. Learn who we are and what we make.",
    },
  },
  ja: {
    works: {
      label: "WORKS",
      description:
        "Instagram と Threads で公開している WHATIF のアートワークとショート動画のギャラリーです。一部画像はダウンロードできます。",
    },
    templates: {
      label: "DESIGN TEMPLATES",
      description:
        "WHATIF のアートワークで作られた無料のデザインテンプレートです。99%完成済みのデザインから、自分だけのデザインに仕上げられます。",
    },
    club: {
      label: "THE CLUB",
      description:
        "会員制の壁紙ダウンロードサービスです。Instagramサブスク会員向けプランに加え、Imagineとのアカウント共有に対応しています。Imagine有料プランなら壁紙をダウンロードし放題です。",
    },
    about: {
      label: "ABOUT",
      description:
        "WHATIF について。AIを活用したアートプロジェクトの背景や、私たちが作っているものを紹介します。",
    },
  },
  "zh-CN": {
    works: {
      label: "WORKS",
      description:
        "在 Instagram 与 Threads 上发布的 WHATIF 作品与短视频画廊。部分图片可供下载。",
    },
    templates: {
      label: "DESIGN TEMPLATES",
      description:
        "以 WHATIF 作品制作的免费设计模板。从 99% 完成的设计开始，打造属于你的设计。",
    },
    club: {
      label: "THE CLUB",
      description:
        "面向 Instagram 订阅会员的会员制壁纸下载服务。账号现已与 Imagine 互通，Imagine 付费用户可无限下载壁纸。",
    },
    about: {
      label: "ABOUT",
      description:
        "关于 WHATIF。介绍这个由 AI 驱动的艺术项目的背景，以及我们所创作的内容。",
    },
  },
  "zh-TW": {
    works: {
      label: "WORKS",
      description:
        "在 Instagram 與 Threads 上發布的 WHATIF 作品與短影片藝廊。部分圖片可供下載。",
    },
    templates: {
      label: "DESIGN TEMPLATES",
      description:
        "以 WHATIF 作品製作的免費設計範本。從 99% 完成的設計開始，打造屬於你的設計。",
    },
    club: {
      label: "THE CLUB",
      description:
        "面向 Instagram 訂閱會員的會員制桌布下載服務。帳號現已與 Imagine 互通，Imagine 付費使用者可無限下載桌布。",
    },
    about: {
      label: "ABOUT",
      description:
        "關於 WHATIF。介紹這個由 AI 驅動的藝術專案的背景，以及我們所創作的內容。",
    },
  },
  ko: {
    works: {
      label: "WORKS",
      description:
        "Instagram과 Threads에 공개한 WHATIF 아트워크와 숏폼 영상 갤러리입니다. 일부 이미지는 다운로드할 수 있습니다.",
    },
    templates: {
      label: "DESIGN TEMPLATES",
      description:
        "WHATIF 아트워크로 만든 무료 디자인 템플릿입니다. 99% 완성된 디자인에서 시작해 나만의 디자인으로 완성하세요.",
    },
    club: {
      label: "THE CLUB",
      description:
        "Instagram 구독 회원을 위한 회원제 배경화면 다운로드 서비스입니다. 이제 Imagine과 계정을 공유하며, Imagine 유료 회원은 배경화면을 무제한으로 다운로드할 수 있습니다.",
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
