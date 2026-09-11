import { BALANCE } from './config.ts';
import type { Obstacle, Vec2 } from './world.ts';
export interface Barricade extends Obstacle { id: string; label: string; hp: number; built: boolean; flash: number }
export const DEFENSE_POINTS = [
  { id: 'gate', label: 'Entrada principal', x: 1, z: 9, w: 6.6, d: .6 },
  { id: 'west', label: 'Acesso oeste', x: -4.35, z: 0, w: 1.7, d: .6 },
  { id: 'east', label: 'Acesso leste', x: 6.35, z: 0, w: 1.7, d: .6 },
];
export const createDefenses = (): Barricade[] => DEFENSE_POINTS.map(p => ({ ...p, hp: 0, built: false, flash: 0 }));
export function obstacleDistance(p: Vec2, b: Obstacle): number { return Math.hypot(Math.max(0, Math.abs(p.x - b.x) - b.w / 2), Math.max(0, Math.abs(p.z - b.z) - b.d / 2)); }
export function damageStage(hp: number): number { return hp <= 0 ? 3 : hp / BALANCE.barricade.hp > .66 ? 0 : hp / BALANCE.barricade.hp > .33 ? 1 : 2; }
