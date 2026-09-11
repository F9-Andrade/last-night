import * as THREE from 'three';
import { Character, batch, woundPart, woundPosition } from './models';
import { voxelMaterial } from './voxel';
import { BALANCE } from '../game/config';
import type { EnemyKind } from '../game/enemies';
import type { Corpse } from '../game/combat';
/** One merged mesh per corpse; only three cached anatomical poses, no per-frame skinning. */
export class CorpseView {
  private marks:THREE.InstancedMesh; private stains:THREE.InstancedMesh; private dummy=new THREE.Object3D();
  private geometry = new Map<EnemyKind,THREE.BufferGeometry[]>();
  private attachments = new Map<EnemyKind,Record<ReturnType<typeof woundPart>,THREE.Matrix4>[]>();
  private markMatrix = new THREE.Matrix4();
  private slots: {id:number;root:THREE.Mesh;paint:THREE.MeshStandardMaterial}[]=[];
  constructor(private scene:THREE.Scene) {
    this.marks=new THREE.InstancedMesh(new THREE.BoxGeometry(.15,.12,.08),new THREE.MeshStandardMaterial({color:0x68362f}),BALANCE.combat.corpseLimit*BALANCE.combat.woundLimit);this.marks.count=0;this.marks.frustumCulled=false;this.scene.add(this.marks);
    this.stains=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.012,.7),new THREE.MeshStandardMaterial({color:0x604035}),BALANCE.combat.corpseLimit);this.stains.count=0;this.stains.frustumCulled=false;this.scene.add(this.stains);
    this.prepare('walker');
  }
  private prepare(kind:EnemyKind):THREE.BufferGeometry[]{
    const cached=this.geometry.get(kind);if(cached)return cached;
    const geometries:THREE.BufferGeometry[]=[];
    const attachments:Record<ReturnType<typeof woundPart>,THREE.Matrix4>[]=[];
    for(let i=0;i<3;i++) {
      const c=new Character(true,i);c.setKind(kind); c.leftLeg.rotation.x=.16; c.rightLeg.rotation.x=-.26; c.arms.rotation.x=-.32;
      c.leftArm.rotation.z=-.28; c.rightArm.rotation.z=.38;
      // The contact shadow stays on the ground instead of rotating with the body.
      c.root.children.filter(o=>o!==c.body).forEach(o=>o.removeFromParent());
      c.root.updateMatrixWorld(true);
      attachments.push({body:c.body.matrixWorld.clone(),head:c.head.matrixWorld.clone(),leftArm:c.leftArm.matrixWorld.clone(),rightArm:c.rightArm.matrixWorld.clone(),leftLeg:c.leftLeg.matrixWorld.clone(),rightLeg:c.rightLeg.matrixWorld.clone()});
      batch(c.root); geometries.push((c.root.children.find(o=>o instanceof THREE.Mesh) as THREE.Mesh).geometry);
    }
    this.geometry.set(kind,geometries);this.attachments.set(kind,attachments);return geometries;
  }
  update(bodies:Corpse[]):void {
    const ids=new Set(bodies.map(c=>c.id));
    for(const slot of this.slots) if(!ids.has(slot.id)) {slot.id=-1;slot.root.visible=false;}
    let markIndex=0,stainIndex=0;
    for(const c of bodies) {
      const kind=c.kind??'walker',geometry=this.prepare(kind)[c.variant],attachments=this.attachments.get(kind)![c.variant];
      let slot=this.slots.find(s=>s.id===c.id);
      if(!slot) {slot=this.slots.find(s=>s.id===-1); if(!slot) {const paint=voxelMaterial.clone();paint.transparent=true;const root=new THREE.Mesh(geometry,paint);root.castShadow=true;root.receiveShadow=true;this.scene.add(root);slot={id:c.id,root,paint};this.slots.push(slot);} slot.id=c.id;slot.root.geometry=geometry;}
      const t=Math.min(1,c.age/(kind==='runner'?.5:kind==='tank'?1.15:.85)),fall=(1-Math.cos(t*Math.PI/2))*Math.PI/2;
      slot.root.visible=true;slot.root.position.set(c.x,.1+.23*t-Math.max(0,c.age-BALANCE.combat.corpseLifetime)*.04,c.z);
      slot.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),c.angle).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(c.fall),0,-Math.sin(c.fall)),fall));
      slot.paint.opacity=1-Math.max(0,c.age-BALANCE.combat.corpseLifetime)/BALANCE.combat.corpseFade;
      slot.paint.depthWrite=slot.paint.opacity>.95;slot.root.updateMatrix();
      for(const [i,w] of c.wounds.entries()){
        woundPosition(this.dummy.position,kind,w,i);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(slot.paint.opacity);this.dummy.updateMatrix();
        this.markMatrix.multiplyMatrices(slot.root.matrix,attachments[woundPart(w)]).multiply(this.dummy.matrix);
        this.marks.setMatrixAt(markIndex++,this.markMatrix);
      }
      this.dummy.position.set(c.x,.075,c.z+.3);this.dummy.rotation.set(0,c.angle,0);this.dummy.scale.setScalar(Math.min(1,c.age)*slot.paint.opacity);this.dummy.updateMatrix();this.stains.setMatrixAt(stainIndex++,this.dummy.matrix);

    }
    this.marks.count=markIndex;this.marks.instanceMatrix.needsUpdate=true;this.stains.count=stainIndex;this.stains.instanceMatrix.needsUpdate=true;
  }
}
