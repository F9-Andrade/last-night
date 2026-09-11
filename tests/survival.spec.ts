import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const state = (page: any) => page.evaluate(() => (window as any).__LAST_NIGHT__.state());
const setup = async (page: any) => {
  await page.goto('/?test'); await page.locator('#start').click();
  await page.evaluate(() => (window as any).__LAST_NIGHT__.clearWalkers());
};

test('search, medicine, inventory, timed build, repair and a Walker breaching the gate', async ({ page }) => {
  test.setTimeout(240000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await setup(page);
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setPlayer(-2, 3));
  await expect(page.locator('#interaction')).toContainText('VASCULHAR'); await page.keyboard.press('e');
  await expect(page.locator('#interaction')).toContainText('VASCULHANDO');
  await expect(page.locator('#reserve')).toHaveText('108', { timeout: 15000 });
  await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.setPlayer(1, 7); g.spawn(1, 7.9); });
  await expect.poll(async () => (await state(page)).player.hp).toBeLessThan(100);
  await page.evaluate(() => (window as any).__LAST_NIGHT__.clearWalkers());
  const hurt = await state(page); await page.keyboard.press('h'); await expect(page.locator('#interaction')).toContainText('APLICANDO BANDAGEM');
  await page.keyboard.press('Escape'); const paused = await state(page); await page.waitForTimeout(400);
  expect((await state(page)).action.elapsed).toBe(paused.action.elapsed); expect((await state(page)).time).toBe(paused.time);
  await page.locator('#resume').click(); await expect(page.locator('#health')).toHaveText('100', { timeout: 20000 }); expect((await state(page)).inventory.med).toBe(hurt.inventory.med - 1);
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setPlayer(23, -17)); await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).inventory.med, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Tab'); await expect(page.locator('#inventory-panel')).toBeVisible();
  await page.screenshot({ path: 'test-results/loop-inventory-expedition.png' });
  await page.keyboard.press('Tab'); await page.evaluate(() => (window as any).__LAST_NIGHT__.setPlayer(4.8, 5));
  await page.keyboard.press('e'); await expect.poll(async () => (await state(page)).inventory.wood, { timeout: 15000 }).toBe(8);
  await page.keyboard.press('Tab'); await page.locator('#deposit-wood').click(); expect((await state(page)).storage.wood).toBe(8);
  await page.locator('#withdraw-wood').click(); expect((await state(page)).inventory.wood).toBe(1);
  await page.screenshot({ path: 'test-results/loop-inventory-base.png' }); await page.keyboard.press('Tab');
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setPlayer(1, 7)); await page.keyboard.press('e');
  await expect(page.locator('#interaction')).toContainText('CONSTRUINDO');
  await expect.poll(async () => (await state(page)).barricades[0].hp, { timeout: 15000 }).toBe(300);
  await page.screenshot({ path: 'test-results/loop-barricade-intact.png' });
  await page.evaluate(() => (window as any).__LAST_NIGHT__.damageDefense('gate', 120));
  const beforeRepair = await state(page); await page.keyboard.down('e');
  await expect(page.locator('#interaction')).toContainText('REPARANDO');
  await expect.poll(async () => (await state(page)).barricades[0].hp, { timeout: 20000 }).toBe(270); await page.keyboard.up('e');
  expect((await state(page)).inventory.scrap).toBe(beforeRepair.inventory.scrap - 1);
  await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.setPhase('preparation', 29); g.setSpeed(4); });
  await expect(page.locator('#phase')).toHaveText('HORDA NOTURNA');
  await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.finishSpawning(); g.clearWalkers(); g.spawn(1, 10.2); });
  await expect.poll(async () => (await state(page)).barricades[0].hp, { timeout: 25000 }).toBeLessThanOrEqual(198);
  await page.screenshot({ path: 'test-results/loop-barricade-damaged.png' });
  await expect.poll(async () => (await state(page)).barricades[0].hp, { timeout: 40000 }).toBeLessThanOrEqual(90);
  await page.screenshot({ path: 'test-results/loop-barricade-critical.png' });
  await expect.poll(async () => (await state(page)).barricades[0].hp, { timeout: 40000 }).toBe(0);
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setSpeed(1));
  await page.screenshot({ path: 'test-results/loop-barricade-broken.png' }); expect(errors).toEqual([]);
});

test('forty-Walker render budget, shelter defeat, player defeat and clean retries', async ({ page }) => {
  test.setTimeout(120000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await setup(page); await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.setPhase('night', 10); g.finishSpawning(); for (let row = 0; row < 4; row++) for (let col = 0; col < 10; col++) g.spawn(-9 + col * 1.7, 11 + row * 1.1); });
  await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().phaseElapsed > 10.3);
  await page.screenshot({ path: 'test-results/loop-horde-40.png' }); const stress = await state(page);
  expect(stress.zombies).toHaveLength(40); expect(stress.calls).toBeLessThan(410); expect(stress.triangles).toBeLessThan(250000); expect(stress.render.materials).toBeLessThan(125); expect(stress.render.geometryMB).toBeLessThan(16);
  await writeFile('test-results/loop-metrics.json', JSON.stringify({ horde40: { fps: stress.fps, calls: stress.calls, triangles: stress.triangles, ...stress.render } }, null, 2));
  await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.clearWalkers(); g.setPlayer(-25, 15); g.setBase(1); g.spawn(1, 2.5); });
  await expect(page.locator('#game-over')).toBeVisible({ timeout: 15000 }); await expect(page.locator('#end-title')).toHaveText('O ABRIGO CAIU');
  await page.screenshot({ path: 'test-results/loop-shelter-defeat.png' }); await page.locator('#retry').click();
  let reset = await state(page); expect(reset.day).toBe(1); expect(reset.baseHP).toBe(1000); expect(reset.inventory.ammo).toBe(72); expect(reset.barricades.every((b: any) => !b.built)).toBe(true); expect(reset.action).toBeNull(); expect(reset.loot.filter((l:any)=>l.guaranteed).every((l: any) => !l.searched)).toBe(true);
  await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.clearWalkers(); g.setHealth(1); g.spawn(1, 7.9); });
  await expect(page.locator('#game-over')).toBeVisible({ timeout: 15000 }); await expect(page.locator('#end-title')).toHaveText('Sua última noite.');
  await page.locator('#retry').click(); reset = await state(page); expect(reset.player.hp).toBe(100); expect(reset.zombies).toHaveLength(4); expect(reset.render.geometryMB).toBe(stress.render.geometryMB); expect(reset.render.voxelAssets).toBe(stress.render.voxelAssets);
  expect(errors).toEqual([]);
});
