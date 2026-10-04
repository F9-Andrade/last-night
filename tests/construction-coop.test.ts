import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CoopWorld} from '../src/network/coop-world.ts';
import {parseAction,poseOf} from '../src/network/gameplay-protocol.ts';
import type {ActionRequest} from '../src/network/gameplay-protocol.ts';
import {parseCheckpoint,stateHash} from '../src/network/checkpoint.ts';
import {createPatch,applyPatch} from '../src/network/world-patch.ts';
import {furniturePlacement} from '../src/game/relocation.ts';
import {structureFloorHeight,structureMaxHP,structureMovementBoxes} from '../src/game/construction.ts';
import type {Structure,StructureRequest} from '../src/game/construction.ts';
import {collides} from '../src/game/world.ts';
import {spawnFor} from '../src/network/protocol.ts';
import {emptyStock} from '../src/game/inventory.ts';

const fixture=()=>{const w=new CoopWorld(420,[1,2]);w.sim.zombies=[];w.sim.spawnTimer=10000;for(const a of w.actors.values()){a.sim.inventory.items={...emptyStock(),wood:150,scrap:150,cloth:150,cord:150};a.sim.player.invulnerable=100;a.sim.gear.owned.push('hammer');a.sim.gear.melee='hammer';a.sim.activeSlot=2;}return w;};
function submit(w:CoopWorld,actor:number,details:object,sequence?:number){const a=w.actors.get(actor)!,request=parseAction({...details,seq:sequence??a.lastSeq+1,pose:poseOf(a.sim.player,a.sim.groundY,w.time*1000)});assert.ok(request,'the request must satisfy the bounded wire schema');return w.request(actor,request);}
function actorAt(w:CoopWorld,actor:number,x:number,z:number){const s=w.actors.get(actor)!.sim;Object.assign(s.player,{x,z,angle:0,pitch:0,crouched:false});s.player.eyeY=structureFloorHeight(s,s.player,0)+1.72;return s;}
const wall:StructureRequest={kind:'wall',x:-3.5,z:1,level:0,rotation:0};
function addStructure(w:CoopWorld,p:StructureRequest){const s={...p,id:w.sim.crafting.next++,hp:1,tier:0,open:false,revision:0} as Structure;s.hp=structureMaxHP(s);w.sim.crafting.structures.push(s);w.sim.crafting.revision++;return s;}

test('construction requests reject malformed kinds, unsnapped positions, out-of-plot destinations and invalid operations',()=>{
 const w=fixture(),s=w.actors.get(1)!.sim,base={seq:1,pose:poseOf(s.player,s.groundY,0)};
 assert.ok(parseAction({...base,kind:'place-structure',placement:wall}));
 for(const placement of [{...wall,kind:'__proto__'},{...wall,x:NaN},{...wall,x:wall.x+.1},{...wall,x:100},{...wall,level:3},{...wall,rotation:4}])assert.equal(parseAction({...base,kind:'place-structure',placement}),null);
 for(const details of [{kind:'manage-structure',id:1,revision:-1,operation:'fortify'},{kind:'manage-structure',id:1,revision:0,operation:'destroy-all'},{kind:'relocate-furniture',id:1,revision:0,furniture:'bed',placement:{x:0,z:0,y:0,angle:0}},{kind:'place-furniture',furniture:'chest',placement:{x:0,z:0,y:99,angle:0}}])assert.equal(parseAction({...base,...details}),null);
});

test('coordinator places a paid wall once, rejects replay and concurrent overlap without charging twice',()=>{
 const w=fixture(),s=actorAt(w,1,-3.5,4),b=actorAt(w,2,-1,4);
 s.crafting.tables.push({id:s.crafting.next++,x:-1,z:6,y:.22,angle:0,hp:200});
 const before={...s.inventory.items};assert.ok(submit(w,1,{kind:'place-structure',placement:wall}));assert.equal(w.sim.crafting.structures.length,1);assert.ok(s.inventory.items.wood<before.wood);
 const paid={...s.inventory.items};assert.equal(submit(w,1,{kind:'place-structure',placement:wall},1),false);assert.deepEqual(s.inventory.items,paid);
 const other={...b.inventory.items};assert.equal(submit(w,2,{kind:'place-structure',placement:wall}),false);assert.deepEqual(b.inventory.items,other);assert.equal(w.sim.crafting.structures.length,1);
});

