import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchCycle } from '../src/game/cycle.ts';
import { Horde } from '../src/game/horde.ts';
import { BALANCE } from '../src/game/config.ts';
import { CoopWorld } from '../src/network/coop-world.ts';

test('a full production cycle has 600 seconds of daylight and 600 seconds of night', () => {
  const c = new MatchCycle(), times: { event: string; at: number }[] = [];
  assert.equal(c.daylight, 600); assert.equal(c.untilNight, 600); assert.equal(c.untilDay, 0);
  for (let second = 1; second <= 3000; second++) {
    for (const event of c.update(1, true)) times.push({ event, at: second });
    if (second === 1200) { assert.equal(c.phase, 'dawn'); assert.equal(c.untilNight, 600); }
    if (second === 1210) { assert.equal(c.phase, 'day'); assert.equal(c.untilNight, 590); }
  }
  assert.deepEqual(times.filter(e => e.event === 'night').map(e => e.at), [600, 1800, 3000]);
  assert.deepEqual(times.filter(e => e.event === 'dawn').map(e => e.at), [1200, 2400]);
  assert.deepEqual(times.filter(e => e.event === 'preparation').map(e => e.at), [570, 1770, 2970]);
  assert.equal(times.filter(e => e.event === 'survived').length, 2);
});

test('clearing a horde cannot finish night early and surviving enemies cannot delay dawn', () => {
  for (const cleared of [true, false]) {
    const c = new MatchCycle(); c.seek('night');
    for (let i = 0; i < 599; i++) assert.deepEqual(c.update(1, cleared), []);
    assert.equal(c.untilDay, 1); assert.equal(c.phase, 'night'); assert.equal(c.silence, 0);
    assert.deepEqual(c.update(1, cleared), ['survived', 'dawn']); assert.equal(c.untilDay, 0);
    assert.deepEqual(c.update(.1, cleared), []);
  }
});

test('custom test timings remain supported and clocks stay finite on invalid frame deltas', () => {
  const c = new MatchCycle({ day: 3, dusk: 1, preparation: 1, night: 2, dawn: .5, silence: .2 });
  c.seek('night', 1.5); assert.equal(c.untilDay, .5);
  for (const dt of [NaN, Infinity, -1, 0]) assert.deepEqual(c.update(dt), []);
  assert.equal(c.elapsed, 1.5); assert.deepEqual(c.update(.5), ['survived', 'dawn']);
  assert.equal(c.untilNight, 5); c.update(.5); assert.equal(c.day, 2); assert.equal(c.untilNight, 4.5);
  const legacy = new MatchCycle({ day: 3, dusk: 1, preparation: 1, dawn: .5, silence: .2 });
  assert.equal(legacy.durations.night, 600);
});

test('reinforcements repeat without enlarging active pools or spending blocked spawns', () => {
  const h = new Horde(); h.start(3);
  let active = 0, total = 0, maxActive = 0;
  for (let frame = 0; frame < 6000; frame++) {
    if (frame % 100 === 0) active = 0;
    h.update(.1, 3, () => {
      if (active >= 5) return false;
      active++; total++; maxActive = Math.max(active, maxActive); return true;
    });
    assert.ok(h.spawned >= 0 && h.spawned <= h.budget); assert.ok(h.wave >= 0 && h.wave <= 2);
  }
  assert.ok(total > h.budget * 2); assert.equal(maxActive, 5);
  h.timer = 0; const prior = h.spawned; h.update(.1, 3, () => false); assert.equal(h.spawned, prior);
  h.active = false; const stopped = total; h.update(600, 3, () => { total++; return true; }); assert.equal(total, stopped);
  h.start(999); assert.equal(h.budget, BALANCE.horde.maximum);
});

test('host migration preserves time remaining and resumes reinforcement pacing', () => {
  const world = new CoopWorld(9021, [1, 2]); world.sim.setPhase('night', 417.25);
  world.sim.horde.spawned = world.sim.horde.budget; world.sim.horde.timer = 4;
  const checkpoint = world.checkpoint(), migrated = CoopWorld.restore(9021, checkpoint, [2]);
  assert.equal(migrated.sim.cycle.untilDay, 182.75); assert.equal(migrated.sim.horde.timer, 4);
  let spawned = 0; migrated.sim.horde.update(3, 1, () => { spawned++; return true; }); assert.equal(spawned, 0);
  migrated.sim.horde.update(1, 1, () => { spawned++; return true; }); assert.equal(spawned, 1);
  assert.equal(migrated.sim.horde.spawned, 1); assert.equal(migrated.sim.horde.wave, 0);
});
