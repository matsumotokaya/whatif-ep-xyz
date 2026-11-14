# WHATIF EP Gallery (whatif-ep-xyz)

## 共通ルールとの分担

- エージェント共通のルールは `~/AGENTS.md`、ツール・外部サービスの知識は `~/playbooks/` が正本。
- このファイルと `CLAUDE.md` / `docs/` には**このプロジェクト固有のことだけ**を書く。共通の内容をここへ複製しない。古い複製を見つけたら、共通側へ寄せてここは参照に置き換える。

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Dev Server

- Start: `npm run dev`
- Local URL: http://localhost:3710
- Port 3710 is fixed via `-p 3710` in package.json to avoid conflicts with other projects
- `src/app/globals.css` の変更や DB を直接書き換えた後に表示が変わらない時は、dev サーバーを止めて `.next` を消してから再起動する（Turbopack の CSS とデータキャッシュが残る。2026-11-14 に3回発生）

## External service tooling

- MCP の使い方（接続確認・フォールバック禁止・書き込み前の承認）は `~/playbooks/mcp-servers.md`、Supabase の規約は `~/playbooks/supabase.md` が正本。
- このプロジェクトの接続先（Supabase / Vercel / Stripe の ID とアカウント）は `docs/AGENT_TOOLING.md`。Stripe・Vercel・Supabase を扱う前に読む。

## Supabase project routing

- このリポジトリは **BANALIST**（`rgqduwojvylkulhyodqg`）。MCP は `supabase_banalist` だけを使う（`supabase_logos` / `supabase_watchme` などリポジトリ名から推測した別 MCP は使わない）。
- 接続確認・書き込み可否・書き込み前の手順は `~/playbooks/mcp-servers.md` の Supabase 節に従う（書き込み可否はここで断定しない）。
- 決済まわりの DB 変更だけはプロジェクト固有ルールが優先（`CLAUDE.md`「決済まわりに触れる前に」）。

## URLs (keep this section up to date)

| Environment | URL | Status |
|-------------|-----|--------|
| Local | http://localhost:3710 | active |
| Production | https://whatif-ep.xyz | active |

## Wallpaper maintenance workflow

For wallpaper asset preparation, Content Factory registration, or resuming this workflow, read `docs/WALLPAPER_CLI.md` first. It contains the user-approved composition reference, completed episodes, remaining candidates, and the required handoff before publishing.

## Recommend (default gallery mode)

ギャラリー先頭の Recommend（指定ユーザーの保存作品）の仕組みと、使うユーザーの変え方は `docs/RECOMMEND.md`。

## Motion (short video) workflow

過去のリール動画をギャラリーの Motion シリーズへ登録するときは `docs/MOTION.md` を読む。

## Experiment (still image) workflow

Episode 以外の静止画（Experiment シリーズ、旧 Remix を含む）を登録するときは `docs/EXPERIMENT.md` を読む。

## Content Factory pending handoff

下書きの枝番・投稿順変更の未実装依頼は `docs/FACTORY_ORDER_HANDOFF.md` を読む。プロジェクト再開時に引き継ぎ対象として確認する。
