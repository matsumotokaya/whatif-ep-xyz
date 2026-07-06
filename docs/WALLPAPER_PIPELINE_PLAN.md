# Wallpaper Pipeline Plan

最終更新: 2026-06-17

## Purpose

WHATIF の壁紙制作を `手作業の個別制作` から、`IMAGINE を起点にした半自動または自動の量産パイプライン` へ移行する。

この計画の目的は 3 つ。

1. 壁紙制作時間を大幅に下げる
2. `work / variant` と壁紙を正しく紐づける
3. ギャラリー、サブスク、IMAGINE を同じ制作物から連動させる

## Core Decision

壁紙の制作起点は `IMAGINE` に置く。  
`Midjourney` は作品生成の upstream だが外部サイトなので、自動化スコープからはいったん外す。

役割分担:

- `Midjourney`
  - 元作品の発生源
  - 当面は手動運用
- `IMAGINE`
  - 制作工場
  - キャラクター素材の管理
  - 背景、テキスト、レイアウト編集
  - 壁紙派生物とパッケージの生成
- `WHATIF Gallery`
  - 発見導線
  - 商品表示
  - 購入 / サブスク導線
  - ダウンロード導線

要するに:

- `IMAGINE = factory`
- `Gallery = catalog + commerce + delivery`

## Product Unit

今後、販売・配布の単位は `単一画像` ではなく `wallpaper pack` にする。

1 pack に最低限含めるもの:

1. Mobile HD
2. Mobile High Resolution
3. PC HD
4. PC High Resolution
5. Package cover / jacket

この pack が:

- 単品販売では `$1`
- サブスクではダウンロードし放題

という扱いになる。

## Canonical Source

壁紙の正本は、`IMAGINE` 上で保存された 1 つの編集済み作品とする。

制作イメージ:

1. 背景切り抜き済みのキャラクター PNG を IMAGINE のライブラリへアップロード
2. 背景、文字、タイトルを追加して構図を作る
3. IMAGINE に保存する
4. その保存作品を起点に、複数サイズの壁紙とパッケージを派生生成する

この保存作品を、この資料では `master design` と呼ぶ。

## Relationship To `work / variant`

壁紙は `episode` 単位ではなく、最終的には `work variant` 単位に紐づく。

例:

- `episode 0001-1` -> wallpaper pack 1 件
- `episode 0100-5` -> wallpaper pack 1 件
- `reel 0012 scene-03` -> wallpaper pack 1 件

ただし立ち上げ時は:

- 既存 pack はすべて `variant 1` に対応
- `variant 2+` は順次追加
- 未制作は `preparing`

## Output Spec

当面の標準出力はこの 4 つに固定する。

### 1. Mobile HD

- `1080 x 1920`
- 用途: 通常スマホ壁紙

### 2. Mobile High Resolution

- `2160 x 3840`
- 用途: 高解像度スマホ壁紙

### 3. PC HD

- `1920 x 1080`
- 用途: 通常デスクトップ壁紙

### 4. PC High Resolution

- `3840 x 2160`
- 用途: 高解像度デスクトップ壁紙

### 5. Package Cover / Jacket

これは単なる付属物ではなく、商品の見え方を決める重要要素。

最低限の用途:

- Gallery 一覧表示
- 商品詳細のメイン画像
- 単品販売ページの訴求

初期仕様案:

- `1600 x 1600` square
- 4 出力の collage
- 作品タイトル
- `Mobile + PC`
- `HD + High Resolution`

## Recommended Packaging Format

配布単位は zip が合理的。

構成例:

```text
whatif-episode-0100-5-pack.zip
├─ mobile-hd.png
├─ mobile-4k.png
├─ pc-hd.png
├─ pc-4k.png
└─ cover.jpg
```

この zip 自体を販売・配布物として扱う。

## Pipeline

## Stage 1. Manual source creation in IMAGINE

人手で行う工程:

