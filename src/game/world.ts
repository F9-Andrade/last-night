import { hasInterior, roomObstacles } from './interiors.ts';
import { CITY_LIMIT, CITY_SITES, siteObstacles } from './city.ts';
import { OUTER_HOUSES, OUTER_CARS, WAREHOUSES, ROADS, CARGO_OBSTACLES, PLAZA_MONUMENT } from './districts.ts';
export interface Vec2 { x: number; z: number }
export interface Obstacle { x: number; z: number; w: number; d: number }
export interface Building extends Obstacle { kind: 'base' | 'market' | 'hospital' | 'police' | 'house'; label: string; color: number; h: number }
export const WORLD_LIMIT = CITY_LIMIT;
export const BASE = { x: 1, z: 2 };
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
BUILDINGS.push(...OUTER_HOUSES.map(([x,z,color])=>({kind:'house' as const,label:'',x,z,color,w:10,d:8,h:3.8})));
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
export const OBSTACLES: Obstacle[] = [
  ...BUILDINGS.flatMap(b=>hasInterior(b)?roomObstacles(b):[b]), ...FENCES, ...WAREHOUSES, ...CARGO_OBSTACLES, PLAZA_MONUMENT,
  ...CARS.map(c => ({ x: c.x, z: c.z, w: Math.abs(Math.sin(c.angle)) * 3.7 + Math.abs(Math.cos(c.angle)) * 1.8, d: Math.abs(Math.cos(c.angle)) * 3.7 + Math.abs(Math.sin(c.angle)) * 1.8 })),
  { x: -27, z: 29, w: 10, d: 5 },
  { x: -25, z: 22, w: 1.3, d: 1.3 }, { x: -21, z: 22, w: 1.3, d: 1.3 },
  ...CITY_SITES.flatMap(siteObstacles),
];
const SPATIAL_CELL=8;
const obstacleBins=new Map<string,Obstacle[]>();
for(const o of OBSTACLES)for(let x=Math.floor((o.x-o.w/2)/SPATIAL_CELL);x<=Math.floor((o.x+o.w/2)/SPATIAL_CELL);x++)for(let z=Math.floor((o.z-o.d/2)/SPATIAL_CELL);z<=Math.floor((o.z+o.d/2)/SPATIAL_CELL);z++){
  const key=`${x}:${z}`,bucket=obstacleBins.get(key)??[];bucket.push(o);obstacleBins.set(key,bucket);
}
function nearbyObstacles(minX:number,minZ:number,maxX:number,maxZ:number):Obstacle[]{
  const found=new Set<Obstacle>();
  for(let x=Math.floor(minX/SPATIAL_CELL);x<=Math.floor(maxX/SPATIAL_CELL);x++)for(let z=Math.floor(minZ/SPATIAL_CELL);z<=Math.floor(maxZ/SPATIAL_CELL);z++)for(const o of obstacleBins.get(`${x}:${z}`)??[])found.add(o);
  return [...found];
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
  return [...nearbyObstacles(p.x-radius,p.z-radius,p.x+radius,p.z+radius), ...extra].some(o => {
    const dx = Math.max(Math.abs(p.x - o.x) - o.w / 2, 0);
    const dz = Math.max(Math.abs(p.z - o.z) - o.d / 2, 0);
    return dx * dx + dz * dz < radius * radius;
  });
}
export function move(p: Vec2, dx: number, dz: number, radius = .45, extra: Obstacle[] = []): void {
  if (!collides({ x: p.x + dx, z: p.z }, radius, extra)) p.x += dx;
  if (!collides({ x: p.x, z: p.z + dz }, radius, extra)) p.z += dz;
}
export function distance(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.z - b.z); }
/** Segment versus expanded AABB. Returns world-space distance to the first obstruction. */
export function wallDistance(origin: Vec2, dir: Vec2, range: number, extra: Obstacle[] = [], radius = 0): number {
  let nearest = range;
  const end={x:origin.x+dir.x*range,z:origin.z+dir.z*range};
  for (const o of [...nearbyObstacles(Math.min(origin.x,end.x)-radius,Math.min(origin.z,end.z)-radius,Math.max(origin.x,end.x)+radius,Math.max(origin.z,end.z)+radius), ...extra]) {
    let near = 0, far = range;
    for (const axis of ['x', 'z'] as const) {
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
  }
  return nearest;
}

// One-unit cells resolve the narrow side passages of the existing courtyard.
// Static connectivity is cached once; at most 16 dynamic portal masks are retained.
const GRID = WORLD_LIMIT*2+2, CELL = 1, NODES = GRID * GRID, ORIGIN=WORLD_LIMIT+.5;
const position = (n: number): Vec2 => ({ x: (n % GRID) * CELL - ORIGIN, z: Math.floor(n / GRID) * CELL - ORIGIN });
const node = (p: Vec2): number => Math.max(0, Math.min(GRID - 1, Math.round(p.z + ORIGIN))) * GRID + Math.max(0, Math.min(GRID - 1, Math.round(p.x + ORIGIN)));
const walkable = Uint8Array.from({ length: NODES }, (_, n) => Number(!collides(position(n), .49)));
const links: number[][] = Array.from({ length: NODES }, () => []);
for (let n = 0; n < NODES; n++) if (walkable[n]) {
  const a = position(n);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = n % GRID + dx, z = Math.floor(n / GRID) + dz, next = z * GRID + x;
    if (x < 0 || x >= GRID || z < 0 || z >= GRID || !walkable[next]) continue;
    if (wallDistance(a, { x: dx, z: dz }, 1, [], .49) >= 1) links[n].push(next);
  }
}
const masks = new Map<string, Uint8Array>();
function navigationMask(extra: Obstacle[]): Uint8Array {
  if (!extra.length) return walkable;
  const key = extra.map(b => `${b.x}:${b.z}:${b.w}:${b.d}`).join('|');
  let mask = masks.get(key);
  if (!mask) {
    mask = walkable.slice();
    for(const b of extra){
      const minX=Math.max(0,Math.floor(b.x-b.w/2-.5+ORIGIN)),maxX=Math.min(GRID-1,Math.ceil(b.x+b.w/2+.5+ORIGIN));
      const minZ=Math.max(0,Math.floor(b.z-b.d/2-.5+ORIGIN)),maxZ=Math.min(GRID-1,Math.ceil(b.z+b.d/2+.5+ORIGIN));
      for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const n=z*GRID+x,p=position(n);if(Math.hypot(Math.max(0,Math.abs(p.x-b.x)-b.w/2),Math.max(0,Math.abs(p.z-b.z)-b.d/2))<.5)mask[n]=0;}
    }
    if (masks.size >= 16) masks.clear(); masks.set(key, mask);
  }
  return mask;
}
export function findPath(from: Vec2, to: Vec2, extra: Obstacle[] = []): Vec2[] {
  const direct=distance(from,to);
  if(direct>.01&&wallDistance(from,{x:(to.x-from.x)/direct,z:(to.z-from.z)/direct},direct,extra,.49)>=direct&&!collides(to,.49,extra))return Array.from({length:Math.ceil(direct/8)},(_,i)=>{const t=(i+1)/Math.ceil(direct/8);return {x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t};});
  const mask = navigationMask(extra);
  const connects = (p: Vec2, q: Vec2): boolean => {
    const steps = Math.max(1, Math.ceil(distance(p, q) / .15));
    for (let i = 1; i <= steps; i++) if (collides({ x: p.x + (q.x - p.x) * i / steps, z: p.z + (q.z - p.z) * i / steps }, .475, extra)) return false;
    return true;
  };
  const nearest = (p: Vec2): number => {
    const origin = node(p); let best = -1, bestDistance = Infinity;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const x = origin % GRID + dx, z = Math.floor(origin / GRID) + dz, n = z * GRID + x;
      if (x < 0 || x >= GRID || z < 0 || z >= GRID || !mask[n]) continue;
      const q = position(n), d = distance(p, q);
      if (d < bestDistance && connects(p, q)) { best = n; bestDistance = d; }
    }
    return best;
  };
  const start = nearest(from), goal = nearest(to); if (start < 0 || goal < 0) return [];
  if (start === goal) return [to];
  const previous = new Int32Array(NODES).fill(-1), costs = new Float32Array(NODES).fill(Infinity), closed = new Uint8Array(NODES);
  const heap: { n: number; f: number }[] = [];
  const heuristic = (n: number): number => Math.abs(n % GRID - goal % GRID) + Math.abs(Math.floor(n / GRID) - Math.floor(goal / GRID));
  const push = (n: number, f: number): void => { let i = heap.length; heap.push({ n, f }); while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= f) break; heap[i] = heap[p]; i = p; } heap[i] = { n, f }; };
  const pop = (): number => {
    const result = heap[0].n, tail = heap.pop()!;
    if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let child = i * 2 + 1; if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++; if (tail.f <= heap[child].f) break; heap[i] = heap[child]; i = child; } heap[i] = tail; }
    return result;
  };
  costs[start] = 0; push(start, heuristic(start));
  while (heap.length) {
    const current = pop(); if (closed[current]) continue;
    if (current === goal) { const path: Vec2[] = [to]; let n = goal; while (n !== -1) { path.unshift(position(n)); n = previous[n]; } return path; }
    closed[current] = 1;
    for (const next of links[current]) {
      if (!mask[next] || closed[next]) continue;
      const cost = costs[current] + 1;
      if (cost < costs[next]) { costs[next] = cost; previous[next] = current; push(next, cost + heuristic(next)); }
    }
  }
  return [];
}

export function impactMaterial(p:Vec2,extra:Obstacle[]=[]):string {
  if([...FENCES,...extra].some(o=>Math.abs(p.x-o.x)<=o.w/2+.08&&Math.abs(p.z-o.z)<=o.d/2+.08)) return 'wood';
  if(CARGO_OBSTACLES.some(o=>Math.abs(p.x-o.x)<=o.w/2+.08&&Math.abs(p.z-o.z)<=o.d/2+.08))return 'metal';
  if(CARS.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<2.5)||Math.hypot(p.x+25,p.z-22)<1.2||Math.hypot(p.x+21,p.z-22)<1.2) return 'metal';
  return 'concrete';
}

export function surfaceAt(p:Vec2):string {
  if(p.x>-5&&p.x<7&&p.z>0&&p.z<10)return 'concrete';
  if(BUILDINGS.some(b=>Math.abs(p.x-b.x)<1.3&&Math.abs(p.z-(b.z+b.d/2+.8))<.7))return 'wood';
  return ROADS.some(r=>Math.abs(p.x-r.x)<r.w/2&&Math.abs(p.z-r.z)<r.d/2)?'asphalt':'grass';
}
