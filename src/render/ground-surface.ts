import type * as THREE from 'three';
import {ROADS} from '../game/districts.ts';
import {subtractRectangles} from '../game/surface-layout.ts';
import type {SurfaceRect} from '../game/surface-layout.ts';
import {box} from './models.ts';
import type {SurfaceKind} from './surface-materials.ts';

/** Cosmetic pavement must never bridge a road or cover another building's floor. */
export function groundSurface(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:number,kind:SurfaceKind='paving',origin:{x:number;z:number}=parent.position,exclusions:readonly SurfaceRect[]=ROADS):void{
 for(const p of subtractRectangles({x:origin.x+x,z:origin.z+z,w,d},exclusions,.025)){
  box(parent,p.x-origin.x,y,p.z-origin.z,p.w,h,p.d,color,kind);
 }
}
