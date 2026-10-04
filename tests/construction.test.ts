import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation.ts';
import {FPS} from '../src/game/first-person.ts';
import {rayWorld} from '../src/game/world.ts';
import {RECIPES,craft,usableBench,benchNearby} from '../src/game/crafting.ts';
import {BUILD_PLOT,STRUCTURE_DEFS,structureBoxes,structureFloorHeight,structurePlacement,structurePlacementReason,validStructureRequest,placeStructure,manageStructure,damageStructure,focusedStructure,structureMaxHP} from '../src/game/construction.ts';
import type {Structure,StructureRequest,StructureKind} from '../src/game/construction.ts';
const idle={moveX:0,moveZ:0,aimX:0,aimZ:0,fire:false,run:false,reload:false,interact:false,yaw:0,pitch:0};
const clean=()=>{const s=new Simulation();s.zombies=[];s.spawnTimer=999;s.firstPerson=true;s.gear.owned.push('hammer');s.gear.melee='hammer';s.activeSlot=2;s.inventory.capacity=1000;Object.assign(s.inventory.items,{wood:100,scrap:100,cloth:100,cord:100});s.crafting.tables.push({id:s.crafting.next++,x:4.5,z:8.5,y:.22,angle:0,hp:200});return s;};
const pose=(s:Simulation,x:number,z:number,y=.22)=>Object.assign(s.player,{x,z,eyeY:y+FPS.eyeHeight,crouched:false,angle:0,pitch:0});
const spec=(kind:StructureKind='wall',overrides:Partial<StructureRequest>={}):StructureRequest=>({kind,x:-.5,z:-2,level:0,rotation:0,...overrides});
const seed=(s:Simulation,kind:StructureKind,overrides:Partial<StructureRequest>={}):Structure=>{const r=spec(kind,overrides),p:Structure={...r,id:s.crafting.next++,tier:0,hp:STRUCTURE_DEFS[kind].maxHP,open:false,revision:0};s.crafting.structures.push(p);s.crafting.revision++;return p;};
const step=(s:Simulation,seconds:number,moveX=0,moveZ=0,extra={})=>{for(let i=0;i<seconds*60;i++)s.update(1/60,{...idle,moveX,moveZ,...extra});};

