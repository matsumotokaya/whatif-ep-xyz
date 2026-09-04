'use client';

// Public help page for the Ref Library: how a saved IMAGINE design becomes a
// stable image URL, how to register the MCP server, and who is able to open a
// reference URL. Content only — the Gallery shell (root layout) supplies the
// Header and Footer, so this component renders neither.
//
// Copy interaction mirrors src/components/editor/pages/BannerManager.tsx: a
// single `copiedKey` string identifies which block last showed feedback, with
// the reset timeout cleared on unmount.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage, type Language } from '@/context/LanguageContext';

const MCP_ENDPOINT = 'https://whatif-ep.xyz/api/mcp';
const MCP_ADD_COMMAND = `claude mcp add --transport http whatif-ref ${MCP_ENDPOINT}`;
const REF_URL = 'https://whatif-ep.xyz/ref/{design-id}';
const REF_URL_JPG = 'https://whatif-ep.xyz/ref/{design-id}.jpg';
const REF_URL_THUMB = 'https://whatif-ep.xyz/ref/{design-id}?size=thumb';
const CURL_COMMAND = 'curl -s "https://whatif-ep.xyz/api/ref/designs?id=<id>"';

const COPY: Record<Language, {
  eyebrow: string;
  title: string;
  description: string;
  quickStartTitle: string;
  step1Title: string;
  step1Body: string;
  step2Title: string;
  step2Body: string;
  step3Title: string;
  step3Body: string;
  myDesignsLink: string;
  mcpTitle: string;
  mcpDescription: string;
  mcpEndpointNote: string;
  mcpClaudeCodeLabel: string;
  mcpOtherClientsLabel: string;
  mcpOtherClientsBody: string;
  mcpToolLabel: string;
  mcpToolBody: string;
  mcpPayoff: string;
  copyLabel: string;
  copiedLabel: string;
  urlTitle: string;
  urlDescription: string;
  urlBaseMeaning: string;
  urlJpgMeaning: string;
  urlThumbMeaning: string;
  accessTitle: string;
  accessBody: string;
  accessNote: string;
  qualityTitle: string;
  qualityBody: string;
  devTitle: string;
  devBody: string;
}> = {
  en: {
    eyebrow: 'Ref Library',
    title: 'Use your designs as image URLs',
    description:
      'Every design you save in IMAGINE has a stable URL that points to its rendered image. Hand that URL to a video-generation AI, a CLI, a Remotion project or an MCP-capable assistant instead of downloading a file and uploading it again.',
    quickStartTitle: 'Quick start',
    step1Title: 'Open My Designs',
    step1Body: 'Your saved designs are listed on My Designs. Each card is one design.',
    step2Title: 'Copy the reference URL',
    step2Body:
      "The link icon on a card copies that design's reference URL. The small chip next to it shows the first 8 characters of the design ID and copies the full ID when you click it.",
    step3Title: 'Paste it into your tool',
    step3Body:
      'Anywhere an image URL is accepted, paste it as-is. The URL always redirects to the current rendered image, so it keeps working after you save the design again.',
    myDesignsLink: 'My Designs',
    mcpTitle: 'Connect via MCP',
    mcpDescription:
      'Register WHATIF as a remote MCP server and your assistant can resolve design IDs on its own.',
    mcpEndpointNote:
      'This page is documentation, not the endpoint — register https://whatif-ep.xyz/api/mcp in your client.',
    mcpClaudeCodeLabel: 'Claude Code',
    mcpOtherClientsLabel: 'Other MCP clients',
    mcpOtherClientsBody:
      'In Claude Desktop, Cursor and other MCP clients, register the same URL as a remote HTTP MCP server:',
    mcpToolLabel: 'The get_design tool',
    mcpToolBody:
      "Give it a design ID and it returns that design's image URL along with its name and dimensions. It can also return the thumbnail as an inline image, so the assistant can actually look at the design.",
    mcpPayoff:
      'So you can simply say "use design d9b310ff… as the reference image" and the assistant resolves it for you.',
    copyLabel: 'Copy',
    copiedLabel: 'Copied',
    urlTitle: 'URL forms',
    urlDescription: 'Three shapes of the same reference URL. Use whichever your tool prefers.',
    urlBaseMeaning: 'Redirects to the current full-size rendered image.',
    urlJpgMeaning: 'Behaves identically, for services that require a file extension.',
    urlThumbMeaning: 'Returns the small thumbnail instead of the full-size render.',
    accessTitle: 'Who can open your reference URL',
    accessBody:
      'The design ID is the key. Anyone holding the URL can view and download that image without logging in, and can pass the URL on to someone else.',
    accessNote:
      'That makes it convenient for tools and collaborators, but do not share the URL of a design you want to keep private. There is currently no way to revoke a URL once it has been shared.',
    qualityTitle: 'Image quality',
    qualityBody:
      "The reference URL serves a JPEG at the design's own pixel size. The full-size render is produced when you save the design in the editor; if a design has only ever had a list thumbnail, the URL falls back to that smaller image. Re-open the design in the editor and save it once to produce the full-size render.",
    devTitle: 'For developers',
    devBody:
      'There is a plain HTTP form as well, handy in scripts. It returns JSON metadata including the direct image URL:',
  },
  ja: {
    eyebrow: 'Ref Library',
    title: 'デザインを画像URLとして使う',
    description:
      'IMAGINE で保存したデザインには、レンダリング済み画像を指す固定URLが用意されています。ファイルをダウンロードして再アップロードする代わりに、このURLを動画生成AI・CLI・Remotion プロジェクト・MCP対応のアシスタントにそのまま渡せます。',
    quickStartTitle: 'クイックスタート',
    step1Title: '「あなたのデザイン」を開く',
    step1Body:
      '保存したデザインは「あなたのデザイン」に一覧表示されます。カード1枚が1つのデザインです。',
    step2Title: '参照URLをコピーする',
    step2Body:
      'カードのリンクアイコンを押すと、そのデザインの参照URLをコピーできます。隣の小さなチップにはデザインIDの先頭8文字が表示され、クリックするとID全体をコピーします。',
    step3Title: 'ツールに貼り付ける',
    step3Body:
      '画像URLを受け付ける場所にそのまま貼り付けてください。URLは常に最新のレンダリング画像へリダイレクトするため、デザインを保存し直したあとも同じURLが使えます。',
    myDesignsLink: 'あなたのデザイン',
    mcpTitle: 'MCP で接続する',
    mcpDescription:
      'WHATIF をリモート MCP サーバーとして登録すると、アシスタント自身がデザインIDを解決できるようになります。',
    mcpEndpointNote:
      'このページ自体はドキュメントであり、エンドポイントではありません。登録するURLは https://whatif-ep.xyz/api/mcp です。',
    mcpClaudeCodeLabel: 'Claude Code',
    mcpOtherClientsLabel: 'その他の MCP クライアント',
    mcpOtherClientsBody:
      'Claude Desktop や Cursor などの MCP クライアントでは、同じURLをリモートHTTP MCPサーバーとして登録してください。',
    mcpToolLabel: 'get_design ツール',
    mcpToolBody:
      'デザインIDを渡すと、そのデザインの画像URLと、名前・サイズ（幅と高さ）を返します。サムネイルをインライン画像として返すこともできるので、アシスタントが実際にデザインを見て判断できます。',
    mcpPayoff:
      'つまり「デザイン d9b310ff… を参照画像として使って」と伝えるだけで、アシスタントが自分でURLを解決します。',
    copyLabel: 'コピー',
    copiedLabel: 'コピーしました',
    urlTitle: 'URLの3つの形式',
    urlDescription: '同じ参照URLの3つの書き方です。ツールが扱いやすい形式を選んでください。',
    urlBaseMeaning: '現在のフルサイズのレンダリング画像へリダイレクトします。',
    urlJpgMeaning: '動作は同じです。拡張子が必要なサービス向けの形式です。',
    urlThumbMeaning: 'フルサイズではなく、小さいサムネイル画像を返します。',
    accessTitle: '参照URLを開ける人',
    accessBody:
      'デザインIDがそのまま鍵になります。URLを知っている人は誰でも、ログインせずにその画像を表示・ダウンロードでき、URLを他の人に渡すこともできます。',
    accessNote:
      'ツールや共同作業者との共有には便利ですが、非公開にしておきたいデザインのURLは共有しないでください。一度共有したURLを無効化する手段は現時点でありません。',
    qualityTitle: '画像の品質について',
    qualityBody:
      '参照URLは、そのデザイン自体のピクセルサイズのJPEGを返します。フルサイズのレンダリング画像はエディタでデザインを保存したときに生成されるため、一覧用のサムネイルしか存在しないデザインでは、その小さい画像にフォールバックします。エディタでデザインを開き直して一度保存すると、フルサイズの画像が生成されます。',
    devTitle: '開発者向け',
    devBody:
      'スクリプトから扱いやすいHTTP形式も用意しています。直接の画像URLを含むJSONのメタデータを返します。',
  },
  'zh-CN': {
    eyebrow: 'Ref Library',
    title: '把你的设计当作图片 URL 使用',
    description:
      '你在 IMAGINE 中保存的每个设计都有一个固定 URL，指向它渲染后的图片。不必先下载文件再重新上传，直接把这个 URL 交给视频生成 AI、CLI、Remotion 项目或支持 MCP 的助手即可。',
    quickStartTitle: '快速开始',
    step1Title: '打开「我的设计」',
    step1Body: '保存的设计都列在「我的设计」中，每张卡片对应一个设计。',
    step2Title: '复制引用 URL',
    step2Body:
      '点击卡片上的链接图标即可复制该设计的引用 URL。旁边的小标签显示设计 ID 的前 8 个字符，点击可复制完整 ID。',
    step3Title: '粘贴到你的工具里',
    step3Body:
      '任何可以填写图片 URL 的地方，直接粘贴即可。该 URL 始终重定向到最新的渲染图片，所以重新保存设计后仍然有效。',
    myDesignsLink: '我的设计',
    mcpTitle: '通过 MCP 连接',
    mcpDescription: '把 WHATIF 注册为远程 MCP 服务器，助手就能自行解析设计 ID。',
    mcpEndpointNote:
      '本页面本身是文档，并非接口地址；请注册 https://whatif-ep.xyz/api/mcp 作为端点。',
    mcpClaudeCodeLabel: 'Claude Code',
    mcpOtherClientsLabel: '其他 MCP 客户端',
    mcpOtherClientsBody:
      '在 Claude Desktop、Cursor 等 MCP 客户端中，把同一个 URL 注册为远程 HTTP MCP 服务器：',
    mcpToolLabel: 'get_design 工具',
    mcpToolBody:
      '传入设计 ID，它会返回该设计的图片 URL 以及名称和尺寸。它还可以把缩略图作为内嵌图片一并返回，让助手真正「看到」这个设计。',
    mcpPayoff: '于是你只需说「用设计 d9b310ff… 作为参考图」，助手就会自己解析出对应的图片。',
    copyLabel: '复制',
    copiedLabel: '已复制',
    urlTitle: 'URL 的三种形式',
    urlDescription: '同一个引用 URL 的三种写法，按工具的需要选用。',
    urlBaseMeaning: '重定向到当前的完整尺寸渲染图片。',
    urlJpgMeaning: '行为完全相同，适用于要求带文件扩展名的服务。',
    urlThumbMeaning: '返回较小的缩略图，而不是完整尺寸的渲染图片。',
    accessTitle: '谁能打开你的引用 URL',
    accessBody:
      '设计 ID 本身就是钥匙。任何拿到这个 URL 的人都可以在未登录的情况下查看并下载该图片，也可以把 URL 转发给别人。',
    accessNote:
      '这让你与工具和协作者共享变得方便，但想保持私密的设计请不要分享它的 URL。目前没有办法撤销已经分享出去的 URL。',
    qualityTitle: '关于图片质量',
    qualityBody:
      '引用 URL 提供的是与设计本身像素尺寸一致的 JPEG。完整尺寸的渲染图片是在编辑器中保存设计时生成的；如果某个设计只有列表用的缩略图，URL 会退回到那张较小的图片。在编辑器中重新打开该设计并保存一次，就会生成完整尺寸的图片。',
    devTitle: '面向开发者',
    devBody: '我们也提供了普通的 HTTP 形式，便于在脚本中使用。它会返回包含图片直链的 JSON 元数据：',
  },
  'zh-TW': {
    eyebrow: 'Ref Library',
    title: '把你的設計當作圖片 URL 使用',
    description:
      '你在 IMAGINE 中儲存的每個設計，都有一個固定 URL 指向它算圖後的圖片。不必先下載檔案再重新上傳，直接把這個 URL 交給影片生成 AI、CLI、Remotion 專案或支援 MCP 的助手即可。',
    quickStartTitle: '快速開始',
    step1Title: '開啟「我的設計」',
    step1Body: '儲存的設計都列在「我的設計」中，每張卡片對應一個設計。',
    step2Title: '複製參照 URL',
    step2Body:
      '點擊卡片上的連結圖示即可複製該設計的參照 URL。旁邊的小標籤顯示設計 ID 的前 8 個字元，點擊可複製完整 ID。',
    step3Title: '貼到你的工具裡',
    step3Body:
      '任何可以填入圖片 URL 的地方，直接貼上即可。這個 URL 一律會導向最新的算圖結果，因此重新儲存設計後仍然有效。',
    myDesignsLink: '我的設計',
    mcpTitle: '透過 MCP 連線',
    mcpDescription: '把 WHATIF 註冊為遠端 MCP 伺服器，助手就能自行解析設計 ID。',
    mcpEndpointNote:
      '本頁面本身是文件，並非端點；請註冊 https://whatif-ep.xyz/api/mcp 作為端點。',
    mcpClaudeCodeLabel: 'Claude Code',
    mcpOtherClientsLabel: '其他 MCP 用戶端',
    mcpOtherClientsBody:
      '在 Claude Desktop、Cursor 等 MCP 用戶端中，把同一個 URL 註冊為遠端 HTTP MCP 伺服器：',
    mcpToolLabel: 'get_design 工具',
    mcpToolBody:
      '傳入設計 ID，它會回傳該設計的圖片 URL 以及名稱和尺寸。它也可以把縮圖以內嵌圖片的形式一併回傳，讓助手真的「看到」這個設計。',
    mcpPayoff: '於是你只要說「用設計 d9b310ff… 當作參考圖」，助手就會自己找出對應的圖片。',
    copyLabel: '複製',
    copiedLabel: '已複製',
    urlTitle: 'URL 的三種形式',
    urlDescription: '同一個參照 URL 的三種寫法，依工具的需求選用。',
    urlBaseMeaning: '導向目前完整尺寸的算圖圖片。',
    urlJpgMeaning: '行為完全相同，適用於需要副檔名的服務。',
    urlThumbMeaning: '回傳較小的縮圖，而不是完整尺寸的圖片。',
    accessTitle: '誰能開啟你的參照 URL',
    accessBody:
      '設計 ID 本身就是鑰匙。任何拿到這個 URL 的人都可以在未登入的狀態下檢視並下載該圖片，也可以把 URL 轉給其他人。',
    accessNote:
      '這讓你與工具和協作者分享時相當方便，但想保持私密的設計請不要分享它的 URL。目前沒有辦法撤銷已經分享出去的 URL。',
    qualityTitle: '關於圖片品質',
    qualityBody:
      '參照 URL 提供的是與設計本身像素尺寸相同的 JPEG。完整尺寸的圖片是在編輯器中儲存設計時產生的；如果某個設計只有清單用的縮圖，URL 會退而提供那張較小的圖片。在編輯器中重新開啟該設計並儲存一次，就會產生完整尺寸的圖片。',
    devTitle: '給開發者',
    devBody:
      '我們也提供一般的 HTTP 形式，方便在指令稿中使用。它會回傳包含圖片直接網址的 JSON 中介資料：',
  },
  ko: {
    eyebrow: 'Ref Library',
    title: '내 디자인을 이미지 URL로 사용하기',
    description:
      'IMAGINE에서 저장한 모든 디자인에는 렌더링된 이미지를 가리키는 고정 URL이 있습니다. 파일을 내려받아 다시 올리는 대신, 이 URL을 영상 생성 AI, CLI, Remotion 프로젝트, MCP를 지원하는 어시스턴트에 그대로 전달하세요.',
    quickStartTitle: '빠른 시작',
    step1Title: '내 디자인 열기',
    step1Body: '저장한 디자인은 내 디자인 목록에 표시됩니다. 카드 하나가 디자인 하나입니다.',
    step2Title: '참조 URL 복사하기',
    step2Body:
      '카드의 링크 아이콘을 누르면 해당 디자인의 참조 URL이 복사됩니다. 옆에 있는 작은 칩에는 디자인 ID의 앞 8자가 표시되며, 클릭하면 전체 ID가 복사됩니다.',
    step3Title: '사용하는 도구에 붙여넣기',
    step3Body:
      '이미지 URL을 입력할 수 있는 곳에 그대로 붙여넣으면 됩니다. URL은 항상 최신 렌더링 이미지로 리디렉션되므로, 디자인을 다시 저장한 뒤에도 같은 URL을 계속 사용할 수 있습니다.',
    myDesignsLink: '내 디자인',
    mcpTitle: 'MCP로 연결하기',
    mcpDescription:
      'WHATIF를 원격 MCP 서버로 등록하면 어시스턴트가 디자인 ID를 직접 확인해 처리할 수 있습니다.',
    mcpEndpointNote:
      '이 페이지 자체는 문서이며 엔드포인트가 아닙니다. 등록할 주소는 https://whatif-ep.xyz/api/mcp입니다.',
    mcpClaudeCodeLabel: 'Claude Code',
    mcpOtherClientsLabel: '다른 MCP 클라이언트',
    mcpOtherClientsBody:
      'Claude Desktop, Cursor 등의 MCP 클라이언트에서는 같은 URL을 원격 HTTP MCP 서버로 등록하세요.',
    mcpToolLabel: 'get_design 도구',
    mcpToolBody:
      '디자인 ID를 전달하면 해당 디자인의 이미지 URL과 이름, 크기(가로·세로)를 반환합니다. 썸네일을 인라인 이미지로 함께 반환할 수도 있어, 어시스턴트가 디자인을 직접 보고 판단할 수 있습니다.',
    mcpPayoff:
      '덕분에 "디자인 d9b310ff…를 참조 이미지로 사용해"라고만 말하면 어시스턴트가 스스로 URL을 찾아냅니다.',
    copyLabel: '복사',
    copiedLabel: '복사됨',
    urlTitle: 'URL의 세 가지 형태',
    urlDescription: '같은 참조 URL을 세 가지 형태로 쓸 수 있습니다. 사용하는 도구에 맞는 형태를 고르세요.',
    urlBaseMeaning: '현재 원본 크기의 렌더링 이미지로 리디렉션합니다.',
    urlJpgMeaning: '동작은 같습니다. 파일 확장자가 필요한 서비스를 위한 형태입니다.',
    urlThumbMeaning: '원본 크기 대신 작은 썸네일 이미지를 반환합니다.',
    accessTitle: '참조 URL을 열 수 있는 사람',
    accessBody:
      '디자인 ID가 곧 열쇠입니다. URL을 가진 사람은 누구나 로그인하지 않고도 그 이미지를 보고 내려받을 수 있으며, URL을 다른 사람에게 전달할 수도 있습니다.',
    accessNote:
      '도구나 협업자와 공유할 때는 편리하지만, 비공개로 두고 싶은 디자인의 URL은 공유하지 마세요. 한번 공유한 URL을 무효화하는 방법은 현재 없습니다.',
    qualityTitle: '이미지 품질',
    qualityBody:
      '참조 URL은 디자인 자체의 픽셀 크기에 맞춘 JPEG를 제공합니다. 원본 크기 렌더링은 에디터에서 디자인을 저장할 때 생성되므로, 목록용 썸네일만 있는 디자인은 그 작은 이미지로 대체됩니다. 에디터에서 디자인을 다시 열고 한 번 저장하면 원본 크기 이미지가 만들어집니다.',
    devTitle: '개발자를 위한 안내',
    devBody:
      '스크립트에서 쓰기 좋은 일반 HTTP 형식도 있습니다. 직접 이미지 URL을 포함한 JSON 메타데이터를 반환합니다.',
  },
};

