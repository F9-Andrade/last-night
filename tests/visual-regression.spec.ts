import {test, expect, type Page} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';

const evidence = process.env.REGRESSION_EVIDENCE ?? 'docs/phase11/regression';
const state = (page: Page) => page.evaluate(() => (window as any).__LAST_NIGHT__.state());

async function recapture(page: Page): Promise<void> {
  await expect(async () => {
    if (await page.locator('#capture-mouse').isVisible()) await page.locator('#capture-mouse').click({timeout: 1500});
    expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  }).toPass({timeout: 10000});
}

async function start(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.setDefaultTimeout(30000);
  await mkdir(evidence, {recursive: true});
  await page.setViewportSize({width: 1600, height: 900});
  await page.addInitScript(() => localStorage.setItem('last-night-settings', JSON.stringify({quality: 'high', shadows: true, master: 0})));
  await page.goto('/?test', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => !!(window as any).__LAST_NIGHT__);
  await page.addStyleTag({content: '#debug-stats{display:none!important}'});
  return errors;
}

async function setScene(page: Page, phase: 'day' | 'night', x = 88, z = -30): Promise<void> {
  await page.evaluate(({phase, x, z}) => {
    const game = (window as any).__LAST_NIGHT__;
    game.clearWalkers();
    game.setPhase(phase, 0);
    game.finishSpawning();
    game.setHealth(100);
    game.setBase(1000);
    game.setPlayer(x, z);
    game.setLook(Math.PI, -.045);
    // Keep an active siege actor away from the hospital so a cleared test wave
    // does not advance to dawn and open the perk picker after three seconds.
    if (phase === 'night') game.spawn(1, 16);
  }, {phase, x, z});
}

async function setQuality(page: Page, quality: string): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-screen')).toBeVisible();
  await page.locator('#pause-settings').click();
  await page.locator('#setting-quality').selectOption(quality);
  await page.locator('#setting-shadows').setChecked(quality !== 'low');
  await page.locator('#settings-close').click();
  await page.locator('#resume').click();
  await recapture(page);
  await expect.poll(async () => (await state(page)).settings.quality).toBe(quality);
}

// Instrument only the existing main game rAF callback. Queries are read in later
// frames without gl.finish(), and disjoint batches are discarded. The numbers
// measure GPU command duration; they are not 1000 / FPS or a CPU timing estimate.
async function gpuDuration(page: Page) {
  return page.evaluate(async () => {
    const gl = document.querySelector<HTMLCanvasElement>('#game')!.getContext('webgl2');
    const ext = gl?.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!gl || !ext) return {available: false, reason: 'EXT_disjoint_timer_query_webgl2 unavailable', samples: [] as number[]};
    const original = window.requestAnimationFrame;
    const samples: number[] = [];
    const pending: WebGLQuery[] = [];
    let requested = 0, disjointBatches = 0, finished = false;
    const started = performance.now();
    const clear = () => {for (const query of pending) gl.deleteQuery(query); pending.length = 0;};
    const collect = () => {
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {clear(); disjointBatches++; return;}
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = pending.shift()!;
        samples.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(query);
      }
    };
    window.requestAnimationFrame = function(callback: FrameRequestCallback): number {
      if (callback.name !== 'frame') return original.call(window, callback);
      return original.call(window, timestamp => {
        if (finished) {callback(timestamp); return;}
        collect();
        let query: WebGLQuery | null = null;
        if (requested < 60 && !gl.isContextLost() && !gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
          query = gl.createQuery();
          if (query) {gl.beginQuery(ext.TIME_ELAPSED_EXT, query); requested++;}
        }
        try {callback(timestamp);} finally {
          if (query) {gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(query);}
        }
      });
    };
    try {
      while (samples.length < 60 && performance.now() - started < 6500 && !gl.isContextLost()) {
        await new Promise(resolve => setTimeout(resolve, 50));
        collect();
      }
      const sorted = [...samples].sort((a, b) => a - b);
      return {
        available: samples.length > 0,
        reason: samples.length ? null : 'No valid main-frame timer query results before timeout',
        method: 'EXT_disjoint_timer_query_webgl2 around main frame callback; nonblocking later-frame readback',
        samples, requested, disjointBatches,
        medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
        p95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : null,
      };
    } finally {
      finished = true;
      window.requestAnimationFrame = original;
      clear();
    }
  });
}

