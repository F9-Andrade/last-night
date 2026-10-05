import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidenceDir=process.env.FPS_EVIDENCE_DIR??'docs/fps';
// CDP emits compensating cursor-warp moves under headless Pointer Lock.
// Inject only relative movement/button events; capture itself uses real UI gestures.
async function look(page:any,x:number,y:number){await page.evaluate(({x,y})=>window.dispatchEvent(new MouseEvent('mousemove',{movementX:x,movementY:y,bubbles:true})),{x,y});}
async function button(page:any,down:boolean,button=0){await page.evaluate(({down,button})=>{const target=down?document.querySelector('canvas')!:window;target.dispatchEvent(new PointerEvent(down?'pointerdown':'pointerup',{button,bubbles:true}));},{down,button});}
const state=(page:any)=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
async function start(page:any){page.setDefaultTimeout(30000);await page.setViewportSize({width:1280,height:720});await page.addInitScript(()=>localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',shadows:false})));await page.goto('/?test');await page.locator('#start').click();await expect(page.locator('#loading-screen')).toBeHidden({timeout:60000});await page.waitForFunction(()=>document.pointerLockElement!==null);await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('dusk');});await mkdir(evidenceDir,{recursive:true});}
test('FPS pointer lock, immediate look, menus, movement, crouch, exhaustion and retry',async({page})=>{
 test.setTimeout(180000);await start(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const yaw=(await state(page)).camera.yaw;await look(page,120,20);await expect.poll(async()=>(await state(page)).camera.yaw).not.toBe(yaw);
 await look(page,0,-5000);expect((await state(page)).camera.pitch).toBeLessThanOrEqual(1.5);await look(page,0,5000);expect((await state(page)).camera.pitch).toBeGreaterThanOrEqual(-1.5);
 for(const key of ['Tab','m']){await page.keyboard.press(key);await page.waitForFunction(()=>!document.pointerLockElement);const before=(await state(page)).camera;await page.mouse.move(600,400);expect((await state(page)).camera.yaw).toBe(before.yaw);await page.keyboard.press(key);await page.waitForFunction(()=>!!document.pointerLockElement);}
 await page.keyboard.press('Escape');await expect(page.locator('#pause-screen')).toBeVisible();await page.locator('#resume').press('Enter');await page.waitForFunction(()=>!!document.pointerLockElement);
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPlayer(88,-30);g.setLook(Math.PI,0);});
 await page.keyboard.down('w');await page.keyboard.down('Shift');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().player.exhausted);const t=(await state(page)).stats.seconds;
 await page.waitForFunction(t=>{const s=(window as any).__LAST_NIGHT__.state();return s.stats.seconds>t+.65;},t);expect((await state(page)).player.running).toBe(false);
 await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().player.running);await page.keyboard.up('Shift');await page.keyboard.up('w');
 await page.keyboard.down('c');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().player.eyeY<1.2);await page.screenshot({animations:'disabled',path:`${evidenceDir}/crouch.png`});await page.keyboard.up('c');
 await button(page,true,2);await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().camera.fov<72);await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().player.running);expect((await state(page)).player.ads).toBe(false);await page.keyboard.up('Shift');await page.keyboard.up('w');await button(page,false,2);
 await page.evaluate(()=>(window as any).__LAST_NIGHT__.setHealth(0));await expect(page.locator('#game-over')).toBeVisible();await page.waitForFunction(()=>!document.pointerLockElement);await page.locator('#retry').click();await expect(page.locator('#loading-screen')).toBeHidden({timeout:60000});await page.waitForFunction(()=>!!document.pointerLockElement);expect((await state(page)).player.stamina).toBe(100);expect(errors).toEqual([]);
});
test('every FPS weapon: aimed pickup, hip fire, ADS, reload, empty, sprint and headshot',async({page})=>{
 test.setTimeout(240000);await start(page);const evidence:any[]=[];
 for(const type of ['pistol','revolver','smg','shotgun','rifle','marksman']){
  await page.evaluate(type=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setHealth(100);g.setPhase('dusk');g.setPlayer(88,-30);g.setLook(Math.PI,-.68);g.setInventory({ammo:100,shells:50,rifleAmmo:100});g.dropWeapon(type,88,-32);},type);
  const previousUid=(await state(page)).weapon.uid;
  await expect(page.locator('#weapon-compare')).toBeVisible();await page.keyboard.press('e');await page.waitForFunction(({type,previousUid})=>{const s=(window as any).__LAST_NIGHT__.state();return s.weapon.uid!==previousUid&&s.weapon.type===type&&s.switchTimer===0;},{type,previousUid});
  await page.evaluate(()=>(window as any).__LAST_NIGHT__.setLook(Math.PI,0));const before=(await state(page)).ammo;
  await button(page,true);await page.waitForFunction(n=>(window as any).__LAST_NIGHT__.state().ammo<n,before);await button(page,false);await page.keyboard.press('r');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().reloadTimer>0);await page.screenshot({animations:'disabled',path:`${evidenceDir}/${type}-reload.png`});await page.waitForFunction(n=>(window as any).__LAST_NIGHT__.state().ammo===n,before);
  await button(page,true,2);await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().camera.fov<72);await page.screenshot({animations:'disabled',path:`${evidenceDir}/${type}-ads.png`});
  // Every weapon reuses the same lane. Loot from the preceding kill otherwise
  // correctly blocks spawning the next target at this position.
  const target=await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__,sim=g.simulationFixture();g.clearWalkers();sim.loot=sim.loot.filter((l:any)=>!l.id.startsWith('infected-'));g.setLook(Math.PI,.032);return g.spawn(88,-35)?.id;});expect(target).toBeDefined();const heads=(await state(page)).stats.headshots;
  await button(page,true);await page.waitForFunction(n=>(window as any).__LAST_NIGHT__.state().stats.headshots>n,heads);await button(page,false);await button(page,false,2);await page.screenshot({animations:'disabled',path:`${evidenceDir}/${type}-combat.png`});
  await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().player.running);await page.screenshot({animations:'disabled',path:`${evidenceDir}/${type}-sprint.png`});await page.keyboard.up('w');await page.keyboard.up('Shift');
  await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setAmmo(0);g.setInventory({ammo:0,shells:0,rifleAmmo:0});});await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().shotTimer===0);await button(page,true);await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().events.at(-1)==='empty');await button(page,false);expect((await state(page)).ammo).toBe(0);await expect(page.locator('#reload-label')).toContainText('Pente vazio');
  evidence.push({type,state:await state(page)});
 }
 await writeFile(`${evidenceDir}/weapons.json`,JSON.stringify(evidence.map(v=>({type:v.type,headshots:v.state.stats.headshots,empty:v.state.events.includes('empty'),audio:v.state.audio,camera:v.state.camera,calls:v.state.calls,triangles:v.state.triangles})),null,2));
});
test('FPS interiors retain ceilings, gaze interactions and readable night lighting',async({page})=>{
 test.setTimeout(180000);await start(page);const scenes:any[]=[];
 const positions=[['house',-113,-66],['hospital',112,-105],['police',113,22],['market',-113,69],['industry',113,82],['quarantine',114,135],['central-hospital',25,-22],['shelter',1,6]] as const;
 for(const [id,x,z] of positions){await page.evaluate(({x,z})=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setHealth(100);g.setPlayer(x,z);g.setLook(Math.PI,0);g.setPhase('day');},{x,z});await page.waitForTimeout(1000);await page.screenshot({animations:'disabled',path:`${evidenceDir}/interior-${id}.png`});scenes.push({id,...(await state(page)).render});}
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPhase('dusk');g.setPlayer(112,-97);g.setLook(Math.PI,0);});await expect(page.locator('#interaction')).toContainText('ABRIR PORTA');await page.keyboard.press('e');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().portals.find((p:any)=>p.id==='hospital-main-front').state==='open');
 await page.keyboard.down('w');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().player.z<-100);await page.keyboard.up('w');
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPhase('night');g.setHealth(500);g.setBase(10000);g.setLook(Math.PI,-.08);});await page.keyboard.press('f');await page.waitForTimeout(1000);await page.screenshot({animations:'disabled',path:`${evidenceDir}/hospital-night-flashlight.png`});
 await page.keyboard.press('m');await page.screenshot({animations:'disabled',path:`${evidenceDir}/map.png`});await page.keyboard.press('m');await page.waitForFunction(()=>!!document.pointerLockElement);
 await writeFile(`${evidenceDir}/interiors.json`,JSON.stringify(scenes,null,2));
});
test('FPS five infected types, directional damage, wound/death and night horde budgets',async({page})=>{
 test.setTimeout(180000);await start(page);const metrics:any[]=[];
 for(const kind of ['walker','runner','tank','spitter','screamer']){await page.evaluate(kind=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setHealth(500);g.setPlayer(88,-30);g.setLook(Math.PI,0);g.spawn(88,-35,kind);},kind);await page.waitForTimeout(800);await page.screenshot({animations:'disabled',path:`${evidenceDir}/enemy-${kind}.png`});}
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPlayer(88,-30);g.setLook(Math.PI,0);g.spawn(89,-30);});await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().player.hp<500);await page.screenshot({animations:'disabled',path:`${evidenceDir}/directional-damage.png`});
 for(const count of [30,40]){await page.evaluate(count=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setHealth(1000);g.setBase(10000);g.setPlayer(1,7);g.setLook(0,0);g.setPhase('night');g.finishSpawning();for(let i=0;i<count;i++)g.spawn(-7+i%10*1.6,14+Math.floor(i/10)*1.6,['walker','walker','runner','spitter','tank','screamer'][i%6]);},count);await page.waitForTimeout(1500);const s=await state(page);metrics.push({count,fps:s.fps,calls:s.calls,triangles:s.triangles,audio:s.audio,render:s.render});expect(s.audio.peak).toBeLessThanOrEqual(16);expect(s.calls).toBeLessThan(900);await page.screenshot({animations:'disabled',path:`${evidenceDir}/horde-${count}.png`});}
 await writeFile(`${evidenceDir}/performance.json`,JSON.stringify({renderer:await page.evaluate(()=>{const gl=document.querySelector('canvas')!.getContext('webgl2')!;const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}),quality:'low',viewport:'1280x720',metrics},null,2));
});