test('grid keeps tall walls on edges and floor tiles entirely inside the shelter plot',()=>{
 assert.equal(validStructureRequest(spec()),true);
 assert.equal(validStructureRequest(spec('wall',{x:-5,z:-6.5,rotation:1})),true);
 assert.equal(validStructureRequest(spec('floor',{x:-3.5,z:-6.5})),true);
 for(const p of [spec('wall',{x:-.4}),spec('wall',{z:11}),spec('floor',{x:BUILD_PLOT.minX,z:-6.5}),spec('wall',{level:3}),spec('wall',{rotation:4 as 0}),spec('wall',{x:NaN})])assert.equal(validStructureRequest(p),false);
});
test('preview snaps deterministically; confirmation alone spends resources once',()=>{
 const s=clean();pose(s,-.5,-5.2);s.player.pitch=-.2;const before={...s.inventory.items};const a=structurePlacement(s,'wall',0,0),b=structurePlacement(s,'wall',0,0);assert.deepEqual(a,b);assert.deepEqual(s.inventory.items,before);
 assert.equal(placeStructure(s,spec()),true,structurePlacementReason(s,spec()));assert.equal(s.inventory.items.wood,before.wood-6);assert.equal(s.inventory.items.scrap,before.scrap-2);const after={...s.inventory.items};assert.equal(placeStructure(s,spec()),false);assert.deepEqual(s.inventory.items,after);
 const atBench=clean();pose(atBench,4.5,6);assert.equal(craft(atBench,'build-wall'),false);assert.equal(atBench.crafting.structures.length,0);assert.equal(atBench.inventory.items.wood,100);assert.ok(RECIPES.every(r=>!r.module&&!r.fortify&&!r.construction&&!r.id.startsWith('build-')));
});
test('host rejects bad snapping, unequipped hammer, occupied footprint and unaffordable plans atomically',()=>{
 const s=clean();pose(s,-.5,-4);const before={...s.inventory.items};assert.equal(placeStructure(s,spec('wall',{x:-.4})),false);pose(s,-.5,-2);assert.equal(placeStructure(s,spec()),false);pose(s,-.5,-4);s.coopTargets=[{...s.player,x:-.5,z:-2}];assert.equal(placeStructure(s,spec()),false);s.coopTargets=[];s.activeSlot=1;assert.equal(placeStructure(s,spec()),false);assert.deepEqual(s.inventory.items,before);
 s.activeSlot=2;s.inventory.items.wood=0;assert.equal(placeStructure(s,spec()),false);assert.equal(s.crafting.structures.length,0);
});
test('upper storeys require connected support and occupied stair openings cannot be roofed over',()=>{
 const s=clean();pose(s,-.5,-4);assert.equal(placeStructure(s,spec('wall',{level:1})),false);assert.equal(placeStructure(s,spec('roof',{z:-.5})),false);
 seed(s,'wall');pose(s,-.5,-.5);assert.equal(placeStructure(s,spec('roof',{z:-.5})),true);pose(s,-.5,-.5,3.22);assert.equal(placeStructure(s,spec('wall',{level:1,z:1})),true);
 const stairs=clean();pose(stairs,-.5,-4);seed(stairs,'stairs',{z:-.5});assert.match(structurePlacementReason(stairs,spec('roof',{z:-.5})),/abertura|apoio/);
});
test('window opening passes bullets while tall wall and window sill stop them',()=>{
 const s=clean(),p=seed(s,'window');const boxes=structureBoxes(p),o={x:-.5,y:1.94,z:-5},dir={x:0,y:0,z:1};assert.equal(rayWorld(o,dir,4,boxes),4);assert.ok(rayWorld({...o,y:.8},dir,4,boxes)<4);
 const wall=structureBoxes({...p,kind:'wall'});assert.ok(rayWorld({...o,y:2.85},dir,4,wall)<4);
 assert.equal(Math.max(...wall.map(b=>(b.bottom??0)+(b.h??0))),3.22);
});
test('doors preserve a usable opening, rotate their collision leaf and reject closing on survivors',()=>{
 const s=clean();pose(s,-.5,-4);const p=seed(s,'door');assert.equal(manageStructure(s,p.id,0,'toggle'),true);assert.equal(p.open,true);const dir={x:0,y:0,z:1},o={x:-.5,y:1.94,z:-4};assert.equal(rayWorld(o,dir,4,structureBoxes(p)),4);assert.equal(focusedStructure(s)?.id,p.id);
 pose(s,-.5,-2);assert.equal(manageStructure(s,p.id,p.revision,'toggle'),false);assert.equal(p.open,true);pose(s,-.5,-4);assert.equal(manageStructure(s,p.id,p.revision,'toggle'),true);
});
test('fortification consumes requested carried materials, rejects stale revisions, and repairs to the correct tier cap',()=>{
 const s=clean();pose(s,-.5,-4);const p=seed(s,'wall'),wood=s.inventory.items.wood;assert.equal(manageStructure(s,p.id,0,'fortify'),true);assert.equal(p.tier,1);assert.equal(p.hp,structureMaxHP(p));assert.equal(s.inventory.items.wood,wood-3);assert.equal(manageStructure(s,p.id,0,'fortify'),false);assert.equal(manageStructure(s,p.id,p.revision,'fortify'),true);assert.equal(p.tier,2);assert.equal(manageStructure(s,p.id,p.revision,'fortify'),false);
 damageStructure(s,p.id,250);assert.equal(manageStructure(s,p.id,p.revision,'repair'),true);assert.equal(p.hp,structureMaxHP(p));
});
test('support cannot be dismantled under an occupied storey; destruction removes dependent floating structures',()=>{
 const s=clean();pose(s,-.5,-4);const wall=seed(s,'wall'),roof=seed(s,'roof',{z:-.5});seed(s,'wall',{z:1,level:1});assert.equal(manageStructure(s,wall.id,wall.revision,'dismantle'),false);damageStructure(s,wall.id,1000);assert.equal(s.crafting.structures.length,0);assert.equal(s.solidDefenses.some(b=>b.id.startsWith(`structure-${roof.id}-`)),false);
});
test('stairs ascend and descend without jumping, including crouched and rotated movement',()=>{
 for(const [rotation,dx,dz] of [[0,0,1],[1,1,0],[2,0,-1],[3,-1,0]] as const){
  const s=clean();const p=seed(s,'stairs',{x:-.5,z:-3.5,rotation});seed(s,'floor',{x:p.x+dx*3,z:p.z+dz*3,level:1});pose(s,p.x-dx*1.7,p.z-dz*1.7);step(s,1.25,dx,dz);assert.ok(s.groundY>=3.2,`${rotation} ascent y=${s.groundY}, xz=${s.player.x},${s.player.z}`);step(s,1.2,-dx,-dz);assert.ok(s.groundY<.5,`${rotation} descent ${s.groundY}`);
 }
 const s=clean();seed(s,'stairs',{x:-.5,z:-3.5});seed(s,'floor',{x:-.5,z:-.5,level:1});pose(s,-.5,-5.2);step(s,2.1,0,1,{crouch:true});assert.ok(s.groundY>=3.2);
});
test('stairs reject high-side entry and upper floor/walls do not block ground-floor travel',()=>{
 const s=clean();seed(s,'stairs',{x:-.5,z:-3.5});pose(s,1.2,-2.2);step(s,.8,-1,0);assert.ok(s.player.x>.85,`entered high stair side at ${s.player.x}`);assert.ok(s.groundY<.5);
 const t=clean();seed(t,'wall',{x:-.5,z:-2,level:1});seed(t,'roof',{x:-.5,z:-.5});pose(t,-.5,-4);step(t,.8,0,1);assert.ok(t.player.z>-2);assert.ok(t.groundY<.5);assert.equal(structureFloorHeight(t,{x:-.5,z:-.5},.22),.22);
});
test('stepping off a roof cannot embed survivors in its supporting wall or furniture below',()=>{
 for(const obstacle of ['wall','chest'] as const){
  const s=clean();seed(s,'roof',{x:-.5,z:-.5});
  if(obstacle==='wall')seed(s,'wall',{x:1,z:-.5,rotation:1});
  else s.crafting.chests.push({id:s.crafting.next++,x:1.5,z:-.5,y:.22,angle:0,revision:0,slots:[]});
  s.crafting.revision++;pose(s,.98,-.5,3.22);step(s,.3,1,0);
  assert.ok(s.player.x<=1.015,`${obstacle} fall embedded survivor at ${s.player.x}`);
  assert.ok(s.groundY>3,`${obstacle} fall lost roof support`);
  step(s,.3,-1,0);assert.ok(s.player.x<.8,`${obstacle} prevented retreat from the edge`);
 }
});
test('wall contact blocks movement at both endpoints and hits route to authoritative durability',()=>{
 const s=clean();pose(s,-.5,-4);const p=seed(s,'wall');step(s,1,0,1);assert.ok(s.player.z<-2.45);pose(s,.94,-4);step(s,1,0,1);assert.ok(s.player.z<-2.3);
 pose(s,-.5,-4);s.activeSlot=1;s.shotTimer=0;const hp=p.hp;s.shoot();assert.ok(p.hp<hp);assert.ok(s.events.some(e=>e.type==='barricade-hit'));
});
test('empty old anchor positions no longer expose a phantom build interaction',()=>{
 const s=clean();pose(s,1,7.2);s.player.pitch=Math.atan2(.2-1.94,1.8);s.update(.016,{...idle,pitch:s.player.pitch,interact:true});assert.notEqual(s.focus?.kind,'defense');assert.equal(s.action,null);assert.ok(s.barricades.every(b=>!b.hp));
});

