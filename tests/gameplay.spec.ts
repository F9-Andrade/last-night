import { test, expect } from '@playwright/test';

// Hooks exist only in Vite dev mode with ?test. Inputs still go through real browser events.
test('start, move, aim, kill, reload, collect, pause, night, dawn and restart', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?test'); await expect(page.locator('#start')).toBeVisible();
  await page.waitForFunction(() => !!(window as any).__LAST_NIGHT__);
  await page.screenshot({ path: 'test-results/menu.png' });
  await page.locator('#start').click(); await expect(page.locator('#menu')).toBeHidden();
  await page.evaluate(() => (window as any).__LAST_NIGHT__.clearWalkers());
  const before = await page.evaluate(() => (window as any).__LAST_NIGHT__.state());
  await page.keyboard.down('s'); try{await page.waitForFunction(p=>{const s=(window as any).__LAST_NIGHT__.state();return s.player.x>p.x+.1&&s.player.z>p.z+.1;},before.player);}finally{await page.keyboard.up('s');}
  const moved = await page.evaluate(() => (window as any).__LAST_NIGHT__.state());
  expect(moved.player.x).toBeGreaterThan(before.player.x); expect(moved.player.z).toBeGreaterThan(before.player.z);
  await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.setPlayer(1, 7); g.spawn(1, 13); });
  await page.waitForTimeout(1800);
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().shotTimer === 0);
    const target = await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__, z = g.state().zombies[0]; return g.project(z.x, z.z); });
    await page.mouse.move(target.x, target.y); await page.mouse.click(target.x, target.y);
    await expect(page.locator('#ammo')).toHaveText(String(11 - i).padStart(2, '0'));
  }
  await expect.poll(async () => (await page.evaluate(() => (window as any).__LAST_NIGHT__.state())).kills).toBe(1);
  await expect(page.locator('#ammo')).toHaveText('09');
  await page.keyboard.press('r'); await expect(page.locator('#reload-label')).toHaveText('RECARREGANDO…');
  await expect(page.locator('#ammo')).toHaveText('12'); await expect(page.locator('#reserve')).toHaveText('69');
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setPlayer(-2, 3));
  await expect(page.locator('#interaction')).toContainText('VASCULHAR'); await page.keyboard.press('e'); await expect(page.locator('#reserve')).toHaveText('105', { timeout: 15000 });
  await page.keyboard.press('Escape'); await expect(page.locator('#pause-screen')).toBeVisible();
  const paused = await page.evaluate(() => (window as any).__LAST_NIGHT__.state().time); await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as any).__LAST_NIGHT__.state().time)).toBe(paused);
  await page.locator('#quality').click(); await expect(page.locator('#quality')).toHaveText('LEVE');
  await page.locator('#quality').click(); await page.locator('#resume').click();
  await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.setPlayer(1, 7); g.setPhase('preparation', 29.9); });
  await expect(page.locator('#phase')).toHaveText('HORDA NOTURNA');
  await expect.poll(async () => (await page.evaluate(() => (window as any).__LAST_NIGHT__.state())).zombies.length).toBeGreaterThan(0);
  await page.waitForTimeout(1500); await page.screenshot({ path: 'test-results/night.png' });
  await page.evaluate(() => { const g = (window as any).__LAST_NIGHT__; g.clearWalkers(); g.finishSpawning(); g.setPhase('dawn', 9.9); }); await expect(page.locator('#day')).toHaveText('DIA 02');
  await page.waitForTimeout(600); await page.screenshot({ path: 'test-results/day.png' });
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setHealth(0)); await expect(page.locator('#game-over')).toBeVisible();
  await page.locator('#retry').click(); await expect(page.locator('#game-over')).toBeHidden(); await expect(page.locator('#health')).toHaveText('100'); await expect(page.locator('#day')).toHaveText('DIA 01');
  console.log('Render snapshot:', await page.evaluate(() => { const s = (window as any).__LAST_NIGHT__.state(); return { fps: s.fps, calls: s.calls, triangles: s.triangles, ...s.render }; }));
  expect(errors).toEqual([]);
});

test('small desktop viewport keeps essential HUD and controls on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 }); await page.goto('/?test'); await page.locator('#start').click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.bottom-hud')!).opacity === '1');
  await page.screenshot({ path: 'test-results/compact.png' });
  for (const id of ['health', 'ammo', 'timer', 'minimap', 'pause']) {
    const box = await page.locator(`#${id}`).boundingBox(); expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(1024); expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  }
  await page.keyboard.press('Escape'); await expect(page.locator('#pause-screen')).toBeVisible();
});
