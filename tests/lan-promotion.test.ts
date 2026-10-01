import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation.ts';
import {CoopWorld} from '../src/network/coop-world.ts';
import {parseCheckpoint} from '../src/network/checkpoint.ts';
import {placeChest} from '../src/game/chests.ts';
import {createWeapon} from '../src/game/weapons.ts';

test('opening LAN preserves live expedition and detaches all mutable world/player state',()=>{
 const s=new Simulation(undefined,981);s.firstPerson=true;s.player.hp=74;s.player.x=1;s.player.z=12;s.player.angle=0;s.inventory.items.chest=1;assert.ok(placeChest(s));s.crafting.chests[0].slots[0]={item:'wood',amount:37};
 s.inventory.items.scrap=13;s.gear.armor=42;s.gear.armorTier=1;s.loadout[0]=createWeapon('rifle',91,'rare');s.loadout[0].magazine=4;s.activeSlot=0;s.perks.add('runner');s.reloadTimer=.4;s.cycle.seek('night',14);s.cycle.day=3;s.horde.start(3);s.horde.spawned=4;s.baseHP=752;s.stats.seconds=532;s.activatedSites.add('church');s.discoveredSites.add('church');s.crafting.trees[0].hp=0;s.crafting.trees[0].ready=200;
 const w=CoopWorld.fromSolo(s,1),a=w.actors.get(1)!.sim;
 assert.deepEqual(a.player,s.player);assert.deepEqual(a.inventory.items,s.inventory.items);assert.deepEqual(a.loadout,s.loadout);assert.deepEqual(a.gear,s.gear);assert.deepEqual(a.perks,s.perks);assert.equal(a.reloadTimer,.4);assert.equal(w.sim.baseHP,752);assert.equal(w.sim.phase,'night');assert.equal(w.sim.day,3);assert.equal(w.sim.cycle.elapsed,14);assert.deepEqual(w.sim.horde,s.horde);assert.deepEqual(w.sim.crafting,s.crafting);assert.deepEqual(w.sim.zombies,s.zombies);assert.deepEqual(w.sim.loot,s.loot);assert.deepEqual(w.sim.activatedSites,s.activatedSites);assert.deepEqual(a.discoveredSites,s.discoveredSites);
 assert.notEqual(w.sim.crafting,s.crafting);assert.notEqual(a.inventory,s.inventory);assert.notEqual(w.sim.cycle,s.cycle);assert.equal(a.crafting,w.sim.crafting);
 const originalSeed=s.contentSeed;a.contentRandom();assert.equal(s.contentSeed,originalSeed);assert.notEqual(a.contentSeed,originalSeed);assert.equal(typeof a.inventory.add,'function');assert.equal(typeof w.sim.cycle.update,'function');assert.equal(typeof w.sim.corpses.update,'function');
 const c=w.checkpoint();assert.ok(parseCheckpoint(c));const migrated=CoopWorld.restore(s.runSeed,c,[1]);assert.deepEqual([...migrated.actors.get(1)!.sim.perks],['runner']);assert.deepEqual(migrated.sim.crafting.chests[0].slots[0],{item:'wood',amount:37});
});
test('late joining and leaving do not recreate the owner inventory or world',()=>{
 const w=new CoopWorld(51,[1]);const original=w.actors.get(1)!;original.sim.inventory.items.scrap=11;w.sim.baseHP=603;w.sim.cycle.seek('dusk',22);w.sim.crafting.trees[0].hp=0;
 assert.equal(w.setMembers([1,2,3]),true);assert.equal(w.actors.get(1),original);assert.equal(w.actors.get(2)!.sim.inventory.items.scrap,1);assert.equal(w.actors.get(1)!.sim.inventory.items.scrap,11);assert.equal(w.actors.get(3)!.sim.cycle.elapsed,22);assert.equal(w.actors.get(2)!.sim.crafting.trees[0].hp,0);assert.equal(w.sim.baseHP,603);assert.equal(w.setMembers([1,2,3]),false);
 assert.equal(w.setMembers([1,3,4]),true);assert.equal(w.actors.has(2),false);assert.equal(w.actors.get(4)!.sim.loadout[1]!.uid,4000000);assert.ok(parseCheckpoint(w.checkpoint()));
});
