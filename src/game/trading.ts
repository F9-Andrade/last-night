import {merchantReachable,TRADE_RANGE} from './economy.ts';
import {lookDirection} from './first-person.ts';
import type {Simulation} from './simulation.ts';

/** Gaze and line-of-sight agree with the authority's range check. */
export function focusedMerchant(s:Simulation) {
 const p=s.player,dir=lookDirection(p.angle,p.pitch);
 return s.economy.merchants.find(m=>{
  const dx=m.x-p.x,dz=m.z-p.z,dy=m.y+1.25-p.eyeY,len=Math.hypot(dx,dz,dy);
  return len<TRADE_RANGE&&len>.05&&(dx*dir.x+dy*dir.y+dz*dir.z)/len>.91&&merchantReachable(m,p,s.solidDefenses);
 });
}
