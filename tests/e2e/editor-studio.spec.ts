import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  canvasPoint,
  dragMouse,
  modifier,
  openGuestEditor,
  savedDesign,
  savedElement,
  setZoom,
  studioDesign,
  studioView,
  textElement,
} from './support/editor';

// Studio (desktop) editor behaviour, driven through real pointer and keyboard
// input against a guest design. The saved document in localStorage is the
// oracle for what an interaction did.

test.describe('view', () => {
  test('fits the artboard on open and keeps the canvas bitmap the same size at every zoom', async ({ page }) => {
    await openGuestEditor(page);
    const view = await studioView(page);

    // Whole artboard visible inside the canvas area.
    expect(view.originX).toBeGreaterThan(0);
    expect(view.originY).toBeGreaterThan(0);
    expect(view.originX + 1000 * view.scale).toBeLessThan(view.width);
    expect(view.originY + 1000 * view.scale).toBeLessThan(view.height);

    const bitmapSize = () =>
      page.evaluate(() => Array.from(document.querySelectorAll('canvas')).map((c) => `${c.width}x${c.height}`));
    const atFit = await bitmapSize();
    await setZoom(page, 400);
    await expect.poll(async () => (await studioView(page)).scale).toBeCloseTo(4, 1);
    expect(await bitmapSize()).toEqual(atFit);
  });

  test('zooms about the pointer and never lets the artboard leave the view', async ({ page }) => {
    await openGuestEditor(page);
    const before = await studioView(page);
    const pointer = { x: before.left + before.width * 0.3, y: before.top + before.height * 0.7 };
    const under = (view: typeof before) => ({
      x: (pointer.x - view.left - view.originX) / view.scale,
      y: (pointer.y - view.top - view.originY) / view.scale,
    });

    await page.mouse.move(pointer.x, pointer.y);
    await page.keyboard.down('Control');
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');

    await expect.poll(async () => (await studioView(page)).scale).toBeGreaterThan(before.scale * 2);
    const after = await studioView(page);
    expect(under(after).x).toBeCloseTo(under(before).x, 0);
    expect(under(after).y).toBeCloseTo(under(before).y, 0);

    // Scroll far away: part of the artboard must stay reachable.
    for (let i = 0; i < 40; i++) await page.mouse.wheel(900, 900);
    await expect
      .poll(async () => {
        const view = await studioView(page);
        return view.originX + 1000 * view.scale;
      })
      .toBeGreaterThan(0);
  });

  test('Space-drag and the hand tool pan without moving elements', async ({ page }) => {
    await openGuestEditor(page);
    const start = await studioView(page);
    const onRect = canvasPoint(start, 250, 700);

    await page.mouse.click(start.left + 6, start.top + 6);
    await page.keyboard.down(' ');
    await dragMouse(page, onRect, { x: onRect.x + 60, y: onRect.y + 24 });
    await page.keyboard.up(' ');
    const afterSpace = await studioView(page);
    expect(afterSpace.originX - start.originX).toBeCloseTo(60, 0);
    expect(afterSpace.originY - start.originY).toBeCloseTo(24, 0);

    await page.getByRole('button', { name: 'Hand' }).click();
    await dragMouse(page, onRect, { x: onRect.x - 30, y: onRect.y });
    const afterHand = await studioView(page);
    expect(afterHand.originX - afterSpace.originX).toBeCloseTo(-30, 0);

    // Nothing was dragged, so nothing was saved over the seeded design.
    expect(await savedElement(page, 'rect')).toMatchObject({ x: 100, y: 600 });
  });
});

