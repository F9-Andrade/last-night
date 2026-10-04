import * as THREE from 'three';
/** Only for immutable scenery directly under the identity world scene.
 * Visibility/material/instance-buffer changes remain supported; transforms do not.
 * Dynamic doors, characters and particles must stay outside these roots. */
export class StaticChunk extends THREE.Group {
 private frozen=false;
 freeze(){
  // Batching moved their geometry into shared meshes. Empty staging groups have
  // no renderable content, but WebGL's colour/AO/shadow walkers still visit them.
  const prune=(parent:THREE.Object3D)=>{for(let i=parent.children.length-1;i>=0;i--){const child=parent.children[i];prune(child);if(child instanceof THREE.Group&&child.children.length===0)parent.remove(child);}};
  prune(this);super.updateMatrixWorld(true);
  this.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});this.frozen=true;
 }
 override updateMatrixWorld(force?:boolean){if(!this.frozen)super.updateMatrixWorld(force);}
}
/** Mutable scene branches need no GPU transforms while invisible. Recompute the
 * entire branch when shown again, including changes made during the hidden time. */
export class VisibleGroup extends THREE.Group {
 private slept=false;
 override updateMatrixWorld(force?:boolean){
  if(!this.visible){this.slept=true;return;}
  super.updateMatrixWorld(force||this.slept);this.slept=false;
 }
}
