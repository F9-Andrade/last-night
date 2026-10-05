import * as THREE from 'three';
import { voxelMesh } from './voxel.ts';
import type { VoxelGrid, VoxelRecipe } from './voxel.ts';
import type { WeaponId } from '../game/weapons.ts';

type Point = [number, number, number];
type Builder = (g: VoxelGrid) => void;
type ActionKind = 'slide' | 'bolt' | 'pump' | 'hammer';
type MagazineKind = 'box' | 'shell' | 'cylinder';
interface WeaponDefinition {
  id: WeaponId; scale: number; muzzle: Point; grip: Point; supportGrip: Point;
  aimHeight: number; aimZ: number; ejection: Point; actionHome: Point; magazineHome: Point;
  actionKind: ActionKind; magazineKind: MagazineKind; frame: Builder; action: Builder; magazine: Builder;
}
/** All attachment points use unscaled model coordinates: +Z forward, +Y up, +X right.
 * grip/supportGrip identify the center enclosed by each hand. The weapon's local
 * transform (including scale) must be applied to these points before solving arms.
 * Moving parts use real pivots: start from their Home vector before adding animation.
 */
export interface WeaponVisual {
  root: THREE.Group; magazine: THREE.Mesh; action: THREE.Mesh;
  muzzle: THREE.Vector3; grip: THREE.Vector3; supportGrip: THREE.Vector3; ejection: THREE.Vector3;
  magazineHome: THREE.Vector3; actionHome: THREE.Vector3;
  aimHeight: number; aimZ: number; scale: number; actionKind: ActionKind; magazineKind: MagazineKind;
}

// A restrained survival palette. Finish is assigned from this exact palette, not
// guessed from color brightness: dirty steel remains metal and tan furniture polymer.
const C = {
  steel: 0x40474b, edge: 0x7b827f, bright: 0xabb1a5, dark: 0x242b2e, recess: 0x141a1d,
  oxide: 0x5e5146, polymer: 0x343b34, grip: 0x202822, gripEdge: 0x505748,
  tan: 0x797464, tanDark: 0x514f43, wood: 0x79563c, woodLight: 0x9f7951,
  woodDark: 0x4e392c, rubber: 0x242a28, brass: 0xb59855, bullet: 0xb57445,
  shell: 0x813d31, sight: 0xc5ba91, lens: 0x4c6969,
} as const;
const finishes = [
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .46, metalness: .62, flatShading: true }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: .01, flatShading: true }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0, flatShading: true }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .38, metalness: .68, flatShading: true }),
];
const palette = Object.entries(C).map(([name, hex]) => ({
  color: new THREE.Color(hex), finish: ['brass', 'bullet'].includes(name) ? 3
    : name.startsWith('wood') ? 2
    : ['polymer', 'grip', 'gripEdge', 'tan', 'tanDark', 'rubber', 'shell'].includes(name) ? 1 : 0,
}));
const UNIT = .02;

