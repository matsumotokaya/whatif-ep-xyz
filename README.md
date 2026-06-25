# WHATIF Gallery

WHATIF EP - Digital Art Gallery

**Production URL:** https://whatif-ep.xyz

---

## Renewal Status

このリポジトリは現在、`WHATIF Gallery` を `作品ハブ + 壁紙 + IMAGINE編集導線` に再設計するリニューアル計画を進行中です。

- 計画書: [docs/RENEWAL_PLAN.md](docs/RENEWAL_PLAN.md)
- 現行 README は本番運用中の構成説明
- 新しいデータモデルは `episode` ではなく `work` を中心に再設計予定

次のセッションではまず [docs/RENEWAL_PLAN.md](docs/RENEWAL_PLAN.md) を参照してから着手すること。

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel |
| Database | Supabase (Postgres) |
| Image Storage | Cloudflare R2 |
| Analytics | Google Analytics (G-X5E0WH9Y43) |
| Repository | github.com/matsumotokaya/whatif-ep-xyz |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                      # Domain root → redirects to /works/episode
│   ├── about/page.tsx                # Hero / About Us (the former top page)
│   ├── works/
│   │   ├── page.tsx                  # → redirects to /works/episode
│   │   └── [series]/
│   │       ├── page.tsx              # Series gallery (server) + WorksPageClient
│   │       ├── WorksPageClient.tsx
│   │       └── [code]/
│   │           ├── page.tsx          # Work detail (artwork is a clickable IMAGINE shortcut)
│   │           └── wallpaper/        # Wallpaper sales page + zip download UI
│   ├── episodes/                     # Admin only: new/ and [number]/edit/
│   ├── auth/                         # login / legacy-login / callback
│   ├── the-club/                     # The Club area (intro / library / [slug])
│   ├── api/                          # works & episode downloads, wallpaper zip/checkout, stripe webhook
│   ├── sitemap.ts                    # Dynamic sitemap (all published works)
│   └── robots.ts
├── components/
│   ├── Header.tsx                    # Hamburger menu: EPISODES/IMAGINE/CLUB/STORE/ABOUT
│   ├── LanguageSwitcher.tsx
│   ├── WorkCard.tsx / WorkGallery.tsx
│   ├── WorkDetailActions.tsx / WorkMobileInfo.tsx
│   ├── EpisodeDetailImage.tsx        # Detail artwork: hover→edit overlay, tap→confirm modal
│   ├── DownloadButton.tsx            # Shared single-image download (share/blob, multi-UA)
│   ├── SaveButton.tsx / GallerySeriesSelect.tsx / SortToggle.tsx
│   ├── HomeHeroWithBanner.tsx / ParallaxHero.tsx / ImagineBanner.tsx
│   └── Footer.tsx / ConditionalFooter.tsx / GoogleAnalytics.tsx
├── context/
│   ├── LanguageContext.tsx           # i18n state (5 languages, no i18next)
│   ├── AuthContext.tsx
│   └── SavedWorksContext.tsx
├── hooks/
│   ├── useInfiniteScroll.ts
│   └── useResolvedList.ts / useResolvedFlag.ts  # resolve server-streamed promises client-side
└── lib/
    ├── works.ts / work-images.ts / work-saves.ts   # works data access (source of truth)
    ├── wallpaper.ts / wallpaper-manual.ts / wallpaper-purchases.ts
    ├── club/ · admin/ · supabase/ · stripe.ts · ssoCookie.ts
    ├── episodes.ts / images.ts / r2.ts             # legacy episode helpers
    └── types.ts
