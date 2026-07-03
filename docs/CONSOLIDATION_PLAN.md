# App Consolidation Plan（Gallery + IMAGINE を1つのNext.jsアプリへ統合）

> Status: **PoC 済み・実行計画フェーズ**。2026-06-29 起案、同日 `/edit` client island PoC 実装済み（`docs/EDITOR_INTEGRATION_POC.md`）。
> 決定: **Gallery(Next.js 16) を土台に、IMAGINE のエディタ/機能を取り込み、単一アプリ・単一ドメイン `whatif-ep.xyz` にする。** `app.whatif-ep.xyz` サブドメインと cross-subdomain SSO は廃止。
> 関連: アセット参照の再設計 [imagine/docs/ASSET_REFERENCE_REDESIGN.md] は本統合の中で**1回だけ**実装する（2リポジトリへの二重実装をやめる）。

## 0.0 PoC 結果（2026-06-29）

Gallery 側に `/edit` ルートを追加し、`react-konva` を `next/dynamic(..., { ssr:false })` の client-only island で動かす PoC を実装した。

結果:

- `npm run build`: 成功。
- PoC 追加ファイル単体の eslint: 成功。
- `/edit` と `/edit?template=ed2f8904-7f24-443b-acdb-d61cab66c839`: dev server で 200 OK。
- Supabase browser client で `templates` を取得する経路を実装。
- Gallery 側 asset resolver で IMAGINE 資産を解決する方向に寄せられることを確認。

判定: **Next を母体にして IMAGINE エディタを client island 化する案は技術的に成立する。** 残リスクは「成立可否」ではなく、移植量・画像参照モデル・認証切替・見た目回帰の管理。

---

## 0. なぜ統合するのか（決定の経緯）

- 現状は「2サイト（Gallery=Next/SSR, IMAGINE=Vite SPA）＋1つの共有Supabase＋cross-subdomain SSO」。これが**混乱の構造的本体**。
  - 同じ仕事の実装が両リポジトリに重複し乖離する（例: asset URL 解決が `imagine/src/utils/assetUrl.ts` と `whatif-ep-xyz/src/lib/asset-url.ts` に二重、provider enum も既に食い違い）。直し忘れの温床。
  - SSO は README 自認の通り脆い（非HttpOnlyクッキー `wf-sso-token`、両アプリが同一refresh tokenでrotation競合）。
- 役割: **Gallery が玄関（人が集まる場所）**、**IMAGINE は「イラストを編集」から呼ばれるエディタ**。なりゆきで2つに分かれた。

### 0.1 なぜ Vite(IMAGINE) ではなく Next(Gallery) を土台にするか

集客は **100% ソーシャル直リンク、SEOは重視しない**（確認済み）。SEOを外しても Next を土台にする理由は2つ、いずれも**ソーシャル運用に直結**:

1. **ソーシャルのリンクプレビュー（OGP）**: SNSで作品/壁紙URLを貼るとリッチカードが出るのは、サーバーがページ毎にOGメタを返すから。**Vite SPA は全URLで同じ空シェルを返す**ためプレビューが死ぬ。検索はしなくても**シェアはする**。
2. **既存サーバー処理と秘密**: Gallery には Stripe Webhook・壁紙checkout・zip生成・ダウンロード等の API ルートがあり、`SERVICE_ROLE_KEY`/`STRIPE_SECRET`/R2鍵をサーバーで握る。SPA土台にすると**サーバーが無い**ため全部 Edge Functions へ作り直し＝動作中コードの破棄になる。

エディタ(Konva)はどの土台でもブラウザ実行。Next には `dynamic(ssr:false)` のクライアントislandとして**ほぼ無改変**で載る。よって「両方の必須要件を1つで満たせる器＝Next」。移植量はIMAGINEの方が多いが、捨てるのは**外枠(Viteビルド/react-router)だけ**でエディタ中身ではない。一回きりの機械的作業。

---

## 1. 統合後アーキテクチャ

単一 Next.js 16 App Router アプリ（`whatif-ep.xyz`）。

