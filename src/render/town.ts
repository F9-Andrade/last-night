import {spatialBatch} from './spatial-batch';
import { TREE_POSITIONS } from '../game/world';
import { hasInterior, ROOM_PROPS } from '../game/interiors';
import { createDistricts } from './districts';
import { ROADS } from '../game/districts';
import * as THREE from 'three';
import { BUILDINGS, CARS, collides, WORLD_LIMIT } from '../game/world';
import type { Building } from '../game/world';
import { box, textSign, batch } from './models';
import { voxelGeometry, voxelMesh, voxelMaterial } from './voxel';
import { carRecipe, treeRecipe, shrubRecipe, grassRecipe, propRecipe, voxelBox } from './environment-assets';
import { buildingRecipes, gasShopRecipe } from './building-assets';
import { surfaceBatchMaterial } from './surface-materials';
import { facadeWeathering } from './facade-weathering';

export interface Town { chunks: THREE.Group[]; buildings: { group: THREE.Group; data: Building; materials: THREE.Material[] }[]; lamps: THREE.MeshStandardMaterial; lights: THREE.PointLight[]; emergency: THREE.MeshStandardMaterial; supplies: THREE.Group[] }
let seed = 85;
function random(): number { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

function building(parent: THREE.Object3D, b: Building): THREE.Group {
  const g = new THREE.Group(); g.name = `building:${b.kind}:${b.x}:${b.z}`; g.position.set(b.x, 0, b.z); parent.add(g);
  const { w, d, h } = b;
  box(g, 0, hasInterior(b)?.02:.15, 0, w + .6, hasInterior(b)?.08:.3, d + .6, 0x6b766e, 'paving');
  for (const recipe of buildingRecipes(b)) { const kind = recipe.id.includes(':shell:') ? 'plaster' : recipe.id.endsWith(':roof') ? 'roof' : 'voxel'; g.add(voxelMesh(recipe, surfaceBatchMaterial(kind))); }
  if (b.kind === 'market') {
    g.add(voxelMesh({ id: 'market:awning:v1', unit: .1, build(grid) {
      for (let z = 0; z < 23; z++) voxelBox(grid, 0, 3.6 - Math.floor(z / 5) * .1, d / 2 + z * .1, w + .3, .2, .1, 0xae7955);
      for (let i = 0; i < 24; i++) voxelBox(grid, -w / 2 + i * .5 + .25, 3.1, d / 2 + 2.2, .5, .4, .1, i % 2 ? 0xc4b998 : 0xa46b4e);
    } }));
    textSign(g, b.label, 0, 4.14, d / 2 + .25, 6, .82, '#415c4c');
    for (const x of [-4.5, 4.5]) { const crate = voxelMesh(propRecipe('crate')); crate.position.set(x, 0, d / 2 + 1); g.add(crate); }
  } else if (b.kind === 'hospital') textSign(g, b.label, 1, 4.8, d / 2 + .25, 6, .85, '#b5b89e', '#3c605c');
  else if (b.kind === 'police') {
    textSign(g, b.label, 1, 3.95, d / 2 + .25, 5, .8, '#344e5c');
    box(g, 4, h + 2, -2, .1, 4, .1, 0x374c4d); box(g, 4.7, h + 3, -2, 1.4, .8, .08, 0xaaa575);
  } else if (b.kind === 'base') textSign(g, b.label, 0, 3.05, d / 2 + .25, 3.1, .62, '#334e49', '#d8dbb5');
  facadeWeathering(g,w,d,h,1,Math.round(b.x*17+b.z*11));
  const roof=hasInterior(b)?g.children.find(o=>String(o.userData.voxelAsset).endsWith(':roof')):undefined;roof?.removeFromParent();
  const reusable=b.kind==='house'&&Math.max(Math.abs(b.x),Math.abs(b.z))>39?g.children.filter(o=>o instanceof THREE.Mesh&&/:(roof|joinery|ivy)$/.test(String(o.userData.voxelAsset))):[];
  reusable.forEach(o=>o.removeFromParent());batch(g);reusable.forEach(o=>g.add(o));
  // FPS keeps walls and roofs opaque, so immutable surface paint can be shared citywide.
  if(roof){(roof as THREE.Mesh).material=surfaceBatchMaterial('roof');g.add(roof);g.userData.interiorRoof=roof;}
  if(hasInterior(b)){
    const room=new THREE.Group();room.name='furnished-interior';room.position.copy(g.position);parent.add(room);
    box(room,0,.06,0,w-.6,.08,d-.6,b.kind==='hospital'?0xabb4a0:0x8a9782,'paving');
    for(const p of ROOM_PROPS[b.kind]??[]){
      if(p.kind==='bed'){box(room,p.x,.65,p.z,p.w,.24,p.d,0x6b8275);box(room,p.x,.83,p.z,p.w-.15,.18,p.d-.2,0xc1c5a8);box(room,p.x,.96,p.z-1,.9,.1,.5,0xe0d6b6);for(const x of [-.55,.55])for(const z of [-1.2,1.2])box(room,p.x+x,.4,p.z+z,.1,.5,.1,0x5f776b);}
      else if(p.kind==='shelf'){for(const y of [.3,.85,1.4]){box(room,p.x,y,p.z,p.w,.1,p.d,0x6a7b61);for(let i=0;i<4;i++)box(room,p.x,y+.17,p.z-p.d*.35+i*p.d*.23,p.w*.7,.23,.35,i%2?0xb0996a:0x8b9371);}for(const z of [-p.d/2,p.d/2])box(room,p.x,1,p.z+z,p.w,1.8,.1,0x526954);}
      else{box(room,p.x,.95,p.z,p.w,.14,p.d,0xa29972);box(room,p.x,.5,p.z,p.w-.3,.8,p.d-.3,0x637763);box(room,p.x-.4,1.08,p.z,.5,.12,.3,0xd4c6a2);}
    }
    batch(room);g.userData.interiorRoom=room;
  }
  return g;
}

export function createTown(scene: THREE.Scene): Town {
  seed = 85;
  const staticWorld = new THREE.Group(); scene.add(staticWorld);
  const town: Town = { chunks: [], buildings: [], lamps: new THREE.MeshStandardMaterial({ color: 0xf5cc83, emissive: 0xffc77c, emissiveIntensity: .1 }), lights: [], emergency: new THREE.MeshStandardMaterial({ color: 0xb58b6c, emissive: 0xe39b65, emissiveIntensity: 0 }), supplies: [] };
  town.chunks=createDistricts(scene,town.lamps);
  box(staticWorld, 0, -.45, 0, WORLD_LIMIT*2+90, .7, WORLD_LIMIT*2+90, 0x626951,'earth');
  for(const r of ROADS) {box(staticWorld,r.x,-.065,r.z,r.w,.12,r.d,0x535b60,'asphalt');for(let n=-Math.max(r.w,r.d)/2+4;n<Math.max(r.w,r.d)/2-4;n+=6){if(r.w>r.d)box(staticWorld,r.x+n,.015,r.z,2,.02,.12,0xb5af85);else box(staticWorld,r.x,.015,r.z+n,.12,.02,2,0xb5af85);}}
  // Four orderly city blocks, with weathered asphalt and raised sidewalks.
  box(staticWorld, -12, -.055, 0, 9, .14, 80, 0x535b60,'asphalt'); box(staticWorld, 15, -.055, 0, 7, .14, 80, 0x535b60,'asphalt');
  box(staticWorld, 0, -.04, 13, 80, .16, 8, 0x535b60,'asphalt'); box(staticWorld, 0, -.04, -16, 80, .16, 5, 0x535b60,'asphalt');
  const lots = [{ x: -26, z: -5, w: 16, d: 16 }, { x: 1.5, z: -3, w: 18, d: 24 }, { x: 27, z: -3, w: 17, d: 18 }, { x: 26, z: -27, w: 18, d: 18 }, { x: -26, z: -28, w: 16, d: 17 }, { x: 1.5, z: -28, w: 18, d: 17 }, { x: 1, z: 28, w: 19, d: 18 }, { x: 26, z: 28, w: 18, d: 18 }, { x: -26, z: 28, w: 17, d: 18 }];
  for (const lot of lots) {
    box(staticWorld, lot.x, .03, lot.z, lot.w + 1, .22, lot.d + 1, 0xaaa992,'paving');
    box(staticWorld, lot.x, .15, lot.z, lot.w - .8, .07, lot.d - .8, 0x7c8c6c,'earth');
  }
  for (let z = -36; z <= 38; z += 5) if (Math.abs(z - 13) > 6 && Math.abs(z + 16) > 4) box(staticWorld, -12, .035, z, .15, .02, 2.1, 0xc2b781);
  for (let x = -37; x < 39; x += 5) if (Math.abs(x + 12) > 6 && Math.abs(x - 15) > 5) box(staticWorld, x, .055, 13, 2.1, .02, .14, 0xc2b781);
  for (const center of [-12, 15]) for (let i = 0; i < 6; i++) { box(staticWorld, center - 2.8 + i * 1.1, .06, 7.8, .65, .03, 2, 0xc6c5ae); box(staticWorld, center - 2.8 + i * 1.1, .06, 18.3, .65, .03, 2, 0xc6c5ae); }
  for (const b of BUILDINGS.filter(b=>b.kind!=='base')) { const group = building(scene, b); const mats: THREE.Material[] = []; group.traverse(o => { if (o instanceof THREE.Mesh) mats.push(o.material as THREE.Material); }); town.buildings.push({ group, data: b, materials: mats }); }
  // Courtyard: clear approach, prepared barricade anchors and a recognisable safe-house path.
  box(staticWorld, 1, .21, 4.7, 3.5, .05, 9, 0xb1ab8b,'paving');
  CARS.forEach((c, i) => {
    const variants = ['sedan', 'wreck', 'pickup', 'sedan', 'police', 'wreck'] as const;
    const car = voxelMesh(carRecipe(variants[i]??(i===8||i===9?'police':i%3===0?'pickup':'wreck'), c.color),surfaceBatchMaterial('metal')); car.position.set(c.x, .1, c.z); car.rotation.y = c.angle; staticWorld.add(car);
  });
  // The same gas-station footprint and pumps, now built from small voxel parts.
  const shop = voxelMesh(gasShopRecipe()); shop.position.set(-27, 0, 29); staticWorld.add(shop);
  textSign(staticWorld, 'ÚLTIMA PARADA', -27, 3, 31.76, 7, .65, '#8b5f45');
  for (const x of [-30, -20]) { box(staticWorld, x, 2.3, 22, .2, 4.6, .2, 0x78938a); box(staticWorld, x, .4, 22, .4, .8, .4, 0xa29f80); }
  box(staticWorld, -25, 4.6, 22, 13, .4, 5.6, 0xbdb794); box(staticWorld, -25, 4.55, 24.85, 13.2, .5, .1, 0xa57555);
  for (let x = -31; x < -18; x += .4) box(staticWorld, x, 4.84, 22, .1, .08, 5.2, 0xc9c1a0);
  for (const x of [-25, -21]) { box(staticWorld, x, .2, 22, 1.6, .3, 1.7, 0x929c86); const pump = voxelMesh(propRecipe('pump')); pump.position.set(x, .35, 22); staticWorld.add(pump); }
  const pricePylon = voxelMesh({ id: 'gas:pylon:v1', unit: .1, build(grid) { grid.fill(-1, 0, -1, 2, 32, 2, 0x667962).fill(-8, 24, -2, 16, 13, 4, 0xb5b48f).fill(-7, 25, 2, 14, 11, 1, 0x486c5b); } });
  pricePylon.position.set(-33, .1, 20); staticWorld.add(pricePylon);
  textSign(staticWorld, 'SEM COMBUSTÍVEL', -33, 3.1, 20.31, 1.4, .5, '#486c5b', '#d5b78c');
  // Street lights: emissive bulbs everywhere, only three real point lights near the action.
  for (const [x, z] of [[-6.5, 6], [8.5, 8], [-17, -12], [-17, 20], [19, 18], [10, -18], [34, 6]]) {
    box(staticWorld, x, 2.5, z, .2, 5, .2, 0x405452); box(staticWorld, x, .3, z, .4, .6, .4, 0x647664); box(staticWorld, x + .6, 5, z, 1.3, .1, .2, 0x405452); box(staticWorld, x + .2, 4.85, z, .3, .2, .2, 0x405452);
    const bulb = box(staticWorld, x + 1.1, 4.95, z, .55, .11, .33, 0xf5cc83); bulb.material = town.lamps;
    if (town.lights.length < 3) { const light = new THREE.PointLight(0xffc783, 0, 15, 1.6); light.position.set(x + 1.1, 4.4, z); scene.add(light); town.lights.push(light); }
  }
  // Cached voxel trees: one instanced draw per variant, with original placements retained.
  const treePositions = TREE_POSITIONS;
  const dummy = new THREE.Object3D();
  for (let variant = 0; variant < 3; variant++) {
    const cells=new Map<string,THREE.Matrix4[]>();
    // Preserve the exact RNG order, positions and geometry. Each cell can now be
    // culled independently by BOTH the camera and the sun's shadow frustum.
    treePositions.filter((_,i)=>i%3===variant).forEach(([x,z])=>{
      dummy.position.set(x,.15,z);dummy.scale.setScalar(.85+random()*.25);dummy.rotation.set(0,random()*6.28,0);dummy.updateMatrix();
      const key=`${Math.floor(x/64)}:${Math.floor(z/64)}`,matrices=cells.get(key)??[];matrices.push(dummy.matrix.clone());cells.set(key,matrices);
    });
    for(const [key,matrices] of cells){
      const trees=new THREE.InstancedMesh(voxelGeometry(treeRecipe(variant)),voxelMaterial,matrices.length);
      trees.name=`voxel-trees-${variant}:${key}`;trees.castShadow=true;trees.receiveShadow=true;
      matrices.forEach((matrix,i)=>trees.setMatrixAt(i,matrix));trees.computeBoundingBox();trees.computeBoundingSphere();trees.matrixAutoUpdate=false;scene.add(trees);
    }
  }
  const grass = new THREE.InstancedMesh(voxelGeometry(grassRecipe()), voxelMaterial, 650); grass.name = 'voxel-grass';
  for (let i = 0; i < 650; i++) {
    let x = random() * 78 - 39, z = random() * 78 - 39;
    if (collides({ x, z }, .2)) { x = 38 + random(); z = random() * 78 - 39; }
    dummy.position.set(x, .2, z); dummy.rotation.set(0, random() * Math.PI, 0); dummy.scale.setScalar(.6 + random()); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grass);
  const shrubPositions = [[-4, -9], [6, -9], [-18.5, 1], [-31, 1], [20.5, -16], [33, -18], [33, 2], [8, 1], [8, 2], [7, 23], [-4, 24], [-20, 30]];
  const shrubs = new THREE.InstancedMesh(voxelGeometry(shrubRecipe()), voxelMaterial, shrubPositions.length); shrubs.castShadow = true;
  shrubPositions.forEach(([x, z], i) => { dummy.position.set(x, .2, z); dummy.rotation.set(0, random() * 6.28, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); shrubs.setMatrixAt(i, dummy.matrix); }); scene.add(shrubs);
  // Ground clutter: cracks, discarded boards, paper, trash bags, bins and crates.
  for (let i = 0; i < 110; i++) {
    const x = random() * 76 - 38, z = random() * 76 - 38;
    if (collides({ x, z }, .6)) continue;
    const debris = box(staticWorld, x, .2, z, .18 + random() * .45, .03, .15 + random() * .45, i % 4 === 0 ? 0xc2bea3 : 0x65745f); debris.rotation.y = random() * 6;
  }
  for (const [x, z] of [[-18.5, 2], [20, 3], [-6, 22], [33, -18]]) {
    for (const [kind, dx, dz] of [['bin', 0, 0], ['bag', 1, 0], ['crate', 1.5, 1], ['pallet', 2, 2], ['rubble', -1, .3]] as const) {
      const prop = voxelMesh(propRecipe(kind)); prop.position.set(x + dx, .18, z + dz); staticWorld.add(prop);
    }
  }
  for (const [kind, x, z, angle] of [['mailbox', -4.3, 8.6, 0], ['hydrant', -7, 18.3, 0], ['bench', 8.5, -3, Math.PI / 2], ['bench', 20, -17, 0], ['cone', -19, 19, .1], ['cone', -18, 20, -.1], ['cone', 20, 19, .2], ['pallet', -20, 1.5, .3], ['bag', 32, 22, 0]] as const) {
    const prop = voxelMesh(propRecipe(kind)); prop.position.set(x, .18, z); prop.rotation.y = angle; staticWorld.add(prop);
  }
  // Emergency fixtures are emissive geometry: no new shadow-casting lights.
  for (const [x, y, z] of [[23.5, 2.7, -18.2], [26.5, 2.7, -18.2], [25, 3, 31.3], [1, 2.3, .6]]) {
    const light = box(staticWorld, x, y, z, .4, .2, .2, 0xe39b65); light.material = town.emergency;
  }
  // Stop signs and overhead cable emphasize a lived-in street, without costly lights.
  for (const x of [-17.8, 19.8]) {
    box(staticWorld, x, 1.4, 8.5, .1, 2.8, .1, 0x566e66);
    box(staticWorld, x, 2.55, 8.5, .6, .8, .1, 0xb27353); box(staticWorld, x, 2.55, 8.5, .8, .6, .1, 0xb27353);
    textSign(staticWorld, 'PARE', x, 2.55, 8.55, .65, .24, '#b27353');
  }
  spatialBatch(staticWorld);
  return town;
}