test('FPS weapon slots, shotgun shell interruption and comparable high-quality benchmark',async({page})=>{
 test.setTimeout(120000);await start(page);
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPlayer(88,-30);g.setLook(Math.PI,-.68);g.dropWeapon('shotgun',88,-32);g.setInventory({shells:20});});
 await expect(page.locator('#weapon-compare')).toBeVisible();await page.keyboard.press('e');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().weapon.type==='shotgun');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().switchTimer===0);
 await page.keyboard.press('2');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().weapon.type==='pistol');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().switchTimer===0);
 await page.evaluate(()=>document.querySelector('canvas')!.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true})));await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().weapon.type==='shotgun');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().switchTimer===0);
 await page.evaluate(()=>(window as any).__LAST_NIGHT__.setAmmo(1));await page.keyboard.press('r');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().reloadTimer>0);await button(page,true);await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().reloadTimer===0);await button(page,false);
 await page.keyboard.press('Escape');await page.locator('#pause-settings').click();await page.locator('#setting-quality').selectOption('high');await page.locator('#setting-shadows').check();await page.locator('#settings-close').click();await page.locator('#resume').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(400);
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPlayer(1,7);g.setLook(Math.PI,0);g.setPhase('day');});await page.keyboard.press('2');await page.waitForTimeout(1200);
 const samples=[];for(let i=0;i<3;i++){await page.waitForTimeout(1500);const s=await state(page);samples.push({fps:s.fps,calls:s.calls,triangles:s.triangles,render:s.render});}
 await page.screenshot({animations:'disabled',path:`${evidenceDir}/after-fps.png`});await writeFile(`${evidenceDir}/after.json`,JSON.stringify({renderer:await page.evaluate(()=>{const gl=document.querySelector('canvas')!.getContext('webgl2')!;const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}),viewport:'1280x720',quality:'high',samples},null,2));
});
