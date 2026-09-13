import { VoxelGrid, hash } from './voxel.ts';
import type { VoxelRecipe } from './voxel.ts';
import type { EnemyKind } from '../game/enemies.ts';

export type CharacterPart = 'torso' | 'head' | 'left-leg' | 'right-leg' | 'left-arm' | 'right-arm';
const SKIN = 0xc9a681, HAIR = 0x3b3c33, BOOT = 0x333b37, PANTS = 0x455654, GOLD = 0xbd9352;

export function characterPart(part: CharacterPart, walker: boolean, variant = 0,kind:EnemyKind='walker'): VoxelRecipe {
  return { id: `${walker ? `${kind}-${variant % 3}` : 'survivor'}:${part}:v2`, unit: .08, build(g) {
    if(walker&&kind!=='walker'){specialPart(g,part,kind,variant);return;}
    const skin = walker ? [0x9ba386, 0xa4a388, 0x91a18b][variant % 3] : SKIN;
    const coat = walker ? [0x65746c, 0x887767, 0x6f8184][variant % 3] : GOLD;
    if (part === 'torso') {
      g.fill(-4, 10, -3, 8, 9, 6, coat).fill(-5, 13, -3, 10, 5, 6, coat).fill(-3, 19, -2, 6, 1, 4, coat);
      g.fill(-4, 10, -3, 8, 1, 6, 0x4b5141).fill(-1, 10, 3, 2, 1, 1, 0xb5ac86);
      if (walker) {
        g.carve(2, 10, 1, 2, 2, 2).carve(-5, 17, 2, 2, 1, 1).fill(0, 14, 3, 1, 4, 1, 0x414e49);
        g.fill(-3, 12, 3, 2, 3, 1, skin).set(-2, 14, 3, 0x795247).set(2, 17, 3, 0x795247).set(2, 16, 3, 0x795247);
        g.fill(-3, 18, -4, 5, 2, 2, coat); // Hunched upper back, no survivor backpack.
      } else {
        g.fill(-3, 15, 3, 3, 3, 1, 0xc49f65).fill(1, 15, 3, 2, 2, 1, 0xa17c45);
        g.fill(0, 11, 3, 1, 8, 1, 0x6d684b).set(0, 17, 4, 0xd4c9a0);
        // Distinct field backpack: curved corners, side pouches, flap, straps, bedroll.
        g.fill(-4, 11, -7, 8, 7, 4, 0x526e5c).fill(-3, 10, -7, 6, 9, 4, 0x526e5c);
        g.fill(-3, 12, -8, 6, 4, 1, 0x6b8062).fill(-3, 17, -8, 6, 2, 2, 0x7f8f6b);
        g.fill(-5, 11, -6, 1, 4, 3, 0x849074).fill(4, 11, -6, 1, 4, 3, 0x495e51);
        g.fill(-2, 12, -9, 1, 6, 1, 0x3c5147).fill(1, 12, -9, 1, 6, 1, 0x3c5147);
        g.set(-2, 15, -10, 0xb6ac85).set(1, 15, -10, 0xb6ac85);
        g.fill(-3, 11, 3, 1, 8, 1, 0x566249).fill(3, 11, 3, 1, 8, 1, 0x566249);
        g.fill(-4, 19, -7, 8, 2, 3, 0x929678).fill(-2, 19, -8, 1, 2, 4, 0x4d5b4b).fill(2, 19, -8, 1, 2, 4, 0x4d5b4b);
        g.fill(-3, 19, -2, 6, 1, 5, 0x9f6850).fill(-2, 18, 3, 3, 1, 1, 0xa57550);
      }
    } else if (part === 'head') {
      g.fill(-3, 0, -3, 6, 7, 6, skin).fill(-4, 2, -2, 8, 3, 4, skin);
      g.fill(-2, -1, -2, 4, 1, 4, skin).fill(-2, 1, 3, 4, 4, 1, skin).fill(-1, 2, 4, 2, 2, 1, walker ? 0x84947a : 0xbc9574);
      g.fill(-3, 6, -3, 6, 2, 6, walker ? 0x505648 : HAIR).fill(-3, 3, -3, 6, 3, 1, HAIR);
      g.fill(-3, 4, -2, 1, 2, 3, HAIR).fill(2, 4, -2, 1, 2, 2, HAIR);
      g.set(-2, 4, 3, 0x39433c).set(1, 4, 3, 0x39433c).fill(-2, 1, 4, 4, 1, 1, walker ? 0x65594b : 0x796c51);
      if (walker) {
        g.carve(0, 7, -2, 3, 1, 4).set(2, 5, 2, skin).set(-2, 4, 4, 0xbcbc84).set(1, 4, 4, 0xbcbc84);
        g.set(-3, 2, 3, 0x855e4d).set(-2, 2, 4, 0x855e4d).set(2, 0, 2, 0x65594b);
      } else { g.fill(-2, 7, -2, 4, 1, 4, 0x484b3b).set(-2, 5, 3, HAIR).set(1, 5, 3, HAIR); }
    } else if (part.endsWith('leg')) {
      g.fill(-2, -7, -2, 4, 7, 4, walker ? 0x4d5a50 : PANTS).fill(-2, -5, 2, 4, 3, 1, walker ? 0x666b58 : 0x637166);
      g.fill(-2, -9, -2, 4, 3, 5, BOOT).fill(-2, -9, 3, 4, 2, 2, BOOT).fill(-2, -10, -2, 4, 1, 7, 0x252e2a);
      g.fill(-1, -8, 3, 2, 1, 1, 0x8b8a6a).set(0, -7, 2, 0xb5a579);
      if (walker && part === 'left-leg') { g.carve(-2, -3, 1, 2, 2, 2).fill(-2, -3, 1, 1, 2, 1, skin); }
      else if (!walker) g.fill(-2, -1, -1, 4, 2, 3, PANTS);
    } else {
      const reach = !walker && part === 'left-arm' ? 9 : walker ? 7 : 6;
      g.fill(-2, -3, -2, 4, 4, 4, coat).fill(-2, -4, 0, 4, 3, reach, coat);
      g.fill(-1, -3, reach - 1, 3, 2, 3, skin).fill(-1, -2, reach + 1, 2, 1, 1, skin);
      if (walker) { g.carve(-2, -3, 2, 1, 2, 3).fill(-2, -3, 2, 1, 1, 3, skin).set(0, -2, 8, 0x775746); }
      else { g.fill(-2, -2, reach - 3, 4, 1, 1, 0x8d7b50).fill(-2, -3, reach - 1, 4, 1, 1, 0x4a5745); }
    }
    // Sparse wear; large calm color fields remain readable at gameplay scale.
    if (part !== 'head') for (const [key, color] of g.cells) {
      const [x, y, z] = VoxelGrid.coordinates(key);
      if (color === coat && hash(x, y, z, variant) > .95) g.cells.set(key, walker ? 0x828775 : 0xc6a369);
    }
  } };
}

