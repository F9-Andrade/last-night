import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation.ts';
import {craft,craftReason,MELEE,RECIPES,placeBench,reclaimBench,harvest,absorb,infectedLoot,updateCraftWorld,benchNearby} from '../src/game/crafting.ts';
import type {MeleeId} from '../src/game/crafting.ts';
import {placeStructure,manageStructure,structureMaxHP,STRUCTURE_DEFS} from '../src/game/construction.ts';
import {emptyStock} from '../src/game/inventory.ts';
import {collides,TREE_TRUNKS} from '../src/game/world.ts';
import {CoopWorld} from '../src/network/coop-world.ts';
import {parseCheckpoint,stateHash} from '../src/network/checkpoint.ts';
import {parseAction,poseOf,shotSeed} from '../src/network/gameplay-protocol.ts';
import {createPatch,applyPatch} from '../src/network/world-patch.ts';
const clean=()=>{const s=new Simulation();s.zombies=[];return s;};
const fund=(s:Simulation)=>{Object.assign(s.inventory.items,{wood:100,scrap:100,hide:100,cloth:100,cord:100,rare:20});};
const table=(s:Simulation)=>s.crafting.tables.push({id:s.crafting.next++,x:s.player.x-1,z:s.player.z,y:.22,angle:0,hp:200});
test('manual craft is atomic, respects weight, carried resources and advanced recipe gating',()=>{
 const s=clean();const before={...s.inventory.items};assert.equal(craft(s,'bench'),false);assert.deepEqual(s.inventory.items,before);Object.assign(s.inventory.items,{wood:10,scrap:10,cord:1});assert.equal(craft(s,'bench'),true);assert.equal(s.inventory.items.bench,1);assert.equal(s.inventory.items.wood,4);assert.equal(craft(s,'axe'),false);table(s);assert.equal(craft(s,'axe'),true);assert.equal(s.gear.melee,'axe');assert.equal(craft(s,'axe'),false);
 s.player.x=10;assert.equal(craft(s,'cord'),false);s.inventory.items.wood=100;assert.match(craftReason(s,RECIPES[0]),/Materiais|espaço/);
});
test('bench placement validates ground, obstruction, kit count and shared limit before spending',()=>{
 const s=clean();s.inventory.items.bench=2;s.player.angle=0;s.player.x=1;s.player.z=12;assert.equal(placeBench(s),true);assert.equal(s.crafting.tables.length,1);assert.equal(placeBench(s),false);assert.equal(s.inventory.items.bench,1);assert.ok(collides(s.crafting.tables[0],.3,s.solidDefenses));
 s.player.x=1;s.player.z=4;s.player.angle=Math.PI;assert.equal(placeBench(s),false);assert.equal(s.inventory.items.bench,1);
});
test('workbench behind a constructed wall does not unlock recipes',()=>{
 const s=clean();s.player.x=1;s.player.z=8;const gate=s.barricades.find(b=>b.id==='gate')!;gate.hp=300;gate.built=true;s.crafting.tables.push({id:1,x:1,z:10,y:.22,angle:0,hp:200});assert.equal(benchNearby(s),false);
 s.crafting.tables[0].x=-25;s.crafting.tables[0].z=-6;assert.equal(benchNearby(s),false);
});
test('unarmed and melee selection consume stamina without spending ammunition or emitting gun effects',()=>{
 const s=clean();s.switchWeapon(3);s.switchTimer=0;s.player.angle=0;const ammo=s.loadout[1]!.magazine;const z=s.spawn({x:1,z:8.7})!;s.shoot();assert.ok(z.hp<90);assert.equal(s.loadout[1]!.magazine,ammo);assert.equal(s.player.stamina,92);assert.ok(s.events.some(e=>e.type==='melee'));assert.equal(s.events.some(e=>e.type==='shot'),false);s.reload();assert.equal(s.reloadTimer,0);s.shotTimer=0;s.player.stamina=0;const hp=z.hp;s.shoot();assert.equal(z.hp,hp);
});
test('harvesting removes tree collision and renews at a randomized time outside survivor proximity',()=>{
 const s=clean();const t=s.crafting.trees.find(t=>t.x===-7&&t.z===-10)!;Object.assign(s.player,{x:-7,z:-8.3,angle:Math.PI,pitch:0,eyeY:1.94});s.activeSlot=3;const wood=s.inventory.items.wood;for(let i=0;i<9;i++)assert.equal(harvest(s),true);assert.equal(t.hp,0);assert.ok(s.inventory.items.wood>=wood+4);assert.ok(t.ready>=240&&t.ready<=480);assert.equal(s.solidDefenses.some(b=>b.id===`tree-${t.id}`),false);updateCraftWorld(s,500);assert.equal(t.hp,0);s.player.x=30;s.player.z=13;updateCraftWorld(s,1);assert.equal(t.hp,100);assert.equal(harvest(s),false);
});
test('armor absorbs bounded damage, wears out, upgrades and repairs without invulnerability',()=>{
 const s=clean();fund(s);table(s);assert.equal(craft(s,'leather'),true);assert.equal(absorb(s,50),40);assert.equal(s.gear.armor,70);assert.equal(craft(s,'armor-repair'),true);assert.equal(s.gear.armor,80);assert.equal(craft(s,'reinforced'),true);assert.equal(absorb(s,100),68);s.gear.armor=2;assert.equal(absorb(s,50),48);assert.equal(absorb(s,50),50);assert.equal(craft(s,'pack'),true);assert.equal(s.inventory.capacity,20);assert.equal(craft(s,'pack'),false);
});
test('infected loot is unique, finite, includes hide and cannot be renewed like map containers',()=>{
 const s=clean();const z=s.spawn({x:1,z:14})!;infectedLoot(s,z);infectedLoot(s,z);const bags=s.loot.filter(l=>l.id===`infected-${z.id}`);assert.equal(bags.length,1);assert.ok(bags[0].contents.hide>0);bags[0].contents=emptyStock();updateCraftWorld(s,1000);assert.equal(bags[0].searched,true);
});
test('empty map loot renews only after cooldown and out of view; leftovers persist',()=>{
 const s=clean(),l=s.loot.find(l=>l.id==='market-locker')!;l.searched=true;l.contents=emptyStock();updateCraftWorld(s,1);assert.ok(s.crafting.refills[l.id]>=361);l.contents.scrap=2;updateCraftWorld(s,1000);assert.equal(l.contents.scrap,2);assert.equal(l.searched,true);l.contents=emptyStock();updateCraftWorld(s,1);assert.equal(l.searched,false);assert.equal(l.restocked,true);
});
test('bed starts exposed and modular plans preserve materials until placement is confirmed',()=>{
 const s=clean();assert.ok(s.barricades.every(b=>b.hp===0));assert.equal(collides({x:1,z:-4}),false);fund(s);table(s);assert.equal(craft(s,'hammer'),true);const before={...s.inventory.items};assert.equal(craft(s,'build-wall'),false);assert.deepEqual(s.inventory.items,before);Object.assign(s.player,{x:-.5,z:-4,eyeY:1.94});assert.equal(placeStructure(s,{kind:'wall',x:-.5,z:-2,level:0,rotation:0}),true);assert.ok(collides({x:-.5,z:-2},.45,s.solidDefenses));assert.equal(placeStructure(s,{kind:'wall',x:-.5,z:-2,level:0,rotation:0}),false);
});
test('coop crafting, melee, armor and world survive patches and host migration without duplication',()=>{
 const w=new CoopWorld(44,[1,2]);w.sim.zombies=[];const a=w.actors.get(1)!;fund(a.sim);table(w.sim); // put shared table by actor explicitly
 w.sim.crafting.tables[0].x=a.sim.player.x-1;w.sim.crafting.tables[0].z=a.sim.player.z;
 const request=(seq:number,details:object)=>({seq,pose:poseOf(a.sim.player,0,seq),...details});
 assert.ok(w.request(1,parseAction(request(1,{kind:'craft',recipe:'leather'}))!));assert.ok(w.request(1,parseAction(request(2,{kind:'craft',recipe:'axe'}))!));
 const c=w.checkpoint();assert.ok(parseCheckpoint(c));assert.equal(c.players[0].activeSlot,2);const copy=CoopWorld.restore(44,c,[1,2]);assert.equal(copy.actors.get(1)!.sim.gear.armor,80);assert.equal(copy.actors.get(1)!.sim.gear.melee,'axe');assert.equal(copy.sim.crafting.trees.length,TREE_TRUNKS.length);
 const next=w.checkpoint();assert.equal(stateHash(applyPatch(c,createPatch(c,next))!),stateHash(next));assert.equal(w.request(1,parseAction(request(2,{kind:'craft',recipe:'axe'}))!),false);
 const bad=structuredClone(c);bad.survival.crafting.trees[0].x+=1;assert.equal(parseCheckpoint(bad),null);assert.equal(parseAction(request(3,{kind:'craft',recipe:'__proto__'})),null);
});
test('coop accepts authorized punches without gun ammunition and rejects rapid repeat attacks',()=>{
 const w=new CoopWorld(12,[1]);const a=w.actors.get(1)!;a.sim.activeSlot=3;a.sim.loadout[1]!.magazine=0;
 const r={kind:'fire' as const,seq:1,shot:1,weapon:'pistol' as const,seed:shotSeed(1,1),ads:false,bloom:0,kick:0,pose:poseOf(a.sim.player,0,0)};
 assert.equal(w.request(1,r),true);assert.equal(w.request(1,{...r,seq:2,shot:2,seed:shotSeed(1,2)}),false);assert.equal(a.sim.player.stamina,92);
});
test('coop night clock, base HP and prefabs transfer to the next host',()=>{
 const w=new CoopWorld(13,[1,2]);w.sim.setPhase('preparation',29.9);w.step(.2);assert.equal(w.sim.phase,'night');w.sim.baseHP=812;const c=w.checkpoint();const next=CoopWorld.restore(13,c,[2]);assert.equal(next.sim.phase,'night');assert.equal(next.sim.baseHP,812);assert.equal(next.sim.horde.budget,w.sim.horde.budget);assert.equal(next.sim.horde.spawned,w.sim.horde.spawned);
});

