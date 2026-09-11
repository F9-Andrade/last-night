import { test, expect } from '@playwright/test';
test('survival voxel recipes and compact inventory remain readable', async ({ page }) => {
  test.setTimeout(90000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 900 }); await page.goto('/tests/fixtures/survival-gallery.html');
  await page.waitForFunction(() => document.body.dataset.ready === 'true'); await page.screenshot({ path: 'test-results/loop-assets.png' });
  await page.setViewportSize({ width: 1024, height: 640 }); await page.goto('/?test'); await page.locator('#start').click(); await page.keyboard.press('Tab');
  await expect(page.locator('#inventory-panel')).toBeVisible(); await page.screenshot({ path: 'test-results/loop-inventory-compact.png' });
  await page.locator('#use-med').scrollIntoViewIfNeeded(); await expect(page.locator('#use-med')).toBeVisible();
  const box = await page.locator('#inventory-panel').boundingBox(); expect(box!.x + box!.width).toBeLessThanOrEqual(1024); expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  await page.keyboard.press('Escape'); await expect(page.locator('#inventory-panel')).toBeHidden();
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setPhase('preparation', 21));
  await expect(page.locator('#cycle')).toHaveClass(/urgent/); await page.screenshot({ path: 'test-results/loop-last-seconds.png' });
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setPhase('dawn', 4));
  await expect(page.locator('#day')).toHaveText('DIA 02'); await expect(page.locator('#objective-title')).toHaveText('Você sobreviveu.');
  await page.screenshot({ path: 'test-results/loop-dawn-light.png' });
  expect(errors).toEqual([]);
});
