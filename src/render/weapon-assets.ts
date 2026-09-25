import * as THREE from 'three';
import { voxelMesh, VoxelGrid } from './voxel.ts';
import type { VoxelRecipe } from './voxel.ts';
import type { WeaponId } from '../game/weapons.ts';

/** Weapon geometry is data-driven and separate from combat stats. Register future families here. */
export interface WeaponVisual { id: string; recipe: VoxelRecipe; muzzle: [number, number, number]; grip: [number, number, number] }
// Fine voxels are reserved for the foreground pistol; distant rifles retain the coarser silhouette.
const pistol: WeaponVisual = {
  id: 'improvised-pistol', muzzle: [0, .12, .45], grip: [0, 0, 0],
  recipe: { id: 'weapon:improvised-pistol:v11', unit: .02, build(g) {
    // Squared slide, exposed barrel recess, stepped top and a genuine sight channel.
    g.fill(-4, 2, -8, 8, 6, 28, 0x414644).fill(-3, 8, -7, 6, 1, 26, 0x666c67);
    g.fill(-4, 3, -8, 1, 1, 28, 0x71766d).fill(3, 3, -7, 1, 1, 26, 0x626961);
    g.fill(-3, 3, 20, 6, 4, 2, 0x72776e).carve(-1, 4, 20, 2, 2, 2);
    g.fill(-1, 4, 19, 2, 2, 1, 0x121919);
    g.fill(-4, 9, -7, 2, 2, 3, 0x2d3533).fill(2, 9, -7, 2, 2, 3, 0x2d3533);
    g.set(-3, 10, -7, 0xbab49a).set(2, 10, -7, 0xbab49a);
    g.fill(-1, 9, 15, 2, 2, 3, 0x3a413b).fill(-1, 11, 16, 2, 1, 1, 0xc7b790);
    // Serrations, ejection port, extractor and restrained silver edge wear.
    for (let z = -5; z < 1; z += 2) g.fill(-4, 4, z, 1, 4, 1, 0x29322f).fill(3, 4, z, 1, 4, 1, 0x29322f);
    g.fill(3, 5, 5, 1, 3, 6, 0x202a27).fill(3, 5, 6, 1, 1, 4, 0x909181);
    g.fill(-3, 8, 10, 1, 1, 7, 0x85877a).set(3, 4, 15, 0x7f8479);
    // Polymer frame, an open trigger guard, receiver pins and checkered grip panels.
    g.fill(-4, -2, -7, 8, 4, 16, 0x303b34).fill(-3, -3, 6, 6, 1, 8, 0x28312d);
    g.fill(-4, -10, -7, 8, 9, 7, 0x434a3b).fill(-4, -11, -8, 8, 2, 8, 0x29332c);
    g.fill(-2, -7, 0, 4, 1, 8, 0x535b4f).fill(-2, -6, 7, 4, 5, 1, 0x535b4f);
    g.fill(-1, -4, 2, 2, 3, 1, 0x93917d).fill(-1, -5, 3, 2, 1, 1, 0x5a6256);
    for (const x of [-4, 3]) for (let y = -9; y < -3; y += 2) g.fill(x, y, -6, 1, 1, 5, 0x59604c);
    g.set(-4, -2, -4, 0x92917d).set(3, -2, -4, 0x92917d).fill(4, 0, -3, 1, 1, 5, 0x5f695c);
  } },
};
const longGun=(id:WeaponId,length:number,wood:boolean,build:VoxelRecipe['build']):WeaponVisual=>({id,muzzle:[0,.1,length*.04],grip:[0,0,0],recipe:{id:`weapon:${id}:v11`,unit:.04,build(g){
  const stock=wood?0x84694b:0x50635b;
  g.fill(-2,0,-9,4,4,17,0x394b49).fill(-2,-3,-17,4,5,10,stock).fill(-2,-5,-4,4,5,4,0x5d6654);
  g.fill(-1,2,8,2,2,length-8,0x53615a).fill(-1,4,-7,2,1,13,0x839185).fill(-1,1,length,2,2,1,0x172c2b);
  g.fill(-3,0,6,6,3,7,stock).fill(-1,-3,0,2,1,3,0x7b826b);build(g);
  // Receiver seams, exposed pins, rail slots and edge scuffs stay within the original silhouette.
  g.fill(-2,3,-7,1,1,10,0x7b8275).fill(1,2,-7,1,1,10,0x252e2a);
  g.set(-2,1,-4,0xa4a28c).set(1,1,-4,0x8a8c7c);
  for(let z=-5;z<5;z+=3)g.fill(-1,4,z,2,1,1,0x343f37);
  g.fill(-2,-2,-15,4,1,5,wood?0x68513d:0x303d34);
  g.fill(-1,-6,-4,2,1,7,0x465348).fill(-1,-5,2,2,4,1,0x465348);
  if(wood)for(let z=-15;z<-9;z+=3)g.fill(-2,0,z,1,1,2,0xa48760);
}}});
const revolver:WeaponVisual={id:'revolver',muzzle:[0,.13,.65],grip:[0,0,0],recipe:{id:'weapon:revolver:v11',unit:.04,build(g){
  g.fill(-2,1,-5,4,3,21,0x67736b).fill(-1,4,0,2,1,17,0x96a08a).fill(-1,2,16,2,1,1,0x1d3332);
  g.fill(-3,0,-4,6,5,6,0x465651).fill(-2,-5,-6,4,6,4,0x907052).fill(-2,-6,-8,4,3,3,0x806044);
  g.fill(-1,-3,-1,2,1,4,0x768273).fill(-1,-2,2,2,2,1,0x768273).set(0,5,-6,0xbab899).set(0,5,14,0xbab899);
  for(let z=-3;z<1;z++)g.set(-3,2,z,0x829081);
}}};
const variants:WeaponVisual[]=[revolver,
  longGun('smg',20,false,g=>{g.carve(-2,-3,-17,4,5,6).fill(-1,-1,-18,2,1,10,0x637a6a).fill(-1,-4,-19,2,4,1,0x637a6a);g.fill(-3,1,2,6,5,7,0x465b54).fill(-1,6,-5,2,2,1,0xa7aa89);}),
  longGun('shotgun',30,true,g=>{g.fill(-1,0,8,2,2,20,0x2f4140).fill(-3,-1,11,6,4,8,0x9a7951);for(let z=11;z<19;z+=2)g.fill(-3,0,z,1,2,1,0x574d3d);g.fill(2,2,-3,1,1,6,0x929879);}),
  longGun('rifle',29,false,g=>{g.fill(-3,0,9,6,4,8,0x68715a);for(let z=10;z<17;z+=2)g.fill(-3,2,z,1,1,1,0x293f3c);g.fill(-1,5,-4,2,2,8,0x465e54).fill(-1,4,26,2,3,1,0x798671);}),
  longGun('marksman',39,true,g=>{g.fill(-2,6,-5,4,4,13,0x354c48).fill(-3,5,6,6,6,3,0x637465).fill(-2,6,9,4,4,1,0x172e2e).fill(-1,4,-3,2,2,7,0x546254);g.fill(-2,1,30,4,4,9,0x56695f).fill(2,1,-1,2,1,4,0xa9a58a);}),
];
const registry = new Map<string, WeaponVisual>([[pistol.id, pistol],['pistol',pistol],...variants.map(v=>[v.id,v] as [string,WeaponVisual])]);
export function createWeaponVisual(id = pistol.id, articulated=false): { root: THREE.Group; magazine: THREE.Mesh; action: THREE.Mesh; muzzle: THREE.Vector3 } {
  const definition = registry.get(id); if (!definition) throw new Error(`Unknown weapon visual: ${id}`);
  const root = new THREE.Group(); root.name = id; root.userData.weaponVisual = id;
  const handgun=id==='pistol'||id==='improvised-pistol';
  const movable=(x:number,y:number,z:number)=>handgun?(y>=2&&z>=-8):id==='shotgun'?(z>=11&&z<19&&y<3):id==='revolver'?(Math.abs(x)<3&&y<5&&y>=0&&z>=-4&&z<2):(x>=1&&y>=2&&z>=-3&&z<3);
  const part=(action:boolean)=>({id:`${definition.recipe.id}:fps:${action?'action':'frame'}`,unit:definition.recipe.unit,build(g:VoxelGrid){definition.recipe.build(g);if(id==='marksman')g.carve(-1,7,-6,2,2,17);for(const key of g.cells.keys()){const [x,y,z]=VoxelGrid.coordinates(key);if(movable(x,y,z)!==action)g.cells.delete(key);}}});
  root.add(weaponMesh(articulated?part(false):definition.recipe));
  const action=weaponMesh(part(true));action.visible=articulated&&id!=='revolver';if(articulated)root.add(action);
  const magazine=weaponMesh({id:`${id}:magazine:v11`,unit:.04,build(g){
    if(id==='revolver')g.fill(-3,0,-4,6,5,6,0x54665c);
    else if(id==='shotgun')g.fill(-1,-4,4,2,4,2,0xa08756).fill(-1,-1,4,2,1,2,0xbaac70);
    else {const depth=id==='smg'?10:id==='rifle'?8:5,z=id==='pistol'||id==='improvised-pistol'?-3:0;g.fill(-2,-depth,z,4,depth,4,0x35423d).fill(-2,-depth-1,z,4,1,4,0x6e7366);for(let y=-depth+1;y<-1;y+=2)g.fill(1,y,z,1,1,4,0x4b5548);}
  }});root.add(magazine);
  return { root, magazine, action, muzzle: new THREE.Vector3(...definition.muzzle) };
}