test('Phase 11: actual quality settings, resizing, inventory and pointer lock', async ({page}) => {
  const errors = await start(page);
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#menu-settings').click();
  await expect(page.locator('#setting-quality option')).toHaveCount(4);
  await page.locator('#settings-close').click();
  await page.locator('#credits-open').click();
  await expect(page.locator('#credits-screen')).toBeVisible();
  await page.locator('#credits-close').click();
  await page.locator('#start').click();
  await recapture(page);
  await setScene(page, 'day');
  await page.evaluate(() => setInterval(() => {
    const game = (window as any).__LAST_NIGHT__;
    game.clearWalkers(); game.setPhase('day', 0); game.setHealth(100); game.setBase(1000);
  }, 1000));
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector<HTMLCanvasElement>('#game')!.getContext('webgl2')!;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  const qualities = [];
  for (const quality of ['low', 'medium', 'high', 'ultra']) {
    await setQuality(page, quality);
    await setScene(page, 'day');
    await page.waitForTimeout(1500);
    const snapshot = await state(page);
    expect(snapshot.render.visual.toneMapping).toBe('AgX');
    expect(snapshot.render.visual.ao).toBe(quality === 'high' || quality === 'ultra' ? 'GTAO' : 'off');
    expect(snapshot.render.visual.bloom).toBe(quality === 'high' || quality === 'ultra');
    expect(snapshot.fps).toBeGreaterThan(0);
    expect(snapshot.calls).toBeGreaterThan(0);
    expect(snapshot.triangles).toBeGreaterThan(0);
    const gpu = await gpuDuration(page);
    qualities.push({quality, viewport: {width: 1600, height: 900}, fps: snapshot.fps, calls: snapshot.calls, triangles: snapshot.triangles, render: snapshot.render, gpu});
    await page.screenshot({animations: 'disabled', path: `${evidence}/quality-${quality}.png`});
  }
  await setQuality(page, 'high');
  // Audio/UI settings must not repeatedly dispose and rebuild AO render targets.
  await page.keyboard.press('Escape');
  await page.locator('#pause-settings').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const gl = document.querySelector<HTMLCanvasElement>('#game')!.getContext('webgl2')!;
    const original = gl.deleteTexture;
    (window as any).__textureDisposals = 0;
    (window as any).__restoreTextureObserver = () => {gl.deleteTexture = original;};
    gl.deleteTexture = function(texture) {(window as any).__textureDisposals++; original.call(gl, texture);};
  });
  let unrelatedSettingTextureDisposals = 0;
  try {
    for (const value of ['0.2', '0.4', '0']) await page.locator('#setting-master').evaluate((el, value) => {
      (el as HTMLInputElement).value = value;el.dispatchEvent(new Event('input', {bubbles: true}));
    }, value);
    await page.waitForTimeout(300);
    unrelatedSettingTextureDisposals = await page.evaluate(() => (window as any).__textureDisposals);
    expect(unrelatedSettingTextureDisposals).toBe(0);
  } finally {await page.evaluate(() => (window as any).__restoreTextureObserver());}
  await page.locator('#settings-close').click();
  await page.locator('#resume').click();
  await recapture(page);
  const layouts = [];
  for (const [width, height] of [[1920, 1080], [1600, 900], [1366, 768], [2560, 1440]]) {
    await page.setViewportSize({width, height});
    await recapture(page);
    await page.evaluate(() => (window as any).__LAST_NIGHT__.setInventory({ammo: 79, rifleAmmo: 12, shells: 8, med: 1, wood: 6, scrap: 5}));
    await page.keyboard.press('Tab');
    await expect(page.locator('#inventory-panel')).toBeVisible();
    await expect(page.locator('#inventory-close')).toBeInViewport();
    expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);
    await expect(page.locator('#item-ammo')).toHaveText('79');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.item-slot .item-art')).every(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0));
    expect(await page.locator('.item-slot .item-art').count()).toBe(6);
    expect(await page.locator('#inventory-panel').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('distressed-panel.png');
    await page.locator('#select-med').click();
    await expect(page.locator('#detail-med')).toBeVisible();
    await page.locator('#equipment-tab').click();
    await expect(page.locator('#equipment-details')).toBeVisible();
    await page.locator('#supplies-tab').click();
    await page.locator('#select-ammo').click();
    await page.locator('#discard-ammo').click();
    await expect(page.locator('#item-ammo')).toHaveText('67');
    await page.locator('#inventory-panel footer').scrollIntoViewIfNeeded();
    await expect(page.locator('#inventory-panel footer')).toBeInViewport();
    await page.locator('#inventory-panel').evaluate(el => el.scrollTop = 0);
    const snapshot = await state(page);
    layouts.push({width, height, panel: await page.locator('#inventory-panel').boundingBox(), render: snapshot.render, calls: snapshot.calls, triangles: snapshot.triangles});
    await page.screenshot({animations: 'disabled', path: `${evidence}/inventory-${width}.png`});
    await page.locator('#inventory-close').click();
    await recapture(page);
    await expect(page.locator('#ammo')).toBeInViewport();
    await expect(page.locator('#health')).toBeInViewport();
    await page.screenshot({animations: 'disabled', path: `${evidence}/gameplay-${width}.png`});
  }
  expect(errors).toEqual([]);
  await writeFile(`${evidence}/quality-responsiveness.json`, JSON.stringify({renderer, qualities, layouts, unrelatedSettingTextureDisposals, errors}, null, 2));
});

