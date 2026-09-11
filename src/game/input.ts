import type { InputCommand } from './simulation';
import type { GameScene } from '../render/scene';
export class Input {
  keys = new Set<string>(); mouse = { x: innerWidth / 2, y: innerHeight / 2 }; fire = false; private shotRequested = false; private reload = false; private interact = false; private heal = false; private dismantle = false;
  constructor(canvas: HTMLCanvasElement, pause: () => void, inventory: () => void) {
    window.addEventListener('keydown', e => {
      if(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement)return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyR', 'KeyE', 'Escape', 'Digit1', 'Digit2', 'Tab', 'KeyH', 'KeyX'].includes(e.code)) e.preventDefault();
      if (e.code === 'Tab' && !e.repeat) inventory();
      if (e.code === 'KeyH' && !e.repeat) this.heal = true;
      if (e.code === 'KeyX' && !e.repeat) this.dismantle = true;
      if (e.code === 'Escape' && !e.repeat) pause();
      if (e.code === 'KeyR' && !e.repeat) this.reload = true;
      if (e.code === 'KeyE' && !e.repeat) this.interact = true;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('pointermove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    canvas.addEventListener('pointerdown', e => { if (e.button === 0) { this.fire = true; this.shotRequested = true; } });
    window.addEventListener('pointerup', () => { this.fire = false; });
    window.addEventListener('blur', () => this.clear());
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  clear(): void { this.keys.clear(); this.fire = false; this.shotRequested = false; this.reload = false; this.interact = false; this.heal = false; this.dismantle = false; }
  requestHeal(): void { this.heal = true; }
  command(view: GameScene, locked = false): InputCommand {
    const horizontal = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const vertical = Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW'));
    const aim = view.aim(this.mouse.x, this.mouse.y);
    const command = { moveX: (horizontal + vertical) * Math.SQRT1_2, moveZ: (vertical - horizontal) * Math.SQRT1_2, aimX: aim.x, aimZ: aim.z, aimY: aim.y, fire: this.fire || this.shotRequested, trigger:this.shotRequested, run: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), reload: this.reload, interact: !locked && this.interact, heldInteract: !locked && this.keys.has('KeyE'), heal: this.heal, dismantle: !locked && this.dismantle };
    if (locked) { command.moveX = 0; command.moveZ = 0; command.fire = false; command.reload = false; }
    this.shotRequested = false; this.reload = false; this.interact = false; this.heal = false; this.dismantle = false; return command;
  }
}
