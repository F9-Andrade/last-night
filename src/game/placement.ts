/** Pure placement queries, shared by generation and its diagnostics. */
export interface PlacementRect {x:number;z:number;w:number;d:number}
export function overlapsRect(a:PlacementRect,b:PlacementRect,padding=0):boolean {
 return Math.abs(a.x-b.x)<(a.w+b.w)/2+padding-1e-7&&Math.abs(a.z-b.z)<(a.d+b.d)/2+padding-1e-7;
}
export class PlacementIndex {
 private cells=new Map<string,PlacementRect[]>();
 private cellSize:number;
 constructor(rectangles:readonly PlacementRect[]=[],cellSize=16){this.cellSize=cellSize;for(const r of rectangles)this.add(r);}
 private range(r:PlacementRect,padding=0){return [Math.floor((r.x-r.w/2-padding)/this.cellSize),Math.floor((r.x+r.w/2+padding)/this.cellSize),Math.floor((r.z-r.d/2-padding)/this.cellSize),Math.floor((r.z+r.d/2+padding)/this.cellSize)];}
 add(r:PlacementRect):void {const [x0,x1,z0,z1]=this.range(r);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=`${x}:${z}`,cell=this.cells.get(key)??[];cell.push({...r});this.cells.set(key,cell);}}
 overlaps(r:PlacementRect,padding=0):boolean {const [x0,x1,z0,z1]=this.range(r,padding);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const other of this.cells.get(`${x}:${z}`)??[])if(overlapsRect(r,other,padding))return true;return false;}
}
/** Bounded deterministic nearest search. Never returns an invalid fallback. */
export function findPlacement<T extends PlacementRect>(desired:T,valid:(rect:T)=>boolean,maxRadius=128,step=1):T|undefined {
 if(valid(desired))return {...desired};
 for(let ring=1;ring<=Math.ceil(maxRadius/step);ring++){
  const candidates:T[]=[];
  for(let i=-ring;i<=ring;i++){
   candidates.push({...desired,x:desired.x+i*step,z:desired.z-ring*step},{...desired,x:desired.x+i*step,z:desired.z+ring*step});
   if(Math.abs(i)!==ring)candidates.push({...desired,x:desired.x-ring*step,z:desired.z+i*step},{...desired,x:desired.x+ring*step,z:desired.z+i*step});
  }
  candidates.sort((a,b)=>(a.x-desired.x)**2+(a.z-desired.z)**2-((b.x-desired.x)**2+(b.z-desired.z)**2));
  const found=candidates.find(valid);if(found)return found;
 }
 return undefined;
}
export const withinWorld=(r:PlacementRect,limit:number,margin=0)=>Math.abs(r.x)+r.w/2+margin<=limit&&Math.abs(r.z)+r.d/2+margin<=limit;