```
app/
├─ (gallery)  works / about / the-club / wallpaper ...   Server Component中心（現状維持・SSR/OGP）
├─ edit/[id]                                              'use client' → <CanvasEditor> を dynamic(ssr:false)
├─ mydesign , mypage , plans/upgrade                      ユーザー領域（client寄り）
├─ admin/ (content-factory, cover-lab, storage-cleanup)  admin（client寄り）
├─ auth/ (login, callback)                                @supabase/ssr の単一オリジンセッション
├─ legal/ , contact                                       静的寄り
└─ api/                                                   既存サーバールート（Stripe/zip/download/webhook）＋ 必要分追加
```

- **エディタ**: IMAGINE の `BannerEditor`/Canvas 一式を `components/editor/` 配下のクライアントコンポーネントとして移植。`/edit/[id]`（旧 `/banner/:id`）が `dynamic(() => import('...'), { ssr:false })` でmount。Konva/react-konva/dnd-kit/react-query は全てクライアント境界内。
- **認証**: **`@supabase/ssr` に一本化**（Gallery既採用）。単一オリジンなので**SSOクッキー(`wf-sso-token`)は廃止**、`autoRefreshToken` 競合も消滅。IMAGINE の `AuthContext` は ssr セッション読み出しに置換。
- **i18n**: Gallery=LanguageContext（i18next不使用, SSG互換）、IMAGINE=react-i18next。**最終的に LanguageContext へ寄せる**。移行中はエディタislandに限り react-i18next を client-only で残し、段階移植可（[[i18n-architecture]]）。
- **アセット**: 統合アプリ内に**単一 asset モジュール**（[[asset-reference-redesign]]）。相対キー保存／描画時URL組立。Edge Function `r2-presign` はそのまま共有。

---

## 2. 移植スコープと摩擦（依存ベース）

| 項目 | 現状(IMAGINE) | 統合後 | 難度 |
|---|---|---|---|
| ルーティング | react-router-dom v7（22ルート） | Next App Router の `app/` セグメント | 中（機械的だが量多） |
| 環境変数 | `import.meta.env.VITE_*` | `process.env.NEXT_PUBLIC_*` | 低（一括置換） |
| Tailwind | v3 | **v4**（Gallery） | 中（v3→v4のクラス差異吸収） |
| 認証 | supabase-js browser + SSOクッキー | `@supabase/ssr` 単一セッション | 中（**SSO廃止の本丸・最大の利得**） |
| i18n | react-i18next + locales JSON | LanguageContext へ統一（段階） | 中 |
| Canvas | konva / react-konva / dnd-kit | client island（`ssr:false`） | 低（無改変で載る） |
| データ取得 | @tanstack/react-query | client境界でProvider | 低 |
| 決済 | @stripe/stripe-js(client) | client。サーバーは既存 `stripe` SDK ルート | 低 |
| サーバー処理 | Supabase Edge Functions | Edge Functions 維持 ＋ Next API 併用 | 低 |

捨てるもの: Viteビルド設定 / react-router / SSOクッキー実装 / 重複 asset・auth 実装。

---

## 3. ドメイン / 既存リンクの保全

- `app.whatif-ep.xyz` → `whatif-ep.xyz` へ 301（Vercel Domains/redirect）。
- **既存ディープリンク維持**: IMAGINE `/banner?template=<id>` 等 → 新 `/edit?template=<id>` へリダイレクトマップ。Gallery の「イラストを編集」導線（`work_offers.target_url = app.whatif-ep.xyz/banner?template=<id>`）は**内部ナビ**へ。`work_offers` の target_url 生成も新URLに更新（gallerySync / Content Factory publish）。
- DNS: `app.*` の CNAME 撤去は移行完了後。

---

## 4. 移行フェーズ（PoC 後の実行順）

### M0: PoC 完了（済）

- `/edit` route 作成。
- `react-konva` の client-only build 確認。
- Supabase `templates` 読み込み確認。
- 画像URL resolver の統合方向確認。

### M1: 本物の `BannerEditor` を `/edit` に載せる

