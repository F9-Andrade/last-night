import * as THREE from 'three';

/** A model-local sparse voxel volume. Coordinates are cells, never world/map tiles. */
export class VoxelGrid {
  readonly cells = new Map<number, number>();
  readonly unit: number;
  constructor(unit: number) {
    this.unit = unit;
    if (!Number.isFinite(unit) || unit <= 0) throw new Error('Voxel unit must be positive');
  }
  static key(x: number, y: number, z: number): number { return x + 512 + (y + 512) * 1024 + (z + 512) * 1048576; }
  static coordinates(key: number): [number, number, number] { return [(key & 1023) - 512, ((key >>> 10) & 1023) - 512, (key >>> 20) - 512]; }
  get(x: number, y: number, z: number): number | undefined { if (x < -512 || x > 511 || y < -512 || y > 511 || z < -512 || z > 511) return undefined; return this.cells.get(VoxelGrid.key(x, y, z)); }
  set(x: number, y: number, z: number, color: number): this {
    if (![x, y, z].every(n => Number.isInteger(n) && n >= -512 && n < 512)) throw new Error('Voxel coordinates must be integers in [-512, 511]');
    this.cells.set(VoxelGrid.key(x, y, z), color); return this;
  }
  remove(x: number, y: number, z: number): this { this.cells.delete(VoxelGrid.key(x, y, z)); return this; }
  /** Half-open bounds. Structured recipes use fill/carve to describe detachable parts. */
  fill(x: number, y: number, z: number, w: number, h: number, d: number, color: number): this {
    for (let a = x; a < x + w; a++) for (let b = y; b < y + h; b++) for (let c = z; c < z + d; c++) this.set(a, b, c, color);
    return this;
  }
  carve(x: number, y: number, z: number, w: number, h: number, d: number): this {
    for (let a = x; a < x + w; a++) for (let b = y; b < y + h; b++) for (let c = z; c < z + d; c++) this.remove(a, b, c);
    return this;
  }
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: number, chip = 0, seed = 0): this {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
      const r = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2;
      if (r < 1 && (r < .65 || hash(x, y, z, seed) > chip)) this.set(x, y, z, color);
    }
    return this;
  }
  clone(): VoxelGrid { const clone = new VoxelGrid(this.unit); this.cells.forEach((c, k) => clone.cells.set(k, c)); return clone; }
}
export function hash(x: number, y: number, z: number, seed = 0): number {
  let n = Math.imul(x + 71, 374761393) ^ Math.imul(y + 113, 668265263) ^ Math.imul(z + seed + 29, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Six-direction greedy meshing: hidden faces omitted, equal-color neighbors merged. */
export function meshVoxels(volume: VoxelGrid): THREE.BufferGeometry {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const key of volume.cells.keys()) { const p = VoxelGrid.coordinates(key); for (let d = 0; d < 3; d++) { min[d] = Math.min(min[d], p[d]); max[d] = Math.max(max[d], p[d] + 1); } }
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  const linearColors = new Map<number, THREE.Color>();
  let quads = 0;
  if (volume.cells.size) for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, width = max[u] - min[u], height = max[v] - min[v];
    // Discover faces from occupied cells first: sparse joinery never scans its entire empty bounding box.
    const masks = new Map<number, Int32Array>(), p = [0, 0, 0];
    for (const [key, color] of volume.cells) {
      const cell = VoxelGrid.coordinates(key);
      for (const sign of [-1, 1]) {
        p[0] = cell[0]; p[1] = cell[1]; p[2] = cell[2]; p[axis] += sign;
        if (volume.get(p[0], p[1], p[2]) !== undefined) continue;
        const slice = cell[axis] + (sign > 0 ? 1 : 0);
        let mask = masks.get(slice); if (!mask) { mask = new Int32Array(width * height); masks.set(slice, mask); }
        mask[cell[u] - min[u] + (cell[v] - min[v]) * width] = sign * (color + 1);
      }
    }
    for (const slice of [...masks.keys()].sort((a, b) => a - b)) {
      const mask = masks.get(slice)!;
      for (let j = 0; j < height; j++) for (let i = 0; i < width;) {
        const code = mask[i + j * width]; if (!code) { i++; continue; }
        let w = 1, h = 1; while (i + w < width && mask[i + w + j * width] === code) w++;
        outer: while (j + h < height) { for (let k = 0; k < w; k++) if (mask[i + k + (j + h) * width] !== code) break outer; h++; }
        const color = Math.abs(code) - 1, sign = Math.sign(code), normal = [0, 0, 0]; normal[axis] = sign;
        let rgb = linearColors.get(color); if (!rgb) { rgb = new THREE.Color(color); linearColors.set(color, rgb); }
        const first = positions.length / 3;
        for (const [du, dv] of [[0, 0], [w, 0], [w, h], [0, h]]) {
          p[axis] = slice; p[u] = min[u] + i + du; p[v] = min[v] + j + dv;
          positions.push(p[0] * volume.unit, p[1] * volume.unit, p[2] * volume.unit); normals.push(...normal);
          // Soft vertex occlusion outside the face; no pixelated lighting/shadow maps.
          const a = [...p]; a[axis] += sign < 0 ? -1 : 0; a[u] += du ? 0 : -1; a[v] += dv ? 0 : -1;
          const occluded = volume.get(a[0], a[1], a[2]) !== undefined;
          const ao = occluded ? .86 : 1; colors.push(rgb.r * ao, rgb.g * ao, rgb.b * ao);
        }
        if (sign > 0) indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
        else indices.push(first, first + 2, first + 1, first, first + 3, first + 2);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[i + x + (j + y) * width] = 0;
        quads++; i += w;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geometry.setIndex(indices); if (volume.cells.size) { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
  geometry.userData = { voxelCount: volume.cells.size, quads, unit: volume.unit }; return geometry;
}

export const voxelMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .94, metalness: 0, flatShading: true });
export interface VoxelRecipe { id: string; unit: number; build: (volume: VoxelGrid) => void }
const geometryCache = new Map<string, THREE.BufferGeometry>();
const recipes = new Map<string, VoxelRecipe>();
export function voxelGeometry(recipe: VoxelRecipe): THREE.BufferGeometry {
  let geometry = geometryCache.get(recipe.id);
  if (!geometry) { const grid = new VoxelGrid(recipe.unit); recipe.build(grid); geometry = meshVoxels(grid); geometry.name = recipe.id; geometry.userData.asset = recipe.id; recipes.set(recipe.id, recipe); geometryCache.set(recipe.id, geometry); }
  return geometry;
}
export function voxelMesh(recipe: VoxelRecipe, mat: THREE.Material = voxelMaterial): THREE.Mesh {
  const mesh = new THREE.Mesh(voxelGeometry(recipe), mat); mesh.name = recipe.id; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.voxelAsset = recipe.id; return mesh;
}
/** Regenerate a private model-local volume for a future damaged variant; cached geometry is immutable. */
export function editableVolume(id: string): VoxelGrid {
  const recipe = recipes.get(id); if (!recipe) throw new Error(`Unknown voxel asset: ${id}`);
  const grid = new VoxelGrid(recipe.unit); recipe.build(grid); return grid;
}
export function voxelStats(): { assets: number; voxels: number; quads: number; geometryBytes: number } {
  let voxels = 0, quads = 0, geometryBytes = 0;
  geometryCache.forEach(g => { voxels += g.userData.voxelCount; quads += g.userData.quads; Object.values(g.attributes).forEach(a => { geometryBytes += a.array.byteLength; }); geometryBytes += g.index?.array.byteLength ?? 0; });
  return { assets: geometryCache.size, voxels, quads, geometryBytes };
}
