import * as THREE from 'three';
import type {EconomyWorld,Merchant,MerchantKind} from '../game/economy.ts';
import type {Vec2} from '../game/world.ts';
import {VisibleGroup} from './static-chunk.ts';
import {voxelMesh,type VoxelGrid,type VoxelRecipe} from './voxel.ts';

const looks:Record<MerchantKind,{coat:number;trim:number;cloth:number;skin:number;hair:number;label:string}>={
 supplies:{coat:0x746144,trim:0xb19662,cloth:0x4d6353,skin:0xb38a65,hair:0x3c322b,label:'PROVISÕES'},
 medic:{coat:0xb2ad94,trim:0x637c72,cloth:0x596c61,skin:0xc19b7c,hair:0x4b3c30,label:'POSTO DE CAMPO'},
 gunsmith:{coat:0x414a46,trim:0x957652,cloth:0x764f3d,skin:0xa67d5d,hair:0x3b352e,label:'ARMAMENTOS'},
 salvage:{coat:0x9b814c,trim:0xc0a76b,cloth:0x62694e,skin:0xbb9173,hair:0x777367,label:'MATERIAIS'},
};
const wood=0x766044,grain=0x968064,metal=0x505955,steel=0x879087,dark=0x303a35;

function crate(g:VoxelGrid,x:number,y:number,z:number,w=8,h=7,d=7):void {
 g.fill(x,y,z,w,h,d,wood);
 for(const row of [1,h-2])g.fill(x,y+row,z,w,1,1,grain).fill(x,y+row,z+d-1,w,1,1,grain);
 for(const side of [1,w-2])g.fill(x+side,y,z,1,h,d,metal);
 g.fill(x+2,y+h-1,z+2,Math.max(1,w-4),1,Math.max(1,d-4),grain);
}
function can(g:VoxelGrid,x:number,y:number,z:number,color:number):void {
 g.fill(x,y,z,3,4,3,steel).fill(x,y+1,z,3,2,3,color).fill(x+1,y+4,z+1,1,1,1,dark);
}

/** One shared greedy mesh per camp style. All scenery stays behind/alongside the
 * trader; the front approach remains open and requires no decorative collision. */
