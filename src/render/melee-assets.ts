import * as THREE from 'three';
import type {MeleeId} from '../game/crafting.ts';
import {voxelMesh, type VoxelGrid, type VoxelRecipe} from './voxel.ts';

type Point = [number, number, number];
export interface MeleeVisual {
  recipe: VoxelRecipe;
  /** The palm closes around the origin. All shafts/blades extend along local +Y. */
  grip: Point;
  supportGrip?: Point;
  tip: Point;
  /** Blade edge/striking face, useful when posing a slash rather than a thrust. */
  edge: Point;
}

const C = {
  steel: 0x686e6b, darkSteel: 0x393f3e, edge: 0xb5b6a8, worn: 0x8b928a,
  recess: 0x242b29, wood: 0x806043, woodDark: 0x584330, woodLight: 0xa7845a,
  wrap: 0x48523e, wrapDark: 0x303a2e, wrapEdge: 0x777960,
  leather: 0x604634, leatherEdge: 0x8b6a49, rust: 0x79563e,
} as const;

function handle(g:VoxelGrid, bottom:number, top:number, leather=false):void {
  g.fill(-3,bottom,-2,6,top-bottom,4,C.wood);
  g.fill(-3,bottom,-2,1,top-bottom,1,C.woodLight);
  // Broad wrapped bands, visible seams and a capped butt retain clean voxel forms.
  const body=leather?C.leather:C.wrap, seam=leather?C.leatherEdge:C.wrapEdge;
  g.fill(-3,-9,-3,6,17,6,body).fill(-3,-10,-3,6,2,6,C.wrapDark);
  for(const y of [-7,-3,1,5])g.fill(-3,y,-3,6,1,1,seam).fill(2,y,-2,1,1,5,seam);
  g.fill(-2,-10,-2,4,1,4,C.darkSteel);
}

