import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {solveArm,strikeEnvelope} from '../src/render/melee-motion.ts';
test('punches return to guard and keep upper/forearm lengths through every sampled pose',()=>{
 for(const side of [-1,1])for(let frame=0;frame<=144;frame++){
  const strike=strikeEnvelope(1-frame/144),shoulder=new THREE.Vector3(side*.31,-.43,.13),wrist=new THREE.Vector3(side*(.23-strike*.14),-.29+strike*.055,-.31-strike*.29),elbow=new THREE.Vector3();solveArm(shoulder,wrist,elbow,side);
  assert.ok(Math.abs(shoulder.distanceTo(elbow)-.38)<1e-9);assert.ok(Math.abs(wrist.distanceTo(elbow)-.425)<1e-9);assert.ok(elbow.y<shoulder.y+.15);
 }
 assert.equal(strikeEnvelope(0),0);assert.equal(strikeEnvelope(1),0);assert.ok(strikeEnvelope(.75)>.99);
});
test('unreachable hand targets cannot detach or stretch the arm',()=>{const s=new THREE.Vector3(),w=new THREE.Vector3(0,0,-5),e=new THREE.Vector3();solveArm(s,w,e,1);assert.ok(w.length()<.805);assert.ok(Math.abs(s.distanceTo(e)-.38)<1e-9);assert.ok(Math.abs(w.distanceTo(e)-.425)<1e-9);});
