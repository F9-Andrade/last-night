import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {FOODS} from '../src/game/nutrition';

const evidence='test-results/field-books';
const state=(page:Page)=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
async function prepare(page:Page,name='Leitor',lan=false){
  await page.addInitScript(name=>{
    localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',master:0}));
    localStorage.setItem('last-night-player-name',name);
    window.addEventListener('mousemove',event=>{if(document.pointerLockElement)event.stopImmediatePropagation();},true);
  },name);
  await page.goto(lan?'/?test&coop=lan':'/?test');
  await expect(page.locator('#start')).toBeEnabled({timeout:90000});
}
async function capture(page:Page){
  await page.bringToFront();
  if((await state(page)).paused)await page.locator('#resume').click();
  if(!(await state(page)).camera.pointerLocked)await page.locator('#capture-mouse').click();
  await expect.poll(async()=>(await state(page)).camera.pointerLocked).toBe(true);
}
async function start(page:Page){
  await prepare(page);await page.locator('#start').click();
  await expect(page.locator('#loading-screen')).toBeHidden({timeout:90000});
  await capture(page);
  await page.evaluate(()=>{
    const game=(window as any).__LAST_NIGHT__,sim=game.simulationFixture();
    game.clearWalkers();sim.dormantZombies=[];sim.spawnTimer=10000;sim.player.invulnerable=999;
    game.setPhase('day',0);game.setPlayer(1,4);game.setLook(0,0);
  });
}
async function openBook(page:Page,key:'KeyK'|'KeyL',kind:'guide'|'encyclopedia'){
  await page.keyboard.press(key);
  await expect(page.locator('#field-books')).toBeVisible();
  await expect(page.locator('#field-books')).toHaveAttribute('data-kind',kind);
  await expect.poll(async()=>(await state(page)).camera.pointerLocked).toBe(false);
  await expect(page.locator('#pause-screen')).toBeHidden();
}
async function settledAnimation(page:Page){
  await page.locator('#field-books').evaluate(async element=>{
    await Promise.all(element.getAnimations({subtree:true}).filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));
  });
}

test('unknown encyclopedia records stay concealed until found and reward each discovery once',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);
  await expect.poll(async()=>(await state(page)).discoveries).toContain('weapon-pistol');
  expect((await state(page)).discoveries).not.toContain('food-water');
  await openBook(page,'KeyL','encyclopedia');
  const water=page.locator('[data-book-entry="food-water"]');
  await expect(water).toHaveAttribute('data-discovered','false');await expect(water).toContainText('???');
  await water.click();await expect(page.locator('#field-book-entry-title')).toHaveText('???');
  await expect(page.locator('#field-book-page')).toHaveAttribute('data-discovered','false');
  await expect(page.locator('#field-book-page')).not.toContainText(FOODS.water.label);
  await mkdir(evidence,{recursive:true});await settledAnimation(page);await page.screenshot({path:`${evidence}/encyclopedia-unknown.png`});
  await page.locator('#field-book-search').fill(FOODS.water.label);
  await expect(page.locator('.field-book-index-entry')).toHaveCount(0);
  await expect(page.locator('#field-book-page')).not.toContainText(FOODS.water.label);
  // Reading a hidden record or searching for its exact name cannot discover it.
  expect((await state(page)).discoveries).not.toContain('food-water');
  await page.keyboard.press('Escape');await capture(page);
  await page.evaluate(()=>{(window as any).__LAST_NIGHT__.setInventory({water:1});});
  await expect.poll(async()=>(await state(page)).discoveries).toContain('food-water');
  const toast=page.locator('#discovery-toast');
  await expect(toast).toBeVisible();await expect(toast).toHaveAttribute('data-entry','food-water');
  await expect(page.locator('#discovery-toast-title')).toContainText(FOODS.water.label);
  const firstAchievement=await toast.getAttribute('data-sequence');
  await mkdir(evidence,{recursive:true});await page.screenshot({path:`${evidence}/discovery-achievement.png`});
  await expect(toast).toBeHidden({timeout:15000});
  await page.evaluate(()=>{(window as any).__LAST_NIGHT__.setInventory({water:0});});await page.waitForTimeout(350);
  await page.evaluate(()=>{(window as any).__LAST_NIGHT__.setInventory({water:1});});await page.waitForTimeout(600);
  await expect(toast).toBeHidden();await expect(toast).toHaveAttribute('data-sequence',firstAchievement!);
  expect((await state(page)).discoveries.filter((id:string)=>id==='food-water')).toHaveLength(1);
  await openBook(page,'KeyL','encyclopedia');await page.locator('#field-book-search').fill(FOODS.water.label);
  await expect(page.locator('#field-book-entry-title')).toHaveText(FOODS.water.label);
  await expect(page.locator('#field-book-page')).toHaveAttribute('data-discovered','true');
  await expect(page.locator('[data-book-entry="food-water"]')).toHaveAttribute('data-discovered','true');
  await page.screenshot({path:`${evidence}/encyclopedia-discovered.png`});expect(errors).toEqual([]);
});

