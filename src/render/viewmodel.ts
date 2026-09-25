import * as THREE from 'three';
import { createWeaponVisual } from './weapon-assets';
import { voxelMesh,voxelMaterial } from './voxel';
import { FPS } from '../game/first-person';
import { WEAPONS } from '../game/weapons';
import type { WeaponId } from '../game/weapons';
import type { Simulation,GameEvent } from '../game/simulation';

/** Presentation only; firing rays, aim, cooldowns and recoil applied to the camera remain in gameplay. */
const handling:Record<WeaponId,{returnSpeed:number;pitch:number;roll:number;back:number}>={
 pistol:{returnSpeed:18,pitch:.14,roll:.018,back:.055},
 revolver:{returnSpeed:13,pitch:.18,roll:.025,back:.064},
 smg:{returnSpeed:23,pitch:.10,roll:.013,back:.04},
 shotgun:{returnSpeed:10,pitch:.13,roll:.02,back:.075},
 rifle:{returnSpeed:19,pitch:.12,roll:.01,back:.05},
 marksman:{returnSpeed:12,pitch:.12,roll:.014,back:.062},
};
/** Dedicated local rig. World pickup and survivor weapons are independent instances. */
export class Viewmodel {
 readonly scene=new THREE.Scene(); private anchor=new THREE.Group();private rig=new THREE.Group();
 private right=new THREE.Group();private left=new THREE.Group();private gun=new THREE.Group();
 private cache=new Map<WeaponId,ReturnType<typeof createWeaponVisual>>();private current?:ReturnType<typeof createWeaponVisual>;private id?:WeaponId;
 private ambient=new THREE.HemisphereLight(0xc4cbd0,0x514c3e,.72);
 private sun=new THREE.DirectionalLight(0xffdfa9,3.1);
 // A single reusable light and voxel flash: no per-shot geometry, particle or light allocation.
 private flashLight=new THREE.PointLight(0xffc87d,0,1.65,2);
 private flash=voxelMesh({id:'fps:muzzle:v11',unit:.02,build(g){
  g.fill(-1,-1,-7,2,2,9,0xffe2a2).fill(-2,-2,-4,4,4,3,0xffbd61);
  g.fill(-4,-1,-3,8,2,1,0xffd68a).fill(-1,-4,-3,2,8,1,0xffd68a);
 }},new THREE.MeshBasicMaterial({color:new THREE.Color(4.5,2.5,.75),vertexColors:true,transparent:true,opacity:.9,depthWrite:false}));
 private flashTime=0;private recoil=0;ads=0; private cycle=0;private actionTime=0;private movement=0;private shotSide=1;
 private sunVector=new THREE.Vector3();
 constructor(){
  this.sun.position.set(-2,3,1);this.scene.add(this.anchor,this.ambient,this.sun,this.sun.target);
  this.anchor.add(this.rig);this.rig.add(this.gun,this.right,this.left);
  for(const [side,root] of [['right',this.right],['left',this.left]] as const){
   root.add(voxelMesh({id:`fps:arm:${side}:v11`,unit:.0125,build(g){
    // Squared folds and a stepped forearm keep the shape voxel, with broad calm cloth fields.
    g.fill(-6,-6,3,12,12,31,0x4b5745).fill(-5,-5,-1,10,10,8,0x596049);
    g.fill(-6,-6,5,12,2,26,0x354336).fill(-6,4,9,12,2,20,0x687059);
    g.fill(-6,-5,17,1,10,2,0x72765c).fill(-6,-3,18,1,5,2,0x474f3f);
    g.fill(-5,4,12,10,1,2,0x525d46).fill(-5,4,24,10,1,2,0x525d46);
    g.fill(-6,-6,-3,12,12,4,0x696b50).fill(-6,-6,-3,12,2,4,0x3c4637);
    // Fingerless work gloves, exposed knuckles and a narrow wrist. No smooth cylinders.
    g.fill(-5,-4,-13,10,9,11,0x927657).fill(-5,-4,-11,10,5,10,0x354235);
    g.fill(-5,1,-13,10,3,8,0x56604b).fill(-5,2,-13,10,2,3,0x756147);
    for(let i=0;i<4;i++)g.fill(-5+i*3,3,-13,2,2,5,0xb19572);
    g.fill(5,-2,-9,3,4,7,0x9b8060).fill(5,-2,-6,3,2,4,0x525943);
    g.set(-5,4,-7,0x6e5b46).fill(-4,-4,-11,2,1,5,0x26362d);
   }}));
  }
  this.flash.visible=false;this.flash.castShadow=false;this.flash.receiveShadow=false;
  this.gun.add(this.flash,this.flashLight);
 }
 /** Copy the world's light in world coordinates, so turning never rotates the sun with the gun. */
 syncLighting(sun:THREE.DirectionalLight,ambient:THREE.HemisphereLight,camera:THREE.PerspectiveCamera,interior=0,flashlight=false):void {
  const indoors=THREE.MathUtils.clamp(interior,0,1);
  this.sunVector.subVectors(sun.position,sun.target.position).normalize();
  this.sun.position.copy(camera.position).addScaledVector(this.sunVector,3);
  this.sun.target.position.copy(camera.position);this.sun.target.updateMatrixWorld();
  this.sun.color.copy(sun.color);this.sun.intensity=sun.intensity*(1-indoors*.83);
  this.ambient.color.copy(ambient.color);this.ambient.groundColor.copy(ambient.groundColor);
  this.ambient.intensity=ambient.intensity*(1-indoors*.12)+(flashlight?.25:0);
 }
 event(e:GameEvent):void {if(e.type==='shot'&&e.primary!==false){this.recoil=Math.min(2.5,this.recoil+WEAPONS[e.weapon??'pistol'].recoil*.32);this.flashTime=.048;this.actionTime=.38;this.shotSide*=-1;}}
 reset():void {this.ads=0;this.recoil=0;this.flashTime=0;this.actionTime=0;this.movement=0;this.flash.visible=false;this.flashLight.intensity=0;}
 update(sim:Simulation,camera:THREE.PerspectiveCamera,dt:number,time:number,visible:boolean):void {
  this.anchor.visible=visible;this.anchor.position.copy(camera.position);this.anchor.quaternion.copy(camera.quaternion);if(!visible){this.flashLight.intensity=0;this.flashTime=0;return;}
  const id=sim.equipped.type,weapon=sim.weapon,feel=handling[id];
  if(this.id!==id){this.current?.root.removeFromParent();let visual=this.cache.get(id);if(!visual){visual=createWeaponVisual(id,true);this.cache.set(id,visual);}this.current=visual;this.id=id;this.gun.add(visual.root);visual.root.rotation.y=Math.PI;visual.root.scale.setScalar(weapon.slot===0?.48:.65);}
  this.ads+=(Number(sim.player.ads&&!sim.reloadTimer&&!sim.player.running)-this.ads)*(1-Math.exp(-dt*FPS.adsSpeed));
  this.recoil*=Math.exp(-dt*feel.returnSpeed);this.actionTime=Math.max(0,this.actionTime-dt);this.cycle+=dt*(sim.player.running?13:8);
  this.movement+=(Number(sim.player.moving)-this.movement)*(1-Math.exp(-dt*9));
  const bob=this.movement*(sim.player.crouched?.002:sim.player.running?.017:.006)*(1-this.ads*.82);
  const breath=Math.sin(time*1.3)*.0014*(1-this.ads*.6);
  const reload=sim.reloadTimer?1-sim.reloadTimer/sim.reloadDuration:0,tilt=sim.reloadTimer?Math.sin(reload*Math.PI):0;
  const swapping=sim.switchTimer?Math.sin(Math.PI*sim.switchTimer/.32):0;
  this.rig.position.set(Math.sin(this.cycle)*bob+Math.sin(time*.71)*.0008,Math.abs(Math.cos(this.cycle))*bob+breath,0);
  this.rig.rotation.set(0,Math.sin(this.cycle)*bob*.4,Math.sin(this.cycle*.5)*bob*.6);
  this.gun.position.set(.23*(1-this.ads),THREE.MathUtils.lerp(-.25,id==='marksman'?-.154:weapon.slot===0?-.13:-.143,this.ads)-tilt*.14-swapping*.4-(sim.player.running?.16:0),weapon.slot===0?-.55:-.48);
  this.gun.position.z+=this.recoil*feel.back;this.gun.rotation.set(this.recoil*feel.pitch-tilt*.3-(sim.player.running?.5:0),tilt*.35,tilt*.28+(sim.player.running?-.25:0)+this.recoil*feel.roll*this.shotSide);
  const v=this.current!,style=weapon.reloadStyle;
  v.magazine.visible=style!=='shell'||!!sim.reloadTimer;
  v.magazine.position.set(style==='cylinder'?-tilt*.22:0,sim.reloadTimer?-Math.sin(Math.min(1,reload/.72)*Math.PI)*.5:0,0);
  v.magazine.rotation.z=style==='cylinder'?tilt*2:tilt*.15;
  const cycling=id==='shotgun'?Math.sin(Math.min(1,(.38-this.actionTime)/.38)*Math.PI):Math.max(0,this.actionTime-.25)/.13;
  const charging=sim.reloadTimer&&reload>.78?Math.sin((reload-.78)/.22*Math.PI):0;
  v.action.position.z=-Math.max(this.actionTime>0?cycling:0,charging)*(id==='shotgun'?.2:.08);
  this.right.position.set(this.gun.position.x+.005,this.gun.position.y-.13,this.gun.position.z+.04);this.right.rotation.set(-.18,0,.05+tilt*.15);
  this.left.position.set(THREE.MathUtils.lerp(.1,-.06,this.ads)-tilt*.18,this.gun.position.y-.12-tilt*.17,this.gun.position.z-(weapon.slot===0?.18:0)+tilt*.12);this.left.rotation.set(-.15,-.4,-.35);
  this.flash.visible=this.flashTime>0;this.flash.position.copy(v.muzzle).multiplyScalar(weapon.slot===0?.48:.65);this.flash.position.z*=-1;
  this.flash.scale.setScalar(weapon.flash*.75);this.flash.rotation.z=this.shotSide*.31;
  this.flashLight.position.copy(this.flash.position);this.flashLight.intensity=this.flash.visible?weapon.flash*.32:0;
  this.flashTime=Math.max(0,this.flashTime-dt);
 }
 render(renderer:THREE.WebGLRenderer,camera:THREE.PerspectiveCamera):void {if(!this.anchor.visible)return;const clear=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(this.scene,camera);renderer.autoClear=clear;}
 get material(){return voxelMaterial;}
}
