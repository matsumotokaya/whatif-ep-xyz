# WHATIF アーキテクチャ全体像（最初に読む / CTO相談用）

> 目的: WHATIF は**2つのリポジトリ（2サイト）**にまたがっているため「どっちを・どう見ればいいか分からない」状態になりやすい。本書はその**横断地図**であり、現状・問題・決定事項・どこを見るかを1枚で把握するための入口。
> 最終更新: 2026-06-29 ／ 想定読者: CTO・新規参画エンジニア。

---

## 0. TL;DR（30秒）

- WHATIF は **Gallery（公開サイト）** と **IMAGINE（編集ツール）** の**2リポジトリ**で構成され、**1つのSupabaseプロジェクトを共有**し、サブドメイン間SSOで行き来している。
- この「**2サイト＋1共有DB＋SSO**」構成が、画像表示バグ（移行のたびに発生）や直し忘れの**構造的な原因**になっている。
- **決定済み**: 両者を**1つのNext.jsアプリ（単一ドメイン `whatif-ep.xyz`）に統合**し、SSOを廃止する。エディタはNext内のクライアント専用ルート（`/edit`）として動かす。
- 実装は未着手（設計フェーズ）。詳細設計は §5 の3ドキュメント。

---

## 1. 2つのリポジトリ（どっちが何か）

| | **Gallery** | **IMAGINE** |
|---|---|---|
| リポジトリ | `github.com/matsumotokaya/whatif-ep-xyz` | `github.com/matsumotokaya/imagine` |
| 本番URL | `https://whatif-ep.xyz` | `https://app.whatif-ep.xyz` |
| 役割 | **玄関＝人が集まる公開サイト**。作品ギャラリー・壁紙販売・The Club | **編集ツール**。Canvaライクなバナー/壁紙エディタ＋公式作品の量産(Content Factory) |
| スタック | Next.js 16 (App Router, SSR/SSG) / TS / Tailwind v4 | React 19 + **Vite SPA** / TS / Tailwind v3 / Konva |
| サーバー | あり（Next API: Stripe webhook・壁紙checkout・zip・download） | なし（SPA）。サーバー処理は Supabase Edge Functions |
| 認証 | `@supabase/ssr`（サーバー対応セッション） | supabase-js(browser) ＋ 独自SSOクッキー |
| 集客 | **100% ソーシャル直リンク**（SEOは不使用） | Galleryの「イラストを編集」から呼ばれる |

**現在の主な動線**: 人は Gallery に来る → 作品詳細の「イラストを編集」→ IMAGINE(`app.whatif-ep.xyz/banner?template=<id>`) が開く。つまり IMAGINE は単体でも存在するが、実態は **Gallery から呼ばれるエディタ**。なりゆきで2つに分かれた。

---

## 2. 2つはどう繋がっているか（混乱の源）

```
            ┌──────────────────────────┐
            │   Supabase (BANALIST)    │  ← 1つのDBを両方が直接参照
            │   ref: rgqduwojvylkulhyodqg
            └──────────────────────────┘
              ▲                      ▲
              │ 直接読み書き          │ 直接読み書き
   ┌──────────┴─────────┐  ┌─────────┴──────────┐
   │ Gallery (Next)     │  │ IMAGINE (Vite SPA) │
   │ whatif-ep.xyz      │◀▶│ app.whatif-ep.xyz  │
   └────────────────────┘  └────────────────────┘
        cross-subdomain SSO (共有クッキー wf-sso-token)
        画像配信: Cloudflare R2 (assets.whatif-ep.xyz)
```

混乱を生んでいる具体点:

1. **同じロジックが両リポジトリに二重実装され、乖離する。**
   例: 画像URL解決が `whatif-ep-xyz/src/lib/asset-url.ts` と `imagine/src/utils/assetUrl.ts` に**二重**で存在し、provider の種類すら食い違っている。片方を直してももう片方が古いまま→**直し忘れ**が起きる。
2. **SSOが脆い。** 非HttpOnlyクッキーにrefresh tokenを置き、両アプリが同一トークンでrotation競合しうる（README自認）。
3. **DBに絶対URLを焼き込む箇所が多数**あり、画像の保存先（Supabase↔R2）を変えるたびに全カラム＋JSONBを人力書換→1箇所漏れると無言で404。**画像が消えるバグの常習原因**。

---

## 3. 決定事項（方向性）

**Gallery(Next.js) を母体に、IMAGINE を取り込んで1つのアプリ・単一ドメインに統合する。**

- なぜ Vite(IMAGINE) ではなく Next(Gallery) を母体にするか（コード量はIMAGINEの方が多いのに）:
  - 判断軸は「移植量」ではなく「**どの器が両方の必須要件を1つで満たせるか**」。
  - SEOは不要だが、**(1) ソーシャルのリンクプレビュー(OGP)** と **(2) 既存のサーバー処理＋秘密鍵** にサーバーが要る。SPAはこれを満たせない。Next はエディタ(Konva)をクライアントislandとして無改変で内包できる。
- 統合で消えるもの: cross-subdomain SSO / 二重デプロイ / 二重auth / 二重asset実装 / Viteビルド。
- ドメイン: `app.whatif-ep.xyz` → `whatif-ep.xyz` へ301。`/banner?template=` → `/edit?template=` リダイレクトでディープリンク維持。

---

## 4. 状態（2026-06-29 時点）

| 項目 | 状態 |
|---|---|
| 統合の方向性 | **決定**（設計のみ・未実装） |
| アセット参照の再設計 | **設計のみ**（実装は統合の中で1回だけ行う） |
| R2移行 | production / default-images は完了。user-images(518MB) のバックフィルが残 |
| 直近の本番バグ | テンプレサムネ71件の404を応急SQLで復旧済み（根治は再設計待ち） |

---

## 5. 詳細設計ドキュメント（どこを深掘りするか）

| ドキュメント | リポジトリ | 内容 |
|---|---|---|
| **CONSOLIDATION_PLAN.md** | whatif-ep-xyz/docs/ | 2アプリ統合の設計・移植スコープ・移行フェーズ・リスク。**統合の正本** |
| **ASSET_REFERENCE_REDESIGN.md** | imagine/docs/ | 画像参照モデルのゼロベース再設計（絶対URL廃止→相対キー1本）。**画像バグ根治の正本** |
| **R2_MIGRATION.md** | imagine/docs/ | R2移行の履歴・教訓・残フェーズ |
| README.md | 各リポジトリ | 各アプリの運用・機能の現行説明 |

> 注: IMAGINE 側の入口は `github.com/matsumotokaya/imagine` の `docs/ARCHITECTURE_OVERVIEW.md`（本書への誘導スタブ）。**横断の正本は本書（whatif-ep-xyz側）**。

---

## 6. CTOに相談したい論点

1. 統合は妥当か。母体をNext(Gallery)にする判断（OGP＋サーバー処理＋秘密鍵）に異論はないか。
2. 統合を**単一アプリ**にするか、monorepo（packages/core共有＋当面2アプリ）に留めるか。現状は「IMAGINE＝WHATIFの編集機能」前提で単一アプリ志向。
3. 着手順（推奨: ①認証を`@supabase/ssr`へ統一しSSO撤去 → ②アセット再設計 → ③エディタisland移植）の優先度。
4. 移行の進め方。実ユーザー/有料会員がほぼ居ないため、段階防御を省いた破壊的移行を許容できる前提でよいか。
</content>
