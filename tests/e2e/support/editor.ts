import type { Page, Route } from '@playwright/test';
import sharp from 'sharp';

// Shared setup for editor specs. Every request to Supabase and R2 is answered
// in the browser, so the specs exercise the real editor without reading or
// writing any remote account.

export const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

// Same origin the Playwright config serves the app from.
const BASE_URL = process.env.GALLERY_TEST_BASE_URL ?? 'http://127.0.0.1:3711';

export interface SeedElement {
  id: string;
  type: 'text' | 'shape' | 'image';
  [key: string]: unknown;
}

export interface SeedDesign {
  name: string;
  canvasColor: string;
  template: { id: string; name: string; width: number; height: number; planType: 'free' };
  elements: SeedElement[];
}

const common = { visible: true, locked: false };

export function textElement(id: string, overrides: Record<string, unknown> = {}): SeedElement {
  return {
    id, type: 'text', text: 'Text', x: 0, y: 0, fontSize: 80, fontFamily: 'Arial', letterSpacing: 0, lineHeight: 1,
    fill: '#111111', fillEnabled: true, stroke: '#000000', strokeWidth: 2, strokeEnabled: false, fontWeight: 400,
    ...common, ...overrides,
  };
}

export function shapeElement(id: string, shapeType: string, overrides: Record<string, unknown> = {}): SeedElement {
  return {
    id, type: 'shape', shapeType, x: 0, y: 0, width: 200, height: 200, fill: '#1f6feb', fillEnabled: true,
    stroke: '#000000', strokeWidth: 2, strokeEnabled: false, ...common, ...overrides,
  };
}

// A 1000x1000 artboard with two shapes and a text. System fonts only, so the
// specs do not depend on a font CDN.
export function studioDesign(): SeedDesign {
  return {
    name: 'E2E design',
    canvasColor: '#f4f1ea',
    template: { id: 'e2e', name: 'E2E', width: 1000, height: 1000, planType: 'free' },
    elements: [
      shapeElement('rect', 'rectangle', { x: 100, y: 600, width: 300, height: 200 }),
      shapeElement('circle', 'circle', { x: 600, y: 600, width: 300, height: 160, fill: '#e5484d' }),
      textElement('title', { text: 'WHAT IF', x: 100, y: 150, fontSize: 120 }),
    ],
  };
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });

async function pixel(color: string): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 4, background: color } }).png().toBuffer();
}

// Answer every remote dependency locally. Later, more specific routes can be
// registered by a spec; Playwright matches the most recently added first.
export async function stubRemote(page: Page): Promise<void> {
  const image = await pixel('#9fb8c8');
  await page.route('**/*.supabase.co/**', (route) => json(route, null));
  await page.route('https://image.invalid/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: image,
    }),
  );
}

// Open the editor on a guest design stored in this browser.
export async function openGuestEditor(page: Page, design: SeedDesign = studioDesign(), query = ''): Promise<void> {
  await stubRemote(page);
  await page.addInitScript((seed) => {
    localStorage.setItem('whatif_menu_locale', 'en');
    localStorage.setItem('banalist_language', 'en');
    sessionStorage.setItem('whatif_guest_editor_notice_ack', '1');
    // Seed once per tab: a reload must find what the editor saved.
    if (!sessionStorage.getItem('e2e_seeded')) {
      localStorage.setItem('banalist_guest_banner', JSON.stringify(seed));
      sessionStorage.setItem('e2e_seeded', '1');
    }
  }, design);
  await page.goto(`/edit${query}`);
  await waitForEditorReady(page);
}

// The canvas ignores input while the opening animation plays.
export async function waitForEditorReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-editor-ready]');
}

export interface GuestSnapshot {
  canvasColor: string;
  elements: Array<Record<string, unknown> & { id: string; type: string; x: number; y: number }>;
  template: { width: number; height: number };
  thumbnailUrl?: string;
  fullresUrl?: string;
}

// The document as the editor last saved it (guest designs live in localStorage).
export async function savedDesign(page: Page): Promise<GuestSnapshot> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('banalist_guest_banner') ?? 'null'));
}

export async function savedElement(page: Page, id: string) {
  return (await savedDesign(page)).elements.find((element) => element.id === id);
}

export interface StudioView {
  left: number;
  top: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  scale: number;
}

// Where the artboard currently sits on the page (Studio shell).
export async function studioView(page: Page): Promise<StudioView> {
  return page.evaluate(() => {
    const area = document.querySelector<HTMLElement>('[data-artboard-origin-x]');
    if (!area) throw new Error('The Studio canvas area is not mounted.');
    const rect = area.getBoundingClientRect();
    return {
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      originX: Number(area.dataset.artboardOriginX),
      originY: Number(area.dataset.artboardOriginY),
      scale: Number(area.dataset.artboardScale),
    };
  });
}

// Page coordinates of a point given in canvas units.
export function canvasPoint(view: StudioView, x: number, y: number): { x: number; y: number } {
  return { x: view.left + view.originX + x * view.scale, y: view.top + view.originY + y * view.scale };
}

export async function dragMouse(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  }
  await page.mouse.up();
}

