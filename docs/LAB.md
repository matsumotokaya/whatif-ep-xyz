# WHATIF LAB — UI実験とモーション制作の正本

最終更新: 2026-07-12

`/lab` は次期UIとブランド表現の**長期探索の場**。プロトタイプを本番環境で安定して閲覧でき、
かつどんどん増やしていける構造にしている。

- **本番URL**: `https://whatif-ep.xyz/lab`（noindex。ハブページ = [src/app/lab/page.tsx](../src/app/lab/page.tsx)）
- **プロトタイプ本体**: `public/lab/<slug>/` 配下のスタンドアロン静的HTML。Next.js のルーティング・データ層とは完全に独立しており、失敗しても本体に影響しない
- **プロモ動画**: レンダリング済みMP4は R2 の `lab/promo/` に置き、ハブページから直接再生する（リポジトリ・Vercelデプロイには含めない）

## 収蔵プロトタイプ

| code | slug | 内容 |
|------|------|------|
| EXP-04 | `detail-scroll/` | **Detail Flow** — ギャラリー詳細の3D回廊。慣性仮想スクロール、タッチ1:1追従＋フリック送り、静止時にスペックが遅延スタッガー表示。実feed画像8枚（EP 0450–0458）使用 |
| EXP-03 | `character-archive/` | **Character Archive** — RPGパーティ編成風キャラクター紹介＋壁紙ショップオーバーレイ。採用方向がほぼ固まっている最有力ブランディング案 |
| EXP-02 | `intro-scroll/long.html` | **WHAT THE LAND** — 92秒ショートフィルムのスクロールスクラブ再生。低解像度リール全量＋高解像度窓先読みの2層ロード |
| EXP-01 | `intro-scroll/short.html` | **A Film You Scroll** — 6秒ティザーの3幕スクラブ構成 |

## 新しいプロトタイプの追加手順

1. `public/lab/<slug>/index.html` としてスタンドアロンで作る（外部CDN・本番データ非依存。アセットは同フォルダ内にローカルコピー）
2. 重いアセット（動画・大量フレーム）は R2 `lab/<slug>/` へ上げて絶対URLで参照する
3. [src/app/lab/page.tsx](../src/app/lab/page.tsx) の `EXPERIMENTS` にカードを1件追加する

## 素材の共通ソース

**素材の正本 = `default_images`（クリーンな公式アセットライブラリ）。** クレジット入りfeed画像や
有料壁紙ではなく、Content Factory が登録したノンクレジットの公式素材（キャラ切り抜き等）を使う。
実体は全件 R2（`assets.whatif-ep.xyz/default-images/…`）にあり、**コピーせず直接参照**する。

### リゾルバAPI: `GET /api/lab/assets`

`default_images` を解決済みの公開R2 URLに変換して返す読み取り専用API
（[src/app/api/lab/assets/route.ts](../src/app/api/lab/assets/route.ts)、CORS開放・5分キャッシュ）。
これでラボ・Remotionから**全121件（今後増える分も）を無制限に参照できる**。

| パラメータ | 例 | 意味 |
|---|---|---|
| `role` | `character_cutout` \| `general` | アセット種別 |
| `work` | `407` | 作品番号（EP番号）で絞り込み |
| `tag` | `Character` | Asset Tags で絞り込み |
| `search` | `0407` | ファイル名部分一致 |
| `limit` | `100`（max 500） | 件数 |

レスポンス: `{ count, assets: [{ id, name, url, thumbnailUrl, width, height, role, tags, workNumber, seriesSlug, variantNumber }] }`

- **ラボのプロトタイプから**: `fetch("/api/lab/assets?role=character_cutout")` して `url` を `<img>` に直接使う（同一オリジン。R2から直配信されるので枚数・容量の心配は不要）
- **既存プロトタイプのローカル素材はそのまま**（変換しない）。新規制作からこのAPIを使う

### Remotion から使う

