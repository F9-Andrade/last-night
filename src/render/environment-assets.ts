import { VoxelGrid, hash } from './voxel.ts';
import type { VoxelRecipe } from './voxel.ts';

/** World-unit cuboids are snapped only inside the asset, never across the terrain. */
export function voxelBox(g: VoxelGrid, x: number, y: number, z: number, w: number, h: number, d: number, color: number): void {
  const u = g.unit, min = [Math.round((x - w / 2) / u), Math.round((y - h / 2) / u), Math.round((z - d / 2) / u)];
  g.fill(min[0], min[1], min[2], Math.max(1, Math.round(w / u)), Math.max(1, Math.round(h / u)), Math.max(1, Math.round(d / u)), color);
}
export function treeRecipe(variant = 0): VoxelRecipe {
  return { id: `tree:ash-${variant}:v1`, unit: .24, build(g) {
    g.fill(-1, 0, -1, 3, 7, 3, 0x64634c).fill(0, 7, -1, 2, 8, 2, 0x747055);
    for (let j = 0; j < 8; j++) {
      g.fill(-1 - Math.floor(j / 2), 6 + j, 0, 2, 2, 2, 0x65664e);
      g.fill(1 + Math.floor(j / 2), 8 + j, -Math.floor(j / 3), 2, 2, 2, 0x6f6a4d);
    }
    g.fill(-2, 0, -1, 5, 1, 3, 0x65664e).fill(-1, 0, -2, 3, 1, 5, 0x65664e);
    // Small bark chips and exposed branch steps prevent a single uniform block trunk.
    g.fill(-2, 2, 0, 1, 3, 1, 0x7d7655).fill(2, 4, -1, 1, 2, 2, 0x565d47);
    g.fill(-1, 6, 2, 1, 2, 1, 0x8b805b).set(1, 9, 1, 0x92845d).set(-1, 1, -2, 0x7b7250);
    const base = [0x697f53, 0x7e8958, 0x587657][variant % 3];
    g.ellipsoid(-3, 13, 1, 5.3, 4.3, 5.2, base, .20, variant);
    g.ellipsoid(3, 15, -1, 5.3, 5.2, 4.8, base, .22, variant + 8);
    g.ellipsoid(0, 19, 0, 4.3, 4.1, 4.3, base, .18, variant + 2);
    for (const [key, c] of g.cells) if (c === base) {
      const [x, y, z] = VoxelGrid.coordinates(key), h = hash(Math.floor(x / 3), Math.floor(y / 2), Math.floor(z / 3), variant);
      if (h > .72) g.cells.set(key, [0x879566, 0x999c6b, 0x78906b][variant % 3]);
      else if (h < .18) g.cells.set(key, 0x50694d);
    }
  } };
}
export function shrubRecipe(): VoxelRecipe {
  return { id: 'plant:bramble:v1', unit: .12, build(g) {
    g.ellipsoid(-2, 3, 0, 4, 3.5, 4, 0x758458, .22, 3).ellipsoid(3, 4, -1, 3.5, 4, 3, 0x8a9260, .18, 7);
    g.fill(-3, 0, -1, 1, 4, 1, 0x736b4b).fill(2, 0, 0, 1, 4, 1, 0x736b4b);
  } };
}
export function grassRecipe(): VoxelRecipe {
  return { id: 'plant:grass:v1', unit: .08, build(g) {
    g.fill(-1, 0, -1, 1, 4, 1, 0x909468).fill(1, 0, 1, 1, 3, 1, 0x79885d).fill(0, 0, 0, 1, 5, 1, 0x87905e);
    g.set(-2, 3, -1, 0x909468).set(0, 5, 1, 0x87905e).set(2, 2, 1, 0x79885d);
  } };
}

