# WHATIF Gallery Roadmap

最終更新: 2026-06-20

この文書は「いま何ができていて、この先に何が必要か」を簡潔に追うための作業計画。
背景・思想は [RENEWAL_PLAN.md](./RENEWAL_PLAN.md) と [WALLPAPER_PIPELINE_PLAN.md](./WALLPAPER_PIPELINE_PLAN.md) を参照。

## 現在地（2026-06 時点）

- `series-aware` ギャラリー（`/works/:series`）が稼働。episode カタログが公開済み。
- DB は最終形スキーマ（`works` / `work_variants` / `work_offers` / `production_*`）が投入済み。
- Content Factory（IMAGINE）が出力した **壁紙パックの受け入れが完成**:
  - `/works/:series/:code/wallpaper` は壁紙のセールス LP（カバー＋サイズ別の透かしプレビュー＋スペック＋プレミアム訴求）。premium は zip ダウンロード、非 premium は IMAGINE プランへの加入訴求。本体画像は直接表示せずサンプル透かしで保護。
  - 作品詳細パネルに「ノンクレジット版壁紙ダウンロードはこちらから」導線（カバーサムネ＋スペック）。モバイルは縦スクロールで壁紙導線まで表示。
  - 作品詳細は prev / Gallery / next ナビを画像ペイン最上部に集約。
  - 公開判定は published な `production_projects` の実在から導出（Gallery への手動同期は不要）。
- ギャラリーカード画像は Content Factory の **feed 画像（`instagram_feed`）優先**、無い作品は従来画像にフォールバック。
- **データ実績**: 全 464 works に対し published パックは `episode 0439-1` の 1 件のみ。残りは feed もパックも未出力。

要するに「受け入れの器」は完成。これ以降は **中身（量産）** と **収益動線（サブスク）** と **IMAGINE 連携の自動化** が主題。

## この先に必要なこと

### 1. プレミアム動線（収益化）— 最優先で設計が必要

壁紙ダウンロードは The Club（premium）ログインで gating。壁紙 LP に加入訴求は実装済みだが、**課金そのものへの接続（Stripe）が未整備**。

- ✅ 非 premium が壁紙ページに来たときの加入訴求は実装済み（壁紙 LP に「月 $3 で全壁紙＋IMAGINE テンプレ解放」訴求＋ IMAGINE プランへの CTA、本体画像はサンプル透かしで保護）。文言は日本語のみ（多言語化は未）。
- 単品購入（$1 / pack）とサブスク（ダウンロードし放題）の出し分け。`production_delivery_packages` には `price_usd` / `is_subscription_included` の枠だけある。
- 壁紙パックに対する Stripe 課金フローは未接続（既存の The Club サブスク基盤との接続方法を決める）。
- The Club ↔ 壁紙パックの関係整理（The Club カタログと `work_offers` の wallpaper をどう一本化するか）。

### 2. IMAGINE 側でのコンテンツ量産 — ボトルネック

公開できる壁紙パックがまだ 1 件しかない。ギャラリーを「Content Factory 出力だけで構成」する状態に近づけるには、**残り作品の master design → pack を量産**する必要がある。

- まず既存 episode を対象に、`master design` 作成 → 4サイズ＋cover＋feed の出力を増やす。
- [WALLPAPER_PIPELINE_PLAN.md](./WALLPAPER_PIPELINE_PLAN.md) の Phase 2 以降（recipe による派生生成・cover 自動生成・zip 自動化）はこれから。
- 量産運用の確立（誰がいつ `production_projects` を `published` にするか、レビュー基準）。

### 3. IMAGINE ↔ Gallery のつなぎ込み — `Edit in IMAGINE` 実装済み

同一 Supabase を共有。publish 1操作で「テンプレ昇格 → Gallery offer 投入」まで自動で走るところまで実装済み（`episode 0461` で実証）。

- [x] `Edit in IMAGINE`（`imagine_starter`）実装済み。Content Factory の publish 時に instagram_feed バナーを IMAGINE の premium テンプレへ昇格（冪等キー `templates.production_project_id`）し、`work_offers` に `imagine_starter`(ready) を自動投入。作品詳細の「イラストを編集」ボタンから `app.whatif-ep.xyz/banner?template=<id>` を直接開く（未ログインはログイン誘導、free は UpgradeModal、premium は編集）。
- [x] ドメインまたぎ SSO（方式2）実装済み。`.whatif-ep.xyz` 共有 Cookie で whatif-ep.xyz のログインを app.whatif-ep.xyz が引き継ぐ。Vercel env `NEXT_PUBLIC_SSO_COOKIE_DOMAIN` / `VITE_SSO_COOKIE_DOMAIN` = `.whatif-ep.xyz` で有効化。簡易実装のため、改善（リファクタ）観点は IMAGINE README の "Gallery Integration" 節を参照。
  - **2026-07-02 更新**: アプリ統合 M2（`docs/CONSOLIDATION_PLAN.md`）で Gallery 側の SSO 実装を撤去。`whatif-ep.xyz` 単一オリジンの `@supabase/ssr` セッションに一本化（Gallery の `NEXT_PUBLIC_SSO_COOKIE_DOMAIN` は不要）。旧 IMAGINE（`app.whatif-ep.xyz`）側の SSO コードは M6 凍結まで残置。
- [ ] 昇格対象は現状 instagram_feed のみ。壁紙テンプレ（portrait/landscape master）の昇格は次段。
- [ ] パック publish → Gallery 反映の `production_delivery_packages.gallery_offer_ref` は未使用。
- [ ] 全作品を Content Factory 化する過程の管理（feed / pack の出力率を上げ、フォールバックを段階的に解消）。

### 0. サイト多言語化（i18n）— 次セッションで着手

サイト本体を5言語（en/ja/zh-CN/zh-TW/ko、デフォルトEN）へ多言語化。言語セレクタはハンバーガー左に配置。現状は正式なi18n基盤が無く、EN/JAの場当たり切替のみ。詳細・決定事項は [I18N_PLAN.md](./I18N_PLAN.md) を参照。
（壁紙ZIPのREADME 5言語化は別件・完了済み。混同しないこと。）

### 4. 仕上げ・運用タスク（小粒）

- 一覧カードの壁紙バッジ（`WorkCard` の `wallpaperOffer` バッジは `work_offers` 依存で現状非表示）。一覧で「壁紙あり」を出すなら `work_offers` の wallpaper インデックス化を検討。
- 作品詳細の IMAGINE / Store ボタンの扱い整理。
- 壁紙 LP の多言語化（現状 日本語のみ。文言は `wallpaper/page.tsx` の `copy` に集約済み。EN/JA 切替に合わせる）。
- 複数 variant を持つ作品の variant picker と、variant 単位の壁紙オファー運用。
- 他シリーズ（`reel` / `experiment` / `remix`）のデータ投入は episode 運用が固まってから。

## 次に着手するなら

1. プレミアム動線の要件定義（単品 vs サブスク、Stripe 接続点、The Club との一本化）。
2. IMAGINE での壁紙量産フロー確立（最低限の手動運用 → recipe 半自動化）。
3. `imagine_starter` 導線の実装（`Edit in IMAGINE`）。
