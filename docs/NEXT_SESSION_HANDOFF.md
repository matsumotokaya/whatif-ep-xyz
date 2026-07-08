# Next Session Handoff（IMAGINE Cutover）

> 最終更新: 2026-07-07
> 目的: 次回セッションで認識ズレなく、`whatif-ep.xyz` への IMAGINE 統合を完了させるための再開メモ。

> ⚠️ **状態更新（2026-07-07）**: **M1〜M4 は main にマージ済み**で `whatif-ep.xyz` 単一アプリが本番稼働、サムネ/保存安定化も着地済み。
> **カットオーバー残は M5/M6**（`app.whatif-ep.xyz` 301・旧 IMAGINE 停止）。旧 IMAGINE の URL は細かく救済せず、legacy host へのアクセスはギャラリートップへ集約する。Stage D 片付け・`work_offers.target_url` cleanup・`create-checkout-session` 呼び出し元検証は、legacy 停止後の後追いに回してよい。
> **現在のアクティブ開発本線は別ワークストリームのエディタ再設計**（E0/E1 は main 着地済み、次は E1c/E2）。正本 `docs/EDITOR_REDESIGN.md`・ブランチ `editor/e0-stability`。

## 次回そのまま使う依頼文

```
/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz を作業対象にしてください。

まず以下を順番に読んで、WHATIF の Gallery + IMAGINE 統合の現在地を把握してください。

1. docs/CUTOVER_MILESTONES.md
2. docs/NEXT_SESSION_HANDOFF.md
3. docs/README.md
4. README.md

Gallery 側にはすでに `/edit`, `/mydesign`, `/mypage`, `/plans`, `/success`, `/admin/content-factory`, `/admin/cover-lab`, `/admin/storage-cleanup` があり、`npm run build` は通ります。M1〜M4 は完了済みです。

今回やってほしいことは **M5/M6 の fast cutover**です。
`app.whatif-ep.xyz` を早く止めるため、legacy host のアクセスをギャラリートップへ 301 で集約し、そのまま旧 IMAGINE を止められる状態にしてください。

最低限やること:

- `app.whatif-ep.xyz` のアクセスをギャラリートップへ集約する方針を明文化
- host-level 301 は `app.whatif-ep.xyz/:path*` → `https://whatif-ep.xyz` に固定する
- `work_offers.target_url` の cleanup SQL は残しておくが、legacy 停止の blocker にしない
- 停止前後の確認手順は最小化し、`/banner?template=` と `/upgrade` がトップへ飛ぶことだけ優先する
- `npm run check:m5-redirects` で確認できる redirect smoke test を維持
  - ローカルは `M5_REQUEST_BASE=http://127.0.0.1:3000 npm run check:m5-redirects`
- stale env / docs / runtime shim をどのタイミングで消すか判断
- docs に結果を反映

実装後は build と可能な範囲の動作確認を行い、結果を docs/CUTOVER_MILESTONES.md と必要なら docs/NEXT_SESSION_HANDOFF.md に反映してください。
```

## 最初に読むべき文書

1. `docs/CUTOVER_MILESTONES.md`
   - 停止までの実行順、完了条件、残依存の正本。
2. `docs/README.md`
   - docs の入口。Current / Archive の区分。
3. `README.md`
   - 本番構成の現行説明と M5/M6 の要約。
4. `docs/archive/CONSOLIDATION_PLAN.md`
   - 統合の設計履歴が必要なときだけ読む。

## 次にやること（M5/M6）

ゴール:

- `app.whatif-ep.xyz` を止めても、legacy host アクセスがギャラリートップに着地する状態にする。
- cleanup は後回しにしてもよいので、先に legacy IMAGINE を止める。
- rollback 可能な最小手順で M5/M6 を閉じる。

最初の作業:

1. `docs/CUTOVER_MILESTONES.md` の M5/M6 runbook と remaining dependencies を確認
2. `next.config.ts` の host 条件 301 を確認（legacy host はギャラリートップへ集約）
3. `src/components/editor/utils/gallerySync.ts` と DB 更新対象 docs を確認
4. `rg "app.whatif-ep.xyz|/banner\\?|/upgrade\\b"` でコード / docs 残件を洗う
5. redirect / rollback 方針を docs に反映
6. `npm run check:m5-redirects` の期待 chain を更新・確認
   - ローカルは `M5_REQUEST_BASE=http://127.0.0.1:3000` を付ける
7. 必要なら実装
8. `npm run build`

## 一気にやるか、段階的にやるか

停止までを一気にやるのは推奨しない。理由は、問題の種類が違うため。

- M5: 本番 redirect / DNS の問題
- M6: 停止と rollback の問題
- 片付け: stale env / docs / runtime shim / security 確認

ただし、各マイルストーン内では小出しにしすぎず、まとまった単位で進める。

推奨:

- 次回は **M5 の redirect / deep link / DB canonical の方針を確定**する。
- その後に **M6 の停止と片付け**へ入る。
- DB cleanup は止めた後に回してよい。

## 本番でやることだけ

```bash
# deploy 前の最終確認
npm run build
npm run check:m5-redirects

# deploy 後の本番確認
curl -I 'https://app.whatif-ep.xyz/banner?template=test-template'
curl -I 'https://app.whatif-ep.xyz/upgrade?source=gallery'
npm run check:m5-redirects
```

これで `Location: https://whatif-ep.xyz/` が返れば、旧 IMAGINE を止めてよい。

## 触ってよいもの

- `whatif-ep-xyz/src/app/edit`
- `whatif-ep-xyz/src/components/editor*`
- `whatif-ep-xyz/src/lib`
- `whatif-ep-xyz/next.config.ts`
- `whatif-ep-xyz/package.json`
- 統合に必要な docs

## 注意

- 旧 IMAGINE repo の変更を前提にしない。統合先は Gallery repo。
- thumbnail / save-flow は main へ着地済み。次はトップへの redirect と旧 IMAGINE 停止を主眼に見る。
- `docs/CUTOVER_MILESTONES.md` を停止までの正本として扱う。
- `docs/archive/` は履歴。通常の再開では読まない。
