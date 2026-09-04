# WHATIF Docs Map

最終更新: 2026-09-04

このディレクトリは **Current / Archive** の2層だけで運用する。
移行プロジェクトは完了済みなので、再開時に cutover 文書を読む前提はもう置かない。

## Current

毎回まず読むのはこの6つだけ:

0. 🔴 [BILLING_REBUILD_PLAN.md](./BILLING_REBUILD_PLAN.md)
   - **進行中の最優先プロジェクト**。決済・会員権限の再構築計画とフェーズ進捗。
     他案件と並行して進めるが外せない。セッション開始時に進捗サマリを必ず確認する
1. [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)
   - プロダクト方針、価値、価格の正本
2. [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
   - 現行アーキテクチャの横断地図。構成を忘れたときだけ読む。
     Premium判定の三層（機能アクセス / 課金表示 / Stripe整合）と踏みやすい罠もここが正本
3. [WALLPAPER_PIPELINE_PLAN.md](./WALLPAPER_PIPELINE_PLAN.md)
   - 壁紙運用・量産・収益動線まわりの残タスク
4. [UX_BILLING_FIX_LIST.md](./UX_BILLING_FIX_LIST.md)
   - 本番確認で見つかったUX・決済の修正一覧と受け入れ条件
5. [REF_LIBRARY.md](./REF_LIBRARY.md)
   - **Ref Library**（IMAGINE の画像を外部のMCP/CLI/Remotion/動画生成AIからURLで参照する仕組み）の正本。
     HTTP API・`/ref/{id}`・`/api/mcp`・スコープ設計（designs は一覧のみオーナー範囲）

補足:

- ルートの [README.md](../README.md) は本番構成と運用メモ
- 実行物は `scripts/` と `supabase/` を正本とし、docs は説明だけに留める
- バナープレビューのrevision化と後続のdurable job / server renderer計画は
  [ADR 0001](./adr/0001-revisioned-banner-previews.md) を正本とする

## Archive

以下は **完了したプロジェクトの履歴**。通常の再開では読まない。

- [archive/CUTOVER_MILESTONES.md](./archive/CUTOVER_MILESTONES.md)
  - Gallery + IMAGINE 統合 cutover の完了記録
- [archive/NEXT_SESSION_HANDOFF.md](./archive/NEXT_SESSION_HANDOFF.md)
  - 統合プロジェクト終盤の再開メモ
- [archive/CONSOLIDATION_PLAN.md](./archive/CONSOLIDATION_PLAN.md)
  - 統合設計と M1〜M4 の実施履歴
- [archive/EDITOR_INTEGRATION_POC.md](./archive/EDITOR_INTEGRATION_POC.md)
  - `/edit` client island PoC の記録
- [archive/M3_ASSET_KEY_PLAN.md](./archive/M3_ASSET_KEY_PLAN.md)
  - asset key 化の詳細計画と実装履歴

## Lifecycle Rules

新規 docs は原則作らない。まず既存の Current を更新する。

新規ファイルを作ってよいのは次だけ:

- 一回限りの実行物: SQL, runbook, migration checklist
- 現在の正本に入れると読みにくくなる独立テーマ

完了した計画書や PoC は、そのセッション内で `archive/` に移す。

アーカイブ時のルール:

- 冒頭に `ARCHIVED` を付ける
- 現在どの文書を見るべきかを1行で明記する
- Current 側の参照を張り替える

削除してよい条件:

1. 内容の結論が Current に要約済み
2. コード・docs から参照されていない
3. rollback / 監査 / 設計判断の根拠として不要
