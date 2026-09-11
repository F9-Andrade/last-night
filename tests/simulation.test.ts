import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, PISTOL } from '../src/game/simulation.ts';
import type { InputCommand } from '../src/game/simulation.ts';
import { collides, findPath, move, wallDistance } from '../src/game/world.ts';

const input: InputCommand = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 20, fire: false, run: false, reload: false, interact: false };
function clean(): Simulation { const s = new Simulation(); s.zombies = []; s.spawnTimer = 999; return s; }
function step(s: Simulation, seconds: number, command = input): void { for (let i = 0; i < Math.round(seconds * 60); i++) s.update(1 / 60, command); }

test('movement slides along colliders and respects map boundaries', () => {
  const p = { x: 1, z: 1 }; move(p, .1, -1); assert.equal(p.z, 1); assert.equal(p.x, 1.1);
  move(p, 100, 0); assert.equal(p.x, 1.1);
  assert.ok(collides({ x: 1, z: -4 })); assert.ok(!collides({ x: 1, z: 7 }));
});
test('diagonal motion is normalized; sprint consumes stamina', () => {
  const a = clean(), b = clean(); a.player.x = b.player.x = 0; a.player.z = b.player.z = 13;
  step(a, .3, { ...input, moveX: 1 }); step(b, .3, { ...input, moveX: 1, moveZ: 1 });
  assert.ok(Math.abs(Math.hypot(a.player.x, a.player.z - 13) - Math.hypot(b.player.x, b.player.z - 13)) < .01);
  step(a, .4, { ...input, moveX: 1, run: true }); assert.ok(a.player.stamina < 100);
});
test('pistol damages nearest Walker, honors cadence and kills in three hits', () => {
  const s = clean(); s.player.angle = 0; const z = s.spawn({ x: 1, z: 13 })!; const behind = s.spawn({ x: 1, z: 17 })!;
  s.shoot(); assert.equal(z.hp, 56); assert.equal(behind.hp, 90); assert.equal(s.ammo, 11);
  s.shoot(); assert.equal(s.ammo, 11);
  s.shotTimer = 0; s.shoot(); s.shotTimer = 0; s.shoot(); assert.equal(s.kills, 1); assert.equal(z.active, false);
});
test('walls stop bullets even with a muzzle close to the wall', () => {
  const s = clean(); s.player.x = 1; s.player.z = .5; s.player.angle = Math.PI;
  const z = s.spawn({ x: 1, z: -12 })!; s.shoot(); assert.equal(z.hp, 90);
  assert.equal(wallDistance({ x: 1, z: 1 }, { x: 0, z: -1 }, 20), 1);
});
test('reload conserves ammunition, prevents firing and cannot overfill magazine', () => {
  const s = clean(); s.ammo = 5; s.reserve = 3; s.reload(); s.shoot(); assert.equal(s.ammo, 5);
  step(s, PISTOL.reload + .1); assert.equal(s.ammo, 8); assert.equal(s.reserve, 0); assert.equal(s.reloadTimer, 0);
  s.reload(); assert.equal(s.reloadTimer, 0);
});
test('searched ammunition enters reserve once; medicine is carried for timed use', () => {
  const s = clean(); step(s, 1 / 60, { ...input, interact: true }); assert.equal(s.reserve, 72);
  s.player.x = -2; s.player.z = 3; step(s, 1 / 60, { ...input, interact: true }); assert.equal(s.reserve, 72);
  step(s, 1); assert.equal(s.reserve, 108); step(s, 1, { ...input, interact: true }); assert.equal(s.reserve, 108);
  s.player.x = 23; s.player.z = -17; step(s, 1 / 60, { ...input, interact: true }); step(s, 1);
  assert.ok(s.inventory.items.med >= 3); assert.equal(s.player.hp, 100);
  s.player.hp = 40; step(s, 1 / 60, { ...input, heal: true }); step(s, 2.5); assert.equal(s.player.hp, 85);
});
test('navigation routes around the safe house instead of walking through it', () => {
  const path = findPath({ x: 1, z: -12 }, { x: 1, z: 3 }); assert.ok(path.length > 5);
  assert.ok(path.every(p => !collides(p, .45))); assert.ok(path.some(p => Math.abs(p.x - 1) > 5));
});
test('night budget is bounded and dawn requires clearing every remaining Walker', () => {
  const s = clean(); s.setPhase('preparation', 29.99); step(s, .05); assert.equal(s.phase, 'night'); assert.ok(s.zombies.length > 0);
  s.horde.spawned = s.horde.budget; s.zombies = []; step(s, 3.1); assert.equal(s.phase, 'dawn');
  assert.equal(s.storage.items.rare, 1); assert.equal(s.storage.items.scrap, 3);
  step(s, 10.1); assert.equal(s.day, 2); assert.equal(s.phase, 'day');
  s.setPhase('night'); assert.equal(s.horde.budget, 24);
  for (let i = 0; i < 100; i++) s.spawn({ x: 1, z: 13 }); assert.equal(s.zombies.filter(z => z.active).length, 40);
});
test('Walkers hurt the player and destroy an unattended base at night', () => {
  const s = clean(); s.spawn({ x: 1, z: 7.9 }); step(s, 2); assert.ok(s.player.hp < 100);
  const base = clean(); base.setPhase('night'); base.player.x = -25; base.player.z = 15; base.baseHP = 2; base.spawn({ x: 1, z: 2.5 });
  step(base, 2); assert.equal(base.baseHP, 0); assert.ok(base.gameOver);
  const t = base.time; step(base, 2); assert.equal(base.time, t);
});
test('identical commands and seed produce repeatable simulations', () => {
  const a = new Simulation(), b = new Simulation(); step(a, 2, { ...input, fire: true }); step(b, 2, { ...input, fire: true });
  assert.deepEqual(a.player, b.player); assert.equal(a.ammo, b.ammo); assert.deepEqual(a.zombies, b.zombies);
});