export function merchantCampRecipe(kind:MerchantKind):VoxelRecipe {
 const style=looks[kind];
 return {id:`merchant:camp:${kind}:1`,unit:.1,build(g){
  // Repaired tarpaulin, stepped ridge, sewn edges and four narrow support poles.
  for(let x=-20;x<20;x++){
   const y=27+Math.floor((20-Math.abs(x))/8);
   g.fill(x,y,-27,1,1,34,style.cloth);
   if((x+20)%9===0)g.fill(x,y+1,-27,1,1,34,style.trim);
  }
  g.fill(-20,26,-27,40,2,1,style.cloth).fill(-20,26,6,40,2,1,style.cloth);
  for(const x of [-19,18])for(const z of [-25,4]){
   g.fill(x,0,z,1,28,1,metal).fill(x-1,0,z-1,3,1,3,dark);
   g.fill(x-1,23,z-1,3,1,3,grain);
  }
  g.fill(-19,25,-25,38,1,1,metal).fill(-19,25,4,38,1,1,metal);
  // Work surface sits behind the NPC, away from the interaction approach.
  g.fill(-13,9,-19,26,2,9,wood).fill(-13,10,-10,26,1,1,grain);
  for(const x of [-12,10])for(const z of [-18,-12])g.fill(x,0,z,2,9,2,metal);
  g.fill(-11,3,-18,22,1,7,wood);
  for(const x of [-10,2])crate(g,x,0,-26,8,7,6);
  // A battered hanging board is textured with a restrained, reusable nameplate.
  g.fill(-13,22,5,26,4,1,dark).fill(-14,22,5,1,4,1,grain).fill(13,22,5,1,4,1,grain);
  g.fill(-12,26,5,1,2,1,metal).fill(11,26,5,1,2,1,metal);
  if(kind==='supplies'){
   for(const x of [-11,-7,-3])can(g,x,11,-17,x===-7?0x7b4d3b:0x8d8b5c);
   for(const x of [3,7])g.fill(x,11,-17,3,5,3,0x5b7976).fill(x+1,16,-16,1,2,1,0x8e9e85);
   crate(g,20,0,-22,8,8,8);crate(g,21,8,-20,6,5,6);
   g.fill(-26,0,-21,6,11,7,0x536753).fill(-26,4,-21,6,1,7,grain).fill(-24,11,-20,2,1,2,metal);
  }else if(kind==='medic'){
   g.fill(-25,0,-23,8,9,7,0x8d998d).fill(-25,4,-23,8,1,7,metal);
   g.fill(-23,3,-16,4,2,1,0x7d483e).fill(-22,2,-16,2,4,1,0x7d483e);
   g.fill(-11,11,-18,11,2,6,0xc9c4ab).fill(-9,13,-17,7,1,4,0x989e8d);
   for(const x of [4,8])g.fill(x,11,-16,2,4,2,0x668981).fill(x,15,-16,2,1,2,0xc6c5ac);
   // Folded field stretcher and two cloth rolls, kept alongside the station.
   g.fill(21,4,-24,6,2,19,0x7c8d77).fill(20,3,-26,1,2,23,metal).fill(27,3,-26,1,2,23,metal);
   g.fill(21,6,-24,6,2,4,0xc0bba2);
  }else if(kind==='gunsmith'){
   g.fill(-12,11,-22,24,10,1,0x4a5247);
   for(const x of [-9,-1,7]){
    g.fill(x,14,-21,2,6,2,metal).fill(x,12,-21,2,3,3,0x755239).fill(x,20,-21,1,3,1,steel);
   }
   g.fill(5,11,-16,5,3,4,metal).fill(3,13,-15,9,2,2,steel).fill(6,14,-14,1,1,1,dark);
   for(const x of [-11,-7,-3])g.fill(x,11,-17,2,2,4,0xa9905b).fill(x,13,-17,2,1,1,0x77634b);
   crate(g,20,0,-23,8,7,13);g.fill(20,7,-22,8,1,2,0xb89959);
   g.fill(-25,0,-22,5,12,6,0x6b4b3c).fill(-26,3,-23,7,1,8,metal).fill(-26,8,-23,7,1,8,metal);
  }else{
   for(const x of [-11,-4,3])g.fill(x,11,-18,5,2,7,x===-4?metal:wood).fill(x,13,-17,4,1,5,grain);
   for(let i=0;i<3;i++)g.fill(20+i,1+i*2,-24,7,2,16,wood).fill(20+i,2+i*2,-24,7,1,1,grain);
   for(const x of [-27,-23])g.fill(x,0,-25,3,13,3,metal).fill(x,12,-25,3,1,3,0x846345);
   crate(g,-28,0,-15,9,7,8);g.fill(-27,7,-14,7,1,6,0x9c936f);
   g.fill(20,0,-6,6,4,7,dark).carve(22,0,-4,2,4,3);
  }
 }};
}

