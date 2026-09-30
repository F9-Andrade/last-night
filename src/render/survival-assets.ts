import type {Barricade} from '../game/defenses';
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

/** Shared geometry per width, damage stage and tier; never rebuilt per frame. */
export function defenseRecipe(b:Pick<Barricade,'w'|'d'|'tier'|'trap'>,stage:number):VoxelRecipe {
 const width=Math.max(b.w,b.d),tier=b.tier??0,base=barricadeRecipe(width,stage);
 return {id:`defense:${width}:${stage}:${tier}:${b.trap??'wall'}`,unit:.1,build(g){
  if(b.trap){
   if(stage===3){voxelBox(g,0,.1,0,width,.12,.4,0x5e5545);return;}
   if(b.trap==='spikes'){for(let x=-width/2+.2;x<width/2;x+=.4)for(const z of [-.4,.4]){voxelBox(g,x,.36,z,.14,.65,.14,0x796347);voxelBox(g,x,.76,z,.08,.18,.08,0xb5a27b);}voxelBox(g,0,.1,0,width,.16,1,0x514a36);}
   else if(b.trap==='snare'){for(const x of [-.65,.65])voxelBox(g,x,.1,0,.12,.15,1.3,0x7d765d);for(const z of [-.65,.65])voxelBox(g,0,.1,z,1.3,.15,.12,0x7d765d);voxelBox(g,0,.15,0,.5,.08,.5,0x68665c);}
   else {for(const x of [-width/2+.15,width/2-.15])voxelBox(g,x,.65,0,.18,1.3,.18,0x6e5945);for(const y of [.3,.65,1]){voxelBox(g,0,y,0,width,.06,.07,0x9b9b8e);for(let x=-width/2+.3;x<width/2;x+=.4){voxelBox(g,x,y,0,.06,.23,.12,0xa19b87);voxelBox(g,x,y,.03,.2,.06,.12,0x77766b);}}}
   return;
  }
  base.build(g);if(stage===3)return;
  if(tier>=1)for(let x=-width/2+.25;x<width/2;x+=.65){voxelBox(g,x,.7,.2,.45,.8,.1,0x6c7260);for(const y of [.4,1.05])voxelBox(g,x,y,.27,.6,.1,.08,0xa29372);}
  if(tier>=2)for(let x=-width/2+.5;x<width/2;x+=1){voxelBox(g,x,1,.35,.8,1.2,.12,0x66716d);voxelBox(g,x,.5,.42,.7,.1,.06,0x976a48);for(const y of [.55,1.45])voxelBox(g,x-.25,y,.45,.08,.08,.06,0xa6a895);}
 }};
}
