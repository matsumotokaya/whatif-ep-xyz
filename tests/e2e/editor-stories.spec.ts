import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { openGuestEditor, savedDesign, savedElement } from './support/editor';

// The Stories (phone) shell under real touch input. Runs in the mobile
// project, where the editor detects a phone and switches shells by itself.

const BLEED = 400;

interface StageGeometry {
  left: number;
  top: number;
  scale: number;
}

// The Stories stage wraps the artboard plus a bleed band at a fixed fit scale.
async function stageGeometry(page: Page): Promise<StageGeometry> {
  const box = (await page.locator('canvas').first().boundingBox())!;
  return { left: box.x, top: box.y, scale: box.width / (1000 + BLEED * 2) };
}

const at = (stage: StageGeometry, x: number, y: number) => ({
  x: stage.left + (BLEED + x) * stage.scale,
  y: stage.top + (BLEED + y) * stage.scale,
});

async function touchDrag(cdp: CDPSession, from: { x: number; y: number }, to: { x: number; y: number }) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10, id: 1 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function pinch(cdp: CDPSession, center: { x: number; y: number }, fromDistance: number, toDistance: number) {
  const points = (distance: number) => [
    { x: center.x - distance / 2, y: center.y, id: 1 },
    { x: center.x + distance / 2, y: center.y, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(fromDistance) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(fromDistance + ((toDistance - fromDistance) * i) / 10),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('tap selects, drag moves, pinch resizes as one undo step', async ({ page }) => {
  await openGuestEditor(page);
  const cdp = await page.context().newCDPSession(page);
  const stage = await stageGeometry(page);
  const onRect = at(stage, 250, 700);

  await page.touchscreen.tap(onRect.x, onRect.y);
  await expect(page.getByRole('button', { name: 'Delete element' })).toBeVisible();

  await touchDrag(cdp, onRect, { x: onRect.x + 30, y: onRect.y - 45 });
  await expect.poll(async () => (await savedElement(page, 'rect'))?.y).toBeLessThan(600);
  const moved = (await savedElement(page, 'rect'))!;
  expect(moved.x - 100).toBeCloseTo(30 / stage.scale, 0);

  // Both fingers on the selected element: 1.5x.
  const center = at(stage, moved.x + 150, moved.y + 100);
  await pinch(cdp, center, 40, 60);
  await expect.poll(async () => (await savedElement(page, 'rect'))?.width).toBeCloseTo(450, 0);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await savedElement(page, 'rect'))?.width).toBe(300);
  // The undo removed the pinch only; the drag before it is still there.
  expect((await savedElement(page, 'rect'))!.x).toBeCloseTo(moved.x, 3);
});

test('tapping a selected text opens the fullscreen editor, and dropping on the trash deletes', async ({ page }) => {
  await openGuestEditor(page);
  const cdp = await page.context().newCDPSession(page);
  const stage = await stageGeometry(page);
  const onTitle = at(stage, 250, 210);

  await page.touchscreen.tap(onTitle.x, onTitle.y);
  await page.waitForTimeout(350);
  await page.touchscreen.tap(onTitle.x, onTitle.y);
  const editor = page.getByRole('dialog').locator('textarea');
  await expect(editor).toBeVisible();
  await editor.fill('HELLO');
  await page.getByRole('button', { name: 'Done' }).first().click();
  await expect.poll(async () => (await savedElement(page, 'title'))?.text).toBe('HELLO');

  const onRect = at(stage, 250, 700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...onRect, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: onRect.x + 6, y: onRect.y + 12, id: 1 }],
  });
  const trash = page.locator('.material-symbols-outlined', { hasText: 'delete' }).first();
  await expect(trash).toBeVisible();
  const trashBox = (await trash.boundingBox())!;
  const target = { x: trashBox.x + trashBox.width / 2, y: trashBox.y + trashBox.height / 2 };
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: onRect.x + ((target.x - onRect.x) * i) / 8, y: onRect.y + ((target.y - onRect.y) * i) / 8, id: 1 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect.poll(async () => (await savedDesign(page)).elements.map((element) => element.id)).toEqual(['circle', 'title']);
});
