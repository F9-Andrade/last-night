import {planUrban} from './urban-layout.ts';
import {BASE_LOOT_POINTS} from './base-loot.ts';
import {FACILITIES,EVENT_POINTS} from './expedition.ts';
import { hasInterior, roomObstacles } from './interiors.ts';
import { CITY_LIMIT, CITY_SITES, siteObstacles } from './city.ts';
import { REGIONS, ENCOUNTERS, OUTER_TREE_OFFSET, OUTER_HOUSES, OUTER_CARS, WAREHOUSES, ROADS, CARGO_OBSTACLES, PLAZA_MONUMENT } from './districts.ts';
export interface Vec2 { x: number; z: number }
export interface Obstacle { x: number; z: number; w: number; d: number; h?:number; bottom?:number }
export interface Building extends Obstacle { kind: 'base' | 'market' | 'hospital' | 'police' | 'house'; label: string; color: number; h: number }
export const WORLD_LIMIT = CITY_LIMIT;
export const BASE = { x: 1, z: 2 };
export const GAS_STATION = {x:-27,z:29};
export const BUILDINGS: Building[] = [
  { kind: 'base', label: 'ABRIGO 07', x: 1, z: -4, w: 9, d: 8, h: 3.7, color: 0xc7b99b },
  { kind: 'market', label: 'MERCADO', x: -25, z: -6, w: 12, d: 10, h: 4.5, color: 0xb3c3a0 },
  { kind: 'hospital', label: 'SANTA LUZ', x: 25, z: -24, w: 13, d: 11, h: 6, color: 0xd9d2b7 },
  { kind: 'police', label: 'POLÍCIA', x: 25, z: 26, w: 12, d: 10, h: 4.8, color: 0x77969d },
  { kind: 'house', label: '', x: -26, z: -27, w: 9, d: 8, h: 3.5, color: 0xba8a71 },
  { kind: 'house', label: '', x: 0, z: -27, w: 10, d: 8, h: 3.8, color: 0x8ba6a0 },
  { kind: 'house', label: '', x: 27, z: -3, w: 8, d: 9, h: 3.8, color: 0xc2a275 },
  { kind: 'house', label: '', x: 1, z: 29, w: 10, d: 9, h: 3.6, color: 0x9ea985 },
];
BUILDINGS.push(...OUTER_HOUSES.map(([x,z,color],i)=>({kind:'house' as const,label:'',x,z,color,w:10,d:8,h:3.8+(i%4===1?2.7:0)})));
export const CARS = [
  { x: -12, z: -9, angle: .12, color: 0xba744f },
  { x: -11, z: 25, angle: -.18, color: 0x809da4 },
  { x: 12, z: 14, angle: 1.42, color: 0xcabf94 },
  { x: -27, z: 14, angle: 1.72, color: 0x5f8582 },
  { x: 15, z: -24, angle: .08, color: 0xb3b7a6 },
  { x: 30, z: 12, angle: 1.38, color: 0x796f63 },
];
CARS.push(...OUTER_CARS);
export const FENCES: Obstacle[] = [
  { x: -5.2, z: 3, w: .4, d: 12 }, { x: 7.2, z: 3, w: .4, d: 12 },
  { x: -3.8, z: 9, w: 3, d: .4 }, { x: 5.8, z: 9, w: 3, d: .4 },
];
export const TREE_POSITIONS = [[-7,-10],[8,-10],[8,-29],[-20,-33],[34,-32],[35,-10],[21,5],[-33,4],[-19,4],[8,24],[-5,35],[35,35],[-34,34],[-33,-18],[20,-34],[34,22],[-6,-22],[-34,-34],[-3,-12],[8.8,1]];
const createTreeTrunks=():Obstacle[]=>[...OUTER_HOUSES.map(([x,z])=>({x:x+OUTER_TREE_OFFSET.x,z:z+OUTER_TREE_OFFSET.z,w:.58,d:.58,h:3.8})),...REGIONS.slice(2,12).filter(r=>r.icon==='E'||r.name==='TRIAGEM EXTERNA').flatMap(r=>[[-9,-8],[9,-8],[-9,9],[9,9]].map(([x,z])=>({x:r.x+x,z:r.z+z,w:.58,d:.58,h:3.8}))),...TREE_POSITIONS.map(([x,z])=>({x,z,w:.58,d:.58,h:3.8})),...CITY_SITES.flatMap(s=>Array.from({length:6},(_,i)=>({x:s.x+(i%2?1:-1)*(s.w/2+5),z:s.z-s.d/2+i*s.d/5,w:.6,d:.6,h:3.8})))];
export const TREE_TRUNKS:Obstacle[]=createTreeTrunks();
const createObstacles=():Obstacle[]=>[
  ...BUILDINGS.filter(b=>b.kind!=='base').flatMap(b=>hasInterior(b)?roomObstacles(b):[b]), ...WAREHOUSES, ...CARGO_OBSTACLES.map(o=>({...o,h:2.4})), {...PLAZA_MONUMENT,h:3},
  ...CARS.map(c => ({ h:1.75, x: c.x, z: c.z, w: Math.abs(Math.sin(c.angle)) * 3.7 + Math.abs(Math.cos(c.angle)) * 1.8, d: Math.abs(Math.cos(c.angle)) * 3.7 + Math.abs(Math.sin(c.angle)) * 1.8 })),
  { x: GAS_STATION.x, z: GAS_STATION.z, w: 10, d: 5 },
  { x: GAS_STATION.x+2, z: GAS_STATION.z-7, w: 1.3, d: 1.3 }, { x: GAS_STATION.x+6, z: GAS_STATION.z-7, w: 1.3, d: 1.3 },
  ...CITY_SITES.flatMap(siteObstacles),

];
export const OBSTACLES:Obstacle[]=createObstacles();
const PLANNING_OBSTACLES: Obstacle[] = [
  ...BUILDINGS.flatMap(b=>hasInterior(b)?roomObstacles(b):[b]), ...FENCES.map(o=>({...o,h:1.45})), ...WAREHOUSES, ...CARGO_OBSTACLES.map(o=>({...o,h:2.4})), {...PLAZA_MONUMENT,h:3},
  ...CARS.map(c => ({ h:1.75, x: c.x, z: c.z, w: Math.abs(Math.sin(c.angle)) * 3.7 + Math.abs(Math.cos(c.angle)) * 1.8, d: Math.abs(Math.cos(c.angle)) * 3.7 + Math.abs(Math.sin(c.angle)) * 1.8 })),
  { x: GAS_STATION.x, z: GAS_STATION.z, w: 10, d: 5 },
  { x: GAS_STATION.x+2, z: GAS_STATION.z-7, w: 1.3, d: 1.3 }, { x: GAS_STATION.x+6, z: GAS_STATION.z-7, w: 1.3, d: 1.3 },
  ...CITY_SITES.flatMap(siteObstacles),
  ...TREE_TRUNKS,
];
// Keep the authored urban layout stable as the shelter and harvestable trees become dynamic.
export const URBAN=planUrban(PLANNING_OBSTACLES,ROADS,[...BASE_LOOT_POINTS,...FACILITIES,...EVENT_POINTS,...ENCOUNTERS],CITY_SITES);
OBSTACLES.push(...URBAN.obstacles);
const SPATIAL_CELL=8;
function indexObstacles(obstacles:Obstacle[]):Map<string,Obstacle[]>{
 const bins=new Map<string,Obstacle[]>();
 for(const o of obstacles)for(let x=Math.floor((o.x-o.w/2)/SPATIAL_CELL);x<=Math.floor((o.x+o.w/2)/SPATIAL_CELL);x++)for(let z=Math.floor((o.z-o.d/2)/SPATIAL_CELL);z<=Math.floor((o.z+o.d/2)/SPATIAL_CELL);z++){
  const key=`${x}:${z}`,bucket=bins.get(key)??[];bucket.push(o);bins.set(key,bucket);
 }
 return bins;
}
let obstacleBins=indexObstacles(OBSTACLES);
const emptyObstacles:Obstacle[]=[];
// These authored ceilings do not change during a match. Build their geometry and
// spatial lookup once, rather than recreating every city roof for each aim ray.
const createRoofs=():Obstacle[]=>[
 ...[...BUILDINGS.filter(b=>b.kind!=='base'),...CITY_SITES.filter(s=>s.kind!=='cemetery')].map(b=>({x:b.x,z:b.z,w:b.w,d:b.d,bottom:b.h,h:.25})),
 ...CITY_SITES.filter(s=>s.kind==='quarantine').flatMap(site=>[-8,8].map(x=>({x:site.x+x,z:site.z-4,w:6,d:5,bottom:1.85,h:.3}))),
];
let roofBins=indexObstacles(createRoofs());
function nearbyObstacles(minX:number,minZ:number,maxX:number,maxZ:number,bins=obstacleBins):Obstacle[]{
  const x0=Math.floor(minX/SPATIAL_CELL),x1=Math.floor(maxX/SPATIAL_CELL),z0=Math.floor(minZ/SPATIAL_CELL),z1=Math.floor(maxZ/SPATIAL_CELL);
  // Most movement/interaction queries fit in one cell; its array is read-only to callers.
  if(x0===x1&&z0===z1)return bins.get(`${x0}:${z0}`)??emptyObstacles;
  const found=new Set<Obstacle>();
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const o of bins.get(`${x}:${z}`)??emptyObstacles)found.add(o);
  return [...found];
}
/** Called only when opening a world: rebuild every static query from the same layout. */
export function rebuildWorldCaches():void {
 TREE_TRUNKS.splice(0,TREE_TRUNKS.length,...createTreeTrunks());
 OBSTACLES.splice(0,OBSTACLES.length,...createObstacles(),...URBAN.obstacles);
 obstacleBins=indexObstacles(OBSTACLES);roofBins=indexObstacles(createRoofs());
 staticLinks.clear();staticWalkable.clear();dynamicMasks.clear();
}
export const SUPPLIES = [
  { x: -2, z: 3, kind: 'ammo' as const },
  { x: -22, z: .5, kind: 'ammo' as const },
  { x: 23, z: -17, kind: 'med' as const },
  { x: 23, z: 19, kind: 'ammo' as const },
  { x: -28, z: 24, kind: 'med' as const },
  { x: 3, z: -20.5, kind: 'ammo' as const },
];
export function collides(p: Vec2, radius = .45, extra: Obstacle[] = []): boolean {
  if (Math.abs(p.x) > WORLD_LIMIT - radius || Math.abs(p.z) > WORLD_LIMIT - radius) return true;
  const hits=(o:Obstacle)=>{
    const dx = Math.max(Math.abs(p.x - o.x) - o.w / 2, 0);
    const dz = Math.max(Math.abs(p.z - o.z) - o.d / 2, 0);
    return dx * dx + dz * dz < radius * radius;
  };
  for(const o of nearbyObstacles(p.x-radius,p.z-radius,p.x+radius,p.z+radius))if(hits(o))return true;
  for(const o of extra)if(hits(o))return true;
  return false;
}
export function move(p: Vec2, dx: number, dz: number, radius = .45, extra: Obstacle[] = [], height=0): void {
  const blocked=(v:Vec2)=>collides(v,radius,extra)||(height>0&&ceilingHeight(v,radius)-floorHeight(v)<height);
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
  for(let i=0;i<steps;i++){
    if (!blocked({ x: p.x + dx/steps, z: p.z })) p.x += dx/steps;
    if (!blocked({ x: p.x, z: p.z + dz/steps })) p.z += dz/steps;
  }
}
export function distance(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.z - b.z); }
/** Segment versus expanded AABB. Returns world-space distance to the first obstruction. */
export function wallDistance(origin: Vec2, dir: Vec2, range: number, extra: Obstacle[] = [], radius = 0): number {
  let nearest = range;
  const end={x:origin.x+dir.x*range,z:origin.z+dir.z*range};
  const minX=Math.min(origin.x,end.x)-radius,minZ=Math.min(origin.z,end.z)-radius,maxX=Math.max(origin.x,end.x)+radius,maxZ=Math.max(origin.z,end.z)+radius;
  const intersect=(o:Obstacle)=>{
    if(o.x+o.w/2<minX||o.x-o.w/2>maxX||o.z+o.d/2<minZ||o.z-o.d/2>maxZ)return;
    let near = 0, far = range;
    for (const axis of horizontalAxes) {
      const half = (axis === 'x' ? o.w : o.d) / 2 + radius;
      if (Math.abs(dir[axis]) < 1e-8) {
        if (origin[axis] < o[axis] - half || origin[axis] > o[axis] + half) far = -1;
      } else {
        const a = (o[axis] - half - origin[axis]) / dir[axis];
        const b = (o[axis] + half - origin[axis]) / dir[axis];
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      }
    }
    if (near <= far && far >= 0) nearest = Math.min(nearest, near);
  };
  for(const o of nearbyObstacles(minX,minZ,maxX,maxZ))intersect(o);
  for(const o of extra)intersect(o);
  return nearest;
}
const horizontalAxes=['x','z'] as const;

