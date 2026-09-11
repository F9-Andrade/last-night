import { BALANCE } from './config.ts';
import { ENEMIES } from './enemies.ts';
import type { EnemyKind } from './enemies.ts';
import type { Vec2 } from './world.ts';
export type HitZone = 'HEAD' | 'TORSO' | 'ARMS' | 'LEGS';
export interface Wound { zone: HitZone; side: number; y: number }
export const damageFor = (zone: HitZone): number => BALANCE.pistol.damage * BALANCE.combat.multipliers[zone];
/** Anatomical volumes in actor-local space; distance is along the horizontal shot ray. */
export function bodyHit(origin: Vec2, dir: Vec2, slope: number, actor: Vec2 & { angle: number; kind?:EnemyKind }, max: number, originHeight=1.3): { distance: number; zone: HitZone; side: number; y: number } | null {
  const c = Math.cos(actor.angle), s = Math.sin(actor.angle), dx = origin.x - actor.x, dz = origin.z - actor.z;
  const o = [dx*c-dz*s, originHeight, dx*s+dz*c], v = [dir.x*c-dir.z*s,slope,dir.x*s+dir.z*c];
  const volumes: [HitZone, number, number, number, number, number, number][] = [
    ['HEAD',-.07,1.89,.18,.29,.31,.3], ['TORSO',0,1.22,0,.37,.36,.3],
    ['ARMS',-.51,1.15,.1,.19,.39,.28], ['ARMS',.51,1.15,.1,.19,.39,.28],
    ['LEGS',-.23,.49,0,.19,.43,.24], ['LEGS',.23,.49,0,.19,.43,.24],
  ];
  const shape=ENEMIES[actor.kind??'walker'];
  let result: ReturnType<typeof bodyHit> = null;
  for (const [zone,bx,by,bz,bw,bh,bd] of volumes) {
    const x=bx*shape.scaleX,y=zone==='HEAD'?shape.headY:by*shape.scaleY,z=zone==='HEAD'?shape.headZ:bz;
    const w=bw*(zone==='HEAD'?Math.min(1.25,shape.scaleX):shape.scaleX),h=bh*shape.scaleY,d=bd*(actor.kind==='tank'?1.2:1);
    const center=[x,y,z], half=[w,h,d]; let near=0,far=max;
    for(let i=0;i<3;i++) { if(Math.abs(v[i])<1e-8) { if(Math.abs(o[i]-center[i])>half[i]) far=-1; } else { const a=(center[i]-half[i]-o[i])/v[i],b=(center[i]+half[i]-o[i])/v[i]; near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b)); } }
    if(near<=far && near<max && (!result || near<result.distance)) result={distance:near,zone,side:x<0?-1:1,y:originHeight+slope*near};
  }
  return result;
}
export interface Corpse extends Vec2 { id: number; angle: number; fall: number; variant: number; age: number; wounds: Wound[]; kind?:EnemyKind }
/** Dead actors leave the AI pool immediately. Visual bodies have their own bounded lifetime. */
export class CorpseManager {
  bodies: Corpse[]=[];
  add(actor: Vec2 & {id:number;angle:number;wounds:Wound[]}, dir: Vec2, variant=actor.id%3): void {
    // Simulation reserves one body slot for every living actor before spawning.
    if(this.bodies.length>=BALANCE.combat.corpseLimit) return;
    this.bodies.push({...actor,variant,fall:Math.atan2(dir.x,dir.z)-actor.angle,age:0,wounds:actor.wounds.map(w=>({...w}))});
  }
  update(dt:number, camera:Vec2):void {
    for(const c of this.bodies) c.age+=dt*(c.age>20 && Math.hypot(c.x-camera.x,c.z-camera.z)>65 ? 1.5:1);
    this.bodies=this.bodies.filter(c=>c.age<BALANCE.combat.corpseLifetime+BALANCE.combat.corpseFade);
  }
}
