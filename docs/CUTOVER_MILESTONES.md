# IMAGINE Cutover Milestones

> 最終更新: 2026-07-06
> 目的: `whatif-ep.xyz` への IMAGINE 統合を最後までやり切り、`app.whatif-ep.xyz` を安全に停止するための実行計画。

## Current State

統合は「未着手」ではない。Next.js 側にはすでに以下が存在する。

- `/edit`
- `/mydesign`
- `/mypage`
- `/plans`
- `/success`
- `/admin/content-factory`
- `/admin/cover-lab`
- `/admin/storage-cleanup`

`npm run build` は通るため、単一アプリ化の本体はかなり入っている。

一方で、**カットオーバーは未完了**。旧 IMAGINE を停止できない理由は、まだ以下が残っているため。

- ユーザー導線の一部が `app.whatif-ep.xyz` を直接指している
- DB 上に旧 IMAGINE deep link が残っている前提で runtime 正規化している
- エディタのサムネ生成が R2 CORS とアセット移行状態に依存しており、安定性未確認
- 本番 redirect / DNS / 停止手順がまだ入っていない

## Done Definition

以下をすべて満たした時点を「移行完了」とする。

1. Gallery / editor / plans / mypage / admin の主要導線がすべて `whatif-ep.xyz` 内で閉じる
2. コードと DB の両方から、実運用で参照される `app.whatif-ep.xyz` URL が消える
3. 旧 deep link (`/banner?template=...`, `/banner/:id`, `/upgrade`) が新ルートに到達する
4. `/edit` で template 読み込み、編集、保存、thumbnail 更新が成功する
5. R2 CORS が本番・ローカル両方で editor export を阻害しない
6. `app.whatif-ep.xyz` を 301 化したうえで旧 Vite デプロイを停止しても、主要導線が壊れない

## Remaining Dependencies

### 1. User-facing links

- [src/components/Header.tsx](/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz/src/components/Header.tsx) の IMAGINE メニュー
- [src/components/ImagineBanner.tsx](/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz/src/components/ImagineBanner.tsx) のバナーリンク
- [src/app/account/page.tsx](/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz/src/app/account/page.tsx) の contact fallback
- [src/components/editor/pages/PlansPage.tsx](/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz/src/components/editor/pages/PlansPage.tsx) と [src/components/editor/pages/PaymentSuccess.tsx](/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz/src/components/editor/pages/PaymentSuccess.tsx) の許可 origin に旧ドメインが残る

### 2. Runtime compatibility shims

- [src/lib/imagine-links.ts](/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz/src/lib/imagine-links.ts)
  - 旧 `app.whatif-ep.xyz/banner?...` を `/edit?...` に描画時正規化
  - これは DB 側の target_url 更新完了まで必要

### 3. Data migration still pending

- `work_offers.target_url` の旧 `app.whatif-ep.xyz/banner?template=` 行
- M3 asset key backfill の Stage C / Stage D
- 旧 IMAGINE 側が full URL 前提で動いていた期間の残存データ

### 4. Production operations still pending

- `app.whatif-ep.xyz` → `whatif-ep.xyz` 301
- `/banner?template=` → `/edit?template=` 互換経路
- R2 CORS の最終設定確認
- 旧 IMAGINE の停止手順と rollback 方針

## Milestones

### M1. Cutover Plan Freeze

目的:

- 完了条件を固定する
- 残依存を棚卸しする
- 実施順を確定する

完了条件:

- 本ドキュメントが作成済み
- 実装・データ・運用の残項目が分類済み
- 次の着手順が固定されている

### M2. Frontend Link Cutover

目的:

- ユーザー操作で旧 IMAGINE に飛ばない状態にする

作業:

- Header の IMAGINE リンクを `/edit` または新しい内部導線へ変更
- ImagineBanner のリンクを内部導線へ変更
- account の contact fallback を新 canonical URL に変更
- editor の許可 origin / return target 判定を単一ドメイン前提へ整理
- docs / README の現行運用記述を更新

完了条件:

- `whatif-ep-xyz/src` 内の user-facing `app.whatif-ep.xyz` 参照が消える
- ユーザーが画面操作だけで旧ドメインへ遷移しない

### M3. Editor Thumbnail Stability

目的:

- template 編集後に thumbnail が確実に出る状態にする

作業:

- `assets.whatif-ep.xyz` の R2 CORS 設定確認
- `/edit` の template open → canvas export → template thumbnail save を実測
- `thumbnail_key` / `thumbnail_url` フォールバック経路の確認
- Console / Network で CORS と fetch failure を切り分け

完了条件:

- 編集した template の thumbnail が更新される
- CORS 由来の export failure が再現しない
- 失敗時の原因がコードではなく運用設定だと明確なら、設定値が手順化されている

### M4. Data Backfill and URL Cleanup

目的:

- runtime shim ではなく、DB 自体を新前提に揃える

作業:

- `work_offers.target_url` を `/edit?template=` へ更新
- asset key migration の残り Stage C / D を実施
- 必要なら `templates` / `banners` の legacy URL 残存行を再点検

完了条件:

- DB に残る editor deep link の正本が新 URL になる
- editor asset 参照が key ベースに揃う
- `src/lib/imagine-links.ts` が「保険」扱いまで下がる

### M5. Production Redirect Cutover

目的:

- 旧リンクを壊さず、単一ドメイン運用へ切り替える

作業:

- `app.whatif-ep.xyz` の 301 設定
- `/banner?template=` / `/banner/:id` / `/upgrade` の互換ルール確定
- 本番で deep link を実地確認

完了条件:

- 旧リンクから新 editor / plans に確実に着地する
- 新規導線はすべて `whatif-ep.xyz` のみを使う

### M6. Legacy IMAGINE Retirement

目的:

- 旧 Vite アプリを停止し、運用対象を 1 リポジトリへ一本化する

作業:

- 旧 IMAGINE デプロイ停止
- stale env / docs / 運用メモの整理
- DNS / rollback メモの最終化

完了条件:

- `app.whatif-ep.xyz` が editor 実体を持たない
- 旧 IMAGINE repo は凍結対象としてのみ残る
- 本番確認結果が記録されている

## Execution Order

固定順:

1. `M2` Frontend link cutover
2. `M3` Editor thumbnail stability
3. `M4` Data backfill and URL cleanup
4. `M5` Production redirect cutover
5. `M6` Legacy IMAGINE retirement

この順番にする理由:

- 先にユーザー導線を止血しないと、本番の旧 IMAGINE 依存が見え続ける
- thumbnail 問題は M4/M5 前に安定化しないと、切替後の editor 品質判断ができない
- DB 更新を先にやると、旧 IMAGINE 併存期間に表示破壊を起こす可能性がある

## Immediate Next Task

次のセッションで最初にやること:

1. `M2` のコード変更
2. user-facing な `app.whatif-ep.xyz` 参照を Gallery 側から除去
3. その後に `M3` として `/edit` のサムネ生成不具合を実測確認

## Notes

- `docs/CONSOLIDATION_PLAN.md` は統合設計と実施ログの正本として維持する
- 本ドキュメントは「停止までの実行順」と「完了条件」の正本
- `docs/NEXT_SESSION_HANDOFF.md` は次回再開の短縮版としてこの文書を参照する
