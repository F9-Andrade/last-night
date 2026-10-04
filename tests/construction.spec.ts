import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const state=(p:Page)=>p.evaluate(()=>(window as any).__LAST_NIGHT__.state());
async function capture(p:Page){if(!(await state(p)).camera.pointerLocked)await p.locator('#capture-mouse').press('Enter');await expect.poll(async()=>(await state(p)).camera.pointerLocked).toBe(true);}
async function aim(p:Page,x:number,z:number,y:number){await p.evaluate(({x,z,y})=>{const g=(window as any).__LAST_NIGHT__,s=g.state();g.setLook(Math.atan2(x-s.player.x,z-s.player.z),Math.atan2(y-s.player.eyeY,Math.hypot(x-s.player.x,z-s.player.z)));},{x,z,y});await p.waitForTimeout(100);}
async function start(p:Page){
 await p.addInitScript(()=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'medium',master:0}));window.addEventListener('mousemove',e=>{if(document.pointerLockElement)e.stopImmediatePropagation();},true);});
 await p.goto('/?test');await expect(p.locator('#start')).toBeEnabled({timeout:90000});await p.locator('#start').click();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});await capture(p);
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPlayer(3.4,6.2);g.setLook(Math.PI,0);g.setInventory({bench:1,chest:1,wood:100,scrap:100,cloth:100,cord:50});const s=g.simulationFixture();s.spawnTimer=10000;s.player.invulnerable=1000;});
}
async function openTable(p:Page){const s=await state(p),t=s.crafting.tables[0];await aim(p,t.x,t.z,t.y+1.1);await capture(p);await p.keyboard.press('KeyE');await expect(p.locator('#workbench-screen')).toBeVisible();}

