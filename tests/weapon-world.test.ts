import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Character} from '../src/render/models.ts';
import {createWeaponVisual} from '../src/render/weapon-assets.ts';
import {createMeleeVisual,MELEE_VISUALS} from '../src/render/melee-assets.ts';
import {HAND_GRIP} from '../src/render/hand-assets.ts';
import {createWorldWeaponMesh} from '../src/render/expedition-view.ts';
import {WEAPONS,type WeaponId} from '../src/game/weapons.ts';
import type {MeleeId} from '../src/game/crafting.ts';

const weapons=Object.keys(WEAPONS) as WeaponId[];
const near=(a:THREE.Vector3,b:THREE.Vector3)=>assert.ok(a.distanceTo(b)<1e-6,`separation ${a.distanceTo(b)} m`);
const hands=(c:Character)=>(c as any).survivorArms as {hand:{root:THREE.Group};upper:THREE.Mesh;forearm:THREE.Mesh;elbow:THREE.Vector3;wrist:THREE.Vector3}[];

test('remote firearms keep two palms attached during locomotion and recoil, including the pump',()=>{
 const c=new Character();
 for(const id of weapons)for(let frame=0;frame<32;frame++){
  c.setWeapon(id);c.animate(frame/15,true,frame%2===0,Math.sin(frame*.2)**2*WEAPONS[id].recoil);c.reloadPose(0);c.root.updateMatrixWorld(true);
  const visual=(c as any).heldVisual as ReturnType<typeof createWeaponVisual>;
  for(const [index,arm] of hands(c).entries()){
   const contact=(index===0?visual.grip:visual.supportGrip).clone();
   if(index===1&&visual.actionKind==='pump')contact.add(visual.action.position).sub(visual.actionHome);
   near(HAND_GRIP.clone().applyMatrix4(arm.hand.root.matrixWorld),contact.applyMatrix4(c.weapon!.matrixWorld));
   assert.ok(Math.abs(arm.elbow.length()-.43)<1e-6);
   assert.ok(Math.abs(arm.elbow.distanceTo(arm.wrist)-.47)<1e-6);
  }
 }
 c.dispose();
});

test('remote reload restores exact homes for magazines, cylinders and the loose shotgun shell',()=>{
 const c=new Character();
 for(const id of weapons){
  c.setWeapon(id);const visual=(c as any).heldVisual as ReturnType<typeof createWeaponVisual>;
  c.animate(0,false,false,0);c.reloadPose(WEAPONS[id].reload*.65,WEAPONS[id].reload);
  assert.notDeepEqual(c.magazine!.position.toArray(),visual.magazineHome.toArray());
  c.animate(0,false,false,0);c.reloadPose(0,WEAPONS[id].reload);
  near(c.magazine!.position,visual.magazineHome);near(visual.action.position,visual.actionHome);
  assert.equal(c.magazine!.visible,id!=='shotgun');
 }
 c.dispose();
});

test('remote tools close around the handle origin while both sleeves stay connected',()=>{
 const c=new Character();
 for(const id of ['knife','club','axe','spear','machete','hammer'] as MeleeId[]){
  const mesh=createMeleeVisual(id);mesh.rotation.x=id==='spear'?Math.PI/2:.25;c.rightArm.add(mesh);
  for(let f=0;f<36;f++){
   const hit=Math.sin(f/36*Math.PI);c.arms.rotation.set(0,0,0);c.arms.position.set(0,0,0);
   c.rightArm.rotation.set(-.22-hit*.5,.12-hit*.18,.12-hit*.1);c.leftArm.rotation.set(-.22,-.12,-.12);
   c.updateHands(mesh,id);c.root.updateMatrixWorld(true);
   near(HAND_GRIP.clone().applyMatrix4(hands(c)[0].hand.root.matrixWorld),new THREE.Vector3().applyMatrix4(mesh.matrixWorld));
   const support=MELEE_VISUALS[id].supportGrip;
   if(support)near(HAND_GRIP.clone().applyMatrix4(hands(c)[1].hand.root.matrixWorld),new THREE.Vector3(...support).applyMatrix4(mesh.matrixWorld));
   for(const arm of hands(c)){
    near(new THREE.Vector3(0,0,.425).applyMatrix4(arm.forearm.matrixWorld),arm.elbow.clone().applyMatrix4(arm.forearm.parent!.matrixWorld));
    near(new THREE.Vector3(0,0,.38).applyMatrix4(arm.upper.matrixWorld),new THREE.Vector3().applyMatrix4(arm.upper.parent!.matrixWorld));
   }
  }
  mesh.removeFromParent();
 }
 c.dispose();
});

test('weapon pickups retain every visible part, physical bounds and shared material finishes',()=>{
 for(const id of weapons){
  const visual=createWeaponVisual(id);visual.root.scale.setScalar(visual.scale);visual.root.updateMatrixWorld(true);
  let count=0;const expected=new THREE.Box3(),partBounds=new THREE.Box3();
  visual.root.traverseVisible(part=>{if(part instanceof THREE.Mesh){count+=part.geometry.index!.count;part.geometry.computeBoundingBox();partBounds.copy(part.geometry.boundingBox!).applyMatrix4(part.matrixWorld);expected.union(partBounds);}});
  const mesh=createWorldWeaponMesh(id),copy=createWorldWeaponMesh(id);
  assert.equal(mesh.geometry.index!.count,count);assert.equal(mesh.geometry.groups.reduce((n,g)=>n+g.count,0),count);
  near(mesh.geometry.boundingBox!.min,expected.min);near(mesh.geometry.boundingBox!.max,expected.max);
  assert.equal(copy.geometry,mesh.geometry);assert.equal(copy.material,mesh.material);
  assert.ok(Array.isArray(mesh.material)&&mesh.material.length>=2);
 }
});