- IMAGINE の `BannerEditor` / Canvas / editor components / hooks / utils を Gallery 側へ移植。
- `react-router-dom` を Next router hooks に置換。
- `import.meta.env.VITE_*` を `process.env.NEXT_PUBLIC_*` に置換。
- `@tanstack/react-query`, dnd-kit, i18next など client provider を editor island 内へ閉じる。
- ゴール: `/edit?template=<id>` で既存テンプレから編集画面が開く。

### M2: 認証を単一オリジンへ寄せる

- Gallery の `@supabase/ssr` セッションを正本にする。
- IMAGINE 由来 `AuthContext` と `wf-sso-token` 依存を撤去。
- premium/admin 判定を Gallery 側 profile/subscription 読み取りへ寄せる。
- ゴール: `whatif-ep.xyz` 内でログイン・編集・保存が完結する。

#### M2 実施記録（2026-07-02, ブランチ `renewal/single-app`）

**撤去・変更したもの:**

- `src/lib/ssoCookie.ts` を**削除**（`wf-sso-token` の read/write/clear 実装。Gallery コードベースから SSO クッキー実装が消滅）。
- `src/context/AuthContext.tsx` から SSO 依存を全撤去:
  - `syncSsoCookie`（SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION での `wf-sso-token` 書き込み、SIGNED_OUT での削除）
  - `adoptSharedSessionIfNeeded`（SSO クッキーからの `setSession` によるセッション養子縁組）
  - boot（`getSession` 直後）/ `focus` / `visibilitychange` での SSO 再チェックとイベントリスナー
  - 補助 ref（`sessionRef` / `adoptingSharedSessionRef`）
  - 残る認証経路は「`supabase.auth.getSession()` + `onAuthStateChange`」のみ（@supabase/ssr のクッキーセッションが唯一の正本。middleware.ts の `getUser()` によるリフレッシュは従来どおり）。
- `.env.example` から `NEXT_PUBLIC_SSO_COOKIE_DOMAIN` ブロックを削除（本変数は Gallery では不要になった。Vercel env に残っていても未参照）。
- ドキュメント追随: `README.md`（lib ツリーから ssoCookie.ts 除去・2026-06-25 Session Note と auth hardening 項へ撤去追記）、`docs/ROADMAP.md`（SSO 項に M2 撤去の更新註記）。

**変更しなかったもの（意図的）:**

- editor 側 `src/components/editor/contexts/AuthContext.tsx`（M1 で作成した Gallery AuthProvider へのアダプタ）: これが M2 の設計そのもの（IMAGINE 由来 AuthContext は移植しない）。premium/admin 判定は Gallery の `profiles.subscription_tier` / `profiles.role` 読み取り（root AuthProvider の profile fetch）を snake_case→camelCase でマップするだけで、editor island（Sidebar / MobileToolbar / useOpenTemplate / BannerEditor / AuthButton / UpgradeModal）は `profile.subscriptionTier` / `profile.role` を参照。判定 DB は 1 経路。
- `/auth/legacy-login`（The Club legacy 会員、`profiles.legacy_login_id`）: 無改変。SSO 撤去はクッキー同期のみで、`signInWithPassword` 経路には触れていない。
- 旧 IMAGINE リポジトリ（`../imagine`）の SSO コード: M6 凍結まで残置（app.whatif-ep.xyz が稼働中のため）。Gallery が `wf-sso-token` を書かなくなるので、**旧 IMAGINE への「Gallery ログイン引き継ぎ」は本ブランチのデプロイ時点で機能停止**する（統合方針どおり。旧 IMAGINE 単体のログインは無影響）。

**確認結果:**

