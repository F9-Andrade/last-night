import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('Photon waits for both clients to finish loading before starting the world',async({browser})=>{
  const pages:Page[]=[],errors:string[]=[];
  try{
    for(const name of ['Carga A','Carga B']){
      const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();pages.push(page);
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(name=>{
        localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',shadows:false,master:0}));
        localStorage.setItem('last-night-player-name',name);
        const probe={hold:false,polled:false};(window as any).__gpuReadyProbe=probe;
        const wait=WebGL2RenderingContext.prototype.clientWaitSync;
        WebGL2RenderingContext.prototype.clientWaitSync=function(...args){probe.polled=true;return probe.hold?this.TIMEOUT_EXPIRED:wait.apply(this,args);};
      },name);
      await page.goto('/?test');await page.locator('#coop-online').click();
      await expect(page.locator('#coop-create')).toBeEnabled({timeout:60000});
    }
    const [a,b]=pages;
    await a.locator('#coop-create').click();await expect(a.locator('#coop-lobby')).toBeVisible();
    await b.locator('#coop-code-input').fill(await a.locator('#coop-room-code').innerText());
    await b.locator('#coop-join').click();await expect(b.locator('#coop-lobby')).toBeVisible();
    await b.locator('#coop-ready').click();await expect(a.locator('#coop-start')).toBeEnabled();
    await b.evaluate(()=>Object.assign((window as any).__gpuReadyProbe,{hold:true,polled:false}));
    await a.locator('#coop-start').click();
    await b.waitForFunction(()=>(window as any).__gpuReadyProbe.polled);
    await expect(a.locator('#loading-status')).toHaveText('Aguardando os outros sobreviventes…');
    await mkdir('test-results/loading',{recursive:true});
    await b.screenshot({path:'test-results/loading/coop-waiting.png'});
    for(const page of pages){
      await expect(page.locator('#loading-screen')).toBeVisible();
      const state=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
      expect(state.network.state).toBe('loading');expect(state.stats.seconds).toBe(0);expect(state.player.hp).toBe(100);
    }
    await b.evaluate(()=>(window as any).__gpuReadyProbe.hold=false);
    for(const page of pages){
      await expect(page.locator('#loading-screen')).toBeHidden({timeout:60000});
      await expect.poll(()=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state().network.state)).toBe('playing');
      await expect.poll(()=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state().coop?.revision??0)).toBeGreaterThan(0);
    }
    expect(errors).toEqual([]);
  }finally{for(const page of pages)await page.context().close();}
});
