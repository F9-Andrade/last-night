import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const state=(p:Page)=>p.evaluate(()=>(window as any).__LAST_NIGHT__.state());
async function capture(p:Page){await p.bringToFront();if((await state(p)).paused)await p.locator('#resume').press('Enter');else if(!(await state(p)).camera.pointerLocked)await p.locator('#capture-mouse').press('Enter');await expect.poll(async()=>(await state(p)).camera.pointerLocked).toBe(true);}
test('website LAN: preserve expedition, late join, gameplay, independent Photon and host migration',async({browser})=>{
 const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);const pages=await Promise.all(contexts.map(c=>c.newPage()));const errors:string[]=[],sockets:string[]=[];
 try{
 for(const [i,p] of pages.entries()){
  p.on('pageerror',e=>errors.push(e.message));p.on('websocket',w=>sockets.push(w.url()));
  await p.addInitScript(i=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',master:0}));localStorage.setItem('last-night-player-name',`LAN ${i+1}`);window.addEventListener('mousemove',e=>{if(document.pointerLockElement)e.stopImmediatePropagation();},true);},i);
  await p.goto('/?test&coop=lan');await expect(p.locator('#start')).toBeEnabled({timeout:90000});
 }
 const [a,b,c]=pages;
 await a.locator('#coop-online').click();await expect(a.locator('#coop-create')).toBeEnabled({timeout:45000});await a.locator('#coop-create').click();await expect(a.locator('#loading-screen')).toBeHidden({timeout:90000});
 await a.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPlayer(1,12);g.setLook(0,0);g.setInventory({chest:1,wood:9,scrap:7});});
 await a.keyboard.press('Tab');await a.locator('#place-chest').click();await a.mouse.click(450,400);await expect.poll(async()=>(await state(a)).crafting.chests.length).toBe(1);
 const before=await state(a);await a.keyboard.press('Escape');await a.locator('#pause-lan').click();await expect(a.locator('#pause-lan-code')).toBeVisible({timeout:45000});const code=await a.locator('#pause-lan-code').inputValue();expect(code).toMatch(/^L-[A-F0-9]{10}$/);
 const after=await state(a);expect(after.runSeed).toBe(before.runSeed);expect(after.inventory).toEqual(before.inventory);expect(after.crafting.chests).toEqual(before.crafting.chests);expect(after.player.x).toBe(before.player.x);expect(after.player.z).toBe(before.player.z);
 for(const p of [b,c]){await p.locator('#coop-online').click();await expect(p.locator('#coop-join')).toBeEnabled({timeout:45000});await p.locator('#coop-code-input').fill(code);await p.locator('#coop-join').click();await expect.poll(async()=>(await state(p)).network.state,{timeout:90000}).toBe('playing');await expect.poll(async()=>(await state(p)).crafting.chests.length,{timeout:10000}).toBe(1);}
 for(const p of pages)await expect.poll(async()=>(await state(p)).network.players.length).toBe(3);
 await a.evaluate(()=>{const g=(window as any).__LAST_NIGHT__,w=g.coopFixture();w.sim.zombies=[];w.sim.spawnTimer=10000;for(const a of w.actors.values())a.sim.player.invulnerable=100;});
 await capture(b);const ammo=(await state(b)).ammo;await b.mouse.down({button:'right'});await b.mouse.click(450,400);await b.mouse.up({button:'right'});await expect.poll(async()=>(await state(b)).ammo).toBe(ammo-1);
 await b.keyboard.press('Tab');await expect(b.locator('#inventory-panel')).toBeVisible();await b.keyboard.press('Tab');
 // Let the independent B↔C channel establish before the original host exits.
 await expect.poll(async()=>{await c.bringToFront();return (await state(c)).network.remotes.some((r:any)=>r.identity.displayName==='LAN 2'&&r.snapshot);},{timeout:15000}).toBe(true);
 await a.bringToFront();await a.locator('#pause-menu').click();
 for(const p of [b,c]){await expect.poll(async()=>(await state(p)).network.players.length,{timeout:15000}).toBe(2);await expect.poll(async()=>(await state(p)).coop.migrations,{timeout:15000}).toBe(1);expect((await state(p)).crafting.chests).toEqual(before.crafting.chests);}
 await capture(c);const remaining=(await state(c)).ammo;await c.mouse.click(450,400);await expect.poll(async()=>(await state(c)).ammo).toBe(remaining-1);
 await b.bringToFront();await capture(b);await b.keyboard.press('Escape');await expect(b.locator('#pause-lan-code')).toBeVisible();expect(await b.locator('#pause-lan-code').inputValue()).not.toBe(code);
 expect(errors).toEqual([]);expect(sockets.length).toBeGreaterThan(0);expect(sockets.every(s=>!s.includes('photon'))).toBe(true);
 await mkdir('docs/browser-lan',{recursive:true});await b.screenshot({path:'docs/browser-lan/pause-lan.png'});await writeFile('docs/browser-lan/validation.json',JSON.stringify({errors,websocketHosts:sockets.map(s=>new URL(s).host),players:3,preservedChest:true,lateJoin:true,shooting:true,hostMigration:true,photonUsed:false},null,2));
 }finally{for(const context of contexts)await context.close();}
});