test('crafted guns start empty and preserve the replaced gun and its loaded rounds',()=>{
 const s=clean();fund(s);table(s);assert.equal(craft(s,'pistol'),true);assert.equal(s.ammo,0);assert.ok(s.groundWeapons.some(g=>g.item.uid===0&&g.item.magazine===12));assert.equal(s.inventory.items.ammo,60);
});
test('workstations can be recovered once or destroyed by infected without an infinite blockade',()=>{
 const s=clean();s.inventory.items.bench=1;Object.assign(s.player,{x:1,z:12,angle:0});assert.equal(placeBench(s),true);assert.equal(reclaimBench(s),true);assert.equal(reclaimBench(s),false);assert.equal(s.inventory.items.bench,1);assert.equal(placeBench(s),true);let b=s.solidDefenses.find(b=>b.id.startsWith('table-'))!;s.damageBarricade(b,100);assert.equal(s.crafting.tables[0].hp,100);assert.equal(reclaimBench(s),false);b=s.solidDefenses.find(b=>b.id.startsWith('table-'))!;s.damageBarricade(b,100);assert.equal(s.crafting.tables.length,0);assert.equal(s.solidDefenses.some(b=>b.id.startsWith('table-')),false);
});
test('an infected between fists and a tree receives the strike before the trunk',()=>{
 const s=clean();s.activeSlot=3;s.firstPerson=true;Object.assign(s.player,{x:8.8,z:2.8,angle:Math.PI,pitch:0,eyeY:1.94});const z=s.spawn({x:8.8,z:2.05})!;const t=s.crafting.trees.find(t=>t.x===8.8&&t.z===1)!;s.shoot();assert.ok(z.hp<90);assert.equal(t.hp,100);
});
test('modular doorways cannot intersect a placed workstation or another survivor',()=>{
 const s=clean();fund(s);Object.assign(s.player,{x:-.5,z:-4,eyeY:1.94});table(s);assert.equal(craft(s,'hammer'),true);s.crafting.tables.push({id:s.crafting.next++,x:-.5,z:-2,y:.22,angle:0,hp:200});const p={kind:'door' as const,x:-.5,z:-2,level:0,rotation:0 as const};assert.equal(placeStructure(s,p),false);s.crafting.tables.pop();s.coopTargets=[{...s.player,x:-.5,z:-2}];assert.equal(placeStructure(s,p),false);s.coopTargets=[];assert.equal(placeStructure(s,p),true);
});
test('renewal tracks only authored caches and stays within bounded checkpoint dictionaries',()=>{
 const w=new CoopWorld(18,[1,2,3,4]);for(const l of w.sim.loot){l.searched=true;l.contents=emptyStock();}w.sim.loot.push({id:'reward-1-1',x:1,z:7,area:'outside',label:'Restos',searched:true,lastFound:null,contents:emptyStock()});updateCraftWorld(w.sim,1);assert.ok(Object.keys(w.sim.crafting.refills).length<=64);assert.equal(w.sim.crafting.refills['reward-1-1'],undefined);assert.ok(parseCheckpoint(w.checkpoint()));
});

