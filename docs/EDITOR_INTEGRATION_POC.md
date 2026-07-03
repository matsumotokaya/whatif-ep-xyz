# Editor Integration PoC（Next `/edit` client island）

> Status: **M1 実施済み**（2026-07-02）。PoC は本物の BannerEditor で置き換え済み（下記「M1 実施記録」）。
> 場所: `whatif-ep-xyz/src/app/edit` / `src/components/editor`（旧 `editor-poc` は削除）。
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

---

# M1 実施記録（本物の BannerEditor を /edit に移植）

> 実施日: 2026-07-02。ブランチ: `renewal/single-app`（未コミット）。

## 移植したもの

`imagine/src/pages/BannerEditor.tsx` の transitive import graph（約60ファイル）を機械的に洗い出し、`src/components/editor/` へ元のディレクトリ構造を保って移植した（TS/TSX 63・locales JSON 30・計93ファイル）。

```
src/components/editor/
├─ EditClientOnly.tsx      dynamic(ssr:false) 境界（Client Component 内）
├─ EditorApp.tsx           island entry（QueryClientProvider + i18n init + フォント注入 + fixed overlay）
├─ pages/BannerEditor.tsx  本体（約1900行）
├─ components/             Header/Sidebar/PropertyPanel/BottomBar/MobileToolbar/Canvas ほか23 + canvas/4
├─ hooks/                  useBanners/useOpenTemplate/useHistory/useElementOperations ほか計8
├─ utils/                  storage/templateStorage/bannerStorage/assetUrl/subscription ほか計16
├─ types/ templates/ lib/queryClient.ts
├─ contexts/AuthContext.tsx  ★新規: Gallery AuthContext へのアダプタ（下記）
├─ lib/router.tsx            ★新規: react-router-dom 互換 shim（下記）
└─ i18n/                     react-i18next 一式（5言語×6 namespace、island 内に閉じる）
```

ルート: `src/app/edit/page.tsx`（`/edit`, `/edit?template=`）と `src/app/edit/[id]/page.tsx`（保存済みバナー、旧 `/banner/:id`）。PoC の `src/components/editor-poc/` は削除。

追加 npm 依存: `@tanstack/react-query` / `@dnd-kit/{core,sortable,utilities}` / `i18next` / `react-i18next` / `i18next-browser-languagedetector` / `lodash.debounce`(+types) / `react-icons`。

## 置換の要点

- **react-router-dom → shim**（`editor/lib/router.tsx`）: useNavigate / useLocation / useParams / useSearchParams / Link を next/navigation ベースで再実装。react-router の navigation `state`（ゲストへのテンプレ受け渡しに使用）は module スコープ + useSyncExternalStore で保持（リロードで消えるが guest design は localStorage 保存済み）。TODO(M4): shim 撤去。
- **ルート文字列**: `/banner` → `/edit`、`/banner/:id` → `/edit/[id]`、`/auth?redirect=` → `/auth/login?next=`（Gallery ログインのパラメータ名に合わせた）。`editorReturnTo` の既定 `/mydesign` は M4 まで `/` に変更（404 回避、TODO コメント有）。`/mypage` `/plans` `/admin` 等のリンクは現状 404（M4 で移植）。
- **auth**: IMAGINE の AuthContext / wf-sso-token / signup 通知は**移植せず**、`editor/contexts/AuthContext.tsx` を Gallery root の `AuthProvider`（@supabase/ssr 単一セッション）を読むアダプタとして新規実装。エディタが実際に使うのは user / session / profile{email,fullName,avatarUrl,role,subscriptionTier} / loading / signOut のみで、snake_case → camelCase をマップ。
- **supabase**: `editor/utils/supabase.ts` を Gallery の `src/lib/supabase/client.ts`（createBrowserClient, singleton）への委譲に書き換え。`await getSupabase()` の呼び出し規約は維持し他ファイルは無改変。
- **env**: `import.meta.env.VITE_*` → `process.env.NEXT_PUBLIC_*`（assetUrl / subscription / i18n の3ファイルのみ）。assetUrl の R2 base は Gallery 側と同じ `NEXT_PUBLIC_IMAGINE_ASSETS_BASE_URL`（default: assets.whatif-ep.xyz）に統一。TODO(M3): `src/lib/asset-url.ts` へ完全統合（現状はパスエンコーディング差のため IMAGINE 実装を island 内に保持）。
- **フォント**: IMAGINE index.html の Google Fonts（Noto Sans/Serif JP, Bebas Neue 等10族）+ Material Symbols を EditorApp mount 時に `<link>` 注入。TODO(M4): layout での正式ロードへ。ロゴ `public/logo_imagine_white.svg` をコピー。
- **表示**: island を `fixed inset-0 z-[70]` の全画面オーバーレイにし、Gallery の Header(z-50)/Footer と干渉しない構造にした。
- **型修正1件**: react-konva 19.2.5 で `onTap` が `KonvaEventObject<TouchEvent>` になったため ShapeRenderer の型注釈を修正。