test('NPC map markers stay hidden until the survivor actually encounters them',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);
  const initial=await state(page),merchant=initial.economy.merchants.find((m:any)=>!initial.discoveries.includes(`npc-${m.id}`));
  expect(merchant).toBeTruthy();
  // Observe text drawn by the real HUD map, including its map-cache invalidation.
  await page.locator('#full-map').evaluate(canvas=>{
    const c=(canvas as HTMLCanvasElement).getContext('2d')!,originalText=c.fillText.bind(c),originalClear=c.clearRect.bind(c);
    (window as any).__mapDrawnText=[];
    c.clearRect=(...args)=>{(window as any).__mapDrawnText=[];originalClear(...args);};
    c.fillText=(text,x,y,maxWidth)=>{(window as any).__mapDrawnText.push(text);if(maxWidth===undefined)originalText(text,x,y);else originalText(text,x,y,maxWidth);};
  });
  await page.keyboard.press('KeyM');await expect(page.locator('#map-screen')).toBeVisible();
  await expect.poll(async()=>page.evaluate(()=>(window as any).__mapDrawnText.length)).toBeGreaterThan(0);
  const before=await page.evaluate(()=>(window as any).__mapDrawnText as string[]);
  expect(before.some(text=>text.startsWith(`${merchant.name} ·`))).toBe(false);
  const previousMarkers=before.filter(text=>text==='$').length;
  await page.keyboard.press('KeyM');await capture(page);
  await page.evaluate(id=>{
    const game=(window as any).__LAST_NIGHT__,sim=game.simulationFixture(),npc=sim.economy.merchants.find((m:any)=>m.id===id);
    const x=npc.x+Math.sin(npc.angle)*2.4,z=npc.z+Math.cos(npc.angle)*2.4;
    game.setPlayer(x,z);sim.player.eyeY=npc.y+1.65;game.setLook(Math.atan2(npc.x-x,npc.z-z),-.08);
  },merchant.id);
  await expect.poll(async()=>(await state(page)).discoveries).toContain(`npc-${merchant.id}`);
  // Move away again: this is permanent knowledge, not only a proximity marker.
  await page.evaluate(()=>{const game=(window as any).__LAST_NIGHT__;game.setPlayer(1,4);game.setLook(0,0);});
  await page.keyboard.press('KeyM');await expect(page.locator('#map-screen')).toBeVisible();
  await expect.poll(async()=>page.evaluate(()=>(window as any).__mapDrawnText.filter((text:string)=>text==='$').length)).toBe(previousMarkers+1);
  await mkdir(evidence,{recursive:true});await page.screenshot({path:`${evidence}/map-discovered-npc.png`});
  await page.keyboard.press('KeyM');await capture(page);await openBook(page,'KeyL','encyclopedia');
  await page.locator('#field-book-search').fill(merchant.name);await expect(page.locator('#field-book-entry-title')).toContainText(merchant.name);
  await expect(page.locator('#field-book-page')).toHaveAttribute('data-discovered','true');expect(errors).toEqual([]);
});

