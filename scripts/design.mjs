#!/usr/bin/env node
// AI-authored layered design drafts. Spec and workflow: docs/DESIGN_CLI.md.
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { PROJECT_URL } from './lib/wallpaper-import.mjs';
import {
  assertValidDocument, commitPreview, createDraft, draftIdFor, layerSummary, localFileOf, previewState,
  readOwnedBanner, registerUpload, requireUser, toEditableDocument, updateDocument,
} from './lib/design-draft.mjs';

const SITE_URL = process.env.WHATIF_SITE_URL || 'https://whatif-ep.xyz';
const RENDER_BASE_URL = process.env.WHATIF_RENDER_BASE_URL || 'http://localhost:3710';
const SESSION_FILE = process.env.WHATIF_DESIGN_SESSION || path.join(os.homedir(), '.config', 'whatif', 'design-session.json');

const usage = `Usage (npm run design -- <command>):
  login [--email <address>] [--otp]     interactive, run by the account owner in a terminal
  logout | whoami
  presets                               editor size presets (needs the render bridge)
  get <designId> [--out <doc.json>]     document + revision + preview state
  create --doc <doc.json> --key <idempotency-key> [--preview <out.jpg>] [--apply]
  update <designId> --doc <doc.json> [--preview <out.jpg>] [--apply]
  render <designId> [--preview <out.jpg>]    render the current revision and store its preview
  status <designId>

Without --apply, create/update only validate and render a local preview; nothing is written.
The render bridge is ${RENDER_BASE_URL}/edit/render (start "npm run dev" for localhost).`;

const editUrl = (id) => `${SITE_URL}/edit/${id}`;

// ---------------------------------------------------------------- session

function prompt(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) throw new Error('login must be run interactively in a terminal by the account owner.');
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); };
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

function baseClient() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== PROJECT_URL) throw new Error(`NEXT_PUBLIC_SUPABASE_URL must exactly match ${PROJECT_URL}.`);
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
  return { key, client: createClient(PROJECT_URL, key, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

async function saveSession(session) {
  await mkdir(path.dirname(SESSION_FILE), { recursive: true, mode: 0o700 });
  await writeFile(SESSION_FILE, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }) + '\n', { mode: 0o600 });
}