test('craft hammer, use nine building slots, equip from backpack and preserve combat controls',async({page:p})=>{
 const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await start(p);await mkdir('docs/construction',{recursive:true});
 await p.keyboard.press('Tab');await p.locator('#craft-tab').click();await p.locator('#place-bench').click();await capture(p);await p.mouse.click(500,400);await expect.poll(async()=>(await state(p)).crafting.tables.length).toBe(1);
 await openTable(p);await p.locator('#recipe-category').selectOption('Construção');await expect(p.locator('[data-recipe^="build-"]')).toHaveCount(0);await p.locator('[data-recipe="hammer"]').click();await expect(p.locator('#bench-craft')).toHaveText(/Fabricar/);await p.screenshot({path:'docs/construction/workshop.png'});
 const before=(await state(p)).inventory;await p.locator('#bench-craft').click();await expect(p.locator('#workbench-screen')).toBeHidden();await capture(p);await expect(p.locator('#build-hotbar')).toBeVisible();await expect(p.locator('[data-build-kind]')).toHaveCount(9);
 const stock=before.wood-3;expect((await state(p)).inventory.scrap).toBe(before.scrap-5);expect((await state(p)).gear.owned).toContain('hammer');
 for(const [i,kind] of ['wall','window','door','floor','roof','stairs','spikes','snare','wire'].entries()){await p.keyboard.press(`Digit${i+1}`);await expect(p.locator(`[data-build-kind="${kind}"]`)).toHaveAttribute('aria-pressed','true');expect((await state(p)).activeSlot).toBe(2);}
 await p.mouse.wheel(0,100);await expect(p.locator('[data-build-kind="wall"]')).toHaveAttribute('aria-pressed','true');
 for(const size of [{width:1366,height:768},{width:1920,height:1080},{width:960,height:640}]){await p.setViewportSize(size);await expect(p.locator('[data-build-kind="wire"]')).toBeInViewport();expect(await p.locator('#build-hotbar').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await p.screenshot({path:`docs/construction/hammer-${size.width}.png`});}await p.setViewportSize({width:1366,height:768});
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPlayer(-3.5,7);g.setLook(Math.PI,-.55);});await expect(p.locator('#build-preview-hud')).toBeVisible();await expect(p.locator('#build-status')).toHaveText(/Encaixe livre/);expect((await state(p)).inventory.wood).toBe(stock);
 await p.screenshot({path:'docs/construction/placement.png'});await p.keyboard.press('KeyR');expect((await state(p)).construction.preview.rotation).toBe(1);await p.keyboard.press('KeyR');await p.keyboard.press('KeyR');await p.keyboard.press('KeyR');
 await p.keyboard.press('PageUp');expect((await state(p)).construction.preview.level).toBe(1);await expect(p.locator('#build-preview-hud')).toHaveClass(/invalid/);await p.keyboard.press('PageDown');
 await p.mouse.click(500,400);await expect.poll(async()=>(await state(p)).crafting.structures.length).toBe(1);expect((await state(p)).inventory.wood).toBe(stock-6);
 await p.mouse.click(500,400);expect((await state(p)).inventory.wood).toBe(stock-6);
 await p.keyboard.press('Tab');await expect(p.locator('#build-hotbar')).toBeHidden();await p.locator('#equipment-tab').click();await p.locator('[data-equipment-melee=hammer]').click();await expect(p.locator('#inventory-panel')).toBeHidden();await expect(p.locator('#build-hotbar')).toBeVisible();await capture(p);await p.keyboard.press('KeyB');await expect(p.locator('#build-preview-hud')).toBeHidden();expect((await state(p)).paused).toBe(false);
 await expect.poll(async()=>(await state(p)).switchTimer).toBe(0);await p.keyboard.press('KeyB');await expect(p.locator('#build-hotbar')).toBeVisible();const piece=(await state(p)).crafting.structures[0];await aim(p,piece.x,piece.z,1.65);await capture(p);await p.keyboard.press('KeyG');await expect(p.locator('#construction-screen')).toBeVisible();
 await p.locator('#construction-fortify').click();await expect.poll(async()=>(await state(p)).crafting.structures[0].tier).toBe(1);await expect(p.locator('#construction-tier')).toHaveText('Trama reforçada');await p.locator('#construction-fortify').click();await expect.poll(async()=>(await state(p)).crafting.structures[0].tier).toBe(2);await expect(p.locator('#construction-fortify')).toBeDisabled();
 for(const size of [{width:1366,height:768},{width:1920,height:1080},{width:960,height:640}]){await p.setViewportSize(size);await expect(p.locator('#construction-fortify')).toBeInViewport();await expect(p.locator('#construction-close')).toBeInViewport();expect(await p.locator('.construction-window').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await p.screenshot({path:`docs/construction/fortify-${size.width}.png`});}
 await p.keyboard.press('Escape');await capture(p);await expect(p.locator('#build-hotbar')).toBeVisible();await p.keyboard.press('KeyB');await expect(p.locator('#build-hotbar')).toBeHidden();await p.waitForTimeout(350);const ammo=(await state(p)).ammo;await p.mouse.down({button:'right'});await p.mouse.click(400,300);await p.mouse.up({button:'right'});await expect.poll(async()=>(await state(p)).ammo).toBe(ammo-1);expect(errors).toEqual([]);
});

test('E opens furniture, a full chest moves atomically and cancel leaves the original untouched',async({page:p})=>{
 const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await start(p);
 await p.keyboard.press('Tab');await p.locator('#place-chest').click();await capture(p);await p.mouse.click(500,400);await expect.poll(async()=>(await state(p)).crafting.chests.length).toBe(1);
 let c=(await state(p)).crafting.chests[0];await aim(p,c.x,c.z,c.y+.6);await p.keyboard.press('KeyE');await expect(p.locator('#chest-screen')).toBeVisible();await p.locator('[data-bag-item="ammo"]').click({modifiers:['Shift']});await expect.poll(async()=>(await state(p)).crafting.chests[0].slots[0]?.amount).toBe(60);
 c=(await state(p)).crafting.chests[0];await p.locator('#chest-relocate').click();await capture(p);await p.keyboard.press('KeyR');await p.keyboard.press('Escape');expect((await state(p)).crafting.chests[0]).toEqual(c);expect((await state(p)).paused).toBe(false);
 await p.keyboard.press('KeyE');await expect(p.locator('#chest-screen')).toBeVisible();await p.locator('#chest-relocate').click();await capture(p);await aim(p,5,4,.22);await p.keyboard.press('KeyR');await p.mouse.click(500,400);
 await expect.poll(async()=>(await state(p)).crafting.chests[0].revision).toBe(c.revision+1);const moved=(await state(p)).crafting.chests[0];expect(moved.slots).toEqual(c.slots);expect(moved.id).toBe(c.id);expect(moved.x).not.toBe(c.x);
 await aim(p,moved.x,moved.z,moved.y+.6);await p.keyboard.press('KeyE');await expect(p.locator('#chest-screen')).toBeVisible();await expect(p.locator('[data-chest-slot="0"] strong')).toHaveText('60');expect(errors).toEqual([]);
});

