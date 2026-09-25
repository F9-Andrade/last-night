import type { Simulation } from './simulation';
import { rayBox,rayWorld } from './world.ts';
import { lookDirection,FPS } from './first-person.ts';
import { itemKeys } from './inventory.ts';
export interface Focus {kind:'portal'|'loot'|'defense'|'weapon'|'facility'|'alarm'|'event'|'base';id:string; x:number;z:number; y:number; distance:number}
/** Central gaze query uses gameplay volumes, independent of any renderer or UI. */
export function interactionFocus(sim:Simulation):Focus|null {
 const p=sim.player,origin={x:p.x,y:p.eyeY,z:p.z},dir=lookDirection(p.angle,p.pitch+p.aimKick);
 const candidates:{kind:Focus['kind'];id:string;x:number;z:number;w:number;d:number;h:number;bottom?:number}[]=[];
 for(const v of sim.portals)candidates.push({...v,kind:'portal',h:2.8});
 for(const v of sim.loot)if(!v.searched||itemKeys.some(k=>v.contents[k]))candidates.push({...v,kind:'loot',w:1.15,d:1,h:1.15});
 for(const v of sim.coopMode==='solo'?sim.barricades:[])candidates.push({...v,kind:'defense',h:v.hp>0?1.5:.3});
 for(const v of sim.groundWeapons)candidates.push({...v,kind:'weapon',id:String(v.item.uid),w:1.5,d:.9,h:.55});
 for(const v of sim.facilities)if(v.state==='ready')candidates.push({...v,kind:'facility',w:1.5,d:1.3,h:1.7});
 if(sim.alarmTimer>0&&sim.alarmPosition)candidates.push({...sim.alarmPosition,kind:'alarm',id:'alarm',w:1.9,d:3.7,h:1.8});
 if(sim.worldEvent?.kind==='cache'&&!sim.worldEvent.triggered)candidates.push({...sim.worldEvent,kind:'event',id:String(sim.worldEvent.id),w:1.2,d:1.2,h:1.1});
 if(sim.coopMode==='solo')candidates.push({kind:'base',id:'base',x:1,z:2,w:1.5,d:1.2,h:1.4});
 const solids=sim.solidDefenses.map(v=>({...v,h:'kind' in v?v.kind==='window'?2.4:2.8:1.4}));
 let selected:Focus|null=null;
 for(const box of candidates){
  if(Math.hypot(box.x-p.x,box.z-p.z)>FPS.interactionRange+Math.max(box.w,box.d)/2)continue;
  const distance=rayBox(origin,dir,box,FPS.interactionRange);
  if(!Number.isFinite(distance)||distance>(selected?.distance??FPS.interactionRange))continue;
  if(rayWorld(origin,dir,distance,solids.filter(v=>v.id!==box.id))<distance-.08)continue;
  selected={kind:box.kind,id:box.id,x:box.x,z:box.z,y:box.h/2,distance};
 }
 return selected;
}