- `npm run build`: 成功（型チェック含む）。`npx eslint src/context/AuthContext.tsx`: pass。
- dev (3710): `/edit` 200 / `/edit?template=ed2f8904-…` 200 / `/edit/[id]` ビルド済み / `/works/episode` 200 / `/works/episode/0469` 200 / `/auth/login?next=%2Fedit%3Ftemplate%3D…` 200 / `/auth/legacy-login` 200。
- コードパス整合（静的確認）:
  - ログイン導線: editor は `useOpenTemplate.onLoginRequired` / `redirectToLoginForGuest` / AuthButton から `/auth/login?next=<現在URL>` へ遷移。email ログインは `router.push(nextPath)`、Google OAuth は `whatif_auth_next` クッキー → `/auth/callback` の redirect で同一オリジンのまま `/edit?template=…` へ復帰。
  - 保存: `editor/utils/bannerStorage.ts` の insert/update は `getSupabase()` →（M1 で委譲済みの）Gallery browser client の `auth.getUser()` を使用 = 単一セッション。
  - アップロード: `editor/utils/r2Upload.ts` は `supabase.functions.invoke('r2-presign')`（JWT 自動添付）→ presigned PUT。同じ単一セッションの JWT。
  - Stripe portal / checkout（`editor/utils/subscription.ts`）も同クライアントの `auth.getSession()` の access_token を使用。

**残リスク:**

- 実ログインでの E2E（ログイン → `/edit` 復帰 → 保存 → premium 判定）は実ブラウザ手動検証が必要（コード整合とビルドのみ担保）。
- `signOut` は `scope: 'local'` のまま（SSO 期の名残だが、単一アプリでも「このブラウザのみログアウト」として妥当。global 化は他デバイス強制ログアウトになるため見送り）。
- 本番の旧 IMAGINE 併存期間中、ユーザーには「Gallery でログインしても app.whatif-ep.xyz に引き継がれない」状態が発生する（M5/M6 のリダイレクト移行で解消する前提）。
- Vercel env の `NEXT_PUBLIC_SSO_COOKIE_DOMAIN` は未参照になったので、M6 の片付けで削除する。既存ブラウザに残る `wf-sso-token` クッキーは Gallery からは無害（誰も読まない）だが、削除コードも撤去したため自然失効（Max-Age 30日）待ち。

### M3: 保存・アップロード・画像参照を key 方式へ切替

- `asset-reference-redesign` の単一 asset module を Gallery 側に実装。
- `thumbnail_url` / `fullres_url` / JSONB `elements[].src` の full URL 新規保存を止める。
- 既存 R2/Supabase mixed data の読み取り互換を維持しつつ、新規書込は key に寄せる。
- ゴール: 新規バナー・テンプレ・アップロードが絶対URLをDBに保存しない。

### M4: IMAGINE 周辺ページを統合

- `mydesign`, `mypage`, `plans/upgrade`, `admin/content-factory`, `cover-lab`, `storage-cleanup` を Next route 化。
- Gallery 側の既存 account / The Club / wallpaper 導線と重複するページを整理。
- ゴール: app サブドメインなしで運用に必要な全画面が揃う。

#### M4 実施記録（2026-07-02, ブランチ `renewal/single-app`・コミット前）

**追加ルート（8 route）:**

- ユーザー向け: `/mypage`（MyPage）/ `/plans`（旧 `/upgrade` = UpgradePage → PlansPage）/ `/success`（PaymentSuccess）。`/upgrade` は `next.config.ts` の redirects で `/plans` へ 307（クエリ `return_to`/`source` は自動パススルー）。
- admin: `/admin`（AdminDashboard）/ `/admin/content-factory`（ContentFactory）/ `/admin/cover-lab`（CoverLab）/ `/admin/storage-cleanup`（StorageCleanup）/ `/mydesign/factory`（FactoryProjectManager。静的セグメントなので `[sizeKey]` に食われない）。

**island 構成:** MyDesignsApp と同型の軽量 island を 2 つ新設。`AccountPagesApp`（mypage/plans/success）と `AdminPagesApp`（admin 4 画面 + factory list）。いずれも `dynamic(ssr:false)` の ClientOnly ラッパー経由・z-[70] フルスクリーンオーバーレイ・react-query + react-i18next + editor fonts を island 内に閉じる。

**移植で変えたもの:**

