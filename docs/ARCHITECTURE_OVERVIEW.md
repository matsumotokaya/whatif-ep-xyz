# WHATIF Architecture Overview

最終更新: 2026-07-21
想定読者: 新規参画エンジニア / 現行構成を思い出したい人

## TL;DR

- WHATIF の本番正本は **`https://whatif-ep.xyz` の単一 Next.js アプリ**
- 旧 `app.whatif-ep.xyz` は **履歴互換の 301** のみを返す
- Gallery / IMAGINE / account / admin / The Club はこのリポジトリに統合済み
- 統合プロジェクト自体は完了しており、履歴は `docs/archive/` を参照する

## Repository Map

| 項目 | 現在 |
|---|---|
| Repository | `github.com/matsumotokaya/whatif-ep-xyz` |
| Production URL | `https://whatif-ep.xyz` |
| Legacy URL | `https://app.whatif-ep.xyz` → `301` |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase |
| Asset delivery | Cloudflare R2 |
| Hosting | Vercel |

## Current Surface Area

現在のアプリには次が同居している。

- Gallery: `/works`, `/about`
- Editor: `/edit`, `/mydesign`, `/mypage`, `/plans`, `/success`
- Admin: `/admin/content-factory`, `/admin/cover-lab`, `/admin/storage-cleanup`
- Account / Auth: `/account`, `/auth/*`
- The Club: `/the-club`, `/auth/legacy-login`
- API routes: Stripe webhook, wallpaper checkout/download, work download, account actions,
  Ref Library (`/api/ref/designs`, `/ref/{id}`, `/api/mcp`)

## Runtime Topology

```text
Browser
  -> whatif-ep.xyz (Next.js app)
       -> Supabase (auth, relational data)
       -> Cloudflare R2 (image / asset delivery)
       -> Stripe / Resend / other external services

app.whatif-ep.xyz
  -> 301
  -> https://whatif-ep.xyz/
```

### Auth & Email Delivery（見落としやすいので明記）

Resend への送信経路は**アプリコード経由**と**Supabase Auth経由**の2つがあり、設定場所が完全に別れている。

- **アプリコード経由**（`src/lib/...` が Resend API を直接叩く）: 壁紙購入通知・アカウント通知メール。設定はこの repo の `.env.local`（`RESEND_API_KEY` / `RESEND_FROM_EMAIL`）
- **Supabase Auth経由**（GoTrue が SMTP 経由で送る。SMTPサーバーとして `smtp.resend.com` を指しているだけ）: サインアップ確認・パスワードリセット等の認証メール。アプリ側は `supabase.auth.signUp()` 等を呼ぶのみで、送信者名・件名・本文・SMTP認証情報はすべて**Supabaseダッシュボード**（`Authentication → Emails → SMTP Settings` / `→ Templates`）で管理。**この repo のコード・env varには一切現れない。**

カスタムSMTP未設定だとSupabaseのビルトインメール送信は「プロジェクトのチームメンバー宛にしか届かない」制限があるため、認証メールが届かないトラブルの調査ではまずこのダッシュボード設定を確認する。

## Source Of Truth

- App behavior: `src/app`, `src/components`, `src/lib`
- Data model / SQL: `supabase/`, `scripts/`
- Product direction: [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)
- Operational notes: [README.md](../README.md)
- External design references (Ref Library): [REF_LIBRARY.md](./REF_LIBRARY.md)

## Editor Client State And Preview Saves

- `/edit`, `/mydesign`, `/mydesign/factory`, `/admin/*`, `/imagine`, and the
  account islands use one browser-side React Query client for the active auth
  scope. Switching users clears and replaces that client; server prerenders
  always receive a request-local client.
- Editor mutations therefore invalidate the same banner and production-project
  caches that the list screens read. Do not introduce a route-local QueryClient
  for these islands without an explicit cross-client invalidation mechanism.
- Canonical banner saves atomically increase `document_revision` and mark the
  derived preview `pending` while retaining the last ready asset keys.
- A preview save generates a thumbnail and full-resolution JPEG from the same
  canvas snapshot and uploads both immutable R2 objects in parallel. Their keys
  include the document revision. `finalize_banner_preview` commits them only if
  that revision is still current; stale completions are deleted.
- Content Factory draft creation uses cover-style source placement (the canvas
  is filled with no empty bands), then renders each new Portrait / Landscape /
  Feed draft in the browser without opening `/edit`. Those initial thumbnail
  and full-resolution JPEGs use the same revision-safe save path, so an
  unchanged draft is Publish-ready while the final Publish action remains an
  explicit operator decision.
- `preview_revision`, `preview_status`, `preview_error`, and request/completion
  timestamps are persisted. List screens show the previous image with an
  updating/failed badge instead of collapsing those states into “no thumbnail”.
- Save telemetry contains a correlated ID, stage timings, revision, element
  count, and encoded payload sizes. It never includes base64 image contents or
  a user ID. See [ADR 0001](./adr/0001-revisioned-banner-previews.md).
- R2 PUT requests have a finite timeout. Mutation settlement always revalidates
  banner and factory queries so a partial external failure cannot remain hidden
  behind the five-minute list cache.

### Preview reliability phases

この Phase 番号は**バナープレビュー信頼性改善だけ**を指す。プロダクト全体の
`PRODUCT_ROADMAP.md` や壁紙パイプラインの Phase 番号とは別系統である。

| Phase | 状態 | スコープ |
|---|---|---|
| 0 | 完了 | 構造化保存テレメトリ、timeout、失敗状態、一覧再検証 |
| 1 | 完了 | document/preview revision、immutable key、stale finalize拒否、DB migration |
| 1 rollout cleanup | デプロイ後 | 本番revision経路を観測後、旧DB限定fallbackを別変更で削除 |
| 2 | 未着手 | 保存からpreview生成を分離し、永続job・retry・lease・監視を導入 |
| 3 | 未着手 | browser Canvasをserver/workerへ移し、Production出力も正本から直接生成 |

Phase 0/1 の適用・検証実績と後続フェーズの完了条件は
[ADR 0001](./adr/0001-revisioned-banner-previews.md) を正本とする。

## Historical Note

このリポジトリは過去に Gallery と IMAGINE の統合プロジェクトを含んでいたが、その移行は完了済み。

履歴を参照したい場合のみ、以下を見る:

- [archive/CUTOVER_MILESTONES.md](./archive/CUTOVER_MILESTONES.md)
- [archive/NEXT_SESSION_HANDOFF.md](./archive/NEXT_SESSION_HANDOFF.md)
- [archive/CONSOLIDATION_PLAN.md](./archive/CONSOLIDATION_PLAN.md)
- [archive/EDITOR_INTEGRATION_POC.md](./archive/EDITOR_INTEGRATION_POC.md)