test('guide and encyclopedia use real shortcuts, page controls and isolated reader input',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await start(page);await openBook(page,'KeyK','guide');
  const reader=page.locator('#field-books'),before=await state(page);
  await expect(reader).toHaveAttribute('role','dialog');await expect(reader).toHaveAttribute('aria-modal','true');
  const firstPage=await reader.getAttribute('data-page');
  await page.locator('#field-book-next').click();await expect(reader).not.toHaveAttribute('data-page',firstPage!);
  const secondPage=await reader.getAttribute('data-page');
  await page.keyboard.press('ArrowRight');await expect(reader).not.toHaveAttribute('data-page',secondPage!);
  await page.keyboard.press('ArrowLeft');await expect(reader).toHaveAttribute('data-page',secondPage!);
  await page.locator('#field-book-prev').click();await expect(reader).toHaveAttribute('data-page',firstPage!);
  // Ordinary gameplay actions stay blocked while the book is open.
  await page.keyboard.down('KeyW');await page.locator('#field-book-title').click();await page.waitForTimeout(350);await page.keyboard.up('KeyW');
  const reading=await state(page);
  expect(reading.ammo).toBe(before.ammo);expect(reading.player.x).toBeCloseTo(before.player.x,4);expect(reading.player.z).toBeCloseTo(before.player.z,4);expect(reading.paused).toBe(false);
  await page.keyboard.press('KeyL');await expect(reader).toHaveAttribute('data-kind','encyclopedia');
  const search=page.locator('#field-book-search');await search.fill('pistola');
  await expect(page.locator('#field-book-entry-title')).toContainText(/Pistola/i);
  await search.fill('bandagem');await expect(page.locator('#field-book-entry-title')).toContainText(/Bandagem/i);
  const light=(await state(page)).flashlight;
  await search.fill('');await search.pressSequentially('mfklo1234');
  await expect(reader).toHaveAttribute('data-kind','encyclopedia');await expect(search).toHaveValue('mfklo1234');
  const typing=await state(page);
  expect(typing.mapOpen).toBe(false);expect(typing.watchOpen).toBe(false);expect(typing.flashlight).toBe(light);expect(typing.activeSlot).toBe(before.activeSlot);expect(typing.ammo).toBe(before.ammo);
  // Escape prioritizes the reader even while its search input owns focus.
  await page.keyboard.press('Escape');await expect(reader).toBeHidden();await expect(page.locator('#pause-screen')).toBeHidden();await capture(page);
  // The old watch remains available on its new shortcut and keeps the real clock.
  await page.keyboard.press('KeyO');await expect(page.locator('#field-watch')).toBeVisible();await expect(page.locator('.watch-label')).toHaveText('Anoitecer em');
  expect((await state(page)).camera.pointerLocked).toBe(true);
  await page.keyboard.press('KeyO');await expect(page.locator('#field-watch')).toBeHidden();
  await openBook(page,'KeyK','guide');await page.locator('#field-book-close').click();await expect(reader).toBeHidden();await capture(page);
  const rounds=(await state(page)).ammo;await page.mouse.click(450,350);await expect.poll(async()=>(await state(page)).ammo).toBe(rounds-1);
  for(const [button,kind]of [['bag-guide','guide'],['bag-wiki','encyclopedia']]){
    await page.keyboard.press('Tab');await expect(page.locator('#inventory-panel')).toBeVisible();await page.locator(`#${button}`).click();
    await expect(reader).toBeVisible();await expect(reader).toHaveAttribute('data-kind',kind);expect((await state(page)).paused).toBe(false);await expect(page.locator('#inventory-panel')).toBeHidden();
    await page.locator('#field-book-close').click();await expect(reader).toBeHidden();
    expect((await state(page)).inventoryOpen).toBe(false);await capture(page);
  }
  await page.keyboard.press('Escape');await expect(page.locator('#pause-screen')).toBeVisible();
  for(const [button,kind]of [['pause-guide','guide'],['pause-wiki','encyclopedia']]){
    await page.locator(`#${button}`).click();await expect(reader).toBeVisible();await expect(reader).toHaveAttribute('data-kind',kind);expect((await state(page)).paused).toBe(true);
    await page.keyboard.press('Escape');await expect(reader).toBeHidden();await expect(page.locator('#pause-screen')).toBeVisible();expect((await state(page)).paused).toBe(true);
  }
  await capture(page);
  expect(errors).toEqual([]);
  await mkdir(evidence,{recursive:true});await writeFile(`${evidence}/input-validation.json`,JSON.stringify({errors,checks:['K guide and L encyclopedia','page buttons and left/right keyboard navigation','reader blocks movement and firing without pausing','real pistol and bandage search','typing cannot trigger map, flashlight, books, watch or equipment shortcuts','Escape closes focused search before pause','pointer lock and shooting recover','O keeps the field watch','both books accessible from inventory','both books accessible from pause and preserve existing pause when closing']},null,2));
});