レンダリングの再現性のため、Remotion は直接URL参照ではなく**ワンコマンドで事前ダウンロード → `staticFile()`** の形をとる:

```bash
cd lab/video/imagine-promo
node scripts/fetch-assets.mjs --work 407          # EP0407の素材を取得
node scripts/fetch-assets.mjs --role character_cutout --limit 50
# → public/library/<name> に保存。コード側は staticFile("library/<name>")
```

## Video Factory（動画の生産ライン）

**`/admin/video-factory`** — Content Factory の兄弟にあたる動画製造の管理板（admin専用・アバターメニューから）。
「IMAGINEでデザイン → シーケンスに束ねる → Remotionでレンダリング」の受け渡しを担う。

1. IMAGINEのエディタで動画アスペクト（9:16等）のデザインをシーケンス分（seq1, seq2, …）作る
2. `/admin/video-factory` でバナーを検索し、クリックで順番に選んで **Download fixtures JSON**
3. 出てきた `video-fixtures.json` を `lab/video/imagine-promo/src/fixtures/` に置き、Remotionから読む

裏側は **`GET /api/video-factory/banners`**（バナー版リゾルバ、[src/app/api/video-factory/banners/route.ts](../src/app/api/video-factory/banners/route.ts)）:

- `?search=&limit=` — バナー一覧（サムネ・寸法・要素数）
- `?id=<uuid>,<uuid>,…` — **指定順どおり**のfixture配列（`{ id, name, canvasColor, width, height, elements }`、
  `scripts/fetch-banner.sh` の出力と同形式 = BannerRenderer互換）
- バナーはユーザーの私有デザインのため **admin認証必須**（`/api/lab/assets` と違い公開しない）。
  認証後はservice roleで読むので、どのアカウントのバナーでも取得できる

CLIからの個別取得は従来どおり `scripts/fetch-banner.sh <BANNER_ID> <slug>` も使える。

> 将来メモ: LAB / Content Factory / Video Factory は性質が近いので、ゆくゆく1つのシェル
> （タブ: Episodes / Videos / Experiments）へ統合する構想。現状は `/admin/*` 兄弟ルート＋
> `/lab` として並べてあり、統合はルーティング整理だけで済む配置にしてある。

## 動画制作ワークスペース（ローカル）

映像制作のソースは git 管理外のローカルワークスペース **`projects/whatif/lab/video/`** に集約
（旧 `imagine/video/` から 2026-07-12 に引越し）。

```
projects/whatif/lab/
├── video/
│   ├── imagine-promo/     # Remotion プロジェクト（プロモ動画の正本）
│   ├── video-imagine/     # チュートリアル用画面収録素材
│   └── App_Promo_Mockup_source_838617/  # 購入モックアップ素材
└── archive/
    ├── scroll-lab/        # intro-scroll の開発作業場（採用版は public/lab/ に保存済み）
    └── brand-mock/        # 却下版ゲームHUD「WHATIF//OS — THE HUB」
```

- レンダリング後は `aws s3 cp <file> s3://whatif-ep-xyz/lab/promo/<file> --endpoint-url https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com --region auto --content-type video/mp4` でR2へ上げ、`page.tsx` の `PROMOS` にカードを追加する（認証は `.env.local` の `R2_*`）
- Premiere のプロジェクト（`.prproj`）は素材を絶対パス参照しているため、引越しに伴い初回起動時にメディアの再リンクが必要になる場合がある

## 経緯

- 初期に「ゲームのHUD/インベントリ」を模した方向（WHATIF//OS）を試作したが「昔の個人サイトのようで世界観に合わない」というフィードバックで全面却下・アンラーニングし、`character-archive` としてゼロから作り直した（却下版は `lab/archive/brand-mock/` にローカル保管）
- 2026-07-12: 散在していたモックアップ（リポジトリ内 `mockups/`、ローカル `scroll-lab/` `brand-mock/`、`imagine/video/`）を `/lab` 体制に整理統合
