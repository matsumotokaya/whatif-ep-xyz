# サイト多言語化（i18n）計画

最終更新: 2026-06-20
ステータス: **未着手（次セッションで実施）**

## やること

`whatif-ep.xyz`（ギャラリー本体）の **サイト全体を多言語化**する。

- 対応言語: `en` / `ja` / `zh-CN`（簡体） / `zh-TW`（繁體） / `ko`（IMAGINE と同一）
- デフォルト: **EN**
- 言語セレクタUI: **ハンバーガーメニューから出して、その左側**に配置する
  （現状の EN/JA トグルはメニューオーバーレイ内にあるので、ヘッダーのハンバーガー左へ移す想定）

## 現状（なぜ「まだ5言語になっていない」か）

このサイトには正式な i18n 基盤が無い。今あるのは場当たり的な EN/JA 切替のみ:

- [Header.tsx](../src/components/Header.tsx): `menuLocale`（`en`/`ja`）。localStorage `whatif_menu_locale` に保存。ハンバーガーメニューの `menuCopy`（4項目のラベル＋説明）だけを切り替える。
- [the-club/TheClubIntroMessage.tsx](../src/app/the-club/TheClubIntroMessage.tsx) / [TheClubAccessSection.tsx](../src/app/the-club/TheClubAccessSection.tsx): 同じ localStorage キー `whatif_menu_locale` と カスタムイベント `whatif-locale-change` で同期。各コンポーネントが独自の copy 辞書を持つ。
- それ以外のページ（トップ / works ギャラリー / 作品詳細 / wallpaper / auth など）の文言は **ハードコード（日本語・英語混在）で未i18n**。

つまり「言語切替」は実質メニュー文言とThe Club導入文だけにしか効いておらず、サイト本文は翻訳されていない。

## 参考: IMAGINE の方式

`/Users/kaya.matsumoto/projects/whatif/imagine` は `react-i18next` + `i18next-browser-languagedetector` を使用。

- ロケール: `en` / `ja` / `zh-CN` / `zh-TW` / `ko`、フォールバック `en`
- 保存: localStorage `banalist_language`
- `src/i18n/locales/<locale>/<namespace>.json`（common/editor/banner/modal/auth/message）
- コード正規化: [imagine/src/utils/pageLanguage.ts](../../imagine/src/utils/pageLanguage.ts)（`zh` は tw/hk/mo/hant→zh-TW、他→zh-CN）
- 詳細: `imagine/docs/I18N.md`

## 次セッションで決めること（着手前）

1. **基盤の選択**
   - A: 既存の軽量パターンを共有 `LocaleProvider`（React Context）に整理して5言語へ拡張（新規依存なし・SSR容易）
   - B: IMAGINE と同じ `react-i18next` を導入（ツール統一・App Router/SSR配線はやや重い）
2. **今回の翻訳スコープ**（どこまで一気にやるか）
   - ヘッダー/メニュー等のクローム＋グローバルUIのみ先行 → ページは順次
   - or 主要ページ（トップ / works / 作品詳細 / wallpaper / the-club）まで一括
3. 既存 `whatif_menu_locale` / `whatif-locale-change` を新基盤へ統合する移行方針

## 別件（混同しないこと）

- 壁紙ZIP同梱の README（取扱説明書 .txt）は**既に5言語化済み・完了**。これはサイトUIとは無関係の独立物。
  - 実装: [src/lib/wallpaper-manual.ts](../src/lib/wallpaper-manual.ts) / [download/route.ts](../src/app/api/works/[series]/[code]/wallpaper/download/route.ts)
  - この件は本計画の対象外（触らない）。
