# WHATIF Gallery

WHATIF EP - Digital Art Gallery

**Production URL:** https://whatif-ep.xyz

---

## Renewal Status

このリポジトリは、Gallery(Next.js) に IMAGINE を統合し、**単一アプリ・単一ドメイン（`whatif-ep.xyz`）** へ再設計するリニューアルの本体実装を main へ反映済みです。`whatif-ep.xyz` 単一アプリは本番稼働中で、現在の最優先は **M5: `app.whatif-ep.xyz` のアクセスをギャラリートップへ集約する**、次が **M6: 旧 IMAGINE を止める** ことです。DB cleanup や細かい片付けは後追いでよい前提に切り替えています。

正本ドキュメント（この順で読む）:

1. [docs/README.md](docs/README.md) — docs の入口。Current / Archive の区分と読む順番
2. [docs/CUTOVER_MILESTONES.md](docs/CUTOVER_MILESTONES.md) — 停止までの実行順・完了条件・runbook
3. [docs/NEXT_SESSION_HANDOFF.md](docs/NEXT_SESSION_HANDOFF.md) — 次回再開の短縮版（現在 M5/M6）
4. [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) — プロダクト全体の正本（4層ラダー / 価格 / The Club 格下げ）
5. [docs/ARCHITECTURE_OVERVIEW.md](docs/ARCHITECTURE_OVERVIEW.md) — 2リポジトリ横断地図

データモデルは `episode` から `work` / `work_variant` 中心へ移行済み（canonical works は IMAGINE Content Factory から同期）。

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
│   ├── edit/                         # IMAGINE editor routes (single-origin)
│   ├── mydesign/                     # User banner/design library
│   ├── mypage/                       # Account page
│   ├── plans/                        # Pricing / upgrade page (legacy /upgrade)
│   ├── success/                      # Stripe success return page
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
│   ├── admin/                        # content-factory / cover-lab / storage-cleanup
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
    ├── club/ · admin/ · supabase/ · stripe.ts
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

## Session Note: 2026-06-27

R2 まわりのやり残しに着手し、画像URL生成の一元化と R2 delete 経路を完了。あわせて現状に合わなくなっていた記述を更新した。

- **画像URL生成を単一リゾルバへ一元化（完了）**: `images.ts` / `work-images.ts` / `wallpaper.ts` / `club/catalog.ts` に散在していたURL構築を `src/lib/asset-url.ts` の `resolveAssetUrl(provider, key, {version})` に集約。`supabase` / `r2-legacy`（旧 `pub-…r2.dev`）/ `r2-assets`（`assets.whatif-ep.xyz`）＋full-URL passthrough と `?v=` 付与を統一し、provider 対応漏れを構造的に解消。（旧計画 `docs/IMAGE_URL_REFACTOR.md` は完了につき削除）
- **IMAGINE 側に R2 delete 経路（presigned DELETE）を実装・本番デプロイ（完了）**: `r2-presign` Edge Function（v2 ACTIVE）に PUT と対称の権限チェックで delete を追加。後続バックフィルの旧版削除の前提が整った。正本は `imagine/docs/R2_MIGRATION.md`。
- **記述の現状反映**: 壁紙の単品販売は実装済み（後述）。旧ロリポップサーバーは停止済み。
- **残（R2移行の続き）**: 残バックフィル（default-images 388MB / 残り user-images 518MB ≈ 計約906MB が Supabase 残存）。実行は provider 列 DDL と R2 creds 投入が前提。

## Session Note: 2026-06-26

IMAGINE の画像ストレージ Cloudflare R2 移行（production 出力）に合わせ、Gallery 側を対応・修正した。

- **Vercel Image Optimization をサイト全体で無効化**（`next.config.ts` `images.unoptimized = true`）。全画像は R2（egress 無料）から直接配信。無料枠超過の **402 Payment Required** で詳細/ヒーロー/壁紙カバー等が表示されなくなっていた問題の根本対応。
- `src/lib/wallpaper.ts` `buildPublicUrl` を `storage_provider` 対応化（R2移行済み作品は `assets.whatif-ep.xyz/{bucket}/{path}` を生成）。これが漏れていて削除済み Supabase URL を返していた。
- `EpisodeDetailImage` / `WorkCard` にキャッシュ画像の `onLoad` 不発対策（ref + `img.complete`）。
- `assets.whatif-ep.xyz` を `images.remotePatterns` に追加（最適化無効化後は不要だが残置）。

