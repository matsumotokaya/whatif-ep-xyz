# The Club Migration Plan

## Purpose

WHATIF EP の既存 PHP 製 `the-club` を、現在の技術スタック
`Next.js + Supabase Auth + Cloudflare` に沿って再構築する。

今回の目的は、旧システムをすぐに置き換えることではなく、
まずは新サイト側で The Club の最小構成を成立させること。

## Fixed Decisions

### 1. Account Base

- 認証基盤は現在参照している Supabase プロジェクトをそのまま使う
- この Supabase プロジェクトは `BANALIST` 名義だが、WHATIF サービスの一部として扱う
- アカウントデータは WHATIF / BANALIST / The Club で共通利用する

### 2. Access Policy

- The Club はログイン済みユーザー全員ではなく `premium` ユーザー限定とする
- 判定基準は `public.profiles.subscription_tier = 'premium'`
- `subscription_status` は補助情報として扱い、初期実装では主判定に使わない
- 判定はクライアント表示ではなくサーバー側で行う

### 3. Legacy Member Migration

- 旧 PHP サイトの既存会員アカウント移行は後続フェーズに分離する
- 初期実装では、現在の Supabase 上で premium 権限を持つユーザーを The Club 利用者とする
- 旧 MySQL ユーザー、招待制登録、パスワード移行は今回の実装対象外

### 4. Asset Strategy

- 壁紙や ZIP などのダウンロード資産は Cloudflare 側で private 運用する
- アプリ側は署名付き URL を短時間だけ発行して配布する
- 公開 URL を固定で露出しない
- Cloudflare で容量や運用コストに問題が出る場合のみ、S3 等への切り替えを検討する

### 5. Scope of First Release

- 旧 The Club の役割を、現行スタックでシンプルに再現する
- 最初の版では「会員限定エリア」「ダウンロード一覧」「個別ダウンロード導線」に絞る
- 決済連携、招待制登録、既存会員移行、管理画面は後回し

## Non-Goals

- 旧 PHP の完全移植
- MySQL 会員データの即時移行
- 課金システムの再設計
- 大量資産の一括移行
- 旧サイト停止

## Current System Facts

### Existing App

- `src/app/the-club/page.tsx` は現在、旧 PHP サイトへのリンクページ
- Supabase 認証はすでに導入済み
- `AuthContext` で `profiles.subscription_tier` を取得している
- `middleware.ts` でセッション更新は行っているが、The Club 専用のアクセス制御は未実装

### Existing Database

- `public.profiles` に `subscription_tier` と `subscription_status` がある
- 現在 premium ユーザーは少数存在している
- `profiles` の RLS は「本人が自分の行だけ読める」前提になっている

### Legacy Club

公開確認できた範囲では、旧 The Club は以下の役割で構成されている。

- `login.php`: ログイン画面
- `register.php`: アカウント作成画面
- `images.php`: ダウンロード一覧画面

未ログイン時は `images.php` から `login.php` にリダイレクトされる。

## Product Definition

新 The Club は、WHATIF の premium ユーザー向けダウンロードエリアとする。

提供する体験:

- ログイン済み premium ユーザーだけがアクセスできる
- 会員向けコンテンツ一覧を見られる
- 各コンテンツ詳細から、署名付き URL で安全にダウンロードできる

初期実装では「壁紙」「ZIP」「リール素材」などを同じ仕組みで扱えるようにする。

## Planned Information Architecture

### Routes

- `/the-club`
  - 入口ページ兼アクセス判定
  - 未ログインなら `/auth/login` へ誘導
  - ログイン済みだが premium でなければ案内表示
  - premium なら `/the-club/library` へ導線表示

- `/the-club/library`
  - premium ユーザー専用の一覧ページ
  - 公開中コンテンツを並べる

- `/the-club/[slug]`
  - アイテム詳細ページ
  - 説明、プレビュー、ダウンロードボタンを表示

- `/api/the-club/download/[slug]` または同等の Route Handler
  - 権限確認後に署名付き URL を返す
  - 直接ファイルパスを公開しない

## Planned Authorization Flow

