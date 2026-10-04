import {test,expect} from '@playwright/test';

// Exercise the real HUD and Canvas 2D without starting Three.js or a match.
// This checks invalidation and node identity independently from GPU performance.
test.beforeEach(async({page})=>{
 await page.route('**/ui-render-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="app"></div></body></html>'}));
 await page.goto('/ui-render-fixture');
 await page.evaluate(async()=>{
  const [{HUD},{Simulation}]=await Promise.all([import('/src/ui/hud.ts'),import('/src/game/simulation.ts')]);
  const hud=new HUD(),sim=new Simulation();sim.zombies=[];
  (window as any).__uiFixture={hud,sim};
 });
});

test('ammo updates preserve cartridge nodes and equipment changes still invalidate the HUD',async({page})=>{
 const result=await page.evaluate(async()=>{
  const {hud,sim}=(window as any).__uiFixture,v=hud.variety;
  v.update(sim);const holder=document.querySelector('#cartridges')!,nodes=[...holder.children];
  const observer=new MutationObserver(()=>{});observer.observe(holder,{childList:true});
  sim.ammo=11;v.update(sim);const spent=holder.querySelectorAll('.spent').length;
  const stable=nodes.every((node,index)=>node===holder.children[index]);
  const replaced=observer.takeRecords().length;sim.ammo=12;v.update(sim);
  const refilled=holder.querySelectorAll('.spent').length;
  const {createWeapon}=await import('/src/game/weapons.ts');sim.loadout[0]=createWeapon('smg',44);sim.activeSlot=0;v.update(sim);const smg=holder.children.length;
  hud.root.classList.add('inventory-open');v.tab(true);v.update(sim);sim.gear.owned.push('hammer');sim.gear.melee='hammer';sim.activeSlot=2;v.update(sim);
  const toolSelected=document.querySelector('[data-equipment-melee="hammer"]')?.getAttribute('aria-pressed');const hammerCartridges=holder.children.length;
  sim.activeSlot=1;v.update(sim);observer.disconnect();
  return {initial:nodes.length,stable,replaced,spent,refilled,smg,toolSelected,hammerCartridges,pistol:holder.children.length};
 });
 expect(result).toEqual({initial:12,stable:true,replaced:0,spent:1,refilled:0,smg:30,toolSelected:'true',hammerCartridges:0,pistol:12});
});

test('unchanged hammer frames do not mutate DOM and resource/selection deltas remain immediate',async({page})=>{
 const result=await page.evaluate(async()=>{
  const {hud,sim}=(window as any).__uiFixture,{ConstructionHUD}=await import('/src/ui/construction.ts');
  const construction=new ConstructionHUD(hud.root),placement={kind:'wall',x:-3.5,z:7,level:0,rotation:0,valid:true,reason:''};
  sim.inventory.items.wood=12;sim.inventory.items.scrap=12;construction.update(sim,placement,false,null);
  const art=document.querySelector('#build-art')!.firstChild,cost=document.querySelector('#build-cost')!.firstChild;
  const observer=new MutationObserver(()=>{});observer.observe(hud.root,{childList:true,attributes:true,characterData:true,subtree:true});
  for(let frame=0;frame<120;frame++)construction.update(sim,placement,false,null);
  sim.inventory.items.ammo--;construction.update(sim,placement,false,null);
  const idleMutations=observer.takeRecords().length;
  sim.inventory.items.wood=24;construction.update(sim,placement,false,null);const count=document.querySelector('[data-build-kind="wall"] .build-slot-count')!.textContent;
  const updatedCost=document.querySelector('#build-cost')!.firstChild;
  placement.valid=false;placement.reason='Fora do terreno';construction.update(sim,placement,false,null);
  const artStable=document.querySelector('#build-art')!.firstChild===art,costStable=document.querySelector('#build-cost')!.firstChild===updatedCost;
  const reason=document.querySelector('#build-status')!.textContent;
  placement.kind='window';construction.update(sim,placement,false,null);const selected=document.querySelector('[data-build-kind="window"]')!.getAttribute('aria-pressed');
  construction.update(sim,undefined,false,null);observer.disconnect();
  return {idleMutations,count,artStable,costStable,costChanged:cost!==updatedCost,reason,selected,hidden:(document.querySelector('#build-hotbar') as HTMLElement).hidden};
 });
 expect(result).toEqual({idleMutations:0,count:'4',artStable:true,costStable:true,costChanged:true,reason:'Fora do terreno',selected:'true',hidden:true});
});

test('map cache invalidates on movement, peers, discovery, events, size, fonts and reset',async({page})=>{
 const result=await page.evaluate(async()=>{
  const {sim}=(window as any).__uiFixture,{FieldMap}=await import('/src/ui/map.ts'),{CITY_SITES}=await import('/src/game/city.ts');
  const map=new FieldMap(),canvas=document.createElement('canvas');canvas.width=canvas.height=240;
  const context=canvas.getContext('2d')!,clear=context.clearRect.bind(context);let paints=0;
  context.clearRect=(...args)=>{paints++;clear(...args);};
  const peers=[{x:3,z:4,angle:0,hp:100}];const draw=()=>map.draw(canvas,sim,false,peers);draw();
  for(let i=0;i<20;i++)draw();const stationary=paints;sim.inventory.items.ammo--;draw();const unrelated=paints;
  sim.player.x+=.01;draw();const movement=paints;sim.player.angle+=.01;draw();const facing=paints;
  peers[0].x+=.01;draw();const peerMovement=paints;peers[0].hp=0;draw();const peerDeath=paints;
  for(const site of CITY_SITES)sim.discoveredSites.add(site.id);draw();const discovery=paints;
  sim.worldEvent={kind:'cache',name:'Reserva',x:sim.player.x+5,z:sim.player.z,triggered:false};draw();const event=paints;sim.worldEvent.triggered=true;draw();const eventGone=paints;
  canvas.width=300;draw();const resized=paints;document.fonts.dispatchEvent(new Event('loadingdone'));draw();const font=paints;
  map.reset();draw();const reset=paints;map.draw(canvas,sim,true,peers);const full=paints;map.draw(canvas,sim,true,peers);const fullIdle=paints;
  return {stationary,unrelated,movement,facing,peerMovement,peerDeath,discovery,event,eventGone,resized,font,reset,full,fullIdle};
 });
 expect(result).toEqual({stationary:1,unrelated:1,movement:2,facing:3,peerMovement:4,peerDeath:5,discovery:6,event:7,eventGone:8,resized:9,font:10,reset:11,full:12,fullIdle:12});
});
