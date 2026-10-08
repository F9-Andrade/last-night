import { CITY_SITES, CITY_PORTALS, CITY_LOOT } from './city.ts';
import { BUILDINGS, GAS_STATION, URBAN, OBSTACLES, collides, rebuildWorldCaches } from './world.ts';
import { REGIONS, OUTER_HOUSES, WAREHOUSES, ROADS } from './districts.ts';
import { FACILITIES, CACHE_STORIES, EVENT_POINTS } from './expedition.ts';
import { BASE_LOOT_POINTS } from './base-loot.ts';
import { LOOT_POINTS } from './loot.ts';

type Point = {x:number;z:number};
type Lot = Point & {w:number;d:number};
type Anchor = {id:string;object:Lot;original:Lot;fixed?:boolean};
type Dependent = {point:Point;original:Point;owner?:string};
const originalSites = CITY_SITES.map(s=>({...s}));
const anchors:Anchor[] = [
  ...CITY_SITES.map((s,i)=>({id:s.id,object:s,original:{...originalSites[i]}})),
  ...BUILDINGS.map((b,i)=>({id:`building:${i}`,object:b,original:{...b},fixed:b.kind==='base'})),
  ...WAREHOUSES.map((b,i)=>({id:`warehouse:${i}`,object:b,original:{...b}})),
  {id:'station',object:Object.assign(GAS_STATION,{w:10,d:5}),original:{...GAS_STATION,w:10,d:5}},
];
const byId = new Map(anchors.map(a=>[a.id,a]));
const originalUrban = structuredClone(URBAN);
let version:0|1=0, seed=0, epoch=0;
export const worldLayoutVersion=():0|1=>version;
export const worldLayoutSeed=():number=>seed;
export const worldLayoutEpoch=():number=>epoch;

