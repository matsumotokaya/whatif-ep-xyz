<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Dev Server

- Start: `npm run dev`
- Local URL: http://localhost:3710
- Port 3710 is fixed via `-p 3710` in package.json to avoid conflicts with other projects

## Supabase project routing

- This WHATIF repository uses the **BANALIST** Supabase project.
- Project ref: `rgqduwojvylkulhyodqg`.
- Use only the project-scoped MCP server `supabase_banalist` for Supabase schema,
  data, SQL, migration, advisor, or log work in this repository.
- Never infer the Supabase project from the repository or product name. In
  particular, do not use `supabase_logos`, `supabase_watchme`, a generic
  `supabase`, or any other Supabase MCP for this repository.
- Before every Supabase read or SQL operation, call
  `supabase_banalist.get_project_url` and require the exact URL
  `https://rgqduwojvylkulhyodqg.supabase.co`.
- Before a write, verify the URL again, review the exact SQL or migration, and
  obtain explicit user authorization. If the URL differs, stop without reading
  or writing data.

## URLs (keep this section up to date)

| Environment | URL | Status |
|-------------|-----|--------|
| Local | http://localhost:3710 | active |
| Production | https://whatif-ep.xyz | active |
