import {test,expect,type Page,type Browser} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
const evidence='docs/field-hud';
const baseline=process.env.LAST_NIGHT_HUD_BASELINE==='1';
const state=(p:Page)=>p.evaluate(()=>(window as any).__LAST_NIGHT__.state());
const layouts=[{width:1366,height:768},{width:1600,height:900},{width:1920,height:1080},{width:960,height:640}];
const photonConfigured=(()=>{try{return /^VITE_PHOTON_APP_ID\s*=\s*["']?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/im.test(readFileSync('.env.local','utf8'));}catch{return false;}})();
async function recapture(p:Page){await p.bringToFront();await expect(async()=>{if((await state(p)).paused)await p.locator('#resume').click({timeout:1500});else if(await p.locator('#capture-mouse').isVisible())await p.locator('#capture-mouse').click({timeout:1500});expect(await p.evaluate(()=>!!document.pointerLockElement)).toBe(true);}).toPass({timeout:10000});}
async function prepare(p:Page,name?:string){
 await p.addInitScript(name=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'medium',master:0}));if(name)localStorage.setItem('last-night-player-name',name);window.addEventListener('mousemove',e=>{if(document.pointerLockElement)e.stopImmediatePropagation();},true);},name);
 await p.goto('/?test');await expect(p.locator('#start')).toBeEnabled({timeout:90000});await p.addStyleTag({content:'#debug-stats{display:none!important}'});
}
async function pose(p:Page,x=88){await p.evaluate(x=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('day',0);g.setPlayer(x,-30);g.setLook(Math.PI,-.06);},x);}
async function openSolo(p:Page){
 await prepare(p);await p.locator('#start').click();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});await recapture(p);await pose(p);
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;setInterval(()=>{g.clearWalkers();g.setPhase('day',0);},300);});await p.waitForTimeout(400);
}
async function transparentLeft(p:Page,selector:string){
 await expect(p.locator(selector)).toBeVisible();
 const actual=await p.locator(selector).evaluate(el=>{const css=getComputedStyle(el),r=el.getBoundingClientRect();return {background:css.backgroundColor,image:css.backgroundImage,shadow:css.boxShadow,border:css.borderTopWidth,x:r.x,y:r.y,width:r.width,height:r.height,viewport:innerWidth};});
 expect(actual.background).toBe('rgba(0, 0, 0, 0)');expect(actual.image).toBe('none');expect(actual.shadow).toBe('none');expect(actual.border).toBe('0px');expect(actual.x+actual.width).toBeLessThan(actual.viewport*.4);return actual;
}
async function visibleWithin(p:Page,selector:string){
 await expect(p.locator(selector)).toBeInViewport();const b=(await p.locator(selector).boundingBox())!,v=p.viewportSize()!;
 expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(v.width+1);expect(b.y+b.height).toBeLessThanOrEqual(v.height+1);return b;
}
async function mapPixels(p:Page,selector:string){
 const result=await p.locator(selector).evaluate(el=>{const canvas=el as HTMLCanvasElement,c=canvas.getContext('2d')!,rect=canvas.getBoundingClientRect(),d=c.getImageData(0,0,canvas.width,canvas.height).data;let chromatic=0,opaque=0;const colors=new Set<string>(),hues=new Set<number>();for(let i=0;i<d.length;i+=16){const r=d[i],g=d[i+1],b=d[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);if(d[i+3]>240)opaque++;colors.add(`${r>>3},${g>>3},${b>>3}`);if(max-min>25&&max>60){chromatic++;let h=max===r?(g-b)/(max-min):max===g?2+(b-r)/(max-min):4+(r-g)/(max-min);hues.add(Math.floor(((h*60+360)%360)/30));}}const samples=d.length/16;return {width:canvas.width,height:canvas.height,displayWidth:rect.width,displayHeight:rect.height,pixelRatio:devicePixelRatio,colors:colors.size,hueBands:hues.size,chromatic:chromatic/samples,opaque:opaque/samples};});
 expect(result.width).toBe(result.height);expect(Math.abs(result.displayWidth/result.displayHeight-1)).toBeLessThan(.01);expect(result.width).toBeGreaterThanOrEqual(result.displayWidth-2);expect(result.colors).toBeGreaterThan(20);expect(result.chromatic).toBeGreaterThan(.05);expect(result.hueBands).toBeGreaterThanOrEqual(3);expect(result.opaque).toBeGreaterThan(.98);return result;
}
async function renderer(p:Page){return p.evaluate(()=>{const gl=document.querySelector<HTMLCanvasElement>('#game')!.getContext('webgl2')!,info=gl.getExtension('WEBGL_debug_renderer_info');return info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});}

