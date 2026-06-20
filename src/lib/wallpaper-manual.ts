// Builds the plain-text README ("取扱説明書") bundled inside the wallpaper zip.
//
// The manual is a long-form document, so rather than fragmenting it into
// i18next keys (as the IMAGINE app does for UI strings) we keep the layout in
// one builder and let each locale supply only the translated strings. Locale
// codes match the IMAGINE app (en / ja / zh-CN / zh-TW / ko) with `en` as the
// fallback.
//
// The zip bundles every locale as a separate file (README_EN.txt, etc.), so no
// language-detection is needed on the gallery side.

export type ManualLocale = "en" | "ja" | "zh-CN" | "zh-TW" | "ko";

export const MANUAL_LOCALES: ManualLocale[] = [
  "en",
  "ja",
  "zh-CN",
  "zh-TW",
  "ko",
];

export interface WallpaperManualContext {
  /** Display code of the work, e.g. "0468". */
  displayCode: string;
  /** Work title shown to the user. */
  title: string;
  /** Variant number within the work (1-based). */
  variantNumber: number;
}

// Translatable strings for one locale. Structure (file list, resolutions, URLs,
// separators) lives in the builder; only prose is translated here.
interface ManualStrings {
  docTitle: string;
  purchasedLabel: string;
  titleLabel: string;
  intro: string[];
  s1Title: string;
  s1Body: string[];
  s2Title: string;
  s2Intro: string[];
  s2Phone: string;
  s2Desktop: string;
  s2Other: string;
  s2Cover: string;
  s2RecoHeading: string;
  s2RecoQhd: string;
  s2RecoHd: string;
  s3Title: string;
  s3Intro: string;
  s3iPhone: string;
  s3iPhoneSteps: string[];
  s3iPhoneNote: string;
  s3Android: string;
  s3AndroidNote: string;
  s3AndroidSteps: string[];
  s3Pc: string;
  s3PcIntro: string[];
  s3PcWindows: string;
  s3PcMac: string;
  s4Title: string;
  s4Personal: string;
  s4PersonalBody: string[];
  s4Prohibited: string;
  s4ProhibitedBody: string[];
  s4Copyright: string;
  s4CopyrightBody: string[];
  s5Title: string;
  s5Body: string[];
  s5Website: string;
}

const INSTAGRAM_URL = "https://www.instagram.com/whatif.ep/";
const WEBSITE_URL = "https://whatif-ep.xyz";

// Windows Notepad and most viewers prefer CRLF for a portable README.txt.
const NL = "\r\n";
const SEP = "==================================================";
const SUB = "--------------------------------------------------";

