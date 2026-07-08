# WHATIF アーキテクチャ全体像（最初に読む / CTO相談用）

> 目的: WHATIF は**Gallery リポジトリに IMAGINE を統合した単一アプリ運用へ移行中**だが、旧 IMAGINE リポジトリと `app.whatif-ep.xyz` がまだ停止待ちで残っている。本書はその**横断地図**であり、現状・問題・決定事項・どこを見るかを1枚で把握するための入口。
> 最終更新: 2026-07-07 ／ 想定読者: CTO・新規参画エンジニア。

---

## 0. TL;DR（30秒）

- WHATIF はもともと **Gallery（公開サイト）** と **IMAGINE（編集ツール）** の**2リポジトリ**構成だったが、2026-07-07 時点では **Gallery 側単一アプリ `whatif-ep.xyz` が本番稼働**し、IMAGINE の主要機能も `/edit` `/mydesign` `/mypage` `/plans` `/success` `/admin/*` として統合済み。
- 残っているのは **旧 `app.whatif-ep.xyz` の redirect / 停止 / 残存データ整理** であり、ここを閉じるのが M5/M6。
- **決定済み**: `app.whatif-ep.xyz` サブドメインと cross-subdomain SSO は廃止する。legacy host へのアクセスは `whatif-ep.xyz` のトップへ集約する。
- `/edit` client island の PoC は通過済みで、本番実装も main に着地済み。現在の正本は `docs/CUTOVER_MILESTONES.md` と `docs/NEXT_SESSION_HANDOFF.md`。過去の設計・PoC は `docs/archive/` を参照する。

---

## 1. 2つのリポジトリ（どっちが何か）

| | **Gallery** | **IMAGINE** |
|---|---|---|
| リポジトリ | `github.com/matsumotokaya/whatif-ep-xyz` | `github.com/matsumotokaya/imagine` |
| 本番URL | `https://whatif-ep.xyz` | `https://app.whatif-ep.xyz`（legacy / retirement 待ち） |
| 役割 | **現行の本番単一アプリ**。作品ギャラリー・壁紙販売・The Club・エディタ・admin | **旧編集ツール本体**。停止前の参照用・履歴用 |
| スタック | Next.js 16 (App Router, SSR/SSG) / TS / Tailwind v4 | React 19 + **Vite SPA** / TS / Tailwind v3 / Konva |
| サーバー | あり（Next API: Stripe webhook・壁紙checkout・zip・download） | なし（SPA）。サーバー処理は Supabase Edge Functions |
| 認証 | `@supabase/ssr`（単一オリジンセッション） | supabase-js(browser) ＋ 旧SSO実装（停止待ち） |
| 集客 | **100% ソーシャル直リンク**（SEOは不使用） | 新規導線は持たせない前提 |

**現在の主な動線**: 人は `whatif-ep.xyz` に来る → 作品詳細の「イラストを編集」→ 同一ドメイン内の `/edit?template=<id>` が開く。`app.whatif-ep.xyz` は **トップへの 301 集約を入れて停止するだけ** の状態。

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
        legacy deep-link compatibility / retirement work only
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
- ドメイン: `app.whatif-ep.xyz` → `whatif-ep.xyz/` へ301。旧 host の path は保持せずトップへ集約する。これは M5/M6 の残タスク。

---

## 4. 状態（2026-07-07 時点）

| 項目 | 状態 |
|---|---|
| 単一アプリ本番化 | **完了**（M1〜M4 main マージ済み。`whatif-ep.xyz` が正本） |
| 残るカットオーバー | **M5/M6**（`app.whatif-ep.xyz` 301 / 旧 Vite 停止 / Stage D 片付け） |
| アセット参照の再設計 | **新規書込は実装済み**。残るのは Stage C / Stage D の片付け |
| R2移行 | production / default-images は完了。user-images の残バックフィルと cleanup が残 |

---

## 5. 詳細設計ドキュメント（どこを深掘りするか）

| ドキュメント | リポジトリ | 内容 |
|---|---|---|
| **docs/README.md** | whatif-ep-xyz/docs/ | docs の入口。Current / Archive の区分と読む順番 |
| **archive/CONSOLIDATION_PLAN.md** | whatif-ep-xyz/docs/archive/ | 2アプリ統合の設計・移植スコープ・M1〜M4 の実施履歴 |
| **archive/EDITOR_INTEGRATION_POC.md** | whatif-ep-xyz/docs/archive/ | `/edit` client island PoC の実測結果 |
| **NEXT_SESSION_HANDOFF.md** | whatif-ep-xyz/docs/ | 次回セッション用の依頼文・読む順番・現在の M5/M6 作業範囲 |
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
