import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyHit, damageFor, CorpseManager } from '../src/game/combat.ts';
import { Simulation } from '../src/game/simulation.ts';
import { BALANCE } from '../src/game/config.ts';
import { collides, findPath, BASE, impactMaterial } from '../src/game/world.ts';
import { LOOT_POINTS } from '../src/game/loot.ts';
import { ENCOUNTERS } from '../src/game/districts.ts';
const idle={moveX:0,moveZ:0,aimX:1,aimZ:15,fire:false,run:false,reload:false,interact:false};
test('anatomical rays distinguish head, torso, arms and legs with ordered damage',()=>{
  const actor={x:1,z:15,angle:0};
  for(const [zone,x,y] of [['HEAD',.93,1.89],['TORSO',1,1.3],['ARMS',1.52,1.2],['LEGS',1.23,.49]] as const){
    const hit=bodyHit({x,z:7},{x:0,z:1},(y-1.3)/8,actor,26);assert.equal(hit?.zone,zone);
  }
  assert.equal(damageFor('HEAD'),102);assert.equal(damageFor('TORSO'),34);assert.ok(damageFor('LEGS')<34);assert.ok(damageFor('ARMS')<34);
});
test('fatal headshot disables AI, retains wounds and leaves a corpse through 30 seconds then fades',()=>{
  const s=new Simulation();s.zombies=[];const z=s.spawn({x:1,z:15})!;
  s.update(.016,{...idle,aimY:1.9,fire:true});assert.equal(z.active,false);assert.equal(s.kills,1);assert.equal(s.corpses.bodies.length,1);assert.equal(z.wounds[0].zone,'HEAD');
  s.corpses.update(30,s.player);assert.equal(s.corpses.bodies.length,1);s.corpses.update(3,s.player);assert.equal(s.corpses.bodies.length,1);s.corpses.update(1.1,s.player);assert.equal(s.corpses.bodies.length,0);
});
test('leg hit slows; bounded wounds and corpse manager do not become collision obstacles',()=>{
  const s=new Simulation();s.zombies=[];const z=s.spawn({x:1.23,z:15})!;s.update(.016,{...idle,aimX:1.23,aimY:.48,fire:true});assert.equal(z.zone,'LEGS');assert.ok(z.slow>2);
  const manager=new CorpseManager();for(let id=0;id<200;id++)manager.add({x:1,z:15,id,angle:0,wounds:[]},{x:0,z:1});assert.equal(manager.bodies.length,BALANCE.combat.corpseLimit);assert.equal(collides({x:1,z:15}),false);
});
test('noise is bounded by distance, creates no new actors, and expires',()=>{
  const s=new Simulation();s.zombies=[];const near=s.spawn({x:1,z:21})!,far=s.spawn({x:1,z:55})!;const count=s.activeWalkers;s.noise(s.player,30);assert.ok(near.hearing>0);assert.equal(far.hearing,0);assert.equal(s.activeWalkers,count);
  for(let i=0;i<660;i++)s.update(1/60,idle);assert.equal(near.hearing,0);
});
test('reload stages occur once; sprint/action/damage cancellation never grants ammunition',()=>{
  const s=new Simulation();s.zombies=[];s.ammo=3;s.reload();for(let i=0;i<20;i++)s.update(.016,idle);s.update(.016,{...idle,moveX:1,run:true});assert.equal(s.reloadTimer,0);assert.equal(s.ammo,3);assert.equal(s.reserve,60);
  s.events=[];s.reload();for(let i=0;i<90;i++)s.update(.016,idle);assert.equal(s.ammo,12);assert.equal(s.reserve,51);
  for(const stage of ['reload-out','reload-in','reload-slide','reload-done'])assert.equal(s.events.filter(e=>e.type===stage).length,1);
});
test('all expanded loot and authored encounters have traversable paths from the preserved base',()=>{
  for(const p of [...LOOT_POINTS,...ENCOUNTERS]){assert.equal(collides(p,.45),false,JSON.stringify(p));assert.ok(findPath(BASE,p).length>0,JSON.stringify(p));}
});
test('wood, metal and concrete impacts have distinct classification',()=>{
  assert.equal(impactMaterial({x:-5.2,z:3}),'wood');assert.equal(impactMaterial({x:-12,z:-9}),'metal');assert.equal(impactMaterial({x:1,z:0}),'concrete');
});
test('alarms trigger once and attract existing Walkers without consuming horde budget',()=>{
  const s=new Simulation();s.player.x=-54;s.player.z=9;const z=s.spawn({x:-40,z:9})!;s.update(.02,idle);assert.equal(s.alarms.size,1);for(let i=0;i<60;i++)s.update(.02,idle);assert.ok(z.hearing>0);assert.equal(s.horde.spawned,0);
});

