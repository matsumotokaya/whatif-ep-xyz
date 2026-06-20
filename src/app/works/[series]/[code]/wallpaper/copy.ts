import type { Language } from "@/context/LanguageContext";

// Sales-page copy for the wallpaper pack, one entry per supported language.
// Terminology and tone follow `src/lib/wallpaper-manual.ts`. Brand tokens
// (WHATIF, IMAGINE, QHD, FULL HD, $1, $3) are kept intact across languages.
export interface WallpaperCopy {
  back: string;
  eyebrow: string;
  heroTitle: string;
  heroLead: (code: string) => string;
  heroPoints: string[];
  about: {
    eyebrow: string;
    lead: string;
    paragraphs: string[];
    stat: string;
  };
  lineupTitle: string;
  lineupNote: string;
  sample: string;
  included: string;
  oneTimeEyebrow: string;
  oneTimePrice: string;
  oneTimePriceUnit: string;
  oneTimeDesc: string;
  subEyebrow: string;
  subPrice: string;
  subPriceUnit: string;
  subDesc: string;
  premiumCta: string;
  alreadyMember: string;
  login: string;
  downloadReady: string;
  downloadReadyNote: string;
  downloadPreparing: string;
  downloadPreparingNote: string;
  downloadProgress: (percent: number) => string;
  downloadStarted: string;
  downloadError: string;
  purchasedBadge: string;
  purchasedNote: string;
  purchaseThanks: string;
  buyLine: string;
  spec: {
    mobile: string;
    desktop: string;
  };
}