test('crouching and standing preserve upper-floor support after camera interpolation',()=>{
 const s=clean();seed(s,'floor',{x:-.5,z:-.5,level:1});pose(s,-.5,-.5,3.22);step(s,.6,0,0,{crouch:true});assert.ok(Math.abs(s.groundY-3.22)<.001);assert.ok(Math.abs(s.player.eyeY-4.3)<.01);step(s,.6);assert.ok(Math.abs(s.groundY-3.22)<.001);assert.ok(Math.abs(s.player.eyeY-4.94)<.01);
});

test('workstations on another storey do not unlock recipes or management through the floor',()=>{
 const s=clean();const t=s.crafting.tables[0];t.x=-.5;t.z=-.5;seed(s,'floor',{x:-.5,z:-.5,level:1});pose(s,-.5,-.5,3.22);assert.equal(usableBench(s,t.id),false);assert.equal(benchNearby(s),false);t.y=3.22;s.crafting.revision++;assert.equal(usableBench(s,t.id),true);
});


test('building requires the owned hammer in hand but remains available after reclaiming the workbench',()=>{
 const s=clean();pose(s,-.5,-4);s.crafting.tables=[];
 for(const slot of [0,1,3] as const){s.activeSlot=slot;assert.equal(s.buildingHammerEquipped,false);assert.match(structurePlacementReason(s,spec()),/martelo/);}
 s.activeSlot=2;s.gear.owned=['fists'];assert.equal(s.buildingHammerEquipped,false);assert.equal(placeStructure(s,spec()),false);
 s.gear.owned.push('hammer');s.gear.melee='fists';assert.equal(s.buildingHammerEquipped,false);assert.equal(placeStructure(s,spec()),false);
 s.gear.melee='hammer';assert.equal(s.buildingHammerEquipped,true);assert.equal(placeStructure(s,spec()),true);assert.equal(s.crafting.structures.length,1);
});