type MerchantPart='body'|'legs'|'head'|'left-arm'|'right-arm';
/** Original role-specific voxel apparel, designed for the same scale as survivors. */
export function merchantBodyRecipe(kind:MerchantKind,part:MerchantPart):VoxelRecipe {
 const p=looks[kind];
 return {id:`merchant:${kind}:${part}:1`,unit:.04,build(g){
  if(part==='legs'){
   for(const x of [-7,2]){
    g.fill(x,3,-3,5,18,7,kind==='medic'?0x4d655e:0x4f5143).fill(x,10,4,5,4,1,0x68705c);
    g.fill(x-1,1,-4,7,4,10,dark).fill(x-1,0,-4,7,1,11,0x252c28);
    g.fill(x,3,5,5,1,1,0x89866a).fill(x+1,4,4,3,1,1,grain);
   }
   return;
  }
  if(part==='body'){
   g.fill(-8,20,-4,16,15,9,p.coat).fill(-9,29,-4,18,7,8,p.coat);
   g.fill(-5,35,-3,10,2,7,p.trim).fill(-3,37,-2,6,2,5,p.skin);
   g.fill(-8,20,-4,16,2,9,0x4b4334).fill(-1,20,5,3,2,1,steel);
   g.fill(-1,23,5,1,12,1,p.trim);
   for(const x of [-6,3])g.fill(x,28,5,4,4,1,p.trim).fill(x,31,6,4,1,1,dark);
   for(const y of [25,29,33])g.set(0,y,6,steel);
   g.fill(-6,22,-5,12,1,1,p.trim).fill(-8,32,-4,2,2,1,p.trim);
   if(kind==='medic'){
    g.fill(-8,18,-4,16,7,9,p.coat).fill(-1,18,0,2,6,5,0x66756a);
    g.fill(-6,28,6,4,1,1,0x864f43).fill(-5,27,6,2,3,1,0x864f43);
    g.fill(4,30,6,1,4,1,steel).fill(6,30,6,1,3,1,0x698583);
   }else if(kind==='gunsmith'){
    g.fill(-6,19,5,12,15,2,0x73543f).fill(-5,33,5,10,2,2,0x96714f);
    g.fill(-5,23,7,10,4,1,0x927051).fill(-2,24,8,1,5,1,metal).fill(2,24,8,1,4,1,grain);
    for(const x of [-6,5])g.fill(x,31,4,1,5,2,0x3e3930);
   }else if(kind==='salvage'){
    g.fill(-8,27,-5,16,2,1,p.trim).fill(-7,25,5,14,2,1,p.trim);
    g.fill(-8,19,5,5,5,3,0x614b36).fill(4,19,5,4,5,3,0x614b36);
    g.fill(-6,22,-8,12,10,4,0x56614e).fill(-4,30,-9,8,3,1,grain);
   }else{
    g.fill(-5,33,5,10,4,2,0x977c53).fill(-3,30,6,4,5,2,0x84613e);
    g.fill(6,23,5,3,11,1,0x4d4d39).fill(7,19,5,4,6,3,0x6e533a);
    for(const y of [25,29])g.fill(6,y,6,3,2,1,0x9c9d7c);
   }
   return;
  }
  if(part==='head'){
   g.fill(-5,0,-4,10,11,9,p.skin).fill(-6,3,-2,12,4,4,p.skin);
   g.fill(-4,1,5,8,6,1,p.skin).fill(-1,3,6,2,3,1,0xa77d5c);
   g.fill(-5,8,-4,10,4,8,p.hair).fill(-5,3,-4,10,5,1,p.hair);
   for(const x of [-3,2])g.set(x,6,6,0x30372f).fill(x-1,8,5,3,1,1,p.hair);
   g.fill(-2,2,6,4,1,1,0x765547);
   if(kind==='medic'){
    g.fill(-5,10,-4,10,2,9,0xbab8a0).fill(-6,9,-4,12,1,9,p.trim);
    g.fill(-1,10,5,2,2,1,0x864f43).fill(-2,10,5,4,1,1,0x864f43);
    g.fill(-4,1,5,8,3,1,0x8faaa0);
   }else if(kind==='gunsmith'){
    g.fill(-5,9,-4,10,1,10,dark);
    for(const x of [-4,1])g.fill(x,9,5,4,3,2,steel).fill(x+1,10,7,2,1,1,0x31423f);
    g.fill(-4,0,4,8,3,2,p.hair).fill(-5,3,4,2,3,1,p.hair).fill(3,3,4,2,3,1,p.hair);
   }else{
    g.fill(-5,10,-4,10,3,9,kind==='salvage'?0x666747:0x4b5b48);
    g.fill(-6,10,3,12,1,6,kind==='salvage'?p.trim:0x728069);
    if(kind==='salvage')g.fill(-4,0,5,8,2,1,p.hair).fill(-2,1,6,4,1,1,0x8b8672);
   }
   return;
  }
  g.fill(-3,-7,-3,6,9,6,p.coat).fill(-3,-13,-2,6,7,7,p.coat);
  g.fill(-3,-12,4,6,2,1,p.trim).fill(-2,-16,1,5,4,5,kind==='medic'?0x8ba49a:p.skin);
  g.fill(-3,-14,4,2,3,2,kind==='medic'?0x8ba49a:p.skin);
  if(kind==='medic'&&part==='left-arm')g.fill(-4,-5,-2,1,5,4,p.trim).fill(-5,-4,-1,1,3,2,0x864f43);
  if(kind==='gunsmith')g.fill(-3,-15,0,6,3,6,0x6b5e43).fill(-3,-14,5,6,1,1,grain);
  if(kind==='salvage')g.fill(-3,-8,-3,6,2,6,p.trim);
 }};
}

interface CampVisual {root:VisibleGroup;body:THREE.Group;head:THREE.Mesh;left:THREE.Mesh;right:THREE.Mesh;kind:MerchantKind;phase:number;seen:number}
const labelGeometry=new THREE.PlaneGeometry(2.5,.31);

