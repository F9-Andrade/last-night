import * as THREE from 'three';
import type {Simulation} from '../game/simulation.ts';
import {
 BUILD_GROUND,BUILD_PLOT,LEVEL_HEIGHT,MODULE_SIZE,structurePlacement,
} from '../game/construction.ts';
import type {StructureKind} from '../game/construction.ts';
import {voxelGeometry,voxelMaterial} from './voxel.ts';
import type {VoxelGrid,VoxelRecipe} from './voxel.ts';

export interface BuildPreview {kind:StructureKind;rotation:0|1|2|3;level:number}
const KINDS:StructureKind[]=['wall','window','door','floor','roof','stairs','spikes','snare','wire'];
const CAPACITY=192;
const WOOD=[0x746044,0x80694b,0x6b583f,0x8b7050,0x78664e,0x8e7857];
const IRON=[0x555d58,0x69716a,0x4b534f,0x76694f];

function beam(g:VoxelGrid,x:number,y:number,z:number,length:number,up:boolean,color:number){
 for(let i=0;i<length;i++)g.fill(x+i,y+(up?i:-i),z,2,3,1,color);
}
function bolts(g:VoxelGrid,x:number,y:number,z:number){g.fill(x,y,z,1,1,1,0xaca68b);}
function wall(g:VoxelGrid,kind:StructureKind,tier:number){
 // A complete three-metre wall, with real openings. The joinery is structural,
 // rather than the old waist-high barricade repeated over the façade.
 for(let i=0;i<15;i++){
  const x=-30+i*4,color=WOOD[(i*7+2)%WOOD.length];
  g.fill(x,1,-2,4,58,4,color).fill(x,2,-3,1,56,1,0x584936);
  if(i%3===1)g.fill(x+1,18+i,-3,2,5,1,0x6e5b42);
 }
 for(const x of [-30,26])g.fill(x,0,-3,4,60,6,0x574936);
 for(const y of [0,56])g.fill(-30,y,-3,60,4,6,0x655239);
 g.fill(-27,18,2,54,3,1,0x5a4a35).fill(-27,40,2,54,3,1,0x5a4a35);
 beam(g,-25,4,3,47,true,0x958064);
 if(tier>=1){
  // Stretched, stitched canvas backed by the timber wall.
  for(const x of [-24,1]){
   g.fill(x,7,-4,22,43,1,0x626d54);
   g.fill(x+1,8,-5,1,40,1,0x85866b);
   for(let y=10;y<47;y+=5)g.fill(x+19,y,-5,2,1,1,0xaaa180);
  }
  for(const y of [6,49])g.fill(-26,y,-5,52,2,1,0x746148);
  // Interior bracing also communicates reinforcement from inside the shelter.
  for(const y of [12,44]){g.fill(-26,y,4,52,2,1,0x747b5e);for(let x=-23;x<25;x+=8)bolts(g,x,y,5);}
 }
 if(tier>=2){
  for(const [x,y,w,h] of [[-26,6,22,22],[-1,8,25,24],[-23,32,26,20],[5,35,19,17]]){
   g.fill(x,y,-6,w,h,1,IRON[(x+y+80)%IRON.length]);
   for(let dx=3;dx<w;dx+=6)g.fill(x+dx,y+1,-7,1,h-2,1,0x454d48);
   g.fill(x,y,-7,w,1,1,0x8e6a49);
   for(const dx of [1,w-2])for(const dy of [2,h-2])bolts(g,x+dx,y+dy,-8);
  }
  for(const y of [2,54])g.fill(-29,y,-7,58,2,2,0x4a534d);
  for(const x of [-26,23]){g.fill(x,4,5,3,51,1,0x59605a);for(const y of [7,26,50])bolts(g,x+1,y,6);}
  for(const y of [5,51]){g.fill(-25,y,5,51,3,1,0x63675c);for(let x=-21;x<24;x+=10)bolts(g,x,y+1,6);}
 }
 if(kind==='window'){
  g.carve(-14,22,-10,28,25,20);
  for(const x of [-17,14])g.fill(x,20,-5,3,30,10,0x9b8563);
  for(const y of [19,47])g.fill(-17,y,-5,34,3,10,0xa18a65);
  g.fill(-19,19,-7,38,2,14,0x6d5b42);
  // No invisible pane or decorative bars across the firing aperture.
 }
 if(kind==='door'){
  g.carve(-12,0,-10,24,44,20);
  for(const x of [-16,12])g.fill(x,0,-5,4,48,10,0x4d4435);
  g.fill(-16,44,-5,32,4,10,0x9b8563);
  for(const x of [-15,14])for(const y of [8,37])bolts(g,x,y,-6);
 }
}

