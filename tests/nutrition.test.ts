import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/simulation.ts';
import type { InputCommand } from '../src/game/simulation.ts';
import { Inventory, ITEMS, emptyStock, itemKeys } from '../src/game/inventory.ts';
import { FOODS, advanceNutrition, applyFood, createNutrition, foodKeys, isFood, nutritionRecovery } from '../src/game/nutrition.ts';
import { LOOT_TABLES, rollLoot } from '../src/game/loot.ts';
import type { LootArea } from '../src/game/loot.ts';

const idle: InputCommand = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 20, fire: false, run: false, reload: false, interact: false };
function actor() { const sim = new Simulation(); sim.coopMode = 'actor'; sim.zombies = []; sim.nutrition.hunger = sim.nutrition.thirst = 40; return sim; }
function advance(sim: Simulation, duration: number) { for (let i = 0; i < Math.ceil(duration * 60); i++) sim.update(1 / 60, idle); }
function rng(seed: number) { return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; }; }

test('every provision is a weighted inventory item with complete finite stock', () => {
  assert.equal(foodKeys.length, 8);
  assert.equal(isFood('__proto__'), false); assert.equal(isFood('toString'), false); assert.equal(isFood('ammo'), false);
  const inventory = new Inventory(3);
  for (const food of foodKeys) { assert.equal(inventory.add(food, 1), 1); assert.equal(ITEMS[food].weight, FOODS[food].weight); }
  assert.ok(inventory.weight > 2 && inventory.weight < 3);
  assert.equal(inventory.add('water', 100), 0);
  assert.ok(itemKeys.every(item => Number.isFinite(emptyStock()[item])));
});

test('eating completes exactly once, restores needs and never heals HP', () => {
  const sim = actor(); sim.inventory.add('cannedBeans', 2); sim.player.hp = 45;
  assert.equal(sim.beginConsume('cannedBeans'), true);
  advance(sim, 1); assert.equal(sim.inventory.items.cannedBeans, 2); assert.ok(sim.consumption);
  advance(sim, FOODS.cannedBeans.duration);
  assert.equal(sim.inventory.items.cannedBeans, 1); assert.equal(sim.consumption, null);
  assert.ok(sim.nutrition.hunger > 65 && sim.nutrition.hunger <= 66);
  assert.ok(sim.nutrition.thirst > 45 && sim.nutrition.thirst <= 46);
  assert.equal(sim.player.hp, 45);
  assert.equal(sim.events.filter(event => event.type === 'consume-done').length, 1);
  advance(sim, 1); assert.equal(sim.inventory.items.cannedBeans, 1);
});

test('moving, sprint, weapon inputs, healing and interaction cancel without losing food', () => {
  for (const command of [{ moveX: 1 }, { run: true }, { fire: true }, { reload: true }, { slot: 3 as const }, { heal: true }, { interact: true }, { heldInteract: true }, { dismantle: true }]) {
    const sim = actor(); sim.coopMode = 'solo'; sim.inventory.add('water', 1);
    assert.equal(sim.beginConsume('water'), true); sim.update(.1, { ...idle, ...command });
    assert.equal(sim.consumption, null, JSON.stringify(command)); assert.equal(sim.inventory.items.water, 1);
    assert.equal(sim.events.filter(event => event.type === 'consume-cancel').length, 1);
  }
  const remote = actor(); remote.inventory.add('water', 1); remote.beginConsume('water'); remote.player.moving = true;
  remote.update(.1, idle); assert.equal(remote.consumption, null); assert.equal(remote.inventory.items.water, 1);
});

test('taking a hit cancels eating; empty inventory and competing actions are rejected', () => {
  const sim = actor(); assert.equal(sim.beginConsume('cannedBeans'), false);
  sim.inventory.add('cannedBeans', 1); sim.reloadTimer = 1; assert.equal(sim.beginConsume('cannedBeans'), false); sim.reloadTimer = 0;
  sim.player.hp = 50; sim.update(0, { ...idle, heal: true }); assert.ok(sim.action); assert.equal(sim.beginConsume('cannedBeans'), false); sim.action = null;
  assert.equal(sim.beginConsume('cannedBeans'), true);
  sim.coopMode = 'solo'; sim.spawn({ x: sim.player.x, z: sim.player.z + .8 });
  for (let i = 0; i < 100 && sim.consumption; i++) sim.update(1 / 60, idle);
  assert.equal(sim.consumption, null); assert.equal(sim.inventory.items.cannedBeans, 1); assert.ok(sim.player.hp < 50);
});

test('food transaction cannot duplicate if the source item disappears while eating', () => {
  const sim = actor(); sim.inventory.add('cannedBeans', 1); sim.beginConsume('cannedBeans'); sim.inventory.take('cannedBeans', 1);
  advance(sim, 4); assert.equal(sim.consumption, null); assert.ok(sim.nutrition.hunger < 40); assert.equal(sim.inventory.items.cannedBeans, 0);
});