// Sparse one-meter navigation: populate only visited cells, not the entire 1.56 km² map.
const GRID = WORLD_LIMIT*2+2, ORIGIN=WORLD_LIMIT+.5;
const position=(n:number):Vec2=>({x:n%GRID-ORIGIN,z:Math.floor(n/GRID)-ORIGIN});
const node=(p:Vec2):number=>Math.max(0,Math.min(GRID-1,Math.round(p.z+ORIGIN)))*GRID+Math.max(0,Math.min(GRID-1,Math.round(p.x+ORIGIN)));
const staticLinks=new Map<number,number[]>(),staticWalkable=new Map<number,boolean>();
function walkable(n:number){let free=staticWalkable.get(n);if(free===undefined){free=!collides(position(n),.49);staticWalkable.set(n,free);}return free;}
function neighbors(n:number){let links=staticLinks.get(n);if(links)return links;links=[];const p=position(n);
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=n%GRID+dx,z=Math.floor(n/GRID)+dz,next=z*GRID+x;if(x<0||x>=GRID||z<0||z>=GRID||!walkable(next))continue;if(wallDistance(p,{x:dx,z:dz},1,[],.49)>=1)links.push(next);}
 if(staticLinks.size>80000){staticLinks.clear();staticWalkable.clear();}staticLinks.set(n,links);return links;
}
const dynamicMasks=new Map<string,Set<number>>();
function blockedCells(extra:Obstacle[]):Set<number>{
 const key=extra.map(b=>`${b.x}:${b.z}:${b.w}:${b.d}`).join('|');let cells=dynamicMasks.get(key);if(cells)return cells;cells=new Set();
 for(const b of extra)for(let z=Math.floor(b.z-b.d/2-.5+ORIGIN);z<=Math.ceil(b.z+b.d/2+.5+ORIGIN);z++)for(let x=Math.floor(b.x-b.w/2-.5+ORIGIN);x<=Math.ceil(b.x+b.w/2+.5+ORIGIN);x++){
  const n=z*GRID+x,p=position(n);if(x>=0&&x<GRID&&z>=0&&z<GRID&&Math.hypot(Math.max(0,Math.abs(p.x-b.x)-b.w/2),Math.max(0,Math.abs(p.z-b.z)-b.d/2))<.5)cells.add(n);
 }
 if(dynamicMasks.size>=16)dynamicMasks.clear();dynamicMasks.set(key,cells);return cells;
}
export function findPath(from: Vec2, to: Vec2, extra: Obstacle[] = []): Vec2[] {
  const direct=distance(from,to);
  if(direct>.01&&wallDistance(from,{x:(to.x-from.x)/direct,z:(to.z-from.z)/direct},direct,extra,.49)>=direct&&!collides(to,.49,extra))return Array.from({length:Math.ceil(direct/8)},(_,i)=>{const t=(i+1)/Math.ceil(direct/8);return {x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t};});
  // Restrict dynamic checks to this route's neighborhood; remote tables/trees do not
  // affect local pursuit. The static grid itself is shared between all actors.
  const margin=24,minX=Math.min(from.x,to.x)-margin,maxX=Math.max(from.x,to.x)+margin,minZ=Math.min(from.z,to.z)-margin,maxZ=Math.max(from.z,to.z)+margin;
  extra=extra.filter(b=>b.x+b.w/2>=minX&&b.x-b.w/2<=maxX&&b.z+b.d/2>=minZ&&b.z-b.d/2<=maxZ);
  const blocked=blockedCells(extra);const free=(n:number)=>!blocked.has(n)&&walkable(n);
  const connects = (p: Vec2, q: Vec2): boolean => {
    const steps = Math.max(1, Math.ceil(distance(p, q) / .15));
    for (let i = 1; i <= steps; i++) if (collides({ x: p.x + (q.x - p.x) * i / steps, z: p.z + (q.z - p.z) * i / steps }, .475, extra)) return false;
    return true;
  };
  const nearest = (p: Vec2): number => {
    const origin = node(p); let best = -1, bestDistance = Infinity;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const x = origin % GRID + dx, z = Math.floor(origin / GRID) + dz, n = z * GRID + x;
      if (x < 0 || x >= GRID || z < 0 || z >= GRID || !free(n)) continue;
      const q = position(n), d = distance(p, q);
      if (d < bestDistance && connects(p, q)) { best = n; bestDistance = d; }
    }
    return best;
  };
  const start = nearest(from), goal = nearest(to); if (start < 0 || goal < 0) return [];
  if (start === goal) return [to];
  const previous=new Map<number,number>(),costs=new Map<number,number>(),closed=new Set<number>();
  const heap: { n: number; f: number }[] = [];
  const heuristic = (n: number): number => Math.abs(n % GRID - goal % GRID) + Math.abs(Math.floor(n / GRID) - Math.floor(goal / GRID));
  const push = (n: number, f: number): void => { let i = heap.length; heap.push({ n, f }); while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= f) break; heap[i] = heap[p]; i = p; } heap[i] = { n, f }; };
  const pop = (): number => {
    const result = heap[0].n, tail = heap.pop()!;
    if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let child = i * 2 + 1; if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++; if (tail.f <= heap[child].f) break; heap[i] = heap[child]; i = child; } heap[i] = tail; }
    return result;
  };
  costs.set(start,0); push(start, heuristic(start));
  while (heap.length&&closed.size<40000) {
    const current = pop(); if (closed.has(current)) continue;
    if (current === goal) { const path: Vec2[] = [to]; let n = goal; while (n !== -1) { path.unshift(position(n)); n = previous.get(n)??-1; } return path; }
    closed.add(current);
    for (const next of neighbors(current)) {
      const p=position(next);if(p.x<minX||p.x>maxX||p.z<minZ||p.z>maxZ)continue;
      if (!free(next) || closed.has(next)) continue;
      const cost = costs.get(current)! + 1;
      if (cost < (costs.get(next)??Infinity)) { costs.set(next,cost); previous.set(next,current); push(next, cost + heuristic(next)*(direct>120?1.3:1.08)); }
    }
  }
  return [];
}

