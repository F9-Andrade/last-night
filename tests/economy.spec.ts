import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const state=(page:Page)=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
async function start(page:Page){
 await page.addInitScript(()=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'medium',master:0}));window.addEventListener('mousemove',e=>{if(document.pointerLockElement)e.stopImmediatePropagation();},true);});
 await page.goto('/?test');await expect(page.locator('#start')).toBeEnabled({timeout:90000});await page.locator('#start').click();await expect(page.locator('#loading-screen')).toBeHidden({timeout:90000});
 await expect.poll(async()=>(await state(page)).camera.pointerLocked).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__,s=g.simulationFixture();g.clearWalkers();s.dormantZombies=[];s.baseHP=1000;g.setPhase('day',0);s.player.invulnerable=999;s.coins=1500;s.inventory.items={...Object.fromEntries(Object.keys(s.inventory.items).map(k=>[k,0])),scrap:6};});
}
async function openTrader(page:Page,index=0){
 await page.evaluate(index=>{const g=(window as any).__LAST_NIGHT__,s=g.simulationFixture(),m=s.economy.merchants[index];const x=m.x+Math.sin(m.angle)*2.4,z=m.z+Math.cos(m.angle)*2.4;g.setPlayer(x,z);s.player.eyeY=m.y+1.65;g.setLook(Math.atan2(m.x-x,m.z-z),-.08);g.clearWalkers();},index);
 await page.waitForTimeout(250);await page.keyboard.press('KeyE');await expect(page.locator('#trade-screen')).toBeVisible();
}
async function capture(page:Page){if(!(await state(page)).camera.pointerLocked)await page.locator('#capture-mouse').click();}

