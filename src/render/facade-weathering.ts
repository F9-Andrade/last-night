import * as THREE from 'three';
import { box } from './models';

/** Flush cosmetic damage: no silhouette, doorway or collision footprint changes. */
export function facadeWeathering(parent: THREE.Group, width: number, depth: number, height: number, front: number, seed: number): void {
  let state = seed * 971 + 193;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const z = front * (depth / 2 + .085);
  // Damp foundation and small exposed masonry on the two facade corners.
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - .48);
    box(parent, x, .2, z, .82, .36, .018, 0x656658, 'plaster');
    for (let i = 0; i < 3; i++) {
      box(parent, x + (random() - .5) * .65, .34 + random() * .52, z + front * .018, .18 + random() * .25, .12 + random() * .13, .025, i % 2 ? 0x796853 : 0x9a8b72, 'plaster');
    }
    if (side === 1 && seed % 3 === 0) {
      box(parent, x + .17, Math.min(2, height * .4), z, .13, Math.min(2.6, height * .7), .012, 0x7b7662, 'plaster');
      box(parent, x + .28, Math.min(1.9, height * .38), z + front * .009, .08, Math.min(2.1, height * .6), .013, 0x73735f, 'plaster');
    }
  }
  // Broken render at the parapet is limited to one bay, avoiding a repeated decal grid.
  if (seed % 2 === 0) for (let i = 0; i < 3; i++) {
    box(parent, -width * .27 + i * .23, height - .16 - random() * .28, z, .21, .13 + random() * .15, .024, 0x8b8270, 'plaster');
  }
}