test('field HUD solo composition, colored square maps and keyboard transitions',async({page:p})=>{
 const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await mkdir(evidence,{recursive:true});await openSolo(p);
 if(baseline){await p.screenshot({path:`${evidence}/before-solo-1366x768.png`});await p.keyboard.press('m');await expect(p.locator('#map-screen')).toBeVisible();await p.screenshot({path:`${evidence}/before-fullmap-1366x768.png`});return;}
 // Semantic and visible health agree with the actual simulation, not a static illustration.
 await p.evaluate(()=>(window as any).__LAST_NIGHT__.setHealth(73));await expect(p.locator('#health')).toHaveText('73');await expect(p.locator('#health-meter')).toHaveAttribute('aria-valuenow','73');await expect(p.locator('#health-bar')).toHaveAttribute('style',/width: 73%/);await p.evaluate(()=>(window as any).__LAST_NIGHT__.setHealth(100));await expect(p.locator('#health-meter')).toHaveAttribute('aria-valuenow','100');
 const checkpoints=[];
 for(const viewport of layouts){
  await p.setViewportSize(viewport);await recapture(p);await pose(p);await expect(p.locator('#coop-team')).toBeHidden();await expect(p.locator('#coop-health')).toBeHidden();
  const clock=await transparentLeft(p,'#cycle'),minimap=await visibleWithin(p,'#map-toggle'),health=await visibleWithin(p,'.bottom-hud');await visibleWithin(p,'.weapon-panel');
  expect(clock.y+clock.height).toBeLessThan(health.y);expect(minimap.x).toBeGreaterThan(viewport.width*.55);
  const small=await mapPixels(p,'#minimap');expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await p.screenshot({path:`${evidence}/after-solo-${viewport.width}x${viewport.height}.png`});
  if(viewport.width===1366){await expect(p.locator('#notice')).not.toHaveClass(/visible/);await p.screenshot({path:`${evidence}/after-solo-clean-1366x768.png`});}
  await p.keyboard.press('m');await expect(p.locator('#map-screen')).toBeVisible();expect((await state(p)).camera.pointerLocked).toBe(false);expect((await state(p)).paused).toBe(false);await expect(p.locator('#map-toggle')).toBeHidden();
  const sheet=await visibleWithin(p,'.map-sheet');await visibleWithin(p,'#map-close');const full=await mapPixels(p,'#full-map');
  await p.screenshot({path:`${evidence}/after-fullmap-${viewport.width}x${viewport.height}.png`});
  await p.keyboard.press('Escape');await expect(p.locator('#map-screen')).toBeHidden();await expect(p.locator('#pause-screen')).toBeHidden();await recapture(p);
  checkpoints.push({viewport,clock,minimap,health,sheet,small,full});
 }
 await p.setViewportSize({width:1366,height:768});await recapture(p);
 await p.keyboard.press('Tab');await expect(p.locator('#inventory-panel')).toBeVisible();expect((await state(p)).camera.pointerLocked).toBe(false);await expect(p.locator('#map-toggle')).toBeHidden();await p.keyboard.press('Tab');await expect(p.locator('#inventory-panel')).toBeHidden();await recapture(p);
 await p.keyboard.press('m');await expect(p.locator('#map-screen')).toBeVisible();await p.locator('#map-close').click();await expect(p.locator('#map-screen')).toBeHidden();await recapture(p);
 await p.keyboard.press('Escape');await expect(p.locator('#pause-screen')).toBeVisible();expect((await state(p)).camera.pointerLocked).toBe(false);await p.locator('#pause-settings').click();await p.locator('#setting-uiScale').fill('1.2');await p.locator('#setting-uiScale').dispatchEvent('input');await p.locator('#settings-close').click();await p.locator('#resume').click();await recapture(p);
 await p.setViewportSize({width:960,height:640});await recapture(p);await visibleWithin(p,'#cycle');await visibleWithin(p,'#map-toggle');await visibleWithin(p,'.bottom-hud');await p.screenshot({path:`${evidence}/after-solo-960x640-scale120.png`});await p.keyboard.press('m');await visibleWithin(p,'.map-sheet');await mapPixels(p,'#full-map');await p.screenshot({path:`${evidence}/after-fullmap-960x640-scale120.png`});await p.keyboard.press('m');await expect(p.locator('#map-screen')).toBeHidden();await recapture(p);
 expect(errors).toEqual([]);await writeFile(`${evidence}/validation.json`,JSON.stringify({renderer:await renderer(p),errors,checkpoints,checks:['solo health 73 HP, 73% green meter and accessible value','transparent clock in left margin','hidden cooperative HUD in solo','square colored high-resolution canvases','responsive 1366x768, 1600x900, 1920x1080, 960x640','960x640 at 120% UI scale','M/Escape close map and restore pointer lock','Tab toggles inventory and restores pointer lock','pause settings and resume']},null,2));
});