src/data/
└── episodes.json                   # Seed source for Supabase
scripts/
├── generate-episodes.mjs           # Regenerate episodes.json from meta.json
├── generate-episodes-seed-sql.mjs  # Build supabase/seeds/episodes.sql
├── upload-episode.sh               # Legacy: upload to R2 + update episodes.json
└── migrate-images.sh               # One-time FTP → R2 bulk migration
supabase/
├── migrations/20260407_create_episodes.sql
└── seeds/episodes.sql
```

## Environment Variables

`.env.local` に設定：

```
NEXT_PUBLIC_R2_BASE_URL=https://pub-9339dc326a024891a297479881e66962.r2.dev
NEXT_PUBLIC_GA_ID=G-X5E0WH9Y43
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
STRIPE_WALLPAPER_PRICE_ID=<your-wallpaper-price-id>
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM_EMAIL=noreply@whatif-ep.xyz
CONTACT_NOTIFICATION_EMAIL=contact@whatif-ep.xyz
R2_ACCOUNT_ID=<your-r2-account-id>
R2_ACCESS_KEY_ID=<your-r2-access-key>
R2_SECRET_ACCESS_KEY=<your-r2-secret>
R2_BUCKET=whatif-ep-xyz
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

`NEXT_PUBLIC_R2_BASE_URL` はギャラリー画像用、`R2_*` は管理画面からの画像アップロード/削除用。
`R2_ENDPOINT` は未指定なら `R2_ACCOUNT_ID` から自動生成します。
`RESEND_*` は壁紙購入通知メール（購入者 + 管理者）に使います。

## Development

```bash
npm install
npm run dev    # http://localhost:3710
npm run build
```

## Adding a New Episode

### Admin UI（推奨）
1. Supabase `public.profiles.role` を `admin` に設定したユーザーでログイン
2. `/episodes/new` から登録（original は PNG/JPG 必須、サムネイルは任意）
3. 送信すると R2 へアップロードされ、`public.episodes` に保存されます
4. 既存エピソードの編集/削除は `/episodes/[number]/edit`

### Legacy script（JSON更新のみ）
`scripts/upload-episode.sh` は R2 と `src/data/episodes.json` を更新しますが、
Supabase への登録は行いません。seed 生成用の JSON 更新に使う場合のみ利用してください。

```bash
./scripts/upload-episode.sh <PNG_FILE> [EPISODE_NUMBER] [PRODUCT_URL]
```

## Supabase Episodes

- メタデータの正本は `public.episodes` テーブル
- 反映には `supabase/migrations/20260407_create_episodes.sql` を適用
- 初期データは `supabase/seeds/episodes.sql`
- `src/data/episodes.json` から seed を作り直す場合:

```bash
node scripts/generate-episodes-seed-sql.mjs > supabase/seeds/episodes.sql
```

---

## 画像モデル（表示用＝クレジット入り / 壁紙＝ノンクレジット）

ギャラリーの作品画像は、すべて **Content Factory（IMAGINE 管理機能）** で生成されたものを正本とする。Content Factory の **Publish** は、作品バリアントごとに `production_outputs` を複数生成し、それぞれ `role` を持つ。

| role | 形式 | クレジット | 用途 |
|------|------|-----------|------|
| `instagram_feed` | 4:5 PNG（約1080×1350） | **入り** | **ギャラリーの正式表示画像**。一覧カードのサムネと作品詳細のメイン画像の**両方**に使う。 |
| `mobile_hd` / `mobile_qhd` / `pc_hd` / `pc_qhd` | 各サイズ PNG | **なし（クリーン）** | 有料の壁紙パック。**クレジットが無いこと自体が商品価値**。 |
| `package_cover` | 1600×1600 | — | 壁紙販売ページ・「他の壁紙」ストリップのカバー。 |
| `zip` | アーカイブ | — | 壁紙パックの一括ダウンロード。 |

**基本原則**: ギャラリーでは常に**クレジット入りの `instagram_feed`** を表示し、壁紙サイズ（ノンクレジット）は表示しない。クレジットを外すこと＝顧客が対価を払う価値なので、**表示用（クレジット入り）と壁紙（クリーン）は厳密に分離**する。

### canonical work metadata

作品そのもののメタデータ正本は Gallery 側の legacy `episodes` ではなく、IMAGINE Content Factory から同期される canonical `works` / `work_variants` である。

