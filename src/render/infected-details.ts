import {VoxelGrid} from './voxel.ts';
import type {CharacterPart} from './character-assets.ts';
import type {EnemyKind} from '../game/enemies.ts';

const SHADOW=0x343b33,DRY=0x59382f,WOUND=0x785047,BONE=0xb7ad88;
/** Model-local 4 cm details, merged into the six existing meshes. No textures or extra draw calls. */
export function detailInfected(g:VoxelGrid,part:CharacterPart,kind:EnemyKind,variant:number):void {
 const skin=kind==='screamer'?0xb2ad86:kind==='tank'?0x98977a:kind==='runner'?0xa0a887:kind==='spitter'?0xa4ac75:[0x96977d,0xa59b81,0x899480][variant];
 const pale=kind==='spitter'?0xb4b780:0xb0ad91,dark=kind==='spitter'?0x687954:0x6b7663;
 // Surface painting follows the actual part, including the bulkier torso and extended hands.
 const front=(x:number,y:number,color:number,raised=false)=>{
  for(let z=24;z>=-18;z--)if(g.get(x,y,z)!==undefined){g.set(x,y,z+(raised?1:0),color);return;}
 };
 const patch=(x:number,y:number,w:number,h:number,color:number,raised=false)=>{for(let i=x;i<x+w;i++)for(let j=y;j<y+h;j++)front(i,j,color,raised);};
 if(part==='head'){
  // Carve away the old projecting eye blocks; narrow eyes sit inside dark sockets.
  g.carve(-6,7,8,12,5,3);
  g.fill(-6,8,6,4,3,2,SHADOW).fill(2,8,6,4,3,2,SHADOW);
  g.fill(-6,11,6,4,1,2,dark).fill(2,11,6,4,1,2,dark);
  g.set(-4,9,7,0xb8b191).set(3,9,7,0xafa989);
  g.set(-4,9,8,0x767d66).set(3,9,8,0x74765e);
  // Asymmetric cheekbones, ear folds, nostrils and broken nasal bridge.
  g.fill(-5,5,7,2,2,1,pale).fill(3,5,7,2,2,1,skin);
  g.carve(-2,4,8,4,4,2);
  g.fill(-1,5,8,2,4,1,skin).set(-1,5,9,dark).set(0,5,9,SHADOW);
  patch(-7,6,1,2,dark);patch(6,6,1,2,WOUND);
  g.fill(-5,6,8,1,2,1,DRY).set(-5,5,7,WOUND).set(-4,4,8,DRY);
  if(kind==='screamer'){
   // Long open throat with irregular teeth along the rim, kept inside the original jaw.
   g.carve(-4,-1,6,8,9,5);
   g.fill(-4,-1,6,8,9,3,0x302e28).fill(-3,0,8,6,6,1,0x543c32);
   for(const x of [-3,-1,2])g.fill(x,6,8,1,2,1,BONE);
   for(const x of [-3,0,2])g.set(x,0,8,0xa99e79);
   g.fill(-6,0,6,1,6,2,dark).fill(5,0,6,1,6,2,dark);
   g.fill(-3,-3,8,6,1,1,skin);
  }else if(kind==='spitter'){
   g.fill(-4,0,4,8,5,2,0x3c4934).fill(-3,-2,8,6,1,1,0x6b7550);
   for(const x of [-3,0,2])g.set(x,3,6,BONE);
   g.fill(-1,-4,8,1,4,1,0x8a9460).set(1,-2,8,0xa1a872);
   g.fill(-6,2,5,2,3,2,dark).set(-6,3,7,pale);
  }else{
   g.fill(-4,1,8,8,3,1,0x39352b);
   for(const x of [-3,-1,2])g.set(x,3,9,BONE);
   for(const x of [-2,1,3])g.set(x,1,9,0x9d9474);
   g.fill(-3,-1,7,6,1,1,dark).fill(-2,0,8,4,1,1,skin);
   g.set(4,2,8,WOUND).set(4,1,8,DRY).set(3,0,8,DRY);
  }
  // Recessed ear folds and bruising at the temples break up the side planes.
  for(const side of [-1,1])for(let y=3;y<10;y++)for(let z=-3;z<3;z++){
   for(let x=9;x>=3;x--){const sx=side<0?-x:x-1;if(g.get(sx,y,z)===undefined)continue;
    if(y>=5&&y<=7&&z>=0){g.set(sx,y,z,dark);if(y===6&&z===1)g.remove(sx,y,z);}
    else if(y===8&&z<0)g.set(sx,y,z,side<0?0x7c806a:skin);
    break;
   }
  }
  // Scalp injury follows the top plane rather than a floating decoration.
  for(let x=variant-3;x<variant;x++)for(let z=-3;z<0;z++){
   for(let y=17;y>=10;y--)if(g.get(x,y,z)!==undefined){g.set(x,y,z,(x+z)%2?WOUND:DRY);break;}
  }
 }else if(part==='torso'){
  const top=kind==='tank'?46:kind==='runner'?35:38;
  // Folded collar, placket, a hanging pocket flap and ragged fabric hems.
  patch(-5,top-3,3,3,0x454c40,true);patch(2,top-3,3,3,0x555b4b,true);
  if(kind==='walker'){
   patch(0,23,1,12,0x3e4840);for(const y of [25,29,33])front(0,y,0xa19777,true);
   patch(3,29,4,4,0x424f46,true);patch(3,32,4,1,0x859080,true);
   patch(-6,24,3,4,dark);patch(-5,24,2,3,WOUND);front(-4,23,DRY);
   g.carve(5,20,3,2,2,3).set(4,21,5,0x414a3f);
   // Shirt seam and old blood down the back, readable when chasing a survivor.
   g.fill(-1,24,-7,1,12,1,0x444b40).fill(3,28,-7,2,3,1,DRY);
  }else if(kind==='runner'){
   patch(-4,22,8,10,dark);patch(-1,23,2,9,0x535a49);
   for(const y of [24,27,30]){patch(-4,y,3,1,pale,true);patch(1,y-1,3,1,skin,true);}
   patch(3,21,1,4,DRY);patch(-5,29,1,5,WOUND);
  }else if(kind==='tank'){
   // Torn work vest, reinforcing seams and a healed diagonal chest scar.
   patch(-13,32,4,10,0x514c3c);patch(9,31,4,11,0x514c3c);
   patch(-12,35,2,5,0x9b8c61,true);patch(10,35,2,5,0x998860,true);
   for(let i=0;i<9;i++){front(-5+i,33+Math.floor(i/2),WOUND);if(i%2===0)front(-5+i,34+Math.floor(i/2),pale);}
   patch(-7,28,3,3,DRY);patch(4,28,2,5,dark);patch(-4,43,8,1,dark);
  }else if(kind==='spitter'){
   // Swollen olive glands and leaking collar; no emissive/neon skin.
   for(const [x,y] of [[-5,30],[3,32],[-2,36]]){patch(x,y,3,3,dark,true);patch(x+1,y+1,1,1,pale,true);}
   patch(-1,27,1,7,0x67784c);patch(1,26,1,3,0x87965d);
   patch(-7,23,2,6,DRY);patch(5,23,2,3,0x445a48);
  }else{
   // Tendons remain on the long original neck, avoiding changes to the head's hit region.
   g.fill(-2,39,4,1,10,1,dark).fill(1,39,4,1,10,1,skin);
   g.fill(0,41,5,1,6,1,0x797956);patch(-5,25,3,7,DRY);
   patch(3,29,3,4,0x555e54,true);front(4,32,0xa7a17e,true);
  }
  patch(-5,21,3,1,0x393f35);patch(2,21,2,2,0x535641);
 }else if(part.endsWith('leg')){
  const bottom=kind==='tank'?-24:kind==='screamer'?-22:kind==='runner'?-18:-20;
  const side=part==='left-leg'?-1:1;
  patch(side*2,-8,2,3,WOUND);front(side*2,-6,DRY);
  patch(-3,-5,1,5,0x3e4b40);patch(2,-11,1,4,0x67715c);
  // Toe caps, laces and worn sole edges, all attached to the existing boot.
  patch(-3,bottom+2,6,1,0x777663);patch(-2,bottom+3,4,1,0x41483b);
  for(const y of [bottom+4,bottom+6])patch(-1,y,2,1,0x9b9679);
  patch(-3,bottom,2,1,0x444d3e);
 }else{
  const hanging=kind==='runner'||kind==='screamer',tank=kind==='tank';
  patch(-3,-4,1,4,0x3f4a40);patch(2,-6,1,3,0x7a7f69);
  // Torn sleeve openings expose forearm skin along the side, not only at the fist.
  if(!hanging&&!tank){
   for(const x of [-4,3])for(let y=-6;y<=-3;y++)for(let z=4;z<11;z++){
    if(g.get(x,y,z)!==undefined&&z>5+(y%2))g.set(x,y,z,y===-6?dark:skin);
   }
   g.carve(3,-4,6,1,1,2);
  }
  const handY=hanging?-20:tank?-11:kind==='spitter'?-10:-5;
  patch(-1,handY,2,2,DRY);front(1,handY+1,WOUND);
  if(hanging){
   g.carve(0,-22,3,1,2,4);front(-2,-21,BONE);front(2,-21,0x928c6d);
   patch(-1,-15,1,4,dark);
  }else{
   const tip=tank?21:kind==='spitter'?(part==='left-arm'?21:13):17;
   for(const x of (tank?[-4,0,4]:[-2,1])){
    g.carve(x,handY-2,tip-1,1,2,2);front(x+1,handY,0x9c9576);
   }
   patch(-2,handY+2,1,1,pale);patch(1,handY+2,1,1,pale);
  }
 }
}