test('merchants buy and sell through stable responsive controls without losing items; K checks the actual night clock',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);await openTrader(page);
 await expect(page.locator('#trade-name')).toHaveText('Rute');await expect(page.locator('#trade-balance')).toHaveText('1.500');
 await mkdir('test-results/economy',{recursive:true});const responsive=[];
 for(const viewport of [{width:1366,height:768},{width:1920,height:1080},{width:960,height:640}]){
  await page.setViewportSize(viewport);const box=(await page.locator('.trade-window').boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);await expect(page.locator('#trade-close')).toBeInViewport();await expect(page.locator('#trade-confirm')).toBeInViewport();await page.screenshot({path:`test-results/economy/shop-${viewport.width}x${viewport.height}.png`});responsive.push({viewport,box});
 }
 await page.setViewportSize({width:1366,height:768});
 const row=page.locator('[data-trade-row="water"]');await row.evaluate(el=>{(window as any).__tradeWater=el;});
 const box=(await row.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.evaluate(()=>{(window as any).__LAST_NIGHT__.simulationFixture().coins+=1;});await page.waitForTimeout(300);expect(await row.evaluate(el=>el===(window as any).__tradeWater)).toBe(true);await page.mouse.up();
 await expect(page.locator('#trade-item-name')).toHaveText('Água lacrada');const before=await state(page);await page.locator('#trade-confirm').click();await expect.poll(async()=>(await state(page)).inventory.water).toBe(1);const bought=await state(page);expect(bought.coins).toBe(before.coins-16);expect(bought.economy.merchants[0].stock.water).toBe(before.economy.merchants[0].stock.water-1);
 await page.locator('#trade-sell').click();await page.locator('[data-trade-row="scrap"]').click();await page.locator('#trade-amount').fill('3');await page.locator('#trade-confirm').click();await expect.poll(async()=>(await state(page)).inventory.scrap).toBe(3);expect((await state(page)).coins).toBe(bought.coins+6);
 // A complete full-bag purchase is rejected before any currency or stock is spent.
 await page.evaluate(()=>{const s=(window as any).__LAST_NIGHT__.simulationFixture();for(const k of Object.keys(s.inventory.items))s.inventory.items[k]=0;s.inventory.items.med=16;});
 await page.locator('#trade-buy').click();await page.locator('[data-trade-row="water"]').click();await expect(page.locator('#trade-confirm')).toBeDisabled();await expect(page.locator('#trade-reason')).toContainText('Mochila sem espaço');const rejected=await state(page);await page.waitForTimeout(350);expect((await state(page)).coins).toBe(rejected.coins);expect((await state(page)).economy.merchants[0].stock.water).toBe(rejected.economy.merchants[0].stock.water);
 await page.keyboard.press('Escape');await expect(page.locator('#trade-screen')).toBeHidden();await capture(page);
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPlayer(1,4);g.setPhase('day',0);});await page.keyboard.press('KeyK');await expect(page.locator('#field-watch')).toBeVisible();await expect(page.locator('.watch-label')).toHaveText('Anoitecer em');await expect(page.locator('.watch-time')).toHaveText(/^(10:00|09:5\d)$/);expect((await state(page)).paused).toBe(false);expect((await state(page)).camera.pointerLocked).toBe(true);
 await page.keyboard.press('KeyK');await expect(page.locator('#field-watch')).toBeHidden();
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('night',0);g.finishSpawning();});await page.keyboard.press('KeyK');await expect(page.locator('.watch-label')).toHaveText('Amanhecer em');await expect(page.locator('.watch-time')).toHaveText(/^(10:00|09:5\d)$/);await page.locator('#field-watch').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));});await page.screenshot({path:'test-results/economy/night-watch.png'});await page.waitForTimeout(500);expect((await state(page)).phase).toBe('night');
 await page.keyboard.press('KeyK');await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPhase('day',0);g.clearWalkers();g.setInventory({med:0});});await openTrader(page,2);await page.locator('[data-trade-row="quiet-pistol"]').click();const gunBefore=await state(page);await page.locator('#trade-confirm').click();await expect.poll(async()=>(await state(page)).groundWeapons.some((g:any)=>g.source.includes('Vigia'))).toBe(true);const gunAfter=await state(page),gun=gunAfter.groundWeapons.find((g:any)=>g.source.includes('Vigia'));expect(gun.item.affix).toBe('quiet');expect(gun.item.magazine).toBe(0);expect(gunAfter.loadout).toEqual(gunBefore.loadout);expect(gunAfter.coins).toBe(gunBefore.coins-240);
 expect(errors).toEqual([]);await writeFile('test-results/economy/validation.json',JSON.stringify({errors,responsive,checks:['merchant interaction with E','stable rows during pointer clicks','buy and sell exact quantities','full backpack rejects without loss','modified gun delivered unloaded without replacing equipped weapon','K watch reflects ten-minute phases without pausing','cleared wave does not end night']},null,2));
});