// Slider position for a zoom percentage (the track is logarithmic, 5%-500%).
export async function setZoom(page: Page, percent: number): Promise<void> {
  const value = Math.round((Math.log(percent / 100 / 0.05) / Math.log(100)) * 1000);
  await page.getByLabel('Canvas zoom').fill(String(value));
}

// --- Signed-in editor ---

export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
export const TEST_BANNER_ID = '11111111-1111-4111-8111-111111111111';
const SUPABASE_PROJECT_REF = 'rgqduwojvylkulhyodqg';

const base64Url = (value: string) =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function bannerRow(design: SeedDesign, overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BANNER_ID,
    user_id: TEST_USER_ID,
    name: design.name,
    template: { ...design.template, backgroundColor: '#ffffff' },
    elements: design.elements,
    canvas_color: design.canvasColor,
    thumbnail_url: null,
    fullres_url: null,
    thumbnail_key: `user-images/${TEST_USER_ID}/banners/${TEST_BANNER_ID}/thumb-1.jpg`,
    fullres_key: `user-images/${TEST_USER_ID}/banners/${TEST_BANNER_ID}/full-1.jpg`,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    preview_status: 'ready',
    preview_source: 'generated',
    preview_error: null,
    document_revision: 5,
    preview_revision: 5,
    ...overrides,
  };
}

export interface MemberBackend {
  // The stored row, updated by the stubbed save RPCs.
  row: ReturnType<typeof bannerRow> | null;
  documentSaves: Array<{ elements: number | null; canvasColor: string | null }>;
  previewFinalizations: number;
  uploads: number;
}

// Sign the browser in with a fabricated session and serve one saved design
// from an in-memory backend.
export async function openMemberEditor(
  page: Page,
  row: ReturnType<typeof bannerRow> | null,
  options: { bannerRequest?: 'ok' | 'missing' } = {},
): Promise<MemberBackend> {
  const backend: MemberBackend = { row, documentSaves: [], previewFinalizations: 0, uploads: 0 };
  const user = {
    id: TEST_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  };
  const farFuture = 4102444800;
  const accessToken = [
    base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64Url(JSON.stringify({ sub: TEST_USER_ID, role: 'authenticated', exp: farFuture })),
    'signature',
  ].join('.');
  const session = {
    access_token: accessToken,
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 31536000,
    expires_at: farFuture,
    user,
  };

  await page.context().addCookies([
    {
      name: `sb-${SUPABASE_PROJECT_REF}-auth-token`,
      value: `base64-${base64Url(JSON.stringify(session))}`,
      url: BASE_URL,
    },
  ]);

  await stubRemote(page);
  await page.route('**/auth/v1/user**', (route) => json(route, user));
  await page.route('**/rest/v1/profiles**', (route) =>
    json(route, {
      id: TEST_USER_ID,
      email: user.email,
      full_name: 'E2E',
      avatar_url: null,
      role: 'user',
      subscription_tier: 'free',
      subscription_status: null,
      subscription_expires_at: null,
    }),
  );
  await page.route('**/rest/v1/banners**', (route) => {
    if (route.request().method() !== 'GET') return json(route, backend.row);
    if (options.bannerRequest === 'missing' || !backend.row) return json(route, []);
    return json(route, [backend.row]);
  });
  await page.route('**/rest/v1/rpc/save_banner_document', (route) => {
    const body = route.request().postDataJSON() as {
      p_elements: SeedElement[] | null;
      p_canvas_color: string | null;
      p_template: SeedDesign['template'] | null;
    };
    backend.documentSaves.push({ elements: body.p_elements?.length ?? null, canvasColor: body.p_canvas_color });
    if (backend.row) {
      backend.row = {
        ...backend.row,
        elements: body.p_elements ?? backend.row.elements,
        canvas_color: body.p_canvas_color ?? backend.row.canvas_color,
        document_revision: backend.row.document_revision + 1,
        preview_status: 'pending',
        updated_at: new Date().toISOString(),
      };
    }
    return json(route, backend.row);
  });
  await page.route('**/rest/v1/rpc/finalize_banner_preview', (route) => {
    const body = route.request().postDataJSON() as { p_document_revision: number };
    backend.previewFinalizations += 1;
    if (backend.row) {
      backend.row = { ...backend.row, preview_status: 'ready', preview_revision: body.p_document_revision };
    }
    return json(route, backend.row);
  });
  await page.route('**/functions/v1/r2-presign', (route) => {
    const body = route.request().postDataJSON() as { key: string };
    return json(route, { url: `https://r2.invalid/put/${encodeURIComponent(body.key)}` });
  });
  await page.route('https://r2.invalid/**', (route) => {
    backend.uploads += 1;
    return route.fulfill({ status: 200, body: '' });
  });
  await page.route('**/api/editor/assets/delete', (route) => json(route, { deleted: [] }));

  await page.addInitScript(() => {
    localStorage.setItem('whatif_menu_locale', 'en');
    localStorage.setItem('banalist_language', 'en');
  });
  await page.goto(`/edit/${TEST_BANNER_ID}`);
  return backend;
}