function barrel(g: VoxelGrid, y: number, from: number, to: number, radius = 2, color: number = C.steel): void {
  // Stepped square/octagonal muzzle with an actual recessed bore, not a black cap.
  g.fill(-radius + 1, y - radius, from, radius * 2 - 2, radius * 2, to - from, color)
    .fill(-radius, y - radius + 1, from, radius * 2, radius * 2 - 2, to - from, color)
    .carve(-1, y - 1, to - 5, 2, 2, 5);
  g.fill(-1, y - 1, to - 6, 2, 2, 1, C.recess);
}
function trigger(g: VoxelGrid, z: number, color: number = C.steel): void {
  g.fill(-2, -6, z, 4, 1, 10, color).fill(-2, -5, z + 9, 4, 5, 1, color)
    .fill(-1, -3, z + 3, 2, 3, 1, C.edge).fill(-1, -4, z + 4, 2, 1, 1, C.edge);
}
function grip(g: VoxelGrid, z: number, color: number = C.grip, side: number = C.gripEdge): void {
  for (let y = -11; y < 1; y++) {
    const lean = Math.floor((-y + 1) / 4);
    g.fill(-3, y, z - lean, 6, 1, 7, color);
    if (y < -1 && y % 2 === 0) for (const x of [-3, 2]) g.fill(x, y, z - lean + 1, 1, 1, 5, side);
  }
  g.fill(-3, -12, z - 3, 6, 1, 8, C.rubber);
}
function receiver(g: VoxelGrid, front: number, color: number = C.steel): void {
  g.fill(-4, 0, -13, 8, 8, front + 13, color)
    .fill(-3, 8, -12, 6, 1, front + 9, C.dark)
    .fill(3, 3, -6, 1, 4, 11, C.recess).fill(3, 3, -5, 1, 1, 9, C.edge)
    .fill(-4, 5, -10, 1, 1, front + 3, C.edge)
    .fill(4, 1, -7, 1, 2, 3, C.dark).fill(-5, 1, -7, 1, 1, 5, C.edge);
  for (const x of [-4, 3]) g.set(x, 1, -10, C.bright).set(x, 1, 6, C.edge);
  trigger(g, -2); grip(g, -10);
}
function rail(g: VoxelGrid, from: number, to: number, y = 9): void {
  g.fill(-2, y, from, 4, 1, to - from, C.dark);
  for (let z = from; z < to; z += 3) g.fill(-3, y + 1, z, 6, 1, 1, C.edge);
}
function sights(g: VoxelGrid, rear: number, front: number, y = 12): void {
  g.fill(-3, y - 2, rear, 6, 1, 3, C.dark)
    .fill(-3, y - 1, rear, 2, 3, 2, C.steel).fill(1, y - 1, rear, 2, 3, 2, C.steel)
    .set(-2, y, rear, C.sight).set(1, y, rear, C.sight)
    .fill(-2, y - 3, front, 4, 2, 2, C.dark).fill(-1, y - 1, front, 2, 2, 1, C.sight);
}
function woodenStock(g: VoxelGrid): void {
  g.fill(-3, -1, -32, 6, 8, 20, C.wood).fill(-4, -4, -37, 8, 11, 9, C.wood)
    .fill(-4, -5, -38, 8, 12, 2, C.rubber).fill(-3, 7, -31, 6, 1, 14, C.woodLight)
    .fill(-2, -3, -29, 4, 2, 11, C.woodDark);
  for (const x of [-4, 3]) g.fill(x, -1, -35, 1, 1, 5, C.woodLight).set(x, 3, -34, C.dark);
  for (const x of [-3, 2]) g.fill(x, 2, -28, 1, 1, 8, C.woodDark).fill(x, 4, -25, 1, 1, 8, C.woodLight);
}
function boxMagazine(g: VoxelGrid, depth: number, z: number, curved = false): void {
  for (let y = -depth; y < 1; y++) {
    const lean = curved ? Math.floor(-y / 5) : 0;
    g.fill(-3, y, z + lean, 6, 1, 8, C.dark);
    for (const x of [-3, 2]) g.fill(x, y, z + lean + 1, 1, 1, 1, C.edge).fill(x, y, z + lean + 5, 1, 1, 1, C.steel);
  }
  const lean = curved ? Math.floor(depth / 5) : 0;
  g.fill(-3, -depth - 1, z + lean, 6, 1, 8, C.rubber)
    .fill(-2, 1, z + 1, 4, 1, 6, C.brass).fill(-1, 1, z + 7, 2, 1, 1, C.bullet);
}

