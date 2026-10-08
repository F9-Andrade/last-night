import type { Simulation } from '../game/simulation';
import './watch.css';

const clock = (value: number) => {
  const seconds = Math.max(0, Math.ceil(value));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

/** A brief field instrument readout. It never captures the cursor or pauses the simulation. */
export class WatchHUD {
  readonly panel: HTMLElement;
  private deadline = 0;
  private readonly label: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly day: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly detail: HTMLElement;
  constructor(private readonly root: HTMLElement) {
    this.panel = document.createElement('section');
    this.panel.id = 'field-watch'; this.panel.hidden = true;
    this.panel.setAttribute('aria-label', 'Relógio de sobrevivência');
    this.panel.innerHTML = `<div class="watch-strap watch-strap-top" aria-hidden="true"></div>
      <div class="watch-case"><i class="watch-screw a" aria-hidden="true"></i><i class="watch-screw b" aria-hidden="true"></i><i class="watch-screw c" aria-hidden="true"></i><i class="watch-screw d" aria-hidden="true"></i>
      <div class="watch-brand" aria-hidden="true">LAST NIGHT <span>FIELD / 01</span></div>
      <div class="watch-screen"><div class="watch-status"><span class="watch-day"></span><span class="watch-phase"></span></div>
      <span class="watch-label"></span><strong class="watch-time" role="timer" aria-live="off"></strong>
      <span class="watch-detail"></span><div class="watch-progress" aria-hidden="true"><i></i></div></div>
      <div class="watch-hint"><span>VERIFIQUE. SOBREVIVA.</span><span><kbd>K</kbd> guardar</span></div></div>
      <div class="watch-strap watch-strap-bottom" aria-hidden="true"></div>`;
    root.append(this.panel);
    this.label = this.panel.querySelector('.watch-label')!; this.timer = this.panel.querySelector('.watch-time')!;
    this.day = this.panel.querySelector('.watch-day')!; this.phase = this.panel.querySelector('.watch-phase')!;
    this.detail = this.panel.querySelector('.watch-detail')!;
  }
  get open(): boolean { return !this.panel.hidden; }
  toggle(sim: Simulation): void {
    if (this.open) { this.close(); return; }
    this.deadline = performance.now() + 5000; this.panel.hidden = false; this.update(sim);
  }
  close(): void { this.panel.hidden = true; this.deadline = 0; }
  update(sim: Simulation): void {
    if (!this.open) return;
    if (performance.now() >= this.deadline || sim.gameOver || !this.root.classList.contains('playing') || this.root.classList.contains('paused')) { this.close(); return; }
    const night = sim.phase === 'night', remaining = night ? sim.cycle.untilDay : sim.cycle.untilNight;
    const duration = night ? sim.cycle.durations.night : sim.cycle.daylight;
    this.panel.classList.toggle('night', night); this.panel.classList.toggle('urgent', !night && remaining <= 30);
    for (const [el, value] of [
      [this.label, night ? 'Amanhecer em' : 'Anoitecer em'], [this.timer, clock(remaining)],
      [this.day, `DIA ${String(sim.day + (sim.phase === 'dawn' ? 1 : 0)).padStart(2, '0')}`],
      [this.phase, night ? 'NOITE' : sim.phase === 'dawn' ? 'AMANHECER' : 'DIA'],
      [this.detail, night ? 'A horda avança até o amanhecer' : remaining <= 30 ? 'Volte para proteger a base' : 'Explore. Prepare o abrigo.'],
    ] as const) if (el.textContent !== value) el.textContent = value;
    this.panel.style.setProperty('--watch-progress', `${Math.min(100, Math.max(0, 1 - remaining / duration) * 100).toFixed(1)}%`);
  }
}