// Three shared finishes, grouped into the existing meshes. Geometry is cached once per recipe;
// material assignment never allocates during animation and preserves voxel face normals.
const weaponMaterials = [
  new THREE.MeshStandardMaterial({vertexColors:true,roughness:.52,metalness:.22,flatShading:true}),
  new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0,flatShading:true}),
  new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:.04,flatShading:true}),
];
const finishCache=new Map<string,THREE.BufferGeometry>();
function weaponMesh(recipe:VoxelRecipe):THREE.Mesh {
  const mesh=voxelMesh(recipe);let geometry=finishCache.get(recipe.id);
  if(!geometry){
    geometry=mesh.geometry.clone();const indices=geometry.index!,colors=geometry.getAttribute('color');
    const buckets:number[][]=[[],[],[]];
    for(let i=0;i<indices.count;i+=3){
      const v=indices.getX(i),r=colors.getX(v),g=colors.getY(v),b=colors.getZ(v);
      // Brown wood/brass remains rough; low-value olive polymer differs from grey metal.
      const finish=r>g*1.22&&r>b*1.6?1:g>b*1.18&&r<g*1.17?2:0;
      buckets[finish].push(indices.getX(i),indices.getX(i+1),indices.getX(i+2));
    }
    geometry.clearGroups();let first=0;const merged:number[]=[];
    buckets.forEach((bucket,index)=>{if(bucket.length){geometry!.addGroup(first,bucket.length,index);merged.push(...bucket);first+=bucket.length;}});
    geometry.setIndex(merged);finishCache.set(recipe.id,geometry);
  }
  mesh.geometry=geometry;mesh.material=weaponMaterials;return mesh;
}
