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

### M3: 保存・アップロード・画像参照を key 方式へ切替

- `asset-reference-redesign` の単一 asset module を Gallery 側に実装。
- `thumbnail_url` / `fullres_url` / JSONB `elements[].src` の full URL 新規保存を止める。
- 既存 R2/Supabase mixed data の読み取り互換を維持しつつ、新規書込は key に寄せる。
- ゴール: 新規バナー・テンプレ・アップロードが絶対URLをDBに保存しない。

### M4: IMAGINE 周辺ページを統合

- `mydesign`, `mypage`, `plans/upgrade`, `admin/content-factory`, `cover-lab`, `storage-cleanup` を Next route 化。
- Gallery 側の既存 account / The Club / wallpaper 導線と重複するページを整理。
- ゴール: app サブドメインなしで運用に必要な全画面が揃う。

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
