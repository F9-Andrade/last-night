import * as THREE from 'three';
/** Fast extension, short contact and controlled recovery; presentation only. */
export function strikeEnvelope(remaining:number):number {
 if(remaining<=0)return 0;const p=1-Math.min(1,remaining),smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 return smooth(p/.24)*(1-smooth((p-.31)/.69));
}
const axis=new THREE.Vector3(),bend=new THREE.Vector3();
/** Fixed-length two-bone arm. The wrist is clamped instead of stretching the sleeve. */
export function solveArm(shoulder:THREE.Vector3,wrist:THREE.Vector3,elbow:THREE.Vector3,side:number,upper=.38,forearm=.425):void {
 axis.subVectors(wrist,shoulder);const distance=THREE.MathUtils.clamp(axis.length(),Math.abs(upper-forearm)+.001,upper+forearm-.015);axis.normalize();wrist.copy(shoulder).addScaledVector(axis,distance);
 bend.set(side*.8,-.65,0).addScaledVector(axis,-bend.dot(axis)).normalize();
 const along=(upper*upper-forearm*forearm+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,height);
}
