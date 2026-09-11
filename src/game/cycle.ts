import { BALANCE } from './config.ts';
export type Phase = 'day' | 'dusk' | 'preparation' | 'night' | 'dawn';
export type CycleEvent = 'dusk' | 'preparation' | 'night' | 'survived' | 'dawn' | 'day' | 'countdown';
/** One authoritative clock. Night has a minimum wave schedule and a clearance condition, never a timeout victory. */
export class MatchCycle {
  phase: Phase = 'day'; elapsed = 0; day = 1; silence = 0; private lastSecond = 11;
  readonly durations: typeof BALANCE.cycle;
  constructor(durations = BALANCE.cycle) { this.durations = { ...durations }; }
  get daylight(): number { return this.durations.day + this.durations.dusk + this.durations.preparation; }
  get untilNight(): number { return this.phase === 'day' ? this.daylight - this.elapsed : this.phase === 'dusk' ? this.durations.dusk + this.durations.preparation - this.elapsed : this.phase === 'preparation' ? this.durations.preparation - this.elapsed : 0; }
  get time(): number { return this.phase === 'day' ? this.elapsed : this.phase === 'dusk' ? this.durations.day + this.elapsed : this.phase === 'preparation' ? this.durations.day + this.durations.dusk + this.elapsed : this.daylight + this.elapsed; }
  get darkness(): number { return this.phase === 'night' ? 1 : this.phase === 'dawn' ? Math.max(0, 1 - this.elapsed / this.durations.dawn) : Math.max(0, Math.min(1, 1 - this.untilNight / (this.durations.dusk + this.durations.preparation + 10))); }
  /** Development/test setup only; production changes phases through update. */
  seek(phase: Phase, elapsed = 0): void { this.phase = phase; this.elapsed = elapsed; this.silence = 0; this.lastSecond = 11; }
  update(dt: number, cleared: boolean): CycleEvent[] {
    const events: CycleEvent[] = []; this.elapsed += dt;
    if (this.phase === 'night') {
      if (cleared) { this.silence += dt; if (this.silence - dt === 0) events.push('survived'); }
      else this.silence = 0;
      if (this.silence >= this.durations.silence) { this.seek('dawn'); events.push('dawn'); }
    } else if (this.elapsed >= this.durations[this.phase]) {
      const next: Phase = this.phase === 'day' ? 'dusk' : this.phase === 'dusk' ? 'preparation' : this.phase === 'preparation' ? 'night' : 'day';
      if (next === 'day') this.day++;
      this.seek(next); events.push(next);
    }
    if (this.phase === 'preparation' && this.untilNight <= 10) {
      const second = Math.ceil(this.untilNight);
      if (second < this.lastSecond) { this.lastSecond = second; events.push('countdown'); }
    }
    return events;
  }
}
