# WHATIF Gallery

WHATIF EP - Digital Art Gallery

**Production URL:** https://whatif-ep.xyz

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel |
| Database | Supabase (Postgres) |
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
│   │   ├── new/                    # Admin create
│   │   └── [number]/               # Episode detail/edit
│   │       ├── page.tsx            # Individual episode (SSG)
│   │       └── edit/               # Admin edit/delete
│   ├── auth/
│   │   └── legacy-login/           # Legacy The Club ID login
│   └── the-club/page.tsx           # The Club member area entry
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
    ├── admin/                      # Admin access helpers
    ├── episodes.ts                 # Data access
    ├── images.ts                   # R2 URL helpers
    ├── r2.ts                       # R2 upload/delete helpers
    └── types.ts
src/data/
└── episodes.json                   # Seed source for Supabase
scripts/
├── generate-episodes.mjs           # Regenerate episodes.json from meta.json
├── generate-episodes-seed-sql.mjs  # Build supabase/seeds/episodes.sql
├── upload-episode.sh               # Legacy: upload to R2 + update episodes.json
└── migrate-images.sh               # One-time FTP → R2 bulk migration
supabase/
├── migrations/20260407_create_episodes.sql
└── seeds/episodes.sql
```

## Environment Variables

`.env.local` に設定：

```
NEXT_PUBLIC_R2_BASE_URL=https://pub-9339dc326a024891a297479881e66962.r2.dev
NEXT_PUBLIC_GA_ID=G-X5E0WH9Y43
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
R2_ACCOUNT_ID=<your-r2-account-id>
R2_ACCESS_KEY_ID=<your-r2-access-key>
R2_SECRET_ACCESS_KEY=<your-r2-secret>
R2_BUCKET=whatif-ep-xyz
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

`NEXT_PUBLIC_R2_BASE_URL` はギャラリー画像用、`R2_*` は管理画面からの画像アップロード/削除用。
`R2_ENDPOINT` は未指定なら `R2_ACCOUNT_ID` から自動生成します。

## Development

```bash
npm install
npm run dev    # http://localhost:3710
npm run build
```

## Adding a New Episode

### Admin UI（推奨）
1. Supabase `public.profiles.role` を `admin` に設定したユーザーでログイン
2. `/episodes/new` から登録（original は PNG/JPG 必須、サムネイルは任意）
3. 送信すると R2 へアップロードされ、`public.episodes` に保存されます
4. 既存エピソードの編集/削除は `/episodes/[number]/edit`

### Legacy script（JSON更新のみ）
`scripts/upload-episode.sh` は R2 と `src/data/episodes.json` を更新しますが、
Supabase への登録は行いません。seed 生成用の JSON 更新に使う場合のみ利用してください。

```bash
./scripts/upload-episode.sh <PNG_FILE> [EPISODE_NUMBER] [PRODUCT_URL]
```

## Supabase Episodes

- メタデータの正本は `public.episodes` テーブル
- 反映には `supabase/migrations/20260407_create_episodes.sql` を適用
- 初期データは `supabase/seeds/episodes.sql`
- `src/data/episodes.json` から seed を作り直す場合:

```bash
node scripts/generate-episodes-seed-sql.mjs > supabase/seeds/episodes.sql
```

---

## Migration Status（移行状況）

### 完了
- [x] Next.js 16 + Vercel へのフロントエンド移行
- [x] Cloudflare R2 への全画像移行（444 PNG / 369 JPG）
- [x] Episodes Gallery（無限スクロール）
- [x] 全440エピソードの個別ページ（SSG）
- [x] エピソード管理（Supabase + Admin UI で追加/編集/削除）
- [x] Google Analytics 統合
- [x] The Club（premium gating + catalog + download）
- [x] ドメイン移管（`whatif-ep.xyz` → Vercel）
- [x] www → non-www 308リダイレクト（Vercel Domains設定）
- [x] Supabase認証リダイレクトURL設定（`whatif-ep.xyz` 追加）
- [x] 旧The Clubの導線切替（新サイトに統合済み）

### The Club account model

The Club は通常の WHATIF アカウントと同じ Supabase Auth を使いますが、旧サイト由来の少数の会員だけは別のログイン導線を持ちます。

- 通常会員
  - メールアドレス + パスワード
  - Google OAuth
- legacy 会員
  - 旧 The Club の `ID` + パスワード
  - ログイン画面は `/auth/legacy-login`
  - `public.profiles.legacy_login_id` で識別する

実装上の扱いは次のとおりです。

- `auth.users.id` は通常どおり UUID のまま使う
- 旧 ID は `profiles.legacy_login_id` に保存する
- 旧 ID は `legacy+<id>@club.whatif.local` という内部メールに変換して Supabase Auth に渡す
- パスワードは `profiles` には保存しない
- パスワードの保存と検証は Supabase Auth に任せる

この設計にしている理由は、現在は 3 名程度でも、将来 legacy 会員が増減する前提で、平文パスワードをアプリ側で管理しない方が安全で、運用を変えずに済むためです。

legacy 会員を追加する手順は次のとおりです。

1. Supabase Auth にユーザーを作成する
2. メールを `legacy+<id>@club.whatif.local` にする
3. パスワードは Supabase Auth 側で設定する
4. `public.profiles.legacy_login_id` に `<id>` を入れる

legacy 会員の ID は UUID である必要はありません。`bam.5878` のような文字列をそのまま使えます。

The Club の機能移行はここで完了です。以降はサイト全体の運用タスクだけを残しています。

### DNS構成メモ
- レジストラ：お名前.com
- DNS管理：Cloudflare
- `whatif-ep.xyz` → A `216.198.79.1`（Vercel）、DNS only
- `www.whatif-ep.xyz` → CNAME `7d28a6da6feaf2a8.vercel-dns-017.com`（Vercel）、DNS only
- `app.whatif-ep.xyz` → CNAME `657ce667dd748179.vercel-dns-017.com`（Vercel）、DNS only
- CloudflareのProxy（オレンジ雲）は**必ずOFF（DNS only）**にすること。ONにするとVercelが所有権確認できなくなる

### サイト運用の残件
- [ ] **R2カスタムドメイン** — 現在はR2のデフォルトURL（`pub-xxx.r2.dev`）。カスタムドメインへの切り替え予定
- [ ] **旧ロリポップサーバー停止判断** — 新サイト移行完了後の停止タイミングを決める

### 旧サイト（ロリポップ）
- URL: `workflowdesign.chicappa.jp/whatif-ep/`
- 旧 The Club は legacy 会員の確認用に残る可能性がある
- ドメイン移管・The Club 移行の最終整理が終わり次第、停止判断を行う

### 将来予定（DEVELOPMENT_PLAN.md 参照）
- Phase 6: パララックス・アニメーション強化
- Phase 7: 壁紙セクション
