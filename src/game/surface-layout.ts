export interface SurfaceRect {x:number;z:number;w:number;d:number}

/** Cut a ground rectangle around complete occupied footprints, never just its centre.
 * The disjoint pieces retain the original area outside exclusions. This runs only
 * while constructing a world; the renderer can batch the pieces normally. */
export function subtractRectangles(surface:SurfaceRect,exclusions:readonly SurfaceRect[],clearance=0):SurfaceRect[]{
 const epsilon=1e-7;
 if(surface.w<=epsilon||surface.d<=epsilon)return [];
 let pieces=[{...surface}];
 for(const exclusion of exclusions){
  if(exclusion.w<=0||exclusion.d<=0)continue;
  const bx0=exclusion.x-exclusion.w/2-clearance,bx1=exclusion.x+exclusion.w/2+clearance;
  const bz0=exclusion.z-exclusion.d/2-clearance,bz1=exclusion.z+exclusion.d/2+clearance;
  const next:SurfaceRect[]=[];
  for(const p of pieces){
   const x0=p.x-p.w/2,x1=p.x+p.w/2,z0=p.z-p.d/2,z1=p.z+p.d/2;
   const ix0=Math.max(x0,bx0),ix1=Math.min(x1,bx1),iz0=Math.max(z0,bz0),iz1=Math.min(z1,bz1);
   if(ix1-ix0<=epsilon||iz1-iz0<=epsilon){next.push(p);continue;}
   const add=(left:number,right:number,back:number,front:number)=>{
    if(right-left>epsilon&&front-back>epsilon)next.push({x:(left+right)/2,z:(back+front)/2,w:right-left,d:front-back});
   };
   add(x0,ix0,z0,z1);add(ix1,x1,z0,z1);
   add(ix0,ix1,z0,iz0);add(ix0,ix1,iz1,z1);
  }
  pieces=next;if(!pieces.length)break;
 }
 return pieces;
}
