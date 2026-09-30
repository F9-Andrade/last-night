import * as THREE from 'three';
import {batch} from './models.ts';
import {StaticChunk} from './static-chunk.ts';
/** Preserve every static part, but prevent a city-wide bounding sphere from
 * dragging the whole downtown mesh into distant camera and shadow passes. */
export function spatialBatch(group:THREE.Group,size=64){
 group.updateMatrixWorld(true);const bounds=new THREE.Box3(),center=new THREE.Vector3(),extent=new THREE.Vector3(),cells=new Map<string,StaticChunk>();
 for(const object of [...group.children]){
  bounds.setFromObject(object);bounds.getCenter(center);bounds.getSize(extent);
  // Low-poly roads and terrain share a separate bucket so they never enlarge
  // the bounds of detailed props, without adding a draw call per road.
  const key=Math.max(extent.x,extent.z)>size*2?'landscape':`${Math.floor(center.x/size)}:${Math.floor(center.z/size)}`;
  let cell=cells.get(key);if(!cell){cell=new StaticChunk();cell.name=`static-cell:${key}`;cells.set(key,cell);group.add(cell);}
  cell.add(object);
 }
 for(const cell of cells.values()){batch(cell);cell.freeze();}
 return cells.size;
}
