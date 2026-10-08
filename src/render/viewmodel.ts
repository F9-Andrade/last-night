import {FOODS,type FoodId} from '../game/nutrition';
import {createFoodVisual,createEatingSpoon,type FoodVisual} from './food-assets';
import {consumptionMotion,smoothStage,type ConsumptionMotion} from './nutrition-motion';
import {solveArm,strikeEnvelope} from './melee-motion';
import {createMeleeVisual,MELEE_VISUALS} from './melee-assets';
import {createSurvivorHand,createSleeve,HAND_GRIP,type SurvivorHand} from './hand-assets';
import type {MeleeId} from '../game/crafting';
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
 private shoulders=[new THREE.Vector3(.26,-.43,-.055),new THREE.Vector3(-.26,-.43,-.055)];
 private upperArms:THREE.Mesh[]=[];private elbow=new THREE.Vector3();private armDirection=new THREE.Vector3();private armAxis=new THREE.Vector3(0,0,1);
 private meleeMeshes=new Map<MeleeId,THREE.Mesh>();private heldMelee?:MeleeId;private swing=0;
 private flashTime=0;private recoil=0;ads=0; private cycle=0;private actionTime=0;private movement=0;private shotSide=1;
 private sunVector=new THREE.Vector3();
 private gloves:SurvivorHand[]=[];private contact=new THREE.Vector3();private contactOther=new THREE.Vector3();private handOffset=new THREE.Vector3();private handRotation=new THREE.Quaternion();private gripRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-Math.PI/2);private poseRotation=new THREE.Euler();private flashStrength=1;private cylinderIndex=0;
 private provisions=new Map<FoodId,FoodVisual>();private food?:FoodVisual;private foodId?:FoodId;private spoon=createEatingSpoon();
 private consumptionPose:ConsumptionMotion={show:0,open:0,lift:0,scoop:0,bite:0,settle:0};
 private consumeBlend=0;private consumeProgress=0;private sprint=0;private hurt=0;private hurtSide=1;
 private hands:THREE.Group[]=[];
 constructor(){
  this.sun.position.set(-2,3,1);this.scene.add(this.anchor,this.ambient,this.sun,this.sun.target);
  this.anchor.add(this.rig);this.rig.add(this.gun,this.right,this.left);
  for(const [i,root] of [this.right,this.left].entries()){
   const glove=createSurvivorHand(i===0?1:-1);this.gloves.push(glove);root.add(createSleeve(),glove.root);
   const upper=createSleeve(true);this.upperArms.push(upper);this.rig.add(upper);
  }
  this.flash.visible=false;this.flash.castShadow=false;this.flash.receiveShadow=false;
  this.gun.add(this.flash,this.flashLight);this.spoon.visible=false;this.rig.add(this.spoon);this.hands.push(this.right,this.left);
 }
 /** Mesh all eight provisions under the loading screen, reusing materials and geometry. */
 prepareProvisions():void {
  if(this.provisions.size)return;
  for(const id of Object.keys(FOODS) as FoodId[]){const food=createFoodVisual(id);food.root.visible=false;this.rig.add(food.root);this.provisions.set(id,food);}
 }
 /** Upload each provision once while the loader renders into its offscreen target. */
 warmProvisions(renderer:THREE.WebGLRenderer,camera:THREE.PerspectiveCamera):void {
  this.prepareProvisions();
  const saved=[...this.provisions.values()].map(food=>({food,visible:food.root.visible,position:food.root.position.clone()}));
  const spoonVisible=this.spoon.visible;this.spoon.visible=true;
  try {for(const {food} of saved){food.root.visible=true;food.root.position.set(0,-.2,-.6);}this.render(renderer,camera);}
  finally {for(const {food,visible,position} of saved){food.root.visible=visible;food.root.position.copy(position);}this.spoon.visible=spoonVisible;}
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
 event(e:GameEvent):void {if(e.type==='hurt'){this.hurt=1;this.hurtSide*=-1;}if(e.type==='melee'){this.swing=1;this.shotSide*=-1;}if((e.type==='build'||e.type==='repair')&&this.heldMelee==='hammer')this.swing=1;if(e.type==='shot'&&e.primary!==false){this.recoil=Math.min(2.5,this.recoil+WEAPONS[e.weapon??'pistol'].recoil*.32);this.flashTime=.048;this.actionTime=.38;this.shotSide*=-1;this.flashStrength=e.suppressed?.25:1;if(e.weapon==='revolver')this.cylinderIndex++;}}
 reset():void {this.consumeBlend=0;this.sprint=0;this.hurt=0;this.foodId=undefined;if(this.food)this.food.root.visible=false;this.food=undefined;this.spoon.visible=false;this.heldMelee=undefined;this.swing=0;this.ads=0;this.recoil=0;this.flashTime=0;this.actionTime=0;this.movement=0;this.flash.visible=false;this.flashLight.intensity=0;}
 update(sim:Simulation,camera:THREE.PerspectiveCamera,dt:number,time:number,visible:boolean):void {
  const held=sim.meleeMode?sim.meleeId:undefined;if(this.heldMelee!==held){this.swing=0;this.heldMelee=held;}
  this.anchor.visible=visible;this.anchor.position.copy(camera.position);this.anchor.quaternion.copy(camera.quaternion);if(!visible){this.flashLight.intensity=0;this.flashTime=0;return;}
  const id=sim.equipped.type,weapon=sim.weapon,feel=handling[id],consuming=!!sim.consumption;
  this.sprint+=(Number(sim.player.running&&!consuming)-this.sprint)*(1-Math.exp(-dt*9));this.hurt=Math.max(0,this.hurt-dt*2.7);
  if(this.id!==id){this.current?.root.removeFromParent();let visual=this.cache.get(id);if(!visual){visual=createWeaponVisual(id,true);this.cache.set(id,visual);}this.current=visual;this.id=id;this.gun.add(visual.root);visual.root.rotation.y=Math.PI;visual.root.scale.setScalar(visual.scale);}
  this.gun.visible=!sim.meleeMode;this.swing=Math.max(0,this.swing-dt/Math.max(.3,weapon.cooldown));
  for(const [key,m] of this.meleeMeshes)m.visible=sim.meleeMode&&key===sim.meleeId;
  if(sim.meleeMode&&sim.meleeId!=='fists'&&!this.meleeMeshes.has(sim.meleeId)){const tool=createMeleeVisual(sim.meleeId);this.meleeMeshes.set(sim.meleeId,tool);this.rig.add(tool);}
  this.ads+=(Number(sim.player.ads&&!sim.reloadTimer&&!sim.player.running&&!consuming)-this.ads)*(1-Math.exp(-dt*FPS.adsSpeed));
  this.recoil*=Math.exp(-dt*feel.returnSpeed);this.actionTime=Math.max(0,this.actionTime-dt);this.cycle+=dt*(8+this.sprint*5);
  this.movement+=(Number(sim.player.moving)-this.movement)*(1-Math.exp(-dt*9));
  const bob=this.movement*(sim.player.crouched?.002:.006+this.sprint*.011)*(1-this.ads*.82);
  const breath=Math.sin(time*1.3)*.0014*(1-this.ads*.6);
  const reload=sim.reloadTimer?1-sim.reloadTimer/sim.reloadDuration:0,tilt=sim.reloadTimer?Math.sin(reload*Math.PI):0;
  const swapping=sim.switchTimer?Math.sin(Math.PI*sim.switchTimer/.32):0;
  this.rig.position.set(Math.sin(this.cycle)*bob+Math.sin(time*.71)*.0008,Math.abs(Math.cos(this.cycle))*bob+breath,0);
  const flinch=Math.sin((1-this.hurt)*Math.PI)*this.hurt;
  this.rig.position.y-=flinch*.036;this.rig.position.z+=flinch*.028;
  this.rig.rotation.set(-flinch*.055,Math.sin(this.cycle)*bob*.4,Math.sin(this.cycle*.5)*bob*.6+flinch*.065*this.hurtSide);
  const v=this.current!,long=weapon.slot===0;
  this.gun.position.set(.21*(1-this.ads),THREE.MathUtils.lerp(long?-.205:-.235,-v.aimHeight*v.scale,this.ads)-tilt*.1-swapping*.4-this.sprint*.1,long?-.46:-.43);
  this.gun.position.z+=this.recoil*feel.back;this.gun.rotation.set(this.recoil*feel.pitch-tilt*.25-this.sprint*.32,tilt*.25,tilt*.24-this.sprint*.18+this.recoil*feel.roll*this.shotSide);
  const style=weapon.reloadStyle;
  v.magazine.visible=style!=='shell'||!!sim.reloadTimer;
  v.magazine.position.copy(v.magazineHome);
  if(sim.reloadTimer){v.magazine.position.y-=Math.sin(Math.min(1,reload/.72)*Math.PI)*.44;if(style==='cylinder')v.magazine.position.x-=tilt*.23;}
  v.magazine.rotation.set(0,0,style==='cylinder'?this.cylinderIndex*Math.PI/3+tilt*.3:tilt*.1);
  const cycling=id==='shotgun'?Math.sin(Math.min(1,(.38-this.actionTime)/.38)*Math.PI):Math.max(0,this.actionTime-.25)/.13;
  const charging=sim.reloadTimer&&reload>.78?Math.sin((reload-.78)/.22*Math.PI):0;
  const action=Math.max(this.actionTime>0?cycling:0,charging);
  v.action.position.copy(v.actionHome);v.action.rotation.set(0,0,0);
  if(v.actionKind==='hammer')v.action.rotation.x=-action*.55;else v.action.position.z-=action*(v.actionKind==='pump'?.19:.075);
  this.gun.updateMatrix();v.root.updateMatrix();
  // Anatomical hands are independent of the forearm direction. Each contact point
  // is transformed with the actual weapon, including recoil, ADS and reload tilt.
  this.weaponPoint(v.grip,this.contact);this.handRotation.copy(this.gun.quaternion).multiply(this.gripRotation);this.placeHand(0,this.contact,this.handRotation,.87,this.actionTime>0?.5:0);
  this.contact.copy(v.supportGrip);if(v.actionKind==='pump')this.contact.z+=v.action.position.z-v.actionHome.z;this.weaponPoint(this.contact,this.contact);
  if(sim.reloadTimer){this.contactOther.copy(v.magazine.position);this.contactOther.y-=style==='shell'?.05:.11;this.weaponPoint(this.contactOther,this.contactOther);this.contact.lerp(this.contactOther,Math.min(1,tilt*3));}
  this.poseRotation.set(long?-.2:-.05,long?-.25:0,long?.18:Math.PI/2);
  this.handRotation.setFromEuler(this.poseRotation).premultiply(this.gun.quaternion);this.placeHand(1,this.contact,this.handRotation,long?.5:.9);
  this.spoon.visible=false;
  if(sim.meleeMode){
   const strike=strikeEnvelope(this.swing),fists=sim.meleeId==='fists',hammer=sim.meleeId==='hammer',spear=sim.meleeId==='spear',knife=sim.meleeId==='knife',axe=sim.meleeId==='axe';
   const windup=this.swing>.75?Math.sin((1-this.swing)/.25*Math.PI):0;
   if(fists){
    for(let i=0;i<2;i++){const side=i===0?1:-1,hit=side===this.shotSide?strike:0;
     this.contact.set(side*(.22-hit*.115),-.255+hit*.05-this.sprint*.07,-.36-hit*.27+this.sprint*.04);
     this.poseRotation.set(-.08-hit*.1,side*(.16-hit*.12),-side*(.28+hit*.75));this.handRotation.setFromEuler(this.poseRotation);this.placeHand(i,this.contact,this.handRotation,1);
    }
   }else{
    const tool=this.meleeMeshes.get(sim.meleeId)!;
    tool.position.set(.27-strike*(spear?.09:knife?.12:.31),-.28+windup*.045+strike*(hammer?-.035:.075)-this.sprint*.075,-.53-strike*(spear?.25:knife?.2:.045)+this.sprint*.07);
    if(spear)tool.position.set(.14-strike*.08,-.3-this.sprint*.06,-.31-strike*.12);
    tool.rotation.set(spear?-1.1-strike*.1:knife?-.3-strike*.8:hammer?-.18+windup*.28-strike*.85:-.22+windup*.22-strike*1.15,spear?-.18:axe?.55:-.38,spear?.32:hammer?-.12:knife?.23:-.2+strike*.55);
    this.handRotation.copy(tool.quaternion).multiply(this.gripRotation);
    // Turn the axe around its haft, not the wrist: its +X cutting edge must
    // lead forward through the whole stroke instead of facing the survivor.
    if(axe)tool.rotateY(Math.PI/2);
    tool.scale.setScalar(knife?.74:sim.meleeId==='machete'?.8:sim.meleeId==='axe'?.8:spear?.78:.9);tool.updateMatrix();
    this.contact.set(...MELEE_VISUALS[sim.meleeId].grip).applyMatrix4(tool.matrix);this.placeHand(0,this.contact,this.handRotation,.86);
    const support=MELEE_VISUALS[sim.meleeId].supportGrip;
    if(support){this.contact.set(...support).applyMatrix4(tool.matrix);this.poseRotation.set(0,0,Math.PI/2);this.handRotation.setFromEuler(this.poseRotation).premultiply(tool.quaternion);this.placeHand(1,this.contact,this.handRotation,.85);}
    else{this.contact.set(-.23,-.29-this.sprint*.07,-.38+this.sprint*.05);this.poseRotation.set(.05,-.22,.38);this.handRotation.setFromEuler(this.poseRotation);this.placeHand(1,this.contact,this.handRotation,.88);}
   }
   this.ads=0;this.flashTime=0;
  }
  this.animateConsumption(sim,dt);
  this.flash.visible=this.flashTime>0&&!consuming;this.flash.position.copy(v.muzzle).applyMatrix4(v.root.matrix);
  this.flash.scale.set(.6*weapon.flash,.6*weapon.flash,.75*weapon.flash).multiplyScalar(this.flashStrength);this.flash.rotation.z=this.shotSide*.31;
  this.flashLight.position.copy(this.flash.position);this.flashLight.intensity=this.flash.visible?weapon.flash*.55*this.flashStrength:0;
  this.flashTime=Math.max(0,this.flashTime-dt);
 }
 private weaponPoint(point:THREE.Vector3,out:THREE.Vector3):THREE.Vector3 {return out.copy(point).applyMatrix4(this.current!.root.matrix).applyMatrix4(this.gun.matrix);}
 private placeHand(index:number,contact:THREE.Vector3,orientation:THREE.Quaternion,curl:number,trigger=0):void {
  const wrist=this.hands[index];this.handOffset.copy(HAND_GRIP).applyQuaternion(orientation);wrist.position.copy(contact).sub(this.handOffset);
  this.anchorArm(index);this.gloves[index].root.quaternion.copy(wrist.quaternion).invert().multiply(orientation);this.gloves[index].pose(curl,trigger);
 }
 getMuzzleWorldPosition(out:THREE.Vector3):boolean {
  if(!this.current||!this.anchor.visible||!this.gun.visible)return false;
  this.current.root.updateWorldMatrix(true,false);out.copy(this.current.muzzle).applyMatrix4(this.current.root.matrixWorld);return true;
 }
 getEjectionWorldPosition(out:THREE.Vector3):boolean {
  if(!this.current||!this.anchor.visible||!this.gun.visible)return false;
  this.current.root.updateWorldMatrix(true,false);out.copy(this.current.ejection).applyMatrix4(this.current.root.matrixWorld);return true;
 }
 private anchorArm(index:number):void {
  const hand=this.hands[index],side=index===0?1:-1;
  solveArm(this.shoulders[index],hand.position,this.elbow,side);
  this.armDirection.subVectors(this.elbow,hand.position).normalize();hand.quaternion.setFromUnitVectors(this.armAxis,this.armDirection);
  const sleeve=this.upperArms[index];sleeve.visible=true;sleeve.position.copy(this.elbow);this.armDirection.subVectors(this.shoulders[index],this.elbow).normalize();sleeve.quaternion.setFromUnitVectors(this.armAxis,this.armDirection);
 }
 private animateConsumption(sim:Simulation,dt:number):void {
  const action=sim.consumption;
  this.consumeBlend+=(Number(!!action)-this.consumeBlend)*(1-Math.exp(-dt*(action?17:22)));
  if(action){
   if(this.foodId!==action.item){this.prepareProvisions();if(this.food)this.food.root.visible=false;this.foodId=action.item;this.food=this.provisions.get(action.item);}
   this.consumeProgress=Math.min(1,action.elapsed/action.duration);
  }
  if(!this.food||this.consumeBlend<.005){if(this.food)this.food.root.visible=false;return;}
  const food=this.food,drink=FOODS[this.foodId!].kind==='drink',packet=food.kind==='packet';
  const m=consumptionMotion(this.consumeProgress,drink,packet,this.consumptionPose),blend=this.consumeBlend;
  const raise=m.show*blend,opening=smoothStage(this.consumeProgress,.12,.21)*(1-smoothStage(this.consumeProgress,.29,.39));
  // Keep the whole tilted bottle in front of the near plane, including its neck.
  // Lifting a 28 cm bottle towards the camera by its base otherwise magnifies it into the HUD.
  food.root.visible=true;food.root.position.set(-.13+m.lift*.07,-.32-(1-raise)*.34+m.lift*(drink?.12:.16),(drink?-.53:-.43)+m.lift*(drink?.09:.12));
  food.root.rotation.set(drink?m.lift*1.05:packet?m.lift*.35:0,.17,-.12+m.lift*.17);
  // Lid folds away from the mouth. Caps are unscrewed then held clear of the lip.
  if(food.kind==='can'){food.lid.rotation.x=this.foodId==='soda'?0:-m.open*2.35;if(food.tab)food.tab.rotation.x=this.foodId==='soda'?-m.open*1.15:-Math.sin(m.open*Math.PI)*1.2;}
  else if(food.kind==='bottle'){food.lid.rotation.y=m.open*Math.PI*3;food.lid.position.y=.255+m.open*.055;food.lid.visible=m.open<.95;}
  else {food.lid.rotation.z=m.open*.6;food.lid.position.x=m.open*.1;food.lid.visible=m.open<.95;food.content.visible=m.open>.4;}
  this.gun.position.y-=raise*.65;
  for(const mesh of this.meleeMeshes.values())mesh.visible=false;
  this.left.position.lerp(food.root.position,blend);this.left.position.x-=blend*.04;this.left.position.y-=blend*.018;this.left.position.z+=blend*.075;
  const spooning=!drink&&!packet&&this.consumeProgress>.33&&this.consumeProgress<.85;
  this.right.position.x=THREE.MathUtils.lerp(this.right.position.x,.23-opening*.27-m.scoop*.28-m.bite*.11,blend);
  this.right.position.y=THREE.MathUtils.lerp(this.right.position.y,-.33-(1-raise)*.34+opening*.18+m.scoop*.13+m.bite*.035,blend);
  this.right.position.z=THREE.MathUtils.lerp(this.right.position.z,-.38-opening*.02-m.scoop*.005+m.bite*.035,blend);
  this.anchorArm(0);this.anchorArm(1);for(let i=0;i<2;i++){this.gloves[i].root.quaternion.identity();this.gloves[i].pose(i===0?.35:.65);}
  this.spoon.visible=spooning&&blend>.25;this.spoon.position.copy(this.right.position);this.spoon.position.z-=.04;this.spoon.rotation.set(m.bite*1.8,0,-.25+m.scoop*.3);
  this.flashTime=0;
 }
 render(renderer:THREE.WebGLRenderer,camera:THREE.PerspectiveCamera):void {if(!this.anchor.visible)return;const clear=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(this.scene,camera);renderer.autoClear=clear;}
 get material(){return voxelMaterial;}
}
