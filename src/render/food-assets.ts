import * as THREE from 'three';
import {voxelMesh,type VoxelGrid} from './voxel.ts';
import type {FoodId} from '../game/nutrition';

/** Original voxel provisions. Shared greedy-meshed geometry; no external textures. */
const tin=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.63,metalness:.52,flatShading:true});
const paper=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,flatShading:true});
const plastic=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.47,metalness:0,flatShading:true});
const palettes:Record<FoodId,{base:number;dark:number;light:number;ink:number;food:number}>={
 cannedBeans:{base:0x924a35,dark:0x593627,light:0xcfa36c,ink:0xe8d6a7,food:0x80513a},
 cannedMeat:{base:0x596242,dark:0x303a2d,light:0xa9ab76,ink:0xdfd4af,food:0xa06e59},
 cannedFish:{base:0x496c72,dark:0x2d4347,light:0x96a7a0,ink:0xe4dabc,food:0xafab83},
 cannedFruit:{base:0xb08a37,dark:0x766035,light:0xe0c173,ink:0xf2e4b9,food:0xb78239},
 crackers:{base:0xad8b57,dark:0x67593f,light:0xd9bd80,ink:0x543f2b,food:0xc6a773},
 ration:{base:0x676c4c,dark:0x383f30,light:0x9d9c75,ink:0xd4cba2,food:0x80634b},
 water:{base:0x92aaa5,dark:0x466766,light:0xc5d1bd,ink:0xe2e7d4,food:0x90aaad},
 soda:{base:0x994530,dark:0x562e25,light:0xc48858,ink:0xebd5ae,food:0x68482f},
};
function disk(g:VoxelGrid,y:number,height:number,color:number,r=7):void {
 for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(x*x+z*z<=r*r+3)g.fill(x,y,z,1,height,1,color);
}
function wear(g:VoxelGrid,base:number,dark:number,height:number):void {
 // Sparse folded-paper scratches, a peeled corner and a printed lot-code, all in geometry.
 g.fill(-5,3,7,3,2,1,base).set(-4,5,7,dark).fill(3,height-5,7,2,1,1,0xbdb299);
 g.fill(-5,4,-7,2,1,1,dark).set(4,7,-7,0xc4bda7);
 for(let i=0;i<7;i++)g.fill(-3+i,height-3,7,1,1+i%2,1,dark);
}
export interface FoodVisual {root:THREE.Group;lid:THREE.Group;content:THREE.Mesh;tab?:THREE.Mesh;kind:'can'|'bottle'|'packet';}
export function createFoodVisual(id:FoodId):FoodVisual {
 const p=palettes[id],root=new THREE.Group(),lid=new THREE.Group();root.name=`provision:${id}`;
 const bottle=id==='water',packet=id==='crackers'||id==='ration',kind=bottle?'bottle':packet?'packet':'can';
 const h=id==='cannedFish'?12:id==='soda'?23:19;
 const body=voxelMesh({id:`provision:${id}:body:1`,unit:.01,build(g){
  if(packet){
   g.fill(-8,0,-3,16,24,6,p.base).fill(-7,2,-4,14,19,8,p.base).fill(-6,4,-5,12,14,10,p.base);
   g.fill(-8,0,-3,16,2,6,p.dark).fill(-8,22,-3,16,2,6,p.dark);
   for(let i=-7;i<8;i+=2)g.fill(i,0,-3,1,2,7,p.light);
   g.fill(-5,6,5,10,12,1,p.light).fill(-4,14,6,8,2,1,p.ink).fill(-3,8,6,6,1,1,p.ink);
   if(id==='ration'){g.fill(-2,10,6,4,3,1,p.dark).fill(-1,9,6,2,5,1,p.dark);}
   else for(let i=0;i<3;i++)g.fill(-3+i*2,10,6,1,2,1,p.dark);
   g.fill(-7,5,4,1,12,1,p.dark).set(4,18,5,p.dark).fill(1,3,4,5,1,1,p.dark);
  }else if(bottle){
   disk(g,0,3,0x4d6e70,6);disk(g,3,15,p.base,6);disk(g,18,2,p.base,5);disk(g,20,2,p.light,4);disk(g,22,4,p.base,2);
   for(let y=4;y<17;y+=4){disk(g,y,1,p.dark,6);disk(g,y+1,1,p.light,6);}
   g.fill(-4,8,6,9,7,1,0x406477).fill(-3,9,7,7,5,1,0xabc2ba);
   g.fill(-1,10,8,3,3,1,0x476f8a).set(0,13,8,0x476f8a);
   g.fill(-4,5,5,1,3,1,0xc2d2c5).fill(-4,16,4,1,4,1,0xc2d2c5);
  }else{
   disk(g,0,h,0x858a7b);disk(g,2,h-4,p.base);disk(g,1,1,0xb9baa0);disk(g,h-2,2,0xb1b39f);disk(g,h-1,1,0x71786d,6);
   // Hollow lip, dark food well and metal seam.
   for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)if(x*x+z*z<31)g.carve(x,h-2,z,1,2,1);
   g.fill(-4,5,7,9,Math.max(5,h-10),1,p.ink).fill(-4,5,8,9,2,1,p.dark);
   if(id==='cannedFish'){g.fill(-3,8,8,5,2,1,p.dark).fill(2,7,8,2,4,1,p.dark).set(-3,9,9,p.ink);}
   else if(id==='cannedBeans'){g.fill(-2,9,8,2,3,1,p.base).fill(1,8,8,2,3,1,p.dark);}
   else if(id==='cannedFruit'){g.fill(-2,9,8,4,4,1,p.base).fill(-1,13,8,2,1,1,0x68734c);}
   else if(id==='cannedMeat'){g.fill(-3,9,8,7,3,1,p.base).fill(-2,12,8,5,1,1,p.dark);}
   else {g.fill(-1,8,8,3,8,1,p.base).fill(-3,12,8,7,2,1,p.base);}
   wear(g,p.light,p.dark,h);
   g.fill(5,3,5,1,h-6,1,0x866a44).fill(-6,h-4,-3,1,2,3,0x9d7849);
  }
 }},bottle?plastic:packet?paper:tin);root.add(body);
 const content=voxelMesh({id:`provision:${id}:contents:1`,unit:.01,build(g){
  if(packet){g.fill(-5,18,-2,10,5,4,p.food);if(id==='crackers')for(let x=-4;x<5;x+=3)g.set(x,22,2,0x816440);}
  else if(bottle){disk(g,23,1,0x415e65,1);}
  else {disk(g,h-3,1,p.food,5);for(let i=0;i<5;i++)g.fill(-4+i*2,h-2,(i%3-1)*2,2,1,2,i%2?p.light:p.dark);}
 }},paper);root.add(content);
 lid.position.set(0,bottle?.255:packet?.225:(h-1)*.01,bottle?0:packet?0:-.06);
 const cover=voxelMesh({id:`provision:${id}:lid:1`,unit:.01,build(g){
  if(bottle){disk(g,0,3,0xb4ac89,3);for(let x=-2;x<3;x+=2)g.fill(x,0,3,1,3,1,0x766f56);}
  else if(packet){g.fill(-8,0,-3,16,2,6,p.dark).fill(-7,1,-3,14,1,1,p.light);}
  else {for(let x=-6;x<=6;x++)for(let z=-6;z<=6;z++)if(x*x+z*z<=39)g.set(x,0,z+6,0xaaaD99);g.fill(-3,1,5,7,1,3,0x626a5e);g.fill(-2,1,6,5,1,1,0x929982);if(id==='soda')g.carve(-2,0,9,5,2,3);}
 }},packet?paper:tin);lid.add(cover);root.add(lid);
 let tab:THREE.Mesh|undefined;
 if(!bottle&&!packet){tab=voxelMesh({id:'provision:pull-tab:1',unit:.01,build(g){g.fill(-2,0,0,5,1,4,0xd5d1b8).carve(-1,0,1,3,1,2);}},tin);tab.position.set(0,.015,.08);lid.add(tab);}
 return {root,lid,content,tab,kind};
}
export function createEatingSpoon():THREE.Mesh {return voxelMesh({id:'provision:spoon:1',unit:.006,build(g){g.fill(-1,-1,-25,2,2,25,0xa4a894).fill(-3,-1,-30,6,2,7,0x808d84).fill(-2,0,-29,4,1,5,0x635543);}},tin);}
