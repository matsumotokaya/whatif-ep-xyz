import { expect, test } from '@playwright/test';
import sharp from 'sharp';

for (const width of [412, 1440]) {
test(`image feedback survives timeout and retries a failed original (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 915 });
  const pixel = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#4267ad' } }).png().toBuffer();
  // Exercise the real editor without reading or writing any remote account.
  await page.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.addInitScript(() => {
    localStorage.setItem('whatif_menu_locale', 'en');
    sessionStorage.setItem('whatif_guest_editor_notice_ack', '1');
    localStorage.setItem('banalist_guest_banner', JSON.stringify({
      name: 'Image feedback test', canvasColor: '#ffffff',
      template: { id: 'test', name: 'Test', width: 600, height: 800, planType: 'free', elements: [] },
      elements: [
        { id: 'shadow', type: 'shape', shapeType: 'rectangle', x: 100, y: 500, width: 200, height: 100, fill: '#999999', fillEnabled: true },
        { id: 'person', type: 'image', x: 100, y: 100, width: 300, height: 400, src: 'https://image.invalid/person.png' },
      ],
    }));
  });
  let fail!: () => void;
  const failure = new Promise<void>(resolve => { fail = resolve; });
  let attempts = 0;
  await page.route('https://image.invalid/person.png*', async route => {
    attempts += 1;
    if (attempts === 1) { await failure; await route.abort('failed'); }
    else await route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: pixel });
  });
  await page.goto('/edit');
  await expect(page.locator('[data-image-state="loading"]')).toBeVisible();
  await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
  await page.waitForTimeout(6500);
  await expect(page.locator('[data-image-state="loading"]')).toBeVisible();
  expect(attempts).toBe(1);
  await page.screenshot({ path: `test-results/editor-image-loading-${width}.png` });
  fail();
  await expect(page.locator('[data-image-state="error"]')).toBeVisible();
  await page.getByRole('button', { name: 'Retry image 1' }).click();
  await expect(page.locator('[data-image-state]')).toHaveCount(0);
  expect(attempts).toBe(2);
  await page.screenshot({ path: `test-results/editor-image-ready-${width}.png` });
});
}
