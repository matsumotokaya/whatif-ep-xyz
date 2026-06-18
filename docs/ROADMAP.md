# WHATIF Gallery Roadmap

最終更新: 2026-06-18

この文書は「いま何ができていて、この先に何が必要か」を簡潔に追うための作業計画。
背景・思想は [RENEWAL_PLAN.md](./RENEWAL_PLAN.md) と [WALLPAPER_PIPELINE_PLAN.md](./WALLPAPER_PIPELINE_PLAN.md) を参照。

## 現在地（2026-06 時点）

- `series-aware` ギャラリー（`/works/:series`）が稼働。episode カタログが公開済み。
- DB は最終形スキーマ（`works` / `work_variants` / `work_offers` / `production_*`）が投入済み。
- Content Factory（IMAGINE）が出力した **壁紙パックの受け入れが完成**:
  - `/works/:series/:code/wallpaper` でカバー＋4サイズを表示し、premium 限定で zip ダウンロード。
  - 作品詳細 aside に `Wallpaper available` コーナー（カバーサムネイル導線＋スペック表記）。
  - 公開判定は published な `production_projects` の実在から導出（Gallery への手動同期は不要）。
- ギャラリーカード画像は Content Factory の **feed 画像（`instagram_feed`）優先**、無い作品は従来画像にフォールバック。
- **データ実績**: 全 464 works に対し published パックは `episode 0439-1` の 1 件のみ。残りは feed もパックも未出力。

要するに「受け入れの器」は完成。これ以降は **中身（量産）** と **収益動線（サブスク）** と **IMAGINE 連携の自動化** が主題。

## この先に必要なこと

### 1. プレミアム動線（収益化）— 最優先で設計が必要

現状、壁紙ダウンロードは The Club（premium）ログインで gating しているだけで、**加入・課金そのものへの導線が未整備**。

- 非 premium が壁紙ページに来たときの加入訴求（現状は `/the-club` への素朴な CTA のみ）。
- 単品購入（$1 / pack）とサブスク（ダウンロードし放題）の出し分け。`production_delivery_packages` には `price_usd` / `is_subscription_included` の枠だけある。
- 壁紙パックに対する Stripe 課金フローは未接続（既存の The Club サブスク基盤との接続方法を決める）。
- The Club ↔ 壁紙パックの関係整理（The Club カタログと `work_offers` の wallpaper をどう一本化するか）。

### 2. IMAGINE 側でのコンテンツ量産 — ボトルネック

公開できる壁紙パックがまだ 1 件しかない。ギャラリーを「Content Factory 出力だけで構成」する状態に近づけるには、**残り作品の master design → pack を量産**する必要がある。

- まず既存 episode を対象に、`master design` 作成 → 4サイズ＋cover＋feed の出力を増やす。
- [WALLPAPER_PIPELINE_PLAN.md](./WALLPAPER_PIPELINE_PLAN.md) の Phase 2 以降（recipe による派生生成・cover 自動生成・zip 自動化）はこれから。
- 量産運用の確立（誰がいつ `production_projects` を `published` にするか、レビュー基準）。

### 3. IMAGINE ↔ Gallery のつなぎ込み — まだこれから

現状は同一 Supabase を共有し、Gallery が `production_*` を読むだけ。双方向の連携・自動反映はまだ。

- `Edit in IMAGINE` 導線（`imagine_starter`）が未実装。詳細ページは `IMAGINE: Preparing` のまま（`imagine_starter` の ready は 0 件）。
- パック publish → Gallery 反映が暗黙（手動）。`production_delivery_packages.gallery_offer_ref` は未使用。
- 全作品を Content Factory 化する過程の管理（feed / pack の出力率を上げ、フォールバックを段階的に解消）。

### 4. 仕上げ・運用タスク（小粒）

- 一覧カードの壁紙バッジ（`WorkCard` の `wallpaperOffer` バッジは `work_offers` 依存で現状非表示）。一覧で「壁紙あり」を出すなら `work_offers` の wallpaper インデックス化を検討。
- 作品詳細の IMAGINE / Store ボタンの扱い整理。
- 複数 variant を持つ作品の variant picker と、variant 単位の壁紙オファー運用。
- 他シリーズ（`reel` / `experiment` / `remix`）のデータ投入は episode 運用が固まってから。

## 次に着手するなら

1. プレミアム動線の要件定義（単品 vs サブスク、Stripe 接続点、The Club との一本化）。
2. IMAGINE での壁紙量産フロー確立（最低限の手動運用 → recipe 半自動化）。
3. `imagine_starter` 導線の実装（`Edit in IMAGINE`）。