/** Six bounded posts use cached voxel meshes and shared finishes. No new lights,
 * network entities, collision rules or per-frame texture/geometry allocation. */
export class MerchantsView {
 readonly root=new VisibleGroup();
 private camps=new Map<string,CampVisual>();
 private labels=new Map<MerchantKind,THREE.MeshStandardMaterial>();
 private tick=0;private previousTime=0;
 constructor(){this.root.name='merchant-posts';}
 private label(kind:MerchantKind):THREE.Mesh|undefined {
  let paint=this.labels.get(kind);
  if(!paint){
   if(typeof document==='undefined')return;
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;
   const context=canvas.getContext('2d');if(!context)return;
   context.fillStyle='#303a35';context.fillRect(0,0,512,64);
   context.fillStyle='#d5c6a1';context.textAlign='center';context.textBaseline='middle';context.font='700 32px "Field Sans",sans-serif';context.fillText(looks[kind].label,256,33,476);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   paint=new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0});this.labels.set(kind,paint);
  }
  const mesh=new THREE.Mesh(labelGeometry,paint);mesh.position.set(0,2.405,.606);return mesh;
 }
 private create(merchant:Merchant):CampVisual {
  const root=new VisibleGroup(),body=new THREE.Group();root.name=`merchant-${merchant.id}`;body.name='merchant-body';
  root.add(voxelMesh(merchantCampRecipe(merchant.kind)),voxelMesh(merchantBodyRecipe(merchant.kind,'legs')),body);
  const head=voxelMesh(merchantBodyRecipe(merchant.kind,'head')),left=voxelMesh(merchantBodyRecipe(merchant.kind,'left-arm')),right=voxelMesh(merchantBodyRecipe(merchant.kind,'right-arm'));
  head.position.set(0,1.52,0);left.position.set(-.39,1.41,0);right.position.set(.39,1.41,0);
  body.add(voxelMesh(merchantBodyRecipe(merchant.kind,'body')),head,left,right);
  const label=this.label(merchant.kind);if(label)root.add(label);
  this.root.add(root);let phase=0;for(let i=0;i<merchant.id.length;i++)phase+=merchant.id.charCodeAt(i)*(i+1);
  return {root,body,head,left,right,kind:merchant.kind,phase:phase%97,seen:this.tick};
 }
 update(economy:EconomyWorld,player:Vec2,time:number):void {
  const dt=Math.min(.1,Math.max(0,time-this.previousTime)),ease=1-Math.exp(-dt*5);this.previousTime=time;this.tick++;
  for(const merchant of economy.merchants){
   let camp=this.camps.get(merchant.id);
   if(camp?.kind!==merchant.kind){camp?.root.removeFromParent();camp=this.create(merchant);this.camps.set(merchant.id,camp);}
   camp.seen=this.tick;camp.root.position.set(merchant.x,merchant.y,merchant.z);camp.root.rotation.y=merchant.angle;
   const dx=player.x-merchant.x,dz=player.z-merchant.z,distanceSquared=dx*dx+dz*dz;
   camp.root.visible=distanceSquared<10000;if(!camp.root.visible)continue;
   const breath=time*1.7+camp.phase;
   camp.body.position.y=Math.sin(breath)*.007;
   const facing=Math.atan2(dx,dz)-merchant.angle,turn=Math.atan2(Math.sin(facing),Math.cos(facing));
   const attention=distanceSquared<100&&Math.abs(turn)<1.6?THREE.MathUtils.clamp(turn,-.48,.48):Math.sin(breath*.31)*.08;
   camp.head.rotation.y+=(attention-camp.head.rotation.y)*ease;camp.head.rotation.x=Math.sin(breath*.73)*.015;
   camp.left.rotation.set(-.12+Math.sin(breath*.67)*.018,0,-.05);
   camp.right.rotation.set(-.19+Math.sin(breath*.61+1)*.025,0,.06);
  }
  for(const [id,camp] of this.camps)if(camp.seen!==this.tick){camp.root.removeFromParent();this.camps.delete(id);}
 }
 dispose():void {
  this.root.removeFromParent();this.root.clear();this.camps.clear();
  for(const paint of this.labels.values()){paint.map?.dispose();paint.dispose();}this.labels.clear();
 }
}