test('replica predicts gesture only and waits for the authoritative completion', () => {
  const sim = actor(); sim.coopMode = 'replica'; sim.inventory.add('water', 1); const before = { ...sim.nutrition };
  assert.ok(sim.beginConsume('water')); advance(sim, 4);
  assert.equal(sim.consumption?.elapsed, FOODS.water.duration); assert.equal(sim.inventory.items.water, 1); assert.deepEqual(sim.nutrition, before);
  assert.equal(sim.events.filter(event => event.type === 'consume-done').length, 0);
});

test('deprivation is gradual, bounded, slower idle than sprint, and never heals', () => {
  const idleNeeds = createNutrition(), sprint = createNutrition();
  advanceNutrition(idleNeeds, 360, false); advanceNutrition(sprint, 360, true);
  assert.ok(idleNeeds.hunger > 75 && idleNeeds.hunger < 85); assert.ok(idleNeeds.thirst > 75 && idleNeeds.thirst < 85);
  assert.ok(sprint.hunger < idleNeeds.hunger); assert.ok(sprint.thirst < idleNeeds.thirst);
  const dry = { hunger: 0, thirst: 0, starvationTimer: 0 };
  assert.equal(advanceNutrition(dry, 4, false), 0); assert.equal(advanceNutrition(dry, 1, false), 3); assert.equal(dry.starvationTimer, 0);
  const unchanged = { ...dry }; advanceNutrition(dry, NaN, false); advanceNutrition(dry, -10, false); assert.deepEqual(dry, unchanged);
  for (const food of foodKeys) { applyFood(dry, food); assert.ok(dry.hunger >= 0 && dry.hunger <= 100 && dry.thirst >= 0 && dry.thirst <= 100); }
  assert.equal(nutritionRecovery(createNutrition()), 1); assert.ok(nutritionRecovery({ hunger: 0, thirst: 0, starvationTimer: 0 }) >= .57);
});

test('actor starvation uses raw coordinator damage and healthy stamina remains unchanged', () => {
  const sim = actor(); sim.nutrition.hunger = sim.nutrition.thirst = 0; sim.gear.armor = 100;
  const calls: { amount: number; cause?: string }[] = [];
  sim.onCoopDamage = (_player, amount, _position, cause) => calls.push({ amount, cause }); advance(sim, 5);
  assert.deepEqual(calls, [{ amount: 3, cause: 'deprivation' }]); assert.equal(sim.gear.armor, 100);
  const healthy = actor(), hungry = actor(); healthy.nutrition = createNutrition(); hungry.nutrition.hunger = hungry.nutrition.thirst = 5;
  healthy.player.stamina = hungry.player.stamina = 30; healthy.update(.5, idle); hungry.update(.5, idle);
  assert.equal(healthy.player.stamina, 39); assert.ok(hungry.player.stamina < healthy.player.stamina && hungry.player.stamina > 34);
});

test('poor nutrition preserves exhaustion hysteresis until the real stamina threshold is reached', () => {
  const sim = actor(); sim.nutrition.hunger = sim.nutrition.thirst = 0;
  sim.player.stamina = 23.5; sim.player.exhausted = true; sim.player.moving = true;
  sim.update(.1, { ...idle, run: true });
  assert.ok(sim.player.stamina < 25); assert.equal(sim.player.exhausted, true); assert.equal(sim.player.running, false);
  sim.update(.1, { ...idle, run: true });
  assert.ok(sim.player.stamina >= 25); assert.equal(sim.player.exhausted, false);
  sim.update(.1, { ...idle, run: true }); assert.equal(sim.player.running, true);
});

test('added food preserves legacy loot and RNG consumption; sealed food and drinks dominate', () => {
  let provisions = 0, sealed = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const random = rng(seed), legacyRandom = rng(seed), area: LootArea = ['market', 'house', 'gas', 'hospital', 'police', 'outside'][seed % 6] as LootArea;
    const actual = rollLoot(area, random), legacy = emptyStock(), table = LOOT_TABLES[area], total = table.reduce((sum, row) => sum + row.weight, 0);
    for (let i = 0; i < 2; i++) { let roll = legacyRandom() * total; const row = table.find(entry => (roll -= entry.weight) < 0) ?? table.at(-1)!; legacy[row.item] += row.min + Math.floor(legacyRandom() * (row.max - row.min + 1)); }
    if (legacyRandom() < .55) legacy.cloth += 1 + Math.floor(legacyRandom() * 3);
    for (const item of itemKeys) if (!isFood(item)) assert.equal(actual[item], legacy[item]);
    assert.equal(random(), legacyRandom()); assert.deepEqual(actual, rollLoot(area, rng(seed)));
    for (const food of foodKeys) { provisions += actual[food]; if (food.startsWith('canned') || food === 'water' || food === 'soda') sealed += actual[food]; }
  }
  assert.ok(provisions > 350 && provisions < 700); assert.ok(sealed / provisions > .85);
  const market = new Simulation().loot.find(loot => loot.id === 'market-crate')!;
  assert.equal(market.guaranteed?.water, 1); assert.equal(market.guaranteed?.cannedBeans, 1); assert.equal(market.searched, false);
});
