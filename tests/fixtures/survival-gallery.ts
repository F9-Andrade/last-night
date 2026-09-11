import * as THREE from 'three';
import { voxelMesh } from '../../src/render/voxel';
import { barricadeRecipe, containerRecipe, itemRecipe } from '../../src/render/survival-assets';
const models: THREE.Object3D[] = [0, 1, 2, 3].map(stage => voxelMesh(barricadeRecipe(3.2, stage)));
for (const pair of [['med', 'med'], ['wood', 'scrap'], ['ammo', 'rare']] as const) {
  const group = new THREE.Group(); pair.forEach((key, i) => { const mesh = i === 0 && key === 'med' ? voxelMesh(containerRecipe('hospital', false)) : voxelMesh(itemRecipe(key)); mesh.position.x = i ? .75 : -.65; group.add(mesh); if (i === 0 && key === 'med') { const lid = voxelMesh(containerRecipe('hospital', true)); lid.position.set(-.65, .74, -.4); group.add(lid); } }); models.push(group);
}
const container = new THREE.Group(); container.add(voxelMesh(containerRecipe('gas', false))); const lid = new THREE.Group(); lid.position.set(0, .74, -.4); lid.rotation.x = -1.8; lid.add(voxelMesh(containerRecipe('gas', true))); container.add(lid); models.push(container);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#gallery')!, antialias: true }); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.setScissorTest(true);
models.forEach((model, i) => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(i % 2 ? 0xc5ccb7 : 0xb9c4b0); scene.add(model);
  const sun = new THREE.DirectionalLight(0xffe1b1, 3); sun.position.set(-4, 8, 5); scene.add(sun, new THREE.HemisphereLight(0xd4e5db, 0x707e61, 2));
  const w = innerWidth / 4, h = (innerHeight - 60) / 2, span = i < 4 ? 4.2 : 3.1;
  const camera = new THREE.OrthographicCamera(-span * w / h / 2, span * w / h / 2, span / 2, -span / 2, .1, 100); camera.position.set(3, 3.5, 7); camera.lookAt(0, i < 4 ? .7 : .5, 0);
  renderer.setViewport(i % 4 * w, i < 4 ? h : 0, w, h); renderer.setScissor(i % 4 * w, i < 4 ? h : 0, w, h); renderer.render(scene, camera);
}); document.body.dataset.ready = 'true';
