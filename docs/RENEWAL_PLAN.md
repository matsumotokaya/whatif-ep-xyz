# WHATIF Gallery Renewal Plan

最終更新: 2026-06-16

## Purpose

`WHATIF Gallery` を単なる閲覧サイトではなく、以下 3 つの体験を 1 つの作品導線に統合する。

1. ギャラリー閲覧
2. 壁紙ダウンロード
3. IMAGINE での編集

狙いは、Instagram / Threads から流入したユーザーを `作品を見る` だけで終わらせず、`壁紙が欲しい` `編集してみたい` という行動に変換し、ログイン数と Premium 課金率を上げること。

## Product Direction

現状:

- `whatif-ep.xyz` は閲覧されている
- `The Club` の壁紙には需要がある
- `IMAGINE` は無料ユーザーはいるが、有料ユーザーは 0 人
- Supabase `bannalist` project の `public.episodes` が現在の基準データ

判断:

- 集客済みのギャラリーを主導線として使う
- サイト統合を先にやるのではなく、`作品データ統合` を先にやる
- UX のハブは `1作品` にする
- `episode` `reel` `experiment` `remix` は別機能ではなく、同じ作品体系のシリーズとして扱う
- ただし実装順は段階的にし、最初は `episode` シリーズだけを先に完成させる

## Core Decisions

### 1. Data model starts from `work`, not `episode`

現在の `episodes` は `WHATIF` の一部シリーズに過ぎない。  
今後は公開面・壁紙・IMAGINE 連携のすべてを `work` 中心で扱う。

ただし、いきなり `public.works` へ全面移行するのではなく、最初の段階では `public.episodes` を `series = episode` のデータソースとして活かす。

### 2. Existing `/episodes/:number` compatibility is not required

SEO 互換は優先しない。  
今後は Gallery UI から自然に辿れることを重視し、新しいルーティングへ寄せてよい。

### 3. `series`, `theme`, and `offer` are separate concepts

混ぜないこと。

- `series`: `episode` / `reel` / `experiment` / `remix`
- `theme_category`: `portrait` / `nature` / `digital` など画風や主題
- `offer`: `wallpaper` / `imagine_starter` / `imagine_template` / `store_product`

### 4. IMAGINE integration starts with `starter`, not full templates

全作品を最初から手作業テンプレート化しない。  
まずは `作品画像を背景として読み込んだ編集開始状態` を全作品で用意する。

### 5. A single published item may contain multiple variants

`episode 0100` の中に 9 枚ある、`reel` の中に複数 scene がある、`remix` に複数 angle がある、といった構造を最初から許容する。  
よって `1 URL = 1 画像` ではなく、`1 work = 1作品単位` とし、その中に `variants` を持てるようにする。

## Incremental Strategy

今回のリニューアルは、最初から全シリーズ対応の DB 移行を完了させる前提では進めない。  
先に Gallery UI と運用を `series-aware` にし、その上で `episode` を完成させてから他シリーズを追加する。

### Step 1. `episodes` stays as the current source of truth

当面は Supabase `bannalist.public.episodes` をそのまま使う。

- 既存の登録フローを壊さない
- 既存エピソードの補完を優先する
- サイト上の見せ方だけ先に `series` 概念へ寄せる

この段階では、アプリケーション上で `episode` を `series` の 1 種として扱えばよい。

### Step 2. UI becomes series-aware before DB becomes fully generalized

Gallery は将来的に複数シリーズを選べる構造で作る。  
ただし初期状態では `episode` だけが公開対象。

想定 UI:

- Series switcher
- 初期選択は `episode`
- `reel`, `experiment`, `remix` は準備中またはデータ未投入扱い

これにより、後からシリーズを追加しても UI の骨格を変えずに済む。

### Step 3. Finish the `episode` catalog first

最優先は `episode` を完成させること。

- 欠番や未登録データの洗い出し
- タイトル、サムネイル、原画、公開状態の整備
- 作品詳細ページの品質統一
- 壁紙導線と IMAGINE 導線を `episode` で先行実装

