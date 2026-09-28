import {test,expect,type Page} from '@playwright/test';

test('production bundle: loading screen, solo and real Photon room',async({browser})=>{
  const pages:Page[]=[],errors:string[]=[];
  try{
    for(const name of ['Validação A','Validação B']){
      const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();pages.push(page);
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(name=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',shadows:false,master:0}));localStorage.setItem('last-night-player-name',name);},name);
      await page.goto('/');await expect(page.locator('#loading-screen')).toBeHidden({timeout:60000});
      expect(await page.evaluate(()=>Object.hasOwn(window,'__LAST_NIGHT__'))).toBe(false);
    }
    const [a,b]=pages;
    await a.locator('#start').click();await expect(a.locator('#loading-screen')).toBeHidden({timeout:60000});
    await a.waitForFunction(()=>!!document.pointerLockElement);await a.keyboard.press('Tab');
    await expect(a.locator('#inventory-panel')).toBeVisible();await a.keyboard.press('Tab');await a.keyboard.press('Escape');
    await expect(a.locator('#pause-screen')).toBeVisible();await a.locator('#pause-menu').click();
    for(const page of pages){await page.locator('#coop-online').click();await expect(page.locator('#coop-create')).toBeEnabled({timeout:60000});}
    await a.locator('#coop-create').click();await expect(a.locator('#coop-lobby')).toBeVisible();
    const code=await a.locator('#coop-room-code').innerText();
    await b.locator('#coop-code-input').fill(code);await b.locator('#coop-join').click();await expect(b.locator('#coop-lobby')).toBeVisible();
    await b.locator('#coop-ready').click();await expect(a.locator('#coop-start')).toBeEnabled();await a.locator('#coop-start').click();
    for(const page of pages){
      await expect(page.locator('#loading-screen')).toBeHidden({timeout:60000});
      await expect(page.locator('#coop-panel')).toBeHidden();await expect(page.locator('#coop-team')).toContainText('2/4');
    }
    expect(errors).toEqual([]);
  }finally{for(const page of pages)await page.context().close();}
});
