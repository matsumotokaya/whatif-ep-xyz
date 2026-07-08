# IMAGINE Cutover Milestones

> 最終更新: 2026-07-07
> 目的: `whatif-ep.xyz` への IMAGINE 統合を最後までやり切り、`app.whatif-ep.xyz` を安全に停止するための実行計画。

> **進捗（2026-07-07 更新）**: **M1〜M4 は main にマージ済み**（`724319b Merge renewal/single-app … M1-M4+壁紙ゲスト購入` + 後続のエディタ安定化コミット群）。`whatif-ep.xyz` 単一アプリが本番稼働。M3 のサムネ/保存安定化も main に着地済み（`serialize saves` / `persist preview refresh` / `immutable asset keys` 等）。
> **残るのは M5（本番 redirect: `app.whatif-ep.xyz` 301）と M6（旧 IMAGINE 停止）**。旧 deep link は厳密保存せず、legacy host へのアクセスは **ギャラリートップへ集約**する。Stage D 片付け・`work_offers.target_url` の canonical cleanup・`create-checkout-session` 呼び出し元検証は、**legacy 停止をブロックしない後追い作業**として分離する。
> なお現在のアクティブな開発本線は**エディタ再設計（E0/E1 は main 着地済み、E1c/E2 が次）**で、ブランチ `editor/e0-stability`・正本 `docs/EDITOR_REDESIGN.md`（同ブランチ）。以下 M1〜M4 の記述は実施済みの参照履歴として残す。

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

- user-facing 導線の cutover 自体は完了したが、**legacy host 自体の停止**はまだ
- `app.whatif-ep.xyz` をギャラリートップへ集約する 301 はコード化済みで、残りは **本番反映と停止**
- DB 上に旧 IMAGINE deep link が残っている前提で runtime 正規化している
- asset key 移行の残バックフィル / Stage D 片付けが終わっていない
- 本番 redirect / DNS / 停止手順がまだ入っていない

## Done Definition

以下をすべて満たした時点を「移行完了」とする。

1. Gallery / editor / plans / mypage / admin の主要導線がすべて `whatif-ep.xyz` 内で閉じる
2. コードと DB の両方から、実運用で参照される `app.whatif-ep.xyz` URL が消える
3. 旧 `app.whatif-ep.xyz` アクセスがギャラリートップに到達する
4. `/edit` で template 読み込み、編集、保存、thumbnail 更新が成功する
5. R2 CORS が本番・ローカル両方で editor export を阻害しない
6. `app.whatif-ep.xyz` を 301 化したうえで旧 Vite デプロイを停止しても、主要導線が壊れない

## Remaining Dependencies

### 1. Runtime compatibility shims

- [src/lib/imagine-links.ts](/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz/src/lib/imagine-links.ts)
  - 旧 `app.whatif-ep.xyz/banner?...` を `/edit?...` に描画時正規化
  - これは DB 側の target_url 更新完了まで必要

### 2. Data migration still pending

- `work_offers.target_url` の旧 `app.whatif-ep.xyz/banner?template=` 行
- M3 asset key backfill の Stage C / Stage D
- 旧 IMAGINE 側が full URL 前提で動いていた期間の残存データ

### 3. Production operations still pending

- `app.whatif-ep.xyz` → `whatif-ep.xyz` 301
- `app.whatif-ep.xyz/banner?template=...` と `/upgrade` がギャラリートップへ着地する本番確認
- R2 CORS の最終設定確認
- 旧 IMAGINE の停止手順と rollback 方針

### 4. Security / cleanup follow-ups

- `create-checkout-session` 呼び出し元検証
- admin 直 Supabase 操作の RLS 確認
- `NEXT_PUBLIC_SSO_COOKIE_DOMAIN` など stale env の削除

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

- 旧 IMAGINE host を止め、単一ドメイン運用へ切り替える

作業:

- `app.whatif-ep.xyz` の 301 設定
- 本番で `app.whatif-ep.xyz/banner?template=...` と `/upgrade` がトップへ飛ぶことを確認

完了条件:

- 旧 IMAGINE host からギャラリートップに確実に着地する
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

## Active Execution Order

現在の残タスクの実行順:

1. `M5` Production redirect cutover
2. `M6` Legacy IMAGINE retirement
3. セキュリティ / stale env / docs 片付け（後追いでよい）

この順番にする理由:

- 先に 301 を入れないと、旧 IMAGINE 停止でリンク切れを作る
- 停止後に stale env / docs / runtime shim の片付けをすると、rollback 判断がしやすい
- `work_offers.target_url` と asset key 片付けは「本番 redirect が正常」という前提確認の後でよく、legacy 停止の blocker にしない

## Fast Path

