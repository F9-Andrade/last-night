import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ConstructionView,structureRecipe} from '../src/render/construction-view.ts';
import {voxelGeometry} from '../src/render/voxel.ts';
import type {Simulation} from '../src/game/simulation.ts';
import type {Structure,StructureKind} from '../src/game/construction.ts';

function surface(kind:StructureKind,tier=0,leaf=false){
 const mesh=new THREE.Mesh(voxelGeometry(structureRecipe(kind,tier,leaf)),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 mesh.updateMatrixWorld();return mesh;
}
function ray(mesh:THREE.Object3D,x:number,y:number){
 return new THREE.Raycaster(new THREE.Vector3(x,y,-4),new THREE.Vector3(0,0,1),0,8).intersectObject(mesh);
}
test('walls remain full-height and fortified windows keep their physical firing aperture',()=>{
 for(let tier=0;tier<3;tier++){
  const wall=surface('wall',tier),window=surface('window',tier);
  assert.equal(wall.geometry.boundingBox!.max.y,3);
  assert.ok(ray(wall,0,2.7).length>0);
  assert.equal(ray(window,0,1.7).length,0);
  assert.equal(ray(window,.6,1.7).length,0);
  assert.ok(ray(window,1.2,1.7).length>0);
  assert.ok(ray(window,0,.8).length>0);
 }
});
test('door leaf turns around the left hinge and leaves the opening unobstructed',()=>{
 for(let tier=0;tier<3;tier++){
  const root=new THREE.Group(),body=surface('door',tier),pivot=new THREE.Group();
  pivot.position.x=-.57;pivot.add(surface('door',tier,true));root.add(body,pivot);root.updateMatrixWorld(true);
  assert.ok(ray(root,0,1.7).length>0);
  pivot.rotation.y=Math.PI/2;root.updateMatrixWorld(true);
  assert.equal(ray(root,0,1.7).length,0);
 }
});
test('stair treads match the fifteen authoritative twenty-centimetre steps',()=>{
 const mesh=surface('stairs');
 for(let step=0;step<15;step++){
  const hits=new THREE.Raycaster(new THREE.Vector3(0,8,-1.4+step*.2),new THREE.Vector3(0,-1,0),0,10).intersectObject(mesh);
  assert.ok(hits.length>0);assert.ok(Math.abs(hits[0].point.y-(step+1)*.2)<.0001);
 }
});
test('a full construction budget uses one wall batch and removes stale instances',()=>{
 const scene=new THREE.Scene(),view=new ConstructionView(scene);
 const structures:Structure[]=Array.from({length:192},(_,id)=>({id,kind:'wall',x:0,z:0,level:0,rotation:0,hp:300,tier:0,open:false,revision:0}));
 const sim={crafting:{structures},player:{x:0,z:0},gameOver:false} as unknown as Simulation;
 view.update(sim,undefined,.016);
 assert.deepEqual(view.metrics(),{batches:1,instances:192,capacity:192});
 const mesh=scene.getObjectByName('construction-wall:0:false') as THREE.InstancedMesh;
 assert.equal(mesh.count,192);
 sim.crafting.structures=[];view.update(sim,undefined,.016);
 assert.equal(mesh.count,0);assert.equal(mesh.visible,false);
});
test('door visual interpolates across frames instead of teleporting to its open pose',()=>{
 const scene=new THREE.Scene(),view=new ConstructionView(scene);
 const door:Structure={id:1,kind:'door',x:0,z:0,level:0,rotation:0,hp:280,tier:0,open:false,revision:0};
 const sim={crafting:{structures:[door]},player:{x:0,z:0},gameOver:false} as unknown as Simulation;
 view.update(sim,undefined,.016);door.open=true;view.update(sim,undefined,1/60);
 const mesh=scene.getObjectByName('construction-door:0:true') as THREE.InstancedMesh,matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
 assert.ok(matrix.elements[0]>.8&&matrix.elements[0]<1);
 for(let i=0;i<100;i++)view.update(sim,undefined,1/60);
 mesh.getMatrixAt(0,matrix);assert.ok(Math.abs(matrix.elements[0])<.001);
});


test('construction reuses unchanged uploads and its frustum bounds follow edits and checkpoint replacement',()=>{
 const scene=new THREE.Scene(),view=new ConstructionView(scene);
 const wall:Structure={id:1,kind:'wall',x:0,z:0,level:0,rotation:0,hp:300,tier:0,open:false,revision:0};
 const sim={crafting:{structures:[wall]},player:{x:0,z:0},gameOver:false} as unknown as Simulation;
 view.update(sim,undefined,1/60);
 const mesh=scene.getObjectByName('construction-wall:0:false') as THREE.InstancedMesh;
 const version=mesh.instanceMatrix.version,center=mesh.boundingSphere!.center.clone();
 assert.equal(mesh.frustumCulled,true);
 for(let i=0;i<60;i++)view.update(sim,undefined,1/60);
 assert.equal(mesh.instanceMatrix.version,version);
 // A same-content coop snapshot and nonlethal HP loss do not change geometry.
 sim.crafting.structures=[{...wall,hp:280}];view.update(sim,undefined,1/60);assert.equal(mesh.instanceMatrix.version,version);
 sim.crafting.structures[0].x=6;view.update(sim,undefined,1/60);
 assert.equal(mesh.instanceMatrix.version,version+1);assert.ok(Math.abs(mesh.boundingSphere!.center.x-center.x-6)<1e-6);
 const camera=new THREE.PerspectiveCamera(60,1,.1,50);camera.position.set(6,1.5,-8);camera.lookAt(6,1.5,0);camera.updateMatrixWorld();
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 mesh.updateMatrixWorld();assert.equal(frustum.intersectsObject(mesh),true);
 camera.lookAt(6,1.5,-20);camera.updateMatrixWorld();frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));assert.equal(frustum.intersectsObject(mesh),false);
 sim.player.z=110;view.update(sim,undefined,1/60);assert.equal(mesh.visible,false);
 sim.player.z=0;view.update(sim,undefined,1/60);assert.equal(mesh.visible,true);
 sim.crafting.structures[0].kind='window';view.update(sim,undefined,1/60);assert.equal(mesh.visible,false);
 assert.equal((scene.getObjectByName('construction-window:0:false') as THREE.InstancedMesh).count,1);
});

test('animated door bounds contain the entire leaf throughout opening and closing',()=>{
 const scene=new THREE.Scene(),view=new ConstructionView(scene);
 const door:Structure={id:1,kind:'door',x:0,z:0,level:1,rotation:1,hp:280,tier:0,open:false,revision:0};
 const sim={crafting:{structures:[door]},player:{x:0,z:0},gameOver:false} as unknown as Simulation;
 const matrix=new THREE.Matrix4(),sphere=new THREE.Sphere();
 for(let frame=0;frame<120;frame++){
  if(frame===1)door.open=true;if(frame===65)door.open=false;
  view.update(sim,undefined,1/60);
  const mesh=scene.getObjectByName('construction-door:0:true') as THREE.InstancedMesh;
  mesh.getMatrixAt(0,matrix);sphere.copy(mesh.geometry.boundingSphere!).applyMatrix4(matrix);
  assert.ok(mesh.boundingSphere!.center.distanceTo(sphere.center)+sphere.radius<=mesh.boundingSphere!.radius+1e-6);
 }
});
