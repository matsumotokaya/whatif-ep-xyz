@AGENTS.md

# WHATIF EP Gallery - Project CLAUDE.md

## Overview
WHATIF EP digital art gallery site. Next.js 16 + Tailwind CSS v4 + Vercel + Cloudflare R2.

## Tech Stack
- **Framework**: Next.js 16 (App Router, `src/` directory)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (PostCSS plugin, `@theme inline` in globals.css)
- **Database**: Supabase (Postgres)
- **Images**: Cloudflare R2 CDN (env: `NEXT_PUBLIC_R2_BASE_URL`)
- **Hosting**: Vercel (planned)
- **Domain**: Cloudflare DNS (planned)

## Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with Header
│   ├── page.tsx            # Top page (hero)
│   ├── episodes/
│   │   ├── page.tsx        # Gallery (server) + EpisodesPageClient (client)
│   │   ├── new/            # Admin create
│   │   └── [number]/
│   │       ├── page.tsx    # Individual episode (SSG)
│   │       └── edit/       # Admin edit/delete
│   └── the-club/
│       └── page.tsx        # Link to existing Lolipop club
├── components/
│   ├── Header.tsx
│   ├── EpisodeCard.tsx
│   ├── EpisodeGallery.tsx  # Infinite scroll gallery
│   └── SortToggle.tsx
├── hooks/
│   └── useInfiniteScroll.ts
└── lib/
    ├── admin/              # Admin access helpers
    ├── episodes.ts         # Data access functions
    ├── images.ts           # R2 URL helpers
    ├── r2.ts               # R2 upload/delete helpers
    └── types.ts            # Episode types
src/data/
    └── episodes.json       # Seed source (legacy)
scripts/
    ├── generate-episodes.mjs       # Data generation script
    └── generate-episodes-seed-sql.mjs # Seed SQL from JSON
supabase/
    ├── migrations/20260407_create_episodes.sql
    └── seeds/episodes.sql
```

## Design System
- Dark tone background (`#0a0a0f`)
- Neon cyan (`#00f0ff`) - primary accent
- Neon magenta (`#ff00e5`) - secondary accent
- CSS utility classes: `neon-text-cyan`, `neon-text-magenta`, `neon-glow-cyan`, `neon-glow-magenta`

## Episode Data
- Source of truth: `public.episodes` (Supabase)
- Legacy seed source: `src/data/episodes.json`
- Images: R2 `/originals/{number}.png` and `/thumbnails/{number}.jpg`

## The Club
- Currently hosted on Lolipop (`workflowdesign.chicappa.jp/whatif-ep/the-club/`)
- New site links to existing club; migration planned for Phase 8

## Git
- GitHub account: matsumotokaya (personal)
- Host: github.com