test('only the table can be crafted without a workstation, including basic materials',()=>{
 const s=clean();fund(s);for(const id of ['cord','club','bandage','repair'])assert.match(craftReason(s,RECIPES.find(r=>r.id===id)!),/mesa/);s.inventory.items={...emptyStock(),wood:6,scrap:3};assert.equal(craft(s,'bench'),true);
});
test('workbench focus follows aim, walls block access and placement follows yaw and pitch',async()=>{
 const {focusedBench,placement}=await import('../src/game/crafting.ts');const s=clean();Object.assign(s.player,{x:1,z:12,angle:0,pitch:0,eyeY:1.72});s.inventory.items.bench=1;const a=placement(s);s.player.pitch=-.45;const b=placement(s);assert.ok(b.z>a.z);s.player.pitch=0;assert.equal(placeBench(s),true);assert.equal(focusedBench(s),s.crafting.tables[0].id);s.player.angle=Math.PI;assert.equal(focusedBench(s),undefined);
});
test('fortifications have two paid tiers, persist in coop and repair to the correct cap',()=>{
 const w=new CoopWorld(73,[1,2]);const s=w.actors.get(1)!.sim;fund(s);table(s);assert.equal(craft(s,'hammer'),true);Object.assign(s.player,{x:-.5,z:-4,eyeY:1.94});assert.equal(placeStructure(s,{kind:'wall',x:-.5,z:-2,level:0,rotation:0}),true);const b=s.crafting.structures[0];assert.equal(manageStructure(s,b.id,b.revision,'fortify'),true);assert.equal(b.hp,540);assert.equal(manageStructure(s,b.id,b.revision,'fortify'),true);assert.equal(b.hp,900);const costs={...s.inventory.items};assert.equal(manageStructure(s,b.id,b.revision,'fortify'),false);assert.deepEqual(s.inventory.items,costs);const restored=CoopWorld.restore(73,w.checkpoint(),[1,2]);assert.equal(restored.sim.crafting.structures[0].tier,2);assert.equal(structureMaxHP(b),900);
});
test('gate presentation rotates continuously and is frame-rate independent',async()=>{
 const {gateStep}=await import('../src/game/defenses.ts');const a=gateStep(0,true,1/60);assert.ok(a>0&&a<Math.PI/2);let x=0,y=0;for(let i=0;i<30;i++)x=gateStep(x,true,1/30);for(let i=0;i<144;i++)y=gateStep(y,true,1/144);assert.ok(Math.abs(x-y)<1e-8);assert.ok(gateStep(x,false,1/60)<x);
});
test('modular traps damage and slow infected, consume durability, create one loot bag and preserve survivors',()=>{
 const s=clean();s.firstPerson=true;fund(s);table(s);const victim=s.spawn({x:-.5,z:5.5})!;assert.ok(victim);victim.hp=10;const b={id:s.crafting.next++,kind:'spikes' as const,x:-.5,z:5.5,level:0,rotation:0 as const,hp:STRUCTURE_DEFS.spikes.maxHP,tier:0 as const,open:false,revision:0};s.crafting.structures.push(b);s.crafting.revision++;const hp=s.player.hp;s.update(1/60,{moveX:0,moveZ:0,aimX:1,aimZ:20,fire:false,run:false,reload:false,interact:false});assert.equal(victim.active,false);assert.equal(b.hp,195);assert.equal(s.player.hp,hp);assert.equal(s.loot.filter(l=>l.id===`infected-${victim.id}`).length,1);
});
test('table maintenance has an exact cost and cannot grant free repair by repacking',()=>{
 const s=clean();fund(s);table(s);s.crafting.tables[0].hp=80;assert.equal(reclaimBench(s),false);assert.equal(craft(s,'bench-repair'),true);assert.equal(s.crafting.tables[0].hp,160);assert.equal(craft(s,'bench-repair'),true);assert.equal(s.crafting.tables[0].hp,200);assert.equal(craft(s,'bench-repair'),false);
});
test('expanded city is sixteen times the area, has playable destinations and accepts remote positions',async()=>{
 const {CITY_LIMIT,CITY_SITES}=await import('../src/game/city.ts');const {parseSnapshot,encodeSnapshot}=await import('../src/network/protocol.ts');const {findPath,BASE}=await import('../src/game/world.ts');assert.equal((CITY_LIMIT/156)**2,16);assert.equal(CITY_SITES.length,92);const site=CITY_SITES.at(-1)!;assert.ok(findPath(BASE,{x:site.x,z:site.z+site.d/2+3}).length);assert.ok(parseSnapshot(encodeSnapshot({...poseOf({...clean().player,x:590,z:-590},0,0)})));assert.equal(parseSnapshot(encodeSnapshot({...poseOf({...clean().player,x:630,z:0},0,0)})),null);
});
test('expanded trees use sparse network patches and preserve changed harvest state',()=>{
 const w=new CoopWorld(99,[1,2,3,4]),a=w.checkpoint();w.sim.crafting.trees.at(-1)!.hp=0;w.sim.crafting.trees.at(-1)!.ready=400;const b=w.checkpoint(),patch=createPatch(a,b);assert.equal(patch.survival.trees.upsert.length,1);assert.ok(JSON.stringify(patch).length<12000);assert.equal(stateHash(applyPatch(a,patch)!),stateHash(b));
});

