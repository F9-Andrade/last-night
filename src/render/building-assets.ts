import { hasInterior } from '../game/interiors';
import type { Building } from '../game/world';
import { hash } from './voxel.ts';
import type { VoxelRecipe } from './voxel.ts';
import { voxelBox as b } from './environment-assets.ts';

export function buildingRecipes(data: Building): VoxelRecipe[] {
  const { w, d, h, color, kind } = data, pitched = kind === 'house' || kind === 'base';
  const id = `building:${kind}:${w}:${d}:${h}:${color}`;
  return [
    { id: `${id}:shell:v2`, unit: .2, build(g) {
      b(g, 0, h / 2, 0, w, h, d, color); b(g, 0, .4, 0, w + .2, .6, d + .2, 0x858e79);
      // Sparse flaking plaster and exposed masonry, not a texture grid on every wall.
      for (let x = -w / 2 + .2; x < w / 2; x += .4) for (let y = .8; y < h - .5; y += .4) {
        const value = hash(Math.round(x * 5), Math.round(y * 5), 0, w);
        if (value > .91 && (y < 1.7 || x > w / 2 - 1.5)) b(g, x, y, d / 2, .4, .2, .2, value > .96 ? 0x998c71 : 0xbbb59a);
      }
      for (let z = -d / 2; z < d / 2; z += .4) if (hash(0, 0, Math.round(z * 5), d) > .6) b(g, w / 2, .8 + hash(2, 0, Math.round(z * 5)) * .8, z, .2, .4, .4, 0xa5a58c);
      if(hasInterior(data)){const u=.2;g.carve(Math.ceil((-w/2+.4)/u),0,Math.ceil((-d/2+.4)/u),Math.floor((w-.8)/u),Math.ceil(h/u),Math.floor((d-.8)/u));g.carve(-7,0,Math.floor((d/2-.4)/u),14,14,5);}
      if (pitched) for (let z = -d / 2; z < d / 2; z += .2) {
        const height = Math.max(.2, Math.floor((2.4 - Math.abs(z) * 2.4 / (d / 2 + .4)) / .2) * .2);
        for (const x of [-w / 2 + .1, w / 2 - .1]) b(g, x, h + height / 2, z + .1, .2, height, .2, color);
      }
    } },
    { id: `building:${kind}:${w}:${d}:${h}:roof`, unit: .2, build(g) {
      if (pitched) {
        const tones = kind === 'base' ? [0x496764, 0x526f69, 0x627972, 0x415e5c] : [0x806953, 0x8d7358, 0x9a7f60, 0x77654e];
        for (let zi = -Math.ceil((d / 2 + .4) / .2); zi < Math.ceil((d / 2 + .4) / .2); zi++) {
          const y = Math.floor(h / .2) + Math.max(0, Math.floor(12 - Math.abs(zi + .5) * 12 / ((d / 2 + .4) / .2)));
          for (let xi = -Math.ceil((w / 2 + .4) / .2); xi < Math.ceil((w / 2 + .4) / .2); xi++) {
            const tone = tones[Math.floor(hash(Math.floor(xi / 3), 0, Math.floor(zi / 2), 7) * tones.length)];
            g.fill(xi, y, zi, 1, 2, 1, tone);
          }
        }
        b(g, -w * .25, h + 2.1, -1, .8, 2.2, .8, 0x997b60); b(g, -w * .25, h + 3.25, -1, 1.1, .2, 1.1, 0x657066);
        b(g, -w * .25, h + 3.36, -1, .6, .1, .6, 0x3d5147);
        for (let y = h + 1.2; y < h + 3; y += .4) b(g, -w * .25, y, -.56, .8, .1, .1, 0xb09c79);
      } else {
        b(g, 0, h + .1, 0, w + .4, .2, d + .4, 0x8a9786);
        for (const z of [-d / 2, d / 2]) b(g, 0, h + .4, z, w + .4, .4, .2, 0xb6b9a1);
        for (const x of [-w / 2, w / 2]) b(g, x, h + .4, 0, .2, .4, d, 0xb6b9a1);
        b(g, -w / 4, h + .7, -1, 2.4, 1, 2, 0x71817b);
        for (let z = -1.7; z < -.2; z += .2) b(g, -w / 4, h + 1.3, z, 2, .2, .1, 0x465e57);
        b(g, w / 4, h + .5, -d / 4, .8, .8, .8, 0x8a9886); b(g, w / 4, h + 1, -d / 4, 1.2, .2, 1.2, 0xa5ab94);
        for (let i = 0; i < 18; i++) { const x = (hash(i, 0, 0) - .5) * (w - 1), z = (hash(i, 1, 0) - .5) * (d - 1); b(g, x, h + .22, z, .4, .04, .4, 0x7f9178); }
      }
    } },
    { id: `building:${kind}:${w}:${d}:${h}:joinery`, unit: .1, build(g) {
      if(!hasInterior(data)){b(g, 0, 1.2, d / 2 + .05, 1.6, 2.4, .2, 0xc4baa0); b(g, 0, 1.15, d / 2 + .2, 1.2, 2.2, .1, 0x415c52);
      b(g, 0, 1.55, d / 2 + .3, .8, .9, .1, 0x597a72); b(g, .4, 1, d / 2 + .35, .1, .2, .1, 0xd4bc81);
      }else{for(const x of [-1.5,1.5])b(g,x,1.4,d/2+.05,.2,2.8,.25,0xbcb89c);b(g,0,2.85,d/2+.05,3.2,.2,.3,0xbcb89c);}
      b(g, 0, .1, d / 2 + .6, 2.1, .2, 1, 0xafad91);
      for (const x of [-w * .3, w * .3]) {
        b(g, x, 2, d / 2 + .1, 1.9, 1.7, .2, 0xd1c8a9); b(g, x, 2, d / 2 + .22, 1.5, 1.3, .1, 0x395c5a);
        b(g, x, 2, d / 2 + .33, .1, 1.3, .1, 0xb9b799); b(g, x, 2, d / 2 + .34, 1.5, .1, .1, 0xb9b799);
        b(g, x, 1.1, d / 2 + .2, 2.1, .2, .5, 0x7e8976);
        if (kind !== 'hospital') {
          for (let i = 0; i < 9; i++) b(g, x - .8 + i * .2, 1.8 + Math.floor(i / 3) * .1, d / 2 + .43, .2, .2, .1, 0xa18c64);
          b(g, x, 2.3, d / 2 + .43, 1.8, .2, .1, 0x847957);
        }
      }
      for (const z of [-d * .28, d * .2]) {
        b(g, w / 2 + .08, 2.1, z, .2, 1.6, 1.8, 0xc3bfa2); b(g, w / 2 + .21, 2.1, z, .1, 1.3, 1.5, 0x496c65);
        b(g, w / 2 + .3, 2.1, z, .1, 1.3, .1, 0xb8b69b); b(g, w / 2 + .3, 2.1, z, .1, .1, 1.5, 0xb8b69b);
        b(g, w / 2 + .2, 1.3, z, .4, .2, 2, 0x808c74);
      }
      // Gutters, electrical boxes, conduit and an external air conditioner.
      for (const z of [-d / 2 - .25, d / 2 + .25]) b(g, 0, h + .05, z, w + .6, .2, .2, 0x687b6e);
      b(g, w / 2 + .12, h / 2, -d / 2 + .3, .15, h, .15, 0x6f7e6c);
      b(g, w / 2 + .2, 1.1, d / 2 - .8, .3, .9, .6, 0x7d8e7a); b(g, w / 2 + .4, 1.1, d / 2 - .8, .1, .1, .3, 0xc1b279);
      b(g, w / 2 + .3, 2.8, -1, .6, .7, 1, 0x9fab98);
      for (let z = -1.4; z < -.5; z += .2) b(g, w / 2 + .64, 2.8, z, .1, .5, .1, 0x617565);
      if (kind === 'base') {
        b(g, 0, 2.6, d / 2 + .8, 2.8, .2, 1.8, 0x657d6b);
        for (const x of [-1.2, 1.2]) b(g, x, 1.3, d / 2 + 1.5, .2, 2.6, .2, 0x7e8a70);
      }
      if (kind === 'hospital') {
        b(g, -4, 4.7, d / 2 + .24, .4, 1.8, .2, 0xb37260); b(g, -4, 4.7, d / 2 + .24, 1.6, .4, .2, 0xb37260);
        b(g, 0, 2.8, d / 2 + .8, 3.5, .3, 1.8, 0x7f9a90);
        // Roof cross can be read even when the facade text is out of view.
        b(g, 2, h + .25, 1, .6, .1, 3, 0xaf7663); b(g, 2, h + .25, 1, 3, .1, .6, 0xaf7663);
      }
      if (kind === 'police') {
        for (let y = 0; y < 12; y++) { const half = y < 6 ? 5 : Math.max(1, 5 - Math.floor((y - 5) / 2)); b(g, -4, 4.4 - y * .1, d / 2 + .23, half * .2, .1, .2, 0xb1a47a); }
        b(g, -4, 3.9, d / 2 + .4, .2, .6, .1, 0x455f66); b(g, -4, 3.9, d / 2 + .4, .6, .2, .1, 0x455f66);
      }
    } },
    { id: `building:${kind}:${w}:${d}:${h}:ivy`, unit: .16, build(g) {
      for (let y = 0; y < h - .4; y += .32) {
        const x = w / 2 - .25 - hash(0, Math.round(y * 10), 0) * .8;
        g.ellipsoid(x / .16, y / .16 + 2, (d / 2 + .15) / .16, 2.1, 2, 1.2, y % .64 < .3 ? 0x6d8056 : 0x899563, .15);
      }
    } },
  ];
}

export function gasShopRecipe(): VoxelRecipe {
  return { id: 'gas:shop:v1', unit: .2, build(g) {
    b(g, 0, 1.8, 0, 10, 3.6, 5, 0xb5b79d); b(g, 0, 3.7, 0, 10.4, .2, 5.4, 0x627b6c);
    for (const x of [-3, 3]) { b(g, x, 1.6, 2.55, 2.4, 1.8, .2, 0xcac6a5); b(g, x, 1.6, 2.75, 2, 1.4, .2, 0x4d7067); b(g, x, 1.6, 2.9, .2, 1.4, .2, 0xb5b698); }
    b(g, 0, 1.1, 2.6, 1.4, 2.2, .2, 0x415e51);
    for (let x = -4; x < 5; x += .6) b(g, x, .6, 2.6, .4, .2, .2, 0x92927a);
    b(g, 5.2, 1, 1.6, .4, 1, .6, 0x7e927c);
  } };
}