### Step 4. Add more series after the episode workflow is proven

`episode` で運用と導線が回ることを確認してから、

- `reel`
- `experiment`
- `remix`

を順番に追加する。

### Step 5. Introduce a full `works` schema when needed

複数シリーズが実際に運用へ乗る段階で、`works` 系テーブルへ一般化する。

そのタイミングで実施候補:

- `work_series`
- `works`
- `work_assets`
- `work_offers`

必要なら `episodes` から `works` への移行、または `episodes` を `works` に吸収する移行を行う。

## Target Information Architecture

今後の情報設計は 4 階層で考える。

```text
gallery
├─ series
│  ├─ work
│  │  ├─ variant
│  │  ├─ wallpaper offers
│  │  ├─ imagine starter
│  │  ├─ imagine template (optional)
│  │  └─ store product (optional)
```

意味:

- `gallery`: サイト全体の作品導線
- `series`: `episode` / `reel` / `experiment` / `remix`
- `work`: 作品本体。例 `episode 0100`
- `variant`: 作品内の個別画像・scene・angle。例 `episode 0100-05`

1作品をハブにして、周辺オファーをぶら下げる。

```text
work
├─ gallery page
├─ variants
├─ wallpaper offers
├─ imagine starter
├─ imagine template (optional)
└─ store product (optional)
```

## Proposed Data Model

### `work_series`

作品シリーズの定義。

```sql
id uuid primary key
slug text unique not null
name text not null
route_base text not null
number_padding integer not null
sort_order integer not null
is_public boolean not null default true
```

初期データ:

- `episode`
- `reel`
- `experiment`
- `remix`

### `works`

作品の正本。

```sql
id uuid primary key
series_id uuid not null references work_series(id)
sequence_number integer not null
display_code text not null
title text not null
slug text unique
theme_category text
summary text
released_on date
status text not null
is_featured boolean not null default false
original_storage_key text not null
thumbnail_storage_key text
width integer
height integer
source_prompt text
source_model text
source_notes text
created_at timestamptz not null default timezone('utc'::text, now())
updated_at timestamptz not null default timezone('utc'::text, now())
unique(series_id, sequence_number)
unique(series_id, display_code)
```

補足:

- `display_code` は `0001`, `R012` のような表示用コード
- `status` は `draft` / `published` / `archived`
- 旧 `episodes.category` は `theme_category` に移す

### `work_variants`

1作品の中の複数画像・複数 scene・複数 angle を表す。  
今後の壁紙・テンプレートは `work` 単位だけでなく `variant` 単位でも紐づけ可能にする。

```sql
id uuid primary key
work_id uuid not null references works(id)
variant_number integer not null
display_code text not null
title text
caption text
variant_type text not null
status text not null default 'published'
sort_order integer not null default 0
is_primary boolean not null default false
source_asset_id uuid
created_at timestamptz not null default timezone('utc'::text, now())
updated_at timestamptz not null default timezone('utc'::text, now())
unique(work_id, variant_number)
unique(work_id, display_code)
```

初期の `variant_type`:

- `image`
- `scene`
- `angle`
- `edit`

例:

- `episode 0100` に `variant 01` から `09`
- `reel 0012` に `scene 01` から `08`
- `remix 0031` に `angle 01` から `04`

命名の考え方:

- `work` が公開上の主キー
- `variant` は作品内部の連番
- 壁紙や IMAGINE の導線は `work` 単位でも `variant` 単位でも作れる

### Minimal episode-first variant spec

最初の実装では、`episode` に対してだけ最小 variant 仕様を導入する。  
形式は `episodeNumber-variantNumber` とする。

例:

- `0001-1`
- `0001-2`
- `0100-5`

前提:

- variant が 1 つしかない作品も必ず `-1` を持つ
- 現状の大半は `-1` のみ
- Instagram 投稿上の現実的な上限を踏まえ、当面の上限は `1` から `10`