test('structure revisions make fortification atomic and remote survivors cannot strengthen distant pieces',()=>{
 const w=fixture(),s=actorAt(w,1,-3.5,3),piece=addStructure(w,wall);actorAt(w,2,50,50);
 assert.equal(submit(w,2,{kind:'manage-structure',id:piece.id,revision:0,operation:'fortify'}),false);
 assert.ok(submit(w,1,{kind:'manage-structure',id:piece.id,revision:0,operation:'fortify'}));assert.equal(piece.tier,1);assert.equal(piece.hp,structureMaxHP(piece));
 const paid={...s.inventory.items};assert.equal(submit(w,1,{kind:'manage-structure',id:piece.id,revision:0,operation:'fortify'}),false);assert.deepEqual(s.inventory.items,paid);
});

test('full chest relocation preserves stacks, weapon identities and stale requests cannot move it twice',()=>{
 const w=fixture(),s=actorAt(w,1,1,12);s.inventory.items.chest=1;
 const placement=furniturePlacement(s,'chest',0);assert.ok(placement.valid,placement.reason);assert.ok(submit(w,1,{kind:'place-furniture',furniture:'chest',placement}));
 const chest=w.sim.crafting.chests[0];chest.slots[0]={item:'wood',amount:23};chest.slots[5]={weapon:structuredClone(s.loadout[1]!)};const slots=structuredClone(chest.slots),id=chest.id;
 const destination={x:chest.x+1,z:chest.z,y:chest.y,angle:Math.PI/2};
 assert.ok(submit(w,1,{kind:'relocate-furniture',furniture:'chest',id,revision:0,placement:destination}));assert.equal(chest.id,id);assert.equal(chest.x,destination.x);assert.equal(chest.angle,Math.PI/2);assert.deepEqual(chest.slots,slots);assert.equal(s.inventory.items.chest,0);
 assert.equal(submit(w,1,{kind:'relocate-furniture',furniture:'chest',id,revision:0,placement:{...destination,angle:0}}),false);assert.equal(chest.angle,Math.PI/2);assert.deepEqual(chest.slots,slots);
 assert.ok(parseCheckpoint(w.checkpoint()));
});

test('relocation does not restore damaged workbench durability or duplicate a kit',()=>{
 const w=fixture(),s=actorAt(w,1,1,12);s.inventory.items.bench=1;const placement=furniturePlacement(s,'bench',0);assert.ok(placement.valid,placement.reason);assert.ok(submit(w,1,{kind:'place-furniture',furniture:'bench',placement}));
 const table=w.sim.crafting.tables[0];table.hp=71;const revision=w.sim.crafting.revision;
 assert.ok(submit(w,1,{kind:'relocate-furniture',furniture:'bench',id:table.id,revision,placement:{...placement,angle:Math.PI/2}}));assert.equal(table.hp,71);assert.equal(s.inventory.items.bench,0);assert.equal(w.sim.crafting.tables.length,1);
 assert.equal(submit(w,1,{kind:'relocate-furniture',furniture:'bench',id:table.id,revision,placement}),false);
});

test('bounded structures transfer through sparse patches, host migration and solo-to-LAN without losing state',()=>{
 const w=fixture(),before=w.checkpoint(),piece=addStructure(w,{...wall,kind:'door'});piece.open=true;piece.revision=2;piece.tier=1;piece.hp=structureMaxHP(piece)-30;
 const after=w.checkpoint();assert.ok(parseCheckpoint(after));const patch=createPatch(before,after);assert.equal(patch.survival.structures.upsert.length,1);const merged=applyPatch(before,patch);assert.ok(merged);assert.equal(stateHash(merged),stateHash(after));
 const migrated=CoopWorld.restore(420,after,[2]);assert.deepEqual(migrated.sim.crafting.structures,[piece]);assert.equal(migrated.actors.get(2)!.sim.crafting,migrated.sim.crafting);
 const unchanged=createPatch(after,w.checkpoint());assert.equal(unchanged.survival.structures.upsert.length,0);
 const promoted=CoopWorld.fromSolo(migrated.actors.get(2)!.sim,2);assert.deepEqual(promoted.sim.crafting.structures,[piece]);assert.notEqual(promoted.sim.crafting.structures,migrated.sim.crafting.structures);
 for(const mutate of [(c:typeof after)=>c.survival.crafting.structures[0].x+=.2,(c:typeof after)=>c.survival.crafting.structures[0].hp=999999,(c:typeof after)=>c.survival.crafting.structures[0].revision=-1,(c:typeof after)=>c.survival.crafting.structures.push(structuredClone(c.survival.crafting.structures[0])),(c:typeof after)=>c.survival.crafting.tables.push(null as never)]){const bad=structuredClone(after);mutate(bad);assert.equal(parseCheckpoint(bad),null);}
});