export function impactMaterial(p:Vec2,extra:Obstacle[]=[]):string {
  if([...FENCES,...extra].some(o=>Math.abs(p.x-o.x)<=o.w/2+.08&&Math.abs(p.z-o.z)<=o.d/2+.08)) return 'wood';
  if(CARGO_OBSTACLES.some(o=>Math.abs(p.x-o.x)<=o.w/2+.08&&Math.abs(p.z-o.z)<=o.d/2+.08))return 'metal';
  if(URBAN.vehicles.some(v=>Math.abs(p.x-v.x)<=v.w/2+.08&&Math.abs(p.z-v.z)<=v.d/2+.08))return 'metal';
  if(CARS.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<2.5)||Math.hypot(p.x+25,p.z-22)<1.2||Math.hypot(p.x+21,p.z-22)<1.2) return 'metal';
  return 'concrete';
}

export function surfaceAt(p:Vec2):string {
  if(p.x>-5&&p.x<7&&p.z>0&&p.z<10)return 'concrete';
  const site=CITY_SITES.find(s=>Math.abs(p.x-s.x)<s.w/2&&Math.abs(p.z-s.z)<s.d/2);if(site)return site.kind==='house'?'wood':site.kind==='industry'?'metal':'concrete';
  if(BUILDINGS.some(b=>Math.abs(p.x-b.x)<1.3&&Math.abs(p.z-(b.z+b.d/2+.8))<.7))return 'wood';
  if(URBAN.buildings.some(b=>Math.abs(p.x-b.x)<b.w/2+1&&Math.abs(p.z-b.z)<b.d/2+1)||ROADS.some(r=>Math.abs(p.x-r.x)<r.w/2+2&&Math.abs(p.z-r.z)<r.d/2+2&&! (Math.abs(p.x-r.x)<r.w/2&&Math.abs(p.z-r.z)<r.d/2)))return 'concrete';
  return ROADS.some(r=>Math.abs(p.x-r.x)<r.w/2&&Math.abs(p.z-r.z)<r.d/2)?'asphalt':'grass';
}

