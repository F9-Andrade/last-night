/** Pacing policy consumes aggregated survivor observations, with no camera or mutation
 * of health, aim, ammunition, RNG, actor positions or damage. Future teams can pass
 * more than one survivor. Existing encounters remain governed by world rules.
 */
export type TensionState='CALM'|'SUSPENSE'|'CONTACT'|'PRESSURE'|'PEAK'|'RELIEF';
export interface SurvivorPressure {hp:number;ammo:number;healing:number;stamina:number;nearby:number;engaged:number;atShelter:boolean;inside:boolean;night:boolean}
export const TENSION={sample:1,calm:38,suspense:55,relief:42,contactGrace:9,peakHold:14,cueInterval:27};
export class TensionDirector {
 state:TensionState='CALM';elapsed=0;time=0;quiet=0;noise=0;allowPressure=false;cue=false;
 transitions:{time:number;state:TensionState}[]=[{time:0,state:'CALM'}];
 private clock=0;private cueClock=0;
 hear(strength:number){this.noise=Math.min(1,this.noise+strength/80);}
 update(dt:number,survivors:readonly SurvivorPressure[],alarm=false):boolean{
  this.clock+=dt;if(this.clock<TENSION.sample)return false;const step=this.clock;this.clock=0;
  this.time+=step;this.elapsed+=step;this.cueClock+=step;this.cue=false;this.noise=Math.max(0,this.noise-step*.035);
  const engaged=survivors.reduce((n,p)=>n+p.engaged,0),near=survivors.reduce((n,p)=>n+p.nearby,0),weak=survivors.some(p=>p.hp<30||p.ammo<3&&p.healing===0),safe=survivors.every(p=>p.atShelter);
  this.quiet=engaged?0:this.quiet+step;
  let next=this.state;
  if(engaged>=7||alarm&&engaged>=3)next='PEAK';
  else if(engaged>=4)next='PRESSURE';
  else if(engaged>0)next='CONTACT';
  else if(['CONTACT','PRESSURE','PEAK'].includes(this.state)&&this.quiet>TENSION.contactGrace)next='RELIEF';
  else if(this.state==='RELIEF'&&this.elapsed>=TENSION.relief)next='CALM';
  else if(this.state==='CALM'&&!safe&&this.elapsed>=TENSION.calm)next='SUSPENSE';
  else if(this.state==='SUSPENSE'&&(safe||this.elapsed>TENSION.suspense))next='CALM';
  // Keep a short peak envelope; this changes music/opportunities only, never actors.
  if(this.state==='PEAK'&&this.elapsed<TENSION.peakHold&&next==='CONTACT')next='PEAK';
  if(next!==this.state){this.state=next;this.elapsed=0;this.transitions.push({time:this.time,state:next});if(this.transitions.length>64)this.transitions.shift();}
  this.allowPressure=!weak&&!safe&&this.state!=='CALM'&&this.state!=='RELIEF'&&near<9;
  if(this.state==='SUSPENSE'&&this.cueClock>TENSION.cueInterval){this.cue=true;this.cueClock=0;}
  return true;
 }
}