- 作品詳細の右カラムとモバイル情報パネルは canonical `Work Tags` と `Summary` を表示する
- 管理者の `/episodes/[number]/edit` は legacy episode 編集導線を残しつつ、初期値と保存先を canonical work metadata に揃える
- `category` は legacy 互換の内部項目として残るが、公開UIの主要な分類軸としては扱わない
- `Asset Tags` / `Asset Notes` は premium library asset (`default_images`) 用であり、work metadata とは別物

### 移行前作品のフォールバック（暫定）

この feed ベースのモデルは**今回のアップデートから**始まった。それ以前に作られた作品は `instagram_feed` 出力をまだ持たないため、ギャラリーの体裁を保つために**暫定的にフォールバック**する（旧 R2 サムネ → original PNG）。

- **一覧カード**（`WorkCard` / `getWorkPrimaryImageCandidates`）: `feedImageUrl` → R2 `thumbnails/{number}.jpg` → original PNG
- **作品詳細メイン**（`getVariantDisplayImageCandidates`）: `feedImageUrl` → original PNG

これらのフォールバックは応急処置であり、**移行前の作品もいずれすべて Content Factory から再生産**する。再生産後はどの作品も正式な `instagram_feed` を持ち、フォールバック経路は不要（削除可能）になる。

### パフォーマンス課題（対応予定）

現状、一覧カードと作品詳細メインは**同じフルサイズの `instagram_feed` PNG** を使っている。約1080px のクレジット入り PNG を小さなグリッドセルに読み込むのは無駄で、Vercel Image Optimization の *Transformations* と転送量を押し上げる（無料枠の transformation 消費が急増した原因）。

**対応方針**: Content Factory が一覧用に**軽量なクレジット入り feed サムネ**を追加で発行する（IMAGINE 側の対応）。これにより一覧は事前リサイズ済みの軽い画像を読み込み、フルサイズ feed 画像は作品詳細専用にする。

---

## Internationalization (i18n)

姉妹サイト IMAGINE と同じ **5言語**に対応しています。

| code | 表示 | 短縮（スイッチャー） |
|------|------|------------------|
| `en` | English | EN |
| `ja` | 日本語 | JA |
| `zh-CN` | 简体中文 | CN |
| `zh-TW` | 繁體中文 | TW |
| `ko` | 한국어 | KO |

### 仕様

- **デフォルトは英語**。初回アクセス時は `navigator.language` から自動判定（`zh-TW`/`zh-HK`/`zh-Hant`→繁体字、その他 `zh*`→簡体字、`ko*`→韓国語、`ja*`→日本語、それ以外→英語）。
- 選択した言語は `localStorage` の `whatif_menu_locale` に保存（旧 `en`/`ja` 値とも後方互換）。
- 言語スイッチャー（🌐 地球儀アイコン + 短縮コード）は **ヘッダーのハンバーガーメニューの左**に常時表示。ドロップダウンはネイティブ表記。

### 実装方式

- **i18next は使わない**。`src/context/LanguageContext.tsx` の `LanguageProvider` + `useLanguage()`（React Context）で言語状態を一元管理し、各コンポーネントは `Record<Language, ...>` 型のコピー辞書を持つ。
  - 理由: Next.js 16 App Router + SSG を壊さず、URL ロケールルーティングなしで実装するため。
- **Server Component（壁紙ページ等）のパターン**: コピーを別モジュール（例 `wallpaper/copy.ts` の `WALLPAPER_COPY`）に5言語辞書化し、データ取得はサーバーのまま、描画は `useLanguage()` を使うクライアント分割コンポーネント（例 `WallpaperPageContent.tsx`）に渡す。
- スイッチャー: `src/components/LanguageSwitcher.tsx`。
- **CJKフォント**: 本文フォント Geist はラテン専用のため、`src/app/globals.css` の `body` font-family に各OSのCJKシステムフォント（Apple SD Gothic Neo / Hiragino / PingFang / Malgun / Microsoft YaHei / Noto Sans CJK 等）をフォールバックとして明示している。これがないと韓国語(한국어)・中国語が豆腐(□)化する。Webフォントは追加していないのでパフォーマンスへの影響はない。

### 対応状況