async function onlineClients(browser:Browser,errors:string[]){
 const pages:Page[]=[];
 try{
  for(const name of ['Bann','Companheiro']){const context=await browser.newContext({viewport:layouts[0],deviceScaleFactor:1}),p=await context.newPage();pages.push(p);p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));await prepare(p,name);await p.locator('#coop-online').click();await expect(p.locator('#coop-create')).toBeEnabled({timeout:60000});console.log('Photon client connected:',name);}
  const [a,b]=pages;await a.locator('#coop-create').click();await expect(a.locator('#coop-lobby')).toBeVisible();const code=await a.locator('#coop-room-code').innerText();await b.locator('#coop-code-input').fill(code);await b.locator('#coop-join').click();await expect(b.locator('#coop-lobby')).toBeVisible();await b.locator('#coop-ready').click();await expect(a.locator('#coop-start')).toBeEnabled();await a.locator('#coop-start').click();console.log('Photon room started');
  for(const p of pages){await expect.poll(async()=>(await state(p)).network.state,{timeout:60000}).toBe('playing');await expect.poll(async()=>(await state(p)).coop?.revision??0).toBeGreaterThan(0);}
  await a.evaluate(async()=>{const w=(window as any).__LAST_NIGHT__.coopFixture();const {CITY_SITES}=await import('/src/game/city.ts');w.sim.zombies=[];w.sim.activatedSites=new Set(CITY_SITES.map(s=>s.id));w.sim.setPhase('day',0);setInterval(()=>{w.sim.zombies=[];w.sim.setPhase('day',0);},300);});
  for(const [i,p]of pages.entries()){await pose(p,88+i*2);}
  return {pages,code};
 }catch(error){for(const p of pages)await p.context().close();throw error;}
}
async function assertActor(pages:Page[],actor:number,life:string,hp:number){
 for(const p of pages){await expect.poll(async()=>(await state(p)).coop.players.find((v:any)=>v.actor===actor)?.life).toBe(life);await expect.poll(async()=>(await state(p)).coop.players.find((v:any)=>v.actor===actor)?.player.hp).toBe(hp);const row=p.locator(`.coop-player-health[data-actor="${actor}"]`);await expect(row).toHaveAttribute('data-life',life);await expect(row.locator('.coop-player-hp')).toHaveText(`${hp} HP`);await expect(row.locator('[role="meter"]')).toHaveAttribute('aria-valuenow',String(hp));if(life==='downed')await expect(row.locator('.coop-player-state')).toContainText(/Caído/i);if(life==='dead')await expect(row.locator('.coop-player-state')).toContainText(/Morto/i);}
}
test('two real Photon clients: transparent health roster, synchronized life states and pause room details',async({browser})=>{
 test.skip(baseline||!photonConfigured,'Requires configured Photon app and final HUD');
 const errors:string[]=[],checkpoints:any[]=[];await mkdir(evidence,{recursive:true});const {pages,code}=await onlineClients(browser,errors),[a,b]=pages;
 try{
  const actorA=(await state(a)).coop.actor,actorB=(await state(b)).coop.actor;
  for(const p of pages){await recapture(p);await expect(p.locator('#coop-team')).toBeHidden();await expect(p.locator('.coop-player-health')).toHaveCount(2);await expect(p.locator('#coop-health')).toContainText('Bann');await expect(p.locator('#coop-health')).toContainText('Companheiro');await transparentLeft(p,'#coop-health');await transparentLeft(p,'#cycle');await p.locator(`.coop-player-health[data-actor="${actorB}"]`).evaluate(el=>(window as any).__fieldHudStableRow=el);}
  await assertActor(pages,actorA,'alive',100);await assertActor(pages,actorB,'alive',100);
  await recapture(a);
  for(const viewport of layouts.slice(0,3)){await a.setViewportSize(viewport);await recapture(a);const clock=await transparentLeft(a,'#cycle'),roster=await transparentLeft(a,'#coop-health');expect(clock.y+clock.height).toBeLessThanOrEqual(roster.y+1);await visibleWithin(a,'#map-toggle');await a.screenshot({path:`${evidence}/after-coop-${viewport.width}x${viewport.height}.png`});checkpoints.push({viewport,clock,roster});}
  await a.setViewportSize(layouts[0]);await recapture(a);
  await a.evaluate(actor=>{const w=(window as any).__LAST_NIGHT__.coopFixture();w.actors.get(actor).sim.player.invulnerable=0;w.damage(actor,27);},actorB);await assertActor(pages,actorB,'alive',73);
  for(const p of pages)expect(await p.locator(`.coop-player-health[data-actor="${actorB}"]`).evaluate(el=>el===(window as any).__fieldHudStableRow)).toBe(true);
  await a.screenshot({path:`${evidence}/after-coop-damaged.png`});
  await a.keyboard.press('m');await expect(a.locator('#map-screen')).toBeVisible();await mapPixels(a,'#full-map');await a.screenshot({path:`${evidence}/after-coop-fullmap.png`});await a.keyboard.press('Escape');await recapture(a);
  await a.keyboard.press('Escape');await expect(a.locator('#pause-screen')).toBeVisible();await expect(a.locator('#pause-coop-room')).toBeVisible();await expect(a.locator('#pause-coop-code')).toHaveValue(code);await visibleWithin(a,'#pause-coop-copy');await visibleWithin(a,'#pause-coop-invite');await expect(a.locator('#pause-description')).toContainText('companheiros continuam');await a.screenshot({path:`${evidence}/after-coop-pause.png`});await a.locator('#resume').click();await recapture(a);
  await a.evaluate(actor=>{const w=(window as any).__LAST_NIGHT__.coopFixture();w.actors.get(actor).sim.player.invulnerable=0;w.damage(actor,1000);},actorB);await assertActor(pages,actorB,'downed',0);await expect(b.locator('#coop-revive')).toContainText('Você caiu');await a.screenshot({path:`${evidence}/after-coop-downed.png`});
  await a.evaluate(actor=>(window as any).__LAST_NIGHT__.coopFixture().actors.get(actor).bleed=.2,actorB);await assertActor(pages,actorB,'dead',0);await expect(b.locator('#coop-revive')).toContainText('Você morreu');await a.screenshot({path:`${evidence}/after-coop-dead.png`});
  const snapshots=await Promise.all(pages.map(async p=>{const s=await state(p);return {actor:s.coop.actor,network:s.network.state,players:s.coop.players.map((r:any)=>({actor:r.actor,life:r.life,hp:r.player.hp})),revision:s.coop.revision};}));
  expect(errors).toEqual([]);await writeFile(`${evidence}/coop-validation.json`,JSON.stringify({renderer:await renderer(a),transport:'Two real Photon Realtime clients',errors,checkpoints,snapshots,checks:['transparent left roster and clock','center room banner hidden','two actor names and meters','73 HP checkpoint replicated to both accessible meters','stable actor DOM rows across HP updates','downed and dead states replicated with 0 HP and status labels','room code and copy/invite controls in pause','map close and pause resume restore pointer lock']},null,2));
 }finally{for(const p of pages)await p.context().close();}
});