test.describe('editing', () => {
  test('dragging snaps to the artboard centre and one undo restores the position', async ({ page }) => {
    await openGuestEditor(page);
    const view = await studioView(page);
    const from = canvasPoint(view, 250, 700);
    // The rectangle's centre is at x=250; 246 units right puts it 4 short of centre.
    await dragMouse(page, from, { x: from.x + 246 * view.scale, y: from.y });

    await expect.poll(async () => (await savedElement(page, 'rect'))?.x).toBe(350);

    await page.keyboard.press(`${modifier}+z`);
    await expect.poll(async () => (await savedElement(page, 'rect'))?.x).toBe(100);

    await page.keyboard.press(`${modifier}+Shift+z`);
    await expect.poll(async () => (await savedElement(page, 'rect'))?.x).toBe(350);
  });

  test('a marquee selects several elements and dragging one moves them together', async ({ page }) => {
    await openGuestEditor(page);
    const view = await studioView(page);
    await dragMouse(page, canvasPoint(view, 40, 560), canvasPoint(view, 960, 840));
    await expect(page.getByText('2 objects selected').filter({ visible: true })).toBeVisible();

    const from = canvasPoint(view, 250, 700);
    await page.keyboard.down(modifier); // free placement, no snapping
    await dragMouse(page, from, { x: from.x + 40, y: from.y - 60 });
    await page.keyboard.up(modifier);

    await expect.poll(async () => (await savedElement(page, 'rect'))?.y).toBeLessThan(600);
    const rect = (await savedElement(page, 'rect'))!;
    const circle = (await savedElement(page, 'circle'))!;
    expect(circle.x - 600).toBeCloseTo(rect.x - 100, 3);
    expect(circle.y - 600).toBeCloseTo(rect.y - 600, 3);
  });

  test('keyboard shortcuts: duplicate, layer order, select all, delete, and they work after using a slider', async ({ page }) => {
    await openGuestEditor(page);
    const view = await studioView(page);
    const onRect = canvasPoint(view, 250, 700);
    await page.mouse.click(onRect.x, onRect.y);

    await page.keyboard.press(`${modifier}+d`);
    await expect.poll(async () => (await savedDesign(page)).elements.length).toBe(4);
    const copy = (await savedDesign(page)).elements[3];
    expect(copy).toMatchObject({ type: 'shape', x: 120, y: 620 });

    // One undo removes the copy again.
    await page.keyboard.press(`${modifier}+z`);
    await expect.poll(async () => (await savedDesign(page)).elements.length).toBe(3);

    // A focused slider must not swallow editor shortcuts.
    await page.mouse.click(onRect.x, onRect.y);
    await page.locator('aside input[type="range"]').last().focus();
    await page.keyboard.press(`${modifier}+]`);
    await expect.poll(async () => (await savedDesign(page)).elements.map((el) => el.id)).toEqual(['circle', 'rect', 'title']);
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await savedDesign(page)).elements.map((el) => el.id)).toEqual(['circle', 'title']);

    await page.mouse.click(view.left + 6, view.top + 6);
    await page.keyboard.press(`${modifier}+a`);
    await expect(page.getByText('2 objects selected').filter({ visible: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Select an object')).toBeVisible();
  });

  test('shortcuts do not reach the canvas behind an open dialog', async ({ page }) => {
    await openGuestEditor(page);
    const view = await studioView(page);
    const onRect = canvasPoint(view, 250, 700);
    await page.mouse.click(onRect.x, onRect.y);

    await page.getByRole('button', { name: 'Open menu' }).last().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Delete');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await savedElement(page, 'rect'))?.x).toBe(101);
  });

  test('text is edited in place at the current zoom, and clearing it removes the element', async ({ page }) => {
    await openGuestEditor(page);
    await setZoom(page, 100);
    await expect.poll(async () => (await studioView(page)).scale).toBe(1);
    const view = await studioView(page);
    const onTitle = canvasPoint(view, 200, 200);

    await page.mouse.dblclick(onTitle.x, onTitle.y);
    const editor = page.locator('textarea[data-editor-inline-text]');
    await expect(editor).toBeVisible();
    // 120 canvas units at 100% zoom.
    await expect(editor).toHaveCSS('font-size', '120px');
    const box = (await editor.boundingBox())!;
    const origin = canvasPoint(view, 100, 150);
    expect(box.x).toBeCloseTo(origin.x, 0);
    expect(box.y).toBeCloseTo(origin.y, 0);

    await page.keyboard.press(`${modifier}+a`);
    await page.keyboard.type('NEW TITLE');
    await page.keyboard.press('Escape');
    await expect(editor).toBeHidden();
    // Escape discards the edit.
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await savedElement(page, 'title'))?.x).toBe(101);
    expect(await savedElement(page, 'title')).toMatchObject({ text: 'WHAT IF' });

    await page.mouse.dblclick(onTitle.x, onTitle.y);
    await page.keyboard.press(`${modifier}+a`);
    await page.keyboard.press('Backspace');
    await page.keyboard.press(`${modifier}+Enter`);
    await expect.poll(async () => (await savedDesign(page)).elements.map((el) => el.id)).toEqual(['rect', 'circle']);
  });

  test('background colour is part of undo', async ({ page }) => {
    await openGuestEditor(page);
    await page.locator('aside').first().getByTitle('#EF4444').click();
    await expect.poll(async () => (await savedDesign(page)).canvasColor).toBe('#EF4444');
    await page.keyboard.press(`${modifier}+z`);
    await expect.poll(async () => (await savedDesign(page)).canvasColor).toBe('#f4f1ea');
  });

  test('a guest who tries to upload an image is offered the login instead of being redirected', async ({ page }) => {
    await openGuestEditor(page);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'pic.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
    const prompt = page.getByRole('dialog');
    await expect(prompt).toContainText('Log in to enable uploads');
    await prompt.getByRole('button', { name: 'Cancel' }).click();
    await expect(prompt).toBeHidden();
    expect(new URL(page.url()).pathname).toBe('/edit');
  });
});

