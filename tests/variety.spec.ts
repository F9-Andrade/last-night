import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const read=(page:any)=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
const start=async(page:any)=>{await page.goto('/?test');await page.locator('#start').click();await page.waitForFunction(()=>!!(window as any).__LAST_NIGHT__);await page.addStyleTag({content:'#debug-stats{display:none}'});await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('dusk',0);});};
test('all six weapons use real pickup, slots, firing, reload, pause and clean retry',async({page})=>{
  test.setTimeout(240000);await mkdir('docs/variety',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
  const weapons=[['pistol','Pistola',12,1],['revolver','Revólver',6,1],['smg','Submetralhadora',30,0],['shotgun','Escopeta',6,0],['rifle','Rifle de assalto',24,0],['marksman','Rifle de precisão',8,0]] as const;
  for(const [id,name,capacity,slot]of weapons){
    await page.evaluate(id=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('dusk',0);g.setInventory({shells:12,rifleAmmo:48});g.dropWeapon(id,1,7);},id);
    await expect(page.locator('#weapon-compare')).toContainText(name,{timeout:15000});await page.keyboard.press('e');await page.waitForFunction(id=>(window as any).__LAST_NIGHT__.state().weapon.type===id,id);
    await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().switchTimer===0);await expect(page.locator('#weapon-name')).toHaveText(name);await page.evaluate(()=>(window as any).__LAST_NIGHT__.setPlayer(1,4));
    await expect(page.locator(`#slot-${slot+1}`)).toHaveClass(/selected/);const before=await read(page);
    await page.mouse.click(650,510);await expect.poll(async()=> (await read(page)).ammo,{timeout:15000}).toBe(capacity-1);
    await page.keyboard.press('r');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().reloadTimer>0);await page.keyboard.press('Escape');const paused=await read(page);await page.waitForTimeout(300);expect((await read(page)).reloadTimer).toBe(paused.reloadTimer);await page.locator('#resume').click();
    await expect.poll(async()=> (await read(page)).ammo,{timeout:20000}).toBe(capacity);expect((await read(page)).reserve).toBe(before.reserve-1);
    if(slot===0){await page.keyboard.press('2');await expect(page.locator('#weapon-name')).toHaveText('Pistola');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().switchTimer===0);await page.keyboard.press('1');await expect(page.locator('#weapon-name')).toHaveText(name);}
    await page.screenshot({path:`docs/variety/weapon-${id}.png`});
    await page.evaluate(()=>(window as any).__LAST_NIGHT__.setHealth(0));await expect(page.locator('#game-over')).toBeVisible({timeout:15000});await page.locator('#retry').click();const reset=await read(page);expect(reset.perks).toEqual([]);expect(reset.groundWeapons).toEqual([]);expect(reset.weapon.type).toBe('pistol');
  }
  expect(errors).toEqual([]);
});
test('rare comparison, inventory, dawn choice, generator access and interiors stay usable',async({page})=>{
  test.setTimeout(180000);await mkdir('docs/variety',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
  await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.dropWeapon('shotgun',1,8.5,'rare');});await expect(page.locator('#weapon-compare')).toContainText('Raro',{timeout:15000});await page.screenshot({path:'docs/variety/rare-ground.png'});await page.keyboard.press('e');await expect(page.locator('#weapon-name')).toHaveText('Escopeta');
  await page.keyboard.press('Tab');await page.locator('#equipment-tab').click();await expect(page.locator('#equipment-details')).toContainText('Escopeta');await page.screenshot({path:'docs/variety/equipment.png'});await page.keyboard.press('Tab');
  await page.evaluate(()=>(window as any).__LAST_NIGHT__.offerPerks());await expect(page.locator('#perk-screen')).toBeVisible();await page.keyboard.press('Escape');expect((await read(page)).paused).toBe(false);const before=await read(page);await page.waitForTimeout(500);expect((await read(page)).time).toBe(before.time);await page.screenshot({path:'docs/variety/perk-choice.png'});await page.locator('[data-perk="opening"]').click();await expect(page.locator('#perk-screen')).toBeHidden();expect((await read(page)).perks).toEqual(['opening']);
  await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPlayer(38,-32);});await expect(page.locator('#interaction')).toContainText('ATIVAR GERADOR',{timeout:15000});await page.keyboard.press('e');await expect.poll(async()=>(await read(page)).facilities[0].state,{timeout:15000}).toBe('powered');
  await page.evaluate(()=>(window as any).__LAST_NIGHT__.setPlayer(25,-24));await expect(page.locator('#interaction')).toContainText('ABRIR RESERVA');await page.keyboard.press('e');await expect.poll(async()=>(await read(page)).facilities[1].state,{timeout:15000}).toBe('opened');await page.waitForTimeout(1000);await page.screenshot({path:'docs/variety/hospital-interior.png'});
  for(const [name,x,z]of [['police',25,26],['market',-25,-6]]as const){await page.evaluate(([x,z])=>(window as any).__LAST_NIGHT__.setPlayer(x,z),[x,z]);await page.waitForTimeout(1500);await page.screenshot({path:`docs/variety/${name}-interior.png`});}
  await page.setViewportSize({width:1024,height:640});await page.keyboard.press('Tab');await page.locator('#supplies-tab').click();await page.screenshot({path:'docs/variety/inventory-compact.png'});const box=await page.locator('#inventory-panel').boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(640);expect(errors).toEqual([]);
});
test('30 and 40 Walkers plus each mixed composition keep bounded render and audio pools',async({page})=>{
  test.setTimeout(240000);await mkdir('docs/variety',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);const metrics:any[]=[];
  for(const [name,count,specials]of [['walkers-30',30,[]],['walkers-40',40,[]],['runners',30,['runner','runner','runner']],['spitter',30,['spitter']],['tank',30,['tank']],['mixed',40,['runner','runner','tank','spitter']]] as const){
    await page.evaluate(({count,specials})=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setHealth(100);g.setPlayer(1,7);g.setPhase('dusk',0);for(let i=0;i<count;i++)g.spawn(-7+i%10*1.6,13+Math.floor(i/10)*1.5,specials[i]??'walker');},{count,specials});
    await page.waitForFunction(n=>(window as any).__LAST_NIGHT__.state().zombies.length===n,count);const samples:any[]=[];
    for(let i=0;i<3;i++){await page.waitForTimeout(1100);const s=await read(page);samples.push({fps:s.fps,calls:s.calls,triangles:s.triangles,...s.render,audio:s.audio});}
    const s=await read(page);expect(s.calls).toBeLessThan(550);expect(s.triangles).toBeLessThan(400000);expect(s.render.geometryMB).toBeLessThan(25);expect(s.audio.peak).toBeLessThanOrEqual(16);metrics.push({name,count,composition:s.zombies.reduce((o:any,z:any)=>(o[z.kind]=(o[z.kind]??0)+1,o),{}),samples});
    await page.screenshot({path:`docs/variety/horde-${name}.png`});
  }
  await writeFile('docs/variety/performance.json',JSON.stringify({renderer:'Chromium / SwiftShader (software)',viewport:'1440×900',quality:'high',metrics},null,2));expect(errors).toEqual([]);
});

test('arsenal, special anatomy and corpses retain the same voxel art direction',async({page})=>{await mkdir('docs/variety',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1800,height:1080});await page.goto('/tests/fixtures/variety-gallery.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.screenshot({path:'docs/variety/arsenal-and-specials.png'});expect(errors).toEqual([]);});