1. キャラクター PNG をライブラリに入れる
2. 背景を置く
3. タイトルやロゴを置く
4. レイアウトを仕上げる
5. IMAGINE に `master design` として保存する

ここは当面手動でよい。  
最適化の優先対象は、この後の派生生成と公開連携。

## Stage 2. Recipe-based derivative generation

`master design` を元に、サイズ別の派生を recipe で生成する。

recipe の役割:

- 出力サイズ
- safe area
- crop / scale rule
- テキスト位置調整ルール
- cover 生成ルール

例:

- `mobile_hd`
- `mobile_4k`
- `pc_hd`
- `pc_4k`
- `pack_cover`

## Stage 3. Asset export

生成された各出力を保存する。

保存対象:

- flatten 済み PNG
- cover image
- 必要なら preview JPEG

## Stage 4. Delivery pack build

出力ファイルをまとめて zip を作る。

この段階で生成されるもの:

- zip
- cover
- preview
- metadata

## Stage 5. Gallery publish

Gallery 側では `work_offer` として公開する。

必要な表示:

- 壁紙あり
- 価格 `$1`
- サブスク対象
- `Preparing` または `Ready`

## Immediate Operating Model

最初は以下の簡易運用で十分。

1. `master design` を手動で IMAGINE に保存
2. 4 サイズの壁紙を IMAGINE で作る
3. cover を作る
4. zip を作る
5. Gallery の `work_offer` に紐づける

この状態でも、制作起点を IMAGINE に統一する意味は大きい。

## Why IMAGINE Must Be Reformed

現状の IMAGINE は `ユーザーが自由に作るバナーエディタ` であり、`WHATIF 公式制作工場` としては未完成。

IMAGINE 側の詳細設計:

- [../../imagine/docs/WALLPAPER_FACTORY_PLAN.md](../../imagine/docs/WALLPAPER_FACTORY_PLAN.md)

壁紙量産のために必要なのは、次の構造改革。

### 1. User banner storage and production storage must be separated

現在の `banners` と `user-images` はユーザー作品保存向け。  
公式商品をここに混ぜると、運用上も権限上も不自然。

必要な考え方:

- user-generated design
- official production asset
- delivery asset

は分ける。

### 2. Editable master and delivered output must be separated

`master design` は編集可能な source。  
壁紙 PNG や zip は配布専用の deliverable。

この 2 つを同一概念にすると、後で壊れる。

### 3. Export recipes must become first-class data

壁紙量産の本質は `1回作った出力ルールを何度も再利用できること`。  
よって size preset ではなく、production recipe として持つべき。

## Recommended IMAGINE Architecture Reform

`banners` をそのまま production に流用するのではなく、次の追加構造を推奨する。

### `production_projects`

IMAGINE 上の公式制作案件。

想定カラム:

```sql
id uuid primary key
project_type text not null          -- 'wallpaper_pack'
source_banner_id uuid not null      -- master design
work_series_slug text not null      -- 'episode'
work_display_code text not null     -- '0100'
variant_number integer not null     -- 5
status text not null                -- 'draft' | 'ready' | 'published'
created_at timestamptz
updated_at timestamptz
```

### `production_outputs`

派生出力ファイル。

```sql
id uuid primary key
project_id uuid not null references production_projects(id)
output_type text not null           -- mobile_hd / mobile_4k / pc_hd / pc_4k / cover
storage_path text not null
width integer not null
height integer not null
status text not null                -- 'ready' | 'failed' | 'preparing'
created_at timestamptz
updated_at timestamptz
```

### `delivery_packages`

販売・配布単位。

```sql
id uuid primary key
project_id uuid not null references production_projects(id)
cover_storage_path text
zip_storage_path text
status text not null                -- 'draft' | 'ready' | 'published'
price_usd numeric(10,2)
is_subscription_included boolean not null default true
created_at timestamptz
updated_at timestamptz
```

## Gallery Integration

Gallery 側は制作を持たず、配布情報だけを持つ。

流れ:

