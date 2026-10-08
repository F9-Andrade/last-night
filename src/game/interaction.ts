import type { Simulation } from './simulation';
import { rayBox,rayWorld } from './world.ts';
import { lookDirection,FPS } from './first-person.ts';
import { itemKeys } from './inventory.ts';
export interface Focus {kind:'portal'|'loot'|'defense'|'weapon'|'facility'|'alarm'|'event'|'base';id:string; x:number;z:number; y:number; distance:number}
/** Central gaze query uses gameplay volumes, independent of any renderer or UI. */
export function interactionFocus(sim:Simulation):Focus|null {
 const p=sim.player,origin={x:p.x,y:p.eyeY,z:p.z},dir=lookDirection(p.angle,p.pitch+p.aimKick);
 let selected:Focus|null=null,solids:ReturnType<typeof collisionVolumes>|undefined;
 const collisionVolumes=()=>sim.solidDefenses.map(v=>({...v,h:'kind' in v?v.kind==='window'?2.4:2.8:v.h??1.4}));
 // Most of Santa Luz is outside interaction range. Test distance before creating
 // candidate boxes, and assemble occluders only when the gaze actually hits one.
 const consider=(v:{x:number;z:number;bottom?:number},kind:Focus['kind'],id:string,w:number,d:number,h:number)=>{
  if(Math.hypot(v.x-p.x,v.z-p.z)>FPS.interactionRange+Math.max(w,d)/2)return;
  const box={x:v.x,z:v.z,bottom:v.bottom,w,d,h};
  const distance=rayBox(origin,dir,box,FPS.interactionRange);
  if(!Number.isFinite(distance)||distance>(selected?.distance??FPS.interactionRange))return;
  solids??=collisionVolumes();
  if(rayWorld(origin,dir,distance,solids.filter(v=>v.id!==id))<distance-.08)return;
  selected={kind,id,x:v.x,z:v.z,y:h/2,distance};
 };
 // Preserve priority and equal-distance tie order from the original candidate list.
 for(const v of sim.portals)consider(v,'portal',v.id,v.w,v.d,2.8);
 for(const v of sim.loot)if(!v.searched||(v.coins??0)>0||itemKeys.some(k=>v.contents[k]))consider(v,'loot',v.id,1.15,1,1.15);
 for(const v of sim.barricades)if(v.hp>0)consider(v,'defense',v.id,v.w,v.d,1.5);
 for(const v of sim.groundWeapons)consider(v,'weapon',String(v.item.uid),1.5,.9,.55);
 for(const v of sim.facilities)if(v.state==='ready')consider(v,'facility',v.id,1.5,1.3,1.7);
 if(sim.alarmTimer>0&&sim.alarmPosition)consider(sim.alarmPosition,'alarm','alarm',1.9,3.7,1.8);
 if(sim.worldEvent?.kind==='cache'&&!sim.worldEvent.triggered)consider(sim.worldEvent,'event',String(sim.worldEvent.id),1.2,1.2,1.1);
 consider({x:1,z:2},'base','base',1.5,2.2,.9);
 return selected;
}