export function structureRecipe(kind:StructureKind,tier=0,leaf=false):VoxelRecipe {
 return {id:`construction:${kind}:${tier}:${leaf?'leaf':'body'}:1`,unit:.05,build(g){
  if(leaf){
   for(let i=0;i<6;i++)g.fill(i*4,0,-2,i===5?3:4,43,3,WOOD[i]);
   for(const y of [4,34])g.fill(0,y,-3,23,3,1,0x4e4738);
   beam(g,1,9,1,21,true,0x9b815c);
   for(const y of [7,34])g.fill(-1,y,-4,8,2,2,0x414b46);
   g.fill(19,19,-4,2,5,2,0xb2a283).fill(20,20,-6,1,3,2,0x6d7367);
   if(tier>=1)g.fill(3,7,-3,14,25,1,0x65705c).fill(3,7,-4,1,25,1,0x98967b);
   if(tier>=2){g.fill(2,6,-5,17,27,1,0x59625e);for(const y of [8,30])for(const x of [4,16])bolts(g,x,y,-6);}
   return;
  }
  if(kind==='wall'||kind==='window'||kind==='door'){wall(g,kind,tier);return;}
  if(kind==='floor'||kind==='roof'){
   const y=kind==='roof'?60:0;
   for(let i=0;i<15;i++)g.fill(-30+i*4,y-3,-30,4,3,60,WOOD[(i*5+1)%WOOD.length]);
   for(const x of [-30,26])g.fill(x,y-5,-30,4,2,60,0x554833);
   for(const z of [-29,26])g.fill(-26,y-5,z,52,2,3,0x69563e);
   if(kind==='roof'||tier>=1){
    for(let i=0;i<6;i++){
     const x=-30+i*10;
     g.fill(x,y-1,-30,10,1,60,tier===2?IRON[i%IRON.length]:0x606553);
     g.fill(x,y-1,-29,1,1,58,0x878777);
     for(const z of [-27,26])bolts(g,x+3,y-1,z);
    }
   }
   return;
  }
  if(kind==='stairs'){
   for(let i=0;i<15;i++){
    const z=-30+i*4,y=(i+1)*4;
    g.fill(-25,y-3,z,50,3,4,WOOD[i%WOOD.length]).fill(-25,y-4,z,50,1,1,0x584631);
    // Closed risers and boarded sides express the solid stair collision volume.
    // Leaving an apparent walkable void underneath would mislead the player.
    for(const x of [-28,25])g.fill(x,0,z,3,y,4,tier>1?0x59615a:0x5c4c37);
    g.fill(-25,0,z,50,y,1,0x68563f);
    if(i===14)g.fill(-25,0,z+3,50,y,1,0x5b4e3b);
    if(tier>=1)g.fill(-24,y-1,z,48,1,1,0x8d907b);
   }
   for(const x of [-28,26]){
    for(const i of [0,4,8,12,14])g.fill(x,(i+1)*4,-30+i*4,2,17,2,tier===2?0x626a64:0x827054);
    for(let i=0;i<15;i++)g.fill(x,(i+1)*4+17,-30+i*4,2,2,4,0xaaa185);
   }
   return;
  }
  if(kind==='spikes'){
   for(const z of [-20,17])g.fill(-25,0,z,50,3,4,0x5c4b35);
   for(const x of [-20,-10,0,10,20])for(const z of [-14,0,14]){
    g.fill(x-2,1,z-2,4,9,4,0x7e6849).fill(x-1,10,z-1,2,5,2,tier>0?0x798078:0xb6a481);
   }
   return;
  }
  if(kind==='snare'){
   for(const x of [-17,15])g.fill(x,0,-17,2,2,34,0x62563e);
   for(const z of [-17,15])g.fill(-15,0,z,30,2,2,0x8f876a);
   g.fill(-8,0,-8,16,2,16,0x46514a).fill(-6,2,-6,12,1,12,0x766e52);
   for(const x of [-10,8])for(let z=-8;z<10;z+=4)g.fill(x,2,z,2,3,2,0xadb099);
   return;
  }
  if(kind==='wire'){
   for(const x of [-28,26]){
    g.fill(x,0,-2,3,32,4,0x5d655b).fill(x-1,0,-3,5,3,6,0x74715c);
    for(const y of [10,20,29])g.fill(x-1,y,-3,5,2,6,0x90917a);
   }
   for(const y of [9,19,28]){
    g.fill(-27,y,-1,54,1,1,0x969d8c);
    for(let x=-25;x<25;x+=7)g.fill(x,y-2,-2,1,5,3,0xada993);
   }
   for(let i=0;i<25;i++){g.fill(-25+i*2,4+i,-1,2,1,1,0x737d70);g.fill(-25+i*2,29-i,-1,2,1,1,0x737d70);}
  }
 }};
}

