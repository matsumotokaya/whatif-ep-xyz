@AGENTS.md

# WHATIF EP Gallery - Project CLAUDE.md

## Overview
WHATIF EP digital art gallery（本番: https://whatif-ep.xyz）。**作品ハブ + 壁紙販売 + IMAGINE 編集導線**。
Next.js 16 + Tailwind CSS v4 + Vercel + Supabase + Cloudflare R2。
姉妹アプリ **IMAGINE**（`app.whatif-ep.xyz`）と**同一 Supabase プロジェクトを共有**する。

## Tech Stack
- **Framework**: Next.js 16 (App Router, `src/`)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (Postgres)
- **Images**: Cloudflare R2（IMAGINE production アセット = `assets.whatif-ep.xyz` / 旧ギャラリー画像 = `pub-…r2.dev`）
- **Payments**: Stripe（The Club サブスク + 壁紙単品購入）
- **Email**: Resend（購入/アカウント通知）
- **Hosting**: Vercel ／ **DNS**: Cloudflare（レジストラはお名前.com）

## Data Model
- 作品の正本は canonical **`works` / `work_variants`**（IMAGINE Content Factory から同期）。legacy **`episodes`** は互換目的で残存。
- 表示画像は IMAGINE Content Factory 生成の `production_outputs`。**`instagram_feed`（クレジット入り）= ギャラリー表示**、**壁紙サイズ（ノンクレジット）= 有料商品**。クレジット入り/クリーンを厳密分離（詳細は README「画像モデル」）。

## Image URLs（重要）
- 画像URLを組み立てるときは**必ず `src/lib/asset-url.ts` の `resolveAssetUrl(provider, key, {version})` を経由**する。`images.ts` / `work-images.ts` / `wallpaper.ts` / `club/catalog.ts` も全てこれを呼ぶ。直書きすると provider 対応漏れの温床になるため禁止。
- provider は `supabase` / `r2-legacy`（`pub-…r2.dev`）/ `r2-assets`（`assets.whatif-ep.xyz`）＋ full-URL passthrough。
- Vercel Image Optimization は**サイト全体で無効**（`next.config.ts` `images.unoptimized=true`）。全画像は R2 から直配信（egress 無料）。

## Project Structure
README の「Project Structure」が正本（`works/[series]/[code]` 構成、`/about`、`/the-club`、admin `/episodes/...`）。

## The Club / Auth
- Supabase Auth。**通常会員**（email/Google）＋ **IMAGINE プレミアム会員**（同一アカウント連携）＋ **legacy 会員**（`/auth/legacy-login`、`profiles.legacy_login_id` で識別）。
- 旧ロリポップ The Club は**停止済み**。

## Wallpaper 単品購入
- Stripe Checkout `mode:"payment"` ＋ `STRIPE_WALLPAPER_PRICE_ID`。成功時に webhook が `public.wallpaper_purchases`（`status='paid'`）を `stripe_checkout_session_id` で冪等記録。premium 会員または購入者でダウンロード解放。
- 開始は `src/app/api/works/[series]/[code]/wallpaper/checkout/route.ts`。

## Supabase（DB操作の注意）
- **MCP は read-only**。スキーマ変更/バックフィルの DDL/DML は**SQLを提示してユーザーが手動実行**。
- `auth.users` と `public.users(user_id)` を区別（親 `/Users/kaya.matsumoto/CLAUDE.md` のルールに従う）。
- R2 移行の正本は `imagine/docs/R2_MIGRATION.md`（残: default-images / 残り user-images のバックフィル）。

## Git
- GitHub account: **matsumotokaya**（personal）／ host: `github.com`
- Dev: `npm run dev`（http://localhost:3710、ポート固定）
