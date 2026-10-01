import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {consumptionMotion,smoothStage,type ConsumptionMotion} from '../src/render/nutrition-motion.ts';
import {solveArm} from '../src/render/melee-motion.ts';
import {createFoodVisual} from '../src/render/food-assets.ts';
import {foodKeys} from '../src/game/nutrition.ts';
const pose=():ConsumptionMotion=>({show:0,open:0,lift:0,scoop:0,bite:0,settle:0});
test('consuming opens before eating, keeps bounded curves and returns all hands to rest',()=>{
 for(const [drink,packet] of [[false,false],[true,false],[false,true]]){
  const m=pose();
  for(let frame=-10;frame<=1010;frame++){
   const p=frame/1000;assert.equal(consumptionMotion(p,drink,packet,m),m,'output object is reused');
   for(const value of Object.values(m))assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
   if(m.lift>0||m.scoop>0||m.bite>0)assert.equal(m.open,1,'do not eat through a closed lid');
   if(p<=0||p>=1){assert.equal(m.show,0);assert.equal(m.lift,0);assert.equal(m.scoop,0);assert.equal(m.bite,0);}
  }
  consumptionMotion(.65,drink,packet,m);assert.equal(drink||packet?m.lift:m.bite,1);
 }
 assert.equal(smoothStage(.1,.2,.3),0);assert.equal(smoothStage(.4,.2,.3),1);
});
test('every meal pose keeps both fixed-length arms connected at shoulder and elbow',()=>{
 const m=pose(),shoulder=new THREE.Vector3(),wrist=new THREE.Vector3(),elbow=new THREE.Vector3();
 for(const [drink,packet] of [[false,false],[true,false],[false,true]])for(let frame=0;frame<=300;frame++){
  const p=frame/300;consumptionMotion(p,drink,packet,m);const opening=smoothStage(p,.12,.21)*(1-smoothStage(p,.29,.39));
  for(const side of [-1,1]){
   shoulder.set(side*.31,-.43,.13);
   if(side===-1)wrist.set(-.17+m.lift*.07,-.338-(1-m.show)*.34+m.lift*.16,-.355+m.lift*.19);
   else wrist.set(.23-opening*.27-m.scoop*.28-m.bite*.11,-.33-(1-m.show)*.34+opening*.18+m.scoop*.13+m.bite*.035,-.38-opening*.02-m.scoop*.005+m.bite*.035);
   solveArm(shoulder,wrist,elbow,side);
   assert.ok(Math.abs(shoulder.distanceTo(elbow)-.38)<1e-9);
   assert.ok(Math.abs(wrist.distanceTo(elbow)-.425)<1e-9);
   assert.ok(elbow.y<shoulder.y+.15,'elbow stays below the shoulder');
  }
 }
});
test('provisions share geometry, stay voxel and keep realistic handheld dimensions',()=>{
 for(const id of foodKeys){
  const a=createFoodVisual(id),b=createFoodVisual(id),bounds=new THREE.Box3().setFromObject(a.root),size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.x<=.2&&size.y<=.31&&size.z<=.2,`${id} fits a hand`);
  let triangles=0,meshes=0;
  a.root.traverse(object=>{if(object instanceof THREE.Mesh){assert.ok(object.geometry.userData.voxelCount>0);triangles+=(object.geometry.index?.count??0)/3;meshes++;}});
  assert.ok(triangles<12000,`${id} triangle budget (${triangles})`);assert.ok(meshes<=4);
  assert.equal((a.root.children[0] as THREE.Mesh).geometry,(b.root.children[0] as THREE.Mesh).geometry);
 }
});