- router shim（`editor/lib/router.tsx`）に `Navigate` を追加（ported ページの auth/admin ゲート用。effect で `router.replace`）。
- 認証ゲート: 未ログイン → `/auth/login?next=<元URL>`、非 admin → `/`（factory list のみ `/mydesign`）。root `AuthContext` の profile select に `subscription_expires_at` を追加し、editor auth アダプタで `subscriptionExpiresAt` にマップ（MyPage の canceling 表示用）。
- **gallerySync**: `imagine_starter` offer の `target_url` を相対パス **`/edit?template=<id>`** に変更（旧 `https://app.whatif-ep.xyz/banner?template=<id>`）。Gallery 側 `resolveReadyOfferUrl` は target_url をそのまま返し `<a href>` / `window.open` で使うだけなので相対パスで動作（確認済み）。既存行の一括更新は M5。
- **productionOutputBuilder**: 出力アップロードを R2 presign（`uploadAsset`）に全面切替（Supabase Storage 経路を廃止）。production_outputs 行は現行健全形（provider='r2' / storage_bucket / bare path）を維持。stale 出力削除は行の provider を見て R2 presign delete / Supabase remove に振り分け。
- **ContentFactory**: default_images アップロードを M3 key 規約に統一（原本・サムネとも `default-images/...` キーで presign PUT、`storage_path` は bare、`storage_provider='r2'`）。表示は `resolveAsset`。エディタ導線は `/banner*` → `/edit*`、`/banners` → `/mydesign`。
- **PaymentSuccess**: 離脱を full page load（`window.location.replace`）に変更。root AuthProvider の profile はセッション中 1 回しか取得しないため、リロードで premium 反映を保証（旧 react-query `profiles` invalidate の置き換え）。
- checkout の success/cancel は相対パス（`/success` / 現在パス）を Edge Function `create-checkout-session` に渡し、関数側が **Origin ヘッダ**基準で絶対化 → 単一オリジンが構造的に保証される（コード変更不要を確認）。
- 共有部品を island に追加: `SitePageLayout` / `Footer`（legal・contact リンクは未移植のため除外、brandSite/company は `/` に集約）/ `GalleryTabs`（templates タブ廃止）/ `utils/cn`（clsx/tailwind-merge 非依存の簡易版）/ `utils/coverComposer`（そのまま）/ `hooks/useAdminStats`（そのまま）。`public/mocks/iphone-mock.png` を複製。
- AdminDashboard の hooks 順序違反（early return 後の useMemo）を修正して移植。

**移植しなかったもの（意図的）:** TemplateGallery（旧 `/`）・TemplatesBySize（新 IA では Works が玄関。ハード依存は BannerManager 空状態の導線が `/works/episode` を指す形で解消済み）。IMAGINE の legal 4 ページ・Contact・AboutUs（M5 で移植か 301 マップかを決める）。

**確認結果:** `npm run build` 成功（型チェック込み）。eslint は新規/変更ファイルで error 0（`no-img-element` warning のみ・既存移植コードと同水準）。dev(3710): `/mypage` `/plans` `/success` `/admin` `/admin/content-factory` `/admin/cover-lab` `/admin/storage-cleanup` `/mydesign` `/mydesign/factory` `/edit?template=ed2f8904…` すべて 200、`/upgrade?return_to=%2Fedit` → 307 `/plans?return_to=%2Fedit`。headless Chrome: `/plans` はプランカード 3 枚 + Header/Footer 描画、`/admin/content-factory`・`/mypage` は匿名アクセスでログイン画面へ遷移（ゲート動作）、`/success` はカウントダウン後に return 先へ full reload 遷移。

**M5 送りの TODO:**

- `work_offers.target_url` 既存行（`app.whatif-ep.xyz/banner?template=`）の一括 UPDATE。
- `work_variants.original_storage_key/thumbnail_storage_key` は gallerySync が**解決済み絶対URLを書く挙動を維持**（Gallery 側 resolver が bare key = r2-legacy 前提のため、key 化は resolver の provider 対応とセットで M5）。
- `production_outputs` の storage_key 列集約。
- `app.whatif-ep.xyz` → `whatif-ep.xyz` の 301 と deep link map（`/banner?template=` → `/edit?template=` 等）。
- legal / contact / about(IMAGINE 版) の移植 or リダイレクト方針決定（Footer から一時的にリンクを外している）。
- admin ゲートはクライアント側のみ（RLS が実防御）。SSR/middleware 層のガードが欲しければ M5 以降で検討。

### M5: データ移行・URL移行

