# WHATIF Docs Map

最終更新: 2026-07-07

このディレクトリは **Current / Archive** の2層だけで運用する。
再開時に全部を読む前提をやめ、まず現在の正本だけを読む。

## Current

毎回まず読むのはこの4つだけ:

1. [CUTOVER_MILESTONES.md](./CUTOVER_MILESTONES.md)
   - 現在地、残タスク、実行順、runbook の正本
2. [NEXT_SESSION_HANDOFF.md](./NEXT_SESSION_HANDOFF.md)
   - 次回再開用の短縮版
3. [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)
   - プロダクト方針、価値、価格の正本
4. [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
   - 横断地図。構成を忘れたときだけ読む

補足:

- ルートの [README.md](../README.md) は本番構成と運用メモ
- 実行物は `scripts/` と `supabase/` を正本とし、docs は説明だけに留める

## Archive

以下は **現役の計画書ではなく履歴**。通常の再開では読まない。

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
- Current のどれが正本かを1行で明記する
- Current 側の参照を張り替える

削除してよい条件:

1. 内容の結論が Current に要約済み
2. コード・docs から参照されていない
3. rollback / 監査 / 設計判断の根拠として不要
