import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid, meshVoxels, voxelGeometry, editableVolume, hash } from '../src/render/voxel.ts';
import { characterPart } from '../src/render/character-assets.ts';
import { carRecipe, treeRecipe, propRecipe } from '../src/render/environment-assets.ts';
import { Character } from '../src/render/models.ts';
import * as THREE from 'three';

test('solid voxel blocks merge to six exterior quads, with outward-facing triangles', () => {
  const geometry = meshVoxels(new VoxelGrid(.1).fill(0, 0, 0, 10, 10, 10, 0xaabbcc));
  assert.equal(geometry.userData.voxelCount, 1000); assert.equal(geometry.userData.quads, 6); assert.equal(geometry.index!.count, 36);
  const vertices = geometry.attributes.position, normals = geometry.attributes.normal;
  for (let i = 0; i < geometry.index!.count; i += 3) {
    const ids = [0, 1, 2].map(k => geometry.index!.getX(i + k));
    const [a, b, c] = ids.map(k => new THREE.Vector3().fromBufferAttribute(vertices, k));
    assert.ok(b.sub(a).cross(c.sub(a)).dot(new THREE.Vector3().fromBufferAttribute(normals, ids[0])) > 0);
  }
  geometry.dispose();
});
test('different colors retain boundaries while shared internal faces disappear', () => {
  const grid = new VoxelGrid(1).set(0, 0, 0, 0).set(1, 0, 0, 0xffffff), geometry = meshVoxels(grid);
  assert.equal(geometry.userData.quads, 10); assert.equal(geometry.attributes.color.count, geometry.attributes.position.count);
  assert.ok(Array.from(geometry.attributes.color.array).every(v => Number.isFinite(v) && v >= 0 && v <= 1)); geometry.dispose();
});
test('empty volumes and signed coordinate limits are handled without aliasing', () => {
  const empty = meshVoxels(new VoxelGrid(.2)); assert.equal(empty.index!.count, 0); empty.dispose();
  const grid = new VoxelGrid(.1).set(511, 0, 0, 0xffffff).set(-512, 1, 0, 0xffffff);
  assert.equal(grid.get(512, 0, 0), undefined); assert.equal(meshVoxels(grid).userData.quads, 12);
  assert.throws(() => grid.set(512, 0, 0, 1)); assert.throws(() => new VoxelGrid(0));
});
test('cache reuses immutable geometry and supports independent editable parts', () => {
  const recipe = propRecipe('crate'), a = voxelGeometry(recipe), b = voxelGeometry(recipe);
  assert.equal(a, b); const edit = editableVolume(recipe.id); const originalCount = a.userData.voxelCount;
  edit.carve(-6, 0, -6, 12, 5, 12); assert.ok(edit.cells.size < originalCount); assert.equal(a.userData.voxelCount, originalCount);
  assert.equal(editableVolume(recipe.id).cells.size, originalCount);
});
test('greedy surface area agrees with exposed cells, including cavities and disconnected fragments', () => {
  const grid = new VoxelGrid(.2);
  for (let x = -3; x < 4; x++) for (let y = -3; y < 4; y++) for (let z = -3; z < 4; z++) if (hash(x, y, z) > .35) grid.set(x, y, z, 0x81916b);
  let exposed = 0;
  for (const key of grid.cells.keys()) {
    const p = VoxelGrid.coordinates(key);
    for (let axis = 0; axis < 3; axis++) for (const direction of [-1, 1]) { const q = [...p]; q[axis] += direction; if (grid.get(q[0], q[1], q[2]) === undefined) exposed++; }
  }
  const geometry = meshVoxels(grid), vertices = geometry.attributes.position; let area = 0;
  for (let i = 0; i < geometry.index!.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(vertices, geometry.index!.getX(i + k)));
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  assert.ok(Math.abs(area - exposed * .04) < .0001); geometry.dispose();
});
test('detailed asset recipes stay within geometry budgets and regenerate deterministically', () => {
  const recipes = [characterPart('torso', false), characterPart('head', true), carRecipe('wreck', 0xaa8866), treeRecipe(1)];
  for (const recipe of recipes) {
    const geometry = voxelGeometry(recipe), rebuilt = meshVoxels(editableVolume(recipe.id));
    assert.deepEqual(geometry.attributes.position.array, rebuilt.attributes.position.array);
    assert.ok(geometry.userData.voxelCount > 100); assert.ok(geometry.index!.count / 3 < 12000, recipe.id);
    assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite)); rebuilt.dispose();
  }
});
test('articulated characters reuse part geometry and use a bounded mesh count', () => {
  const a = new Character(true, 0), b = new Character(true, 0); const ga: THREE.BufferGeometry[] = [], gb: THREE.BufferGeometry[] = [];
  a.root.traverse(o => { if (o instanceof THREE.Mesh) ga.push(o.geometry); }); b.root.traverse(o => { if (o instanceof THREE.Mesh) gb.push(o.geometry); });
  assert.equal(ga.length, 7); assert.deepEqual(ga, gb);
  a.animate(1.4, true, false, 0); assert.notEqual(a.leftLeg.rotation.x, a.rightLeg.rotation.x);
});
