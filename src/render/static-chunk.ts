import * as THREE from 'three';
/** Only for immutable scenery directly under the identity world scene.
 * Visibility/material/instance-buffer changes remain supported; transforms do not.
 * Dynamic doors, characters and particles must stay outside these roots. */
export class StaticChunk extends THREE.Group {
 private frozen=false;
 freeze(){super.updateMatrixWorld(true);this.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});this.frozen=true;}
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