**この宿題は完了（2026-06-27）**: 画像 URL 生成を `src/lib/asset-url.ts` の `resolveAssetUrl` に一元化し、provider 対応漏れを構造的に解消した（旧計画 `docs/IMAGE_URL_REFACTOR.md` は削除）。IMAGINE 側 R2 移行の正本は `imagine/docs/R2_MIGRATION.md`。

## Session Note: 2026-06-25

This session aligned Gallery-side notification and purchase handling with the current production flow.

- Added Resend-based notification helpers for Gallery purchase/account events
- Added signup notification trigger wiring so Gallery auth flow can call the shared `notify-account-signup` Supabase function
- Updated wallpaper purchase handling to be idempotent by `stripe_checkout_session_id`
- Added buyer/admin wallpaper purchase notification send on successful Stripe webhook processing
- Updated docs and env examples for `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `CONTACT_NOTIFICATION_EMAIL`
- Expanded the lightweight cross-subdomain SSO bridge:
  - both apps re-check the shared SSO cookie on boot, focus, and visibility return
  - login carry-over now works more reliably in both directions when the other app is revisited
  - **2026-07-02 追記**: アプリ統合 M2（履歴: `docs/archive/CONSOLIDATION_PLAN.md`）で Gallery 側の SSO 実装（`src/lib/ssoCookie.ts`・boot/focus/visibility 再チェック・`wf-sso-token` 読み書き）は撤去済み。認証は `@supabase/ssr` の単一オリジンセッションのみ

Confirmed in production:

- Verified-account welcome mail is now sent after email verification, not before

Remaining production verification:

- Wallpaper purchase notification still needs a real production purchase check
- Premium subscription notification is implemented on the IMAGINE Supabase webhook side but still needs a real production subscription check

Future auth hardening:

- ~~Replace the current browser-readable shared SSO cookie with an HttpOnly cookie based, server-led session design~~ → 解決（2026-07-02 統合 M2 で SSO クッキー自体を廃止。セッションは `@supabase/ssr` クッキーに一本化）

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
- [x] IMAGINE 統合本体（`/edit` `/mydesign` `/mypage` `/plans` `/success` `/admin/content-factory` `/admin/cover-lab` `/admin/storage-cleanup` を Gallery 側に移植し、認証を `@supabase/ssr` の単一オリジンセッションに統合）
- [x] パフォーマンス最適化（ギャラリー一覧/作品詳細を「カタログ即時描画＋ユーザー固有データ（保存/購入/管理）の Suspense ストリーミング分離」に変更。初回ロードの3秒ブロックを解消）
- [x] SEO 強化（`sitemap.ts` / `robots.ts` / `/episodes`→`/works/episode` の 301 リダイレクト / metadataBase・keywords・OpenGraph・Twitter Card / canonical / JSON-LD）
- [x] 多言語フォント対応（CJKシステムフォントのフォールバック明示で韓国語・中国語の文字化けを解消）
- [x] 壁紙ダウンロードのフィードバックUI（押下→準備中→進捗→完了/失敗、連打防止、5言語対応）
- [x] 作品詳細のアートワーク自体を IMAGINE 編集導線化（PC: ホバーで編集オーバーレイ→新タブ / モバイル: タップで確認モーダル）
- [x] トップ導線の変更（ドメインルート `/` を `/works/episode` へリダイレクトしギャラリーを主導線化。旧ヒーローは `/about` に退避し、ハンバーガーメニューの「ABOUT」からリンク。今後ヒーロー下に About Us の本文を追記予定）
- [x] 画像URL生成の一元化（`images.ts` / `work-images.ts` / `wallpaper.ts` / `club/catalog.ts` を単一 provider 対応リゾルバ `src/lib/asset-url.ts` `resolveAssetUrl` に集約）
- [x] 壁紙の単品購入（Stripe `mode:"payment"` + `STRIPE_WALLPAPER_PRICE_ID` + `public.wallpaper_purchases`。premium 会員/既購入者は checkout スキップ）

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
  - 現在は **M5/M6 待ちの legacy サブドメイン**。次段階で `whatif-ep.xyz/` トップへの 301 を入れ、その後に旧 Vite 実体を停止する。
- CloudflareのProxy（オレンジ雲）は**必ずOFF（DNS only）**にすること。ONにするとVercelが所有権確認できなくなる

### サイト運用の残件
- [ ] **M5: `app.whatif-ep.xyz` の 301 cutover** — `app.whatif-ep.xyz` へのアクセスを `https://whatif-ep.xyz` へ集約し、最低限 `/banner?template=` と `/upgrade` がギャラリートップへ飛ぶことを確認して旧入口を切り替える
  - `next.config.ts` には host 条件 redirect（`app.whatif-ep.xyz/:path*` → `https://whatif-ep.xyz`）を実装済み。確認は `npm run check:m5-redirects`、ローカル preflight は `M5_REQUEST_BASE=http://127.0.0.1:3000 npm run check:m5-redirects`
