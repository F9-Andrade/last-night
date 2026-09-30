import {StaticChunk} from './static-chunk.ts';
import * as THREE from 'three';
import { ROADS } from '../game/districts';
import { BUILDINGS, CARS, URBAN, collides } from '../game/world';
import { batch, box } from './models';
import { voxelGeometry, voxelMaterial } from './voxel';
import { grassRecipe } from './environment-assets';
import { visualPreset } from './visual-config';

interface DressingChunk { root: StaticChunk; vegetation: THREE.Group; x: number; z: number; pieces: number }

/** Cosmetic, deterministic curbside dressing. Never registered as simulation obstacles. */
export class EnvironmentalDressing {
  private readonly chunks = new Map<string, DressingChunk>();
  private pieces = 0;
  private activeChunks = 0;
  private activePieces = 0;
  private vegetationCount = 0;
  constructor(scene: THREE.Scene) {
    let seed = 110731;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const chunk = (x: number, z: number): DressingChunk => {
      const cx = Math.floor(x / 32) * 32 + 16, cz = Math.floor(z / 32) * 32 + 16, key = `${cx}:${cz}`;
      let value = this.chunks.get(key);
      if (!value) {
        const root = new StaticChunk(), vegetation = new THREE.Group(); root.name = `phase11-dressing:${key}`;
        root.position.set(cx, 0, cz); scene.add(root); value = { root, vegetation, x: cx, z: cz, pieces: 0 }; this.chunks.set(key, value);
      }
      return value;
    };
    const part = (x: number, y: number, z: number, w: number, h: number, d: number, color: number, yaw = 0) => {
      const c = chunk(x, z), mesh = box(c.root, x - c.x, y, z - c.z, w, h, d, color);
      mesh.rotation.y = yaw; c.pieces++; this.pieces++; return mesh;
    };
    const grass = (x: number, z: number, scale: number) => {
      const c = chunk(x, z); const mesh = new THREE.Mesh(voxelGeometry(grassRecipe()), voxelMaterial);
      mesh.position.set(x - c.x, .12, z - c.z); mesh.scale.set(scale, scale * (.7 + random() * .7), scale); mesh.rotation.y = random() * 6.28;
      c.vegetation.add(mesh); this.vegetationCount++;
    };
    // Accumulation is concentrated in gutters. Lane centers and junctions stay open.
    for (const road of ROADS) for (let n = -Math.max(road.w,road.d)/2 + 6; n < Math.max(road.w,road.d)/2 - 6; n += 4.6) for (const side of [-1, 1]) {
      const horizontal = road.w > road.d, offset = (horizontal ? road.d : road.w) / 2;
      const x = horizontal ? road.x+n : road.x + side * (offset - .27), z = horizontal ? road.z + side * (offset - .27) : road.z+n;
      if (ROADS.some(r => r !== road && Math.abs(x - r.x) < r.w / 2 + 1 && Math.abs(z - r.z) < r.d / 2 + 1)) continue;
      if (random() > .75 || collides({ x, z }, .32)) continue;
      const central = Math.abs(x) < 39 && Math.abs(z) < 40, floor = central ? .062 : .016;
      // Dark accumulated soil establishes the edge, with a few angular pieces on top.
      const dirt = part(x, floor, z, horizontal ? 1.5 : .46, .018, horizontal ? .46 : 1.5, 0x403d32, (random() - .5) * .13);
      dirt.userData.surfaceKind = 'earth';
      for (let i = 0; i < 3; i++) {
        const px = x + (random() - .5) * 1.25, pz = z + (random() - .5) * 1.25;
        const paper = random() > .7;
        part(px, floor + (paper ? .025 : .06), pz, .1 + random() * .22, paper ? .009 : .06 + random() * .05, .09 + random() * .16, paper ? 0xa9a28c : [0x666154, 0x79705c, 0x4c4b40][i], random() * 6.28);
      }
      if (random() > .24) grass(x + (horizontal ? 0 : side * .44), z + (horizontal ? side * .44 : 0), .65 + random() * 1.05);
    }
    // Irregular larger repaired cracks remain legible from eye height.
    for (const road of ROADS) for (let n = -Math.max(road.w,road.d)/2 + 13; n < Math.max(road.w,road.d)/2 - 10; n += 24) {
      const horizontal = road.w > road.d, x = horizontal ? road.x+n : road.x + .4, z = horizontal ? road.z + .4 : road.z+n;
      if (collides({ x, z }, .4)) continue;
      let px = x, pz = z;
      for (let j = 0; j < 4; j++) {
        const a = random() * 2.2 - 1.1 + (horizontal ? Math.PI / 2 : 0), length = .25 + random() * .7;
        const y = Math.abs(px) < 39 && Math.abs(pz) < 40 ? .065 : .02;
        part(px, y, pz, .021 + random() * .021, .008, length, 0x252923, a);
        px += Math.sin(a) * length * .6; pz += Math.cos(a) * length * .6;
      }
    }
    // Oil under abandoned engines, not large glossy black discs across entire streets.
    for (const car of [...CARS, ...URBAN.vehicles]) {
      const y = Math.abs(car.x) < 39 && Math.abs(car.z) < 40 ? .07 : .022;
      part(car.x + Math.sin(car.angle) * 1.5, y, car.z + Math.cos(car.angle) * 1.5, .7, .01, .95, 0x30332c, car.angle + .2);
      for (let i = 0; i < 3; i++) part(car.x + (random() - .5) * 1.6, y + .02, car.z + (random() - .5) * 2.8, .09, .015, .12, 0x7a8b83, random() * 6.28);
    }
    // Small traces extend authored scenes instead of generating new routes or vehicles.
    for (const s of URBAN.scenes) {
      for (let i = 0; i < 9; i++) {
        const x = s.x + 2.2 + random() * 1.1, z = s.z - 3.4 + i * .7;
        if (s.kind === 'triage' || s.kind === 'escape') {
          part(x, .026, z, .11 + random() * .14, .014, .18 + random() * .26, 0x542d27, random() * 6.28);
          if (i % 3 === 0) part(x + .5, .03, z, .28, .013, .38, 0xb0aa91, random() * 6.28);
        } else {
          const color = i % 3 === 0 ? 0x5c5747 : i % 2 ? 0x79604b : 0x545d55;
          part(x, .15, z, .44, .26, .65, color, random() * .7);
          part(x, .285, z, .21, .035, .05, 0x958672, random() * .15);
        }
      }
    }
    // Foundation weeds use facade corners, deliberately leaving every doorway clear.
    for (const b of [...BUILDINGS, ...URBAN.buildings]) for (const side of [-1, 1]) {
      if (random() < .35) continue;
      const x = b.x + side * (b.w / 2 + .34), z = b.z + b.d / 2 - .9;
      grass(x, z, 1.1 + random() * .6); grass(x, z - .48, .6 + random());
    }
    for (const c of this.chunks.values()) {
      batch(c.root);
      // Keep one immutable grass geometry for the city; only matrices vary per chunk.
      const blades = c.vegetation.children;
      if (blades.length) {
        const instances = new THREE.InstancedMesh(voxelGeometry(grassRecipe()), voxelMaterial, blades.length);
        instances.name = 'phase11-curb-weeds'; instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        blades.forEach((blade, i) => { blade.updateMatrix(); instances.setMatrixAt(i, blade.matrix); });
        instances.computeBoundingSphere(); c.vegetation.clear(); c.vegetation.add(instances);
      }
      // Tiny details receive shadows; their own sub-pixel shadows add little except cost.
      for (const group of [c.root, c.vegetation]) group.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.receiveShadow = true; } });
      c.root.add(c.vegetation);c.root.freeze();
    }
  }
  update(x: number, z: number, quality: string): void {
    const preset = visualPreset(quality), distance = 23 + 47 * preset.detail;
    this.activeChunks = this.activePieces = 0;
    for (const c of this.chunks.values()) {
      const d = Math.hypot(c.x - x, c.z - z); c.root.visible = d < distance;
      c.vegetation.visible = d < distance * .8 && preset.detail > .4;
      if (c.root.visible) { this.activeChunks++; this.activePieces += c.pieces; }
    }
  }
  stats(): { chunks: number; activeChunks: number; pieces: number; activePieces: number; vegetation: number } {
    return { chunks: this.chunks.size, activeChunks: this.activeChunks, pieces: this.pieces, activePieces: this.activePieces, vegetation: this.vegetationCount };
  }
}
