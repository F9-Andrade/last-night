import * as THREE from 'three';
import {BUILDINGS,OBSTACLES,TREE_TRUNKS,WORLD_LIMIT} from '../game/world.ts';
import {CITY_PORTALS,CITY_SITES} from '../game/city.ts';
import {ROADS} from '../game/districts.ts';
import {hasInterior} from '../game/interiors.ts';
import {LOOT_POINTS} from '../game/loot.ts';
import {FACILITIES} from '../game/expedition.ts';
import {worldLayoutEpoch} from '../game/world-layout.ts';
import {findPlacement,PlacementIndex,withinWorld} from '../game/placement.ts';
import type {PlacementRect} from '../game/placement.ts';

/** Bounds in the object's parent coordinates, independent of its attached parent.
 * Including every child and rotation avoids centre-only tests for long furniture. */
export function decorationFootprint(object:THREE.Object3D,origin:{x:number;z:number}):PlacementRect {
 const bounds=new THREE.Box3();
 const visit=(o:THREE.Object3D,parent:THREE.Matrix4)=>{
  o.updateMatrix();const transform=parent.clone().multiply(o.matrix);
  if(o instanceof THREE.Mesh){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();if(o.geometry.boundingBox)bounds.union(o.geometry.boundingBox.clone().applyMatrix4(transform));}
  for(const child of o.children)visit(child,transform);
 };
 visit(object,new THREE.Matrix4());
 if(bounds.isEmpty())return {x:origin.x+object.position.x,z:origin.z+object.position.z,w:0,d:0};
 return {x:origin.x+(bounds.min.x+bounds.max.x)/2,z:origin.z+(bounds.min.z+bounds.max.z)/2,w:bounds.max.x-bounds.min.x,d:bounds.max.z-bounds.min.z};
}

/** Runs during scene construction only. Furniture keeps its nearest valid place,
 * while authored road litter can remain on asphalt and doors keep an approach. */
export class OutdoorPlacement {
 readonly placements:PlacementRect[]=[];
 readonly lights:{x:number;z:number}[]=[];
 private occupied:PlacementIndex;
 private roads:PlacementIndex;
 private limit:number;
 constructor(exclusions:readonly PlacementRect[],roads:readonly PlacementRect[]=[],limit=WORLD_LIMIT){this.occupied=new PlacementIndex(exclusions);this.roads=new PlacementIndex(roads);this.limit=limit;}
 position(desired:PlacementRect,avoidRoad=false):PlacementRect {
  const placed=findPlacement(desired,r=>withinWorld(r,this.limit,.5)&&!this.occupied.overlaps(r,.12)&&(!avoidRoad||!this.roads.overlaps(r,.12)),64,.5);
  if(!placed)throw new Error(`No valid outdoor decoration position near ${desired.x}, ${desired.z}`);
  this.occupied.add(placed);this.placements.push(placed);return placed;
 }
 place(object:THREE.Object3D,origin:{x:number;z:number},avoidRoad=false):void {
  const desired=decorationFootprint(object,origin);if(!desired.w&&!desired.d)return;
  const placed=this.position(desired,avoidRoad);
  object.position.x+=placed.x-desired.x;object.position.z+=placed.z-desired.z;
  object.userData.placement=placed;
 }
}

const planners=new WeakMap<THREE.Scene,{epoch:number;planner:OutdoorPlacement}>();
export function outdoorPlacement(scene:THREE.Scene,additional?:readonly PlacementRect[]):OutdoorPlacement {
 const cached=planners.get(scene),epoch=worldLayoutEpoch();
 if(!cached||cached.epoch!==epoch||additional){
  const approaches=[...CITY_PORTALS.map(p=>({x:p.x+(p.kind==='window'?1.5:0),z:p.z+(p.kind==='door'?1.5:0),w:p.kind==='door'?4.2:3.6,d:p.kind==='door'?3.6:3.8})),...BUILDINGS.filter(hasInterior).map(b=>({x:b.x,z:b.z+b.d/2+1.5,w:3.8,d:3.6}))];
  const interactions=[...LOOT_POINTS,...FACILITIES].map(p=>({x:p.x,z:p.z,w:2.2,d:2.2}));
  const planner=new OutdoorPlacement([...OBSTACLES,...TREE_TRUNKS,...BUILDINGS,...CITY_SITES,...approaches,...interactions,...additional??[]],ROADS);
  planners.set(scene,{epoch,planner});return planner;
 }
 return cached.planner;
}
