# ARCHIVED: Next Session Handoff（IMAGINE Cutover）

> Archived: 2026-07-08
> 現在の正本: `README.md`（現行運用） / `docs/ARCHITECTURE_OVERVIEW.md`（現行構成） / `docs/PRODUCT_ROADMAP.md`（プロダクト方針）

> 目的: 次回セッションで認識ズレなく、`whatif-ep.xyz` への IMAGINE 統合を完了させるための再開メモ。

> ⚠️ **状態更新（2026-07-08）**: **M1〜M6 は完了**。`whatif-ep.xyz` 単一アプリは本番稼働、`app.whatif-ep.xyz` は production で `301 -> https://whatif-ep.xyz/` を返し、旧 IMAGINE の Vercel project も `Archive / Delete` 済み。
> **2026-07-08 確認結果**: `npm run check:m5-redirects` は live host に対して PASS。`curl -I https://app.whatif-ep.xyz/` `/banner?template=test-template` `/upgrade?source=gallery` もすべて `301`。
> **同日 DB 確認**: `work_offers.target_url` の `https://app.whatif-ep.xyz/%` 行は 0 件。`imagine_starter` は `/edit?...` に揃っている。
> **現在のアクティブ開発本線は別ワークストリームのエディタ再設計**（E0/E1 は main 着地済み、次は E1c/E2）。正本 `docs/EDITOR_REDESIGN.md`・ブランチ `editor/e0-stability`。

## 次回そのまま使う依頼文

```
/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz を作業対象にしてください。

まず以下を順番に読んで、WHATIF の Gallery + IMAGINE 統合の現在地を把握してください。

1. docs/archive/CUTOVER_MILESTONES.md
2. docs/archive/NEXT_SESSION_HANDOFF.md
3. docs/README.md
4. README.md

Gallery 側にはすでに `/edit`, `/mydesign`, `/mypage`, `/plans`, `/success`, `/admin/content-factory`, `/admin/cover-lab`, `/admin/storage-cleanup` があり、`npm run build` は通ります。M1〜M6 は完了済みです。

今回やってほしいことは **後追い cleanup**です。
`app.whatif-ep.xyz` の 301 と旧 IMAGINE 停止は完了しているので、残る Stage D / security / stale env / runtime shim の整理を進めてください。

最低限やること:

- `app.whatif-ep.xyz` のアクセスをギャラリートップへ集約する方針を明文化
- host-level 301 は `app.whatif-ep.xyz/:path*` → `https://whatif-ep.xyz` に固定する
- `work_offers.target_url` の cleanup SQL は残しておくが、legacy 停止の blocker にしない
- 停止前後の確認手順は最小化し、`/banner?template=` と `/upgrade` がトップへ飛ぶことだけ優先する
- `npm run check:m5-redirects` で確認できる redirect smoke test を維持
  - ローカルは `M5_REQUEST_BASE=http://127.0.0.1:3000 npm run check:m5-redirects`
- stale env / docs / runtime shim をどのタイミングで消すか判断
- docs に結果を反映

実装後は build と可能な範囲の動作確認を行い、結果を archive 側の記録に反映してください。
```

## 最初に読むべき文書

1. `docs/archive/CUTOVER_MILESTONES.md`
   - 停止までの実行順、完了条件、残依存の正本。
2. `docs/README.md`
   - docs の入口。Current / Archive の区分。
3. `README.md`
   - 本番構成の現行説明と M5/M6 の要約。
4. `docs/archive/CONSOLIDATION_PLAN.md`
   - 統合の設計履歴が必要なときだけ読む。

## 次にやること（Cleanup）

ゴール:

- Stage D / security / stale env / runtime shim の整理を進める。
- `app.whatif-ep.xyz` の 301 が維持されている前提で、不要な互換レイヤーをどこまで下げられるか判断する。

最初の作業:

1. `docs/archive/CUTOVER_MILESTONES.md` の Status Snapshot を確認
2. `src/lib/imagine-links.ts` をまだ保持すべきか判断する
3. stale env / stale docs の整理対象を洗う
4. security follow-up を切り分ける

## 一気にやるか、段階的にやるか

停止までを一気にやるのは推奨しない。理由は、問題の種類が違うため。

- M5: 本番 redirect / DNS の問題
- M6: 停止と rollback の問題
- 片付け: stale env / docs / runtime shim / security 確認

ただし、各マイルストーン内では小出しにしすぎず、まとまった単位で進める。

推奨:

- 次回は **cleanup だけを閉じる**。
- DB cleanup は止めた後に回してよい。

## 本番でやることだけ

```bash
# 本番確認
curl -I 'https://app.whatif-ep.xyz/'
curl -I 'https://app.whatif-ep.xyz/banner?template=test-template'
curl -I 'https://app.whatif-ep.xyz/upgrade?source=gallery'
npm run check:m5-redirects
```

これで `Location: https://whatif-ep.xyz/` が返り続ければ、cutover 完了状態を維持できている。

## 触ってよいもの

- `whatif-ep-xyz/src/app/edit`
- `whatif-ep-xyz/src/components/editor*`
- `whatif-ep-xyz/src/lib`
- `whatif-ep-xyz/next.config.ts`
- `whatif-ep-xyz/package.json`
- 統合に必要な docs

## 注意

- 旧 IMAGINE repo の変更を前提にしない。統合先は Gallery repo。
- thumbnail / save-flow / top redirect / 旧 IMAGINE 停止は main へ着地済み。次は cleanup を主眼に見る。
- cutover の完了履歴は `docs/archive/CUTOVER_MILESTONES.md` を参照する。
- `docs/archive/` は履歴。通常の再開では読まない。
