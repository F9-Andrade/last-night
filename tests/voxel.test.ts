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

test('detailed infected keep bounded shared meshes, deterministic variants and original rig anchors',()=>{
 const kinds=['walker','runner','tank','spitter','screamer'] as const;
 for(const kind of kinds)for(let variant=0;variant<3;variant++){
  const a=new Character(true,variant),b=new Character(true,variant+3);a.setKind(kind);b.setKind(kind);
  const meshes:THREE.Mesh[]=[],duplicates:THREE.Mesh[]=[];
  a.root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});b.root.traverse(o=>{if(o instanceof THREE.Mesh)duplicates.push(o);});
  assert.equal(meshes.length,7);assert.deepEqual(meshes.map(m=>m.geometry),duplicates.map(m=>m.geometry));
  assert.ok(meshes.reduce((n,m)=>n+m.geometry.index!.count/3,0)<2500,`${kind} geometry budget`);
  for(const part of ['head','torso','left-arm','right-arm','left-leg','right-leg'] as const){
   const recipe=characterPart(part,true,variant,kind),geometry=voxelGeometry(recipe),grid=new VoxelGrid(recipe.unit);recipe.build(grid);
   const rebuilt=meshVoxels(grid);assert.deepEqual(geometry.attributes.position.array,rebuilt.attributes.position.array);rebuilt.dispose();
   assert.equal(recipe.unit,.04);assert.ok(geometry.boundingSphere!.radius<1.4);
  }
  assert.deepEqual(a.head.position.toArray(),b.head.position.toArray());a.dispose();b.dispose();
 }
 assert.equal(characterPart('head',false).unit,.08);assert.equal(characterPart('head',false).id,'survivor:head:v11');
});

import {Ragdoll} from '../src/render/ragdoll.ts';
test('ragdoll gravity and constrained joints settle deterministically at 30/60/144 Hz without drifting forever',()=>{
 const positions=[[0,.84,0],[0,1.43,0],[0,1.83,.18],[-.45,1.37,0],[.45,1.32,0],[-.45,1.1,.6],[.45,1.1,.6],[-.23,.14,.13],[.23,.14,.13]];
 const points=positions.map(p=>({position:new THREE.Vector3(...p),radius:.13,mass:1}));
 const links:[number,number][]=[[0,1],[1,2],[0,2],[0,3],[1,3],[0,4],[1,4],[3,4],[3,5],[4,6],[0,7],[0,8],[7,8]];
 const runs=[30,60,144].map(fps=>{const r=new Ragdoll(points,links,new THREE.Vector3(.3,.04,.6),11);for(let time=0;time<3;time+=1/fps)r.advance(time);return r;});
 for(const r of runs){assert.ok(r.settled);assert.deepEqual(r.positions,runs[0].positions);assert.ok(r.positions[1].y<.65);for(const p of r.positions){assert.ok(p.y>=.13);assert.ok(p.length()<3);}for(const [a,b]of links)assert.ok(Math.abs(r.positions[a].distanceTo(r.positions[b])-points[a].position.distanceTo(points[b].position))<.035);const end=r.positions.map(p=>p.clone());r.advance(500);assert.deepEqual(r.positions,end);}
});

test('infected idle, walk transitions and hit reactions animate without mutating gameplay',async()=>{
 const {Simulation}=await import('../src/game/simulation.ts');const sim=new Simulation(),z=sim.zombies[0],c=new Character(true,0);
 c.animateInfected(z,1/60,0,false);const initial=c.head.rotation.toArray();for(let i=1;i<60;i++)c.animateInfected(z,1/60,i/60,false);assert.notDeepEqual(c.head.rotation.toArray(),initial);
 const still=c.leftLeg.rotation.x;for(let i=0;i<30;i++){z.x+=.025;z.gait+=.06;c.animateInfected(z,1/60,1+i/60,false);}assert.ok(Math.abs(c.leftLeg.rotation.x-still)>.01);
 z.hp-=10;z.reaction=.28;z.zone='HEAD';const snapshot=structuredClone(z);c.animateInfected(z,1/60,2,false);const hit=c.head.rotation.x;
 for(let i=0;i<60;i++)c.animateInfected(z,1/60,2+i/60,false);assert.ok(c.head.rotation.x>hit+.1);assert.deepEqual(z,snapshot);c.dispose();
});

test('craft tool geometry is shared and tree harvesting updates original instances without extra city meshes',async()=>{
 const {CraftingView,meleeRecipe,benchRecipe}=await import('../src/render/crafting-view.ts');
 const {Simulation}=await import('../src/game/simulation.ts');
 const scene=new THREE.Scene(),tree=new THREE.InstancedMesh(voxelGeometry(treeRecipe(0)),new THREE.MeshStandardMaterial(),1);tree.name='voxel-trees-0';const m=new THREE.Matrix4().makeTranslation(-7,.15,-10);tree.setMatrixAt(0,m);scene.add(tree);
 const view=new CraftingView(scene),s=new Simulation(),t=s.crafting.trees.find(t=>t.x===-7&&t.z===-10)!;const count=scene.children.length;
 t.hp=0;view.update(s,false);const dead=new THREE.Matrix4();tree.getMatrixAt(0,dead);assert.equal(dead.determinant(),0);t.hp=100;view.update(s,false);tree.getMatrixAt(0,dead);assert.ok(dead.elements.every((v,i)=>Math.abs(v-m.elements[i])<1e-6));assert.equal(scene.children.length,count);
 for(const id of ['club','knife','axe','spear','machete'] as const){const g=voxelGeometry(meleeRecipe(id));assert.ok(g.index!.count>0);assert.ok(g.index!.count/3<2500);assert.equal(voxelGeometry(meleeRecipe(id)),g);}
 assert.ok(voxelGeometry(benchRecipe).index!.count/3<5000);
});