- `work_offers.target_url` など `app.whatif-ep.xyz/banner?template=` を `/edit?template=` へ更新。
- `banners/templates` の旧 URL カラム・JSONB 内 URL を相対 key へバックフィル。
- `app.whatif-ep.xyz` から `whatif-ep.xyz` への 301 と deep link redirect を設定。
- ゴール: 旧リンクが壊れず、新規導線は単一ドメインへ統一される。

### M6: 旧 IMAGINE 凍結

- 旧 Vite デプロイ停止。
- IMAGINE repo は履歴・参照用に凍結。
- Edge Functions は必要分だけ継続利用。
- ゴール: 運用対象を Gallery repo / single Next app に一本化。

---

## 5. リスク・要検討

1. **エディタ移植の量**（22ルート＋大きなCanvasコード）。ただし機械的・一回きり。フェーズ3で塊を一気に。
2. **Tailwind v3→v4** のクラス/設定差。デザイン崩れ要目視。
3. **i18n 二重期間**: react-i18next(client) と LanguageContext を一時併存させると複雑。期間を区切る。
4. **認証切替**: `@supabase/ssr` 化でログイン状態の取り回しが変わる。admin判定・RLSは不変だが、セッション取得経路を全面差替え。
5. **OGP**: 作品/壁紙ページの動的OGメタを Server Component で確実に出す（SNS集客の生命線なので回帰テスト対象）。
6. Konva の SSR 無効化漏れ（`window`参照）に注意。island境界を厳密に。

---

## 6. 工数感（AI agent 前提）

「1時間で全部完了」は現実的ではない。PoC は短時間で終わるが、本統合は編集画面・保存・認証・画像移行・admin 導線まで含むため、複数セッションに分けるべき。

目安:

| 範囲 | AI agent 実作業の目安 | 備考 |
|---|---:|---|
| M0 PoC | 30分〜1時間 | 今回完了 |
| M1 本物の `BannerEditor` 起動 | 2〜5時間 | import graph と router/env 置換が中心 |
| M2 認証統一 | 2〜4時間 | premium/admin/未ログイン導線の検証込み |
| M3 asset key 化の新規書込停止 | 3〜6時間 | DB DDL/手動SQL確認を含む |
| M4 周辺ページ統合 | 4〜8時間 | admin/Content Factory の量次第 |
| M5 既存データ移行・redirect | 3〜8時間 | JSONB 変換と検証が最大リスク |
| M6 凍結・片付け | 1〜2時間 | redirects/env/docs |

合計は **15〜35時間程度**を見込む。AI agent が連続で進めても、DB手動実行・目視確認・本番デプロイ判断が入るため、カレンダー上は **2〜5日程度**に分けるのが安全。

ユーザー/有料会員がほぼいない前提で破壊的移行を許容するなら短縮できる。逆に既存データ保全・全画面目視・本番 rollback を厚くすると増える。

## 7. 次セッション着手順

- [x] エディタ island の PoC（`/edit` で既存テンプレを1枚開く入口）で移植難所を実測。
- [ ] IMAGINE `BannerEditor` の import graph を洗い出し、M1 の移植対象ファイルを確定。
- [ ] Gallery 側に editor runtime providers（query/i18n/auth adapter）を用意。
- [ ] `BannerEditor` 本体を `/edit` に接続し、`/edit?template=<id>` で編集開始できる状態にする。
- [ ] M1 完了後に SSO 撤去・asset key 化の順序を最終確定。
</content>

## デプロイ前提条件: R2 CORS（2026-07-03 発見）

`whatif-assets`（assets.whatif-ep.xyz）バケットの CORS は当初 `https://app.whatif-ep.xyz` のみ許可だった。統合後は **whatif-ep.xyz と localhost:3710** も許可が必要（エディタが Konva エクスポート用に crossOrigin='anonymous' で画像を読むため。未許可だと背景画像が枠だけになり、canvas 汚染でサムネ生成も失敗）。

Cloudflare R2 → whatif-assets → Settings → CORS Policy に AllowedOrigins:
`http://localhost:3710` / `https://whatif-ep.xyz` / `https://app.whatif-ep.xyz`、Methods: GET,HEAD。
