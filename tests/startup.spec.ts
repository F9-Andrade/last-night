import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

test('GPU readiness gates menu and invites without advancing the simulation',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',shadows:false,master:0}));
    const probe={hold:true,polled:false};(window as any).__gpuReadyProbe=probe;
    const wait=WebGL2RenderingContext.prototype.clientWaitSync;
    WebGL2RenderingContext.prototype.clientWaitSync=function(...args){
      probe.polled=true;
      return probe.hold?this.TIMEOUT_EXPIRED:wait.apply(this,args);
    };
  });
  await page.goto('/?test&room=ABC123',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>(window as any).__gpuReadyProbe.polled);
  await expect(page.locator('#loading-screen')).toBeVisible();
  await expect(page.locator('#menu')).toHaveAttribute('aria-busy','true');
  expect(await page.locator('#menu').evaluate(el=>el.inert)).toBe(true);
  await expect(page.locator('#start')).toBeDisabled();
  await expect(page.locator('#coop-online')).toBeDisabled();
  await expect(page.locator('#coop-panel')).toBeHidden();
  expect(await page.evaluate(()=>(window as any).__LAST_NIGHT__.state().stats.seconds)).toBe(0);
  await page.evaluate(()=>(window as any).__gpuReadyProbe.hold=false);
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#loading-screen')).toBeHidden();
  await expect(page.locator('#coop-panel')).toBeVisible();
  await expect(page.locator('#coop-code-input')).toHaveValue('ABC123');
  await page.locator('#coop-close').click();
  expect(await page.locator('#menu').evaluate(el=>el.inert)).toBe(false);
  await page.locator('#menu-settings').click();
  await expect(page.locator('#settings-screen')).toBeVisible();
});

test('solo shows loading, blocks gameplay and prepares the current graphics settings',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',shadows:false,master:0}));
    const probe={hold:false,polled:false};(window as any).__gpuReadyProbe=probe;
    const wait=WebGL2RenderingContext.prototype.clientWaitSync;
    WebGL2RenderingContext.prototype.clientWaitSync=function(...args){probe.polled=true;return probe.hold?this.TIMEOUT_EXPIRED:wait.apply(this,args);};
  });
  await page.goto('/?test');await expect(page.locator('#loading-screen')).toBeHidden({timeout:60000});
  await page.locator('#menu-settings').click();await page.locator('#setting-quality').selectOption('high');
  await page.locator('#setting-shadows').check();await page.locator('#settings-close').click();
  await page.evaluate(()=>Object.assign((window as any).__gpuReadyProbe,{hold:true,polled:false}));
  await page.locator('#start').click();await page.waitForFunction(()=>(window as any).__gpuReadyProbe.polled);
  await expect(page.locator('#loading-screen')).toBeVisible();
  await page.keyboard.press('Tab');await page.keyboard.press('r');
  await mkdir('test-results/loading',{recursive:true});await page.screenshot({path:'test-results/loading/solo.png'});
  const pending=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
  expect(pending.stats.seconds).toBe(0);expect(pending.inventoryOpen).toBe(false);expect(pending.reloadTimer).toBe(0);
  await page.evaluate(()=>(window as any).__gpuReadyProbe.hold=false);
  await expect(page.locator('#loading-screen')).toBeHidden({timeout:60000});
  const ready=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
  expect(ready.settings.quality).toBe('high');expect(ready.render.visual.ao).toBe('GTAO');expect(ready.render.visual.bloom).toBe(true);
  await expect.poll(()=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state().stats.seconds)).toBeGreaterThan(0);
});

for(const quality of ['low','high'] as const)test(`cold startup prepares ${quality} graphics before gameplay`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:1920,height:1080});
  await page.addInitScript(quality=>{
    localStorage.setItem('last-night-settings',JSON.stringify({quality,shadows:quality!=='low',master:0}));
    const probe={compiled:0,afterStart:0,started:0,frames:[] as number[]};(window as any).__startupProbe=probe;
    const compile=WebGL2RenderingContext.prototype.compileShader;
    WebGL2RenderingContext.prototype.compileShader=function(shader){probe.compiled++;if(probe.started)probe.afterStart++;return compile.call(this,shader);};
    const raf=window.requestAnimationFrame;
    window.requestAnimationFrame=function(callback){return raf.call(window,time=>{callback(time);if(probe.started&&callback.name==='frame')probe.frames.push(time);});};
    new MutationObserver(()=>{
      if(!probe.started&&document.getElementById('app')?.classList.contains('playing')&&document.getElementById('loading-screen')?.hidden)probe.started=performance.now();
    }).observe(document,{subtree:true,attributes:true,attributeFilter:['hidden','class']});
  },quality);
  await page.goto('/?test',{waitUntil:'domcontentloaded'});
  // Click as soon as the game releases the button: no artificial settling period.
  await expect(page.locator('#start')).toBeEnabled({timeout:60000});
  await expect(page.locator('#menu')).not.toHaveAttribute('aria-busy','true');
  const ready=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
  expect(ready.time).toBe(0);expect(ready.stats.seconds).toBe(0);
  await page.locator('#start').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  await expect(page.locator('#loading-screen')).toBeHidden({timeout:60000});
  await page.waitForTimeout(3000);
  const probe=await page.evaluate(()=>(window as any).__startupProbe);
  // Shader work must finish before the first-person view becomes playable.
  expect(probe.compiled).toBeGreaterThan(0);expect(probe.afterStart).toBe(0);
  const current=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
  const gpu=await page.evaluate(()=>{
    const gl=document.querySelector<HTMLCanvasElement>('#game')!.getContext('webgl2')!,info=gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixelRatio:devicePixelRatio};
  });
  expect(current.settings.quality).toBe(quality);expect(current.render.visual.ao).toBe(quality==='high'?'GTAO':'off');
  expect(current.render.visual.bloom).toBe(quality==='high');expect(current.player.hp).toBe(100);
  expect(current.audio.samplesLoaded).toHaveLength(6);
  await page.keyboard.press('Tab');await expect(page.locator('#inventory-panel')).toBeVisible();
  await page.keyboard.press('Tab');await page.waitForFunction(()=>!!document.pointerLockElement);
  await page.keyboard.press('Escape');await expect(page.locator('#pause-screen')).toBeVisible();
  await page.locator('#resume').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  expect(errors).toEqual([]);
  const frames:number[]=probe.frames,seconds=[0,1,2].map(second=>({second,frames:frames.filter(t=>t>=probe.started+second*1000&&t<probe.started+(second+1)*1000).length}));
  await mkdir('docs/startup',{recursive:true});
  await writeFile(`docs/startup/${quality}.json`,JSON.stringify({quality,viewport:'1920x1080',...gpu,seconds,shaderCompilesBeforeStart:probe.compiled,shaderCompilesAfterStart:probe.afterStart,visual:current.render.visual,errors},null,2));
});