test('books stay readable with all controls reachable at desktop and portrait sizes',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);await openBook(page,'KeyK','guide');
  await mkdir(evidence,{recursive:true});const layouts=[];
  for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:960,height:640},{width:390,height:844}]){
    await page.setViewportSize(viewport);await settledAnimation(page);
    const box=(await page.locator('#field-books').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.y).toBeGreaterThanOrEqual(-1);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);
    for(const id of ['field-book-close','field-book-title','field-book-prev','field-book-next','field-book-page-status'])await expect(page.locator(`#${id}`)).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`${evidence}/guide-${viewport.width}x${viewport.height}.png`});layouts.push({viewport,box});
  }
  await page.setViewportSize({width:1366,height:768});await page.keyboard.press('KeyL');
  await page.locator('#field-book-search').fill('pistola');await settledAnimation(page);
  await page.screenshot({path:`${evidence}/encyclopedia-1366x768.png`});
  await page.setViewportSize({width:390,height:640});await page.locator('#field-book-search').fill('');
  await page.locator('[data-book-category="food"]').click();await page.locator('#field-book-index-toggle').click();
  await expect(page.locator('#field-book-next')).toBeInViewport();await expect(page.locator('#field-book-close')).toBeInViewport();
  await page.locator('[data-book-entry="food-water"]').click();await expect(page.locator('#field-book-entry-title')).toHaveText('???');
  await settledAnimation(page);const silhouette=await page.locator('.field-unknown-silhouette').boundingBox(),frame=await page.locator('.field-specimen-unknown').boundingBox();
  expect(silhouette!.height).toBeLessThanOrEqual(frame!.height);await settledAnimation(page);
  await page.screenshot({path:`${evidence}/encyclopedia-unknown-390x640.png`});
  expect(errors).toEqual([]);await writeFile(`${evidence}/responsive-validation.json`,JSON.stringify({errors,layouts},null,2));
});