interface Batch {mesh:THREE.InstancedMesh;used:number}
/** Shared, greedily meshed voxel geometry and bounded instancing: another wall
 * adds an instance, not another material or draw call. Doors have a second batch. */
export class ConstructionView {
 private batches=new Map<string,Batch>();
 private angles=new Map<number,number>();
 private bodyMatrix=new THREE.Matrix4();private doorMatrix=new THREE.Matrix4();
 private pose=new THREE.Object3D();private doorPose=new THREE.Object3D();
 private ghostPaint=new THREE.MeshBasicMaterial({color:0xa2ceb2,transparent:true,opacity:.37,depthWrite:false});
 private ghost=new THREE.Mesh(new THREE.BufferGeometry(),this.ghostPaint);
 private ghostDoor=new THREE.Mesh(new THREE.BufferGeometry(),this.ghostPaint);
 private grid:THREE.LineSegments;private border:THREE.LineSegments;
 private anchors:THREE.InstancedMesh;
 private scene:THREE.Scene;
 private prepared=false;
 private signature='';private animating=false;
 constructor(scene:THREE.Scene){
  this.scene=scene;
  this.ghost.visible=this.ghostDoor.visible=false;this.ghost.name='construction-preview';this.ghostDoor.name='construction-door-preview';scene.add(this.ghost,this.ghostDoor);
  const grid:number[]=[],edge:number[]=[];
  const {minX,maxX,minZ,maxZ}=BUILD_PLOT,y=BUILD_GROUND+.025;
  for(let x=minX;x<=maxX;x+=MODULE_SIZE)grid.push(x,y,minZ,x,y,maxZ);
  for(let z=minZ;z<=maxZ;z+=MODULE_SIZE)grid.push(minX,y,z,maxX,y,z);
  edge.push(minX,y,minZ,maxX,y,minZ,maxX,y,minZ,maxX,y,maxZ,maxX,y,maxZ,minX,y,maxZ,minX,y,maxZ,minX,y,minZ);
  this.grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(grid,3)),new THREE.LineBasicMaterial({color:0x9cad88,transparent:true,opacity:.24,depthWrite:false}));
  this.border=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(edge,3)),new THREE.LineBasicMaterial({color:0xdfb775,transparent:true,opacity:.85,depthWrite:false}));
  const count=((maxX-minX)/MODULE_SIZE+1)*((maxZ-minZ)/MODULE_SIZE+1);
  this.anchors=new THREE.InstancedMesh(new THREE.BoxGeometry(.09,.018,.09),new THREE.MeshBasicMaterial({color:0xe0c58f,transparent:true,opacity:.8,depthWrite:false}),count);
  let at=0;for(let x=minX;x<=maxX;x+=MODULE_SIZE)for(let z=minZ;z<=maxZ;z+=MODULE_SIZE){this.pose.position.set(x,y+.006,z);this.pose.updateMatrix();this.anchors.setMatrixAt(at++,this.pose.matrix);}
  this.anchors.instanceMatrix.needsUpdate=true;this.anchors.computeBoundingSphere();
  this.grid.visible=this.border.visible=this.anchors.visible=false;scene.add(this.grid,this.border,this.anchors);
 }
 async prepare(){
  if(this.prepared)return;
  for(const kind of KINDS){
   for(let tier=0;tier<3;tier++){voxelGeometry(structureRecipe(kind,tier));if(kind==='door')voxelGeometry(structureRecipe(kind,tier,true));}
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }
  this.prepared=true;
 }
 private batch(kind:StructureKind,tier:number,leaf=false){
  const key=`${kind}:${tier}:${leaf}`;
  let batch=this.batches.get(key);
  if(!batch){
   const mesh=new THREE.InstancedMesh(voxelGeometry(structureRecipe(kind,tier,leaf)),voxelMaterial,CAPACITY);
   mesh.name=`construction-${key}`;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.count=0;this.scene.add(mesh);
   batch={mesh,used:0};this.batches.set(key,batch);
  }
  return batch;
 }
 private add(kind:StructureKind,tier:number,matrix:THREE.Matrix4,leaf=false){const b=this.batch(kind,tier,leaf);if(b.used<CAPACITY)b.mesh.setMatrixAt(b.used++,matrix);}
 metrics(){let batches=0,instances=0;for(const b of this.batches.values())if(b.used){batches++;instances+=b.used;}return {batches,instances,capacity:CAPACITY};}
 update(s:Simulation,preview:BuildPreview|undefined,dt:number){
  const signature=s.crafting.structures.map(p=>`${p.id}:${p.kind}:${p.tier}:${p.hp>0}:${p.x}:${p.z}:${p.level}:${p.rotation}:${p.open}:${Math.hypot(p.x-s.player.x,p.z-s.player.z)<=105}`).join('|');
  if(signature!==this.signature||this.animating){
  this.signature=signature;this.animating=false;
  for(const b of this.batches.values())b.used=0;
  const live=new Set<number>();
  for(const piece of s.crafting.structures){
   if(piece.hp<=0)continue;live.add(piece.id);
   if(Math.hypot(piece.x-s.player.x,piece.z-s.player.z)>105)continue;
   this.pose.position.set(piece.x,BUILD_GROUND+piece.level*LEVEL_HEIGHT,piece.z);this.pose.rotation.set(0,piece.rotation*Math.PI/2,0);this.pose.updateMatrix();this.bodyMatrix.copy(this.pose.matrix);
   this.add(piece.kind,piece.tier,this.bodyMatrix);
   if(piece.kind==='door'){
    const target=piece.open?Math.PI/2:0,previous=this.angles.get(piece.id)??target;
    const eased=previous+(target-previous)*(1-Math.exp(-Math.max(0,dt)*9)),angle=Math.abs(target-eased)<.0001?target:eased;this.angles.set(piece.id,angle);if(angle!==target)this.animating=true;
    this.doorPose.position.set(-.57,0,0);this.doorPose.rotation.set(0,angle,0);this.doorPose.updateMatrix();this.doorMatrix.multiplyMatrices(this.bodyMatrix,this.doorPose.matrix);
    this.add(piece.kind,piece.tier,this.doorMatrix,true);
   }
  }
  for(const id of this.angles.keys())if(!live.has(id))this.angles.delete(id);
  for(const b of this.batches.values()){
   b.mesh.count=b.used;b.mesh.visible=b.used>0;
   if(b.used){b.mesh.instanceMatrix.clearUpdateRanges();b.mesh.instanceMatrix.addUpdateRange(0,b.used*16);b.mesh.instanceMatrix.needsUpdate=true;}
  }
  }
  this.ghost.visible=!!preview&&!s.gameOver;this.ghostDoor.visible=this.ghost.visible&&preview?.kind==='door';
  this.grid.visible=this.border.visible=this.anchors.visible=this.ghost.visible;
  if(!preview||!this.ghost.visible)return;
  const p=structurePlacement(s,preview.kind,preview.rotation,preview.level);
  this.ghost.geometry=voxelGeometry(structureRecipe(preview.kind));this.ghost.position.set(p.x,BUILD_GROUND+p.level*LEVEL_HEIGHT,p.z);this.ghost.rotation.y=p.rotation*Math.PI/2;
  this.ghostPaint.color.setHex(p.valid?0x9acdb0:0xdb7058);
  this.grid.position.y=preview.level*LEVEL_HEIGHT;this.anchors.position.y=preview.level*LEVEL_HEIGHT;
  if(this.ghostDoor.visible){this.ghost.updateMatrix();this.doorPose.position.set(-.57,0,0);this.doorPose.rotation.set(0,0,0);this.doorPose.updateMatrix();this.ghostDoor.geometry=voxelGeometry(structureRecipe('door',0,true));this.ghostDoor.matrixAutoUpdate=false;this.ghostDoor.matrix.multiplyMatrices(this.ghost.matrix,this.doorPose.matrix);}
 }
}