const MANUALS: Record<ManualLocale, ManualStrings> = {
  en: {
    docTitle: "Instruction Manual / README",
    purchasedLabel: "Purchased item",
    titleLabel: "Title",
    intro: [
      "Thank you for purchasing WHATIF PHONE WALLPAPER (WHATIF PWP).",
      "This document explains the background of the artwork you purchased,",
      "how to set it up as wallpaper on each device (iPhone / Android / PC),",
      "and the terms of use.",
    ],
    s1Title: "1. ABOUT THIS PROJECT",
    s1Body: [
      "WHATIF PHONE WALLPAPER (WHATIF PWP) is the official project that delivers",
      'every artwork from WHATIF\'s "EPISODES" series, published on Instagram,',
      'as wallpapers. Created with Gen-AI, the "EPISODES" series has earned over',
      "1,500,000 likes in total and keeps growing as WHATIF's flagship project.",
      "",
      "The wallpapers in this package have been extensively digitally remastered",
      "from their original social-media versions, including AI-based upscaling,",
      "replacement and completion of low-quality areas, noise removal, and careful",
      "color correction, so they look their best even on large smartphone screens.",
      "Some details may therefore differ from the originally published artwork,",
      "but we hope you enjoy the quality crafted with wallpaper beauty as our",
      "top priority.",
    ],
    s2Title: "2. INCLUDED FILES",
    s2Intro: [
      "This package includes four wallpapers - two resolutions (Quad HD and",
      "Full HD) for both smartphone (portrait 9:16) and PC / desktop",
      "(landscape 16:9) - plus one cover image.",
      'We generally recommend "Quad HD", but please choose based on your storage',
      "capacity and device specifications.",
    ],
    s2Phone: "● Smartphone (portrait / 9:16)",
    s2Desktop: "● PC / Desktop (landscape / 16:9)",
    s2Other: "● Other",
    s2Cover: "Package cover image",
    s2RecoHeading: "(Recommended device guide)",
    s2RecoQhd: "For the latest high-end smartphones and high-resolution desktops.",
    s2RecoHd: "For standard smartphones / PCs, or to save storage space.",
    s3Title: "3. HOW TO SET UP",
    s3Intro: "Please follow the steps below for your device.",
    s3iPhone: "● How to set up on iPhone (iOS)",
    s3iPhoneSteps: [
      "  1. Save the downloaded image to the Photos app.",
      "  2. Open the Photos app and select the image you want to use.",
      "  3. Tap the Share button (square-with-an-arrow icon) at the bottom left.",
      '  4. Scroll down the menu and tap "Use as Wallpaper".',
      "  5. Pinch in/out with your fingers to adjust the position.",
      '  6. Tap "Add" at the top right, then choose "Set for Both" (lock & home)',
      '     or "Customize Home Screen".',
    ],
    s3iPhoneNote: "  (* Wording may vary slightly depending on your iOS version.)",
    s3Android: "● How to set up on Android",
    s3AndroidNote:
      "  (* Steps vary by model / OS version; a general flow is shown below.)",
    s3AndroidSteps: [
      "  1. Save the downloaded image to the Photos or Gallery app.",
      '  2. Open the image and tap the menu button (e.g. the vertical 3-dot "⋮").',
      '  3. Select "Set as wallpaper" (or "Use photo as").',
      '  4. Choose "Home screen", "Lock screen", or "Both".',
      '  5. Crop and adjust the position, then tap "Set wallpaper" to finish.',
    ],
    s3Pc: "● How to set up on PC / Mac",
    s3PcIntro: [
      "  Use the landscape (16:9) pc-qhd.png / pc-hd.png as your desktop wallpaper.",
    ],
    s3PcWindows: 'Right-click the image file > select "Set as desktop background".',
    s3PcMac:
      "Go to System Settings > Wallpaper > Add Folder, choose the image, and adjust the fit.",
    s4Title: "4. TERMS OF USE",
    s4Personal: "■ Personal use only:",
    s4PersonalBody: [
      "  This product may be used only by the purchaser, for personal use as",
      "  wallpaper (lock/home screen) on their own smartphones, tablets, or PCs.",
    ],
    s4Prohibited: "■ Prohibited:",
    s4ProhibitedBody: [
      "  Redistributing, reselling, or transferring this data (or any modified",
      "  version of it) to third parties - whether for a fee or free of charge -",
      "  is strictly prohibited. Please also refrain from using the artwork for",
      "  anything other than wallpaper, such as social-media icons or headers,",
      "  website design elements, or printed materials, and from any commercial use.",
    ],
    s4Copyright: "■ Copyright:",
    s4CopyrightBody: [
      '  All copyrights to this artwork belong solely to "WHATIF".',
    ],
    s5Title: "5. CONTACT & SOCIALS",
    s5Body: [
      "We share the latest artwork and project updates on our official Instagram.",
      "We'd love it if you follow us and tag us when you share a screenshot of",
      "your new wallpaper - it really encourages us!",
    ],
    s5Website: "Official Website",
  },

  ja: {
    docTitle: "取扱説明書 / README",
    purchasedLabel: "ご購入アイテム",
    titleLabel: "タイトル",
    intro: [
      "この度は WHATIF PHONE WALLPAPER (WHATIF PWP) をお買い上げいただき、",
      "誠にありがとうございます。",
      "本ドキュメントには、ご購入いただいた壁紙のアートワークに関する背景と、",
      "各種デバイス（iPhone / Android / PC）への設定方法、",
      "およびご利用の際の注意事項が記載されています。",
    ],
    s1Title: "1. ABOUT THIS PROJECT（プロジェクトについて）",
    s1Body: [
      "WHATIF PHONE WALLPAPER (WHATIF PWP) は、WHATIF が Instagram で公開している",
      "「EPISODES」のすべてのアートワークを壁紙としてお届けする公式プロジェクトです。",
      "Gen-AI（生成AI）を使用して制作された「EPISODES」は、累計 150 万以上の",
      "「いいね！」を獲得し、今も WHATIF のメインプロジェクトとして日々進化を続けています。",
      "",
      "本パッケージに収録されている壁紙は、SNS 公開当時のものから大幅なデジタル",
      "リマスターが施されています。AI を使ったアップスケール、低品質な描画の",
      "差し替え・補完、ノイズの除去や緻密な色調補正を行うことで、スマートフォンの",
      "大画面でも耐えうる最高品質のアートワークへと昇華させています。",
      "そのため、公開当時の作品とは一部異なる箇所がございますが、壁紙としての",
      "美しさを最優先したこだわりのクオリティをお楽しみください。",
    ],
    s2Title: "2. INCLUDED FILES（同梱ファイルについて）",
    s2Intro: [
      "本パッケージには、スマートフォン（縦型 9:16）と PC / デスクトップ",
      "（横型 16:9）それぞれに、Quad HD と Full HD の 2 種類の解像度を収録した",
      "計 4 枚の壁紙と、カバー画像 1 枚が同梱されています。",
      "基本的には「Quad HD」を推奨しますが、ストレージ容量やデバイスの仕様に",
      "合わせて使い分けてください。",
    ],
    s2Phone: "● スマートフォン（縦型 / 9:16）",
    s2Desktop: "● PC / デスクトップ（横型 / 16:9）",
    s2Other: "● その他",
    s2Cover: "パッケージのカバー画像",
    s2RecoHeading: "（推奨デバイスの目安）",
    s2RecoQhd: "最新のハイエンドスマホ／高精細なデスクトップ環境向け。",
    s2RecoHd: "スタンダードなスマホ／PC、容量を抑えたい方向け。",
    s3Title: "3. HOW TO SET UP（壁紙の設定方法）",
    s3Intro: "お使いのデバイスに合わせて、以下の手順で設定を行ってください。",
    s3iPhone: "● iPhone (iOS) での設定方法",
    s3iPhoneSteps: [
      "  1. ダウンロードした画像を「写真」アプリに保存します。",
      "  2. 「写真」アプリを開き、壁紙に設定したい画像を選択します。",
      "  3. 画面左下の「共有ボタン（四角から矢印が出ているアイコン）」をタップします。",
      "  4. メニューを下にスクロールし、「壁紙に設定」をタップします。",
      "  5. 指でピンチイン／アウト（拡大縮小）して位置を調整します。",
      "  6. 右上の「追加」をタップし、「壁紙の両方に設定」または",
      "     「ホーム画面をカスタマイズ」を選択します。",
    ],
    s3iPhoneNote: "  （※ iOS のバージョンにより多少表記が異なる場合があります）",
    s3Android: "● Android での設定方法",
    s3AndroidNote:
      "  （※ 機種・OS バージョンにより操作が異なりますが、一般的な手順は以下です）",
    s3AndroidSteps: [
      "  1. ダウンロードした画像を「フォト」または「ギャラリー」アプリに保存します。",
      "  2. 画像を開き、メニューボタン（縦の3点リーダー「⋮」など）をタップします。",
      "  3. 「写真を登録」または「壁紙として設定」を選択します。",
      "  4. 「ホーム画面」「ロック画面」「両方」のいずれかを選択します。",
      "  5. トリミングや位置調整を行い、「壁紙を設定」をタップして完了です。",
    ],
    s3Pc: "● PC / Mac での設定方法",
    s3PcIntro: [
      "  横型（16:9）の pc-qhd.png / pc-hd.png をデスクトップ壁紙としてご利用",
      "  いただけます。",
    ],
    s3PcWindows: "画像ファイルを右クリック ＞「デスクトップの背景として設定」を選択。",
    s3PcMac:
      "「システム設定」＞「壁紙」＞「フォルダを追加」から画像を選択し、配置方法を調整。",
    s4Title: "4. TERMS OF USE（ご利用上の注意・ライセンス）",
    s4Personal: "■ 個人利用限定:",
    s4PersonalBody: [
      "  本製品は、ご購入者様本人のスマートフォン、タブレット、PC 等の壁紙",
      "  （待ち受け画面）としての個人利用に限りご使用いただけます。",
    ],
    s4Prohibited: "■ 禁止事項:",
    s4ProhibitedBody: [
      "  本データ、または本データを改変したものを、有償・無償を問わず第三者へ",
      "  再配布・転売・譲渡する行為は固く禁止します。また、SNS のアカウント",
      "  アイコンやヘッダー、Web サイトのデザイン要素、印刷物など、壁紙以外の",
      "  用途への流用や商用利用はご遠慮ください。",
    ],
    s4Copyright: "■ 著作権:",
    s4CopyrightBody: ["  本アートワークの著作権は、すべて「WHATIF」に帰属します。"],
    s5Title: "5. CONTACT & SOCIALS（お問い合わせ・SNS）",
    s5Body: [
      "最新のアートワークやプロジェクトの動向は、公式 Instagram にて随時発信しています。",
      "ぜひフォローや、壁紙に設定した画面のスクショをタグ付けしてシェアして",
      "いただけると励みになります！",
    ],
    s5Website: "Official Website",
  },

  "zh-CN": {
    docTitle: "使用说明书 / README",
    purchasedLabel: "购买商品",
    titleLabel: "标题",
    intro: [
      "感谢您购买 WHATIF PHONE WALLPAPER (WHATIF PWP)。",
      "本说明记载了您所购买壁纸作品的背景介绍、在各类设备",
      "（iPhone / Android / PC）上的设置方法，以及使用须知。",
    ],
    s1Title: "1. ABOUT THIS PROJECT（关于本项目）",
    s1Body: [
      "WHATIF PHONE WALLPAPER (WHATIF PWP) 是将 WHATIF 在 Instagram 上发布的",
      "「EPISODES」全部作品制作成壁纸提供的官方项目。",
      "使用 Gen-AI（生成式 AI）制作的「EPISODES」累计获得超过 150 万个赞，",
      "至今仍作为 WHATIF 的主力项目持续更新。",
      "",
      "本套装收录的壁纸，相较于当初在社交媒体发布的版本，经过了大幅度的数字",
      "重制：包括基于 AI 的放大、低画质部分的替换与补全、降噪以及精细的色彩",
      "校正，使其即使在大尺寸的智能手机屏幕上也能呈现最佳画质。",
      "因此部分细节可能与最初发布的作品有所不同，但请尽情欣赏我们以壁纸之美",
      "为最优先打造的品质。",
    ],
    s2Title: "2. INCLUDED FILES（关于随附文件）",
    s2Intro: [
      "本套装为智能手机（竖版 9:16）与 PC / 桌面（横版 16:9）分别收录了",
      "Quad HD 与 Full HD 两种分辨率，共计 4 张壁纸，外加 1 张封面图片。",
      "通常推荐使用「Quad HD」，但请根据存储容量与设备规格自行选择。",
    ],
    s2Phone: "● 智能手机（竖版 / 9:16）",
    s2Desktop: "● PC / 桌面（横版 / 16:9）",
    s2Other: "● 其他",
    s2Cover: "套装封面图片",
    s2RecoHeading: "（推荐设备参考）",
    s2RecoQhd: "适合最新的高端智能手机／高精细的桌面环境。",
    s2RecoHd: "适合标准的智能手机／PC，或希望节省容量的用户。",
    s3Title: "3. HOW TO SET UP（壁纸设置方法）",
    s3Intro: "请根据您的设备，按照以下步骤进行设置。",
    s3iPhone: "● iPhone (iOS) 的设置方法",
    s3iPhoneSteps: [
      "  1. 将下载的图片保存到「照片」App。",
      "  2. 打开「照片」App，选择想要设为壁纸的图片。",
      "  3. 点按左下角的「分享按钮（方框带向上箭头的图标）」。",
      "  4. 向下滚动菜单，点按「用作墙纸」。",
      "  5. 用手指双指捏合（缩放）调整位置。",
      "  6. 点按右上角的「添加」，选择「同时设定」或「自定主屏幕」。",
    ],
    s3iPhoneNote: "  （※ 不同 iOS 版本的措辞可能略有差异。）",
    s3Android: "● Android 的设置方法",
    s3AndroidNote: "  （※ 因机型与系统版本而异，一般步骤如下。）",
    s3AndroidSteps: [
      "  1. 将下载的图片保存到「照片」或「图库」App。",
      "  2. 打开图片，点按菜单按钮（竖排三点「⋮」等）。",
      "  3. 选择「设置为壁纸」或「用照片作为」。",
      "  4. 选择「主屏幕」「锁定屏幕」或「两者」。",
      "  5. 裁剪并调整位置后，点按「设置壁纸」即可完成。",
    ],
    s3Pc: "● PC / Mac 的设置方法",
    s3PcIntro: ["  请使用横版（16:9）的 pc-qhd.png / pc-hd.png 作为桌面壁纸。"],
    s3PcWindows: "右键点击图片文件 ＞ 选择「设为桌面背景」。",
    s3PcMac:
      "进入「系统设置」＞「墙纸」＞「添加文件夹」，选择图片并调整填充方式。",
    s4Title: "4. TERMS OF USE（使用须知・授权）",
    s4Personal: "■ 仅限个人使用：",
    s4PersonalBody: [
      "  本产品仅限购买者本人，作为其智能手机、平板、PC 等设备的壁纸",
      "  （锁屏／主屏幕）供个人使用。",
    ],
    s4Prohibited: "■ 禁止事项：",
    s4ProhibitedBody: [
      "  严禁将本数据或其修改版本，以有偿或无偿的方式向第三方再分发、转售",
      "  或转让。此外，请勿将作品用于壁纸以外的用途，例如社交媒体头像或横幅、",
      "  网站设计元素、印刷品等，亦不得用于任何商业用途。",
    ],
    s4Copyright: "■ 版权：",
    s4CopyrightBody: ["  本作品的所有版权均归「WHATIF」所有。"],
    s5Title: "5. CONTACT & SOCIALS（联系方式・社交媒体）",
    s5Body: [
      "我们会在官方 Instagram 上不定期发布最新作品与项目动态。",
      "欢迎关注我们，并在分享您设置好的壁纸截图时标记我们，",
      "这将是对我们莫大的鼓励！",
    ],
    s5Website: "官方网站",
  },

  "zh-TW": {
    docTitle: "使用說明書 / README",
    purchasedLabel: "購買商品",
    titleLabel: "標題",
    intro: [
      "感謝您購買 WHATIF PHONE WALLPAPER (WHATIF PWP)。",
      "本說明記載了您所購買桌布作品的背景介紹、在各類裝置",
      "（iPhone / Android / PC）上的設定方法，以及使用須知。",
    ],
    s1Title: "1. ABOUT THIS PROJECT（關於本專案）",
    s1Body: [
      "WHATIF PHONE WALLPAPER (WHATIF PWP) 是將 WHATIF 在 Instagram 上發布的",
      "「EPISODES」全部作品製作成桌布提供的官方專案。",
      "使用 Gen-AI（生成式 AI）製作的「EPISODES」累計獲得超過 150 萬個讚，",
      "至今仍作為 WHATIF 的主力專案持續更新。",
      "",
      "本套組收錄的桌布，相較於當初在社群媒體發布的版本，經過了大幅度的數位",
      "重製：包括基於 AI 的放大、低畫質部分的替換與補全、降噪以及精細的色彩",
      "校正，使其即使在大尺寸的智慧型手機螢幕上也能呈現最佳畫質。",
      "因此部分細節可能與最初發布的作品有所不同，但請盡情欣賞我們以桌布之美",
      "為最優先打造的品質。",
    ],
    s2Title: "2. INCLUDED FILES（關於隨附檔案）",
    s2Intro: [
      "本套組為智慧型手機（直式 9:16）與 PC / 桌面（橫式 16:9）分別收錄了",
      "Quad HD 與 Full HD 兩種解析度，共計 4 張桌布，外加 1 張封面圖片。",
      "通常推薦使用「Quad HD」，但請依照儲存容量與裝置規格自行選擇。",
    ],
    s2Phone: "● 智慧型手機（直式 / 9:16）",
    s2Desktop: "● PC / 桌面（橫式 / 16:9）",
    s2Other: "● 其他",
    s2Cover: "套組封面圖片",
    s2RecoHeading: "（推薦裝置參考）",
    s2RecoQhd: "適合最新的高階智慧型手機／高精細的桌面環境。",
    s2RecoHd: "適合標準的智慧型手機／PC，或希望節省容量的使用者。",
    s3Title: "3. HOW TO SET UP（桌布設定方法）",
    s3Intro: "請依照您的裝置，按照以下步驟進行設定。",
    s3iPhone: "● iPhone (iOS) 的設定方法",
    s3iPhoneSteps: [
      "  1. 將下載的圖片儲存到「照片」App。",
      "  2. 開啟「照片」App，選擇想要設為桌布的圖片。",
      "  3. 點按左下角的「分享按鈕（方框帶向上箭頭的圖示）」。",
      "  4. 向下捲動選單，點按「設定背景圖片」。",
      "  5. 用手指雙指縮放調整位置。",
      "  6. 點按右上角的「加入」，選擇「同時設定」或「自訂主畫面」。",
    ],
    s3iPhoneNote: "  （※ 不同 iOS 版本的用語可能略有差異。）",
    s3Android: "● Android 的設定方法",
    s3AndroidNote: "  （※ 因機型與系統版本而異，一般步驟如下。）",
    s3AndroidSteps: [
      "  1. 將下載的圖片儲存到「相片」或「圖庫」App。",
      "  2. 開啟圖片，點按選單按鈕（直排三點「⋮」等）。",
      "  3. 選擇「設定為桌布」或「將相片用作」。",
      "  4. 選擇「主畫面」「鎖定畫面」或「兩者」。",
      "  5. 裁切並調整位置後，點按「設定桌布」即可完成。",
    ],
    s3Pc: "● PC / Mac 的設定方法",
    s3PcIntro: ["  請使用橫式（16:9）的 pc-qhd.png / pc-hd.png 作為桌面桌布。"],
    s3PcWindows: "在圖片檔案上按右鍵 ＞ 選擇「設定為桌面背景」。",
    s3PcMac:
      "進入「系統設定」＞「桌布」＞「加入檔案夾」，選擇圖片並調整填滿方式。",
    s4Title: "4. TERMS OF USE（使用須知・授權）",
    s4Personal: "■ 僅限個人使用：",
    s4PersonalBody: [
      "  本產品僅限購買者本人，作為其智慧型手機、平板、PC 等裝置的桌布",
      "  （鎖定／主畫面）供個人使用。",
    ],
    s4Prohibited: "■ 禁止事項：",
    s4ProhibitedBody: [
      "  嚴禁將本資料或其修改版本，以有償或無償的方式向第三方再散布、轉售",
      "  或轉讓。此外，請勿將作品用於桌布以外的用途，例如社群媒體頭像或橫幅、",
      "  網站設計元素、印刷品等，亦不得用於任何商業用途。",
    ],
    s4Copyright: "■ 著作權：",
    s4CopyrightBody: ["  本作品的所有著作權均歸「WHATIF」所有。"],
    s5Title: "5. CONTACT & SOCIALS（聯絡方式・社群媒體）",
    s5Body: [
      "我們會在官方 Instagram 上不定期發布最新作品與專案動態。",
      "歡迎追蹤我們，並在分享您設定好的桌布截圖時標記我們，",
      "這將是對我們莫大的鼓勵！",
    ],
    s5Website: "官方網站",
  },

  ko: {
    docTitle: "사용 설명서 / README",
    purchasedLabel: "구매 상품",
    titleLabel: "제목",
    intro: [
      "WHATIF PHONE WALLPAPER (WHATIF PWP)를 구매해 주셔서 진심으로 감사합니다.",
      "본 문서에는 구매하신 배경화면 아트워크에 대한 배경 설명과 각 기기",
      "(iPhone / Android / PC)에서의 설정 방법, 이용 시 유의사항이 담겨 있습니다.",
    ],
    s1Title: "1. ABOUT THIS PROJECT（프로젝트 소개）",
    s1Body: [
      "WHATIF PHONE WALLPAPER (WHATIF PWP)는 WHATIF가 Instagram에 공개하는",
      "「EPISODES」의 모든 아트워크를 배경화면으로 제공하는 공식 프로젝트입니다.",
      "Gen-AI(생성형 AI)로 제작된 「EPISODES」는 누적 150만 개 이상의 좋아요를",
      "기록했으며, 지금도 WHATIF의 메인 프로젝트로서 계속 발전하고 있습니다.",
      "",
      "본 패키지에 수록된 배경화면은 SNS 공개 당시 버전에서 대폭적인 디지털",
      "리마스터를 거쳤습니다. AI 기반 업스케일링, 저화질 부분의 교체·보완,",
      "노이즈 제거, 정밀한 색보정을 통해 스마트폰의 큰 화면에서도 최고 품질을",
      "유지하도록 다듬었습니다.",
      "따라서 공개 당시의 작품과 일부 다른 부분이 있을 수 있으나, 배경화면으로서의",
      "아름다움을 최우선으로 한 품질을 즐겨 주시기 바랍니다.",
    ],
    s2Title: "2. INCLUDED FILES（동봉 파일 안내）",
    s2Intro: [
      "본 패키지에는 스마트폰(세로형 9:16)과 PC / 데스크톱(가로형 16:9)",
      "각각에 Quad HD와 Full HD 두 가지 해상도를 수록한 총 4장의 배경화면과",
      "커버 이미지 1장이 동봉되어 있습니다.",
      "기본적으로 「Quad HD」를 권장하지만, 저장 용량과 기기 사양에 맞춰",
      "선택하여 사용하세요.",
    ],
    s2Phone: "● 스마트폰(세로형 / 9:16)",
    s2Desktop: "● PC / 데스크톱(가로형 / 16:9)",
    s2Other: "● 기타",
    s2Cover: "패키지 커버 이미지",
    s2RecoHeading: "(권장 기기 안내)",
    s2RecoQhd: "최신 고사양 스마트폰／고해상도 데스크톱 환경에 적합.",
    s2RecoHd: "표준 스마트폰／PC, 또는 용량을 절약하고 싶은 분께 적합.",
    s3Title: "3. HOW TO SET UP（배경화면 설정 방법）",
    s3Intro: "사용하시는 기기에 맞춰 아래 순서대로 설정해 주세요.",
    s3iPhone: "● iPhone (iOS) 설정 방법",
    s3iPhoneSteps: [
      "  1. 다운로드한 이미지를 「사진」 앱에 저장합니다.",
      "  2. 「사진」 앱을 열고 배경화면으로 설정할 이미지를 선택합니다.",
      "  3. 화면 왼쪽 아래의 「공유 버튼(사각형에서 화살표가 나온 아이콘)」을 탭합니다.",
      "  4. 메뉴를 아래로 스크롤하여 「배경화면으로 설정」을 탭합니다.",
      "  5. 손가락으로 확대／축소하여 위치를 조정합니다.",
      "  6. 오른쪽 위의 「추가」를 탭하고, 「양쪽 모두 설정」 또는",
      "     「홈 화면 사용자화」를 선택합니다.",
    ],
    s3iPhoneNote: "  (※ iOS 버전에 따라 표현이 다소 다를 수 있습니다.)",
    s3Android: "● Android 설정 방법",
    s3AndroidNote:
      "  (※ 기종·OS 버전에 따라 조작이 다르지만 일반적인 순서는 다음과 같습니다.)",
    s3AndroidSteps: [
      "  1. 다운로드한 이미지를 「사진」 또는 「갤러리」 앱에 저장합니다.",
      "  2. 이미지를 열고 메뉴 버튼(세로 3점 「⋮」 등)을 탭합니다.",
      "  3. 「배경화면으로 설정」을 선택합니다.",
      "  4. 「홈 화면」, 「잠금 화면」, 「둘 다」 중에서 선택합니다.",
      "  5. 자르기 및 위치를 조정한 뒤 「배경화면 설정」을 탭하면 완료입니다.",
    ],
    s3Pc: "● PC / Mac 설정 방법",
    s3PcIntro: [
      "  가로형(16:9)의 pc-qhd.png / pc-hd.png를 데스크톱 배경화면으로",
      "  사용하실 수 있습니다.",
    ],
    s3PcWindows:
      "이미지 파일을 마우스 오른쪽 버튼으로 클릭 ＞ 「바탕 화면 배경으로 설정」 선택.",
    s3PcMac:
      "「시스템 설정」＞「배경화면」＞「폴더 추가」에서 이미지를 선택하고 맞춤 방식을 조정.",
    s4Title: "4. TERMS OF USE（이용 시 유의사항・라이선스）",
    s4Personal: "■ 개인 이용 한정:",
    s4PersonalBody: [
      "  본 제품은 구매자 본인의 스마트폰, 태블릿, PC 등의 배경화면",
      "  (잠금／홈 화면)으로서 개인적인 이용에 한해 사용하실 수 있습니다.",
    ],
    s4Prohibited: "■ 금지 사항:",
    s4ProhibitedBody: [
      "  본 데이터 또는 이를 변경한 것을 유상·무상을 불문하고 제3자에게",
      "  재배포·재판매·양도하는 행위를 엄격히 금지합니다. 또한 SNS 계정",
      "  아이콘이나 헤더, 웹사이트 디자인 요소, 인쇄물 등 배경화면 이외의",
      "  용도로 전용하거나 상업적으로 이용하는 것을 삼가 주세요.",
    ],
    s4Copyright: "■ 저작권:",
    s4CopyrightBody: ["  본 아트워크의 저작권은 모두 「WHATIF」에 귀속됩니다."],
    s5Title: "5. CONTACT & SOCIALS（문의・SNS）",
    s5Body: [
      "최신 아트워크와 프로젝트 소식은 공식 Instagram에서 수시로 전해 드립니다.",
      "팔로우와 함께, 배경화면으로 설정한 화면의 스크린샷을 태그하여 공유해",
      "주시면 큰 힘이 됩니다!",
    ],
    s5Website: "공식 웹사이트",
  },
};

