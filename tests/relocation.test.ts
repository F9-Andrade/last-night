import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation.ts';
import {furniturePlacement,placeFurniture,relocateFurniture,furnitureReason} from '../src/game/relocation.ts';
import {emptyStock} from '../src/game/inventory.ts';
import {FPS} from '../src/game/first-person.ts';
const fixture=()=>{const s=new Simulation(undefined,1977);s.zombies=[];s.loot=[];s.player.x=1;s.player.z=12;s.player.angle=0;s.player.eyeY=FPS.eyeHeight+.02;s.inventory.items={...emptyStock(),bench:1,chest:1};return s;};

test('furniture preview is pure and rotates without placing or consuming a kit',()=>{
 const s=fixture(),before=JSON.stringify(s.crafting),bag={...s.inventory.items};
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2]){const p=furniturePlacement(s,'chest',angle);assert.ok(p.valid,p.reason);assert.ok(p.angle>=-Math.PI&&p.angle<=Math.PI);}
 assert.equal(JSON.stringify(s.crafting),before);assert.deepEqual(s.inventory.items,bag);
});
test('invalid destination never consumes kit, moves furniture or loses contents',()=>{
 const s=fixture(),p=furniturePlacement(s,'chest',0);assert.ok(placeFurniture(s,'chest',p));
 const chest=s.crafting.chests[0];chest.slots[0]={item:'rare',amount:13};const before=structuredClone(chest),stock={...s.inventory.items};
 for(const destination of [{...p,x:100},{...p,y:4},{...p,x:s.player.x,z:s.player.z},{...p,angle:NaN},{...p,x:1,z:2,y:.22}])assert.equal(relocateFurniture(s,'chest',chest.id,chest.revision,destination),false);
 assert.deepEqual(chest,before);assert.deepEqual(s.inventory.items,stock);
});
test('full chest and damaged workbench relocate preserving identities and contents',()=>{
 for(const kind of ['chest','bench'] as const){const s=fixture(),p=furniturePlacement(s,kind,0);assert.ok(placeFurniture(s,kind,p));
 const furniture=kind==='bench'?s.crafting.tables[0]:s.crafting.chests[0];if('slots'in furniture)furniture.slots[0]={item:'wood',amount:47};else furniture.hp=32;
 const before=structuredClone(furniture),revision=kind==='bench'?s.crafting.revision:'revision'in furniture?furniture.revision:0;
 const next={...p,x:p.x+1,y:p.y,angle:Math.PI/2};assert.equal(furnitureReason(s,kind,next,furniture.id),'');assert.ok(relocateFurniture(s,kind,furniture.id,revision,next));
 assert.equal(furniture.id,before.id);assert.equal(furniture.x,next.x);assert.equal(s.inventory.items[kind],0);
 if('slots'in furniture&&'slots'in before)assert.deepEqual(furniture.slots,before.slots);if('hp'in furniture)assert.equal(furniture.hp,32);
 assert.equal(relocateFurniture(s,kind,furniture.id,revision,p),false);
 }
});
test('moving a chest cannot place it through another occupied furniture volume',()=>{
 const s=fixture(),p=furniturePlacement(s,'chest',0);assert.ok(placeFurniture(s,'chest',p));
 const chest=s.crafting.chests[0];s.crafting.tables.push({id:s.crafting.next++,x:p.x+1.5,z:p.z,y:p.y,angle:0,hp:200});s.crafting.revision++;
 assert.match(furnitureReason(s,'chest',{...p,x:p.x+1.5},chest.id),/parede|objeto/);
 assert.equal(relocateFurniture(s,'chest',chest.id,chest.revision,{...p,x:p.x+1.5}),false);
});
