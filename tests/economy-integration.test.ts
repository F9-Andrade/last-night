import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation.ts';
import {CoopWorld} from '../src/network/coop-world.ts';
import {parseAction,poseOf} from '../src/network/gameplay-protocol.ts';
import {parseCheckpoint,stateHash} from '../src/network/checkpoint.ts';
import {applyPatch,createPatch} from '../src/network/world-patch.ts';
import {serializeWorld,deserializeWorld,serializePlayer,deserializePlayer} from '../src/services/save-codec.ts';
import {emptyStock} from '../src/game/inventory.ts';
import {infectedLoot} from '../src/game/crafting.ts';
const idle={moveX:0,moveZ:0,aimX:0,aimZ:1,fire:false,run:false,reload:false,interact:false};
function atMerchant(s:Simulation){const m=s.economy.merchants[0];Object.assign(s.player,{x:m.x,z:m.z+2,eyeY:m.y+1.72});s.coins=100;s.inventory.items=emptyStock();return m;}
test('corpse money is collected once despite a full backpack; a replay gives nothing',()=>{
 const s=new Simulation();s.zombies=[];s.spawnTimer=1e5;const z=s.spawn({x:1,z:12})!;infectedLoot(s,z);const bag=s.loot.find(l=>l.id===`infected-${z.id}`)!;bag.coins=7;
 s.inventory.items=emptyStock();s.inventory.items.wood=32;const before=s.inventory.weight;
 const loot=()=>{s.action={kind:'search',target:bag.id,elapsed:.4,duration:.4,origin:{...s.player}};s.update(.001,idle);};
 loot();assert.equal(s.coins,7);assert.equal(s.inventory.weight,before);assert.equal(bag.coins,0);loot();assert.equal(s.coins,7);
});
test('coop trading spends only the requesting wallet; stale stock revisions and replay cannot double buy',()=>{
 const w=new CoopWorld(98,[1,2]),a=w.actors.get(1)!.sim,b=w.actors.get(2)!.sim,m=atMerchant(a);atMerchant(b);
 const request=(actor:number,seq:number)=>parseAction({kind:'trade',trade:{merchant:m.id,revision:0,mode:'buy',offer:'water',amount:1},seq,pose:poseOf(w.actors.get(actor)!.sim.player,m.y,0)})!;
 const before=w.checkpoint();assert.ok(w.request(1,request(1,1)));assert.equal(a.coins,84);assert.equal(a.inventory.items.water,1);assert.equal(b.coins,100);
 assert.equal(w.request(1,request(1,1)),false);assert.equal(w.request(2,request(2,1)),false);assert.equal(b.inventory.items.water,0);
 const after=w.checkpoint();assert.ok(parseCheckpoint(after));assert.equal(stateHash(applyPatch(before,createPatch(before,after))!),stateHash(after));
 const restored=CoopWorld.restore(98,after,[1,2]);assert.equal(restored.actors.get(1)!.sim.coins,84);assert.deepEqual(restored.sim.economy,w.sim.economy);
});
test('coins, trader stock, corpse change and night clock persist in existing JSON saves',()=>{
 const s=new Simulation(),m=atMerchant(s);assert.ok(s.trade({merchant:m.id,revision:0,mode:'buy',offer:'water',amount:1}));s.setPhase('night',391);
 s.loot[0].coins=4;const world=serializeWorld(s),player=serializePlayer(s,'world','user'),r=new Simulation();deserializeWorld(world,r);deserializePlayer(player,r);
 assert.equal(r.coins,84);assert.deepEqual(r.economy,s.economy);assert.equal(r.loot[0].coins,4);assert.equal(r.cycle.untilDay,209);
 const oldWorld=structuredClone(world),oldPlayer=structuredClone(player);delete oldWorld.checkpoint.survival.economy;delete (oldPlayer.extra_data.record as any).coins;const old=new Simulation();deserializeWorld(oldWorld,old);deserializePlayer(oldPlayer,old);assert.equal(old.coins,0);assert.equal(old.economy.merchants.length,6);
});
test('network rejects forged currency, malformed trades and arbitrary merchant catalogues',()=>{
 const w=new CoopWorld(98,[1]),s=w.actors.get(1)!.sim,m=atMerchant(s),c=w.checkpoint();
 for(const amount of [-1,Infinity,1.2]){const bad=structuredClone(c);bad.players[0].coins=amount;assert.equal(parseCheckpoint(bad),null);}
 const bad=structuredClone(c);bad.survival.economy!.merchants[0].stock.water=999;assert.equal(parseCheckpoint(bad),null);
 assert.equal(parseAction({kind:'trade',trade:{merchant:m.id,revision:0,mode:'sell',item:'__proto__',amount:1},seq:1,pose:poseOf(s.player,m.y,0)}),null);
 const balance=s.coins;s.player.x+=40;assert.equal(s.trade({merchant:m.id,revision:0,mode:'buy',offer:'water',amount:1}),false);assert.equal(s.coins,balance);
});