test('front, back and side deaths preserve shot direction in the independent corpse state',()=>{
  const manager=new CorpseManager();
  for(const angle of [0,Math.PI,Math.PI/2]) manager.add({x:1,z:15,id:manager.bodies.length,angle,wounds:[{zone:'TORSO',side:1,y:1.3}]},{x:0,z:1});
  assert.deepEqual(manager.bodies.map(c=>c.fall),[0,-Math.PI,-Math.PI/2]);
});
test('body reservation bounds the combined population without dropping a corpse at death',()=>{
  const s=new Simulation();s.zombies=[];
  for(let id=0;id<BALANCE.combat.corpseLimit-1;id++)s.corpses.add({id:id+1000,x:1,z:20,angle:0,wounds:[]},{x:0,z:1});
  assert.ok(s.spawn({x:1,z:15}));assert.equal(s.spawn({x:3,z:15}),undefined);
  s.update(.016,{...idle,aimY:1.9,fire:true});assert.equal(s.corpses.bodies.length,BALANCE.combat.corpseLimit);assert.equal(s.activeWalkers,0);
});
test('damage and starting another action cancel reload without consuming reserve ammunition',()=>{
  const s=new Simulation();s.zombies=[];s.player.hp=50;s.ammo=2;s.reload();s.update(.016,{...idle,heal:true});assert.equal(s.reloadTimer,0);assert.equal(s.ammo,2);assert.equal(s.reserve,60);
  s.action=null;const z=s.spawn({x:1,z:8})!;z.attack=0;s.reload();s.update(.016,idle);assert.equal(s.reloadTimer,0);assert.ok(s.player.hp<50);assert.equal(s.ammo,2);
});
test('a constructed barricade preserves the defender firing lane while still blocking movement',()=>{
  const s=new Simulation();s.zombies=[];s.player.z=4.6;const gate=s.barricades[0];gate.hp=300;gate.built=true;const z=s.spawn({x:1,z:13})!;
  s.update(.016,{...idle,aimZ:13,fire:true});assert.ok(z.hp<90);assert.equal(gate.hp,300);assert.ok(collides({x:1,z:9},.45,s.solidDefenses));
});
test('a walking sweep reaches every supply point across the expanded region without crossing solids',async()=>{
  const {move,distance}=await import('../src/game/world.ts');const player={...BASE};
  for(const loot of LOOT_POINTS){const path=findPath(player,loot);assert.ok(path.length);for(const p of path){let tries=0;while(distance(player,p)>.12&&tries++<200){const dx=p.x-player.x,dz=p.z-player.z,d=Math.hypot(dx,dz),step=Math.min(.1,d);move(player,dx/d*step,dz/d*step,.45);}assert.ok(distance(player,p)<.13,`stuck on route to ${loot.id}`);}assert.ok(distance(player,loot)<.15);}
});
test('industrial containers and the plaza monument are solid, with metal impact feedback',()=>{
  assert.ok(collides({x:53,z:49}));assert.ok(collides({x:-62,z:54}));assert.ok(collides({x:0,z:59}));assert.equal(impactMaterial({x:53,z:46}),'metal');
});
test('misses end on the ground or at range without manufacturing a mid-air concrete impact',()=>{
  const s=new Simulation();s.zombies=[];s.player.x=75;s.player.z=10;s.player.angle=0;s.shoot();const shot=s.events.find(e=>e.type==='shot');assert.equal(shot?.material,'air');
  s.shotTimer=0;s.anatomicalAim=true;s.aimDistance=1;s.aimHeight=0;s.shoot();const last=s.events.filter(e=>e.type==='shot').at(-1);assert.ok(Math.abs(last?.y??10)<.001);
});