test('voxel stairs reach a walkable second storey and doorway opens smoothly',async({page:p})=>{
 const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await start(p);
 await p.evaluate(async()=>{const g=(window as any).__LAST_NIGHT__,s=g.simulationFixture(),m=await import('/src/game/construction.ts');
 const add=(kind:string,x:number,z:number,level:number,rotation=0)=>{const piece={id:s.crafting.next++,kind,x,z,level,rotation,hp:1,tier:0,open:false,revision:0};piece.hp=m.structureMaxHP(piece);s.crafting.structures.push(piece);};
 add('stairs',-3.5,-3.5,0);add('floor',-3.5,-.5,1);add('window',-3.5,1,1);add('wall',-5,-.5,1,1);add('wall',-5,-3.5,0,1);add('wall',-3.5,1,0);add('roof',-3.5,-.5,1);add('door',-.5,4,0);s.crafting.revision++;g.setPlayer(-3.5,-5.25);g.setLook(0,0);
 });
 await p.keyboard.down('KeyW');await expect.poll(async()=>(await state(p)).construction.ground,{timeout:10000}).toBeGreaterThan(3.1);await p.keyboard.up('KeyW');expect((await state(p)).player.eyeY).toBeGreaterThan(4.4);
 await p.screenshot({path:'docs/construction/upper-floor.png'});
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPlayer(-.5,6);const s=g.simulationFixture();s.player.eyeY=1.94;g.setLook(Math.PI,0);});await p.waitForTimeout(200);await p.keyboard.press('KeyE');await expect.poll(async()=>(await state(p)).crafting.structures.find((s:any)=>s.kind==='door').open).toBe(true);
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPlayer(3.5,9);g.setLook(-2.45,.1);});await p.waitForTimeout(400);await p.screenshot({path:'docs/construction/shelter.png'});expect(errors).toEqual([]);
});

// Exercise overlay priority and the empty weapon-slot fallback independently of crafting.
test('hammer controls preserve movement, overlay Escape and unarmed fallback',async({page:p})=>{
 await start(p);await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__,s=g.simulationFixture();s.gear.owned.push('hammer');g.setPlayer(-3.5,7);g.setLook(Math.PI,0);});
 await p.keyboard.press('KeyB');await expect(p.locator('#build-hotbar')).toBeVisible();
 await p.keyboard.down('KeyW');await p.keyboard.press('Digit2');const from=(await state(p)).player.z;await expect.poll(async()=>(await state(p)).player.z).toBeLessThan(from-.15);await p.keyboard.up('KeyW');
 await p.keyboard.press('Tab');await expect(p.locator('#inventory-panel')).toBeVisible();await p.keyboard.press('Escape');await expect(p.locator('#inventory-panel')).toBeHidden();await expect(p.locator('#build-hotbar')).toBeVisible();expect((await state(p)).activeSlot).toBe(2);await capture(p);
 await p.keyboard.press('KeyM');await expect(p.locator('#map-screen')).toBeVisible();await p.keyboard.press('Escape');await expect(p.locator('#map-screen')).toBeHidden();await expect(p.locator('#build-hotbar')).toBeVisible();expect((await state(p)).activeSlot).toBe(2);await capture(p);
 await p.evaluate(()=>{(window as any).__LAST_NIGHT__.simulationFixture().loadout[1]=null;});await p.keyboard.press('Digit0');await expect(p.locator('#build-hotbar')).toBeHidden();expect((await state(p)).activeSlot).toBe(3);
});
