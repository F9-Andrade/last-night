import { BALANCE } from './config.ts';
/** Local presentation/input tuning; authoritative movement and combat stay in Simulation. */
export const FPS = {
  eyeHeight:1.72, crouchEye:1.08, bodyHeight:1.9, radius:.4,
  mouseSensitivity:.002, pitchLimit:Math.PI*.475, fov:88, adsFov:66, precisionFov:48,
  crouchSpeed:2.25, backpedal:.85, strafe:.95, adsSpeed:16, adsMove:.72,
  headBobAmount:.018, cameraShakeAmount:.018, recoilScale:.012,
  interactionRange:BALANCE.interaction.range, stepHeight:.28, stepSpeed:18,
  viewDistance:150, chunkDistance:135, jumpForce:0,
};
export function lookDirection(yaw:number,pitch:number){return {x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)};}
export function relativeMovement(yaw:number,right:number,forward:number){
  const n=Math.max(1,Math.hypot(right,forward));right/=n;forward/=n;
  const scale=forward<0?FPS.backpedal:right?FPS.strafe:1;
  return {x:(Math.sin(yaw)*forward-Math.cos(yaw)*right)*scale,z:(Math.cos(yaw)*forward+Math.sin(yaw)*right)*scale};
}
export class MouseLook {
  yaw=Math.PI; pitch=0; sensitivity=1;
  move(dx:number,dy:number):void {this.yaw-=dx*FPS.mouseSensitivity*this.sensitivity;this.yaw=Math.atan2(Math.sin(this.yaw),Math.cos(this.yaw));this.pitch=Math.max(-FPS.pitchLimit,Math.min(FPS.pitchLimit,this.pitch-dy*FPS.mouseSensitivity*this.sensitivity));}
  reset():void {this.yaw=Math.PI;this.pitch=0;}
}
