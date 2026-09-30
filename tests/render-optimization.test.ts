import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {StaticChunk,VisibleGroup} from '../src/render/static-chunk.ts';
test('immutable chunks preserve world transforms, visibility and instances without repeated matrix work',()=>{
 const scene=new THREE.Scene(),root=new StaticChunk(),mesh=new THREE.Mesh(new THREE.BoxGeometry());root.position.set(123,0,-456);mesh.position.set(2,3,4);root.add(mesh);scene.add(root);root.freeze();const expected=mesh.matrixWorld.toArray();let updates=0;mesh.updateMatrixWorld=()=>{updates++;};for(let i=0;i<10;i++){root.visible=i%2===0;scene.updateMatrixWorld();}assert.deepEqual(mesh.matrixWorld.toArray(),expected);assert.equal(updates,0);assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).toArray(),[125,3,-452]);
});

test('hidden mutable groups catch up to their current transform when revealed',()=>{
 const scene=new THREE.Scene(),root=new VisibleGroup(),mesh=new THREE.Mesh();scene.add(root);root.add(mesh);scene.updateMatrixWorld();root.visible=false;root.position.x=42;mesh.position.y=3;scene.updateMatrixWorld();assert.equal(mesh.matrixWorld.elements[12],0);root.visible=true;scene.updateMatrixWorld();assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).toArray(),[42,3,0]);
});
