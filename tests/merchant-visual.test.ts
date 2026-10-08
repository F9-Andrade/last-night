import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MerchantsView,merchantCampRecipe,merchantBodyRecipe} from '../src/render/merchants.ts';
import {voxelGeometry} from '../src/render/voxel.ts';
import type {EconomyWorld,Merchant,MerchantKind} from '../src/game/economy.ts';
import {merchantObstacles} from '../src/game/merchant-collision.ts';

const kinds:MerchantKind[]=['supplies','medic','gunsmith','salvage'];
const trader=(kind:MerchantKind,index=0):Merchant=>({id:`trader-${index}`,kind,name:'Comerciante',title:'Trocas',x:0,y:0,z:0,angle:0,revision:0,coins:100,stock:{}});

test('merchant posts fit the reserved terrain with an open approach and bounded voxel geometry',()=>{
 for(const kind of kinds){
  const geometry=voxelGeometry(merchantCampRecipe(kind)),bounds=geometry.boundingBox!;
  assert.equal(geometry,voxelGeometry(merchantCampRecipe(kind)));
  assert.ok(bounds.min.x>=-3&&bounds.max.x<=3&&bounds.min.z>=-3&&bounds.max.z<=1);
  assert.ok(bounds.min.y>=0&&bounds.max.y<=3.1);
  assert.ok(geometry.index!.count/3<2500,`${kind}: excessive camp geometry`);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld(true);
  // A player facing the trader from the entrance sees their head and torso.
  for(const height of [.6,1.35,1.8])assert.equal(new THREE.Raycaster(new THREE.Vector3(0,height,3),new THREE.Vector3(0,0,-1),0,3).intersectObject(mesh).length,0);
  mesh.material.dispose();
  for(const part of ['body','legs','head','left-arm','right-arm'] as const){
   const body=voxelGeometry(merchantBodyRecipe(kind,part));assert.ok(body.index!.count/3<1300);
   assert.ok([...body.getAttribute('position').array].every(Number.isFinite));
  }
 }
});

test('merchant visuals reuse geometry across checkpoint replacement and cull far posts',()=>{
 const world:EconomyWorld={version:1,day:1,merchants:kinds.map((kind,index)=>trader(kind,index))},view=new MerchantsView();
 view.update(world,{x:0,z:5},0);view.root.updateMatrixWorld(true);
 const roots=[...view.root.children];assert.equal(roots.length,4);
 let meshes=0,lights=0;view.root.traverse(node=>{if(node instanceof THREE.Mesh)meshes++;if(node instanceof THREE.Light)lights++;});
 assert.ok(meshes<=32);assert.equal(lights,0);
 for(let i=1;i<60;i++)view.update(JSON.parse(JSON.stringify(world)),{x:0,z:5},i/60);
 assert.deepEqual(view.root.children,roots);
 view.update(world,{x:300,z:300},2);assert.ok(roots.every(root=>!root.visible));
 world.merchants[0]={...world.merchants[0],x:300,z:300,angle:Math.PI/2};view.update(world,{x:300,z:303},3);
 assert.equal(roots[0].visible,true);assert.equal(roots[0].position.x,300);assert.equal(roots[0].rotation.y,Math.PI/2);
 view.update({...world,merchants:world.merchants.slice(1)},{x:0,z:0},4);assert.equal(view.root.children.length,3);
 const second=new MerchantsView();second.update(world,{x:0,z:0},0);
 const shared=(view.root.children[0].children[0] as THREE.Mesh).geometry;
 assert.equal(shared,(second.root.children[1].children[0] as THREE.Mesh).geometry);
 view.dispose();assert.equal(view.root.children.length,0);assert.ok(shared.index!.count>0);
 second.dispose();
});

test('merchant collisions rotate with the camp and leave its front approach clear',()=>{
 for(const kind of kinds)for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const merchant={...trader(kind),x:140,y:.25,z:160,angle},boxes=merchantObstacles(merchant);
  assert.equal(new Set(boxes.map(b=>b.id)).size,boxes.length);
  const npc=boxes.find(b=>b.id===`merchant-${merchant.id}-npc`)!;
  assert.equal(npc.x,merchant.x);assert.equal(npc.z,merchant.z);assert.equal(npc.bottom,.25);
  const table=boxes.find(b=>b.id.endsWith('-table'))!;
  assert.ok(Math.abs(table.x-(140-1.45*Math.sin(angle)))<1e-9);
  assert.ok(Math.abs(table.z-(160-1.45*Math.cos(angle)))<1e-9);
  assert.equal(table.h,1.1);
  const front={x:140+Math.sin(angle)*1.5,z:160+Math.cos(angle)*1.5};
  assert.ok(boxes.every(b=>Math.abs(front.x-b.x)>b.w/2+.25||Math.abs(front.z-b.z)>b.d/2+.25));
 }
});
