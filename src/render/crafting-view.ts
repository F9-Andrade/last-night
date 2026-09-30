import {ChestView,chestRecipe} from './chest-view.ts';
import * as THREE from 'three';
import type {Simulation} from '../game/simulation';
import {TREE_TRUNKS,BASE,floorHeight} from '../game/world.ts';
import {placement} from '../game/crafting.ts';
import {voxelMesh,voxelGeometry} from './voxel.ts';
import type {VoxelRecipe} from './voxel.ts';
import type {MeleeId} from '../game/crafting.ts';
export function meleeRecipe(id:MeleeId):VoxelRecipe{return {id:`craft:melee:${id}:1`,unit:.025,build(g){
 if(id==='fists')return;
 const long=id==='spear';g.fill(-2,-(long?26:12),-2,4,long?45:22,4,0x795b3f).fill(-2,-10,-3,4,7,1,0xaca084);
 if(id==='club'){g.fill(-3,3,-3,6,16,6,0x69543d);g.fill(-4,15,-1,8,1,2,0x8d877b);}
 else if(id==='axe'){g.fill(-3,8,-1,11,8,3,0x646e6c).fill(7,7,-1,2,10,3,0xb0b5a9);}
 else if(id==='spear'){g.fill(-2,18,-1,4,9,2,0x838e88).fill(-1,27,-1,2,5,2,0xb8bdb0);}
 else {g.fill(-2,2,-1,id==='knife'?4:6,id==='knife'?12:23,2,0x7c8780).fill(-2,3,-2,1,id==='knife'?10:20,1,0xd2cfc0).fill(-4,0,-2,8,2,4,0x414c47);}
}};}
export const benchRecipe:VoxelRecipe={id:'craft:smart-bench:1',unit:.05,build(g){
 g.fill(-15,19,-10,30,3,20,0x7f674c).fill(-15,21,-10,30,1,2,0xa29371);
 for(const x of [-13,10])for(const z of [-8,5])g.fill(x,0,z,3,20,3,0x464e49);
 g.fill(-12,5,-7,24,2,14,0x6a5843).fill(-14,22,7,28,12,2,0x383f39);
 g.fill(-10,25,9,10,6,1,0x182d27).fill(-9,26,10,8,1,1,0x80a77b).fill(-9,29,10,5,1,1,0x80a77b);
 g.fill(4,22,-3,6,5,5,0x676f67).fill(2,26,-2,10,2,3,0x949583);
 g.fill(-8,22,-6,2,1,10,0xc4b18a).fill(-9,23,-5,4,2,3,0x8b9690);
}};
/** Bounded reusable meshes; harvest hides original tree instances without rebuilding the city. */
export class CraftingView {
 private trees:{mesh:THREE.Mesh;instance?:number;matrix?:THREE.Matrix4;id:number;alive:boolean}[]=[];
 private chests:ChestView;
 private tables:THREE.Mesh[]=[];private ghost:THREE.Mesh;private pose=new THREE.Object3D();private paint=new THREE.MeshBasicMaterial({color:0x83b484,transparent:true,opacity:.3,depthWrite:false});
 constructor(scene:THREE.Scene){
  this.chests=new ChestView(scene);
  scene.updateMatrixWorld(true);const position=new THREE.Vector3(),matrix=new THREE.Matrix4();
  scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const isInstance=o instanceof THREE.InstancedMesh&&o.name.startsWith('voxel-trees-');if(!isInstance&&!String(o.userData.voxelAsset??'').includes('tree'))return;
   const count=isInstance?(o as THREE.InstancedMesh).count:1;
   for(let i=0;i<count;i++){if(isInstance){(o as THREE.InstancedMesh).getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix).applyMatrix4(o.matrixWorld);}else o.getWorldPosition(position);
    const id=TREE_TRUNKS.findIndex(t=>Math.abs(t.x-position.x)<.05&&Math.abs(t.z-position.z)<.05);if(id>=0)this.trees.push({mesh:o,id,alive:true,instance:isInstance?i:undefined,matrix:isInstance?matrix.clone():undefined});
   }
  });
  const bed=voxelMesh({id:'craft:bed:1',unit:.05,build(g){g.fill(-13,7,-23,26,4,46,0x596650).fill(-12,11,-22,24,4,44,0xaaa48a).fill(-11,15,-20,22,2,10,0xd3c8a9).fill(-12,15,-7,24,2,28,0x5e6950);for(const x of [-12,10])for(const z of [-21,19])g.fill(x,0,z,2,9,2,0x444b42);g.fill(-13,10,-23,26,12,2,0x645239);}});bed.position.set(BASE.x,floorHeight(BASE),BASE.z);bed.name='shelter-bed';scene.add(bed);
  for(let i=0;i<12;i++){const m=voxelMesh(benchRecipe);m.visible=false;scene.add(m);this.tables.push(m);}
  this.ghost=new THREE.Mesh(voxelGeometry(benchRecipe),this.paint);this.ghost.visible=false;scene.add(this.ghost);
  for(const id of ['club','knife','axe','spear','machete'] as const)voxelGeometry(meleeRecipe(id));
 }
 update(s:Simulation,preview:'bench'|'chest'|undefined,openChest:number|undefined,dt:number){
  this.chests.update(s,openChest,dt);
  for(const t of this.trees){const alive=s.crafting.trees[t.id]?.hp>0;if(t.alive===alive)continue;t.alive=alive;if(t.instance!==undefined){this.pose.matrix.copy(t.matrix!);if(!alive)this.pose.matrix.scale(new THREE.Vector3(0,0,0));const m=t.mesh as THREE.InstancedMesh;m.setMatrixAt(t.instance,this.pose.matrix);m.instanceMatrix.needsUpdate=true;}else t.mesh.visible=alive;}
  this.tables.forEach((m,i)=>{const t=s.crafting.tables[i];m.visible=!!t;if(t){m.position.set(t.x,t.y,t.z);m.rotation.y=t.angle;}});
  this.ghost.visible=!!preview&&s.inventory.items[preview]>0&&!s.gameOver;if(this.ghost.visible){this.ghost.geometry=voxelGeometry(preview==='chest'?chestRecipe():benchRecipe);const p=placement(s);this.ghost.position.set(p.x,p.y,p.z);this.ghost.rotation.y=p.angle;this.paint.color.setHex(p.valid?0x83b484:0xc9503c);}
 }
}