test('LAN protocol: four-player limit, large checkpoints, sender identity and signaling reconnection',async({browser})=>{
 const context=await browser.newContext(),pages=await Promise.all(Array.from({length:5},()=>context.newPage()));const errors:string[]=[];
 try{
 await Promise.all(pages.map(async(p,i)=>{p.on('pageerror',e=>errors.push(e.message));await p.goto('/tests/fixtures/lan-network.html');await p.waitForFunction(()=>!!(window as any).network);await p.evaluate(i=>(window as any).network.connect(`Transport ${i}`),i);await expect.poll(()=>p.evaluate(()=>(window as any).network.state),{timeout:45000}).toBe('connected');}));
 const [host,guest,third,fourth,extra]=pages;await host.evaluate(()=>(window as any).network.create());await expect.poll(()=>host.evaluate(()=>(window as any).network.state)).toBe('playing');const room=await host.evaluate(()=>(window as any).network.code);
 for(const p of [guest,third,fourth]){await p.evaluate(code=>(window as any).network.join(code),room);await expect.poll(()=>p.evaluate(()=>(window as any).network.state),{timeout:45000}).toBe('playing');}
 await extra.evaluate(code=>(window as any).network.join(code),room);await expect.poll(()=>extra.evaluate(()=>(window as any).network.message),{timeout:45000}).toContain('cheia');
 await host.evaluate(()=>{(window as any).network.sendGameplay(11,{payload:'x'.repeat(120000)});});
 for(const p of [guest,third,fourth])await expect.poll(()=>p.evaluate(()=>(window as any).received.some((m:any)=>m.actor===1&&m.data.payload?.length===120000))).toBe(true);
 await guest.evaluate(()=>{const n=(window as any).network;for(const l of n.lan.links.values())if(l.connection.open)l.connection.send({type:'event',code:10,data:{test:'identity'},actor:1});});
 await expect.poll(()=>host.evaluate(()=>(window as any).received.find((m:any)=>m.data.test==='identity')?.actor)).toBe(2);
 await guest.evaluate(()=>{const n=(window as any).network;for(const l of n.lan.links.values())if(l.connection.open)l.connection.send({type:'room',players:[{actorNumber:1,playerId:l.connection.peer}],seed:0,token:'invalid'});});
 await host.evaluate(()=>(window as any).network.lan.peer.disconnect());await expect.poll(()=>host.evaluate(()=>(window as any).network.message),{timeout:15000}).toContain('reconectada');expect(await host.evaluate(()=>(window as any).network.state)).toBe('playing');
 expect(errors).toEqual([]);
 }finally{await context.close();}
});
