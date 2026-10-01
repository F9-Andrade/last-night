import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CoopWorld} from '../src/network/coop-world.ts';
import {parseAction,poseOf} from '../src/network/gameplay-protocol.ts';
import {parseCheckpoint,stateHash} from '../src/network/checkpoint.ts';
import {createPatch,applyPatch} from '../src/network/world-patch.ts';
import {FOODS} from '../src/game/nutrition.ts';
import {moveChest,placeChest} from '../src/game/chests.ts';
const fixture=()=>{const w=new CoopWorld(98,[1,2]);w.sim.zombies=[];w.sim.spawnTimer=10000;for(const a of w.actors.values()){a.sim.player.hp=100;a.sim.player.invulnerable=100;a.sim.nutrition.hunger=30;a.sim.nutrition.thirst=20;}return w;};
const request=(w:CoopWorld,actor:number,seq:number,item='cannedBeans')=>parseAction({kind:'consume',seq,item,pose:poseOf(w.actors.get(actor)!.sim.player,0,0)})!;
test('consume is coordinator-owned, rejects replay and consumes exactly one after full duration',()=>{
 const w=fixture(),a=w.actors.get(1)!.sim,b=w.actors.get(2)!.sim;a.inventory.items.cannedBeans=2;
 assert.ok(w.request(1,request(w,1,1)));assert.equal(w.request(1,request(w,1,1)),false);assert.equal(w.request(2,request(w,2,1)),false);assert.equal(a.inventory.items.cannedBeans,2);
 for(let t=0;t<FOODS.cannedBeans.duration+.05;t+=1/60)w.step(1/60);
 assert.equal(a.inventory.items.cannedBeans,1);assert.equal(b.inventory.items.cannedBeans,0);assert.ok(a.nutrition.hunger>30);assert.ok(b.nutrition.hunger<30);assert.equal(a.consumption,null);
 assert.equal(w.effects.filter(e=>e.actor===1&&e.event.type==='consume-done').length,1);
});
test('movement, explicit cancellation and real damage interrupt eating without spending an item',()=>{
 const w=fixture(),s=w.actors.get(1)!.sim;s.inventory.items.water=3;
 assert.ok(w.request(1,request(w,1,1,'water')));w.setPose(1,{...poseOf(s.player,0,0),moving:true,locomotion:1});w.step(.05);assert.equal(s.consumption,null);assert.equal(s.inventory.items.water,3);
 s.player.moving=false;assert.ok(w.request(1,request(w,1,2,'water')));assert.ok(w.request(1,{kind:'cancel-consume',seq:3,pose:poseOf(s.player,0,0)}));assert.equal(s.consumption,null);
 assert.ok(w.request(1,request(w,1,4,'water')));s.player.invulnerable=0;w.damage(1,10);assert.equal(s.consumption,null);assert.equal(s.inventory.items.water,3);
});
test('checkpoint/delta/migration preserve needs and in-progress consumption; malformed states rejected',()=>{
 const w=fixture(),s=w.actors.get(1)!.sim;s.inventory.items.cannedFish=1;const before=w.checkpoint();assert.ok(w.request(1,request(w,1,1,'cannedFish')));w.step(.3);const after=w.checkpoint();assert.ok(parseCheckpoint(after));assert.equal(stateHash(applyPatch(before,createPatch(before,after))!),stateHash(after));
 const next=CoopWorld.restore(98,after,[1,2]);assert.deepEqual(next.actors.get(1)!.sim.nutrition,s.nutrition);assert.deepEqual(next.actors.get(1)!.sim.consumption,s.consumption);
 for(let i=0;i<300;i++)next.step(1/60);assert.equal(next.actors.get(1)!.sim.inventory.items.cannedFish,0);
 for(const mutate of [(c:typeof after)=>c.players[0].nutrition.hunger=-1,(c:typeof after)=>c.players[0].nutrition.thirst=101,(c:typeof after)=>c.players[0].consumption!.duration=0,(c:typeof after)=>c.players[0].consumption!.item='ammo' as any]){const bad=structuredClone(after);mutate(bad);assert.equal(parseCheckpoint(bad),null);}
 assert.equal(parseAction({...request(w,1,2),item:'ammo'}),null);
});
test('deprivation bypasses armor, causes downed and stops while incapacitated',()=>{
 const w=fixture(),s=w.actors.get(1)!.sim;s.player.hp=1;s.player.invulnerable=100;s.gear.armor=50;s.gear.armorTier=1;s.nutrition.hunger=0;s.nutrition.thirst=0;
 for(let i=0;i<360;i++)w.step(1/60);
 assert.equal(w.actors.get(1)!.life,'downed');assert.equal(s.player.hp,0);assert.equal(s.gear.armor,50);const needs={...s.nutrition};w.step(.5);assert.deepEqual(s.nutrition,needs);assert.ok(parseCheckpoint(w.checkpoint()));
});
test('new food stacks transfer through shared chest and survive migration',()=>{
 const w=fixture(),s=w.actors.get(1)!.sim;Object.assign(s.player,{x:1,z:12,angle:0});s.inventory.items.chest=1;s.inventory.items.ration=2;assert.ok(placeChest(s));const chest=w.sim.crafting.chests[0];
 assert.ok(moveChest(s,{chest:chest.id,revision:0,source:{bag:'ration'},target:0,amount:1}));const c=w.checkpoint();assert.ok(parseCheckpoint(c));const restored=CoopWorld.restore(98,c,[1]);assert.deepEqual(restored.sim.crafting.chests[0].slots[0],{item:'ration',amount:1});assert.equal(restored.actors.get(1)!.sim.inventory.items.ration,1);
});

test('crouching is a stance: stationary consumption works, actual crouch movement interrupts',()=>{
 const w=fixture(),s=w.actors.get(1)!.sim;s.player.crouched=true;s.player.moving=false;s.inventory.items.water=2;
 assert.ok(w.request(1,request(w,1,1,'water')));assert.equal(s.player.moving,false);
 const {moving,...stationary}=poseOf(s.player,0,0);w.setPose(1,stationary);w.step(.1);assert.ok(s.consumption);
 w.setPose(1,{...stationary,vz:1});w.step(.1);assert.equal(s.consumption,null);assert.equal(s.inventory.items.water,2);
 s.player.moving=true;assert.equal(w.request(1,request(w,1,2,'water')),false);
 const malformed={...request(w,1,3,'water'),pose:{...stationary,moving:'yes'}};assert.equal(parseAction(malformed),null);
});