1. IMAGINE で `delivery_package` が `ready`
2. package cover と zip URL を確定
3. Gallery の `work_offers` に `wallpaper` offer を作る
4. `target_ref` に package id を入れる
5. `target_url` は Gallery の購入 / ダウンロードページへ向ける

つまり:

- IMAGINE は作る
- Gallery は見せて売って渡す

## IMAGINE Asset Reuse

壁紙制作物は、販売物であると同時に IMAGINE 側の資産にもなる。

二次利用の方向:

### 1. Premium library asset

生成済みの PNG を premium ライブラリ素材として使えるようにする。

### 2. Starter template

`master design` から `imagine_starter` を作る。  
これにより `Edit in IMAGINE` 導線へ直結できる。

### 3. Featured template

反応の良い作品だけ、丁寧に調整した `imagine_template` を作る。

## Automation Boundary

当面の自動化対象:

- size recipe による派生生成
- cover 生成
- zip 生成
- Gallery 連携

当面の手動対象:

- Midjourney での元作品生成
- キャラクター切り抜きの最終確認
- `master design` の構図づくり

## Operating Principle

今後の壁紙制作は `個別に4枚作る` ではなく、`1つの master から4枚を派生生成する` ことを原則にする。

この違いが最重要。

## Rollout Plan

### Phase 1. Manual but IMAGINE-centered

- 制作起点を IMAGINE に統一
- 4サイズと cover を毎回作る
- Gallery に手動登録する

### Phase 2. Recipe + export automation

- recipe を作る
- 4 出力を半自動化する
- cover を自動生成する

### Phase 3. Package automation

- zip を自動生成する
- package metadata を自動生成する
- Gallery の `wallpaper` offer を半自動で作る

### Phase 4. Full sync

- `work / variant` から IMAGINE production project を起動
- package 完成後に Gallery へ publish
- `Preparing` -> `Ready` を自動反映

## Immediate Next Decisions

この資料の次に決めるべきこと:

1. 壁紙 4 出力の正式サイズ
2. package cover の正式デザイン規格
3. Gallery 側での単品販売ページを持つか、The Club / Imagine に寄せるか
4. IMAGINE に追加する production 用テーブルを先に作るか
5. 最初の `master design` をどう命名・管理するか

## 現在地と残タスク（旧 ROADMAP.md より統合・2026-06-20 時点）

「受け入れの器」は完成済み。これ以降の主題は **中身（量産）／収益動線（サブスク）／IMAGINE 連携の自動化**。

- **器の完成状況**: `series-aware` ギャラリー（`/works/:series`）稼働、DB は最終形スキーマ（`works` / `work_variants` / `work_offers` / `production_*`）投入済み。壁紙セールス LP（カバー＋透かしプレビュー＋premium gating）＋ zip ダウンロードまで実装済み。公開判定は published な `production_projects` の実在から導出（手動同期不要）。
- **量産の現状値（ボトルネック）**: 全 464 works に対し published パックは **`episode 0439-1` の 1 件のみ**。残りは feed もパックも未出力。この Pipeline（Phase 2 以降の recipe 派生・cover 自動生成・zip 自動化）で量産率を上げるのが最優先。
- **収益動線**: 壁紙**単品購入（$1, Stripe `mode:"payment"`）は実装済み（2026-06-27）**。未整理は「単品 vs サブスク（The Club premium＝ダウンロードし放題）の出し分け」と「`work_offers` の wallpaper と The Club カタログの一本化」。`production_delivery_packages` に `price_usd` / `is_subscription_included` の枠あり。
- **小粒タスク**:
  - 一覧カードの壁紙バッジ（`WorkCard` の `wallpaperOffer` バッジは `work_offers` 依存で現状非表示）。出すなら `work_offers` の wallpaper インデックス化を検討。
  - 複数 variant を持つ作品の variant picker と、variant 単位の壁紙オファー運用。
  - 他シリーズ（`reel` / `experiment` / `remix`）のデータ投入は episode 運用が固まってから。