const builders:Record<Exclude<MeleeId,'fists'>,VoxelRecipe['build']> = {
  knife(g) {
    handle(g,-11,9);
    // Full tang, separate bolster, open lanyard notch and inset handle rivets.
    g.fill(-1,-12,-2,2,21,4,C.steel).fill(-3,-9,-3,6,16,6,C.wrap);
    for(const y of [-7,-2,3])g.fill(-3,y,-3,6,1,1,C.wrapEdge);
    g.set(-3,-6,0,C.worn).set(2,-6,0,C.worn).set(-3,3,0,C.worn).set(2,3,0,C.worn);
    g.fill(-4,7,-3,9,2,6,C.darkSteel).fill(4,7,-2,1,2,4,C.worn);
    g.carve(-1,-12,-1,2,1,2);
    // Salvaged drop-point blade: darker spine, shallow fuller and a stepped bevel.
    g.fill(-3,9,-1,7,20,2,C.steel).fill(-3,29,-1,6,4,2,C.steel);
    g.fill(-2,33,-1,4,3,2,C.steel).fill(-1,36,-1,2,2,2,C.worn);
    g.fill(-3,10,-1,1,19,2,C.darkSteel).fill(-2,12,-1,2,14,1,C.worn);
    g.fill(3,10,-1,1,19,2,C.edge).fill(2,29,-1,1,4,2,C.edge);
    g.fill(1,33,-1,1,3,2,C.edge).set(0,37,-1,C.edge);
    g.fill(-1,13,0,1,10,1,C.darkSteel).set(0,25,-1,C.rust).set(-2,10,-1,C.rust);
    g.carve(3,19,-1,1,1,2);
  },
  club(g) {
    handle(g,-12,19);
    // A salvaged timber baton with chamfered shoulders and a split, reinforced head.
    g.fill(-4,13,-4,8,10,8,C.woodDark).fill(-5,23,-5,10,23,10,C.wood);
    g.fill(-4,46,-4,8,3,8,C.woodDark).fill(-3,49,-3,6,1,6,C.woodLight);
    g.fill(-5,25,-5,2,18,1,C.woodLight).fill(4,24,-4,1,19,3,C.woodDark);
    g.fill(-2,24,-5,1,16,1,C.woodDark).fill(-1,38,-5,1,6,1,C.woodDark);
    for(const y of [22,41]) {
      g.fill(-6,y,-5,12,3,10,C.darkSteel).fill(-5,y,-6,10,3,12,C.steel);
      g.fill(-4,y+2,-6,8,1,1,C.worn).set(-4,y+1,-6,C.rust).set(3,y+1,-6,C.edge);
    }
    g.fill(-2,32,-7,2,2,3,C.steel).fill(-2,32,-8,2,2,1,C.edge);
    g.fill(5,28,-1,3,2,2,C.steel).fill(7,28,-1,1,2,2,C.worn);
    g.carve(2,45,-5,3,3,2).fill(2,44,-4,2,1,1,C.woodLight);
  },
  axe(g) {
    handle(g,-13,21);
    // A slightly bent hickory haft. Long grain is localized, never per-voxel noise.
    g.fill(-3,17,-2,6,14,4,C.wood).fill(-2,31,-2,6,14,4,C.wood);
    g.fill(-3,16,-2,1,14,1,C.woodLight).fill(-2,31,-2,1,13,1,C.woodLight);
    g.fill(2,16,-1,1,15,3,C.woodDark).fill(3,31,-1,1,9,3,C.woodDark);
    g.fill(-4,31,-3,8,6,6,C.leather).fill(-4,32,-3,8,1,1,C.leatherEdge).fill(-4,35,-3,8,1,1,C.leatherEdge);
    // Forged socket, broad wedge cheek, toe and heel; a genuine thin cutting edge.
    g.fill(-5,38,-4,10,11,8,C.darkSteel).fill(-6,40,-3,3,7,6,C.steel);
    g.fill(3,39,-3,6,10,6,C.steel).fill(9,37,-2,5,14,4,C.steel);
    g.fill(14,35,-1,3,17,2,C.worn).fill(17,35,-1,1,17,2,C.edge);
    g.fill(15,34,-1,3,1,2,C.edge).fill(16,52,-1,2,1,2,C.edge);
    g.fill(4,40,-3,5,2,1,C.worn).fill(10,38,-2,3,2,1,C.worn);
    g.fill(-3,48,-3,7,1,6,C.worn).fill(-1,49,-2,4,1,4,C.woodDark);
    g.fill(0,49,-1,1,1,2,C.edge).fill(-4,40,-4,3,2,1,C.rust);
    g.set(7,46,-3,C.rust).set(11,44,-2,C.rust).carve(17,42,-1,1,1,2);
  },
  spear(g) {
    // Repaired ash shaft with a metal heel and bindings at the socket.
    g.fill(-2,-58,-2,4,116,4,C.wood).fill(-2,-55,-2,1,109,1,C.woodLight);
    g.fill(-2,8,1,1,36,1,C.woodDark).fill(-2,-58,-2,4,5,4,C.darkSteel);
    g.fill(-3,-8,-3,6,17,6,C.wrap);
    for(const y of [-7,-3,1,5])g.fill(-3,y,-3,6,1,1,C.wrapEdge);
    g.fill(-3,28,-3,6,10,6,C.leather);
    for(const y of [29,33,36])g.fill(-3,y,-3,6,1,1,C.leatherEdge);
    g.fill(-3,48,-3,6,10,6,C.leather).fill(-3,49,-3,6,1,1,C.leatherEdge).fill(-3,53,-3,6,1,1,C.leatherEdge);
    g.fill(-2,54,-2,4,9,4,C.darkSteel).fill(-3,57,-1,6,8,2,C.steel);
    // Broad triangular spearhead with a raised central spine and symmetric bevels.
    g.fill(-5,61,-1,10,8,2,C.steel).fill(-4,69,-1,8,5,2,C.steel);
    g.fill(-3,74,-1,6,5,2,C.steel).fill(-2,79,-1,4,5,2,C.worn).fill(-1,84,-1,2,4,2,C.edge);
    g.fill(-1,61,-2,2,18,4,C.worn);
    for(const [x,y,h] of [[4,61,8],[3,69,5],[2,74,5],[1,79,5]]) {
      g.fill(x,y,-1,1,h,2,C.edge).fill(-x-1,y,-1,1,h,2,C.edge);
    }
    g.fill(-2,59,-2,4,2,1,C.rust).set(-3,67,-1,C.rust);
  },
  machete(g) {
    handle(g,-13,8,true);
    // A pinned full-tang grip, worn leather and a short knuckle stop.
    g.fill(-1,-13,-2,2,22,4,C.darkSteel).fill(-3,-10,-3,6,17,6,C.leather);
    for(const y of [-6,3])g.set(-3,y,-3,C.worn).set(2,y,2,C.worn);
    g.fill(-3,-11,-3,6,2,6,C.darkSteel).fill(-4,7,-3,9,2,6,C.steel);
    g.fill(-3,10,-1,8,31,2,C.steel).fill(-4,30,-1,9,16,2,C.steel);
    g.fill(-4,46,-1,8,4,2,C.steel).fill(-3,50,-1,6,3,2,C.worn).fill(-2,53,-1,4,2,2,C.worn);
    g.fill(-3,11,-1,2,18,1,C.darkSteel).fill(-4,31,-1,2,13,1,C.darkSteel);
    g.fill(4,11,-1,1,35,2,C.edge).fill(3,46,-1,1,4,2,C.edge).fill(2,50,-1,1,3,2,C.edge);
    g.fill(-1,13,-1,1,29,1,C.worn).fill(-2,33,0,2,8,1,C.worn);
    g.fill(-2,11,-1,2,2,1,C.rust).set(1,24,-1,C.rust).set(-3,40,-1,C.rust);
    g.carve(4,24,-1,1,1,2).carve(4,37,-1,1,1,2);
  },
  hammer(g) {
    handle(g,-13,27);
    g.fill(-3,11,-2,1,13,1,C.woodLight).fill(2,10,-1,1,14,3,C.woodDark);
    // Forged claw hammer: octagonal striking face, neck, eye and divided claw.
    g.fill(-4,22,-3,8,8,6,C.darkSteel).fill(-3,24,-4,6,4,8,C.steel);
    g.fill(-8,24,-3,5,5,6,C.steel).fill(-11,22,-4,4,9,8,C.darkSteel);
    g.fill(-12,23,-3,1,7,6,C.worn).fill(-13,24,-2,1,5,4,C.edge);
    g.fill(-10,30,-3,3,1,6,C.worn).fill(-7,28,-3,3,1,1,C.worn);
    g.fill(-3,29,-3,9,3,6,C.steel).fill(-2,31,-2,7,1,4,C.worn);
    for(const z of [-3,1]) {
      g.fill(5,27,z,5,4,2,C.steel).fill(9,24,z,3,5,2,C.steel);
      g.fill(11,21,z,2,5,2,C.worn).fill(12,19,z,2,3,2,C.edge);
    }
    g.fill(-1,32,-2,3,1,4,C.woodDark).fill(0,32,-1,1,1,2,C.edge);
    g.fill(-3,25,-4,2,2,1,C.rust).set(5,30,-3,C.rust).set(-12,25,-3,C.steel);
  },
};

