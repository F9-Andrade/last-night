import { BALANCE } from './config.ts';
export type Phase = 'day' | 'dusk' | 'preparation' | 'night' | 'dawn';
export type CycleEvent = 'dusk' | 'preparation' | 'night' | 'survived' | 'dawn' | 'day' | 'countdown';
export type CycleDurations = typeof BALANCE.cycle;
export type CycleDurationsInput = Omit<CycleDurations, 'night'> & Partial<Pick<CycleDurations, 'night'>>;
/** One authoritative clock. Dawn is time-based; clearing a wave never skips the night. */
export class MatchCycle {
  phase: Phase = 'day'; elapsed = 0; day = 1; silence = 0; private lastSecond = 11;
  readonly durations: CycleDurations;
  constructor(durations: CycleDurationsInput = BALANCE.cycle) { this.durations = { ...BALANCE.cycle, ...durations }; }
  get daylight(): number { return this.durations.day + this.durations.dusk + this.durations.preparation; }
  get untilNight(): number { return Math.max(0, this.phase === 'day' || this.phase === 'dawn' ? this.daylight - this.elapsed : this.phase === 'dusk' ? this.durations.dusk + this.durations.preparation - this.elapsed : this.phase === 'preparation' ? this.durations.preparation - this.elapsed : 0); }
  get untilDay(): number { return this.phase === 'night' ? Math.max(0, this.durations.night - this.elapsed) : 0; }
  get time(): number { return this.phase === 'day' || this.phase === 'dawn' ? this.elapsed : this.phase === 'dusk' ? this.durations.day + this.elapsed : this.phase === 'preparation' ? this.durations.day + this.durations.dusk + this.elapsed : this.daylight + this.elapsed; }
  get darkness(): number { return this.phase === 'night' ? 1 : this.phase === 'dawn' ? Math.max(0, 1 - this.elapsed / this.durations.dawn) : Math.max(0, Math.min(1, 1 - this.untilNight / (this.durations.dusk + this.durations.preparation + 10))); }
  /** Development/test setup only; production changes phases through update. */
  seek(phase: Phase, elapsed = 0): void { this.phase = phase; this.elapsed = elapsed; this.silence = 0; this.lastSecond = 11; }
  update(dt: number, _cleared = false): CycleEvent[] {
    const events: CycleEvent[] = []; if (!Number.isFinite(dt) || dt <= 0) return events;
    this.elapsed += dt; this.silence = 0;
    if (this.elapsed + 1e-8 >= this.durations[this.phase]) {
      const previous = this.phase, overflow = Math.max(0, this.elapsed - this.durations[this.phase]);
      const next: Phase = previous === 'day' ? 'dusk' : previous === 'dusk' ? 'preparation' : previous === 'preparation' ? 'night' : previous === 'night' ? 'dawn' : 'day';
      if (next === 'day') this.day++;
      // The dawn fade belongs to the next ten-minute daylight, not an extra phase of survival time.
      this.seek(next, overflow + (previous === 'dawn' ? Math.min(this.durations.dawn, this.durations.day) : 0));
      if (next === 'dawn') events.push('survived');
      events.push(next);
    }
    if (this.phase === 'preparation' && this.untilNight <= 10) {
      const second = Math.ceil(this.untilNight);
      if (second < this.lastSecond) { this.lastSecond = second; events.push('countdown'); }
    }
    return events;
  }
}
