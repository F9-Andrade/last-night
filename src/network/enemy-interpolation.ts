import {COOP} from './gameplay-protocol.ts';

export interface EnemyPose {x:number;z:number;angle:number;gait:number}
interface Frame extends EnemyPose {time:number}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const turn=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

/** Presentation only. Sender times stay intact; sparse distance tiers need more history than near enemies. */
export class EnemyInterpolation {
 private frames:Frame[]=[];
 private gaps:number[]=[];
 private playhead:number|null=null;
 private sampledAt:number|null=null;
 get size(){return this.frames.length;}
 push(time:number,pose:EnemyPose):boolean {
  const last=this.frames.at(-1);
  if(last&&time<=last.time)return false;
  if(last&&Math.hypot(last.x-pose.x,last.z-pose.z)>8)this.clear();
  else if(last){this.gaps.push(time-last.time);if(this.gaps.length>8)this.gaps.shift();}
  this.frames.push({time,...pose});if(this.frames.length>24)this.frames.shift();return true;
 }
 sample(time:number,out:EnemyPose):boolean {
  if(!this.frames.length)return false;
  // Full checkpoints supply far entities every 500 ms; keep the existing low network rates.
  const delay=clamp(Math.max(0,...this.gaps)+50,COOP.enemyDelay,600),target=time-delay;
  const elapsed=this.sampledAt===null?0:Math.max(0,time-this.sampledAt);
  if(this.playhead===null||elapsed>1000)this.playhead=target;
  else this.playhead+=elapsed*clamp(1+(target-this.playhead-elapsed)/250,.5,1.2);
  this.sampledAt=time;
  while(this.frames.length>2&&this.frames[1].time<=this.playhead)this.frames.shift();
  const a=this.frames[0],b=this.frames[1]??a;
  const interval=b.time-a.time;
  // A short, bounded prediction covers jitter; outages cannot send enemies drifting indefinitely.
  const t=interval>0?clamp((this.playhead-a.time)/interval,0,1+100/interval):0;
  out.x=a.x+(b.x-a.x)*t;out.z=a.z+(b.z-a.z)*t;
  out.angle=a.angle+turn(a.angle,b.angle)*Math.min(1,t);out.gait=a.gait+(b.gait-a.gait)*t;
  return true;
 }
 clear(){this.frames=[];this.gaps=[];this.playhead=null;this.sampledAt=null;}
}

/** Observe once per packet, never once per enemy (which made clock drift depend on horde size). */
export class EnemyClock {
 private offset:number|null=null;private latest=-Infinity;
 observe(time:number,receivedAt:number){
  if(time<=this.latest)return;
  this.latest=time;const measured=receivedAt-time;
  this.offset=this.offset===null?measured:this.offset+clamp(measured-this.offset,-2,2)*.1;
 }
 time(now:number){return now-(this.offset??0);}
 clear(){this.offset=null;this.latest=-Infinity;}
}
