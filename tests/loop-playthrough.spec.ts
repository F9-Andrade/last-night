import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('continuous expedition searches the town, builds a defense, clears the real first horde and enters Night 2', async ({ page }) => {
  test.setTimeout(420000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.text().startsWith('Playthrough:')) console.log(m.text()); });
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('/?test'); await page.locator('#start').click();
  await page.keyboard.press('Escape');await page.locator('#quality').click();await page.locator('#resume').click();
  // Driver uses the game's real keyboard/pointer handlers. No HP, ammo, loot, defense or kill injection.
  // Only idle daylight is skipped once preparation is complete; combat runs the normal 18-enemy schedule.
  await page.evaluate(() => {
    const g = (window as any).__LAST_NIGHT__, canvas = document.querySelector('#game')!;
    const run = { stage: 'travel', via:0, returnVia:0, stop: false, logs: [] as any[], index: 0, fire: false, phase: '', path: [] as any[], replan: 0, keys: new Set<string>(), acted: false, retries: 0 };
    (window as any).__playthrough = run;
    const destinations = ['base-ammo', 'base-wood', 'police-locker', 'hospital-case'];
    const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code === 'ShiftLeft' ? 'Shift' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code, bubbles: true }));
    const tap = (code: string) => { key(code, true); key(code, false); };
    const keys = (desired: string[]) => { for (const k of run.keys) if (!desired.includes(k)) key(k, false); for (const k of desired) if (!run.keys.has(k)) key(k, true); run.keys = new Set(desired); };
    const fire = (value: boolean) => { if(value&&run.fire&&g.state().shotTimer<=0&&!g.state().reloadTimer){canvas.dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true}));run.fire=false;} if (value !== run.fire) { canvas.dispatchEvent(new PointerEvent(value ? 'pointerdown' : 'pointerup', { button: 0, bubbles: true })); run.fire = value; } };
    const moveTo = (s: any, target: any, threshold: number): boolean => {
      if (Math.hypot(target.x - s.player.x, target.z - s.player.z) < threshold) { keys([]); return true; }
      if (performance.now() > run.replan || !run.path.length) { run.path = g.pathTo(target.x, target.z); run.replan = performance.now() + 700; }
      if(!run.path.length){run.stop=true;run.stage='route-unreachable';keys([]);return false;}
      while (run.path.length > 1 && Math.hypot(run.path[0].x - s.player.x, run.path[0].z - s.player.z) < .6) run.path.shift();
      const p = run.path[0] ?? target, dx = p.x - s.player.x, dz = p.z - s.player.z, len = Math.hypot(dx, dz) || 1;
      const horizontal = (dx - dz) / len, vertical = (dx + dz) / len, desired = ['ShiftLeft'];
      if (horizontal > .35) desired.push('KeyD'); else if (horizontal < -.35) desired.push('KeyA');
      if (vertical > .35) desired.push('KeyS'); else if (vertical < -.35) desired.push('KeyW'); keys(desired); return false;
    };
    const tick = () => {
      const s = g.state();
      if (run.stop || s.gameOver) { keys([]); fire(false); run.stop = true; return; }
      const phase = `${s.day}:${s.phase}`;
      if (phase !== run.phase) { run.logs.push({ phase, kills: s.kills, hp: s.player.hp, baseHP: s.baseHP, reserve: s.reserve, barricades: s.barricades.map((b: any) => b.hp) }); run.phase = phase; console.log('Playthrough:', phase, s.player.hp, s.baseHP, s.kills); }
      // Sprint now interrupts reload: stop briefly before resuming the expedition.
      if(s.reserve && (!s.ammo || s.reloadTimer)){keys([]);fire(false);if(!s.reloadTimer)tap('KeyR');requestAnimationFrame(tick);return;}
      let target = s.zombies.map((z: any) => ({ ...z, d: Math.hypot(z.x - s.player.x, z.z - s.player.z), screen: g.project(z.x, z.z) })).filter((z: any) => z.d < 24 && g.clearShot(z.x, z.z) && z.screen.x > 0 && z.screen.x < innerWidth && z.screen.y > 0 && z.screen.y < innerHeight).sort((a: any, b: any) => a.d - b.d)[0];
      if (target) window.dispatchEvent(new PointerEvent('pointermove', { clientX: target.screen.x, clientY: target.screen.y, bubbles: true }));
      if (!s.ammo && s.reserve && !s.reloadTimer) tap('KeyR');
      if (run.stage === 'travel') {
        const loot = s.loot.find((l: any) => l.id === destinations[run.index]);
        const road=run.index===3&&run.via<2?[{x:17,z:13},{x:15,z:-15}][run.via]:null;
        if(road){if(moveTo(s,road,.9)){run.via++;run.path=[];}}
        else if (moveTo(s, { x: loot.x, z: loot.z + 1.4 }, .6)) { run.stage = 'search'; run.acted = false; }
      } else if (run.stage === 'search') {
        const loot = s.loot.find((l: any) => l.id === destinations[run.index]); keys([]); target = undefined;
        if (!run.acted) { fire(false); tap('KeyE'); run.acted = true; run.replan = performance.now() + 1200; }
        if (loot.searched) { run.logs.push({ searched: loot.id, inventory: s.inventory }); console.log('Playthrough: searched', loot.id); run.index++; run.stage = run.index === destinations.length ? 'return' : 'travel'; run.path = []; }
        else if (!s.action && performance.now() > run.replan) run.acted = false;
      } else if (run.stage === 'return') {
        const road=run.returnVia<2?[{x:17,z:11},{x:1,z:11}][run.returnVia]:null;
        if(road){if(moveTo(s,road,.9)){run.returnVia++;run.path=[];}}
        else if (moveTo(s, { x: 1, z: 7.8 }, .4)) { run.stage = 'build'; run.acted = false; }
      } else if (run.stage === 'build') {
        keys([]); target = undefined;
        if (!run.acted) { fire(false); tap('KeyE'); run.acted = true; }
        if (s.barricades[0].hp > 0) { run.stage = 'retreat'; run.path = []; }
      } else if (run.stage === 'retreat') {
        if (moveTo(s, { x: 1, z: 4.6 }, .4)) { run.stage = 'defend'; g.setPhase('preparation', 28); g.setSpeed(2); }
      } else if (run.stage === 'defend') {
        keys([]);
        if (s.player.hp < 65 && s.inventory.med && !s.action) { fire(false); tap('KeyH'); }
        if (s.action?.kind === 'heal') target = undefined;
        if (s.day === 2 && s.phase === 'day') { run.stage = 'second-night'; g.setPhase('preparation', 29); }
      } else if (run.stage === 'second-night' && s.phase === 'night' && s.horde.spawned >= 2) { run.stop = true; run.stage = 'complete'; keys([]); fire(false); g.setSpeed(1); return; }
      fire(!!target && run.stage !== 'search' && run.stage !== 'build' && s.action?.kind !== 'heal');
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().phase === 'night' || (window as any).__playthrough.stop, null, { timeout: 240000 }).catch(async error=>{await writeFile('test-results/loop-driver-failure.json',JSON.stringify(await page.evaluate(()=>({state:(window as any).__LAST_NIGHT__?.state(),driver:{...(window as any).__playthrough,keys:[]}})),null,2));throw error;});
  expect(await page.evaluate(() => (window as any).__LAST_NIGHT__.state().gameOver)).toBe(false);
  await page.screenshot({ path: 'test-results/loop-night-one.png' });
  await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().phase === 'dawn' || (window as any).__playthrough.stop, null, { timeout: 180000 });
  const dawn = await page.evaluate(() => (window as any).__LAST_NIGHT__.state());
  expect(dawn.gameOver).toBe(false); expect(dawn.phase).toBe('dawn'); expect(dawn.horde.spawned).toBe(18); expect(dawn.zombies).toHaveLength(0); expect(dawn.storage.rare).toBe(1);
  await page.screenshot({ path: 'test-results/loop-dawn.png' });
  await page.locator('[data-perk]').first().click();
  await page.waitForFunction(() => (window as any).__playthrough.stop, null, { timeout: 30000 });
  const final = await page.evaluate(() => ({ state: (window as any).__LAST_NIGHT__.state(), log: (window as any).__playthrough.logs, stage: (window as any).__playthrough.stage }));
  expect(final.stage).toBe('complete'); expect(final.state.day).toBe(2); expect(final.state.phase).toBe('night'); expect(final.state.horde.budget).toBe(24);
  expect(final.log.filter((l: any) => l.searched)).toHaveLength(4);
  await page.screenshot({ path: 'test-results/loop-night-two.png' }); await writeFile('test-results/loop-playthrough.json', JSON.stringify(final, null, 2)); expect(errors).toEqual([]);
});