- **5言語化済み**: 言語スイッチャー / Header メニュー（ABOUT 含む）/ The Club（説明・Access）/ 壁紙販売ページ / 壁紙ダウンロードのフィードバック文言 / 作品詳細のアクションボタン・画像クリック編集導線 / シリーズ切替（`GallerySeriesSelect`）・並び順（`SortToggle`）/ 主要 CTA・アクションボタン。
- **未対応（英/日のまま・今後の段階対応）**: auth ページ（login / legacy-login）、Admin のエピソード作成・編集、`the-club/library` 本文、作品詳細の nav 文言（Gallery / Prev / Next / Status 等）、各種メタデータ系ラベル。

### 壁紙ダウンロードzip内の多言語README（暫定仕様）

壁紙パックの zip には、画像とは別に **取扱説明書（README）を5言語ぶん個別のテキストファイルとして同梱**しています。

- ファイル名: `README_EN.txt` / `README_JA.txt` / `README_ZH-CN.txt` / `README_ZH-TW.txt` / `README_KO.txt`
- 実装: `src/lib/wallpaper-manual.ts`（文言の正本）を `src/app/api/works/[series]/[code]/wallpaper/download/route.ts` が読み、zip 生成時に全言語ぶん書き出す。
- **暫定仕様**: 現状はサイト側の言語判定を行わず、全言語を常に同梱している。将来的に「選択言語のみ同梱」へ変更する可能性あり。

---

## Migration Status（移行状況）