test('real LAN peers share seeded city, merchant stock and authoritative wallet transactions',async({browser})=>{
 const contexts=await Promise.all([browser.newContext(),browser.newContext()]),pages=await Promise.all(contexts.map(c=>c.newPage())),errors:string[]=[],sockets:string[]=[];
 try{
  for(const [index,page] of pages.entries()){
   page.on('pageerror',error=>errors.push(error.message));page.on('websocket',socket=>sockets.push(socket.url()));
   await page.addInitScript(index=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',master:0}));localStorage.setItem('last-night-player-name',`Troca LAN ${index+1}`);window.addEventListener('mousemove',e=>{if(document.pointerLockElement)e.stopImmediatePropagation();},true);},index);
   await page.goto('/?test&coop=lan&layout=1');await expect(page.locator('#start')).toBeEnabled({timeout:90000});
  }
  const [host,guest]=pages;await host.bringToFront();await host.locator('#coop-online').click();await expect(host.locator('#coop-create')).toBeEnabled({timeout:45000});await host.locator('#coop-create').click();await expect(host.locator('#loading-screen')).toBeHidden({timeout:90000});
  await host.keyboard.press('Escape');await host.locator('#pause-lan').click();await expect(host.locator('#pause-lan-code')).toBeVisible({timeout:45000});const code=await host.locator('#pause-lan-code').inputValue();
  await guest.bringToFront();await guest.locator('#coop-online').click();await expect(guest.locator('#coop-join')).toBeEnabled({timeout:45000});await guest.locator('#coop-code-input').fill(code);await guest.locator('#coop-join').click();await expect.poll(async()=>(await state(guest)).network.state,{timeout:90000}).toBe('playing');
  for(const page of pages)await expect.poll(async()=>(await state(page)).network.players.length).toBe(2);
  expect((await state(host)).runSeed).toBe((await state(guest)).runSeed);await expect.poll(async()=>JSON.stringify((await state(guest)).economy.merchants)).toBe(JSON.stringify((await state(host)).economy.merchants));
  const layout=await Promise.all(pages.map(page=>page.evaluate(async()=>{const {worldLayoutSummary}=await import('/src/game/world-layout.ts');const {BUILDINGS}=await import('/src/game/world.ts');const {CITY_SITES}=await import('/src/game/city.ts');return {summary:worldLayoutSummary(),buildings:BUILDINGS.map(b=>[b.x,b.z]),sites:CITY_SITES.map(s=>[s.id,s.x,s.z])};})));expect(layout[0].summary.version).toBe(1);expect(layout[0].summary.moved).toBeGreaterThan(0);expect(layout[0].buildings).toEqual(layout[1].buildings);expect(layout[0].sites).toEqual(layout[1].sites);
  const fixtureValid=await host.evaluate(async()=>{const g=(window as any).__LAST_NIGHT__,w=g.coopFixture();w.sim.zombies=[];w.sim.dormantZombies=[];w.sim.spawnTimer=10000;for(const actor of w.actors.values()){actor.sim.coins=100;actor.sim.player.invulnerable=90;actor.sim.inventory.items.scrap=3;}const {parseCheckpoint}=await import('/src/network/checkpoint.ts');return !!parseCheckpoint(w.checkpoint());});
  expect(fixtureValid,'The LAN fixture must satisfy the real checkpoint contract').toBe(true);
  await expect.poll(async()=>(await state(guest)).coins).toBe(100);await guest.bringToFront();await capture(guest);await openTrader(guest);
  await guest.locator('[data-trade-row="water"]').click();await expect(guest.locator('#trade-confirm')).toBeEnabled();const before=await state(guest);await guest.locator('#trade-confirm').click();await expect.poll(async()=>(await state(guest)).coins).toBe(84);await expect.poll(async()=>(await state(guest)).inventory.water).toBe(before.inventory.water+1);
  await expect.poll(async()=>(await state(host)).economy.merchants[0].stock.water).toBe(before.economy.merchants[0].stock.water-1);expect((await state(host)).coins).toBe(100);
  await guest.locator('#trade-sell').click();await guest.locator('[data-trade-row="scrap"]').click();await guest.locator('#trade-amount').fill('2');await guest.locator('#trade-confirm').click();await expect.poll(async()=>(await state(guest)).coins).toBe(88);await expect.poll(async()=>(await state(guest)).inventory.scrap).toBe(1);
  await expect.poll(async()=>JSON.stringify((await state(host)).economy)).toBe(JSON.stringify((await state(guest)).economy));expect(errors).toEqual([]);expect(sockets.some(url=>url.includes('photon'))).toBe(false);
  await mkdir('test-results/economy',{recursive:true});await guest.screenshot({path:'test-results/economy/lan-trade.png'});await writeFile('test-results/economy/lan-validation.json',JSON.stringify({errors,websocketHosts:sockets.map(url=>new URL(url).host),players:2,seed:(await state(host)).runSeed,layout:layout[0].summary,checks:['actual WebRTC DataChannel transport','same randomized building positions on both clients','same merchant positions and stocks','guest spends only own wallet','guest inventory and stock updated by host','sales replicated without Photon']},null,2));
 }finally{for(const context of contexts)await context.close();}
});
