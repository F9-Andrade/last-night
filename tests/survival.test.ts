import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/simulation.ts';
import type { InputCommand } from '../src/game/simulation.ts';
import { Inventory, itemKeys } from '../src/game/inventory.ts';
import { BALANCE } from '../src/game/config.ts';
import { MatchCycle } from '../src/game/cycle.ts';
import { Horde } from '../src/game/horde.ts';
import { LOOT_POINTS, rollLoot } from '../src/game/loot.ts';
import { collides, findPath, distance, BASE } from '../src/game/world.ts';
import { damageStage, obstacleDistance } from '../src/game/defenses.ts';
const idle: InputCommand = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 20, fire: false, run: false, reload: false, interact: false };
const step = (s: Simulation, seconds: number, input = idle) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) { s.update(1 / 60, input); s.events.length = 0; } };
const clean = () => { const s = new Simulation(); s.zombies = []; s.spawnTimer = 999; return s; };
const search = (s: Simulation, id: string) => { const p = s.loot.find(l => l.id === id)!; s.player.x = p.x; s.player.z = p.z; s.update(1 / 60, { ...idle, interact: true }); step(s, 1); };

test('inventory capacity and atomic transfers conserve all resources', () => {
  const a = new Inventory(2), b = new Inventory(1);
  assert.equal(a.add('wood', 9), 4); assert.equal(a.weight, 2);
  assert.equal(a.transfer(b, 'wood', 4), 2); assert.equal(a.items.wood + b.items.wood, 4);
  assert.equal(a.take('wood', 3), false); assert.equal(a.take('wood', -1), false);
  assert.equal(a.add('med', NaN), 0); assert.equal(a.add('scrap', -2), 0);
  assert.equal(a.transfer(b, 'wood', -5), 0); assert.equal(b.weight, 1);
});
test('all loot points are accessible and medical/police tables favor their purpose', () => {
  assert.equal(LOOT_POINTS.filter(p => collides(p, .65)).length, 0);
  let seed = 1; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let med = 0, ammo = 0;
  for (let i = 0; i < 400; i++) { med += Number(rollLoot('hospital', random).med > 0); ammo += Number(rollLoot('police', random).ammo > 0); }
  assert.ok(med > 270); assert.ok(ammo > 270);
});
test('search can be cancelled and full inventory retains rolled loot without rerolling', () => {
  const s = clean(); s.player.x = -2; s.player.z = 3;
  s.update(.1, { ...idle, interact: true }); step(s, .2, { ...idle, moveZ: 1 }); assert.equal(s.loot[0].searched, false);
  s.inventory.items = { ammo: 0, shells:0, rifleAmmo:0, med: s.inventory.capacity, wood: 0, scrap: 0, rare: 0 }; search(s, 'base-ammo');
  assert.equal(s.loot[0].contents.ammo, 36); const seed = s.seed;
  search(s, 'base-ammo'); assert.equal(s.seed, seed); assert.equal(s.loot[0].contents.ammo, 36);
  s.inventory.take('med', 1); search(s, 'base-ammo'); assert.equal(s.reserve, 36); assert.equal(s.loot[0].contents.ammo, 0);
  search(s, 'base-ammo'); assert.equal(s.reserve, 36);
});
test('medicine is consumed only on completion and movement or attack interrupts it', () => {
  const s = clean(); s.player.hp = 80; s.update(.1, { ...idle, heal: true }); assert.equal(s.player.hp, 80);
  step(s, .2, { ...idle, moveZ: 1 }); assert.equal(s.inventory.items.med, 1); assert.equal(s.action, null);
  s.update(.1, { ...idle, heal: true }); step(s, 3); assert.equal(s.player.hp, 100); assert.equal(s.inventory.items.med, 0);
  s.inventory.add('med', 1); s.player.hp = 60; s.spawn({ x: s.player.x, z: s.player.z + .8 }); s.update(.1, { ...idle, heal: true }); step(s, 1);
  assert.ok(s.player.hp < 60); assert.equal(s.inventory.items.med, 1); assert.equal(s.action, null);
});
test('starting nearby supplies fund a defense; build blocks movement and debits exact cost', () => {
  const s = clean(); search(s, 'base-wood'); s.player.x = 1; s.player.z = 7;
  s.update(.1, { ...idle, interact: true }); step(s, 1.3);
  const b = s.barricades[0]; assert.equal(b.hp, 300); assert.equal(s.inventory.items.wood, 2); assert.equal(s.inventory.items.scrap, 1);
  step(s, 1, { ...idle, moveZ: 1 }); assert.ok(s.player.z < 8.3);
  assert.ok(collides({ x: 1, z: 9 }, .45, s.solidDefenses));
});
test('build rejects occupied points and insufficient resources without loss', () => {
  const s = clean(); s.player.x = 1; s.player.z = 9;
  const before = { ...s.inventory.items }; s.update(.1, { ...idle, interact: true }); step(s, 2);
  assert.deepEqual(s.inventory.items, before); assert.equal(s.barricades[0].hp, 0);
  s.player.z = 7; s.update(.1, { ...idle, interact: true }); step(s, 2); assert.equal(s.barricades[0].hp, 0);
});
test('repair requires holding, charges on completion, caps health, and destruction cancels action', () => {
  const s = clean(), b = s.barricades[0]; b.hp = 250; b.built = true;
  s.inventory.add('wood', 4); s.inventory.add('scrap', 4); const wood = s.resource('wood');
  s.update(.1, { ...idle, interact: true, heldInteract: true }); step(s, .5); assert.equal(s.action, null); assert.equal(s.resource('wood'), wood);
  step(s, 2.2, { ...idle, heldInteract: true }); assert.equal(b.hp, 300); assert.equal(s.resource('wood'), wood - 1);
  step(s, 3, { ...idle, heldInteract: true }); assert.equal(s.resource('wood'), wood - 1);
  s.damageBarricade(b, 210); assert.equal(damageStage(b.hp), 2); s.update(.1, { ...idle, heldInteract: true }); s.damageBarricade(b, 500);
  assert.equal(b.hp, 0); assert.equal(s.action, null); assert.ok(!s.solidDefenses.some(d=>d.id===b.id));
});
test('dismantling releases passage and returns only partial wood to storage', () => {
  const s = clean(), b = s.barricades[0]; b.hp = 300; b.built = true;
  s.update(.1, { ...idle, dismantle: true }); step(s, 1.1);
  assert.equal(b.hp, 0); assert.equal(s.storage.items.wood, 3); assert.equal(s.storage.items.scrap, 0);
  step(s, 1, { ...idle, moveZ: 1 }); assert.ok(s.player.z > 9);
});
test('base storage is accessible only locally; base repair and rare supply have real costs', () => {
  const s = clean(); s.manage('deposit', 'wood'); assert.equal(s.storage.items.wood, 2);
  s.player.x = -25; s.player.z = 10; s.manage('withdraw', 'wood'); assert.equal(s.inventory.items.wood, 0);
  s.player.x = 1; s.player.z = 2; s.storage.add('scrap', 4); s.baseHP = 700;
  s.update(.1, { ...idle, interact: true }); step(s, 3.1); assert.equal(s.baseHP, 820); assert.equal(s.resource('scrap'), 1);
  s.storage.add('rare', 1); s.manage('rare', 'rare'); assert.equal(s.baseHP, 1000); assert.equal(s.resource('rare'), 0);
});
test('cycle emits one phase transition, final countdown and silence before dawn', () => {
  const c = new MatchCycle({ day: .1, dusk: .1, preparation: 10, dawn: .2, silence: .3 });
  assert.deepEqual(c.update(.11, false), ['dusk']); assert.deepEqual(c.update(.11, false), ['preparation', 'countdown']);
  let countdown = 1; for (let i = 0; i < 100; i++) countdown += c.update(.1, false).filter(e => e === 'countdown').length;
  assert.ok(countdown >= 9); c.update(.11, false); assert.equal(c.phase, 'night');
  c.update(1000, false); assert.equal(c.phase, 'night'); assert.deepEqual(c.update(.1, true), ['survived']);
  c.update(.21, true); assert.equal(c.phase, 'dawn'); c.update(.21, true); assert.equal(c.day, 2);
});
test('horde has internal pauses, bounded scaling and never consumes a failed spawn', () => {
  const h = new Horde(); h.start(1); h.update(.1, 1, () => false); assert.equal(h.spawned, 0);
  let time = 0; const times: number[] = [];
  for (let i = 0; i < 1000; i++) { time += .1; h.update(.1, 1, () => { times.push(time); return true; }); }
  assert.equal(times.length, 22); assert.equal(times.filter((t, i) => i && t - times[i - 1] > 10).length, 2);
  h.start(2); assert.equal(h.budget, 31); h.start(999); assert.equal(h.budget, 76);
});
test('edge spawns are distant, collision-free and do not exceed the active pool', () => {
  const s = clean(); s.player.x = -25; s.player.z = 15;
  for (let i = 0; i < 80; i++) { const z = s.spawn(); if (z) { assert.ok(distance(z, s.player) > BALANCE.horde.spawnDistance); assert.equal(collides(z, .48), false); } }
  assert.ok(s.activeWalkers <= 40);
});
test('dynamic navigation changes when the gate is built and all three routes are attackable', () => {
  for (const [index, x, z] of [[0, 1, 12], [1, -4.4, -2], [2, 6.3, -2]]) {
    const s = clean(); s.setPhase('night'); s.horde.spawned = s.horde.budget; s.player.x = -25; s.player.z = 15;
    s.barricades.forEach(b => { b.hp = 300; b.built = true; }); const b = s.barricades[index]; const walker = s.spawn({ x, z })!;
    assert.ok(walker); step(s, 12); assert.ok(b.hp < 300, `defense ${b.id} receives attacks`);
    assert.ok(obstacleDistance(walker, b) >= .47, 'Walker stays outside live collider');
    s.damageBarricade(b, 999); step(s, 12); assert.ok(distance(walker, BASE) < 2.5);
  }
  const s = clean(); s.barricades.forEach(b => { b.hp = 300; }); assert.equal(findPath({ x: 1, z: 13 }, BASE, s.solidDefenses).length, 0);
});
test('night completion rewards once, partially restocks and reaches Night 2', () => {
  const s = new Simulation({ day: .1, dusk: .1, preparation: .1, dawn: .2, silence: .2 }); s.zombies = []; s.spawnTimer = 999;
  for (const l of s.loot) l.searched = true;
  step(s, .4); assert.equal(s.phase, 'night'); s.horde.spawned = s.horde.budget; s.zombies.forEach(z => { z.active = false; });
  step(s, .25); assert.equal(s.phase, 'dawn'); assert.equal(s.storage.items.rare, 1);
  step(s, .25); assert.equal(s.day, 2); const restocked = s.loot.filter(l => !l.searched).length;
  assert.ok(restocked > 0 && restocked < s.loot.length); assert.equal(s.loot[0].searched, true);
  step(s, .4); assert.equal(s.phase, 'night'); assert.equal(s.horde.budget, 31); assert.equal(s.storage.items.rare, 1);
});
test('failure freezes state and a new expedition has no retained resources, enemies or defenses', () => {
  const s = clean(); s.baseHP = 0; s.update(.1, idle); assert.ok(s.gameOver); const time = s.time; step(s, 3); assert.equal(s.time, time);
  const r = new Simulation(); assert.equal(r.baseHP, 1000); assert.equal(r.day, 1); assert.equal(r.activeWalkers, 4); assert.equal(r.action, null);
  assert.ok(r.barricades.every(b => !b.built && !b.hp)); assert.ok(itemKeys.every(k => r.storage.items[k] === 0)); assert.ok(r.loot.filter(l=>l.guaranteed).every(l => !l.searched));
});

test('a complete siege from all edge zones breaches every route without stranded Walkers', () => {
  const s = clean(); s.setPhase('night'); s.player.x = -25; s.player.z = 15;
  // Large HP keeps the fixture alive long enough to observe navigation, not game balance.
  s.baseHP = 100000; s.player.hp = 100000; s.barricades.forEach(b => { b.hp = 300; b.built = true; });
  step(s, 180); assert.equal(s.horde.spawned, 22); assert.ok(s.barricades.every(b => b.hp === 0));
  assert.ok(s.zombies.filter(z => z.active).every(z => distance(z, BASE) < 12)); assert.ok(s.baseHP < 100000);
});
