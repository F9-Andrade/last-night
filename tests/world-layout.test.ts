import test from 'node:test';
import assert from 'node:assert/strict';
import {configureWorld,worldLayoutEpoch,worldLayoutSummary,worldLayoutVersion} from '../src/game/world-layout.ts';
import {BASE,BUILDINGS,URBAN,OBSTACLES,TREE_TRUNKS,collides,findPath,rayWorld,BASE as shelter} from '../src/game/world.ts';
import {CITY_SITES,CITY_PORTALS,CITY_LOOT} from '../src/game/city.ts';
import {LOOT_POINTS} from '../src/game/loot.ts';
import {FACILITIES} from '../src/game/expedition.ts';
import {REGIONS,ROADS,OUTER_HOUSES} from '../src/game/districts.ts';
import {Simulation} from '../src/game/simulation.ts';
import {serializeWorld,deserializeWorld} from '../src/services/save-codec.ts';
import {CoopWorld} from '../src/network/coop-world.ts';

const snapshot=()=>structuredClone({sites:CITY_SITES,portals:CITY_PORTALS,cityLoot:CITY_LOOT,loot:LOOT_POINTS,buildings:BUILDINGS,urban:URBAN,obstacles:OBSTACLES,trees:TREE_TRUNKS,facilities:FACILITIES,regions:REGIONS,roads:ROADS,outerHouses:OUTER_HOUSES});
const original=snapshot();
const restore=()=>configureWorld(0,0);

test('seeded layouts are repeatable and retain every authored ID, road and shelter',()=>{
 try{
  const ids=original.sites.map(s=>s.id),lootIds=original.loot.map(l=>l.id),portalIds=original.portals.map(p=>p.id);
  assert.equal(configureWorld(813,1),true);const first=snapshot(),epoch=worldLayoutEpoch();
  assert.equal(configureWorld(813,1),false);assert.equal(worldLayoutEpoch(),epoch);
  configureWorld(247,1);const second=snapshot();assert.notDeepEqual(first.sites,second.sites);assert.notDeepEqual(first.urban.buildings,second.urban.buildings);
  configureWorld(813,1);assert.deepEqual(snapshot(),first);assert.ok(worldLayoutSummary().moved>75);
  assert.deepEqual(CITY_SITES.map(s=>s.id),ids);assert.deepEqual(LOOT_POINTS.map(l=>l.id),lootIds);assert.deepEqual(CITY_PORTALS.map(p=>p.id),portalIds);
  assert.equal(URBAN.buildings.length,original.urban.buildings.length);assert.deepEqual(ROADS,original.roads);
  assert.deepEqual(BUILDINGS[0],original.buildings[0]);assert.deepEqual(BASE,{x:1,z:2});assert.equal(collides({x:1,z:7},.45),false);
 }finally{restore();}
});

test('doors, room supplies, attached trees and region markers follow their building',()=>{
 try{
  configureWorld(9021,1);
  for(const [i,site] of CITY_SITES.entries()){
   const old=original.sites[i],dx=site.x-old.x,dz=site.z-old.z;
   assert.deepEqual(site.props,old.props);assert.deepEqual(site.partitions,old.partitions);
   for(const portal of CITY_PORTALS.filter(p=>p.site===site.id)){const before=original.portals.find(p=>p.id===portal.id)!;assert.ok(Math.abs(portal.x-before.x-dx)<1e-8,portal.id);assert.ok(Math.abs(portal.z-before.z-dz)<1e-8,portal.id);}
   for(const loot of LOOT_POINTS.filter(p=>p.site===site.id)){const before=original.loot.find(p=>p.id===loot.id)!;assert.ok(Math.abs(loot.x-before.x-dx)<1e-8,loot.id);assert.ok(Math.abs(loot.z-before.z-dz)<1e-8,loot.id);}
   assert.equal(REGIONS[i+12].x,site.x);assert.equal(REGIONS[i+12].z,site.z);
   assert.ok(TREE_TRUNKS.some(t=>Math.abs(t.x-(site.x-(site.w/2+5)))<1e-8&&Math.abs(t.z-(site.z-site.d/2))<1e-8));
  }
 }finally{restore();}
});

test('varied seeds keep supplies, facilities and both door approaches reachable',()=>{
 try{
  for(const seed of [1,13,77,813,9021,123456789,0xffffffff]){
   configureWorld(seed,1);
   for(const p of LOOT_POINTS)assert.equal(collides(p,.65),false,`${seed} loot ${p.id}`);
   for(const p of FACILITIES)assert.equal(collides(p,.65),false,`${seed} facility ${p.id}`);
   for(const site of CITY_SITES){const front={x:site.x,z:site.z+site.d/2+2};assert.ok(findPath(shelter,front).length,`${seed} ${site.id}`);}
   for(const p of CITY_PORTALS){const approach={x:p.x+(p.kind==='window'?1.5:0),z:p.z+(p.kind==='door'?1.5:0)};assert.equal(collides(approach,.45),false,`${seed} approach ${p.id}`);}
  }
 }finally{restore();}
});

test('legacy version restores exact geometry, coordinates, cache queries and allocation counts',()=>{
 const probe={x:-113,z:-24};const baseline=rayWorld({x:probe.x,y:1.5,z:probe.z+18},{x:0,y:0,z:-1},30);
 try{
  for(const seed of [15,24,331]){
   configureWorld(seed,1);restore();assert.equal(worldLayoutVersion(),0);assert.deepEqual(snapshot(),original);
   assert.equal(rayWorld({x:probe.x,y:1.5,z:probe.z+18},{x:0,y:0,z:-1},30),baseline);
   assert.equal(OBSTACLES.length,original.obstacles.length);assert.equal(TREE_TRUNKS.length,original.trees.length);
  }
  assert.throws(()=>configureWorld(NaN,1));assert.throws(()=>configureWorld(15,9 as 1));
  assert.deepEqual(snapshot(),original);
 }finally{restore();}
});

test('saved and migrated worlds use one shared layout while personal structures stay placed',()=>{
 try{
  configureWorld(441,1);const sim=new Simulation(undefined,441);const site=CITY_SITES.find(s=>s.id==='church')!;
  const position={x:site.x,z:site.z};sim.portals.find(p=>p.site==='church')!.state='open';
  sim.crafting.tables.push({id:sim.crafting.next++,x:4,z:4,y:.22,angle:0,hp:200});const payload=serializeWorld(sim);
  configureWorld(22,1);configureWorld(441,1);const loaded=new Simulation(undefined,441);deserializeWorld(payload,loaded);
  assert.deepEqual({x:site.x,z:site.z},position);assert.equal(loaded.portals.find(p=>p.site==='church')!.state,'open');assert.deepEqual(loaded.crafting.tables,sim.crafting.tables);
  const coop=CoopWorld.fromSolo(loaded,1);const checkpoint=coop.checkpoint();const migrated=CoopWorld.restore(441,checkpoint,[2]);
  assert.equal(migrated.sim.layoutVersion,1);assert.deepEqual(migrated.sim.crafting.tables,sim.crafting.tables);
 }finally{restore();}
});
