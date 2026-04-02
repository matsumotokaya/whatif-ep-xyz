# WHATIF Gallery

WHATIF EP - Digital Art Gallery

**Production URL:** https://whatif-ep-xyz.vercel.app

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel |
| Image Storage | Cloudflare R2 |
| Analytics | Google Analytics (G-X5E0WH9Y43) |
| Repository | github.com/matsumotokaya/whatif-ep-xyz |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Top page
│   ├── episodes/
│   │   ├── page.tsx                # Gallery with infinite scroll
│   │   └── [number]/page.tsx       # Individual episode (SSG)
│   └── the-club/page.tsx           # The Club link page
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── EpisodeCard.tsx
│   ├── EpisodeGallery.tsx
│   ├── SortToggle.tsx
│   └── GoogleAnalytics.tsx
├── hooks/
│   └── useInfiniteScroll.ts
└── lib/
    ├── episodes.ts                 # Data access
    ├── images.ts                   # R2 URL helpers
    └── types.ts
src/data/
└── episodes.json                   # 440 episodes metadata
scripts/
├── generate-episodes.mjs           # Regenerate episodes.json from meta.json
├── upload-episode.sh               # Add new episode (upload to R2 + update JSON)
└── migrate-images.sh               # One-time FTP → R2 bulk migration
```

## Environment Variables

`.env.local` に設定：

```
NEXT_PUBLIC_R2_BASE_URL=https://pub-9339dc326a024891a297479881e66962.r2.dev
NEXT_PUBLIC_GA_ID=G-X5E0WH9Y43
```

## Development

```bash
npm install
npm run dev    # http://localhost:3000
npm run build
```

## Adding a New Episode

```bash
./scripts/upload-episode.sh <PNG_FILE> [EPISODE_NUMBER] [PRODUCT_URL]

# Examples:
./scripts/upload-episode.sh ~/Desktop/0441.png
./scripts/upload-episode.sh ~/Desktop/0441.png 0441 https://whatif.stores.jp/items/xxx
```

スクリプトが自動で：
1. サムネイル生成（JPG）
2. R2にoriginal + thumbnail をアップロード
3. `src/data/episodes.json` を更新

その後 `git add src/data/episodes.json && git commit && git push` でVercelに自動デプロイ。

---

## Migration Status（移行状況）

### 完了
- [x] Next.js 16 + Vercel へのフロントエンド移行
- [x] Cloudflare R2 への全画像移行（444 PNG / 369 JPG）
- [x] Episodes Gallery（無限スクロール）
- [x] 全440エピソードの個別ページ（SSG）
- [x] Google Analytics 統合

### 移行中・未対応
- [ ] **ドメイン移管** — 現在は仮URL（`whatif-ep-xyz.vercel.app`）。本番ドメインをCloudflare DNS → Vercelに向ける設定が必要
- [ ] **The Club** — 現在はロリポップの既存PHPサイト（`workflowdesign.chicappa.jp/whatif-ep/the-club/`）にリンクしている。有料会員がいるため移行は慎重に行う
- [ ] **R2カスタムドメイン** — 現在はR2のデフォルトURL。カスタムドメインへの切り替え予定

### 旧サイト（ロリポップ）
- URL: `workflowdesign.chicappa.jp/whatif-ep/`
- The Clubのみ継続稼働中（MySQL認証）
- ドメイン移管・The Club移行が完了次第シャットダウン予定

### 将来予定（DEVELOPMENT_PLAN.md 参照）
- Phase 6: パララックス・アニメーション強化
- Phase 7: 壁紙セクション
- Phase 8: The Club のSupabase移行（MySQL → Supabase Auth）