初期ルール:

- `episode 0001` が単独画像でも、内部的には `0001-1`
- `episode 0100` に 9 枚あるなら `0100-1` から `0100-9`
- 将来 series が増えても、まずは同じ考え方で `variant_number` を持てる

variant 表示ルール:

- UI 上の primary variant は `1`
- `-1` は常に存在する前提で運用する
- variant が未登録なら、その番号は存在しない

variant の状態:

- `ready`: 画像あり、表示可能
- `preparing`: 将来的に用意する予定だが未完成
- `hidden`: 管理用。UI には出さない

## Minimal DB Extension For Episodes

最初の段階では `public.episodes` を壊さない。  
`works` へ即移行するのではなく、`episodes` に対して additive に 2 テーブルだけ足す。

実装メモ:

- これは低リスク案として残す
- 実際の SQL migration は、2026-06-17 時点で `work_series / works / work_variants / work_offers` の本命スキーマを先に切る方針へ変更した
- 理由は、既存互換よりも最終形への一直線な移行を優先するため

方針:

- `episodes` はそのまま正本
- `variant` 情報は `episode_variants`
- 壁紙 / IMAGINE / 商品導線は `episode_variant_offers`
- `series` は当面 DB ではなくアプリ設定として持つ

これで、現行の `/episodes` と `/episodes/:number` は壊さずに、新 Gallery だけ先に variant 対応へ進められる。

### Table 1. `episode_variants`

役割:

- `episode` の中の `1-1`, `1-2`, `1-3` を持つ
- 画像実体と表示順を持つ
- まずは `variant 1` を全 episode に backfill する

```sql
create table if not exists public.episode_variants (
  id uuid primary key default gen_random_uuid(),
  episode_id integer not null references public.episodes(id) on delete cascade,
  variant_number integer not null,
  display_code text not null,
  title text,
  caption text,
  variant_type text not null default 'image',
  original_storage_key text not null,
  thumbnail_storage_key text,
  status text not null default 'ready',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint episode_variants_variant_number_check
    check (variant_number between 1 and 10),
  constraint episode_variants_status_check
    check (status in ('ready', 'preparing', 'hidden')),
  constraint episode_variants_variant_type_check
    check (variant_type in ('image', 'scene', 'angle', 'edit')),
  unique (episode_id, variant_number),
  unique (episode_id, display_code)
);
```

運用ルール:

- `display_code` は `0001-1`, `0100-5`
- `variant 1` は必須
- `is_primary = true` は通常 `variant 1`
- 既存の `episodes.original_storage_key` / `thumbnail_storage_key` は `variant 1` に backfill する

このテーブルを入れる理由:

- 既存 `episodes` の構造を変更しない
- 複数画像対応だけを先に始められる
- 新 UI は `episode_variants` を見て variant picker を出せる

### Table 2. `episode_variant_offers`

役割:

- 各 variant に対して何を提供するかを持つ
- `wallpaper` / `imagine_starter` / `imagine_template` / `store_product`
- `ready` だけでなく `preparing` を持てる

```sql
create table if not exists public.episode_variant_offers (
  id uuid primary key default gen_random_uuid(),
  episode_variant_id uuid not null references public.episode_variants(id) on delete cascade,
  offer_type text not null,
  plan_type text not null,
  status text not null default 'preparing',
  title text,
  description text,
  target_ref text,
  target_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint episode_variant_offers_offer_type_check
    check (offer_type in ('wallpaper', 'imagine_starter', 'imagine_template', 'store_product')),
  constraint episode_variant_offers_plan_type_check
    check (plan_type in ('public', 'free', 'premium', 'paid')),
  constraint episode_variant_offers_status_check
    check (status in ('ready', 'preparing', 'requested', 'hidden')),
  unique (episode_variant_id, offer_type)
);
```

運用ルール:

- `target_ref` は内部参照用
  - 例: The Club item slug
  - 例: IMAGINE template id
