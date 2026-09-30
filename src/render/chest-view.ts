import * as THREE from 'three';
import {voxelMesh} from './voxel.ts';
import type {VoxelRecipe} from './voxel.ts';
import type {Simulation} from '../game/simulation';
import {CHEST_LIMIT} from '../game/chests.ts';
import {distance} from '../game/world.ts';
export const chestRecipe=(lid=false):VoxelRecipe=>({id:`craft:chest:${lid?'lid':'body'}:1`,unit:.05,build(g){
 if(lid){g.fill(-13,0,-20,26,4,20,0x785137).fill(-12,3,-19,24,1,18,0x987046);for(const x of [-12,10])g.fill(x,0,-20,2,4,20,0x424844);g.fill(-2,-2,-21,4,5,2,0xa49970);return;}
 g.fill(-13,0,-10,26,2,20,0x503b2a).fill(-13,2,-10,2,13,20,0x785137).fill(11,2,-10,2,13,20,0x785137).fill(-11,2,-10,22,13,2,0x816042).fill(-11,2,8,22,13,2,0x65492f);
 for(const y of [2,7,12])g.fill(-11,y,-11,22,1,1,0x4f3827);
 for(const x of [-12,10])g.fill(x,0,-11,2,15,1,0x414641).fill(x,0,10,2,15,1,0x414641);
}});
export class ChestView {
 private meshes:{root:THREE.Group;lid:THREE.Group}[]=[];
 constructor(scene:THREE.Scene){for(let i=0;i<CHEST_LIMIT;i++){const root=new THREE.Group(),lid=new THREE.Group();root.add(voxelMesh(chestRecipe()));lid.position.set(0,.75,.5);lid.add(voxelMesh(chestRecipe(true)));root.add(lid);root.visible=false;scene.add(root);this.meshes.push({root,lid});}}
 update(s:Simulation,open:number|undefined,dt:number){this.meshes.forEach(({root,lid},i)=>{const c=s.crafting.chests[i];root.visible=!!c&&distance(c,s.player)<65;if(!c)return;root.position.set(c.x,c.y,c.z);root.rotation.y=c.angle;lid.rotation.x+=((open===c.id?1.65:0)-lid.rotation.x)*(1-Math.exp(-dt*12));});}
}