## 確認結果

- `npm run build`: **成功**（型チェック含む）。
- dev server (3710): `/edit` **200** / `/edit?template=ed2f8904-7f24-443b-acdb-d61cab66c839` **200** / `/edit/<id>` **200**。
- headless Chrome で `/edit?template=ed2f8904-...` を実描画: Konva canvas mount、テンプレ「EPISODE #0459」の読込、Sidebar ツール群（テキスト/図形/アップロード/ライブラリ）、Material Symbols アイコン、IMAGINE Header の表示を確認。Next エラーオーバーレイなし。
- `npx eslint src/components/editor`: 移植コード由来の error 11 / warning 17（`no-explicit-any` 等、IMAGINE の lint 基準との差）。build は通るため M1 では未修正（既存 Gallery ファイルの lint 失敗も従来どおり）。

## 不足 env（.env.local に存在しないもの）

| 変数 | 用途 | 影響 |
|---|---|---|
| `NEXT_PUBLIC_STRIPE_PRICE_ID` | UpgradeModal の checkout（旧 VITE_STRIPE_PRICE_ID） | 未設定だと premium アップグレード導線がエラー。M1 スコープ外 |
| `NEXT_PUBLIC_STRIPE_MODE` | 同上（旧 VITE_STRIPE_MODE。未設定は 'live' 扱い） | ローカル検証時は `test` 設定推奨 |
| `NEXT_PUBLIC_IMAGINE_ASSETS_BASE_URL` | R2 asset base（コードに default 有: assets.whatif-ep.xyz） | 任意 |

## 未解決リスク・TODO

- 保存/アップロード（ログイン済み）は実セッションでの動作未検証（RLS・r2-presign Edge Function 経路は無改変で移植）。
- `/mydesign` `/mypage` `/plans` `/admin` へのリンクは 404（M4）。UpgradeModal の checkout も env 不足のため未動作。
- router shim の state は同一 URL への navigate では再レンダーが起きない経路があり得る（現行フローでは search が必ず変わるため実害なし）。
- ゲストの `?template=` 直開き → localStorage 保存 → 再訪の一連フローはブラウザ手動確認推奨。
- react-i18next は island 内に閉じて存置（M4 で LanguageContext へ統一）。言語検出 localStorage キーは IMAGINE と同じ `banalist_language` のままで、Gallery の言語切替とは未連動。

## Tailwind v4 目視確認が必要な箇所

- エディタ全画面オーバーレイと Gallery header の重なり（/edit 遷移時・モバイル）。
- Sidebar / PropertyPanel / MobileToolbar / MobileSheet のグレー系配色・ring/shadow・角丸（v3→v4 で ring 既定幅や shadow スケールが変わったため）。
- モーダル群（UpgradeModal / SaveAsTemplateModal / GuestEditorNoticeModal / SizePresetModal / ImageLibraryModal）のレイアウト。
- フォント注入タイミングによる Canvas テキストの初回描画（FOUT で Konva テキストが fallback フォントのまま残らないか）。
