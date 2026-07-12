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

- キャラクター切り抜き: `character-archive/assets/chars/`（元は Content Factory の `character_cutout`）
- 実作品feed画像: `detail-scroll/assets/ep/`（元は `projects/whatif/_feed/`）
- 将来的には R2 の共有プレフィックス（例 `lab/shared/`）へ集約し、各プロトタイプから共通参照する方針

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