### 完了
- [x] Next.js 16 + Vercel へのフロントエンド移行
- [x] Cloudflare R2 への全画像移行（444 PNG / 369 JPG）
- [x] Episodes Gallery（無限スクロール）
- [x] 全440エピソードの個別ページ（SSG）
- [x] エピソード管理（Supabase + Admin UI で追加/編集/削除）
- [x] Google Analytics 統合
- [x] The Club（premium gating + catalog + download）
- [x] 多言語対応（EN / JA / 簡体字 / 繁体字 / 韓国語の5言語、ブラウザ自動判定 + 言語スイッチャー）→ 詳細は [Internationalization (i18n)](#internationalization-i18n)
- [x] ドメイン移管（`whatif-ep.xyz` → Vercel）
- [x] www → non-www 308リダイレクト（Vercel Domains設定）
- [x] Supabase認証リダイレクトURL設定（`whatif-ep.xyz` 追加）
- [x] 旧The Clubの導線切替（新サイトに統合済み）
- [x] IMAGINE 連携（作品詳細「イラストを編集」→ `app.whatif-ep.xyz/banner?template=<id>` ダイレクトオープン / Content Factory publish 時のテンプレ昇格＋`imagine_starter` offer 自動投入 / ドメインまたぎ SSO）
- [x] パフォーマンス最適化（ギャラリー一覧/作品詳細を「カタログ即時描画＋ユーザー固有データ（保存/購入/管理）の Suspense ストリーミング分離」に変更。初回ロードの3秒ブロックを解消）
- [x] SEO 強化（`sitemap.ts` / `robots.ts` / `/episodes`→`/works/episode` の 301 リダイレクト / metadataBase・keywords・OpenGraph・Twitter Card / canonical / JSON-LD）
- [x] 多言語フォント対応（CJKシステムフォントのフォールバック明示で韓国語・中国語の文字化けを解消）
- [x] 壁紙ダウンロードのフィードバックUI（押下→準備中→進捗→完了/失敗、連打防止、5言語対応）
- [x] 作品詳細のアートワーク自体を IMAGINE 編集導線化（PC: ホバーで編集オーバーレイ→新タブ / モバイル: タップで確認モーダル）
- [x] トップ導線の変更（ドメインルート `/` を `/works/episode` へリダイレクトしギャラリーを主導線化。旧ヒーローは `/about` に退避し、ハンバーガーメニューの「ABOUT」からリンク。今後ヒーロー下に About Us の本文を追記予定）

### The Club account model

The Club は通常の WHATIF アカウントと同じ Supabase Auth を使いますが、旧サイト由来の少数の会員だけは別のログイン導線を持ちます。

2026年4月以降、`/IMAGINE` のプレミアム会員も同じアカウント基盤で The Club を利用できるようにしています。  
The Club と `/IMAGINE` は同一アカウントでログインでき、対象会員は The Club のダウンロード機能を利用できます。

- 通常会員
  - メールアドレス + パスワード
  - Google OAuth
  - `/IMAGINE` プレミアム会員（同一アカウント連携）
- legacy 会員
  - 旧 The Club の `ID` + パスワード
  - ログイン画面は `/auth/legacy-login`
  - `public.profiles.legacy_login_id` で識別する

実装上の扱いは次のとおりです。

- `auth.users.id` は通常どおり UUID のまま使う
- 旧 ID は `profiles.legacy_login_id` に保存する
- 旧 ID は `legacy+<id>@club.whatif.local` という内部メールに変換して Supabase Auth に渡す
- パスワードは `profiles` には保存しない
- パスワードの保存と検証は Supabase Auth に任せる

この設計にしている理由は、現在は 3 名程度でも、将来 legacy 会員が増減する前提で、平文パスワードをアプリ側で管理しない方が安全で、運用を変えずに済むためです。

legacy 会員を追加する手順は次のとおりです。

1. Supabase Auth にユーザーを作成する
2. メールを `legacy+<id>@club.whatif.local` にする
3. パスワードは Supabase Auth 側で設定する
4. `public.profiles.legacy_login_id` に `<id>` を入れる

legacy 会員の ID は UUID である必要はありません。`bam.5878` のような文字列をそのまま使えます。

The Club の機能移行はここで完了です。以降はサイト全体の運用タスクだけを残しています。

### DNS構成メモ
- レジストラ：お名前.com
- DNS管理：Cloudflare
- `whatif-ep.xyz` → A `216.198.79.1`（Vercel）、DNS only
- `www.whatif-ep.xyz` → CNAME `7d28a6da6feaf2a8.vercel-dns-017.com`（Vercel）、DNS only
- `app.whatif-ep.xyz` → CNAME `657ce667dd748179.vercel-dns-017.com`（Vercel）、DNS only
- CloudflareのProxy（オレンジ雲）は**必ずOFF（DNS only）**にすること。ONにするとVercelが所有権確認できなくなる

### サイト運用の残件
- [ ] **R2カスタムドメイン** — 現在はR2のデフォルトURL（`pub-xxx.r2.dev`）。カスタムドメインへの切り替え予定
- [ ] **旧ロリポップサーバー停止判断** — 新サイト移行完了後の停止タイミングを決める

### 旧サイト（ロリポップ）
- URL: `workflowdesign.chicappa.jp/whatif-ep/`
- 旧 The Club は legacy 会員の確認用に残る可能性がある
- ドメイン移管・The Club 移行の最終整理が終わり次第、停止判断を行う

### 今後の作業計画
- [docs/ROADMAP.md](docs/ROADMAP.md) を参照（現状と残タスク: プレミアム動線 / IMAGINE での量産 / IMAGINE 連携）

#### メモ: 壁紙の単品販売（$1前後）について（未実装・将来検討）
- サブスク（The Club）に加えて、壁紙パックを単品 $1 前後でも販売したい。
- **Stripe に作品ごとの商品を作る必要はない**。商品カタログは Supabase（`works` / `production_delivery_packages`）が正本。
  - Product 1個＋一回払い Price（`mode: "payment"`）でよい。または都度 `price_data` を渡し `metadata`（work_code / variant / package_id）で識別。
  - `$1.29` のような細かい価格も `unit_amount: 129` で設定可。
  - 500件近くあっても Stripe 側の一括登録は不要（やる場合も CSV ではなく API スクリプト）。
- 手数料は 2.9% + $0.30/件で手残り ≒ $0.67 だが、実質100円販売相当として許容範囲という想定。
- ダウンロード解放は現在の premium 判定に「購入済みか」を OR で追加（`purchases` テーブルを足す）。
