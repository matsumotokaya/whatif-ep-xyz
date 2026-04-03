<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Dev Server

- Start: `npm run dev`
- Local URL: http://localhost:3710
- Port 3710 is fixed via `-p 3710` in package.json to avoid conflicts with other projects

## URLs (keep this section up to date)

| Environment | URL | Status |
|-------------|-----|--------|
| Local | http://localhost:3710 | active |
| Production | https://whatif-ep-xyz.vercel.app | temporary (pending domain migration) |
| Production (final) | TBD | not yet configured |

**When the production domain is finalized:**
1. Update the Production (final) row above
2. Add the new URL to Supabase > Authentication > URL Configuration as an allowed redirect URL
