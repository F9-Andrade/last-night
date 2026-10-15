import test from 'node:test';
import assert from 'node:assert/strict';
import {subtractRectangles} from '../src/game/surface-layout.ts';
import type {SurfaceRect} from '../src/game/surface-layout.ts';
import {ROADS} from '../src/game/districts.ts';
import {CITY_SITES} from '../src/game/city.ts';

const area=(rs:SurfaceRect[])=>rs.reduce((sum,r)=>sum+r.w*r.d,0);
const overlap=(a:SurfaceRect,b:SurfaceRect)=>Math.abs(a.x-b.x)<(a.w+b.w)/2-1e-7&&Math.abs(a.z-b.z)<(a.d+b.d)/2-1e-7;
function disjoint(rs:SurfaceRect[]){for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++)assert.equal(overlap(rs[i],rs[j]),false);}

test('a sidewalk is cut at the intersection even when only its end crosses the street',()=>{
 const sidewalk={x:8,z:5,w:15.9,d:1.85},road={x:0,z:0,w:7,d:200};
 assert.ok(Math.abs(sidewalk.x-road.x)>road.w/2); // Old centre-only validation accepted this slab.
 const pieces=subtractRectangles(sidewalk,[road]);
 assert.equal(pieces.length,1);assert.ok(pieces.every(p=>!overlap(p,road)));
 assert.ok(Math.abs(area(pieces)-(15.95-3.5)*1.85)<1e-8);disjoint(pieces);
});

test('intersecting road exclusions preserve all remaining ground without duplicate faces',()=>{
 const plot={x:0,z:0,w:20,d:20},roads=[{x:0,z:0,w:4,d:30},{x:0,z:0,w:30,d:6}];
 const pieces=subtractRectangles(plot,roads);assert.equal(pieces.length,4);
 assert.equal(area(pieces),16*14);disjoint(pieces);
 assert.ok(pieces.every(p=>roads.every(r=>!overlap(p,r))));
 assert.deepEqual(subtractRectangles(plot,[...roads,...roads]),pieces);
});

test('courtyards retain their perimeter but cannot cover an interior floor',()=>{
 const plot={x:40,z:-30,w:14,d:12},room={x:40,z:-30,w:10,d:8};
 const pieces=subtractRectangles(plot,[room],.025);
 assert.ok(pieces.every(p=>!overlap(p,room)));disjoint(pieces);
 assert.ok(Math.abs(area(pieces)-(14*12-10.05*8.05))<1e-8);
 assert.deepEqual(subtractRectangles(room,[plot]),[]);
 assert.equal(subtractRectangles(plot,[{x:54,z:-30,w:14,d:12}]).length,1);
});

test('every generated sidewalk segment and landmark apron leaves the full road network clear',()=>{
 const surfaces:SurfaceRect[]=CITY_SITES.map(s=>({x:s.x,z:s.z,w:s.w+7,d:s.d+7}));
 for(const road of ROADS)for(let n=-Math.max(road.w,road.d)/2+8;n<Math.max(road.w,road.d)/2-8;n+=16)for(const side of [-1,1]){
  const horizontal=road.w>road.d;
  surfaces.push({x:horizontal?road.x+n:road.x+side*(road.w/2+1),z:horizontal?road.z+side*(road.d/2+1):road.z+n,w:horizontal?15.9:1.85,d:horizontal?1.85:15.9});
 }
 let cut=0;
 for(const surface of surfaces){const pieces=subtractRectangles(surface,ROADS,.025);for(const p of pieces)for(const road of ROADS)assert.equal(overlap(p,road),false);if(area(pieces)<surface.w*surface.d-.001)cut++;disjoint(pieces);}
 assert.ok(cut>100,`expected junction and apron corrections, got ${cut}`);
});
