# Next Session Handoff（IMAGINE Cutover）

> 最終更新: 2026-07-06
> 目的: 次回セッションで認識ズレなく、`whatif-ep.xyz` への IMAGINE 統合を完了させるための再開メモ。

## 次回そのまま使う依頼文

```
/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz を作業対象にしてください。

まず以下を順番に読んで、WHATIF の Gallery + IMAGINE 統合の現在地を把握してください。

1. docs/CUTOVER_MILESTONES.md
2. docs/CONSOLIDATION_PLAN.md
3. docs/M3_ASSET_KEY_PLAN.md
4. docs/NEXT_SESSION_HANDOFF.md

Gallery 側にはすでに `/edit`, `/mydesign`, `/mypage`, `/plans`, `/success`, `/admin/content-factory`, `/admin/cover-lab`, `/admin/storage-cleanup` があり、`npm run build` は通ります。M2 の user-facing link cutover は完了済みです。

今回やってほしいことは M3 です。
`/edit` の template thumbnail が確実に生成・保存される状態まで、**認証あり save path の実測確認**をしてください。CORS はローカル実測では主因ではありません。

最低限やること:

- 実アカウントで `/edit?template=<id>` を開いて変更し、header 遷移 or 手動 save 後に `banners.thumbnail_key` が更新されるか確認
- `batchSave` / `r2-presign` / `banners.thumbnail_key` 更新のどこで失敗していないかを確認
- browser back / tab close など未保証経路をどう扱うか判断
- docs に結果を反映

実装後は build と可能な範囲の動作確認を行い、結果を docs/CONSOLIDATION_PLAN.md と必要なら docs/CUTOVER_MILESTONES.md に反映してください。
```

## 最初に読むべき文書

1. `docs/CUTOVER_MILESTONES.md`
   - 停止までの実行順、完了条件、残依存の正本。
2. `docs/CONSOLIDATION_PLAN.md`
   - 統合設計と各フェーズの実施ログ。
3. `docs/M3_ASSET_KEY_PLAN.md`
   - thumbnail / asset key 移行の残課題。
4. `../imagine/docs/ASSET_REFERENCE_REDESIGN.md`
   - 画像参照の背景。M3/M4 の判断材料。

## 次にやること（M3）

ゴール:

- template 編集後に thumbnail が確実に出る状態を、**認証あり**でも確認する。
- CORS ではなく save path 差分が主因だった前提で、残る未保証経路を確定する。
- M4 の DB backfill に進めるだけの editor 安定性を得る。

最初の作業:

1. `docs/CONSOLIDATION_PLAN.md` の M3 findings / M3 fix follow-up 確認
2. `docs/M3_ASSET_KEY_PLAN.md` の thumbnail / asset key 既知課題確認
3. 実アカウントで `/edit?template=<id>` の実測
4. `src/components/editor/pages/BannerEditor.tsx`
5. `src/components/editor/components/Header.tsx`
6. `src/components/editor/utils/templateStorage.ts`
7. docs 更新
8. `npm run build`

## 一気にやるか、段階的にやるか

停止までを一気にやるのは推奨しない。理由は、問題の種類が違うため。

- M3: thumbnail / save-flow / editor export の問題
- M4: DB / asset key backfill の問題
- M5: 本番 redirect / DNS の問題
- M6: 停止と rollback の問題

ただし、各マイルストーン内では小出しにしすぎず、まとまった単位で進める。

推奨:

- 次回は **M3 の認証あり実測を終わらせる**。
- その後に **M4 の DB backfill**へ入る。
- M4 以降は DB や本番データに触るため、実行前に SQL と rollback 方針を明示する。

## 触ってよいもの

- `whatif-ep-xyz/src/app/edit`
- `whatif-ep-xyz/src/components/editor*`
- `whatif-ep-xyz/src/lib`
- `whatif-ep-xyz/package.json`
- 統合に必要な docs

## 注意

- 旧 IMAGINE repo の変更を前提にしない。統合先は Gallery repo。
- CORS はローカル実測では通っているので、次は save path と DB 更新を主眼に見る。
- `docs/CUTOVER_MILESTONES.md` を停止までの正本として扱う。
