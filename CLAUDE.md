@AGENTS.md

# WHATIF EP Gallery - Project CLAUDE.md

## Overview
WHATIF EP digital art gallery site. Next.js 16 + Tailwind CSS v4 + Vercel + Cloudflare R2.

## Tech Stack
- **Framework**: Next.js 16 (App Router, `src/` directory)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (PostCSS plugin, `@theme inline` in globals.css)
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
│   │   └── [number]/
│   │       └── page.tsx    # Individual episode (SSG)
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
    ├── episodes.ts         # Data access functions
    ├── images.ts           # R2 URL helpers
    └── types.ts            # Episode types
data/
    └── episodes.json       # 440 episodes metadata (generated from v1 data)
scripts/
    └── generate-episodes.mjs  # Data generation script
```

## Design System
- Dark tone background (`#0a0a0f`)
- Neon cyan (`#00f0ff`) - primary accent
- Neon magenta (`#ff00e5`) - secondary accent
- CSS utility classes: `neon-text-cyan`, `neon-text-magenta`, `neon-glow-cyan`, `neon-glow-magenta`

## Episode Data
- 440 episodes (0001-0440)
- Data source: `data/episodes.json` (JSON, imported at build time)
- Images: R2 `/originals/{number}.png` and `/thumbnails/{number}.jpg`

## The Club
- Currently hosted on Lolipop (`workflowdesign.chicappa.jp/whatif-ep/the-club/`)
- New site links to existing club; migration planned for Phase 8

## Git
- GitHub account: matsumotokaya (personal)
- Host: github.com
