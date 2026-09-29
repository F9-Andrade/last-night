import * as THREE from 'three';

export interface RagdollPoint {position:THREE.Vector3;radius:number;mass:number}
interface Link {a:number;b:number;length:number}
/** Small position-based ragdoll: gravity, constrained joints and damped ground contacts.
 * Fixed 60 Hz steps make presentation independent of the display refresh rate. */
export class Ragdoll {
 readonly positions:THREE.Vector3[];
 private previous:THREE.Vector3[];
 private links:Link[];
 private steps=0;
 readonly duration=2.4;
 readonly points:RagdollPoint[];
 constructor(points:RagdollPoint[],links:[number,number][],impulse:THREE.Vector3,seed:number){
  this.points=points;
  this.positions=points.map(p=>p.position.clone());
  this.previous=points.map((p,i)=>p.position.clone().addScaledVector(impulse,-(i===2?1.08:.65+(i%3)*.08)/60));
  // Small asymmetric joint response; no random explosions or high-energy launch.
  this.previous[5].x+=(seed%2?1:-1)*.002;this.previous[6].z-=.003;
  this.links=links.map(([a,b])=>({a,b,length:points[a].position.distanceTo(points[b].position)}));
 }
 get settled(){return this.steps>=Math.round(this.duration*60);}
 advance(age:number):void {
  const target=Math.min(Math.round(this.duration*60),Math.max(0,Math.floor(age*60+1e-6)));
  while(this.steps<target){this.step();this.steps++;}
 }
 private step():void {
  for(let i=0;i<this.positions.length;i++){
   const p=this.positions[i],old=this.previous[i],x=p.x,y=p.y,z=p.z;
   const damping=this.steps>65?.91:.98;
   p.set(x+(x-old.x)*damping,y+(y-old.y)*damping-9.81/3600,z+(z-old.z)*damping);old.set(x,y,z);
  }
  for(let iteration=0;iteration<10;iteration++){
   for(const link of this.links){
    const a=this.positions[link.a],b=this.positions[link.b],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz);
    if(d<1e-8)continue;
    const wa=1/this.points[link.a].mass,wb=1/this.points[link.b].mass,error=(d-link.length)/d/(wa+wb);
    a.x+=dx*error*wa;a.y+=dy*error*wa;a.z+=dz*error*wa;b.x-=dx*error*wb;b.y-=dy*error*wb;b.z-=dz*error*wb;
   }
   for(let i=0;i<this.positions.length;i++){
    const p=this.positions[i],old=this.previous[i],radius=this.points[i].radius;
    if(p.y<radius){p.y=radius;old.y=radius;old.x+=(p.x-old.x)*.45;old.z+=(p.z-old.z)*.45;}
   }
  }
 }
}