const pistol: WeaponDefinition = {
  id: 'pistol', scale: .46, muzzle: [0, .12, .50], grip: [0, -.115, -.145], supportGrip: [-.065, -.11, -.08],
  aimHeight: .25, aimZ: -.18, ejection: [.085, .14, .09], actionHome: [0, .10, -.08], magazineHome: [0, -.10, -.16],
  actionKind: 'slide', magazineKind: 'box',
  frame(g) {
    g.fill(-4, -1, -11, 8, 4, 29, C.polymer).fill(-3, -2, 5, 6, 1, 13, C.grip)
      .fill(-3, 3, -10, 6, 1, 20, C.dark);
    grip(g, -9); trigger(g, -3, C.polymer); barrel(g, 6, -1, 25, 3, C.dark);
    g.fill(-3, 1, -12, 6, 2, 3, C.gripEdge).fill(-5, 1, -7, 1, 1, 6, C.edge)
      .set(-4, 0, -8, C.bright).set(3, 0, -8, C.bright).fill(4, 0, -5, 1, 2, 2, C.dark);
    for (let z = 8; z < 17; z += 3) g.fill(-3, -2, z, 6, 1, 1, C.gripEdge);
  },
  action(g) {
    g.fill(-4, 3, -11, 8, 7, 33, C.steel).carve(-3, 3, -2, 6, 5, 24)
      .fill(-3, 10, -10, 6, 1, 31, C.edge).fill(-4, 3, -11, 1, 1, 31, C.edge)
      .fill(3, 4, 0, 1, 4, 8, C.recess).fill(3, 4, 1, 1, 1, 6, C.bright)
      .fill(3, 8, 2, 1, 1, 5, C.oxide).fill(-2, 10, 5, 1, 1, 12, C.bright);
    for (let z = -9; z < -2; z += 2) for (const x of [-4, 3]) g.fill(x, 5, z, 1, 4, 1, C.dark);
    for (let z = 14; z < 20; z += 2) for (const x of [-4, 3]) g.fill(x, 5, z, 1, 3, 1, C.dark);
    sights(g, -10, 18, 12);
  },
  magazine(g) {
    g.fill(-2, -11, -10, 4, 11, 6, C.dark).fill(-3, -13, -11, 6, 2, 8, C.edge)
      .fill(-2, -13, -10, 4, 1, 6, C.rubber).fill(-1, 0, -9, 2, 1, 5, C.brass);
    for (let y = -9; y < -2; y += 3) g.set(1, y, -7, C.recess);
  },
};
const revolver: WeaponDefinition = {
  id: 'revolver', scale: .42, muzzle: [0, .14, .66], grip: [0, -.115, -.18], supportGrip: [-.065, -.10, -.13],
  aimHeight: .27, aimZ: -.16, ejection: [-.1, .12, -.10], actionHome: [0, .18, -.18], magazineHome: [0, .12, -.02],
  actionKind: 'hammer', magazineKind: 'cylinder',
  frame(g) {
    g.fill(-3, -1, -11, 6, 6, 7, C.steel).fill(-3, 10, -10, 6, 2, 17, C.steel)
      .fill(-3, 0, 4, 6, 11, 4, C.steel).fill(-3, 0, -5, 6, 1, 10, C.steel);
    grip(g, -10, C.wood, C.woodLight); trigger(g, -5, C.edge);
    for (const x of [-3, 2]) g.set(x, -5, -8, C.brass).fill(x, 3, -10, 1, 2, 2, C.bright);
    barrel(g, 7, 7, 33, 3, C.steel);
    g.fill(-2, 2, 8, 4, 2, 24, C.dark).fill(-1, 10, 6, 2, 2, 26, C.edge)
      .fill(3, 4, -9, 1, 2, 3, C.edge);
    for (let z = 10; z < 29; z += 5) g.carve(-1, 10, z, 2, 1, 3);
    sights(g, -9, 30, 13);
  },
  action(g) {
    g.fill(-1, 8, -11, 2, 5, 3, C.dark).fill(-2, 12, -13, 4, 2, 5, C.edge)
      .fill(-2, 13, -13, 4, 1, 1, C.dark).fill(-2, 13, -11, 4, 1, 1, C.dark);
  },
  magazine(g) {
    g.fill(-4, 1, -6, 8, 10, 10, C.steel).fill(-5, 2, -6, 10, 8, 10, C.steel)
      .fill(-4, 2, -7, 8, 8, 1, C.dark).fill(-4, 2, 4, 8, 8, 1, C.edge);
    for (const [x, y] of [[-3, 3], [1, 3], [-3, 7], [1, 7]]) {
      g.fill(x, y, -7, 2, 2, 1, C.brass).fill(x, y, 4, 2, 2, 1, C.recess);
    }
    for (const x of [-5, 4]) g.fill(x, 4, -5, 1, 3, 8, C.dark);
    g.fill(-2, 10, -5, 4, 1, 8, C.edge).fill(-2, 1, -5, 4, 1, 8, C.dark);
  },
};
const smg: WeaponDefinition = {
  id: 'smg', scale: .50, muzzle: [0, .12, .80], grip: [0, -.115, -.16], supportGrip: [0, -.015, .37],
  aimHeight: .27, aimZ: -.20, ejection: [.09, .10, .04], actionHome: [.07, .09, .01], magazineHome: [0, -.02, .01],
  actionKind: 'bolt', magazineKind: 'box',
  frame(g) {
    receiver(g, 15); g.fill(-3, 1, 15, 6, 7, 15, C.polymer);
    for (let z = 17; z < 29; z += 3) for (const x of [-3, 2]) g.fill(x, 2, z, 1, 4, 1, C.gripEdge);
    barrel(g, 6, 30, 40, 3); g.fill(-3, 5, 33, 6, 2, 2, C.edge);
    g.fill(-3, 4, -35, 1, 2, 23, C.edge).fill(2, 4, -35, 1, 2, 23, C.edge)
      .fill(-3, -2, -36, 6, 9, 2, C.polymer).fill(-3, -2, -37, 6, 9, 1, C.rubber)
      .fill(-3, 2, -16, 6, 5, 3, C.dark).set(3, 5, -15, C.bright);
    rail(g, -10, 11); sights(g, -11, 27, 13);
  },
  action(g) { g.fill(3, 5, -4, 3, 2, 3, C.edge).fill(5, 4, -4, 2, 3, 3, C.dark); },
  magazine(g) { boxMagazine(g, 20, -2); g.fill(-3, -18, -2, 6, 2, 8, C.polymer); },
};
const shotgun: WeaponDefinition = {
  id: 'shotgun', scale: .48, muzzle: [0, .14, 1.20], grip: [0, -.10, -.18], supportGrip: [0, .0, .54],
  aimHeight: .27, aimZ: -.20, ejection: [.085, .11, .06], actionHome: [0, .02, .54], magazineHome: [0, -.055, .06],
  actionKind: 'pump', magazineKind: 'shell',
  frame(g) {
    receiver(g, 14); woodenStock(g); grip(g, -10, C.wood, C.woodLight);
    barrel(g, 7, 14, 60, 3); barrel(g, 2, 14, 52, 2, C.dark);
    g.fill(-3, 5, 48, 6, 3, 2, C.edge).fill(-2, 10, 14, 4, 1, 43, C.dark)
      .fill(-3, -1, 1, 6, 1, 10, C.recess).fill(3, 2, -3, 1, 1, 7, C.edge);
    sights(g, -10, 56, 13);
    // A receiver-mounted shell carrier, kept as merged voxels with the frame.
    for (let z = -10; z < 4; z += 4) g.fill(-6, 1, z, 2, 6, 2, C.shell).fill(-6, 6, z, 2, 2, 2, C.brass);
  },
  action(g) {
    g.fill(-4, -2, 20, 8, 7, 18, C.wood).carve(-2, 0, 20, 4, 4, 18)
      .fill(-3, 5, 20, 6, 1, 18, C.woodLight);
    for (let z = 21; z < 37; z += 3) for (const x of [-4, 3]) g.fill(x, -1, z, 1, 5, 1, C.woodDark);
    g.fill(-3, -2, 21, 6, 1, 15, C.woodDark);
  },
  magazine(g) { g.fill(-1, -5, 0, 2, 2, 7, C.shell).fill(-1, -5, -2, 2, 2, 2, C.brass); },
};
const rifle: WeaponDefinition = {
  id: 'rifle', scale: .48, muzzle: [0, .12, 1.16], grip: [0, -.115, -.16], supportGrip: [0, -.012, .49],
  aimHeight: .29, aimZ: -.20, ejection: [.09, .10, .04], actionHome: [.075, .10, .01], magazineHome: [0, -.02, .025],
  actionKind: 'bolt', magazineKind: 'box',
  frame(g) {
    receiver(g, 14); g.fill(-3, 2, -26, 6, 5, 14, C.dark)
      .fill(-4, 1, -35, 8, 7, 16, C.tan).fill(-4, -3, -37, 8, 11, 4, C.tanDark)
      .fill(-4, -3, -38, 8, 11, 1, C.rubber).carve(-2, 1, -33, 4, 3, 10)
      .fill(-4, 7, -32, 8, 1, 12, C.gripEdge);
    g.fill(-4, 1, 14, 8, 8, 24, C.tan).carve(-2, 4, 14, 4, 3, 24);
    for (let z = 16; z < 36; z += 4) for (const x of [-4, 3]) g.fill(x, 4, z, 1, 2, 2, C.recess).fill(x, 1, z, 1, 1, 2, C.tanDark);
    barrel(g, 6, 14, 58, 2, C.dark); g.fill(-3, 4, 52, 6, 4, 6, C.steel).carve(-1, 5, 52, 2, 2, 6);
    for (const x of [-3, 2]) g.fill(x, 5, 53, 1, 2, 1, C.recess).fill(x, 5, 56, 1, 2, 1, C.recess);
    rail(g, -11, 38); sights(g, -10, 34, 14);
    g.fill(-3, -1, 0, 6, 2, 10, C.dark).fill(4, 3, -9, 2, 2, 2, C.steel);
  },
  action(g) { g.fill(3, 4, -3, 1, 3, 8, C.edge).fill(3, 7, -9, 3, 1, 3, C.dark); },
  magazine(g) { boxMagazine(g, 16, -2, true); g.fill(-3, -14, 0, 6, 2, 8, C.tanDark); },
};
const marksman: WeaponDefinition = {
  id: 'marksman', scale: .43, muzzle: [0, .14, 1.56], grip: [0, -.11, -.17], supportGrip: [0, .005, .49],
  aimHeight: .42, aimZ: -.18, ejection: [.085, .12, .015], actionHome: [.06, .12, -.015], magazineHome: [0, -.02, .02],
  actionKind: 'bolt', magazineKind: 'box',
  frame(g) {
    receiver(g, 12); woodenStock(g); grip(g, -10, C.wood, C.woodLight);
    g.fill(-4, -1, 9, 8, 6, 24, C.wood).fill(-3, 5, 10, 6, 1, 22, C.woodLight);
    for (const x of [-4, 3]) g.fill(x, 1, 12, 1, 1, 18, C.woodDark).fill(x, 3, 20, 1, 1, 8, C.woodLight);
    barrel(g, 7, 12, 78, 3, C.dark);
    for (let z = 36; z < 69; z += 9) g.fill(-2, 9, z, 4, 1, 5, C.steel);
    g.fill(-4, 4, 70, 8, 6, 8, C.steel).carve(-1, 6, 70, 2, 2, 8);
    // Open scope axis. Rings, turrets and mounts remain distinct voxel silhouettes.
    g.fill(-2, 9, -6, 4, 7, 3, C.dark).fill(-2, 9, 10, 4, 7, 3, C.dark)
      .fill(-4, 17, -10, 8, 8, 28, C.dark).carve(-2, 19, -10, 4, 4, 28)
      .fill(-5, 16, 14, 10, 10, 5, C.steel).carve(-3, 18, 14, 6, 6, 5)
      .fill(-5, 16, -12, 10, 10, 4, C.steel).carve(-3, 18, -12, 6, 6, 4)
      .fill(-3, 25, 1, 6, 3, 5, C.steel).fill(4, 19, 2, 3, 4, 4, C.steel)
      .fill(-4, 18, 18, 1, 6, 1, C.lens).fill(3, 18, 18, 1, 6, 1, C.lens);
    g.fill(-4, 25, -9, 8, 1, 2, C.edge).fill(-4, 25, 15, 8, 1, 2, C.edge);
  },
  action(g) { g.fill(3, 5, -7, 2, 3, 9, C.edge).fill(4, 5, -6, 4, 2, 2, C.edge).fill(7, 3, -7, 3, 4, 4, C.dark); },
  magazine(g) { boxMagazine(g, 7, -2); g.fill(-3, -7, -2, 6, 1, 8, C.edge); },
};
const registry = new Map<string, WeaponDefinition>([pistol, revolver, smg, shotgun, rifle, marksman].map(d => [d.id, d]));
registry.set('improvised-pistol', pistol);

