import {INTERPOLATION_DELAY} from './protocol.ts';
import type {PlayerSnapshot} from './protocol.ts';
const angle=(a:number,b:number,t:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
/** Local receipt clock with a slowly corrected sender offset; bounded history/extrapolation. */
export class InterpolationBuffer {
 private frames:{at:number;s:PlayerSnapshot}[]=[];private lastSequence=-1;private lastTime=-1;private offset:number|null=null;
 get size(){return this.frames.length;}
 push(s:PlayerSnapshot,receivedAt:number){
  if(s.sequence<=this.lastSequence||s.time<this.lastTime)return false;
  this.lastSequence=s.sequence;this.lastTime=s.time;
  const measured=receivedAt-s.time;this.offset=this.offset===null?measured:this.offset+Math.max(-3,Math.min(3,measured-this.offset))*.1;
  const previous=this.frames.at(-1);if(previous&&Math.hypot(s.x-previous.s.x,s.y-previous.s.y,s.z-previous.s.z)>8)this.frames=[];
  const at=Math.max((this.frames.at(-1)?.at??-1)+.01,s.time+this.offset);this.frames.push({at,s});if(this.frames.length>32)this.frames.shift();return true;
 }
 sample(now:number):PlayerSnapshot|null{
  const target=now-INTERPOLATION_DELAY;while(this.frames.length>2&&this.frames[1].at<=target)this.frames.shift();
  const a=this.frames[0],b=this.frames[1];if(!a)return null;if(target<=a.at)return {...a.s};
  if(b&&target<=b.at){const t=Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at)));return {...a.s,x:a.s.x+(b.s.x-a.s.x)*t,y:a.s.y+(b.s.y-a.s.y)*t,z:a.s.z+(b.s.z-a.s.z)*t,yaw:angle(a.s.yaw,b.s.yaw,t),pitch:a.s.pitch+(b.s.pitch-a.s.pitch)*t,locomotion:t<.5?a.s.locomotion:b.s.locomotion};}
  const last=this.frames.at(-1)!;const dt=Math.max(0,Math.min(.1,(target-last.at)/1000));return {...last.s,x:last.s.x+last.s.vx*dt,z:last.s.z+last.s.vz*dt,locomotion:target-last.at>250?0:last.s.locomotion};
 }
 clear(){this.frames=[];this.lastSequence=-1;this.lastTime=-1;this.offset=null;}
}
