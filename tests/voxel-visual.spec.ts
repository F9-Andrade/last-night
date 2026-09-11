import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('voxel asset inspection sheet renders without WebGL errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/tests/fixtures/voxel-gallery.html'); await page.waitForFunction(() => document.body.dataset.ready === 'true');
  await page.screenshot({ path: 'test-results/voxel-assets.png' }); expect(errors).toEqual([]);
});

test('camera comparison and forty-Walker night stress retain bounded draw calls and memory', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?test'); await page.locator('#start').click();
  await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.clearWalkers(); g.setCameraSpan(35); });
  await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().time > 1.4);
  await page.screenshot({ path: 'test-results/voxel-camera-35.png' });
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setCameraSpan(32));
  const time = await page.evaluate(() => (window as any).__LAST_NIGHT__.state().time);
  await page.waitForFunction(t => (window as any).__LAST_NIGHT__.state().time > t + 1.4, time);
  await page.screenshot({ path: 'test-results/voxel-camera-32.png' });
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setPhase('dusk', 10));
  await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().time > 190.3);
  await page.screenshot({ path: 'test-results/voxel-sunset.png' });
  await page.evaluate(() => {
    const g = (window as any).__LAST_NIGHT__; g.clearWalkers(); g.setPhase('night', 10); g.finishSpawning();
    for (let row = 0; row < 4; row++) for (let col = 0; col < 10; col++) g.spawn(-9 + col * 1.7, 11 + row * 1.1);
  });
  await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().time > 250.3);
  await page.screenshot({ path: 'test-results/voxel-horde-40.png' });
  const stress = await page.evaluate(() => (window as any).__LAST_NIGHT__.state());
  expect(stress.zombies).toHaveLength(40); expect(stress.calls).toBeLessThan(400); expect(stress.triangles).toBeLessThan(500000);
  expect(stress.render.materials).toBeLessThan(125); expect(stress.render.geometryMB).toBeLessThan(20); expect(stress.gameOver).toBe(false);
  await page.keyboard.press('Escape');
  await page.locator('#quality').click(); await page.locator('#resume').click();
  await page.waitForFunction(t => (window as any).__LAST_NIGHT__.state().time > t + .2, stress.time);
  const light = await page.evaluate(() => (window as any).__LAST_NIGHT__.state());
  await page.keyboard.press('Escape'); await page.locator('#restart').click();
  const restarted = await page.evaluate(() => (window as any).__LAST_NIGHT__.state());
  expect(restarted.render.voxelAssets).toBe(stress.render.voxelAssets);
  expect(restarted.render.geometryMB).toBe(stress.render.geometryMB);
  await writeFile('test-results/voxel-metrics.json', JSON.stringify({ high: stress, light, restarted }, null, 2));
  expect(errors).toEqual([]);
});

test('landmarks and building occlusion visual inspection', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test'); await page.locator('#start').click();
  for (const [name, x, z] of [['market', -25, 3], ['hospital', 25, -14], ['police', 25, 35], ['gas', -25, 35], ['occlusion', 1, -9]] as const) {
    await page.evaluate(([x, z]) => { const g = (window as any).__LAST_NIGHT__; g.clearWalkers(); g.setPlayer(x, z); }, [x, z]);
    const time = await page.evaluate(() => (window as any).__LAST_NIGHT__.state().time);
    await page.waitForFunction(t => (window as any).__LAST_NIGHT__.state().time > t + 1.4, time);
    await page.screenshot({ path: `test-results/voxel-${name}.png` });
  }
  expect(errors).toEqual([]);
});
