import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const evidence='test-results/procedural';
const state=(page:Page)=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
async function capture(page:Page){
 await page.bringToFront();
 if((await state(page)).paused)await page.locator('#resume').click();
 if(!(await state(page)).camera.pointerLocked)await page.locator('#capture-mouse').click();
 await expect.poll(async()=>(await state(page)).camera.pointerLocked).toBe(true);
}
async function layout(page:Page){return page.evaluate(async()=>{
 const {worldLayoutSummary}=await import('/src/game/world-layout.ts');
 const {BUILDINGS,TREE_TRUNKS,URBAN}=await import('/src/game/world.ts');
 const {CITY_SITES,CITY_PORTALS}=await import('/src/game/city.ts');
 const {LOOT_POINTS}=await import('/src/game/loot.ts');
 return {summary:worldLayoutSummary(),geometry:{buildings:BUILDINGS,sites:CITY_SITES,trees:TREE_TRUNKS,urban:URBAN,portals:CITY_PORTALS,loot:LOOT_POINTS}};
});}

test('validated procedural city loads in solo and remains identical and interactive across real LAN peers',async({browser})=>{
 const contexts=await Promise.all([browser.newContext({viewport:{width:1366,height:768}}),browser.newContext({viewport:{width:1366,height:768}})]);
 const [host,guest]=await Promise.all(contexts.map(c=>c.newPage()));const errors:string[]=[],sockets:string[]=[];
 try{
  for(const [i,page] of [host,guest].entries()){
   page.on('pageerror',error=>errors.push(error.message));page.on('websocket',socket=>sockets.push(socket.url()));
   await page.addInitScript(index=>{
    localStorage.setItem('last-night-settings',JSON.stringify({quality:index?'low':'medium',master:0}));
    localStorage.setItem('last-night-player-name',`Procedural ${index+1}`);
    window.addEventListener('mousemove',event=>{if(document.pointerLockElement)event.stopImmediatePropagation();},true);
   },i);
   await page.goto('/?test&coop=lan&layout=2&seed=813');await expect(page.locator('#start')).toBeEnabled({timeout:90000});
  }
  await host.bringToFront();await host.locator('#start').click();await expect(host.locator('#loading-screen')).toBeHidden({timeout:90000});await capture(host);
  expect((await state(host)).layoutVersion).toBe(2);expect((await state(host)).runSeed).toBe(813);
  await host.evaluate(()=>{const g=(window as any).__LAST_NIGHT__,s=g.simulationFixture();g.clearWalkers();s.dormantZombies=[];s.spawnTimer=10000;s.player.invulnerable=90;g.setPhase('day',120);g.setPlayer(14,11);g.setLook(-1.3,-.06);});
  await mkdir(evidence,{recursive:true});await host.waitForTimeout(900);await host.screenshot({path:`${evidence}/junction-v2.png`});
  const facade=await host.evaluate(async()=>{
   const {CITY_SITES}=await import('/src/game/city.ts');const {collides,TREE_TRUNKS}=await import('/src/game/world.ts');
   const g=(window as any).__LAST_NIGHT__,site=CITY_SITES.find(s=>s.id==='church')!;
   const point={x:site.x,z:site.z+site.d/2+7};if(collides(point,.45,TREE_TRUNKS))throw new Error('Blocked facade viewpoint');
   g.setPlayer(point.x,point.z);g.setLook(Math.PI,.02);return {site:site.id,point};
  });
  await host.waitForTimeout(900);await host.screenshot({path:`${evidence}/facade-v2.png`});
  await host.keyboard.press('KeyM');await expect(host.locator('#map-screen')).toBeVisible();await host.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await host.screenshot({path:`${evidence}/map-v2.png`});await host.keyboard.press('KeyM');await capture(host);
  const solo=await layout(host);expect(solo.summary.version).toBe(2);
  await host.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPlayer(1,4);g.setLook(0,0);});
  await host.keyboard.press('Escape');await host.locator('#pause-lan').click();await expect(host.locator('#pause-lan-code')).toBeVisible({timeout:45000});const code=await host.locator('#pause-lan-code').inputValue();
  await guest.bringToFront();await guest.locator('#coop-online').click();await expect(guest.locator('#coop-join')).toBeEnabled({timeout:45000});await guest.locator('#coop-code-input').fill(code);await guest.locator('#coop-join').click();
  await expect.poll(async()=>(await state(guest)).network.state,{timeout:90000}).toBe('playing');await expect(guest.locator('#loading-screen')).toBeHidden({timeout:90000});
  for(const page of [host,guest])await expect.poll(async()=>(await state(page)).network.players.length).toBe(2);
  const replicas=await Promise.all([layout(host),layout(guest)]);expect(replicas[0].geometry).toEqual(solo.geometry);expect(replicas[1].geometry).toEqual(solo.geometry);expect(replicas[1].summary.version).toBe(2);expect((await state(guest)).runSeed).toBe(813);
  const fixtureValid=await host.evaluate(async()=>{
   const w=(window as any).__LAST_NIGHT__.coopFixture();w.sim.zombies=[];w.sim.dormantZombies=[];w.sim.spawnTimer=10000;
   for(const actor of w.actors.values()){actor.sim.coins=100;actor.sim.player.invulnerable=90;}
   const {parseCheckpoint}=await import('/src/network/checkpoint.ts');return !!parseCheckpoint(w.checkpoint());
  });expect(fixtureValid).toBe(true);await expect.poll(async()=>(await state(guest)).coins).toBe(100);await capture(guest);
  await guest.evaluate(()=>{const g=(window as any).__LAST_NIGHT__,s=g.simulationFixture(),m=s.economy.merchants[0];const x=m.x+Math.sin(m.angle)*2.4,z=m.z+Math.cos(m.angle)*2.4;g.setPlayer(x,z);s.player.eyeY=m.y+1.65;g.setLook(Math.atan2(m.x-x,m.z-z),-.08);});
  await guest.waitForTimeout(350);await guest.keyboard.press('KeyE');await expect(guest.locator('#trade-screen')).toBeVisible();await guest.locator('[data-trade-row="water"]').click();const before=await state(guest);
  await guest.locator('#trade-confirm').click();await expect.poll(async()=>(await state(guest)).coins).toBe(84);await expect.poll(async()=>(await state(guest)).inventory.water).toBe(before.inventory.water+1);
  await expect.poll(async()=>(await state(host)).economy.merchants[0].stock.water).toBe(before.economy.merchants[0].stock.water-1);expect((await state(host)).coins).toBe(100);
  await guest.screenshot({path:`${evidence}/lan-trade-v2.png`});expect(errors).toEqual([]);expect(sockets.some(url=>url.includes('photon'))).toBe(false);
  await writeFile(`${evidence}/validation.json`,JSON.stringify({seed:813,version:2,players:2,errors,facade,summary:solo.summary,websocketHosts:sockets.map(url=>new URL(url).host),checks:['solo v2 shader loading completes','junction facade and map captured','solo to LAN preserves all static geometry','real WebRTC peer reconstructs identical buildings trees portals and loot','guest trades with E and host confirms inventory wallet and stock']},null,2));
 }finally{for(const context of contexts)await context.close();}
});
