# Editor Integration PoC（Next `/edit` client island）

> Status: **PoC 実装済み**（2026-06-29）。
> 場所: `whatif-ep-xyz/src/app/edit` / `src/components/editor-poc`。
> 目的: IMAGINE のエディタを Gallery 側 Next.js アプリへ取り込む前に、最も危ない前提（Konva を client-only で動かす、Supabase セッションを読む、テンプレを直接開く、画像を描画する）を軽量実装で検証する。

## 実装したこと

- Gallery 側に `/edit` ルートを追加。
- `next/dynamic(..., { ssr:false })` で editor runtime を client-only 化。
- `konva` / `react-konva` を Gallery 側依存に追加。
- `?template=<id>` から `templates` を Supabase browser client で取得。
- `templates.elements` の `text` / `shape` / `image` を簡易 Konva stage に描画。
- `thumbnail_url` と image element `src` は Gallery 側 `asset-url.ts` を使って解決。
- Supabase session の読み取りを確認できる表示を追加。
- ログイン済みなら任意操作で `banners` にテスト行を作れる `Create test banner` を追加。

## 実測結果

- `npm run build`: **成功**。
- PoC 追加ファイル単体の eslint: **成功**。
- `npm run lint`: 既存ファイルの React 19 lint ルール違反で失敗。PoC 追加分では失敗なし。
  - 既存: `EpisodeDetailImage.tsx`, `WorkCard.tsx`, `LanguageContext.tsx`, `work-saves.ts`。
- ローカル dev server: `http://localhost:3710` で起動確認。
- `/edit`: **200 OK**。
- `/edit?template=ed2f8904-7f24-443b-acdb-d61cab66c839`: **200 OK**。

## 判定

**Next.js へエディタを client island として載せる方針は実現可能。**

今回の PoC で、少なくとも以下は成立した。

- `react-konva` は Gallery 側 Next app に依存追加しても build できる。
- Konva runtime は SSR から隔離できる。
- Gallery 側 Supabase browser client で IMAGINE の `templates` を読める。
- Gallery 側 asset resolver を使って IMAGINE 資産を表示する設計に寄せられる。

## まだ未検証のこと

- IMAGINE の `BannerEditor.tsx` 本体を丸ごと移植したときの import 依存解決。
- `react-router-dom` 依存の Next router 置換量。
- Tailwind v3 前提クラス/設定の見た目差分。
- `@tanstack/react-query` / dnd-kit / i18next を含む本体 runtime。
- 実ログイン状態での `Create test banner` 操作。
- 画像 element の全パターン（Supabase full URL / R2 full URL / relative key / data URL）。
- admin / Content Factory / publish / gallerySync の統合。

## 次の判断

PoC 結果から、統合計画は「やるかどうかの検討」ではなく、**Gallery 母体の単一 Next app へ段階統合する実行計画**として進めてよい。

ただし、次フェーズは IMAGINE 本体を一気に移す前に、`BannerEditor` の import graph を Next 側で解けるところまで移植し、`/edit?template=` で既存テンプレを実際に編集開始できる状態を第1マイルストーンにする。
