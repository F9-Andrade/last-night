import { BALANCE } from './config.ts';
/** Three paced groups; failed spawns never consume budget. */
export class Horde {
  active = false; spawned = 0; budget = BALANCE.horde.first; wave = 0; timer = 0; private limits: number[] = [];
  start(day: number): void {
    this.active = true; this.spawned = 0; this.wave = 0; this.timer = 0;
    this.budget = Math.min(BALANCE.horde.maximum, BALANCE.horde.first + (day - 1) * BALANCE.horde.perDay);
    this.limits = [Math.floor(this.budget * .28), Math.floor(this.budget * .61), this.budget];
  }
  get complete(): boolean { return this.active && this.spawned >= this.budget; }
  update(dt: number, day: number, spawn: () => boolean): void {
    if (!this.active || this.complete) return;
    this.timer -= dt; if (this.timer > 0) return;
    if (!spawn()) { this.timer = .5; return; }
    this.spawned++;
    this.timer = Math.max(BALANCE.horde.minimumInterval, BALANCE.horde.spawnInterval - (day - 1) * .1);
    if (this.spawned >= this.limits[this.wave] && this.wave < 2) { this.wave++; this.timer += BALANCE.horde.waveGap; }
  }
}
