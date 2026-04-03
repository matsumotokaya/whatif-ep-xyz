# The Club Status

最終更新: 2026-04-03

## 目的

旧 PHP サイトの `The Club` を、この Next.js サイトへ移行する。
初期リリースのゴールは以下の 3 点。

- premium ユーザーだけが新サイト上で The Club に入れる
- 旧 The Club 資産を R2 + Supabase catalog で配信できる
- `/the-club` -> 一覧 -> 詳細 -> ダウンロード が通しで動く

## 現在地

コア機能（premium 判定・一覧・詳細・ダウンロード）は本番で動作確認済み。
残っているのは旧サイトからの導線切替と運用整理。

## コードベースで確認できたこと

### 認証 / 権限制御

- `src/lib/club/access.ts`
  - サーバー側で `supabase.auth.getUser()` を使ってユーザー判定している
  - `public.profiles.subscription_tier = 'premium'` を The Club 利用条件にしている
- `src/app/the-club/page.tsx`
  - The Club の入口ページあり
- `src/app/the-club/library/page.tsx`
  - premium でない場合は保護画面を出す
- `src/app/the-club/[slug]/page.tsx`
  - premium でない場合は詳細も見せない
- `src/app/auth/login/page.tsx`
  - ログイン画面あり
- `src/app/auth/login/LoginPageClient.tsx`
  - email/password と Google OAuth の導線あり
- `src/app/auth/callback/route.ts`
  - OAuth コールバックあり
  - 2026-04-03 時点で `next` パラメータの安全化を追加済み

### カタログ / DB

- `supabase/migrations/20260403_create_club_items.sql`
  - `public.club_items` テーブル定義あり
  - RLS 有効
  - premium ユーザー向け SELECT policy あり
- `supabase/migrations/20260403_extend_club_items_kind.sql`
  - `kind = 'book'` を許可する拡張あり
- `src/lib/club/catalog.ts`
  - The Club 一覧・詳細はプレースホルダではなく `club_items` を読む実装に切替済み
  - `getClubItems()`, `getClubItem()`, `getClubStats()` が存在

### ダウンロード / ストレージ

- `src/app/api/the-club/download/[slug]/route.ts`
  - premium 判定後に `club_items.storage_key` から R2 署名付き URL を発行する実装あり
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` が必要
  - 2026-04-03 時点で Next.js 16 の Route Handler 型に追従し、`npm run build` が通る状態に修正済み

### 旧資産の棚卸し / 移行補助

- `scripts/inventory-club-assets.sh`
  - 旧 FTP の資産から manifest CSV を作る
- `scripts/upload-club-assets.sh`
  - manifest をもとに R2 へアップロードする
- `scripts/generate-club-items-sql.mjs`
  - manifest から `club_items` 用 upsert SQL を生成する
- `data/club-assets-manifest.csv`
  - 253 件
  - `wallpaper: 249`, `reel: 4`
  - ZIP 合計サイズは約 `1.48 GB`
  - R2 で必要なオブジェクト数は `424`（zip + thumb 合算）
- `data/club-items-upsert.sql`
  - manifest から生成済み

## 前回セッションのメモから引き継ぐ事実

以下はコードではなく、前回セッションの実行結果として共有された内容。
再確認は必要だが、現時点では前提として扱ってよい。

- `club_items` への SQL 投入は成功済み
- R2 `club/` 配下オブジェクト数は `424` で manifest 期待値と一致
- reel の `sort_order` null 問題は修正済み
- 旧資産では `0076` と `0213` に zip が無く、manifest から除外した

## 最新の確認結果（2026-04-03）

- Vercel 本番に `R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY` を登録済み
- 本番で `/api/the-club/download/wallpaper-0001` のダウンロードが成功
- `cover_image_url` のサムネイルを一覧/詳細で表示する実装を追加

## まだ残っていること

### リリース前に必須

1. 旧サイトから新サイトへの導線切替方法を決める
   - いつ `/the-club` を新導線にするか
   - 旧 PHP 側をいつ閉じるか
2. `NEXT_PUBLIC_SITE_URL` を一時的に Vercel ドメインに設定
   - 最終ドメイン確定時に値と Supabase Redirect URLs を更新する

### 実装は動くが、判断が必要

1. `/the-club` の stats は匿名 / free ユーザーだと RLS で 0 件表示になる
   - 公開向けに件数を見せたいなら別実装が必要
2. サムネイルが無いエピソードは "No preview" 表示になる
3. `book` kind は DB 制約には入っているが、実データ投入フローは未整備

### 早めに片付けたい運用課題

1. 移行スクリプトに FTP 接続情報のデフォルト値が入っている
   - コミット前に環境変数必須へ寄せる方が安全
2. `THE_CLUB_MIGRATION_PLAN.md` は初期計画中心で、実装進捗の反映は弱い
   - 実運用ではこの `THE_CLUB_STATUS.md` を引き継ぎ基準にする

## 完成までの推奨順序

1. `/the-club` 導線を新実装に切り替える
2. 旧 PHP 側の停止条件を整理する

## 今すぐ再開するときのチェックリスト

- `npm install`
- `.env.local` に Supabase / R2 の値があるか確認
- `npm run lint`
- `npm run build`
- premium 会員で `npm run dev` を開いて手動確認

## 2026-04-03 時点の補足

- `npm run lint` は通過
- `npm run build` は通過
- Google OAuth ログイン後も `next` を維持するよう修正済み