test('armored infected resist torso fire while bloater death leaves one bounded acid pool',()=>{
 const shoot=(kind:'walker'|'armored'|'bloater',fatal=false)=>{const s=clean();Object.assign(s.player,{x:88,z:-30,angle:0});const z=s.spawn({x:88,z:-26},kind)!;if(fatal)z.hp=1;const hp=z.hp;s.shoot();return {s,z,damage:hp-z.hp};};
 const a=shoot('walker'),b=shoot('armored');assert.ok(a.damage>0);assert.ok(b.damage<a.damage);const c=shoot('bloater',true);assert.equal(c.z.active,false);assert.equal(c.s.acids.length,1);assert.equal(c.s.loot.filter(l=>l.id===`infected-${c.z.id}`).length,1);
});
test('stalker telegraphs a charge and a strong shot interrupts the preparation',()=>{
 const s=clean();Object.assign(s.player,{x:88,z:-30,angle:0});const z=s.spawn({x:88,z:-21},'stalker')!;z.spitCooldown=0;const idle={moveX:0,moveZ:0,aimX:88,aimZ:-21,fire:false,run:false,reload:false,interact:false};s.update(.05,idle);assert.ok(z.chargeTarget);assert.ok(z.windup>0);const position={x:z.x,z:z.z};s.update(.1,idle);assert.deepEqual({x:z.x,z:z.z},position);s.shoot();assert.equal(z.chargeTarget,undefined);assert.ok(z.spitCooldown>0);
});


