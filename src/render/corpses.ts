import {floorHeight,collides} from '../game/world.ts';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Character,woundPart,woundPosition} from './models.ts';
import {voxelMaterial} from './voxel.ts';
import {BALANCE} from '../game/config.ts';
import {ENEMIES} from '../game/enemies.ts';
import {Ragdoll} from './ragdoll.ts';
import type {RagdollPoint} from './ragdoll.ts';
import type {EnemyKind} from '../game/enemies.ts';
import type {Corpse} from '../game/combat.ts';
const parts=['body','head','leftArm','rightArm','leftLeg','rightLeg'] as const;
const segments=[[0,1],[1,2],[3,5],[4,6],[0,7],[0,8]] as const;
const links:[number,number][]=[[0,1],[1,2],[0,2],[0,3],[1,3],[0,4],[1,4],[3,4],[3,5],[4,6],[0,7],[0,8],[7,8]];
interface Template {geometry:THREE.BufferGeometry[];matrices:THREE.Matrix4[];anchors:THREE.Matrix4[];points:RagdollPoint[]}
interface Slot {id:number;root:THREE.Group;meshes:THREE.Mesh[];paint:THREE.MeshStandardMaterial;physics:Ragdoll;template:Template;anchors:THREE.Matrix4[];baked?:THREE.Mesh;age:number}
/** Six constrained pieces during the fall; one merged mesh once asleep. Shared templates and recycled slots. */
export class CorpseView {
 private marks:THREE.InstancedMesh;private stains:THREE.InstancedMesh;private dummy=new THREE.Object3D();
 private templates=new Map<string,Template>();private slots:Slot[]=[];
 private delta=new THREE.Matrix4();private pivot=new THREE.Matrix4();private rotation=new THREE.Quaternion();
 private rest=new THREE.Vector3();private current=new THREE.Vector3();private box=new THREE.Box3();private bounds=new THREE.Box3();private markMatrix=new THREE.Matrix4();
 constructor(private scene:THREE.Scene){
  this.marks=new THREE.InstancedMesh(new THREE.BoxGeometry(.15,.12,.08),new THREE.MeshStandardMaterial({color:0x68362f}),BALANCE.combat.corpseLimit*BALANCE.combat.woundLimit);this.marks.count=0;this.marks.frustumCulled=false;scene.add(this.marks);
  this.stains=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.012,.7),new THREE.MeshStandardMaterial({color:0x604035}),BALANCE.combat.corpseLimit);this.stains.count=0;this.stains.frustumCulled=false;scene.add(this.stains);
 }
 prepareKind(kind:EnemyKind):void {for(let variant=0;variant<3;variant++)this.prepare(kind,variant);}
 reset():void {for(const slot of this.slots){slot.id=-1;slot.root.visible=false;}this.marks.count=this.stains.count=0;}
 private prepare(kind:EnemyKind,variant:number):Template {
  const key=`${kind}:${variant}`,cached=this.templates.get(key);if(cached)return cached;
  const c=new Character(true,variant);c.setKind(kind);c.root.updateMatrixWorld(true);const shape=ENEMIES[kind];
  const at=(part:typeof parts[number],x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).applyMatrix4(c[part].matrixWorld);
  const hanging=kind==='runner'||kind==='screamer';
  const positions=[at('body',0,.84*shape.scaleY,0),at('body',0,1.43*shape.scaleY,0),at('head',0,.25,0),at('leftArm',0,0,0),at('rightArm',0,0,0),
   at('leftArm',0,hanging?-.77:kind==='tank'?-.43:-.2,hanging?.12:kind==='tank'?.72:.63),at('rightArm',0,hanging?-.77:kind==='tank'?-.43:-.2,hanging?.12:kind==='tank'?.72:kind==='spitter'?.4:.63),
   at('leftLeg',0,-.66*shape.scaleY,.13),at('rightLeg',0,-.66*shape.scaleY,.13)];
  const template:Template={geometry:[],matrices:[],anchors:[],points:positions.map((position,i)=>({position,radius:(i===0?.22:i===1?.28:i===2?.24:i<5?.16:.12)*(kind==='tank'?1.15:1),mass:i<2?3:i===2?1.2:1}))};
  for(const part of parts){const mesh=c[part].children.find(o=>o instanceof THREE.Mesh&&o.userData.voxelAsset) as THREE.Mesh;template.geometry.push(mesh.geometry);template.matrices.push(mesh.matrixWorld.clone());template.anchors.push(c[part].matrixWorld.clone());}
  c.dispose();this.templates.set(key,template);return template;
 }
 private activate(c:Corpse,slot?:Slot):Slot {
  const template=this.prepare(c.kind??'walker',c.variant);
  if(!slot){const paint=voxelMaterial.clone();paint.transparent=true;const root=new THREE.Group();const meshes=template.geometry.map(geometry=>{const mesh=new THREE.Mesh(geometry,paint);mesh.castShadow=mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;root.add(mesh);return mesh;});slot={id:c.id,root,meshes,paint,template,physics:null!,anchors:parts.map(()=>new THREE.Matrix4()),age:0};this.scene.add(root);this.slots.push(slot);}
  if(slot.baked){slot.baked.geometry.dispose();slot.baked.removeFromParent();slot.baked=undefined;}
  slot.id=c.id;slot.age=0;slot.template=template;slot.paint.opacity=1;slot.paint.depthWrite=true;
  slot.root.position.set(c.x,floorHeight(c),c.z);slot.root.rotation.set(0,c.angle,0);slot.root.visible=true;
  slot.meshes.forEach((m,i)=>{m.geometry=template.geometry[i];m.visible=true;});
  const impulse=new THREE.Vector3(Math.sin(c.fall),.04,Math.cos(c.fall)).multiplyScalar(c.kind==='tank'?.55:.85);
  slot.physics=new Ragdoll(template.points,links,impulse,c.id);
  return slot;
 }
 private pose(slot:Slot):void {
  this.bounds.makeEmpty();const {template,physics}=slot;
  for(let i=0;i<parts.length;i++){
   const [a,b]=segments[i];this.rest.subVectors(template.points[b].position,template.points[a].position).normalize();this.current.subVectors(physics.positions[b],physics.positions[a]).normalize();
   this.rotation.setFromUnitVectors(this.rest,this.current);
   this.delta.makeRotationFromQuaternion(this.rotation);this.delta.setPosition(physics.positions[a]);
   this.pivot.makeTranslation(-template.points[a].position.x,-template.points[a].position.y,-template.points[a].position.z);this.delta.multiply(this.pivot);
   slot.meshes[i].matrix.multiplyMatrices(this.delta,template.matrices[i]);slot.anchors[i].multiplyMatrices(this.delta,template.anchors[i]);
   this.box.copy(template.geometry[i].boundingBox!).applyMatrix4(slot.meshes[i].matrix);this.bounds.union(this.box);
  }
  // Support the actual voxel corners as well as the physical contact spheres.
  const lift=Math.max(0,.015-this.bounds.min.y);
  for(let i=0;i<parts.length;i++){slot.meshes[i].matrix.elements[13]+=lift;slot.anchors[i].elements[13]+=lift;slot.meshes[i].matrixWorldNeedsUpdate=true;}
 }
 private sleep(slot:Slot):void {
  const fragments=slot.meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix)),geometry=mergeGeometries(fragments)!;fragments.forEach(g=>g.dispose());
  const mesh=new THREE.Mesh(geometry,slot.paint);mesh.castShadow=mesh.receiveShadow=true;slot.root.add(mesh);slot.baked=mesh;slot.meshes.forEach(m=>m.visible=false);
 }
 update(bodies:Corpse[]):void {
  const ids=new Set(bodies.map(c=>c.id));for(const slot of this.slots)if(!ids.has(slot.id)){slot.id=-1;slot.root.visible=false;}
  let markIndex=0,stainIndex=0,bakeBudget=4;
  for(const c of bodies){
   let slot=this.slots.find(s=>s.id===c.id);if(!slot)slot=this.activate(c,slot??this.slots.find(s=>s.id===-1));
   if(!slot.baked){
    if(!slot.physics.settled||slot.age<slot.physics.duration){slot.physics.advance(c.age);this.pose(slot);}
    // Do not let the visual body drift its center through a wall. No gameplay colliders are added.
    const pelvis=slot.physics.positions[0],cos=Math.cos(c.angle),sin=Math.sin(c.angle),dx=pelvis.x*cos+pelvis.z*sin,dz=pelvis.z*cos-pelvis.x*sin;
    if(collides({x:c.x+dx,z:c.z+dz},.2)){slot.root.position.x=c.x-dx;slot.root.position.z=c.z-dz;}
    if(slot.physics.settled&&bakeBudget>0){this.sleep(slot);bakeBudget--;}
   }
   slot.age=c.age;slot.paint.opacity=Math.max(0,1-Math.max(0,c.age-BALANCE.combat.corpseLifetime)/BALANCE.combat.corpseFade);slot.paint.depthWrite=slot.paint.opacity>.95;slot.root.updateMatrix();
   for(const [i,w] of c.wounds.slice(0,BALANCE.combat.woundLimit).entries()){
    woundPosition(this.dummy.position,c.kind??'walker',w,i);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(slot.paint.opacity);this.dummy.updateMatrix();
    this.markMatrix.multiplyMatrices(slot.root.matrix,slot.anchors[parts.indexOf(woundPart(w))]).multiply(this.dummy.matrix);this.marks.setMatrixAt(markIndex++,this.markMatrix);
   }
   this.dummy.position.set(c.x,floorHeight(c)+.025,c.z+.3);this.dummy.rotation.set(0,c.angle,0);this.dummy.scale.setScalar(Math.min(1,c.age)*slot.paint.opacity);this.dummy.updateMatrix();this.stains.setMatrixAt(stainIndex++,this.dummy.matrix);
  }
  this.marks.count=markIndex;this.marks.instanceMatrix.needsUpdate=true;this.stains.count=stainIndex;this.stains.instanceMatrix.needsUpdate=true;
 }
}
