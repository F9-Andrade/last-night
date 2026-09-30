import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('production build: two LAN players start, shoot, use inventory and continue after host leaves without Photon',async({browser})=>{
 const contexts=await Promise.all([browser.newContext(),browser.newContext()]),pages=await Promise.all(contexts.map(c=>c.newPage()));const errors:string[]=[],sockets:string[]=[];
 try{
 for(const [i,p] of pages.entries()){
  p.on('pageerror',e=>errors.push(e.message));p.on('websocket',w=>sockets.push(w.url()));await p.addInitScript(()=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'medium',master:0}));window.addEventListener('mousemove',e=>{if(document.pointerLockElement)e.stopImmediatePropagation();},true);});
  await p.goto('/?coop=lan');await expect(p.locator('#coop-online')).toBeEnabled({timeout:90000});await p.locator('#coop-online').click();await expect(p.locator('#coop-transport')).toHaveValue('lan');await expect(p.locator('#coop-create')).toBeEnabled();await p.locator('#coop-name').fill(`LAN Player ${i+1}`);
 }
 const [a,b]=pages;await a.locator('#coop-create').click();await expect(a.locator('#coop-lobby')).toBeVisible();const code=await a.locator('#coop-room-code').innerText();await b.locator('#coop-code-input').fill(code);await b.locator('#coop-join').click();await expect(b.locator('#coop-lobby')).toBeVisible();await b.locator('#coop-ready').click();await expect(a.locator('#coop-start')).toBeEnabled();await a.locator('#coop-start').click();
 for(const p of pages){await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});await expect(p.locator('#coop-team')).toContainText('2/4');await expect(p.locator('#coop-health')).toContainText('LAN Player 1');await expect(p.locator('#coop-health')).toContainText('LAN Player 2');}
 async function capture(p:typeof a){if(await p.locator('#resume').isVisible())await p.locator('#resume').click();if(await p.locator('#capture-mouse').isVisible())await p.locator('#capture-mouse').click();await expect.poll(()=>p.evaluate(()=>!!document.pointerLockElement)).toBe(true);}
 await capture(a);await a.mouse.down({button:'right'});await a.mouse.down();await a.mouse.up();await a.mouse.up({button:'right'});await expect(a.locator('#ammo')).toHaveText('11');await a.keyboard.press('Tab');await expect(a.locator('#inventory-panel')).toBeVisible();await a.locator('#craft-tab').click();await expect(a.locator('#craft-details [data-craft]')).toHaveCount(1);await a.keyboard.press('Tab');
 await capture(a);await a.keyboard.press('Escape');await a.locator('#pause-menu').click();await expect(b.locator('#coop-team')).toContainText('1/4');await capture(b);await b.mouse.down();await b.mouse.up();await expect(b.locator('#ammo')).toHaveText('11');
 await mkdir('docs/optimization-lan',{recursive:true});await b.screenshot({path:'docs/optimization-lan/lan-migration.png'});expect(errors).toEqual([]);expect(sockets.length).toBe(2);expect(sockets.every(url=>url===(process.env.LAN_TEST_URL??'http://127.0.0.1:8787').replace('http','ws')+'/lan')).toBe(true);await writeFile('docs/optimization-lan/lan-browser.json',JSON.stringify({errors,sockets,players:2,hostMigration:true,production:true,secureContext:await b.evaluate(()=>isSecureContext)},null,2));
 }finally{for(const c of contexts)await c.close();}
});
