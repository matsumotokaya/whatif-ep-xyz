# Next Session Handoff（IMAGINE 統合 M1）

> 最終更新: 2026-06-29
> 目的: 次回セッションで認識ズレなく、Gallery への IMAGINE 統合作業を再開するための依頼文と読む順番。

## 次回そのまま使う依頼文

```
/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz を作業対象にしてください。

まず以下を順番に読んで、WHATIF の Gallery + IMAGINE 統合の現在地を把握してください。

1. docs/ARCHITECTURE_OVERVIEW.md
2. docs/CONSOLIDATION_PLAN.md
3. docs/EDITOR_INTEGRATION_POC.md
4. docs/NEXT_SESSION_HANDOFF.md

前回までに /edit の client-only PoC は実装済みで、react-konva + Supabase template 読み込み + asset resolver は Next 側で build 成功しています。

今回やってほしいことは M1 です。
IMAGINE 側の本物の BannerEditor を Gallery 側 Next.js の /edit に載せ、/edit?template=<id> で既存テンプレから編集画面が開くところまで進めてください。

まず import graph を調べ、必要ファイルと依存を洗い出してください。
そのうえで実装まで進め、build と可能な範囲の動作確認をしてください。
既存の PoC ファイルは必要に応じて置き換えて構いませんが、作業ログと未解決リスクは docs/CONSOLIDATION_PLAN.md または docs/EDITOR_INTEGRATION_POC.md に反映してください。
```

## 最初に読むべき文書

1. `docs/ARCHITECTURE_OVERVIEW.md`
   - 横断の現在地。PoC 済みであることもここに反映済み。
2. `docs/CONSOLIDATION_PLAN.md`
   - 統合方針、マイルストーン、工数感の正本。
3. `docs/EDITOR_INTEGRATION_POC.md`
   - `/edit` PoC の実測結果。何が成立済みで、何が未検証か。
4. `../imagine/docs/ASSET_REFERENCE_REDESIGN.md`
   - M3 以降で必要。M1 開始時は深掘り不要だが、画像参照の方向性として把握する。

## 次にやること（M1）

ゴール:

- Gallery 側 `/edit` に IMAGINE の本物の `BannerEditor` を載せる。
- `/edit?template=<id>` で既存テンプレから編集開始できる。
- 既存 PoC の簡易 Konva preview ではなく、IMAGINE の編集 UI が動く。

最初の作業:

1. IMAGINE `src/pages/BannerEditor.tsx` の import graph を洗い出す。
2. 必要な `components/`, `hooks/`, `utils/`, `types/`, `i18n` を分類する。
3. Next 側に editor island 用 provider を作る。
4. `react-router-dom` 依存を Next の `useRouter`, `useSearchParams`, `useParams` へ置換する。
5. `import.meta.env.VITE_*` を `process.env.NEXT_PUBLIC_*` へ置換する。
6. `npm run build` が通るところまで持っていく。

## 一気にやるか、段階的にやるか

統合全体を一気にやるのは推奨しない。理由は、問題の種類が違うため。

- M1: React/Next 移植の問題。
- M2: 認証/SSO 撤去の問題。
- M3: 画像参照モデル/DB移行の問題。
- M4: admin/Content Factory など運用画面の問題。
- M5: 既存データと本番 URL 移行の問題。

ただし、各マイルストーン内では小出しにしすぎず、まとまった単位で進める。

推奨:

- 次回は **M1 だけを一気にやる**。
- M1 が通ったら、M2 と M3 の順番を再確認する。
- M2/M3 以降は DB や本番データに触るため、実行前に SQL と rollback 方針を明示する。

## 触ってよいもの

- `whatif-ep-xyz/src/app/edit`
- `whatif-ep-xyz/src/components/editor*`
- `whatif-ep-xyz/src/lib`
- `whatif-ep-xyz/package.json`
- 統合に必要な docs

## 注意

- 旧 IMAGINE repo の変更を前提にしない。統合先は Gallery repo。
- M1 では DB スキーマ変更をしない。
- M1 では SSO 撤去をしない。
- M1 では既存画像データの一括変換をしない。
- PoC で追加した `/edit` は仮実装なので、本物の editor route に置き換えてよい。