export interface Vec3 extends Vec2 {y:number}
/** Unit 3D ray versus a box; shared by camera aim, muzzle clearance and interaction. */
export function rayBox(origin:Vec3,dir:Vec3,box:Obstacle,range:number):number {
 let near=0,far=range;
 for(const axis of ['x','y','z'] as const){
  const low=axis==='y'?(box.bottom??0):box[axis]-(axis==='x'?box.w:box.d)/2;
  const high=axis==='y'?(box.bottom??0)+(box.h??4):box[axis]+(axis==='x'?box.w:box.d)/2;
  if(Math.abs(dir[axis])<1e-8){if(origin[axis]<low||origin[axis]>high)return Infinity;}
  else {const a=(low-origin[axis])/dir[axis],b=(high-origin[axis])/dir[axis];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
 }
 return near<=far&&far>=0?near:Infinity;
}
export function rayWorld(origin:Vec3,dir:Vec3,range:number,extra:Obstacle[]=[]):number {
 let nearest=range;const end={x:origin.x+dir.x*range,z:origin.z+dir.z*range};
 const minX=Math.min(origin.x,end.x),minZ=Math.min(origin.z,end.z),maxX=Math.max(origin.x,end.x),maxZ=Math.max(origin.z,end.z);
 for(const o of nearbyObstacles(minX,minZ,maxX,maxZ))nearest=Math.min(nearest,rayBox(origin,dir,o,range));
 for(const o of extra){
  if(o.x+o.w/2<minX||o.x-o.w/2>maxX||o.z+o.d/2<minZ||o.z-o.d/2>maxZ)continue;
  nearest=Math.min(nearest,rayBox(origin,dir,o,range));
 }
 for(const o of nearbyObstacles(minX,minZ,maxX,maxZ,roofBins))nearest=Math.min(nearest,rayBox(origin,dir,o,range));
 if(dir.y<0)nearest=Math.min(nearest,Math.max(0,(origin.y-floorHeight(origin))/-dir.y));
 return nearest;
}
/** All current walkable levels are flat; curbs are low steps, never stairs or jumps. */
export function floorHeight(p:Vec2):number {
 if(CITY_SITES.some(s=>Math.abs(p.x-s.x)<s.w/2+3.5&&Math.abs(p.z-s.z)<s.d/2+3.5))return .22;
 if(BUILDINGS.some(b=>Math.abs(p.x-b.x)<b.w/2+1&&Math.abs(p.z-b.z)<b.d/2+1)||p.x>-5&&p.x<7&&p.z>0&&p.z<10)return .22;
 return .02;
}
export function ceilingHeight(p:Vec2,radius=0):number {
 const tent=CITY_SITES.find(s=>s.kind==='quarantine'&&[-8,8].some(x=>Math.abs(p.x-s.x-x)<3+radius&&Math.abs(p.z-s.z+4)<2.5+radius));
 if(tent)return 1.85;
 const b=[...BUILDINGS.filter(b=>b.kind!=='base'),...CITY_SITES].find(s=>Math.abs(p.x-s.x)<s.w/2&&Math.abs(p.z-s.z)<s.d/2);return b?.h??Infinity;
}