test.describe('output', () => {
  test('the downloaded image does not depend on zoom or pan', async ({ page }) => {
    await openGuestEditor(page);

    const download = async () => {
      const [file] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /Download/ }).click(),
      ]);
      return readFileSync((await file.path())!);
    };

    const atFit = await download();
    await setZoom(page, 300);
    const view = await studioView(page);
    await page.mouse.move(view.left + view.width / 2, view.top + view.height / 2);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(300, 300);
    const zoomedAndPanned = await download();

    expect(atFit.length).toBeGreaterThan(1000);
    expect(zoomedAndPanned.equals(atFit)).toBe(true);
  });

  test('text is repainted with a web font that finishes loading after the canvas was drawn', async ({ page }) => {
    // A generated font whose A-Z glyphs are wide boxes: unmistakable once applied.
    const font = readFileSync(path.join(__dirname, 'fixtures', 'test-wide.ttf'));
    let releaseFont!: () => void;
    const fontHeld = new Promise<void>((resolve) => {
      releaseFont = resolve;
    });

    await page.route('https://fonts.googleapis.com/css2?family=Noto**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '@font-face { font-family: "Late Wide"; src: url(https://fonts.gstatic.com/e2e/late-wide.ttf) format("truetype"); }',
      }),
    );
    await page.route('https://fonts.gstatic.com/e2e/late-wide.ttf', async (route) => {
      await fontHeld;
      await route.fulfill({
        status: 200,
        contentType: 'font/ttf',
        headers: { 'access-control-allow-origin': '*' },
        body: font,
      });
    });

    const design = studioDesign();
    design.elements = [textElement('late', { text: 'ABC', x: 100, y: 400, fontSize: 100, fontFamily: '"Late Wide", sans-serif' })];
    await openGuestEditor(page, design);

    // Read the canvas itself: taking a page screenshot waits for pending font
    // loads, and this test holds one open on purpose.
    const paint = () => page.evaluate(() => document.querySelector('canvas')!.toDataURL());
    expect(await page.evaluate(() => document.fonts.status)).toBe('loading');
    const withFallback = await paint();

    releaseFont();
    // No interaction: the canvas must repaint on its own.
    await expect.poll(async () => (await paint()) !== withFallback, { timeout: 10_000 }).toBe(true);

    // The text was measured again as well. In the wide font "ABC" spans 600
    // canvas units; x=560 is far outside the fallback text and only hits the
    // element if its size was refreshed.
    const view = await studioView(page);
    const insideWideText = canvasPoint(view, 560, 440);
    await page.mouse.click(insideWideText.x, insideWideText.y);
    await expect(page.getByText('Text Size').filter({ visible: true })).toBeVisible();
  });
});
