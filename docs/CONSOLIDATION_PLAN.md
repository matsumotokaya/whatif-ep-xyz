# App Consolidation Plan（Gallery + IMAGINE を1つのNext.jsアプリへ統合）

> Status: **設計（未実装）**。2026-06-29 起案。急がない方針。
> 決定: **Gallery(Next.js 16) を土台に、IMAGINE のエディタ/機能を取り込み、単一アプリ・単一ドメイン `whatif-ep.xyz` にする。** `app.whatif-ep.xyz` サブドメインと cross-subdomain SSO は廃止。
> 関連: アセット参照の再設計 [imagine/docs/ASSET_REFERENCE_REDESIGN.md] は本統合の中で**1回だけ**実装する（2リポジトリへの二重実装をやめる）。

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

## 4. 移行フェーズ（破壊的・一気にやる / ユーザー不在を活かす）

0. **共通化の足場**: 統合アプリ（=現Galleryリポジトリ）に editor/auth/asset を取り込む受け皿を用意。
1. **認証を `@supabase/ssr` に統一**し、SSOクッキー経路を撤去（単一オリジン前提に倒す）。
2. **アセット再設計を実装**（相対キー・単一モジュール・書込はkey返却）。※[[asset-reference-redesign]] を**ここで1回だけ**実施。
3. **エディタ移植**: Canvas一式を client island 化し `/edit` で起動。`import.meta.env`→`NEXT_PUBLIC`、router差替え、Tailwind v4化。
4. **残ページ移植**: mydesign / factory / admin / mypage / plans / legal / contact / auth。
5. **i18n 統一**（react-i18next → LanguageContext、段階）。
6. **ドメイン統合 + リダイレクトマップ**。`app.*` 廃止。
7. **旧IMAGINEリポジトリ凍結**、Edge Functions は新アプリから参照継続。

---

## 5. リスク・要検討

1. **エディタ移植の量**（22ルート＋大きなCanvasコード）。ただし機械的・一回きり。フェーズ3で塊を一気に。
2. **Tailwind v3→v4** のクラス/設定差。デザイン崩れ要目視。
3. **i18n 二重期間**: react-i18next(client) と LanguageContext を一時併存させると複雑。期間を区切る。
4. **認証切替**: `@supabase/ssr` 化でログイン状態の取り回しが変わる。admin判定・RLSは不変だが、セッション取得経路を全面差替え。
5. **OGP**: 作品/壁紙ページの動的OGメタを Server Component で確実に出す（SNS集客の生命線なので回帰テスト対象）。
6. Konva の SSR 無効化漏れ（`window`参照）に注意。island境界を厳密に。

---

## 6. 次セッション着手順

- [ ] 統合先リポジトリ確定（現 `whatif-ep-xyz` を母体）＋ monorepo 化要否の判断（単一アプリなら不要）
- [ ] `@supabase/ssr` への認証統一を先行（SSO撤去の前提）
- [ ] アセット再設計の実装（[[asset-reference-redesign]] §8）
- [ ] エディタ island のPoC（`/edit` で既存テンプレを1枚開く）で移植難所を実測
</content>