test('presence rejects floating poses and actions cannot bypass the validated elevation',()=>{
 const w=fixture(),s=actorAt(w,1,-3.5,4),pose=poseOf(s.player,s.groundY,0),before={...s.player};
 assert.equal(w.setPose(1,{...pose,y:pose.y+3}),false);assert.deepEqual(s.player,before);
 const request={kind:'place-structure',seq:1,pose:{...pose,y:pose.y+3},placement:wall} as ActionRequest;const stock={...s.inventory.items};assert.equal(w.request(1,request),false);assert.deepEqual(s.inventory.items,stock);assert.equal(w.sim.crafting.structures.length,0);
});

test('remote survivors climb connected stairs, retain elevation on upper floors and cannot teleport onto a ceiling',()=>{
 const w=fixture(),s=actorAt(w,1,-3.5,-5.2);
 addStructure(w,{kind:'stairs',x:-3.5,z:-3.5,level:0,rotation:0});
 addStructure(w,{kind:'floor',x:-3.5,z:-.5,level:1,rotation:0});
 const start=poseOf(s.player,s.groundY,0);
 assert.equal(w.setPose(1,{...start,z:-1.9,y:3.22}),false);
 for(let z=-4.99;z<=-1.89;z+=.1){const y=structureFloorHeight(s,{x:-3.5,z},s.groundY);assert.ok(w.setPose(1,{...start,z,y,locomotion:1}),`stair step at ${z} / ${y}`);}
 assert.ok(Math.abs(s.groundY-3.22)<.001);assert.ok(Math.abs(s.player.eyeY-4.94)<.001);
 w.step(1/60);assert.ok(Math.abs(s.groundY-3.22)<.01);
 const migrated=CoopWorld.restore(420,w.checkpoint(),[1,2]);assert.ok(Math.abs(migrated.actors.get(1)!.sim.groundY-3.22)<.01);
});

test('downed height and revive reach respect different floors',()=>{
 const w=fixture(),s=actorAt(w,1,-3.5,-.5),other=actorAt(w,2,-3.5,-.5);
 addStructure(w,{kind:'floor',x:-3.5,z:-.5,level:1,rotation:0});s.player.eyeY=4.94;s.player.invulnerable=0;w.damage(1,200);
 assert.equal(w.actors.get(1)!.life,'downed');assert.ok(Math.abs(s.player.eyeY-3.82)<.001);
 for(let i=0;i<50;i++){assert.ok(submit(w,2,{kind:'hold',target:1,held:true}));w.step(.1);}
 assert.equal(w.actors.get(1)!.life,'downed');assert.equal(w.actors.get(2)!.reviveProgress,0);assert.ok(other.groundY<1);
});


test('delayed presence packets spanning multiple stair treads remain accepted without enabling high-side entry',()=>{
 const w=fixture(),s=actorAt(w,1,-3.5,-5.2);addStructure(w,{kind:'stairs',x:-3.5,z:-3.5,level:0,rotation:0});
 const pose=poseOf(s.player,s.groundY,0);assert.ok(w.setPose(1,{...pose,z:-4.99,y:.42}));
 assert.ok(w.setPose(1,{...pose,z:-3.99,y:1.42}));assert.ok(Math.abs(s.groundY-1.42)<.001);
 actorAt(w,1,-1.7,-2.1);const side=poseOf(s.player,s.groundY,0);assert.equal(w.setPose(1,{...side,x:-3.5,z:-2.1,y:3.22}),false);
});