1. リクエスト時にサーバー側で `supabase.auth.getUser()` を実行
2. `public.profiles` から当該ユーザーの profile を取得
3. `subscription_tier === 'premium'` を確認
4. 条件を満たす場合のみ The Club ページまたはダウンロード処理を許可

### Notes

- サーバー側では `getSession()` ではなく `getUser()` を基準にする
- クライアントの `useAuth()` は UI 補助に使ってよいが、保護判定の本体にはしない

## Planned Data Model

初期実装では、既存テーブルを壊さずに The Club 用テーブルを追加する。

### `public.club_items`

想定カラム:

- `id`
- `slug`
- `title`
- `description`
- `kind`
  - `wallpaper`
  - `zip`
  - `reel`
  - `other`
- `cover_image_url`
- `storage_key`
- `file_name`
- `file_size_bytes`
- `mime_type`
- `is_published`
- `published_at`
- `sort_order`
- `created_at`
- `updated_at`

### Optional Future Tables

- `public.club_categories`
- `public.club_item_files`
- `public.club_download_logs`

初期実装では、1 アイテム = 1 ダウンロード資産で始めてよい。

## Planned RLS Policy Direction

- `club_items` は RLS を有効化する
- SELECT は premium ユーザーだけ許可する
- 一般ユーザーや未ログインには公開しない
- 管理系の INSERT / UPDATE / DELETE は後続で追加する

実装時は shared database であることを前提に、既存 `profiles` の意味やポリシーを変更しない。

## Planned Asset Delivery Design

### Goal

重いダウンロード資産を安全に配布しつつ、アプリケーションコードや Git 管理に載せない。

### Approach

- Cloudflare 上に private 領域を用意する
- DB には公開 URL ではなく `storage_key` を保存する
- ダウンロード時にサーバー側で署名付き URL を発行する
- URL の有効期限は短くする

### Benefits

- 直接リンクの固定露出を避けられる
- 資産の置き場を後で入れ替えやすい
- Vercel 側に大きなファイルを載せずに済む

## UI Scope for First Implementation

### Included

- The Club トップ
- premium 制御
- ライブラリ一覧
- アイテム詳細
- ダウンロード導線

### Deferred

- 旧 PHP 画面の完全な見た目再現
- 招待制登録
- 会員管理 UI
- 決済や Stripe 連携
- 購入履歴やダウンロード履歴の可視化
- 旧会員の再ログイン導線

## Implementation Phases

### Phase 1: Access Foundation

- The Club 用の server-side access guard を作る
- `/the-club` 系 route のアクセス制御を入れる
- premium ではないユーザー向け案内画面を作る

### Phase 2: Data Foundation

- `club_items` テーブルを追加する
- RLS を設定する
- 最小限の seed データで動作確認する

### Phase 3: Private Download Flow

- Cloudflare private asset 配信の前提を整える
- 署名付き URL 発行エンドポイントを作る
- ダウンロード導線を詳細ページに接続する

### Phase 4: Content Integration

- 仮データを実資産に差し替える
- 壁紙 / ZIP / reel 系素材を段階的に登録する
- 必要に応じてカテゴリーや複数ファイル対応を追加する

### Phase 5: Legacy Migration

- 旧 MySQL 会員の移行調査
- 招待制または会員付与ルールの設計
- 旧サイト停止計画の策定

## Risks and Constraints

### Shared Backend Risk

- この Supabase は The Club 専用ではない
- WHATIF 以外の既存機能へ影響しないよう、変更範囲は The Club 専用領域に閉じる必要がある

### Asset Size Risk

- 壁紙や ZIP はサイズが大きい可能性がある
- 実移行前に件数、総容量、平均サイズの棚卸しが必要

### Policy Risk

- premium 判定は共通アカウントの権限モデルになる
- The Club 独自会員概念を別に増やすと、今後の運用が複雑化する

## Open Items Before Full Content Migration

- 壁紙、ZIP、リール素材の総数
- 各ファイルの平均サイズと総容量
- Cloudflare private 配信の具体構成
- premium 非会員向け文言
- The Club の初期公開対象コンテンツ

## Immediate Next Step

この計画書を前提として、次の作業では以下から実装を開始する。

1. server-side premium access guard
2. `club_items` の migration
3. `/the-club` の保護ページ化
4. 仮データによる library UI
