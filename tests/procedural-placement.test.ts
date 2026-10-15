import test from 'node:test';
import assert from 'node:assert/strict';
import {configureWorld,worldLayoutSummary} from '../src/game/world-layout.ts';
import {BUILDINGS,URBAN,GAS_STATION,TREE_TRUNKS,OBSTACLES,collides,BASE,findPath} from '../src/game/world.ts';
import {CITY_SITES,CITY_PORTALS} from '../src/game/city.ts';
import {ROADS,REGIONS,WAREHOUSES} from '../src/game/districts.ts';
import {LOOT_POINTS} from '../src/game/loot.ts';
import {FACILITIES} from '../src/game/expedition.ts';
import {overlapsRect,findPlacement} from '../src/game/placement.ts';
import {Simulation} from '../src/game/simulation.ts';
import {serializeWorld,deserializeWorld} from '../src/services/save-codec.ts';
import {CoopWorld} from '../src/network/coop-world.ts';

const snapshot=()=>structuredClone({sites:CITY_SITES,buildings:BUILDINGS,urban:URBAN,trees:TREE_TRUNKS,portals:CITY_PORTALS,loot:LOOT_POINTS,regions:REGIONS,roads:ROADS});
const original=snapshot(),counts={sites:CITY_SITES.length,buildings:BUILDINGS.length,urban:URBAN.buildings.length,vehicles:URBAN.vehicles.length,trees:TREE_TRUNKS.length,loot:LOOT_POINTS.length};
const restore=()=>configureWorld(0,0);

test('v2 preserves all content, determinism and legacy coordinates across world switches',()=>{
 try{
  configureWorld(813,1);const old=snapshot();
  configureWorld(813,2);const corrected=snapshot();
  assert.notDeepEqual(corrected.sites,old.sites);assert.ok(worldLayoutSummary().moved>75);
  configureWorld(9021,2);assert.notDeepEqual(snapshot().sites,corrected.sites);
  configureWorld(813,2);assert.deepEqual(snapshot(),corrected);
  configureWorld(813,1);assert.deepEqual(snapshot(),old);
  restore();assert.deepEqual(snapshot(),original);
 }finally{restore();}
});

test('24 seeded cities keep buildings, roads, trees, supplies and entrances separated',()=>{
 try{
  for(const seed of [0,1,13,77,813,9021,0xffffffff,...Array.from({length:17},(_,i)=>((i+3)*2654435761)>>>0)]){
   configureWorld(seed,2);
   assert.deepEqual({sites:CITY_SITES.length,buildings:BUILDINGS.length,urban:URBAN.buildings.length,vehicles:URBAN.vehicles.length,trees:TREE_TRUNKS.length,loot:LOOT_POINTS.length},counts);
   assert.deepEqual(ROADS,original.roads);assert.deepEqual(REGIONS.slice(5,12),original.regions.slice(5,12));
   const buildings=[...BUILDINGS.filter(b=>b.kind!=='base'),...CITY_SITES,...URBAN.buildings,...WAREHOUSES,{...GAS_STATION,w:10,d:5}];
   for(let i=0;i<buildings.length;i++){
    const b=buildings[i];assert.ok(ROADS.every(r=>!overlapsRect(b,r,.4)),`${seed} building on street ${i}`);
    assert.ok(buildings.slice(i+1).every(other=>!overlapsRect(b,other,.5)),`${seed} overlapping building ${i}`);
   }
   for(const [i,t]of TREE_TRUNKS.entries()){
    assert.ok(ROADS.every(r=>!overlapsRect(t,r,.5)),`${seed} tree on street ${i}`);
    assert.ok(buildings.every(b=>!overlapsRect(t,b,.6)),`${seed} tree in building ${i}`);
    assert.ok(TREE_TRUNKS.slice(i+1).every(other=>!overlapsRect(t,other,.5)),`${seed} overlapping tree ${i}`);
   }
   for(const p of [...LOOT_POINTS,...FACILITIES])assert.equal(collides(p,.65,TREE_TRUNKS),false,`${seed} blocked supply ${p.id}`);
   for(const p of CITY_PORTALS){
    const approach={x:p.x+(p.kind==='window'?1.5:0),z:p.z+(p.kind==='door'?1.5:0)};
    assert.equal(collides(approach,.45,TREE_TRUNKS),false,`${seed} blocked entrance ${p.id}`);
   }
   assert.equal(collides({x:1,z:7},.45,TREE_TRUNKS),false);
  }
 }finally{restore();}
});

test('landmark front doors retain a route from the shelter',()=>{
 try{configureWorld(9021,2);for(const site of CITY_SITES)assert.ok(findPath(BASE,{x:site.x,z:site.z+site.d/2+2}).length,site.id);}finally{restore();}
});

test('v2 saves and coop checkpoints preserve the same static layout and placed furniture',()=>{
 try{
  configureWorld(441,2);const sim=new Simulation(undefined,441);
  sim.crafting.tables.push({id:sim.crafting.next++,x:4,z:4,y:.22,angle:0,hp:200});
  const saved=serializeWorld(sim),expected=snapshot();configureWorld(22,2);configureWorld(441,2);
  const loaded=new Simulation(undefined,441);deserializeWorld(saved,loaded);
  const coop=CoopWorld.fromSolo(loaded,1),migrated=CoopWorld.restore(441,coop.checkpoint(),[2]);
  assert.equal(migrated.sim.layoutVersion,2);assert.deepEqual(migrated.sim.crafting.tables,sim.crafting.tables);assert.deepEqual(snapshot(),expected);
 }finally{restore();}
});

test('a full placement search reports exhaustion instead of returning a colliding fallback',()=>{
 assert.equal(findPlacement({x:0,z:0,w:3,d:3},()=>false,4),undefined);
 assert.ok(OBSTACLES.length>1000);
});
