import * as THREE from 'three';
import { voxelMesh } from './voxel.ts';
import type { VoxelRecipe } from './voxel.ts';
import type { WeaponId } from '../game/weapons.ts';

/** Weapon geometry is data-driven and separate from combat stats. Register future families here. */
export interface WeaponVisual { id: string; recipe: VoxelRecipe; muzzle: [number, number, number]; grip: [number, number, number] }
const pistol: WeaponVisual = {
  id: 'improvised-pistol', muzzle: [0, .12, .45], grip: [0, 0, 0],
  recipe: { id: 'weapon:improvised-pistol:v1', unit: .04, build(g) {
    g.fill(-2, 1, -4, 4, 3, 14, 0x3c4b4c).fill(-1, 4, -3, 2, 1, 12, 0x667372);
    g.fill(-2, -1, -3, 4, 2, 8, 0x293a3b).fill(-2, -5, -3, 4, 5, 4, 0x705d44);
    g.fill(-2, -4, -4, 4, 1, 1, 0x8b7652);
    g.fill(-1, 2, 10, 2, 1, 1, 0x172a2b).fill(-1, 5, -3, 2, 1, 1, 0xb0ac89).set(0, 5, 8, 0xbcb698);
    g.fill(1, -3, 2, 1, 1, 3, 0x4d5b53).fill(1, -2, 4, 1, 2, 1, 0x4d5b53); // Trigger guard.
    for (let z = -3; z < 1; z++) g.fill(-3, 2, z, 1, 1, 1, z % 2 ? 0x485650 : 0x7b8372);
    g.set(2, 3, 5, 0x998568).set(-2, 2, 7, 0x998568); // Repaired slide and wear.
  } },
};
const longGun=(id:WeaponId,length:number,wood:boolean,build:VoxelRecipe['build']):WeaponVisual=>({id,muzzle:[0,.1,length*.04],grip:[0,0,0],recipe:{id:`weapon:${id}:v1`,unit:.04,build(g){
  const stock=wood?0x84694b:0x50635b;
  g.fill(-2,0,-9,4,4,17,0x394b49).fill(-2,-3,-17,4,5,10,stock).fill(-2,-5,-4,4,5,4,0x5d6654);
  g.fill(-1,2,8,2,2,length-8,0x53615a).fill(-1,4,-7,2,1,13,0x839185).fill(-1,1,length,2,2,1,0x172c2b);
  g.fill(-3,0,6,6,3,7,stock).fill(-1,-3,0,2,1,3,0x7b826b);build(g);
}}});
const revolver:WeaponVisual={id:'revolver',muzzle:[0,.13,.65],grip:[0,0,0],recipe:{id:'weapon:revolver:v1',unit:.04,build(g){
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
export function createWeaponVisual(id = pistol.id): { root: THREE.Group; magazine: THREE.Mesh; muzzle: THREE.Vector3 } {
  const definition = registry.get(id); if (!definition) throw new Error(`Unknown weapon visual: ${id}`);
  const root = new THREE.Group(); root.name = id; root.add(voxelMesh(definition.recipe)); root.userData.weaponVisual = id;
  const magazine=voxelMesh({id:`${id}:magazine:v1`,unit:.04,build(g){
    if(id==='revolver')g.fill(-3,0,-4,6,5,6,0x54665c);
    else if(id==='shotgun')g.fill(-1,-4,4,2,4,2,0xa08756).fill(-1,-1,4,2,1,2,0xbaac70);
    else {const depth=id==='smg'?10:id==='rifle'?8:5,z=id==='pistol'||id==='improvised-pistol'?-3:0;g.fill(-2,-depth,z,4,depth,4,0x35423d).fill(-2,-depth-1,z,4,1,4,0x8a8c74);}
  }});root.add(magazine);
  return { root, magazine, muzzle: new THREE.Vector3(...definition.muzzle) };
}