ユーザー数が少なく、多少のリスクより「早く旧 IMAGINE を止める」を優先する場合は、M5/M6 は次の最小手順で閉じてよい。

1. `next.config.ts` を deploy
2. `app.whatif-ep.xyz/banner?template=...` と `/upgrade` がギャラリートップへ飛ぶことを本番で手確認
3. 問題なければ旧 Vite を止める

実行コマンド:

```bash
npm run build
npm run check:m5-redirects
# ローカル preflight の場合
M5_REQUEST_BASE=http://127.0.0.1:3000 npm run check:m5-redirects
```

この fast path では、以下は **後回し** でよい:

- `work_offers.target_url` の DB canonical cleanup
- Stage D の破壊片付け
- `src/lib/imagine-links.ts` の削除
- stale env / stale docs の整理
- `create-checkout-session` 呼び出し元検証
- admin 直 Supabase 操作の RLS 確認

## M5/M6 Runbook

### M5 前の確認

- `whatif-ep.xyz` 上の主要導線（`/edit` `/mydesign` `/mypage` `/plans` `/success` `/admin/*`）が正常
- `work_offers.target_url` と deep link 互換の更新方針が確定
- `assets.whatif-ep.xyz` CORS に `https://whatif-ep.xyz` と `http://localhost:3710` が入っている

### M5 本番 cutover

1. `next.config.ts` の host 条件 redirect を production へ deploy
   - `has: [{ type: 'host', value: 'app.whatif-ep.xyz' }]`
   - `/:path*` → `https://whatif-ep.xyz`
   - legacy host の全アクセスをギャラリートップへ集約する
   - status は `301`（`permanent: true` の 308 ではなく `statusCode: 301` を使用）
2. `app.whatif-ep.xyz/:path*` を `https://whatif-ep.xyz` へ host-level 301
3. legacy host の代表URLを実地確認
   - 最低限: `/banner?template=...` と `/upgrade`
   - 余裕があれば `node scripts/check-m5-redirects.mjs` で host-level 301 を確認
   - ローカル preflight は `npm run build && npm run start` 後に `M5_REQUEST_BASE=http://127.0.0.1:3000 node scripts/check-m5-redirects.mjs`
4. 問題なければ M5 完了
5. `scripts/m5_work_offers_target_url_cutover.sql` は **後追い cleanup** として実施してよい

本番確認コマンド:

```bash
curl -I 'https://app.whatif-ep.xyz/banner?template=test-template'
curl -I 'https://app.whatif-ep.xyz/upgrade?source=gallery'
npm run check:m5-redirects
```

### M6 停止

1. 旧 Vite デプロイ停止
2. rollback 手順と DNS 状態を記録
3. stale env / stale docs / runtime shim は必要に応じて後追い整理
4. 旧 IMAGINE repo を凍結対象として明記

停止直後の確認コマンド:

```bash
curl -I 'https://app.whatif-ep.xyz/'
curl -I 'https://app.whatif-ep.xyz/banner?template=test-template'
curl -I 'https://app.whatif-ep.xyz/upgrade?source=gallery'
```

### Rollback メモ

- 301 後に editor deep link が壊れる場合は、旧 Vite 実体を止める前なら redirect 設定だけ戻して切り分ける
- DB 更新は redirect 検証後に実施し、SQL は必ず rollback 文とセットで残す
- `work_offers.target_url` の rollback は `scripts/m5_work_offers_target_url_rollback.sql`
- `scripts/check-m5-redirects.mjs` が落ちる場合は、host-level 301 自体が出ているかを確認する
- `src/lib/imagine-links.ts` は M6 完了確認までは削除せず「保険」として保持する

## Immediate Next Task

（M1〜M4 は完了・main マージ済み。以下は残タスク）

**カットオーバー残（M5/M6）**:

1. `M5` `app.whatif-ep.xyz` → `whatif-ep.xyz` の 301 を本番反映し、`/banner?template=` と `/upgrade` がトップへ飛ぶことだけ確認する
2. `M6` 旧 Vite デプロイ停止
3. cleanup は後追いで閉じる（DB canonical / Stage D / security / stale env）

**開発本線（別ワークストリーム）**: エディタ再設計 E1c（Konva commit 集約）→ E2（ストーリーズモード MVP）。正本 `docs/EDITOR_REDESIGN.md`（ブランチ `editor/e0-stability`）。

## Notes

- `docs/README.md` を docs の入口とし、Current / Archive の区分をここに集約する
- `docs/archive/CONSOLIDATION_PLAN.md` は統合設計と M1〜M4 の履歴として保持する
- 本ドキュメントは「停止までの実行順」と「完了条件」の正本
- `docs/NEXT_SESSION_HANDOFF.md` は次回再開の短縮版としてこの文書を参照する