export function otpParams(email, answer) {
  if (!/^https?:\/\//.test(answer)) return { email, token: answer.replace(/\s+/g, ''), type: 'email' };
  const url = new URL(answer);
  const tokenHash = url.searchParams.get('token_hash') ?? url.searchParams.get('token');
  if (!tokenHash) throw new Error('The pasted link has no token. Paste the sign-in link from the email as-is.');
  const type = url.searchParams.get('type');
  return { token_hash: tokenHash, type: ['magiclink', 'signup', 'invite', 'email'].includes(type) ? type : 'email' };
}

async function login({ email, otp }) {
  const { client } = baseClient();
  const address = email || await prompt('WHATIF email: ');
  let session;
  if (otp) {
    const sent = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
    if (sent.error) throw new Error(sent.error.message);
    // Accept either the 6-digit code or the sign-in link itself (copy it, do
    // not open it: opening the link spends the one-time token in the browser).
    const answer = await prompt('Code from the email, or paste the sign-in link (do not open it): ');
    const verified = await client.auth.verifyOtp(otpParams(address, answer));
    if (verified.error) throw new Error(verified.error.message);
    session = verified.data.session;
  } else {
    const signedIn = await client.auth.signInWithPassword({ email: address, password: await prompt('Password: ', { hidden: true }) });
    if (signedIn.error) throw new Error(signedIn.error.message);
    session = signedIn.data.session;
  }
  await saveSession(session);
  return { loggedIn: true, ...await describeUser(client, session.user), sessionFile: SESSION_FILE };
}

// Authenticated client acting as the session owner. RLS and auth.uid() decide
// what it may touch; nothing here accepts a user id from the caller.
async function connect() {
  const { key, client } = baseClient();
  const envToken = process.env.WHATIF_USER_ACCESS_TOKEN;
  if (envToken) {
    const supabase = createClient(PROJECT_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${envToken}` } },
    });
    return { supabase, user: await requireUser(supabase, envToken) };
  }
  let stored;
  try { stored = JSON.parse(await readFile(SESSION_FILE, 'utf8')); } catch { throw new Error('Not logged in. The account owner runs "npm run design -- login" once in a terminal.'); }
  const { data, error } = await client.auth.setSession(stored);
  if (error || !data.session) throw new Error(`Session expired or revoked (${error?.message ?? 'no session'}). Run "npm run design -- login" again.`);
  if (data.session.access_token !== stored.access_token) await saveSession(data.session);
  return { supabase: client, user: await requireUser(client, data.session.access_token) };
}

// Who the session really is, so the owner can confirm it is the intended
// account (one email can have several sign-in methods).
async function describeUser(supabase, user) {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return {
    userId: user.id, email: user.email, role: profile?.role ?? null,
    providers: user.app_metadata?.providers ?? (user.app_metadata?.provider ? [user.app_metadata.provider] : []),
  };
}

// ---------------------------------------------------------- render bridge

async function withBridge(fn) {
  const probe = await fetch(`${RENDER_BASE_URL}/edit/render`, { signal: AbortSignal.timeout(120_000) }).catch(() => null);
  if (!probe?.ok) throw new Error(`Render bridge is not reachable at ${RENDER_BASE_URL}/edit/render. Start "npm run dev" or set WHATIF_RENDER_BASE_URL.`);
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${RENDER_BASE_URL}/edit/render`);
    await page.waitForFunction(() => window.__whatifDesignBridge?.version === 1, null, { timeout: 120_000 });
    return await fn({
      presets: () => page.evaluate(() => window.__whatifDesignBridge.presets()),
      normalize: (elements) => page.evaluate((els) => window.__whatifDesignBridge.normalize(els), elements),
      render: async (doc) => {
        const out = await page.evaluate((d) => window.__whatifDesignBridge.render(d), doc);
        const decode = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
        return { thumbnail: decode(out.thumbnailDataURL), fullres: decode(out.fullresDataURL), unresolvedFonts: out.unresolvedFonts };
      },
    });
  } finally {
    await browser.close();
  }
}

// ------------------------------------------------------------- documents

async function loadLocalFile(filePath) {
  const bytes = await readFile(filePath);
  const meta = await sharp(bytes).metadata();
  const ext = { png: 'png', jpeg: 'jpg', webp: 'webp' }[meta.format];
  if (!ext) throw new Error(`${filePath}: only PNG, JPEG or WebP can be placed.`);
  return {
    name: path.basename(filePath), bytes, ext, contentType: `image/${meta.format}`,
    width: meta.width, height: meta.height, hasAlpha: Boolean(meta.hasAlpha),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    thumbnail: await sharp(bytes).resize({ width: 400, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer(),
  };
}

async function readDocFile(docPath, bridge) {
  const raw = JSON.parse(await readFile(docPath, 'utf8'));
  let template = raw.template;
  if (raw.preset) {
    const preset = (await bridge.presets()).find((item) => item.key === raw.preset);
    if (!preset) throw new Error(`Unknown preset "${raw.preset}". Run "presets".`);
    template = { id: preset.key, name: preset.label, width: preset.width, height: preset.height };
  }
  if (template && !template.id) template = { ...template, id: `size-${template.width}x${template.height}` };
  const canvasColor = raw.canvasColor ?? '#FFFFFF';
  return {
    raw, name: raw.name, work: raw.work ?? null, documentRevision: raw.documentRevision,
    doc: { template: template && { name: template.id, backgroundColor: canvasColor, ...template }, canvasColor, elements: raw.elements },
  };
}

// Resolve file: sources. Dry runs inline them as data URLs for the preview
// only; applied runs upload them as the user's assets and store their keys.
async function resolveLocalSources(doc, { baseDir, apply, supabase, user, work }) {
  const files = [];
  const elements = [];
  for (const el of doc.elements) {
    const local = el.type === 'image' ? localFileOf(el.src) : null;
    if (!local) { elements.push(el); continue; }
    const file = await loadLocalFile(path.resolve(baseDir, local));
    const role = el.assetRole ?? (file.hasAlpha ? 'character_cutout' : 'background');
    // assetRole only classifies the upload; it is not part of the element.
    const rest = { ...el };
    delete rest.assetRole;
    if (apply) {
      const uploaded = await registerUpload({ supabase, userId: user.id, file, work, role });
      files.push({ file: file.name, key: uploaded.key, width: file.width, height: file.height, hasAlpha: file.hasAlpha, reused: uploaded.reused });
      elements.push({ ...rest, src: uploaded.key });
    } else {
      files.push({ file: file.name, width: file.width, height: file.height, hasAlpha: file.hasAlpha, upload: 'pending --apply' });
      elements.push({ ...rest, src: `data:${file.contentType};base64,${file.bytes.toString('base64')}` });
    }
  }
  return { doc: { ...doc, elements }, files };
}

async function renderToFile(bridge, doc, previewPath) {
  const rendered = await bridge.render(doc);
  const meta = await sharp(rendered.fullres).metadata();
  if (previewPath) await writeFile(previewPath, rendered.fullres);
  return { rendered, image: { width: meta.width, height: meta.height, path: previewPath ?? null }, unresolvedFonts: rendered.unresolvedFonts };
}

async function verifyStored(row) {
  const state = previewState(row);
  if (!state.fullresUrl) return { ...state, measured: null };
  const response = await fetch(state.fullresUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) return { ...state, measured: { httpStatus: response.status } };
  const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  return { ...state, measured: { httpStatus: response.status, width: meta.width, height: meta.height, format: meta.format } };
}

async function renderAndCommit({ supabase, user, bridge, row, previewPath }) {
  const { rendered, image, unresolvedFonts } = await renderToFile(bridge, toEditableDocument(row), previewPath);
  const committed = await commitPreview({ supabase, userId: user.id, row, rendered });
  return { committed: committed.committed, reason: committed.reason, render: image, unresolvedFonts, preview: await verifyStored(committed.row) };
}

// --------------------------------------------------------------- commands

async function run(command, args, values) {
  if (command === 'login') return login({ email: values.email, otp: values.otp });
  if (command === 'logout') { await rm(SESSION_FILE, { force: true }); return { loggedOut: true }; }
  if (command === 'presets') return withBridge((bridge) => bridge.presets());

  // A create dry run touches nothing remote, so it previews without a session.
  const offline = command === 'create' && !values.apply;
  const { supabase, user } = offline ? await connect().catch(() => ({ supabase: null, user: null })) : await connect();
  if (command === 'whoami') return describeUser(supabase, user);
  const id = args[0];

  if (command === 'get' || command === 'status') {
    const row = await readOwnedBanner(supabase, user.id, id);
    const preview = await verifyStored(row);
    if (command === 'status') return { id, name: row.name, editUrl: editUrl(id), updatedAt: row.updated_at, ...preview };
    const editable = toEditableDocument(row);
    if (values.out) await writeFile(values.out, JSON.stringify(editable, null, 2) + '\n');
    return { ...editable, elements: values.out ? `written to ${values.out}` : editable.elements, layers: layerSummary(row.elements), editUrl: editUrl(id), preview };
  }

  if (command === 'render') {
    const row = await readOwnedBanner(supabase, user.id, id);
    return withBridge(async (bridge) => ({ id, editUrl: editUrl(id), ...await renderAndCommit({ supabase, user, bridge, row, previewPath: values.preview }) }));
  }

  if (command === 'create' || command === 'update') {
    if (!values.doc) throw new Error(usage);
    if (command === 'create' && !values.key) throw new Error('--key is required so a retried create returns the same draft.');
    return withBridge(async (bridge) => {
      const parsed = await readDocFile(values.doc, bridge);
      const name = parsed.name ?? (command === 'create' ? 'AI draft' : undefined);
      const { doc: resolved, files } = await resolveLocalSources(parsed.doc, {
        baseDir: path.dirname(path.resolve(values.doc)), apply: values.apply, supabase, user, work: parsed.work,
      });
      const doc = { ...resolved, elements: await bridge.normalize(resolved.elements) };
      assertValidDocument({ ...doc, elements: doc.elements.map((el) => (el.src?.startsWith('data:') ? { ...el, src: 'pending-upload' } : el)) });
      const targetId = command === 'create' ? (user ? draftIdFor(user.id, values.key) : null) : id;
      let expected;
      if (command === 'update') {
        const row = await readOwnedBanner(supabase, user.id, targetId);
        expected = parsed.documentRevision;
        if (expected !== row.document_revision) {
          return { id: targetId, applied: false, conflict: { expected, current: row.document_revision }, next: 'Re-fetch with "get --out", re-apply your change, and retry. The current document was not touched.' };
        }
      }
      const plan = { id: targetId ?? '(assigned from your account on --apply)', editUrl: targetId ? editUrl(targetId) : null, name, width: doc.template.width, height: doc.template.height, files, layers: layerSummary(doc.elements).map((l) => ({ ...l, src: l.src?.startsWith('data:') ? '(local file)' : l.src })) };
      if (!values.apply) {
        const { image, unresolvedFonts } = await renderToFile(bridge, doc, values.preview);
        return { ...plan, applied: false, localPreview: image, unresolvedFonts, next: 'Review the preview, then re-run with --apply.' };
      }
      assertValidDocument(doc);
      const written = command === 'create'
        ? await createDraft({ supabase, userId: user.id, id: targetId, name, doc })
        : { created: false, row: await updateDocument({ supabase, userId: user.id, id: targetId, expectedRevision: expected, doc, name: parsed.name }) };
      if (command === 'create' && !written.created) {
        return { ...plan, applied: false, existing: true, documentRevision: written.row.document_revision, next: 'A draft for this --key already exists; it was left unchanged. Use "get" and "update" to change it.' };
      }
      return { ...plan, applied: true, documentRevision: written.row.document_revision, ...await renderAndCommit({ supabase, user, bridge, row: written.row, previewPath: values.preview }) };
    });
  }
  throw new Error(usage);
}

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    doc: { type: 'string' }, key: { type: 'string' }, out: { type: 'string' }, preview: { type: 'string' },
    email: { type: 'string' }, otp: { type: 'boolean', default: false }, apply: { type: 'boolean', default: false }, help: { type: 'boolean' },
  } });
  const [command, ...args] = positionals;
  if (values.help || !command) { console.log(usage); process.exit(0); }
  console.log(JSON.stringify(await run(command, args, values), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Design command failed.');
  process.exitCode = 1;
}
