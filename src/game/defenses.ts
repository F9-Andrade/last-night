import { BALANCE } from './config.ts';
import type { Obstacle, Vec2 } from './world.ts';
export interface Barricade extends Obstacle { id: string; label: string; hp: number; built: boolean; flash: number; open?:boolean; tier?:number; trap?:TrapKind; trapTimer?:number }
export type TrapKind='spikes'|'snare'|'wire';
export const DEFENSE_POINTS: (Omit<Barricade,'hp'|'built'|'flash'>)[] = [
  { id: 'gate', label: 'Entrada principal', x: 1, z: 9, w: 6.6, d: .6 },
  { id: 'west', label: 'Acesso oeste', x: -4.35, z: 0, w: 1.7, d: .6 },
  { id: 'east', label: 'Acesso leste', x: 6.35, z: 0, w: 1.7, d: .6 },
  { id: 'bed-gate', label: 'Portão da cama', x: 1, z: 6, w: 3, d: .6 },
  { id: 'north', label: 'Parede norte', x: 1, z: -2, w: 11, d: .6 },
  { id: 'west-wall', label: 'Parede oeste', x: -4.5, z: 2, w: .6, d: 8 },
  { id: 'east-wall', label: 'Parede leste', x: 6.5, z: 2, w: .6, d: 8 },
  { id: 'south-left', label: 'Frente esquerda', x: -2.5, z: 6, w: 4, d: .6 },
  { id: 'south-right', label: 'Frente direita', x: 4.5, z: 6, w: 4, d: .6 },
  {id:'spikes-front',label:'Estacas frontais',x:1,z:11,w:4,d:1.5,trap:'spikes'},
  {id:'spikes-rear',label:'Estacas traseiras',x:1,z:-5,w:4,d:1.5,trap:'spikes'},
  {id:'snare-west',label:'Laço oeste',x:-7,z:2,w:1.8,d:1.8,trap:'snare'},
  {id:'snare-east',label:'Laço leste',x:9,z:2,w:1.8,d:1.8,trap:'snare'},
  {id:'wire-west',label:'Cerca de arame oeste',x:-7,z:6,w:.6,d:4,trap:'wire'},
  {id:'wire-east',label:'Cerca de arame leste',x:9,z:6,w:.6,d:4,trap:'wire'},
];
export const createDefenses = (): Barricade[] => DEFENSE_POINTS.map(p => ({ ...p, hp: 0, built: false, flash: 0, tier:0, trapTimer:0 }));
export function obstacleDistance(p: Vec2, b: Obstacle): number { return Math.hypot(Math.max(0, Math.abs(p.x - b.x) - b.w / 2), Math.max(0, Math.abs(p.z - b.z) - b.d / 2)); }
export const defenseMaxHP=(b:Pick<Barricade,'tier'|'trap'>)=>b.trap?200:(b.tier===2?900:b.tier===1?550:300);
export function gateStep(current:number,open:boolean,dt:number):number{return current+((open?Math.PI/2:0)-current)*(1-Math.exp(-Math.min(.1,Math.max(0,dt))*10));}
export function damageStage(hp: number,max= BALANCE.barricade.hp): number { return hp <= 0 ? 3 : hp / max > .66 ? 0 : hp / max > .33 ? 1 : 2; }