/** Three cached greedy meshes per weapon, including the magazine on world models. */
export function createWeaponVisual(id = 'improvised-pistol', articulated = false): WeaponVisual {
  const d = registry.get(id); if (!d) throw new Error(`Unknown weapon visual: ${id}`);
  const root = new THREE.Group(); root.name = id; root.userData.weaponVisual = id; root.userData.articulated = articulated;
  const part = (name: 'frame' | 'action' | 'magazine', home: Point = [0, 0, 0]) => {
    const mesh = weaponMesh({ id: `weapon:${d.id}:${name}:v12`, unit: UNIT, build: d[name] }, home);
    mesh.name = `${d.id}-${name}`; mesh.position.set(...home); root.add(mesh); return mesh;
  };
  part('frame');
  const action = part('action', d.actionHome), magazine = part('magazine', d.magazineHome);
  magazine.visible = d.magazineKind !== 'shell';
  return {
    root, action, magazine, muzzle: new THREE.Vector3(...d.muzzle), grip: new THREE.Vector3(...d.grip),
    supportGrip: new THREE.Vector3(...d.supportGrip), ejection: new THREE.Vector3(...d.ejection),
    actionHome: new THREE.Vector3(...d.actionHome), magazineHome: new THREE.Vector3(...d.magazineHome),
    aimHeight: d.aimHeight, aimZ: d.aimZ, scale: d.scale, actionKind: d.actionKind, magazineKind: d.magazineKind,
  };
}