- `target_url` は直接遷移用
- `status = preparing` なら UI 上は `準備中`
- `status = requested` を使うなら `Request` ボタンを出す

### Backfill Rule

初回 migration では、全 episode に `variant 1` を作る。

考え方:

- 今の単一画像 episode はすべて `0001-1` として取り込む
- `episodes` の画像情報をそのまま `episode_variants` へコピーする
- `episodes.product_url` がある場合は、`variant 1` の `store_product` offer に移すか、当面は legacy 値として併存させる

最小 backfill イメージ:

```sql
insert into public.episode_variants (
  episode_id,
  variant_number,
  display_code,
  title,
  variant_type,
  original_storage_key,
  thumbnail_storage_key,
  status,
  sort_order,
  is_primary
)
select
  e.id,
  1,
  e.number || '-1',
  e.title,
  'image',
  e.original_storage_key,
  e.thumbnail_storage_key,
  case when e.is_published then 'ready' else 'hidden' end,
  1,
  true
from public.episodes e
on conflict (episode_id, variant_number) do nothing;
```

### Why no `series` table yet

最初の Gallery リニューアルに必要なのは UI 上の切替であって、DB 上の series 一般化ではない。  
なので最初はコード上の定数で十分。

例:

```ts
const gallerySeries = [
  { slug: 'episode', label: 'Episode', status: 'ready' },
  { slug: 'reel', label: 'Reel', status: 'coming_soon' },
  { slug: 'experiment', label: 'Experiment', status: 'coming_soon' },
  { slug: 'remix', label: 'Remix', status: 'coming_soon' },
];
```

これにより:

- UI はすぐ series-aware にできる
- DB migration を最小に保てる
- 後から `works` へ一般化するときに破壊的変更を減らせる

### Optional later table: `episode_variant_requests`

`Request this variant` を本当に集計したくなったら、後から追加する。

```sql
create table public.episode_variant_requests (
  id uuid primary key default gen_random_uuid(),
  episode_variant_id uuid not null references public.episode_variants(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  note text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
```

ただし最初は不要。  
まずは `preparing` 表示だけで十分。

### `work_assets`

作品に紐づく画像や配布ファイルを共通管理する。

```sql
id uuid primary key
work_id uuid not null references works(id)
variant_id uuid references work_variants(id)
asset_type text not null
storage_provider text not null
storage_key text not null
mime_type text
width integer
height integer
file_size_bytes bigint
variant text
status text not null default 'ready'
created_at timestamptz not null default timezone('utc'::text, now())
updated_at timestamptz not null default timezone('utc'::text, now())
```

初期の `asset_type` 候補:

- `original`
- `thumbnail`
- `variant_original`
- `variant_thumbnail`
- `wallpaper_cover`
- `wallpaper_zip`
- `imagine_starter_preview`
- `imagine_template_preview`
- `social_preview`

### `work_offers`

作品に対して何を提供するかを表す。  
`has_wallpaper` のような boolean は持たず、オファーの存在で表現する。

```sql
id uuid primary key
work_id uuid not null references works(id)
variant_id uuid references work_variants(id)
offer_type text not null
plan_type text not null
status text not null
title text
description text
cover_asset_id uuid references work_assets(id)
target_url text
target_ref text
sort_order integer not null default 0
published_at timestamptz
unique(work_id, offer_type, target_ref)
```

補足:

- `variant_id` が `null` の場合は作品全体向けオファー
- `variant_id` が入る場合は特定バリエーション向けオファー
- 例: `episode 0100` 全体の壁紙セット、`episode 0100-05` 専用テンプレート

offer の初期ステータス方針:

- `ready`: ボタン押下で利用可能
- `preparing`: ボタンは出すが `準備中`
- `requested`: リクエストあり、未制作
- `hidden`: まだ見せない

初期の `offer_type`:

- `wallpaper`
- `imagine_starter`
- `imagine_template`
- `store_product`

