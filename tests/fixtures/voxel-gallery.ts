import * as THREE from 'three';
import { Character } from '../../src/render/models';
import { createWeaponVisual } from '../../src/render/weapon-assets';
import { carRecipe, treeRecipe } from '../../src/render/environment-assets';
import { voxelMesh } from '../../src/render/voxel';

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#gallery')!, antialias: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const front = new Character(), back = new Character(), walker = new Character(true, 1), pistol = createWeaponVisual(); back.root.rotation.y = Math.PI * 1.2; front.root.rotation.y = .4; walker.root.rotation.y = .2;
walker.animate(1.3, true, false, 0);
const models = [front.root, back.root, walker.root, pistol.root, voxelMesh(carRecipe('pickup', 0x96a398)), voxelMesh(treeRecipe(0))];
const spans = [3, 3, 3, .95, 5.3, 6.8], heights = [1.15, 1.15, 1.15, -.015, .8, 2.7];
renderer.setScissorTest(true);
models.forEach((model, i) => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(i % 2 ? 0xc5ccb7 : 0xb9c4b0); scene.add(model);
  const sun = new THREE.DirectionalLight(0xffe1b1, 3); sun.position.set(-4, 8, 5); sun.castShadow = true; sun.shadow.mapSize.set(512, 512); sun.shadow.camera.left = -5; sun.shadow.camera.right = 5; sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -5; sun.shadow.normalBias = .035; scene.add(sun, new THREE.HemisphereLight(0xd4e5db, 0x707e61, 2));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xc5ccb7 : 0xb9c4b0, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = i === 3 ? -.35 : -.01; floor.receiveShadow = true; scene.add(floor);
  const w = innerWidth / 3, h = (innerHeight - 62) / 2, size = spans[i];
  const camera = new THREE.OrthographicCamera(-size * w / h / 2, size * w / h / 2, size / 2, -size / 2, .1, 100); camera.position.set(6, 4.6 + heights[i], 8); camera.lookAt(0, heights[i], 0);
  renderer.setViewport(i % 3 * w, i < 3 ? h : 0, w, h); renderer.setScissor(i % 3 * w, i < 3 ? h : 0, w, h); renderer.render(scene, camera);
});
document.body.dataset.ready = 'true';
