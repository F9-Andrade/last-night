import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WEAPONS,type WeaponId} from '../src/game/weapons.ts';
import {createWeaponVisual} from '../src/render/weapon-assets.ts';
import {createMeleeVisual,MELEE_VISUALS,meleeRecipe} from '../src/render/melee-assets.ts';
import type {MeleeId} from '../src/game/crafting.ts';
import {voxelGeometry} from '../src/render/voxel.ts';

function validateMesh(mesh:THREE.Mesh):number {
  const geometry=mesh.geometry,indices=geometry.index!;
  assert.equal(indices.count%3,0);
  for(const name of ['position','normal','color']) {
    const attribute=geometry.getAttribute(name);
    for(let i=0;i<attribute.array.length;i++)assert.ok(Number.isFinite(attribute.array[i]),`${mesh.name}: ${name}`);
  }
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  let covered=0;
  for(const group of geometry.groups) {
    assert.equal(group.start,covered,'material groups partition the index buffer');
    assert.equal(group.count%3,0);
    assert.ok(materials[group.materialIndex!] instanceof THREE.MeshStandardMaterial);
    covered+=group.count;
  }
  assert.equal(covered,indices.count);
  return indices.count/3;
}

test('all six firearm models keep detailed geometry within a fixed three-mesh budget',()=>{
  for(const id of Object.keys(WEAPONS) as WeaponId[]) {
    const visual=createWeaponVisual(id,true),world=createWeaponVisual(id),parts=visual.root.children as THREE.Mesh[];
    assert.equal(parts.length,3);
    const triangles=parts.reduce((sum,part)=>sum+validateMesh(part),0);
    assert.ok(triangles>=600&&triangles<=1400,`${id}: ${triangles} triangles`);
    assert.ok(parts.reduce((sum,part)=>sum+part.geometry.groups.length,0)<=8);
    parts.forEach((part,i)=>{
      assert.equal(part.geometry,(world.root.children[i] as THREE.Mesh).geometry,'first/third person share immutable geometry');
      assert.equal(part.material,(world.root.children[i] as THREE.Mesh).material);
      assert.notEqual(part,world.root.children[i],'animation transforms are per survivor');
    });
    assert.equal(visual.magazine.visible,id!=='shotgun','only the loose shotgun shell is hidden at rest');
    assert.ok(visual.muzzle.z>visual.supportGrip.z&&visual.supportGrip.z>visual.grip.z);
    assert.ok(visual.aimHeight>visual.muzzle.y);
    for(const anchor of [visual.muzzle,visual.grip,visual.supportGrip,visual.ejection,visual.actionHome,visual.magazineHome]) {
      assert.ok(anchor.toArray().every(Number.isFinite));
    }
  }
});

test('articulated part pivots preserve assembled geometry and independent recoil/reload transforms',()=>{
  for(const id of Object.keys(WEAPONS) as WeaponId[]) {
    const visual=createWeaponVisual(id,true),second=createWeaponVisual(id,true);
    for(const [part,home] of [[visual.action,visual.actionHome],[visual.magazine,visual.magazineHome]] as const) {
      assert.deepEqual(part.position.toArray(),home.toArray());
      const original=voxelGeometry({id:part.userData.voxelAsset,unit:.02,build(){throw new Error('cached asset expected');}});
      const source=original.getAttribute('position'),posed=part.geometry.getAttribute('position');
      assert.equal(source.count,posed.count);
      for(let i=0;i<source.count;i++)for(let axis=0;axis<3;axis++) {
        assert.ok(Math.abs(source.array[i*3+axis]-(posed.array[i*3+axis]+home.getComponent(axis)))<1e-6,`${id}: pivot changes assembled geometry`);
      }
    }
    visual.action.position.z-=.05;visual.magazine.position.y-=.3;
    assert.deepEqual(second.action.position.toArray(),second.actionHome.toArray());
    assert.deepEqual(second.magazine.position.toArray(),second.magazineHome.toArray());
  }
});

test('all melee tools have a grippable origin, shared finished geometry and bounded detail',()=>{
  for(const id of Object.keys(MELEE_VISUALS) as MeleeId[]) {
    const visual=createMeleeVisual(id),other=createMeleeVisual(id),triangles=validateMesh(visual);
    assert.equal(visual.geometry,other.geometry);
    assert.equal(visual.material,other.material);
    assert.equal(voxelGeometry(meleeRecipe(id)),voxelGeometry(meleeRecipe(id)));
    assert.deepEqual(MELEE_VISUALS[id].grip,[0,0,0]);
    if(id==='fists'){assert.equal(triangles,0);continue;}
    assert.ok(triangles>=200&&triangles<=600,`${id}: ${triangles} triangles`);
    assert.ok(visual.geometry.groups.length<=3);
    assert.ok(visual.geometry.boundingBox!.containsPoint(new THREE.Vector3()),`${id}: hand anchor outside handle`);
    assert.ok(visual.geometry.boundingBox!.clone().expandByScalar(1e-6).containsPoint(new THREE.Vector3(...MELEE_VISUALS[id].tip)),`${id}: tip outside model`);
  }
});

test('melee rust remains metal while wood and grip wraps have their own rough finishes',()=>{
  const mesh=createMeleeVisual('axe'),geometry=mesh.geometry,colors=geometry.getAttribute('color'),indices=geometry.index!;
  const expected=[{hex:0x79563e,metalness:.35},{hex:0x806043,metalness:0},{hex:0x48523e,metalness:0}];
  for(const {hex,metalness} of expected) {
    const color=new THREE.Color(hex);let found=false;
    for(const group of geometry.groups)for(let i=group.start;i<group.start+group.count;i+=3) {
      const v=indices.getX(i);
      if([1,.86].some(ao=>Math.abs(colors.getX(v)-color.r*ao)<1e-6&&Math.abs(colors.getY(v)-color.g*ao)<1e-6&&Math.abs(colors.getZ(v)-color.b*ao)<1e-6)) {
        assert.equal((mesh.material as THREE.MeshStandardMaterial[])[group.materialIndex!].metalness,metalness);found=true;
      }
    }
    assert.ok(found,`palette color ${hex.toString(16)} must be visible`);
  }
});