const recipe=(id:MeleeId):VoxelRecipe=>({id:`craft:melee:${id}:2`,unit:.0125,build:id==='fists'?()=>{}:builders[id]});
export const MELEE_VISUALS:Readonly<Record<MeleeId,MeleeVisual>> = {
  fists:{recipe:recipe('fists'),grip:[0,0,0],tip:[0,0,0],edge:[0,0,-1]},
  knife:{recipe:recipe('knife'),grip:[0,0,0],tip:[0,.475,0],edge:[1,0,0]},
  club:{recipe:recipe('club'),grip:[0,0,0],tip:[0,.625,0],edge:[1,0,0]},
  axe:{recipe:recipe('axe'),grip:[0,0,0],tip:[.225,.55,0],edge:[1,0,0]},
  spear:{recipe:recipe('spear'),grip:[0,0,0],supportGrip:[0,.4125,0],tip:[0,1.1,0],edge:[0,1,0]},
  machete:{recipe:recipe('machete'),grip:[0,0,0],tip:[0,.6875,0],edge:[1,0,0]},
  hammer:{recipe:recipe('hammer'),grip:[0,0,0],tip:[-.1625,.3375,0],edge:[-1,0,0]},
};

/** Kept compatible with world preloaders, crafting previews and remote survivors. */
export function meleeRecipe(id:MeleeId):VoxelRecipe {return MELEE_VISUALS[id].recipe;}

const finishes=[
  new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.35,flatShading:true}),
  new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:0,flatShading:true}),
  new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,flatShading:true}),
];
// Assign finishes from the source palette (including voxel AO), so orange rust
// stays metal and leather does not become polished steel under warm scene light.
const palette=Object.entries(C).map(([name,hex])=>({
  color:new THREE.Color(hex),finish:name.startsWith('wood')?1:name.startsWith('wrap')||name.startsWith('leather')?2:0,
}));
const finishedGeometry=new Map<MeleeId,THREE.BufferGeometry>();

/** One shared greedy mesh, at most three finishes. No extra objects per rivet or wrap. */
export function createMeleeVisual(id:MeleeId):THREE.Mesh {
  const mesh=voxelMesh(meleeRecipe(id));let geometry=finishedGeometry.get(id);
  if(!geometry) {
    geometry=mesh.geometry.clone();const indices=geometry.index!,colors=geometry.getAttribute('color');
    const buckets:number[][]=[[],[],[]],selected=new Map<string,number>();
    for(let i=0;i<indices.count;i+=3) {
      const v=indices.getX(i),r=colors.getX(v),g=colors.getY(v),b=colors.getZ(v),key=`${r},${g},${b}`;
      let finish=selected.get(key);
      if(finish===undefined) {
        let closest=Infinity;finish=0;
        for(const p of palette)for(const ao of [1,.86]) {
          const difference=(r-p.color.r*ao)**2+(g-p.color.g*ao)**2+(b-p.color.b*ao)**2;
          if(difference<closest){closest=difference;finish=p.finish;}
        }
        selected.set(key,finish);
      }
      buckets[finish].push(indices.getX(i),indices.getX(i+1),indices.getX(i+2));
    }
    geometry.clearGroups();let first=0;const merged:number[]=[];
    buckets.forEach((bucket,index)=>{if(bucket.length){geometry!.addGroup(first,bucket.length,index);merged.push(...bucket);first+=bucket.length;}});
    geometry.setIndex(merged);finishedGeometry.set(id,geometry);
  }
  mesh.geometry=geometry;mesh.material=finishes;return mesh;
}