export const WALLPAPER_COPY: Record<Language, WallpaperCopy> = {
  en: {
    back: "← Back to artwork",
    eyebrow: "WALLPAPER PACK",
    heroTitle: "Phone & PC Wallpaper",
    heroLead: (code: string) =>
      `A non-credit, full-size wallpaper pack for EPISODE ${code}. Includes FULL HD and QHD high-resolution files for both smartphone and desktop.`,
    heroPoints: [
      "Clean finish with no logo or credits",
      "Portrait phone & landscape PC — four sizes total",
      "High resolution from FULL HD to QHD",
    ],
    about: {
      eyebrow: "ABOUT WHATIF PWP",
      lead: "Download images you can use as phone or lock-screen wallpaper.",
      paragraphs: [
        "WHATIF PHONE WALLPAPER (WHATIF PWP) is the project that delivers every artwork from WHATIF's \"EPISODES\" series, published on Instagram, as wallpapers.",
        "For wallpaper use, each artwork is digitally remastered — including AI-based upscaling, replacement and completion of low-quality areas, noise removal, and color correction — so some details may differ from the originally published work.",
        "The package includes two resolutions: HD and QHD.",
      ],
      stat: "Created with Gen-AI, the \"EPISODES\" series has earned over 1.5 million likes in total and continues as WHATIF's flagship project.",
    },
    lineupTitle: "Included sizes",
    lineupNote: "Previews are samples. The actual delivered files have no watermark.",
    sample: "SAMPLE",
    included: "included",
    oneTimeEyebrow: "This wallpaper only",
    oneTimePrice: "$1",
    oneTimePriceUnit: "one-time purchase",
    oneTimeDesc:
      "Download just this wallpaper pack (all 4 sizes) for $1. No subscription required — simply buy the one you like.",
    subEyebrow: "All wallpapers",
    subPrice: "$3",
    subPriceUnit: "/ month",
    subDesc:
      "With IMAGINE Premium, download every WHATIF wallpaper without limits. You also unlock the templates in the IMAGINE design tool.",
    premiumCta: "Subscribe to Premium →",
    alreadyMember: "Already a Premium member?",
    login: "Log in",
    downloadReady: "Download wallpaper pack (.zip)",
    downloadReadyNote: "All four sizes are bundled in a single zip.",
    downloadPreparing: "Preparing your wallpaper pack…",
    downloadPreparingNote:
      "We're bundling the files into a zip. This can take a few seconds — please keep this page open.",
    downloadProgress: (percent: number) => `Downloading… ${percent}%`,
    downloadStarted: "Download started",
    downloadError: "Download failed. Please try again.",
    purchasedBadge: "Purchased",
    purchasedNote: "This is your purchased wallpaper pack. Download it anytime.",
    purchaseThanks: "Thank you for your purchase.",
    buyLine: "Just one? You can buy it for $1",
    spec: {
      mobile: "Smartphone (portrait)",
      desktop: "Desktop (landscape)",
    },
  },
  ja: {
    back: "← 作品にもどる",
    eyebrow: "WALLPAPER PACK",
    heroTitle: "スマホ & PC ウォールペーパー",
    heroLead: (code: string) =>
      `EPISODE ${code} のノンクレジット・フルサイズ壁紙パック。スマートフォンとデスクトップ、それぞれに FULL HD と QHD の高解像度を収録しています。`,
    heroPoints: [
      "ロゴ・クレジットなしのクリーンな仕上がり",
      "スマホ縦型 & PC 横型、合計4サイズ",
      "FULL HD 〜 QHD の高解像度",
    ],
    about: {
      eyebrow: "WHATIF PWP について",
      lead: "スマホ壁紙 / 待ち受け画面として利用できる画像をダウンロード頂けます。",
      paragraphs: [
        "WHATIF PHONE WALLPAPER（WHATIF PWP）は、WHATIF が Instagram で公開している「EPISODES」のすべてのアートワークを壁紙として販売するプロジェクトです。",
        "それぞれのアートワークは壁紙化にあたり、AI を使ったアップスケールや低品質な描画の差し替え・補完、ノイズの除去や色調補正などデジタルリマスターが施されているため、公開当時の作品とは一部異なる箇所もございます。",
        "パッケージには HD 画質／QHD 画質の 2 種類の解像度の画像が含まれます。",
      ],
      stat: "Gen-AI を使用して制作された「EPISODES」は累計 150 万以上のいいね！を獲得し、今も WHATIF のメインプロジェクトとして投稿が継続されています。",
    },
    lineupTitle: "収録サイズ",
    lineupNote: "プレビューはサンプルです。実際の配布データに透かしは入りません。",
    sample: "SAMPLE",
    included: "収録",
    oneTimeEyebrow: "この壁紙だけ",
    oneTimePrice: "$1",
    oneTimePriceUnit: "買い切り（一回払い）",
    oneTimeDesc:
      "この壁紙パック（全4サイズ）だけを $1 でダウンロード。サブスクに登録しなくても、気に入った1枚をそのまま買えます。",
    subEyebrow: "すべての壁紙",
    subPrice: "$3",
    subPriceUnit: "/ 月",
    subDesc:
      "IMAGINE プレミアムなら、WHATIF の壁紙がすべてダウンロードし放題。デザインツール IMAGINE のテンプレートも解放されます。",
    premiumCta: "プレミアムに登録する →",
    alreadyMember: "すでにプレミアム会員ですか？",
    login: "ログイン",
    downloadReady: "壁紙パックをダウンロード（.zip）",
    downloadReadyNote: "4サイズすべてを1つの zip にまとめてお届けします。",
    downloadPreparing: "壁紙パックを準備しています…",
    downloadPreparingNote:
      "ファイルを zip にまとめています。数秒かかる場合があります。このページを閉じずにお待ちください。",
    downloadProgress: (percent: number) => `ダウンロード中… ${percent}%`,
    downloadStarted: "ダウンロードを開始しました",
    downloadError: "ダウンロードに失敗しました。もう一度お試しください。",
    purchasedBadge: "ご購入済み",
    purchasedNote: "ご購入いただいた壁紙パックです。いつでもダウンロードできます。",
    purchaseThanks: "ご購入ありがとうございます。",
    buyLine: "1枚だけなら $1 で購入できます",
    spec: {
      mobile: "スマートフォン（縦型）",
      desktop: "デスクトップ（横型）",
    },
  },
  "zh-CN": {
    back: "← 返回作品",
    eyebrow: "WALLPAPER PACK",
    heroTitle: "手机 & PC 壁纸",
    heroLead: (code: string) =>
      `EPISODE ${code} 的无署名全尺寸壁纸套装。为智能手机与桌面分别收录 FULL HD 与 QHD 高分辨率图片。`,
    heroPoints: [
      "无 LOGO、无署名的干净成品",
      "手机竖版 & PC 横版，共计 4 种尺寸",
      "FULL HD 至 QHD 的高分辨率",
    ],
    about: {
      eyebrow: "关于 WHATIF PWP",
      lead: "可下载用作手机壁纸 / 锁屏画面的图片。",
      paragraphs: [
        "WHATIF PHONE WALLPAPER（WHATIF PWP）是将 WHATIF 在 Instagram 上发布的「EPISODES」全部作品制作成壁纸进行销售的项目。",
        "每张作品在壁纸化时，都经过了基于 AI 的放大、低画质部分的替换与补全、降噪以及色彩校正等数字重制，因此部分细节可能与最初发布的作品有所不同。",
        "套装包含 HD 画质／QHD 画质两种分辨率的图片。",
      ],
      stat: "使用 Gen-AI 制作的「EPISODES」累计获得超过 150 万个赞，至今仍作为 WHATIF 的主力项目持续更新。",
    },
    lineupTitle: "收录尺寸",
    lineupNote: "预览为示意图。实际发布的数据不含水印。",
    sample: "SAMPLE",
    included: "收录",
    oneTimeEyebrow: "仅此壁纸",
    oneTimePrice: "$1",
    oneTimePriceUnit: "一次性买断",
    oneTimeDesc:
      "仅需 $1 即可下载此壁纸套装（全 4 种尺寸）。无需订阅，喜欢哪张就直接购买。",
    subEyebrow: "全部壁纸",
    subPrice: "$3",
    subPriceUnit: "/ 月",
    subDesc:
      "成为 IMAGINE Premium 会员，即可无限下载 WHATIF 的全部壁纸，并解锁设计工具 IMAGINE 的模板。",
    premiumCta: "订阅 Premium →",
    alreadyMember: "已经是 Premium 会员？",
    login: "登录",
    downloadReady: "下载壁纸套装（.zip）",
    downloadReadyNote: "4 种尺寸全部打包在一个 zip 中提供。",
    downloadPreparing: "正在准备壁纸套装…",
    downloadPreparingNote:
      "正在将文件打包为 zip，可能需要几秒钟，请勿关闭此页面。",
    downloadProgress: (percent: number) => `下载中… ${percent}%`,
    downloadStarted: "已开始下载",
    downloadError: "下载失败，请重试。",
    purchasedBadge: "已购买",
    purchasedNote: "这是您已购买的壁纸套装，可随时下载。",
    purchaseThanks: "感谢您的购买。",
    buyLine: "只要一张的话，$1 即可购买",
    spec: {
      mobile: "智能手机（竖版）",
      desktop: "桌面（横版）",
    },
  },
  "zh-TW": {
    back: "← 返回作品",
    eyebrow: "WALLPAPER PACK",
    heroTitle: "手機 & PC 桌布",
    heroLead: (code: string) =>
      `EPISODE ${code} 的無署名全尺寸桌布套組。為智慧型手機與桌面分別收錄 FULL HD 與 QHD 高解析度圖片。`,
    heroPoints: [
      "無 LOGO、無署名的乾淨成品",
      "手機直式 & PC 橫式，共計 4 種尺寸",
      "FULL HD 至 QHD 的高解析度",
    ],
    about: {
      eyebrow: "關於 WHATIF PWP",
      lead: "可下載用作手機桌布 / 鎖定畫面的圖片。",
      paragraphs: [
        "WHATIF PHONE WALLPAPER（WHATIF PWP）是將 WHATIF 在 Instagram 上發布的「EPISODES」全部作品製作成桌布進行銷售的專案。",
        "每張作品在桌布化時，都經過了基於 AI 的放大、低畫質部分的替換與補全、降噪以及色彩校正等數位重製，因此部分細節可能與最初發布的作品有所不同。",
        "套組包含 HD 畫質／QHD 畫質兩種解析度的圖片。",
      ],
      stat: "使用 Gen-AI 製作的「EPISODES」累計獲得超過 150 萬個讚，至今仍作為 WHATIF 的主力專案持續更新。",
    },
    lineupTitle: "收錄尺寸",
    lineupNote: "預覽為示意圖。實際發布的資料不含浮水印。",
    sample: "SAMPLE",
    included: "收錄",
    oneTimeEyebrow: "僅此桌布",
    oneTimePrice: "$1",
    oneTimePriceUnit: "一次性買斷",
    oneTimeDesc:
      "僅需 $1 即可下載此桌布套組（全 4 種尺寸）。無需訂閱，喜歡哪張就直接購買。",
    subEyebrow: "全部桌布",
    subPrice: "$3",
    subPriceUnit: "/ 月",
    subDesc:
      "成為 IMAGINE Premium 會員，即可無限下載 WHATIF 的全部桌布，並解鎖設計工具 IMAGINE 的範本。",
    premiumCta: "訂閱 Premium →",
    alreadyMember: "已經是 Premium 會員？",
    login: "登入",
    downloadReady: "下載桌布套組（.zip）",
    downloadReadyNote: "4 種尺寸全部打包在一個 zip 中提供。",
    downloadPreparing: "正在準備桌布套組…",
    downloadPreparingNote:
      "正在將檔案打包為 zip，可能需要幾秒鐘，請勿關閉此頁面。",
    downloadProgress: (percent: number) => `下載中… ${percent}%`,
    downloadStarted: "已開始下載",
    downloadError: "下載失敗，請重試。",
    purchasedBadge: "已購買",
    purchasedNote: "這是您已購買的桌布套組，可隨時下載。",
    purchaseThanks: "感謝您的購買。",
    buyLine: "只要一張的話，$1 即可購買",
    spec: {
      mobile: "智慧型手機（直式）",
      desktop: "桌面（橫式）",
    },
  },
  ko: {
    back: "← 작품으로 돌아가기",
    eyebrow: "WALLPAPER PACK",
    heroTitle: "스마트폰 & PC 배경화면",
    heroLead: (code: string) =>
      `EPISODE ${code}의 논크레딧 풀사이즈 배경화면 팩. 스마트폰과 데스크톱 각각에 FULL HD와 QHD 고해상도를 수록했습니다.`,
    heroPoints: [
      "로고·크레딧 없는 깔끔한 마감",
      "스마트폰 세로형 & PC 가로형, 총 4가지 사이즈",
      "FULL HD ~ QHD의 고해상도",
    ],
    about: {
      eyebrow: "WHATIF PWP 소개",
      lead: "스마트폰 배경화면 / 잠금 화면으로 사용할 수 있는 이미지를 다운로드하실 수 있습니다.",
      paragraphs: [
        "WHATIF PHONE WALLPAPER(WHATIF PWP)는 WHATIF가 Instagram에 공개하는 「EPISODES」의 모든 아트워크를 배경화면으로 판매하는 프로젝트입니다.",
        "각 아트워크는 배경화면 제작 시 AI 기반 업스케일링, 저화질 부분의 교체·보완, 노이즈 제거, 색보정 등 디지털 리마스터를 거쳤기 때문에 공개 당시 작품과 일부 다른 부분이 있을 수 있습니다.",
        "패키지에는 HD 화질／QHD 화질 두 가지 해상도의 이미지가 포함됩니다.",
      ],
      stat: "Gen-AI로 제작된 「EPISODES」는 누적 150만 개 이상의 좋아요를 기록했으며, 지금도 WHATIF의 메인 프로젝트로서 계속 이어지고 있습니다.",
    },
    lineupTitle: "수록 사이즈",
    lineupNote: "미리보기는 샘플입니다. 실제 배포 데이터에는 워터마크가 없습니다.",
    sample: "SAMPLE",
    included: "수록",
    oneTimeEyebrow: "이 배경화면만",
    oneTimePrice: "$1",
    oneTimePriceUnit: "단건 구매(1회 결제)",
    oneTimeDesc:
      "이 배경화면 팩(전 4가지 사이즈)만 $1에 다운로드. 구독 없이도 마음에 드는 한 장을 바로 구매할 수 있습니다.",
    subEyebrow: "모든 배경화면",
    subPrice: "$3",
    subPriceUnit: "/ 월",
    subDesc:
      "IMAGINE Premium이라면 WHATIF의 배경화면을 무제한으로 다운로드. 디자인 툴 IMAGINE의 템플릿도 함께 해제됩니다.",
    premiumCta: "Premium 가입하기 →",
    alreadyMember: "이미 Premium 회원이신가요?",
    login: "로그인",
    downloadReady: "배경화면 팩 다운로드(.zip)",
    downloadReadyNote: "4가지 사이즈를 하나의 zip으로 묶어 제공합니다.",
    downloadPreparing: "배경화면 팩을 준비하고 있습니다…",
    downloadPreparingNote:
      "파일을 zip으로 묶고 있습니다. 몇 초 정도 걸릴 수 있으니 이 페이지를 닫지 말고 기다려 주세요.",
    downloadProgress: (percent: number) => `다운로드 중… ${percent}%`,
    downloadStarted: "다운로드를 시작했습니다",
    downloadError: "다운로드에 실패했습니다. 다시 시도해 주세요.",
    purchasedBadge: "구매 완료",
    purchasedNote: "구매하신 배경화면 팩입니다. 언제든지 다운로드하실 수 있습니다.",
    purchaseThanks: "구매해 주셔서 감사합니다.",
    buyLine: "한 장만이라면 $1에 구매할 수 있습니다",
    spec: {
      mobile: "스마트폰(세로형)",
      desktop: "데스크톱(가로형)",
    },
  },
};