test('Phase 11: interior, night, flashlight, combat, HUD and pause regression', async ({page}) => {
  const errors = await start(page);
  await page.locator('#start').click();
  await recapture(page);
  await setScene(page, 'day', 112, -105);
  await page.waitForTimeout(1500);
  const interiorDay = await state(page);
  await page.screenshot({animations: 'disabled', path: `${evidence}/interior-day.png`});
  await setScene(page, 'night', 112, -105);
  await page.waitForTimeout(1500);
  await expect.poll(async () => (await state(page)).phase).toBe('night');
  await page.screenshot({animations: 'disabled', path: `${evidence}/interior-night.png`});
  expect((await state(page)).flashlight).toBe(false);
  await page.keyboard.press('f');
  await expect.poll(async () => (await state(page)).flashlight).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({animations: 'disabled', path: `${evidence}/interior-flashlight.png`});
  await page.keyboard.press('m');
  await expect(page.locator('#map-screen')).toBeVisible();
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await page.keyboard.press('m');
  await recapture(page);
  await page.keyboard.press('f');
  await expect.poll(async () => (await state(page)).flashlight).toBe(false);

  // The same hospital portal interaction used by the established FPS regression.
  await setScene(page, 'day', 112, -97);
  await page.evaluate(() => (window as any).__LAST_NIGHT__.setLook(Math.PI, 0));
  await expect(page.locator('#interaction')).toContainText('ABRIR PORTA');
  await page.keyboard.press('e');
  await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().portals.find((p: any) => p.id === 'hospital-main-front').state === 'open');
  await page.keyboard.down('w');
  try {await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().player.z < -100);} finally {await page.keyboard.up('w');}

  await setScene(page, 'day');
  await page.evaluate(() => {
    const game = (window as any).__LAST_NIGHT__;
    game.setAmmo(12);
    game.setInventory({ammo: 79, med: 1});
    game.setLook(Math.PI, .032);
    game.spawn(88, -35);
  });
  const before = await state(page);
  // Headless Chromium emits cursor-warp compensation events: match the existing
  // FPS suite's relative pointer dispatch while preserving real Pointer Lock.
  await page.evaluate(() => document.querySelector('#game')!.dispatchEvent(new PointerEvent('pointerdown', {button: 0, bubbles: true})));
  try {
    await expect.poll(async () => (await state(page)).stats.headshots).toBeGreaterThan(before.stats.headshots);
  } finally {await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', {button: 0, bubbles: true})));}
  await expect(page.locator('#ammo')).toHaveText('11');
  await page.screenshot({animations: 'disabled', path: `${evidence}/combat-impact.png`});
  await page.keyboard.press('r');
  await expect.poll(async () => (await state(page)).reloadTimer).toBeGreaterThan(0);
  await page.waitForFunction(() => (window as any).__LAST_NIGHT__.state().ammo === 12);
  await expect(page.locator('#ammo')).toHaveText('12');
  await page.evaluate(() => {const game = (window as any).__LAST_NIGHT__; game.clearWalkers(); game.setHealth(20);});
  await expect(page.locator('#health')).toHaveText('20');
  await page.screenshot({animations: 'disabled', path: `${evidence}/contextual-low-health.png`});
  await page.keyboard.press('h');
  await expect.poll(async () => (await state(page)).player.hp).toBeGreaterThan(20);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-screen')).toBeVisible();
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await page.screenshot({animations: 'disabled', path: `${evidence}/pause.png`});
  await page.locator('#resume').click();
  await recapture(page);
  const after = await state(page);
  expect(errors).toEqual([]);
  await writeFile(`${evidence}/solo-gameplay.json`, JSON.stringify({quality: 'high', viewport: {width: 1600, height: 900}, interiorDay: interiorDay.render, headshotsBefore: before.stats.headshots, headshotsAfter: after.stats.headshots, ammoAfterReload: after.ammo, healthAfterBandage: after.player.hp, pointerLocked: after.camera.pointerLocked, render: after.render, errors}, null, 2));
});