export type CarVariant = 'sedan' | 'pickup' | 'wreck' | 'police';
export function carRecipe(variant: CarVariant, paint: number): VoxelRecipe {
  return { id: `car:${variant}:${paint}:v1`, unit: .1, build(g) {
    g.fill(-8, 4, -18, 16, 4, 36, paint).fill(-9, 5, -16, 18, 3, 32, paint);
    g.fill(-7, 8, -14, 14, 2, 28, paint); g.fill(-6, 4, -19, 12, 2, 1, 0x4d5953);
    for (const x of [-10, 8]) for (const z of [-12, 12]) {
      g.ellipsoid(x + 1, 4, z, 2, 4, 4, 0x283531);
      g.fill(x + (x < 0 ? -1 : 2), 2, z - 2, 1, 4, 4, 0x7a8275).fill(x + (x < 0 ? -1 : 2), 3, z - 1, 1, 2, 2, 0x4b5b53);
      g.fill(x + (x < 0 ? 1 : -1), 8, z - 3, 2, 1, 6, paint);
    }
    // Recessed cabin and staircase windshield give a sculpted, small-voxel profile.
    const cabBack = variant === 'pickup' ? -2 : -10;
    g.fill(-7, 10, cabBack, 14, 4, 15 - (variant === 'pickup' ? 6 : 0), 0x3d5b60);
    g.fill(-6, 14, cabBack + 1, 12, 2, 11 - (variant === 'pickup' ? 6 : 0), paint);
    for (const x of [-7, 6]) { g.fill(x, 10, cabBack, 1, 4, 1, paint).fill(x, 10, 3, 1, 3, 1, paint).fill(x, 10, -3, 1, 4, 1, paint); }
    for (let i = 0; i < 4; i++) g.fill(-6, 10 + i, 7 - i, 12, 1, 1, 0x4b6c6c);
    g.fill(-7, 9, 7, 14, 1, 7, paint).fill(-8, 7, 16, 16, 2, 2, paint).fill(-8, 4, 18, 16, 2, 1, 0x929887);
    g.fill(-4, 6, 18, 8, 2, 1, 0x374b47);
    for (const x of [-7, 4]) { g.fill(x, 7, 18, 3, 2, 1, 0xd8c393).fill(x, 6, -19, 3, 2, 1, 0x9e654d); }
    g.fill(-9, 10, 4, 2, 2, 2, paint).fill(7, 10, 4, 2, 2, 2, paint);
    g.fill(-10, 10, 4, 1, 1, 2, 0x7e8b7c).fill(9, 10, 4, 1, 1, 2, 0x7e8b7c);
    for (const x of [-10, 9]) { g.fill(x, 7, -2, 1, 1, 3, 0x8c9584); g.fill(x, 5, -6, 1, 1, 12, 0x7a6951); }
    if (variant === 'pickup') {
      g.carve(-6, 8, -16, 12, 6, 12).fill(-6, 7, -16, 12, 1, 12, 0x696a53);
      g.fill(-8, 8, -17, 2, 3, 13, paint).fill(6, 8, -17, 2, 3, 13, paint).fill(-8, 8, -18, 16, 3, 2, paint);
      g.fill(-4, 8, -14, 5, 4, 5, 0x99875e).fill(-4, 8, -14, 1, 4, 5, 0x665e44);
    }
    if (variant === 'police') {
      g.fill(-10, 7, -7, 1, 3, 14, 0x304854).fill(9, 7, -7, 1, 3, 14, 0x304854);
      g.fill(-4, 16, -3, 8, 1, 3, 0x34474b).fill(-4, 17, -3, 3, 1, 3, 0xac644e).fill(1, 17, -3, 3, 1, 3, 0x769aa0);
      g.fill(-10, 8, -1, 1, 2, 3, 0xcfbe89).fill(9, 8, -1, 1, 2, 3, 0xcfbe89);
    }
    if (variant === 'wreck') {
      g.carve(-7, 10, 1, 4, 4, 7).carve(-6, 9, 10, 8, 2, 6).fill(-6, 8, 10, 8, 1, 6, 0x394440);
      g.fill(-5, 9, 11, 3, 1, 3, 0x8b8a72).fill(-8, 9, 13, 2, 3, 5, 0x795d44);
      g.carve(7, 8, 14, 3, 2, 4).carve(-7, 7, 18, 2, 2, 1);
    }
    for (const [key, c] of g.cells) if (c === paint) {
      const [x, y, z] = VoxelGrid.coordinates(key);
      if (hash(Math.floor(x / 2), Math.floor(y / 2), Math.floor(z / 3), 20) > (variant === 'wreck' ? .78 : .95)) g.cells.set(key, 0x8c7353);
    }
  } };
}