初期の `plan_type`:

- `public`
- `free`
- `premium`
- `paid`

### `work_tags` / `work_tag_map`

タグは後で検索・特集・AI 量産ルールに効くので入れておく。

```sql
work_tags(
  id uuid primary key,
  slug text unique not null,
  label text not null,
  tag_type text not null
)

work_tag_map(
  work_id uuid references works(id),
  tag_id uuid references work_tags(id),
  primary key(work_id, tag_id)
)
```

## Route Direction

互換維持は必須ではないため、新ルートへ寄せる。

候補:

- `/works/episode/0001`
- `/works/reel/0012`
- `/works/experiment/0007`
- `/works/remix/0031`

variant を URL に出す場合の候補:

- `/works/episode/0100/05`
- `/works/reel/0012/scene-03`
- `/works/remix/0031/02`

表示上の見せ方はシリーズごとに変えてよいが、内部構造は共通にする。

ただし初期リニューアルでは、`episode` を先に載せ替える。  
複数シリーズ UI を用意しつつ、データ投入済みなのは `episode` のみという状態を許容する。

## UX Plan

### Gallery

一覧と作品詳細の両方で、作品に紐づくオファーを見せる。

一覧ページ:

- 上部に `series switcher` を置く
- `Series` ラベル付きの dropdown でよい
- `episode` / `reel` / `experiment` / `remix` をすぐ切り替えられる
- UI は別ページ遷移でもよいが、体験としては同一 Gallery のフィルタ切替に見せる
- 初期段階では `episode` のみ実データあり、他シリーズは順次公開

シリーズ切替 UI の候補:

- dropdown

重要なのは、作品詳細に入った後でも別シリーズへすぐ移動できること。

最小 UI 仕様:

- 一覧ページのヘッダーに `Series` dropdown
- 詳細ページのヘッダーまたはサイドバーにも同じ dropdown
- 初期選択は `Episode`
- `Reel` `Experiment` `Remix` はデータ未投入なら `Coming soon` 表示でもよい

一覧カード:

- 壁紙あり
- 編集可
- 商品あり

作品詳細 CTA:

1. `Download Wallpaper`
2. `Edit in IMAGINE`
3. `View Store Item`

作品詳細ページ:

- まず `work` のメインビジュアルを見せる
- その下または横に `variants` を並べる
- variant を切り替えると表示画像、壁紙、テンプレート導線も切り替わり得る

variant UI の候補:

- サムネイル列
- `01 / 02 / 03` の picker
- `Scene` / `Angle` / `Variation` ラベル付き chips

episode 向け最小 variant UI:

- variant が 1 件のみなら picker を表示しない
- variant が 2 件以上ある場合だけ `1 2 3 ...` の小さな picker を表示
- `preparing` variant は押せるが、詳細 CTA は `準備中`
- `requested` 状態を導入する場合は `Request` ボタンを出せるようにする

### IMAGINE

まずは全作品に対して `Edit in IMAGINE` を出す。  
初期実装は `imagine_template` ではなく `imagine_starter` を使う。

`imagine_starter` の定義:

- 作品画像が背景として読み込まれている
- 必要に応じて特定 `variant` を背景として読み込める
- 必要なら safe area / crop preset を持つ
- 文字や装飾のプリセットは後から追加可能

episode-first 運用:

- すべての `episode` は最初 `variant 1` を対象に `imagine_starter` を持てる設計にする
- 他 variant は `ready` になったものから順次追加
- 未対応 variant は `準備中` として扱う

### Wallpaper

壁紙は `作品の派生物` として扱う。  
作品 1 件ごとに以下のような複数バリエーションを許容する。

- phone
- desktop
- lockscreen
- textless
- alternate color

Premium 価値は `単に元絵を落とせる` ではなく、`使いやすい派生版がまとまって手に入る` ことに置く。

また、必要なら壁紙オファーを `variant` 単位で作れるようにする。  
たとえば `episode 0100` の中の `05` だけ壁紙化する、`reel 0012` の scene ごとに壁紙化する、という運用を許容する。