test('hammer is a single paid workstation tool, equips on craft and replaces construction recipes',()=>{
 const s=clean();s.inventory.items={...emptyStock(),wood:3,scrap:5,cloth:1};const before={...s.inventory.items};
 assert.equal(craft(s,'hammer'),false);assert.deepEqual(s.inventory.items,before);table(s);
 assert.equal(craft(s,'hammer'),true);assert.equal(s.gear.melee,'hammer');assert.equal(s.activeSlot,2);assert.equal(s.buildingHammerEquipped,true);
 assert.deepEqual(s.inventory.items,emptyStock());assert.equal(craft(s,'hammer'),false);assert.deepEqual(s.gear.owned,['fists','hammer']);
 assert.equal(RECIPES.filter(r=>r.id==='hammer').length,1);assert.ok(RECIPES.every(r=>!r.construction));
});

test('hammer cannot damage infected, harvest trees or spend ammunition and stamina',()=>{
 const s=clean();s.gear.owned.push('hammer');s.gear.melee='hammer';s.activeSlot=2;s.switchTimer=0;s.player.angle=0;
 const z=s.spawn({x:1,z:8.7})!,hp=z.hp,ammo=s.loadout[1]!.magazine,stamina=s.player.stamina;s.events=[];s.shoot();
 assert.equal(z.hp,hp);assert.equal(s.player.stamina,stamina);assert.equal(s.loadout[1]!.magazine,ammo);assert.equal(s.shotTimer,0);assert.equal(s.events.length,0);
 Object.assign(s.player,{x:-7,z:-8.3,angle:Math.PI,pitch:0,eyeY:1.94});const tree=s.crafting.trees.find(t=>t.x===-7&&t.z===-10)!;
 assert.equal(harvest(s),false);s.shoot();assert.equal(tree.hp,100);assert.equal(s.events.length,0);
 s.activeSlot=3;assert.equal(harvest(s),true);assert.ok(tree.hp<100,'bare fists remain usable after putting the hammer away');
});

