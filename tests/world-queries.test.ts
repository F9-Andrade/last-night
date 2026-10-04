import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUILDINGS,OBSTACLES,WORLD_LIMIT,collides,floorHeight,rayBox,rayWorld,wallDistance} from '../src/game/world.ts';
import type {Obstacle,Vec2,Vec3} from '../src/game/world.ts';
import {CITY_SITES} from '../src/game/city.ts';

// Unindexed oracle deliberately includes the entire authored world. The optimized
// broad phase must preserve contacts at bin edges, roof edges and dynamic pieces.
const ceilings:Obstacle[]=[
 ...[...BUILDINGS.filter(b=>b.kind!=='base'),...CITY_SITES.filter(s=>s.kind!=='cemetery')].map(b=>({...b,bottom:b.h,h:.25})),
 ...CITY_SITES.filter(s=>s.kind==='quarantine').flatMap(s=>[-8,8].map(x=>({x:s.x+x,z:s.z-4,w:6,d:5,bottom:1.85,h:.3}))),
];
const extra:Obstacle[]=[{x:1,z:3,w:3,d:.2,h:3,bottom:.22},{x:-8,z:16,w:1.5,d:1.5,h:1.1,bottom:3.22},{x:8,z:8,w:3,d:3,h:.2,bottom:3.02}];
function referenceRay(o:Vec3,d:Vec3,range:number){
 let nearest=range;for(const box of [...OBSTACLES,...extra,...ceilings])nearest=Math.min(nearest,rayBox(o,d,box,range));
 if(d.y<0)nearest=Math.min(nearest,Math.max(0,(o.y-floorHeight(o))/-d.y));return nearest;
}
function referenceCollision(p:Vec2,radius:number){
 if(Math.abs(p.x)>WORLD_LIMIT-radius||Math.abs(p.z)>WORLD_LIMIT-radius)return true;
 return [...OBSTACLES,...extra].some(o=>{const x=Math.max(Math.abs(p.x-o.x)-o.w/2,0),z=Math.max(Math.abs(p.z-o.z)-o.d/2,0);return x*x+z*z<radius*radius;});
}
function referenceWall(origin:Vec2,dir:Vec2,range:number,radius:number){
 let nearest=range;
 for(const o of [...OBSTACLES,...extra]){
  let near=0,far=range;
  for(const axis of ['x','z'] as const){const half=(axis==='x'?o.w:o.d)/2+radius;
   if(Math.abs(dir[axis])<1e-8){if(origin[axis]<o[axis]-half||origin[axis]>o[axis]+half)far=-1;}
   else {const a=(o[axis]-half-origin[axis])/dir[axis],b=(o[axis]+half-origin[axis])/dir[axis];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
  }
  if(near<=far&&far>=0)nearest=Math.min(nearest,near);
 }
 return nearest;
}
let seed=913;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
test('spatial collision queries match the full world across cells and map boundaries',()=>{
 const points=[{x:8,z:8},{x:-8,z:16},{x:WORLD_LIMIT,z:0},{x:-WORLD_LIMIT+.45,z:0}];
 for(let i=0;i<1500;i++)points.push({x:(random()-.5)*WORLD_LIMIT*2,z:(random()-.5)*WORLD_LIMIT*2});
 for(const p of points)for(const radius of [.45,.7,2])assert.equal(collides(p,radius,extra),referenceCollision(p,radius),JSON.stringify({p,radius}));
});
test('indexed 3D queries preserve roofs, quarantine ceilings, floors and dynamic upper-storey contacts',()=>{
 const origins:Vec3[]=[{x:1,y:1.94,z:7},{x:8,y:3.22,z:8},{x:-8,y:4,z:16},...CITY_SITES.map(s=>({x:s.x,y:1.9,z:s.z})),...CITY_SITES.filter(s=>s.kind==='quarantine').map(s=>({x:s.x-8,y:1.3,z:s.z-4}))];
 for(let i=0;i<700;i++)origins.push({x:(random()-.5)*WORLD_LIMIT*2,y:random()*12,z:(random()-.5)*WORLD_LIMIT*2});
 for(let i=0;i<origins.length;i++){
  const angle=random()*Math.PI*2,pitch=(random()-.5)*Math.PI,d=i%4===0?{x:0,y:1,z:0}:i%4===1?{x:0,y:-1,z:0}:{x:Math.sin(angle)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(angle)*Math.cos(pitch)};
  const range=i%3===0?3.5:i%3===1?15:90;
  assert.equal(rayWorld(origins[i],d,range,extra),referenceRay(origins[i],d,range),JSON.stringify({o:origins[i],d,range}));
 }
});
test('2D broad phase preserves pursuit, clearance and noise rays against the full world',()=>{
 const points=[{x:8,z:8},{x:-8,z:16},{x:1,z:7},...CITY_SITES.map(s=>({x:s.x,z:s.z}))];
 for(let i=0;i<700;i++)points.push({x:(random()-.5)*WORLD_LIMIT*2,z:(random()-.5)*WORLD_LIMIT*2});
 for(let i=0;i<points.length;i++){
  const a=random()*Math.PI*2,dir=i%4===0?{x:0,z:1}:i%4===1?{x:-1,z:0}:{x:Math.sin(a),z:Math.cos(a)},range=i%3===0?1:i%3===1?20:90;
  for(const radius of [0,.49])assert.equal(wallDistance(points[i],dir,range,extra,radius),referenceWall(points[i],dir,range,radius),JSON.stringify({p:points[i],dir,range,radius}));
 }
});