export type PropKind = 'crate' | 'ammo' | 'med' | 'bag' | 'bin' | 'pallet' | 'cone' | 'hydrant' | 'bench' | 'mailbox' | 'rubble' | 'pump';
export function propRecipe(kind: PropKind): VoxelRecipe {
  return { id: `prop:${kind}:v1`, unit: .08, build(g) {
    if (kind === 'crate' || kind === 'ammo' || kind === 'med') {
      const wood = kind === 'med' ? 0xc6c4ab : kind === 'ammo' ? 0x858968 : 0x9b885f;
      g.fill(-5, 0, -4, 10, 7, 8, wood).fill(-6, 7, -5, 12, 1, 10, kind === 'med' ? 0xded4b0 : 0xb0a271);
      for (const x of [-4, 3]) g.fill(x, 0, -5, 1, 8, 10, kind === 'crate' ? 0x6e6a4d : 0x4a6050);
      g.fill(-1, 6, 4, 2, 2, 1, 0xd6bd82).fill(-2, 4, -5, 4, 1, 1, 0x4c5b46);
      if (kind === 'med') { g.fill(-1, 2, 5, 2, 4, 1, 0xad6954).fill(-2, 3, 5, 4, 2, 1, 0xad6954); g.fill(-1, 8, -2, 2, 1, 4, 0xad6954).fill(-2, 8, -1, 4, 1, 2, 0xad6954); }
      if (kind === 'ammo') { g.fill(-3, 8, -2, 1, 1, 4, 0xc6b584).fill(0, 8, -2, 1, 1, 4, 0xc6b584).fill(3, 8, -2, 1, 1, 4, 0xc6b584); }
    } else if (kind === 'bag') {
      g.ellipsoid(0, 4, 0, 4.8, 4.6, 4.2, 0x485749, .02).fill(-1, 8, -1, 2, 2, 2, 0x303e35);
      g.fill(-2, 9, 0, 4, 1, 1, 0x76816b).fill(-3, 3, 3, 2, 3, 1, 0x53614e);
    } else if (kind === 'bin') {
      g.fill(-5, 2, -4, 10, 11, 8, 0x536c59).fill(-6, 13, -5, 12, 2, 10, 0x3e574a);
      g.fill(-3, 5, 4, 6, 5, 1, 0x627b62).fill(-2, 14, 1, 4, 2, 1, 0x809178);
      g.fill(-6, 0, -4, 2, 3, 3, 0x293c33).fill(4, 0, -4, 2, 3, 3, 0x293c33).fill(-1, 8, 5, 2, 1, 1, 0xc1b47f);
    } else if (kind === 'pallet') {
      for (const x of [-6, 0, 6]) g.fill(x, 0, -6, 2, 2, 14, 0x7a7151);
      for (let z = -6; z < 8; z += 3) g.fill(-7, 2, z, 16, 1, 2, z % 2 ? 0xa28c61 : 0x92815b);
    } else if (kind === 'cone') {
      g.fill(-4, 0, -4, 8, 1, 8, 0x4c5140);
      for (let y = 1; y < 9; y++) { const r = Math.max(1, 4 - Math.floor(y / 2)); g.fill(-r, y, -r, r * 2, 1, r * 2, y === 4 || y === 5 ? 0xcac0a0 : 0xb37b4d); }
    } else if (kind === 'hydrant') {
      g.fill(-3, 0, -3, 6, 1, 6, 0x606452).fill(-2, 1, -2, 4, 9, 4, 0xa76f4e).fill(-3, 8, -3, 6, 2, 6, 0xb18257).fill(-1, 10, -1, 2, 1, 2, 0x8c855f);
      g.fill(-4, 5, -1, 8, 2, 2, 0xa7784f).fill(-1, 5, 2, 2, 2, 1, 0x7c7e60);
    } else if (kind === 'bench') {
      for (const x of [-9, 8]) g.fill(x, 0, -3, 2, 7, 2, 0x42584b).fill(x, 0, 3, 2, 5, 2, 0x42584b);
      for (const z of [-2, 1, 4]) g.fill(-11, 5, z, 24, 1, 2, 0x9a8961);
      for (const y of [8, 11]) g.fill(-11, y, -3, 24, 2, 1, 0x9a8961);
    } else if (kind === 'mailbox') {
      g.fill(-1, 0, -1, 2, 10, 2, 0x647360).fill(-3, 10, -4, 6, 4, 9, 0x6b8070).fill(-2, 14, -3, 4, 1, 7, 0x7d907b);
      g.fill(-2, 11, 5, 4, 1, 1, 0x334e45).fill(3, 12, 0, 1, 4, 1, 0xae7754).fill(3, 15, 0, 1, 1, 3, 0xae7754);
    } else if (kind === 'rubble') {
      g.fill(-5, 0, -2, 4, 2, 4, 0x999d84).fill(-2, 0, -3, 5, 3, 4, 0x7c846f).fill(2, 0, 1, 3, 1, 5, 0xaeab8d).fill(-2, 3, -1, 2, 1, 2, 0xb8ae8d);
    } else if (kind === 'pump') {
      g.fill(-5, 0, -4, 10, 4, 8, 0xa97855).fill(-5, 4, -4, 10, 14, 8, 0xc2bda0).fill(-6, 18, -5, 12, 2, 10, 0x9aab97);
      g.fill(-4, 12, 4, 8, 4, 1, 0x314c49).fill(-3, 13, 5, 6, 1, 1, 0xabc2a1).fill(-4, 6, 4, 8, 4, 1, 0x9e6c51);
      g.fill(6, 6, -1, 1, 11, 1, 0x334840).fill(5, 5, -1, 2, 1, 1, 0x334840).fill(5, 15, 0, 1, 2, 2, 0x667d67);
    }
  } };
}