const finishCache = new Map<string, THREE.BufferGeometry>();
function weaponMesh(recipe: VoxelRecipe, pivot: Point): THREE.Mesh {
  const mesh = voxelMesh(recipe); let geometry = finishCache.get(recipe.id);
  if (!geometry) {
    geometry = mesh.geometry.clone(); const indices = geometry.index!, colors = geometry.getAttribute('color');
    const buckets: number[][] = [[], [], [], []], selected = new Map<string, number>();
    for (let i = 0; i < indices.count; i += 3) {
      const v = indices.getX(i), r = colors.getX(v), g = colors.getY(v), b = colors.getZ(v), key = `${r},${g},${b}`;
      let finish = selected.get(key);
      if (finish === undefined) {
        let closest = Infinity; finish = 0;
        for (const p of palette) for (const ao of [1, .86]) {
          const difference = (r - p.color.r * ao) ** 2 + (g - p.color.g * ao) ** 2 + (b - p.color.b * ao) ** 2;
          if (difference < closest) { closest = difference; finish = p.finish; }
        }
        selected.set(key, finish);
      }
      buckets[finish].push(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2));
    }
    geometry.clearGroups(); let first = 0; const merged: number[] = [];
    buckets.forEach((bucket, index) => { if (bucket.length) { geometry!.addGroup(first, bucket.length, index); merged.push(...bucket); first += bucket.length; } });
    geometry.setIndex(merged); geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    finishCache.set(recipe.id, geometry);
  }
  mesh.geometry = geometry; mesh.material = finishes; return mesh;
}
