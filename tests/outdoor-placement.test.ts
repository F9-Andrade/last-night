import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {OutdoorPlacement,decorationFootprint,outdoorPlacement} from '../src/render/outdoor-placement.ts';
import {overlapsRect} from '../src/game/placement.ts';
import {configureWorld} from '../src/game/world-layout.ts';

test('rotated compound decorations reserve their full footprint, not only the origin',()=>{
 const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,8));
 group.position.set(4,0,5);group.rotation.y=Math.PI/2;mesh.position.z=3;group.add(mesh);
 const footprint=decorationFootprint(group,{x:100,z:200});
 assert.ok(Math.abs(footprint.x-107)<1e-6);assert.ok(Math.abs(footprint.z-205)<1e-6);
 assert.ok(Math.abs(footprint.w-8)<1e-6);assert.ok(Math.abs(footprint.d-2)<1e-6);
 const blocked={x:110,z:205,w:2,d:3};assert.equal(overlapsRect(footprint,blocked),true);
 const planner=new OutdoorPlacement([blocked],[],300);planner.place(group,{x:100,z:200});
 assert.equal(overlapsRect(decorationFootprint(group,{x:100,z:200}),blocked,.1),false);
 mesh.geometry.dispose();
});

test('decorations preserve road clearance and cannot stack on an already placed prop',()=>{
 const road={x:0,z:0,w:8,d:100},wall={x:8,z:0,w:2,d:10};
 const planner=new OutdoorPlacement([wall],[road],100),positions=[];
 for(let i=0;i<12;i++)positions.push(planner.position({x:5,z:0,w:2,d:2},true));
 for(const [i,p]of positions.entries()){
  assert.equal(overlapsRect(p,road,.1),false);assert.equal(overlapsRect(p,wall,.1),false);
  assert.ok(positions.slice(i+1).every(other=>!overlapsRect(p,other,.1)));
 }
 assert.throws(()=>new OutdoorPlacement([{x:0,z:0,w:200,d:200}],[],20).position({x:0,z:0,w:2,d:2}));
});

test('reloading a world resets scene reservations and includes saved merchant camps',()=>{
 const scene=new THREE.Scene();
 try{
  configureWorld(813,2);const first=outdoorPlacement(scene),point={x:570,z:570,w:1,d:1};
  first.position(point);assert.equal(outdoorPlacement(scene),first);
  configureWorld(9021,2);const second=outdoorPlacement(scene);assert.notEqual(second,first);assert.equal(second.placements.length,0);
  const camp={x:570,z:570,w:10.6,d:10.6};const restored=outdoorPlacement(scene,[camp]);
  assert.notEqual(restored,second);assert.equal(overlapsRect(restored.position(point),camp,.1),false);
 }finally{configureWorld(0,0);}
});