test('two real LAN players can read books without stopping the world or remote combat',async({browser})=>{
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]),pages=await Promise.all(contexts.map(context=>context.newPage())),errors:string[]=[],sockets:string[]=[];
  try{
    for(const [index,page]of pages.entries()){
      page.on('pageerror',error=>errors.push(error.message));page.on('websocket',socket=>sockets.push(socket.url()));
      await prepare(page,`Leitor LAN ${index+1}`,true);
    }
    const [host,guest]=pages;await host.bringToFront();await host.locator('#coop-online').click();await expect(host.locator('#coop-create')).toBeEnabled({timeout:45000});await host.locator('#coop-create').click();await expect(host.locator('#loading-screen')).toBeHidden({timeout:90000});
    await host.keyboard.press('Escape');await host.locator('#pause-lan').click();await expect(host.locator('#pause-lan-code')).toBeVisible({timeout:45000});const code=await host.locator('#pause-lan-code').inputValue();
    await guest.bringToFront();await guest.locator('#coop-online').click();await expect(guest.locator('#coop-join')).toBeEnabled({timeout:45000});await guest.locator('#coop-code-input').fill(code);await guest.locator('#coop-join').click();await expect.poll(async()=>(await state(guest)).network.state,{timeout:90000}).toBe('playing');
    for(const page of pages)await expect.poll(async()=>(await state(page)).network.players.length).toBe(2);
    await host.evaluate(()=>{const owner=(window as any).__LAST_NIGHT__.coopFixture();owner.sim.zombies=[];owner.sim.dormantZombies=[];owner.sim.spawnTimer=10000;owner.sim.setPhase('day',0);for(const player of owner.actors.values())player.sim.player.invulnerable=90;});
    await capture(host);await openBook(host,'KeyK','guide');
    const reading=await state(host),actor=(await state(guest)).coop.actor;
    await capture(guest);const ammo=(await state(guest)).ammo;await guest.mouse.click(450,350);
    await expect.poll(async()=>(await state(guest)).ammo).toBe(ammo-1);
    await expect.poll(async()=>{const s=await state(host),player=s.coop.players.find((p:any)=>p.actor===actor);return player?.loadout[player.activeSlot]?.magazine;}).toBe(ammo-1);
    await expect.poll(async()=>(await state(host)).time).toBeGreaterThan(reading.time);
    await expect(host.locator('#field-books')).toBeVisible();expect((await state(host)).paused).toBe(false);
    await openBook(guest,'KeyL','encyclopedia');await guest.locator('#field-book-search').fill('bandagem');await expect(guest.locator('#field-book-entry-title')).toContainText(/Bandagem/i);
    const bothReading=(await state(host)).time;await expect.poll(async()=>(await state(host)).time).toBeGreaterThan(bothReading);
    await guest.keyboard.press('Escape');await expect(guest.locator('#field-books')).toBeHidden();await capture(guest);
    expect((await state(guest)).discoveries).not.toContain('food-water');expect((await state(host)).discoveries).not.toContain('food-water');
    // Give only the remote actor an item through the authoritative LAN world.
    // Its replicated backpack must not unlock knowledge for the host.
    await host.evaluate(actor=>{
      const owner=(window as any).__LAST_NIGHT__.coopFixture();owner.actors.get(actor).sim.inventory.items.water=1;
    },actor);
    await expect.poll(async()=>(await state(guest)).inventory.water).toBe(1);
    await expect.poll(async()=>(await state(guest)).discoveries).toContain('food-water');
    expect((await state(host)).discoveries).not.toContain('food-water');
    const remaining=(await state(guest)).ammo;await guest.mouse.click(450,350);await expect.poll(async()=>(await state(guest)).ammo).toBe(remaining-1);
    await host.bringToFront();await host.keyboard.press('Escape');await expect(host.locator('#field-books')).toBeHidden();await capture(host);
    await host.waitForTimeout(400);expect((await state(host)).discoveries).not.toContain('food-water');
    expect(errors).toEqual([]);expect(sockets.some(url=>url.includes('photon'))).toBe(false);
    await mkdir(evidence,{recursive:true});await writeFile(`${evidence}/lan-validation.json`,JSON.stringify({errors,players:2,transport:'real WebRTC LAN',websocketHosts:sockets.map(url=>new URL(url).host),checks:['host reader does not pause authoritative clock','guest shots replicate while host reads','both readers do not stop the world','guest search and Escape work','closing restores pointer lock and firing','replicated guest inventory unlocks only that survivor encyclopedia']},null,2));
  }finally{for(const context of contexts)await context.close();}
});