test('coop crafts hammer once, rejects hammer attacks and preserves all seven tools on migration',()=>{
 const w=new CoopWorld(44,[1,2]),a=w.actors.get(1)!;w.sim.zombies=[];a.sim.inventory.items={...emptyStock(),wood:3,scrap:5,cloth:1};table(a.sim);
 const request=(seq:number,details:object)=>parseAction({seq,pose:poseOf(a.sim.player,a.sim.groundY,seq),...details})!;
 assert.ok(w.request(1,request(1,{kind:'craft',recipe:'hammer'})));assert.equal(a.sim.buildingHammerEquipped,true);assert.deepEqual(a.sim.inventory.items,emptyStock());
 assert.equal(w.request(1,request(2,{kind:'craft',recipe:'hammer'})),false);assert.equal(a.sim.gear.owned.filter(k=>k==='hammer').length,1);
 assert.equal(w.request(1,request(3,{kind:'fire',shot:1,weapon:'pistol',seed:shotSeed(1,1),ads:false,bloom:0,kick:0})),false);assert.equal(a.sim.player.stamina,100);
 a.sim.gear.owned=Object.keys(MELEE) as MeleeId[];const snapshot=w.checkpoint();assert.ok(parseCheckpoint(snapshot));
 const copy=CoopWorld.restore(44,snapshot,[1,2]);assert.deepEqual(copy.actors.get(1)!.sim.gear,a.sim.gear);assert.equal(copy.actors.get(1)!.sim.buildingHammerEquipped,true);
 const promoted=CoopWorld.fromSolo(copy.actors.get(1)!.sim,1);assert.equal(promoted.actors.get(1)!.sim.buildingHammerEquipped,true);assert.ok(parseCheckpoint(promoted.checkpoint()));
 const bad=structuredClone(snapshot);bad.players[0].gear.owned=bad.players[0].gear.owned.filter(k=>k!=='hammer');assert.equal(parseCheckpoint(bad),null);
});
