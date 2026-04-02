# WHATIF Gallery - Development Plan

## Overview

WHATIF EPサイトのフルリニューアル。  
既存PHPサイト（ロリポップ）→ Next.js + Vercel + Cloudflare R2 への移行。

### Design Direction

- **ダークトーン x ネオンカラー**
- ソーシャルゲームの公式サイトのようなエンタメ感
- チープにならない質感、モダンなUI
- 将来的にパララックス・派手なエフェクトを段階的に追加

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| Image Storage | Cloudflare R2 + CDN |
| Domain | Cloudflare DNS |
| Analytics | Google Analytics (G-X5E0WH9Y43) |

---

## Current State (as-is)

### Lolipop Server (`workflowdesign.chicappa.jp`)

```
whatif-ep/
├── index.php           # Top: carousel x 5, featured episodes
├── episodes.php        # Gallery: 20/page, sort, pagination
├── episodes-t.php      # Gallery alternate template
├── css/style.css
├── img/
│   ├── ep_nc/          # Episode images (444 PNG + 369 JPG = 813 files)
│   ├── ogp_001.jpg
│   ├── favicon.png
│   └── top-banner_*.jpg
├── the-club/           # Member-only download area
│   ├── config.php      # MySQL auth (LAA0107823-whatifepxyz)
│   ├── login.php       # Session-based login
│   ├── register.php    # Invite-only registration
│   ├── images.php      # Download listing (ZIP files, 100 yen each)
│   └── uploads/        # Episode ZIPs + reel content
└── build/              # Old React (CRA) build artifacts
```

### Key Data

- Episodes: ~440 (numbered 0001-0440+)
- Product URLs: STORES.jp links (wallpaper sales)
- the-club members: MySQL users table (bcrypt passwords)
- the-club content: Episode ZIPs + reel content for download

---

## Milestones

### Phase 0: Infrastructure Setup
> Image storage + project initialization

- [ ] Cloudflare R2 bucket creation
- [ ] R2 custom domain setup (e.g. `assets.whatif-ep.com` or similar)
- [ ] Image migration script: Lolipop FTP → R2
  - `/originals/` (PNG, ~444 files)
  - `/thumbnails/` (JPG, ~369 files, or auto-generate WebP)
- [ ] Next.js project init (App Router, TypeScript, Tailwind CSS)
- [ ] Tailwind dark theme config (neon accent colors)
- [ ] Episode metadata JSON (`data/episodes.json`) from existing PHP data
- [ ] CLAUDE.md for new project

**Deliverable:** R2 with all images accessible via CDN URL, Next.js skeleton running locally

---

### Phase 1: Episodes Gallery (MVP)
> Core feature - episode listing with infinite scroll

- [ ] Layout: dark header/nav, page structure
- [ ] `/episodes` page
  - Infinite scroll (Intersection Observer)
  - Image cards with lazy loading
  - Sort toggle (newest / oldest)
  - Episode count display
- [ ] `/episodes/[id]` individual episode page
  - Full-size image display
  - Episode metadata (number, category)
  - STORES.jp product link (if available)
  - Prev/Next navigation
- [ ] Responsive design (mobile / tablet / desktop)
- [ ] R2 image integration (thumbnails for list, originals for detail)

**Deliverable:** Episodes browsable with infinite scroll, individual pages working

---

### Phase 2: Top Page (Basic)
> Landing page with dark/neon aesthetic

- [ ] Hero section (featured episode or visual)
- [ ] Featured episodes carousel (existing 5 carousels from PHP)
- [ ] Navigation (Episodes, The Club, Shop link)
- [ ] Footer
- [ ] OGP / SEO meta tags
- [ ] Favicon

**Deliverable:** Complete top page with navigation to episodes

---

### Phase 3: The Club Integration
> Member area continuity - existing members must not lose access

**Strategy:** the-club remains on Lolipop initially.  
New site links to `workflowdesign.chicappa.jp/whatif-ep/the-club/` for login/downloads.

- [ ] Navigation link to the-club
- [ ] Styling the-club link/section on new site
- [ ] Verify existing members can still access

**Future (separate milestone):**
- Migrate MySQL users → Supabase Auth (bcrypt compatible)
- Rebuild download area in Next.js
- Integrate with R2 for downloadable content

**Deliverable:** the-club accessible via link, no member disruption

---

### Phase 4: Deploy & Domain
> Go live on Vercel

- [ ] Vercel project setup + deploy
- [ ] Cloudflare DNS: domain pointing to Vercel
- [ ] SSL/HTTPS verification
- [ ] Google Analytics integration
- [ ] Performance audit (Core Web Vitals)
- [ ] Lolipop: episodes redirect to new site (keep the-club running)

**Deliverable:** New site live on production domain

---

### Phase 5: Upload Workflow
> Easy episode addition process

- [ ] CLI upload script (`scripts/upload-episode.sh`)
  - Input: PNG file
  - Auto-generate thumbnail (WebP/small)
  - Upload original + thumbnail to R2
  - Update `data/episodes.json`
- [ ] Documentation for upload process
- [ ] (Optional) Admin page with drag-and-drop upload

**Deliverable:** New episode addable in < 1 minute

---

### Phase 6: Design Enhancement
> Evolve toward full entertainment site aesthetic

- [ ] Parallax scroll effects
- [ ] Page transition animations (Framer Motion)
- [ ] Hover effects on episode cards (glow, scale, neon border)
- [ ] Loading animations
- [ ] Sound effects (optional, toggle)
- [ ] Top page cinematic hero

---

### Phase 7: Wallpaper Section
> High-resolution wallpaper downloads

- [ ] Wallpaper images upload to R2 (`/wallpapers/`)
- [ ] Wallpaper preview + download page
- [ ] STORES.jp integration for paid wallpapers
- [ ] Free vs paid distinction

---

### Phase 8: The Club Migration
> Full auth migration from Lolipop MySQL to Supabase

- [ ] Export MySQL users (username, bcrypt hash, email)
- [ ] Import to Supabase Auth
- [ ] Rebuild login/register pages in Next.js
- [ ] Rebuild download area
- [ ] Move downloadable content to R2
- [ ] Lolipop the-club shutdown

---

## Image URL Structure (R2)

```
https://{R2_CUSTOM_DOMAIN}/
├── originals/
│   ├── 0001.png
│   ├── 0002.png
│   └── ...
├── thumbnails/
│   ├── 0001.webp    (auto-generated, ~200KB)
│   ├── 0002.webp
│   └── ...
└── wallpapers/      (future)
    ├── 0001_4k.png
    └── ...
```

## Episode Data Structure

```json
// data/episodes.json
{
  "episodes": [
    {
      "id": 1,
      "number": "0001",
      "title": "Episode 0001",
      "category": "The Bush of Ghost",
      "has_thumbnail_jpg": true,
      "product_url": "https://whatif.stores.jp/items/656ae4fa720e9809eb9749ab",
      "created_at": "2024-01-15"
    }
  ],
  "total": 440,
  "last_updated": "2026-04-02"
}
```

## Current Priority

**Phase 0 → Phase 1** を最優先で進める。  
Episodes Gallery が動けば、サイトの核となる価値が確認できる。
