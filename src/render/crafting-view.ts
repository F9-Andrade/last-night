import {ChestView,chestRecipe} from './chest-view.ts';
import * as THREE from 'three';
import type {Simulation} from '../game/simulation';
import {TREE_TRUNKS,BASE,floorHeight} from '../game/world.ts';
import {furniturePlacement} from '../game/relocation.ts';
import {voxelMesh,voxelGeometry} from './voxel.ts';
import type {VoxelRecipe} from './voxel.ts';
import {meleeRecipe} from './melee-assets.ts';
export {meleeRecipe} from './melee-assets.ts';
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
 private tables:THREE.Mesh[]=[];private ghost:THREE.Mesh;private ghostLid:THREE.Mesh;private pose=new THREE.Object3D();private lidOffset=new THREE.Matrix4().makeTranslation(0,.75,.5);private paint=new THREE.MeshBasicMaterial({color:0x83b484,transparent:true,opacity:.3,depthWrite:false});
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
  this.ghostLid=new THREE.Mesh(voxelGeometry(chestRecipe(true)),this.paint);this.ghostLid.visible=false;this.ghostLid.matrixAutoUpdate=false;scene.add(this.ghostLid);
  for(const id of ['club','knife','axe','spear','machete','hammer'] as const)voxelGeometry(meleeRecipe(id));
 }
 update(s:Simulation,preview:'bench'|'chest'|undefined,openChest:number|undefined,dt:number,moving?:{kind:'bench'|'chest';id:number},rotation=0){
  this.chests.update(s,openChest,dt);
  for(const t of this.trees){const alive=s.crafting.trees[t.id]?.hp>0;if(t.alive===alive)continue;t.alive=alive;if(t.instance!==undefined){this.pose.matrix.copy(t.matrix!);if(!alive)this.pose.matrix.scale(new THREE.Vector3(0,0,0));const m=t.mesh as THREE.InstancedMesh;m.setMatrixAt(t.instance,this.pose.matrix);m.instanceMatrix.needsUpdate=true;}else t.mesh.visible=alive;}
  this.tables.forEach((m,i)=>{const t=s.crafting.tables[i];m.visible=!!t;if(t){m.position.set(t.x,t.y,t.z);m.rotation.y=t.angle;}});
  this.ghost.visible=!!preview&&(s.inventory.items[preview]>0||moving?.kind===preview)&&!s.gameOver;
  this.ghostLid.visible=this.ghost.visible&&preview==='chest';
  if(preview&&this.ghost.visible){
   this.ghost.geometry=voxelGeometry(preview==='chest'?chestRecipe():benchRecipe);
   const p=furniturePlacement(s,preview,rotation,moving?.kind===preview?moving.id:undefined);
   this.ghost.position.set(p.x,p.y,p.z);this.ghost.rotation.y=p.angle;this.paint.color.setHex(p.valid?0x83b484:0xc9503c);
   if(this.ghostLid.visible){this.ghost.updateMatrix();this.ghostLid.matrix.multiplyMatrices(this.ghost.matrix,this.lidOffset);}
  }
 }
}