export function buildWallpaperReadme(
  locale: ManualLocale,
  context: WallpaperManualContext
): string {
  const s = MANUALS[locale] ?? MANUALS.en;
  const { displayCode, title, variantNumber } = context;
  const itemValue =
    variantNumber > 1
      ? `EPISODE ${displayCode}-${variantNumber}`
      : `EPISODE ${displayCode}`;

  const lines: string[] = [
    SEP,
    "  WHATIF PHONE WALLPAPER (WHATIF PWP)",
    `  ${s.docTitle}`,
    SEP,
    "",
    `${s.purchasedLabel}: ${itemValue}`,
    ...(title ? [`${s.titleLabel}: ${title}`] : []),
    "",
    ...s.intro,
    "",
    SUB,
    s.s1Title,
    SUB,
    "",
    ...s.s1Body,
    "",
    SUB,
    s.s2Title,
    SUB,
    "",
    ...s.s2Intro,
    "",
    s.s2Phone,
    "  - mobile-qhd.png : 1440 x 2560 px（Quad HD）",
    "  - mobile-hd.png  : 1080 x 1920 px（Full HD）",
    "",
    s.s2Desktop,
    "  - pc-qhd.png     : 2560 x 1440 px（Quad HD）",
    "  - pc-hd.png      : 1920 x 1080 px（Full HD）",
    "",
    s.s2Other,
    `  - cover.png      : ${s.s2Cover}`,
    "",
    s.s2RecoHeading,
    `  - Quad HD : ${s.s2RecoQhd}`,
    `  - Full HD : ${s.s2RecoHd}`,
    "",
    SUB,
    s.s3Title,
    SUB,
    "",
    s.s3Intro,
    "",
    s.s3iPhone,
    ...s.s3iPhoneSteps,
    s.s3iPhoneNote,
    "",
    s.s3Android,
    s.s3AndroidNote,
    ...s.s3AndroidSteps,
    "",
    s.s3Pc,
    ...s.s3PcIntro,
    `  - Windows: ${s.s3PcWindows}`,
    `  - Mac    : ${s.s3PcMac}`,
    "",
    SUB,
    s.s4Title,
    SUB,
    "",
    s.s4Personal,
    ...s.s4PersonalBody,
    "",
    s.s4Prohibited,
    ...s.s4ProhibitedBody,
    "",
    s.s4Copyright,
    ...s.s4CopyrightBody,
    "",
    SUB,
    s.s5Title,
    SUB,
    "",
    ...s.s5Body,
    "",
    `  Instagram      : @whatif.ep  ( ${INSTAGRAM_URL} )`,
    `  ${s.s5Website}: ${WEBSITE_URL}`,
    "",
    SEP,
    "  (c) 2026 WHATIF. All Rights Reserved.",
    SEP,
  ];

  return lines.join(NL) + NL;
}

/** Zip filename for a given locale, e.g. "README_ZH-CN.txt". */
export function manualFilename(locale: ManualLocale): string {
  return `README_${locale.toUpperCase()}.txt`;
}