test('192 structures and maximum full chests remain within bounded checkpoint and unchanged pieces are omitted from deltas',()=>{
 const w=fixture();let count=0;
 for(let level=0;level<3;level++)for(let z=-8;z<=10;z+=3)for(let x=-3.5;x<=5.5;x+=3){addStructure(w,{kind:'wall',x,z,level,rotation:0});count++;}
 for(let level=0;level<3;level++)for(let x=-5;x<=7;x+=3)for(let z=-6.5;z<=8.5;z+=3){addStructure(w,{kind:'window',x,z,level,rotation:1});count++;}
 for(let z=-6.5;z<=8.5&&count<192;z+=3)for(let x=-3.5;x<=5.5&&count<192;x+=3){addStructure(w,{kind:'floor',x,z,level:0,rotation:0});count++;}
 w.sim.crafting.chests=Array.from({length:24},()=>({id:w.sim.crafting.next++,x:1,z:12,y:.22,angle:0,revision:0,slots:Array.from({length:27},()=>({weapon:structuredClone(w.actors.get(1)!.sim.loadout[1]!)}))}));
 assert.equal(w.sim.crafting.structures.length,192);const a=w.checkpoint();assert.ok(parseCheckpoint(a));assert.ok(JSON.stringify(a).length<360000);
 const b=w.checkpoint(),patch=createPatch(a,b);assert.equal(patch.survival.structures.upsert.length,0);assert.equal(patch.survival.chests.upsert.length,0);assert.ok(JSON.stringify(patch).length<15000);assert.equal(stateHash(applyPatch(a,patch)!),stateHash(b));
 const bad=structuredClone(a);bad.survival.crafting.structures.push({...bad.survival.crafting.structures[0],id:bad.survival.crafting.next++});assert.equal(parseCheckpoint(bad),null);
});


test('late join picks a free arrival point when a constructed wall occupies its old spawn',()=>{
 const w=fixture();addStructure(w,{kind:'wall',x:-.5,z:7,level:0,rotation:0});
 const original=spawnFor([1,2,3],3);assert.ok(collides(original,.45,w.sim.solidDefenses));w.setMembers([1,2,3]);
 const newcomer=w.actors.get(3)!.sim;assert.equal(collides(newcomer.player,.45,structureMovementBoxes(newcomer,newcomer.player,newcomer.groundY,1.9)),false);assert.notDeepEqual({x:newcomer.player.x,z:newcomer.player.z},original);
 assert.ok(parseCheckpoint(w.checkpoint()));
});


test('revive on an upper floor restores the standing height; losing its floor lowers a downed survivor',()=>{
 const w=fixture(),s=actorAt(w,1,-3.5,-.5),rescuer=actorAt(w,2,-2.5,-.5);addStructure(w,{kind:'floor',x:-3.5,z:-.5,level:1,rotation:0});s.player.eyeY=4.94;rescuer.player.eyeY=4.94;s.player.invulnerable=0;w.damage(1,200);
 for(let i=0;i<43;i++){assert.ok(submit(w,2,{kind:'hold',target:1,held:true}));w.step(.1);}
 assert.equal(w.actors.get(1)!.life,'alive');assert.ok(Math.abs(s.player.eyeY-4.94)<.01);assert.ok(Math.abs(s.groundY-3.22)<.01);
 s.player.invulnerable=0;w.damage(1,200);w.sim.crafting.structures=[];w.sim.crafting.revision++;w.step(.1);assert.ok(Math.abs(s.player.eyeY-.82)<.01);
});


test('coordinator requires actor-owned and equipped hammer; no crafting table is required after crafting',()=>{
 const w=fixture(),s=actorAt(w,1,-3.5,4);actorAt(w,2,3,7);const before={...s.inventory.items};
 s.gear.owned=['fists'];s.gear.melee='fists';s.activeSlot=3;
 assert.equal(submit(w,1,{kind:'melee-equip',melee:'hammer'}),false);
 assert.equal(submit(w,1,{kind:'place-structure',placement:wall}),false);
 s.gear.melee='hammer';s.activeSlot=2;assert.equal(submit(w,1,{kind:'place-structure',placement:wall}),false);
 s.gear.owned.push('hammer');s.activeSlot=1;assert.equal(submit(w,1,{kind:'place-structure',placement:wall}),false);assert.deepEqual(s.inventory.items,before);
 assert.ok(submit(w,1,{kind:'melee-equip',melee:'hammer'}));assert.equal(s.buildingHammerEquipped,true);assert.equal(s.crafting.tables.length,0);
 assert.ok(submit(w,1,{kind:'place-structure',placement:wall}));assert.equal(s.inventory.items.wood,before.wood-6);assert.equal(s.crafting.structures.length,1);
});