/** Separate anatomical recipes retain shared attachment points and wound groups. */
function specialPart(g:VoxelGrid,part:CharacterPart,kind:EnemyKind,variant:number):void {
  if(kind==='screamer'){
    const skin=0xb2ad86,cloth=0x777a79;
    if(part==='torso'){g.fill(-3,10,-2,6,10,4,cloth).fill(-4,15,-3,8,4,5,cloth).fill(-1,19,-1,2,7,3,skin).fill(-2,11,2,4,6,1,0x505f55).fill(-3,10,-3,6,2,1,0x918c75);}
    else if(part==='head'){g.fill(-3,-1,-2,6,8,5,skin).fill(-4,1,-1,8,4,3,skin).fill(-3,5,-3,6,3,4,0x535951).fill(-2,-1,3,4,6,2,0x3e5147).fill(-3,-2,2,6,1,3,skin).fill(-2,5,3,4,1,2,0xc5bd95).set(-2,6,2,0xe0ce9e).set(1,6,2,0xe0ce9e);}
    else if(part.endsWith('leg')){g.fill(-2,-9,-2,4,9,4,0x495d54).fill(-2,-11,-2,4,3,6,0x33473d).fill(-1,-5,2,2,3,1,skin);}
    else{g.fill(-2,-6,-2,4,7,4,cloth).fill(-1,-10,-1,3,5,3,skin).fill(-2,-11,1,4,2,3,skin).fill(-2,-10,4,1,1,2,0x8a886d);}
    return;
  }
  const tank=kind==='tank',runner=kind==='runner',skin=tank?0x98977a:runner?0xa0a887:0xa4ac75;
  const cloth=tank?0x776951:runner?0x805f52:0x647969;
  if(part==='torso'){
    if(tank){
      g.fill(-7,12,-5,14,11,10,cloth).fill(-9,17,-4,18,8,9,cloth).fill(-6,22,-5,12,3,8,skin);
      g.fill(-5,14,5,10,7,1,skin).fill(-2,15,6,4,5,1,0x7e8368).fill(-7,12,-5,14,2,10,0x4f5143);
      g.fill(-7,19,5,3,4,1,cloth).fill(4,18,5,3,5,1,cloth).carve(4,14,4,3,3,2);
      g.fill(-5,21,-6,10,4,2,0x635e49).fill(-4,17,-6,2,5,1,0xa18b57).set(2,17,6,0x725c45);
    }else if(runner){
      g.fill(-3,9,-2,6,9,4,cloth).fill(-4,14,-2,8,4,4,cloth).fill(-3,17,-4,6,3,4,0x585647);
      g.fill(-2,10,2,4,6,1,skin).fill(-1,11,3,1,5,1,0x665e4b).carve(2,9,0,2,4,2);
      for(let y=11;y<16;y+=2)g.fill(-2,y,3,4,1,1,0x85866a);
      g.fill(-3,10,-3,6,1,1,0x423f37).set(-4,17,1,0xb3976e);
    }else{
      g.fill(-5,10,-3,10,9,6,cloth).fill(-4,13,2,8,6,4,skin).fill(-3,12,5,6,5,2,0x929768);
      g.fill(-4,17,-5,8,3,3,cloth).fill(-2,18,2,4,3,3,skin).carve(-5,10,1,3,2,3);
      g.fill(-4,11,-4,2,6,2,0x394f48).fill(3,12,-4,2,5,2,0x8e9a76).set(0,14,7,0xb9b88c);
    }
  }else if(part==='head'){
    const w=tank?4:3;
    g.fill(-w,0,-3,w*2,7,6,skin).fill(-2,-1,0,4,3,4,skin).fill(-w,6,-3,w*2,2,5,tank?0x595847:0x494e3e);
    g.set(-2,4,3,0xd3c88e).set(1,4,3,0xd3c88e).fill(-2,3,3,4,1,1,0x46543d);
    if(kind==='spitter'){g.carve(-2,0,2,4,3,3).fill(-3,-2,2,6,2,3,0x8b9061).fill(-2,-1,4,4,1,1,0xd0c29a).fill(-2,1,2,4,2,1,0x495744).fill(-3,3,-3,6,4,2,0x939b72);}
    else if(runner){g.carve(0,6,0,3,2,3).fill(-2,0,4,4,1,1,0x695548).fill(-3,5,-4,4,2,2,0x4e4a3d);}
    else {g.fill(-4,3,-3,8,2,1,0x716a54).fill(-3,-1,2,6,2,2,0x85856b).set(2,2,3,0x766149);}
  }else if(part.endsWith('leg')){
    const w=tank?3:2,h=tank?12:runner?9:10;
    g.fill(-w,-h+2,-2,w*2,h-2,4,0x48594c).fill(-w,-h,-2,w*2,3,7,0x303e36);
    g.fill(-w,-5,2,w*2,2,1,skin).carve(-w,-3,1,1,2,2).fill(-w,-h,4,w*2,1,1,0x626951);
  }else if(tank){
    g.fill(-3,-5,-3,6,7,6,cloth).fill(-3,-7,0,6,5,7,skin).fill(-3,-7,6,6,4,5,0x898b6e);
    g.fill(-3,-4,9,6,1,1,0x555b48).fill(-3,-6,4,6,1,1,0x635f48);
  }else if(runner){
    g.fill(-2,-6,-2,4,7,4,cloth).fill(-1,-10,-1,3,5,3,skin).fill(-1,-11,1,3,3,3,skin);
    g.fill(-1,-10,4,1,1,2,0x5b5945).carve(-2,-4,1,1,2,2);
  }else{
    const long=part==='left-arm';g.fill(-2,-4,-2,4,5,4,cloth).fill(-2,-6,0,4,3,long?9:5,skin);
    g.fill(-2,-5,long?8:4,4,2,3,0x90996b).set(0,-3,2,0xb3b488);
  }
  for(const [key,color] of g.cells){const [x,y,z]=VoxelGrid.coordinates(key);if(color===cloth&&hash(x,y,z,variant)>.94)g.cells.set(key,0x9b9374);}
}
