import type { VoxelRecipe } from './voxel';
import { voxelBox } from './environment-assets';
import type { Item } from '../game/inventory';
import type { LootArea } from '../game/loot';
const wood = [0x8f7650, 0xae8f5c, 0x726448, 0xa28a66], metal = 0x64736c;
export function itemRecipe(item: Item): VoxelRecipe {
  return { id: `survival:item:${item}`, unit: .06, build(g) {
    if(item==='shells'||item==='rifleAmmo'){
      for(let i=0;i<3;i++){const x=-.22+i*.22;voxelBox(g,x,.22,0,.14,.4,.14,item==='shells'?0x96714c:0xa79960);voxelBox(g,x,.04,0,.18,.08,.18,0xc0b381);if(item==='rifleAmmo')voxelBox(g,x,.47,0,.08,.14,.08,0xb9af84);}
    } else if (item === 'wood') {
      for (let i = 0; i < 5; i++) { voxelBox(g, (i % 2) * .1, .09 + i * .1, (i % 3 - 1) * .08, 1.2 - i % 2 * .18, .1, .36, wood[i % 4]); voxelBox(g, -.28, .14 + i * .1, 0, .06, .02, .5, metal); }
    } else if (item === 'scrap') {
      voxelBox(g, 0, .14, 0, .65, .22, .5, 0x786d57); voxelBox(g, -.12, .29, .06, .48, .12, .48, metal);
      for (let i = 0; i < 5; i++) voxelBox(g, -.25 + i * .12, .38 + i % 2 * .06, -.08, .06, .12, .4, i % 2 ? 0x9f7650 : 0x8d9882);
    } else if (item === 'med') {
      g.ellipsoid(0, 3, 0, 4, 3, 3, 0xcac9af); voxelBox(g, 0, .24, 0, .12, .36, .4, 0x7d9885);
      voxelBox(g, .18, .13, .2, .3, .06, .3, 0xdbd5b7);
    } else {
      voxelBox(g, 0, .22, 0, .7, .4, .42, item === 'ammo' ? 0x6a7b5a : 0xad8855);
      voxelBox(g, 0, .46, 0, .76, .1, .48, item === 'ammo' ? 0x87946a : 0xc2a16c);
      for (const x of [-.24, .24]) voxelBox(g, x, .28, .24, .08, .26, .06, metal);
      voxelBox(g, 0, .48, 0, .24, .12, .12, metal);
      voxelBox(g, 0, .25, .25, .24, .12, .04, 0xd5c48d);
    }
  } };
}
export function containerRecipe(area: LootArea, lid: boolean): VoxelRecipe {
  return { id: `survival:container:${area}:${lid}`, unit: .08, build(g) {
    const color = area === 'hospital' ? 0xa1b49b : area === 'police' ? 0x607c80 : area === 'gas' ? 0xa78451 : area === 'house' ? 0x747d62 : 0x927953;
    if (lid) {
      voxelBox(g, 0, .05, .4, 1.12, .16, .88, color);
      for (const x of [-.4, .4]) voxelBox(g, x, .15, .4, .08, .05, .88, metal);
      if (area === 'hospital') { voxelBox(g, 0, .15, .4, .16, .05, .48, 0xa15f4f); voxelBox(g, 0, .15, .4, .48, .05, .16, 0xa15f4f); }
    } else {
      voxelBox(g, 0, .08, 0, 1.08, .16, .8, 0x4d5948);
      for (const x of [-.5, .5]) voxelBox(g, x, .4, 0, .12, .64, .8, color);
      for (const z of [-.36, .36]) voxelBox(g, 0, .4, z, 1, .64, .08, color);
      for (const x of [-.38, .38]) { voxelBox(g, x, .35, .44, .1, .56, .08, metal); voxelBox(g, x, .57, .5, .12, .16, .08, 0xc5b487); }
      voxelBox(g, 0, .38, .43, .4, .16, .04, 0xc7bd93);
      for (let i = 0; i < 4; i++) voxelBox(g, -.3 + i * .18, .24 + i % 2 * .12, -.12, .08, .06, .05, 0x5d6655);
    }
  } };
}
export function barricadeRecipe(width: number, stage: number): VoxelRecipe {
  return { id: `survival:barricade:${width}:${stage}`, unit: .1, build(g) {
    if (stage === 3) {
      for (let i = 0; i < Math.ceil(width * 2); i++) voxelBox(g, -width / 2 + i * .5, .13 + i % 2 * .1, i % 3 * .18 - .2, .9, .12, .24, wood[i % 4]);
      return;
    }
    for (const x of [-width / 2 + .2, width / 2 - .2]) { voxelBox(g, x, .85, 0, .24, 1.7, .28, wood[2]); voxelBox(g, x, .22, 0, .5, .38, .5, metal); }
    for (let i = 0; i < Math.ceil(width / .35); i++) {
      if (stage === 2 && i % 3 === 1) continue;
      const x = -width / 2 + .16 + i * .34, height = 1.25 + (i % 3) * .14 - (stage > 0 && i % 2 ? .6 : 0);
      voxelBox(g, x, height / 2 + .1, i % 2 * .04, .28, height, .2, wood[i % 4]);
      for (const y of [.45, .95]) voxelBox(g, x, y, .14, .06, .06, .06, 0xb9b397);
    }
    for (const y of [.45, .95]) {
      if (stage === 2 && y > .8) continue;
      voxelBox(g, 0, y, -.18, width - .1, .18, .14, wood[1]);
      for (let i = 0; i < Math.ceil(width / .2); i++) voxelBox(g, -width / 2 + i * .2, .25 + i * (1.05 / (width / .2)), .22, .25, .18, .1, metal);
    }
    if (stage === 0) { voxelBox(g, 0, .8, .29, Math.min(.8, width / 2), .4, .08, 0x9d7950); voxelBox(g, 0, .8, .35, .4, .1, .03, 0xd0b976); }
  } };
}