function CodeBlock({
  value,
  copied,
  copyLabel,
  copiedLabel,
  onCopy,
}: {
  value: string;
  copied: boolean;
  copyLabel: string;
  copiedLabel: string;
  onCopy: () => void;
}) {
  return (
    <div className="mt-3 flex items-start gap-2">
      <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-background px-4 py-3">
        <code className="whitespace-pre font-mono text-xs leading-6 text-foreground">{value}</code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="btn-press shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
      >
        <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
      </button>
    </div>
  );
}

export default function McpGuideClient() {
  const { lang } = useLanguage();
  const t = COPY[lang];

  // Tracks which code block last showed "copied" feedback.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);
    };
  }, []);

  const handleCopyToClipboard = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = setTimeout(() => setCopiedKey(null), 1500);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const steps = [
    { title: t.step1Title, body: t.step1Body },
    { title: t.step2Title, body: t.step2Body },
    { title: t.step3Title, body: t.step3Body },
  ];

  const urlForms = [
    { url: REF_URL, meaning: t.urlBaseMeaning },
    { url: REF_URL_JPG, meaning: t.urlJpgMeaning },
    { url: REF_URL_THUMB, meaning: t.urlThumbMeaning },
  ];

  return (
    <div className="w-full px-4 py-10 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-muted">{t.eyebrow}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">{t.description}</p>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            {t.quickStartTitle}
          </h2>
          <ol className="mt-4 flex flex-col gap-5">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/mydesign"
            className="btn-press mt-6 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {t.myDesignsLink}
            <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            {t.mcpTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">{t.mcpDescription}</p>
          <p className="mt-2 text-sm leading-6 text-foreground">{t.mcpEndpointNote}</p>

          <p className="mt-5 text-sm font-medium text-foreground">{t.mcpClaudeCodeLabel}</p>
          <CodeBlock
            value={MCP_ADD_COMMAND}
            copied={copiedKey === 'mcp-add'}
            copyLabel={t.copyLabel}
            copiedLabel={t.copiedLabel}
            onCopy={() => handleCopyToClipboard('mcp-add', MCP_ADD_COMMAND)}
          />

          <div className="mt-6 border-t border-border pt-6">
            <p className="text-sm font-medium text-foreground">{t.mcpOtherClientsLabel}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{t.mcpOtherClientsBody}</p>
            <CodeBlock
              value={MCP_ENDPOINT}
              copied={copiedKey === 'mcp-endpoint'}
              copyLabel={t.copyLabel}
              copiedLabel={t.copiedLabel}
              onCopy={() => handleCopyToClipboard('mcp-endpoint', MCP_ENDPOINT)}
            />
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <p className="text-sm font-medium text-foreground">{t.mcpToolLabel}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{t.mcpToolBody}</p>
            <p className="mt-3 text-sm leading-6 text-foreground">{t.mcpPayoff}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            {t.urlTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">{t.urlDescription}</p>
          <dl className="mt-4 divide-y divide-border">
            {urlForms.map((form) => (
              <div key={form.url} className="py-4 first:pt-0 last:pb-0">
                <dt className="overflow-x-auto">
                  <code className="whitespace-pre font-mono text-xs leading-6 text-foreground">
                    {form.url}
                  </code>
                </dt>
                <dd className="mt-1 text-sm leading-6 text-muted">{form.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            {t.accessTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-900">{t.accessBody}</p>
          <p className="mt-2 text-sm leading-6 text-amber-900">{t.accessNote}</p>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            {t.qualityTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">{t.qualityBody}</p>

          <div className="mt-6 border-t border-border pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              {t.devTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">{t.devBody}</p>
            <CodeBlock
              value={CURL_COMMAND}
              copied={copiedKey === 'curl'}
              copyLabel={t.copyLabel}
              copiedLabel={t.copiedLabel}
              onCopy={() => handleCopyToClipboard('curl', CURL_COMMAND)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
