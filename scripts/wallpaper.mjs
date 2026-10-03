#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { loadPackage, preparePackage } from './lib/wallpaper-package.mjs';
import { importDraft, PROJECT_URL } from './lib/wallpaper-import.mjs';

const usage = `Usage:
  npm run wallpaper -- prepare --manifest <sources.json> --out <new-directory>
  npm run wallpaper -- validate --package <package.json>
  npm run wallpaper -- import --package <package.json> --project <UUID> [--apply --backup <new-file.json>]

prepare/validate are offline. import defaults to a read-only plan.
For import, provide NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
and WHATIF_USER_ACCESS_TOKEN in the environment. Never use a service-role key.
Repository MCP routing/approval requirements still apply before remote use.
Do not edit or publish the target in another session while importing.`;

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    manifest: { type: 'string' }, out: { type: 'string' }, package: { type: 'string' },
    project: { type: 'string' }, backup: { type: 'string' }, apply: { type: 'boolean', default: false }, help: { type: 'boolean' },
  } });
  const [command] = positionals;
  if (values.help || !command) { console.log(usage); process.exit(0); }
  if (positionals.length !== 1 || !['prepare', 'validate', 'import'].includes(command)) throw new Error(usage);
  let output;
  if (command === 'prepare') {
    if (!values.manifest || !values.out || values.apply) throw new Error(usage);
    output = await preparePackage(values.manifest, values.out);
  } else {
    if (!values.package) throw new Error(usage);
    const { pack, files } = await loadPackage(values.package);
    if (command === 'validate') {
      if (values.apply) throw new Error('--apply is only valid for import.');
      output = { valid: true, ...pack };
    } else {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL !== PROJECT_URL) throw new Error(`Project URL must exactly match ${PROJECT_URL}`);
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const accessToken = process.env.WHATIF_USER_ACCESS_TOKEN;
      if (!key || !accessToken) throw new Error('Missing anon key or WHATIF_USER_ACCESS_TOKEN. Do not extract browser credentials.');
      const supabase = createClient(PROJECT_URL, key, {
        auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
      output = await importDraft({ supabase, accessToken, projectId: values.project, pack, files,
        apply: values.apply, backupPath: values.backup });
    }
  }
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Wallpaper command failed.');
  process.exitCode = 1;
}