function randomStream(worldSeed:number){let value=(worldSeed^0x71c438a9)>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
function distanceToLot(p:Point,b:Lot):number{return Math.hypot(Math.max(0,Math.abs(p.x-b.x)-b.w/2),Math.max(0,Math.abs(p.z-b.z)-b.d/2));}
function owner(point:Point,id=''):string|undefined {
  const site=originalSites.find(s=>id.startsWith(`${s.id}-`));if(site)return site.id;
  if(id.startsWith('foundry-'))return 'foundry';if(id==='terminal-radio')return 'terminal';
  if(id.startsWith('hospital-')&&!id.startsWith('hospital-ambulance'))return 'building:2';
  if(id.startsWith('police-'))return 'building:3';
  if(id.startsWith('market-'))return 'building:1';
  if(id.startsWith('gas-'))return 'station';
  if(id==='house-north')return 'building:5';if(id==='house-west')return 'building:4';
  if(id==='house-east')return 'building:6';if(id==='house-south')return 'building:7';
  const near=anchors.filter(a=>!a.fixed).sort((a,b)=>distanceToLot(point,a.original)-distanceToLot(point,b.original));
  return near[0]&&distanceToLot(point,near[0].original)<3.5?near[0].id:undefined;
}
const dependents:Dependent[]=[];
function remember(points:readonly Point[],identify:(p:Point,index:number)=>string|undefined=(p)=>owner(p, 'id' in p?String(p.id):'')){
  for(const [i,p] of points.entries())if(!dependents.some(d=>d.point===p))dependents.push({point:p,original:{x:p.x,z:p.z},owner:identify(p,i)});
}
remember(CITY_PORTALS,p=>(p as typeof CITY_PORTALS[number]).site);
remember(CITY_LOOT,p=>(p as typeof CITY_LOOT[number]).site);
remember(BASE_LOOT_POINTS);remember(LOOT_POINTS);remember(FACILITIES);remember(CACHE_STORIES);remember(EVENT_POINTS);
remember(REGIONS,(p,i)=>i>=12?originalSites[i-12]?.id:i===0?undefined:i===1?'building:1':i===2?'building:2':i===3?'building:3':i===4?'station':owner(p));

const overlap=(a:Lot,b:Lot,padding=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+padding&&Math.abs(a.z-b.z)<(a.d+b.d)/2+padding;
function shuffle<T>(items:T[],random:()=>number):T[]{const result=items.slice();for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function transpose(random:()=>number):void {
  const groups=new Map<string,Anchor[]>();
  for(const a of anchors){if(a.fixed)continue;const domain=a.id.startsWith('building:')?'central':a.id.startsWith('warehouse:')?'warehouse':'site';const key=`${domain}:${a.original.w}:${a.original.d}`;const group=groups.get(key)??[];group.push(a);groups.set(key,group);}
  for(const group of groups.values()){
    const slots=shuffle(group.map(a=>a.original),random);
    group.forEach((a,i)=>{a.object.x=slots[i].x;a.object.z=slots[i].z;});
  }
  // Unique landmarks stay on their reserved parcel, but move within its clear margin.
  // Permuted parcels retain identical footprints, so the authored street network survives.
  for(const group of groups.values())if(group.length===1){
    const a=group[0];if(a.id==='station'||a.id.startsWith('warehouse:'))continue;
    const padding=a.id.startsWith('building:')?.55:1.1;
    for(const offset of shuffle([{x:padding,z:0},{x:-padding,z:0},{x:0,z:padding},{x:0,z:-padding}],random)){
      const candidate={...a.original,x:a.original.x+offset.x,z:a.original.z+offset.z};
      if(ROADS.some(r=>overlap(candidate,r,1.6))||anchors.some(b=>b!==a&&overlap(candidate,b.object,2.5)))continue;
      // Keep enough ground for attached props, trees and the two door approaches.
      if(originalUrban.buildings.some(b=>overlap(candidate,b,3.5))||originalUrban.vehicles.some(b=>overlap(candidate,b,3)))continue;
      a.object.x=candidate.x;a.object.z=candidate.z;break;
    }
  }
}
function restoreUrban(random?:()=>number):void {
  for(const key of ['buildings','vehicles','scenes','alleys'] as const){const target=URBAN[key] as unknown[];target.splice(0,target.length,...structuredClone(originalUrban[key]));}
  if(random){
    const groups=new Map<string,typeof URBAN.buildings>();
    for(const b of URBAN.buildings){const key=`${b.w}:${b.d}:${b.front}`;const group=groups.get(key)??[];group.push(b);groups.set(key,group);}
    const offsets=new Map<string,Point>();
    for(const group of groups.values()){
      const slots=shuffle(group.map(b=>({x:b.x,z:b.z})),random);
      group.forEach((b,i)=>{offsets.set(b.id,{x:slots[i].x-b.x,z:slots[i].z-b.z});b.x=slots[i].x;b.z=slots[i].z;});
    }
    for(const alley of URBAN.alleys){const offset=offsets.get(alley.id.replace('alley-','urban-'));if(offset){alley.x+=offset.x;alley.z+=offset.z;}}
  }
  URBAN.obstacles.splice(0,URBAN.obstacles.length,...URBAN.buildings,...URBAN.vehicles);
}
function moveDependents():void {
  for(const d of dependents){const a=d.owner?byId.get(d.owner):undefined;d.point.x=d.original.x+(a?a.object.x-a.original.x:0);d.point.z=d.original.z+(a?a.object.z-a.original.z:0);}
  OUTER_HOUSES.forEach((p,i)=>{p[0]=BUILDINGS[i+8].x;p[1]=BUILDINGS[i+8].z;});
  for(const point of LOOT_POINTS){const alley=URBAN.alleys.find(a=>a.id===point.id);if(alley){point.x=alley.x;point.z=alley.z;}}
}

/** One layout per loaded browser world. Call BEFORE constructing/restoring its Simulation.
 * Actors and clones share this layout; never call this from an actor update or constructor.
 * Version 0 exactly restores legacy parcels; the version and run seed travel with saves. */
export function configureWorld(worldSeed:number,layoutVersion:0|1=1):boolean {
  if(!Number.isInteger(worldSeed)||worldSeed<0||worldSeed>0xffffffff||![0,1].includes(layoutVersion))throw new Error('Configuração da cidade inválida.');
  if(version===layoutVersion&&(layoutVersion===0||seed===worldSeed))return false;
  for(const a of anchors){a.object.x=a.original.x;a.object.z=a.original.z;}
  const random=randomStream(worldSeed);if(layoutVersion===1)transpose(random);
  restoreUrban(layoutVersion===1?random:undefined);moveDependents();rebuildWorldCaches();
  // Restore a unique landmark's original parcel if its small offset blocks a supply.
  // Never relocate loot independently from its room to conceal a collision.
  for(const a of anchors){if(a.object.x===a.original.x&&a.object.z===a.original.z)continue;
    const small=Math.hypot(a.object.x-a.original.x,a.object.z-a.original.z)<2;
    if(small&&dependents.some(d=>d.owner===a.id&&'id'in d.point&&LOOT_POINTS.includes(d.point as typeof LOOT_POINTS[number])&&collides(d.point,.65))){a.object.x=a.original.x;a.object.z=a.original.z;moveDependents();rebuildWorldCaches();}
  }
  version=layoutVersion;seed=worldSeed>>>0;epoch++;return true;
}

/** Diagnostics for validating a seed without serializing the whole static city. */
export function worldLayoutSummary(){return {seed,version,epoch,sites:CITY_SITES.length,buildings:BUILDINGS.length+URBAN.buildings.length,obstacles:OBSTACLES.length,moved:anchors.filter(a=>a.object.x!==a.original.x||a.object.z!==a.original.z).length};}
