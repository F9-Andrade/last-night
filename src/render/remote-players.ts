import {FOODS,type FoodId} from '../game/nutrition';
import {createFoodVisual,type FoodVisual} from './food-assets';
import {consumptionMotion,type ConsumptionMotion} from './nutrition-motion';
import {strikeEnvelope} from './melee-motion';
import {MELEE} from '../game/crafting';
import {createMeleeVisual} from './melee-assets';
import type {MeleeId} from '../game/crafting';
import * as THREE from 'three';
import { Character } from './models';
import type { RemotePlayerState } from '../network/protocol';

interface Avatar {character:Character;tag:THREE.Sprite;name:string;crouch:number;shot:number;side:number;melee?:THREE.Mesh;meleeId?:MeleeId;provisions:Map<FoodId,FoodVisual>;food?:FoodVisual;foodId?:FoodId}
/** Rendered presence has no camera, input, health, collision or gameplay authority. */
export class RemotePlayers {
 private avatars=new Map<number,Avatar>();
 private foodMotion:ConsumptionMotion={show:0,open:0,lift:0,scoop:0,bite:0,settle:0};
 constructor(private scene:THREE.Scene){}
 get count(){return this.avatars.size;}
 private nameTag(name:string){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#13271fd9';ctx.fillRect(0,0,512,64);ctx.fillStyle='#ecf3d5';ctx.font='500 29px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,256,32,490);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false}));sprite.scale.set(2.7,.3375,1);sprite.position.y=2.35;return sprite;
 }
 private remove(actor:number){const avatar=this.avatars.get(actor);if(!avatar)return;avatar.tag.material.map?.dispose();avatar.tag.material.dispose();avatar.character.dispose();this.avatars.delete(actor);}
 shot(actor:number){const a=this.avatars.get(actor);if(a){a.shot=1;a.side*=-1;}}
 /** Existing authoritative build/repair events drive this local cosmetic gesture. */
 build(actor:number){const a=this.avatars.get(actor);if(a?.meleeId==='hammer')a.shot=1;}
 clear(){for(const actor of this.avatars.keys())this.remove(actor);}
 update(states:RemotePlayerState[],time:number,dt:number,camera:THREE.Camera){
  const present=new Set(states.map(s=>s.identity.actorNumber));for(const actor of this.avatars.keys())if(!present.has(actor))this.remove(actor);
  for(const {identity,snapshot:s,gameplay} of states){
   if(identity.isLocal||!s)continue;
   let avatar=this.avatars.get(identity.actorNumber);
   if(avatar&&avatar.name!==identity.displayName){this.remove(identity.actorNumber);avatar=undefined;}
   if(!avatar){const character=new Character(false,identity.actorNumber%4),tag=this.nameTag(identity.displayName);character.root.add(tag);this.scene.add(character.root);avatar={character,tag,name:identity.displayName,crouch:0,shot:0,side:1,provisions:new Map()};this.avatars.set(identity.actorNumber,avatar);}
   const c=avatar.character;c.root.position.set(s.x,s.y,s.z);c.root.rotation.y=s.yaw;
   if(gameplay)c.setWeapon(gameplay.weapon);avatar.shot=Math.max(0,avatar.shot-dt/(gameplay?.melee?MELEE[gameplay.melee].cooldown:1/7));
   c.animate(time,s.locomotion===1||s.locomotion===2||s.locomotion===3&&Math.hypot(s.vx,s.vz)>.1,s.locomotion===2,gameplay?.melee?0:avatar.shot*2);
   if(gameplay)c.reloadPose(gameplay.reload,gameplay.reloadDuration);
   avatar.crouch+=((s.locomotion===3?1:0)-avatar.crouch)*(1-Math.exp(-dt*16));c.body.position.y-=avatar.crouch*.52;c.body.rotation.x+=avatar.crouch*.2;c.leftLeg.rotation.x+=avatar.crouch*.45;c.rightLeg.rotation.x+=avatar.crouch*.45;c.head.rotation.x=-s.pitch;c.arms.rotation.x=-s.pitch*.65;
   const incapacitated=!!gameplay&&gameplay.life!=='alive';if(c.weapon)c.weapon.visible=!incapacitated&&!gameplay?.melee;
   if(avatar.meleeId!==gameplay?.melee){avatar.melee?.removeFromParent();avatar.melee=undefined;avatar.meleeId=gameplay?.melee;if(gameplay?.melee&&gameplay.melee!=='fists'){const hammer=gameplay.melee==='hammer';avatar.melee=createMeleeVisual(gameplay.melee);avatar.melee.rotation.x=gameplay.melee==='spear'?Math.PI/2:hammer?.12:.22;avatar.melee.scale.setScalar(1);c.rightArm.add(avatar.melee);}}if(avatar.melee)avatar.melee.visible=!incapacitated;
   c.rightArm.rotation.y=0;
   if(gameplay?.melee){
    const strike=strikeEnvelope(avatar.shot),fists=gameplay.melee==='fists';
    // Rotate around each shoulder, never around the group at the body's origin.
    c.arms.position.set(0,0,0);c.arms.rotation.set(0,0,0);
    for(const [side,arm] of [[1,c.rightArm],[-1,c.leftArm]] as const){const hit=(fists?side===avatar.side:side===1)?strike:0;arm.rotation.set(-s.pitch*.65-.22-hit*.5,side*(.12-hit*.18),side*(.12-hit*.1));}
    if(gameplay.melee==='hammer'){
     c.rightArm.rotation.set(-s.pitch*.45-.14-strike*.28,.04,.05+Math.sin(time*1.4)*.015);c.leftArm.rotation.set(.12,-.1,-.1);
     if(avatar.melee)avatar.melee.rotation.x=.25-strike*.65;
    }
   }
   c.updateHands(avatar.melee,gameplay?.melee);
   const consumption=gameplay?.consumption;
   if(consumption&&!incapacitated){
    if(avatar.foodId!==consumption.item){if(avatar.food)avatar.food.root.visible=false;let food=avatar.provisions.get(consumption.item);if(!food){food=createFoodVisual(consumption.item);avatar.provisions.set(consumption.item,food);c.rightArm.add(food.root);}avatar.food=food;avatar.foodId=consumption.item;}
    const food=avatar.food!,drink=FOODS[consumption.item].kind==='drink',m=consumptionMotion(consumption.elapsed/consumption.duration,drink,food.kind==='packet',this.foodMotion);
    food.root.visible=true;food.root.position.set(0,-.12,.47);food.root.rotation.set(m.lift*.55,Math.PI,0);
    c.arms.rotation.set(0,0,0);c.arms.position.set(0,0,0);c.rightArm.rotation.set(-.14-m.lift*.8,.27,-.14);c.leftArm.rotation.set(-.25-m.bite*.65,-.7,.12);
    c.head.rotation.x=.035+Math.sin(time*6)*m.bite*.016;
    if(food.kind==='can'){food.lid.rotation.x=consumption.item==='soda'?0:-m.open*2.35;if(food.tab)food.tab.rotation.x=-m.open*1.15;}else food.lid.visible=m.open<.95;
    if(c.weapon)c.weapon.visible=false;if(avatar.melee)avatar.melee.visible=false;
   }else if(avatar.food)avatar.food.root.visible=false;
   if(incapacitated){c.body.rotation.z=Math.PI/2;c.body.position.y=.64;c.body.position.x=.85;c.head.rotation.x=0;}else c.body.position.x=0;
   avatar.tag.position.y=incapacitated?.95:2.35-avatar.crouch*.52;const distance=c.root.position.distanceTo(camera.position);avatar.tag.visible=distance<22;avatar.tag.material.opacity=Math.min(1,Math.max(0,(22-distance)/6));
  }
 }
}
