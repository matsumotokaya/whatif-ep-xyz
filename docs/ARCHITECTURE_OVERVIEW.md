# WHATIF Architecture Overview

最終更新: 2026-07-08  
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
- API routes: Stripe webhook, wallpaper checkout/download, work download, account actions

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

## Source Of Truth

- App behavior: `src/app`, `src/components`, `src/lib`
- Data model / SQL: `supabase/`, `scripts/`
- Product direction: [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)
- Operational notes: [README.md](../README.md)

## Historical Note

このリポジトリは過去に Gallery と IMAGINE の統合プロジェクトを含んでいたが、その移行は完了済み。

履歴を参照したい場合のみ、以下を見る:

- [archive/CUTOVER_MILESTONES.md](./archive/CUTOVER_MILESTONES.md)
- [archive/NEXT_SESSION_HANDOFF.md](./archive/NEXT_SESSION_HANDOFF.md)
- [archive/CONSOLIDATION_PLAN.md](./archive/CONSOLIDATION_PLAN.md)
- [archive/EDITOR_INTEGRATION_POC.md](./archive/EDITOR_INTEGRATION_POC.md)
