import { expect, test } from '@playwright/test';
import {
  bannerRow,
  canvasPoint,
  modifier,
  openMemberEditor,
  studioDesign,
  studioView,
  TEST_BANNER_ID,
  TEST_USER_ID,
  waitForEditorReady,
} from './support/editor';

// A signed-in user's saved design: loading, autosave, the local recovery
// snapshot and the exit flow. The session and the backend are fabricated in
// the browser (see support/editor.ts); no real account is involved.

const recoveryKey = `whatif:editor-recovery:v1:${TEST_USER_ID}:${TEST_BANNER_ID}`;

test('opening a saved design does not write anything until it is edited, then autosaves once', async ({ page }) => {
  const backend = await openMemberEditor(page, bannerRow(studioDesign()));
  await waitForEditorReady(page);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  expect(backend.documentSaves).toHaveLength(0);

  const view = await studioView(page);
  const onRect = canvasPoint(view, 250, 700);
  await page.mouse.click(onRect.x, onRect.y);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  // The edit is protected locally before the network save happens.
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, recoveryKey)).toBe(true);

  await expect.poll(() => backend.documentSaves.length, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  const storedRect = backend.row!.elements.find((element) => element.id === 'rect');
  expect(storedRect).toMatchObject({ x: 102 });
  // Once the server has it, the local snapshot is no longer needed.
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBeNull();
});

test('"Save & Back" stores the document, uploads both previews and returns to the list', async ({ page }) => {
  const backend = await openMemberEditor(page, bannerRow(studioDesign()));
  await waitForEditorReady(page);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  const view = await studioView(page);
  await page.mouse.click(canvasPoint(view, 250, 700).x, canvasPoint(view, 250, 700).y);
  await page.keyboard.press('ArrowDown');
  await page.getByRole('button', { name: 'Save & Back to List' }).click();

  await page.waitForURL('**/mydesign**');
  expect(backend.documentSaves.length).toBeGreaterThan(0);
  expect(backend.uploads).toBe(2);
  expect(backend.previewFinalizations).toBe(1);
  expect(backend.row).toMatchObject({ preview_status: 'ready' });
});

test('local edits newer than the stored design are restored and saved', async ({ page }) => {
  const design = studioDesign();
  const backend = await openMemberEditor(page, bannerRow(design));
  await waitForEditorReady(page);

  // A snapshot left behind by a tab that closed before its save went through.
  const recovered = design.elements.map((element) => (element.id === 'rect' ? { ...element, x: 777 } : element));
  await page.evaluate(
    ({ key, userId, bannerId, elements }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          userId,
          bannerId,
          elements,
          canvasColor: '#abcdef',
          updatedAt: '2026-12-01T00:00:00.000Z',
        }),
      );
    },
    { key: recoveryKey, userId: TEST_USER_ID, bannerId: TEST_BANNER_ID, elements: recovered },
  );

  await page.reload();
  await waitForEditorReady(page);
  await expect
    .poll(() => backend.row!.elements.find((element) => element.id === 'rect')?.x, { timeout: 15_000 })
    .toBe(777);
  expect(backend.row).toMatchObject({ canvas_color: '#abcdef' });
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBeNull();
});

test('a brand-new empty design opens with a starter text that is saved', async ({ page }) => {
  const backend = await openMemberEditor(page, bannerRow({ ...studioDesign(), elements: [] }));
  await waitForEditorReady(page);
  await expect.poll(() => backend.row!.elements.length, { timeout: 15_000 }).toBe(1);
  expect(backend.row!.elements[0]).toMatchObject({ type: 'text' });
});

test('a design that does not exist shows a failure with a way back, not an endless spinner', async ({ page }) => {
  await openMemberEditor(page, null, { bannerRequest: 'missing' });
  await expect(page.getByText('Failed to load template')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.waitForURL('**/mydesign**');
});

test('undo is one step per edit for a signed-in user too', async ({ page }) => {
  const backend = await openMemberEditor(page, bannerRow(studioDesign()));
  await waitForEditorReady(page);
  const view = await studioView(page);
  await page.mouse.click(canvasPoint(view, 250, 700).x, canvasPoint(view, 250, 700).y);
  await page.keyboard.press(`${modifier}+d`);
  await expect.poll(() => backend.row!.elements.length, { timeout: 15_000 }).toBe(4);
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => backend.row!.elements.length, { timeout: 15_000 }).toBe(3);
});