- [ ] **M6: 旧 IMAGINE 停止** — 旧 Vite デプロイ停止。stale env / docs / DNS / rollback メモ整理は後追いでよい
- [ ] **後追い cleanup** — `work_offers.target_url` の旧 `app.whatif-ep.xyz/banner?template=` 更新（`scripts/m5_work_offers_target_url_cutover.sql` と rollback 付き）、Stage D 破壊片付け、`src/lib/imagine-links.ts` の runtime shim の格下げ
- [ ] **後追い security** — `create-checkout-session` 呼び出し元検証、admin 直 Supabase 操作の RLS 確認
- [ ] **R2カスタムドメイン** — 既存ギャラリー画像は現在もR2のデフォルトURL（`pub-xxx.r2.dev`）。カスタムドメインへの切り替え予定（IMAGINE production アセットは既に `assets.whatif-ep.xyz`）

### 旧サイト（ロリポップ）
- URL: `workflowdesign.chicappa.jp/whatif-ep/`
- **停止済み**。新サイトへの移行完了に伴いサーバーを停止した（legacy 会員は新サイトの `/auth/legacy-login` に統合済み）。

### 今後の作業計画
- docs の入口と運用ルール: [docs/README.md](docs/README.md)
- 統合カットオーバー（現在の本線）: [docs/CUTOVER_MILESTONES.md](docs/CUTOVER_MILESTONES.md)（M1-M6）
- 次回再開の短縮版: [docs/NEXT_SESSION_HANDOFF.md](docs/NEXT_SESSION_HANDOFF.md)（現在 M5/M6）
- 壁紙量産・収益動線・残タスク: [docs/WALLPAPER_PIPELINE_PLAN.md](docs/WALLPAPER_PIPELINE_PLAN.md)「現在地と残タスク」
- **次期ブランディング/イントロ刷新（M5/M6 完了後に着手）**: [mockups/README.md](mockups/README.md) — 動画スクラブ型イントロ（短尺/長尺）＋ ゲームUI風キャラクターアーカイブのモックアップ。Next.js アプリ未統合・スタンドアロン静的HTMLとしていつでも確認可能

#### 壁紙の単品販売（実装済み）
The Club サブスクに加え、壁紙パックの単品購入に対応済み。
- **決済**: Stripe Checkout の `mode: "payment"`（一回払い）。単一 Product＋`STRIPE_WALLPAPER_PRICE_ID` を使い、`metadata`（wallpaper_id / user_id / series_slug / display_code / variant_number）で識別。作品ごとに Stripe 商品を作る必要はない。
- **実装**: 開始は `src/app/api/works/[series]/[code]/wallpaper/checkout/route.ts`。成功時は Stripe webhook が `public.wallpaper_purchases` に `status='paid'` を記録（`stripe_checkout_session_id` で冪等）。
- **ダウンロード解放**: premium 会員（The Club）または当該壁紙の購入者（`hasPurchasedWallpaper`）を OR で判定。premium・既購入者は checkout をスキップして即ダウンロード。