episode-first 運用:

- 既存のエピソード単位パッケージはすべて `variant 1` に対応するものとして扱う
- 今後は variant ごとに壁紙オファーを追加可能にする
- `variant 1` しかない作品は従来通り見える
- `variant 2+` は `ready` なら利用可能、未対応なら `準備中`
- リクエスト導線を置く場合は `Request this variant` のような文言にする

## Wallpaper Production System

壁紙制作のボトルネックを AI エージェント前提で解消する。

詳細設計:

- [WALLPAPER_PIPELINE_PLAN.md](./WALLPAPER_PIPELINE_PLAN.md)

方針:

1. 作品を `works` として整備
2. 壁紙生成レシピを定義
3. 生成物を `work_assets` に登録
4. 配布オファーを `work_offers` に登録

将来的に持たせたい設定:

### `production_recipes`

```sql
id uuid primary key
recipe_type text not null
name text not null
prompt_template text not null
export_width integer not null
export_height integer not null
safe_area_json jsonb
output_asset_type text not null
is_active boolean not null default true
```

初期 `recipe_type`:

- `wallpaper_phone`
- `wallpaper_desktop`
- `wallpaper_lockscreen`
- `imagine_starter`

狙い:

- 1 回設計したルールで大量生産できるようにする
- 人手はレビューと公開判断に寄せる

## Rollout Plan

### Phase 1. Series-aware gallery using current `episodes`

- `public.episodes` を引き続き正本として使用
- `episode_variants` と `episode_variant_offers` を追加
- フロントエンドの情報設計を `series-aware` に変更
- 初期状態は `episode` のみ表示
- 将来の `reel` `experiment` `remix` を受け入れられる UI を先に作る
- 詳細ページも将来 `variants` を持てるレイアウトに変更する

### Phase 2. Episode catalog completion

- 現存エピソードをすべて整備
- 欠損データを洗い出して補完
- 作品詳細の CTA 導線を `episode` に先行導入
- エピソードを Gallery の完成形として仕上げる
- 複数画像を持つエピソードの variant 情報を整理する
- まずは `variant 1` を全作品で確定させる

### Phase 3. Episode-linked offers

- `episode` ごとに壁紙導線を作る
- `episode` ごとに `Edit in IMAGINE` 導線を作る
- `club_items` `templates` `starter` をエピソード基準で紐づける

### Phase 4. Wallpaper production pipeline

- AI 壁紙生成レシピを整備
- 量産用スクリプトまたはエージェント手順を作る
- まず `episode` を対象に壁紙化率を段階的に引き上げる

### Phase 5. Additional series onboarding

- `reel`
- `experiment`
- `remix`

を順番に投入する

### Phase 6. Works schema generalization

- `work_series`, `works`, `work_assets`, `work_offers` を追加
- `episode` 以外も含めた共通作品 DB に移行する
- 以後は `works` を正本にする

## Immediate Implementation Priority

次セッション以降、最初に着手する順番:

1. 現行 `episodes` を前提にした `series-aware` UI 変更方針を決める
2. 欠損エピソードを埋めるためのデータ棚卸し方法を決める
3. `episode` 内の variant をどう表現するか最小仕様を決める
4. `episode_variants` / `episode_variant_offers` の migration 草案を作る
5. `episode` と `club_items` / `templates` / `starter` の紐づけ方式を決める
6. その後に `works` 一般化の migration 草案を作る

## Notes For Future Sessions

- この計画の主語は `episode` ではなく `work`
- ただし最初の実装対象は `episode` のみ
- `work` の中に複数 `variant` があり得る前提で考える
- 互換ルートは必須ではない
- Gallery を集客の主導線として維持する
- IMAGINE は `編集の終点` ではなく `作品導線の延長` として再設計する
- 壁紙は手作業制作前提をやめ、量産レシピ前提で設計する
