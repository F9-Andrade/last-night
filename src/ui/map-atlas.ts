import { CITY_SITES } from '../game/city';
import { CARGO_OBSTACLES, PLAZA_MONUMENT, REGIONS, ROADS, WAREHOUSES } from '../game/districts';
import { BUILDINGS, CARS, FENCES, TREE_TRUNKS, URBAN, WORLD_LIMIT } from '../game/world';

interface Rect { x:number; z:number; w:number; d:number }
interface Roof extends Rect { color:string; pitched:boolean; front?:number }
interface Vehicle extends Rect { angle:number; color:string }
export interface MapBounds { left:number; top:number; width:number; height:number }

const TILE_METERS=128, TILE_PIXELS=512, TILE_LIMIT=12, OVERVIEW_PIXELS=1536;
export const MAP_EXTENT=WORLD_LIMIT+14;
const hex=(color:number)=>`#${color.toString(16).padStart(6,'0')}`;
const roofs:Roof[]=[
 ...BUILDINGS.filter(b=>b.kind!=='base').map(b=>({...b,color:b.kind==='house'?'#ae8665':b.kind==='police'?'#779898':'#a5af9b',pitched:b.kind==='house'})),
 ...WAREHOUSES.map(b=>({...b,color:'#78928b',pitched:false})),
 ...CITY_SITES.filter(b=>b.kind!=='cemetery').map(b=>({...b,color:b.kind==='house'||b.kind==='motel'?'#ad8667':'#8d9f8c',pitched:b.kind==='house'||b.kind==='motel'})),
 ...URBAN.buildings.map(b=>({...b,color:b.style==='house'?'#ac8567':b.style==='workshop'?'#7c9690':b.style==='shop'?'#9ea48a':'#8b9b96',pitched:b.style==='house',front:b.front})),
 // The original station has a separate shop and forecourt canopy in the town renderer.
 {x:-27,z:29,w:10,d:5,color:'#b1926f',pitched:false},
 {x:-25,z:22,w:13,d:5.6,color:'#c0b694',pitched:false},
];
const vehicles:Vehicle[]=[
 ...CARS.map(v=>({...v,w:1.8,d:3.7,color:hex(v.color)})),
 ...URBAN.vehicles.map(v=>({...v,w:v.kind==='truck'||v.kind==='bus'?2.5:1.9,d:v.kind==='bus'?9:v.kind==='truck'?7.2:v.kind==='van'||v.kind==='ambulance'?5.2:4,color:v.kind==='police'?'#627c85':v.kind==='ambulance'?'#d0cab3':hex(v.color)})),
];
const centralLots:Rect[]=[
 {x:-26,z:-5,w:17,d:17},{x:1.5,z:-3,w:19,d:25},{x:27,z:-3,w:18,d:19},
 {x:26,z:-27,w:19,d:19},{x:-26,z:-28,w:17,d:18},{x:1.5,z:-28,w:19,d:18},
 {x:1,z:28,w:20,d:19},{x:26,z:28,w:19,d:19},{x:-26,z:28,w:18,d:19},
];
const overlaps=(r:Rect,b:MapBounds,pad=0)=>r.x+r.w/2+pad>=b.left&&r.x-r.w/2-pad<=b.left+b.width&&r.z+r.d/2+pad>=b.top&&r.z-r.d/2-pad<=b.top+b.height;
const rect=(c:CanvasRenderingContext2D,r:Rect,pad=0)=>c.fillRect(r.x-r.w/2-pad,r.z-r.d/2-pad,r.w+pad*2,r.d+pad*2);

/** Two-dimensional cartography only. Detailed tiles are baked on demand, never
 * from the Three.js scene. Twelve 512² tiles cap local raster storage at 12 MiB;
 * the lazily created 1536² overview adds 9 MiB only after opening the map. */
export class CityMapAtlas {
 private tiles=new Map<string,HTMLCanvasElement>();
 private overview?:HTMLCanvasElement;

 draw(c:CanvasRenderingContext2D,b:MapBounds,w:number,h:number,full:boolean):void {
  if(full){
   this.overview??=this.paint({left:-MAP_EXTENT,top:-MAP_EXTENT,width:MAP_EXTENT*2,height:MAP_EXTENT*2},OVERVIEW_PIXELS,false);
   c.drawImage(this.overview,(-MAP_EXTENT-b.left)*w/b.width,(-MAP_EXTENT-b.top)*h/b.height,MAP_EXTENT*2*w/b.width,MAP_EXTENT*2*h/b.height);
   return;
  }
  // Only the two-to-four tiles intersecting the local 100 m view are copied.
  for(let z=Math.floor(b.top/TILE_METERS);z<=Math.floor((b.top+b.height)/TILE_METERS);z++){
   for(let x=Math.floor(b.left/TILE_METERS);x<=Math.floor((b.left+b.width)/TILE_METERS);x++){
    const key=`${x}:${z}`;
    let tile=this.tiles.get(key);
    if(tile)this.tiles.delete(key);
    else tile=this.paint({left:x*TILE_METERS,top:z*TILE_METERS,width:TILE_METERS,height:TILE_METERS},TILE_PIXELS,true);
    this.tiles.set(key,tile);
    if(this.tiles.size>TILE_LIMIT){const oldest=this.tiles.keys().next().value!;this.tiles.get(oldest)!.width=0;this.tiles.delete(oldest);}
    const left=Math.max(b.left,x*TILE_METERS),top=Math.max(b.top,z*TILE_METERS);
    const right=Math.min(b.left+b.width,(x+1)*TILE_METERS),bottom=Math.min(b.top+b.height,(z+1)*TILE_METERS);
    if(right>left&&bottom>top)c.drawImage(tile,(left-x*TILE_METERS)*4,(top-z*TILE_METERS)*4,(right-left)*4,(bottom-top)*4,(left-b.left)*w/b.width,(top-b.top)*h/b.height,(right-left)*w/b.width,(bottom-top)*h/b.height);
   }
  }
 }

 private paint(bounds:MapBounds,pixels:number,detail:boolean):HTMLCanvasElement {
  const sheet=document.createElement('canvas');sheet.width=sheet.height=pixels;
  const c=sheet.getContext('2d')!;
  c.fillStyle='#48594c';c.fillRect(0,0,pixels,pixels);
  const scale=pixels/bounds.width;c.scale(scale,scale);c.translate(-bounds.left,-bounds.top);
  c.fillStyle='#7c8e6d';c.fillRect(-WORLD_LIMIT,-WORLD_LIMIT,WORLD_LIMIT*2,WORLD_LIMIT*2);
  c.save();c.beginPath();c.rect(-WORLD_LIMIT,-WORLD_LIMIT,WORLD_LIMIT*2,WORLD_LIMIT*2);c.clip();

  // Sidewalks are drawn before asphalt so intersecting streets remain open.
  c.fillStyle='#abb29d';for(const r of ROADS)if(overlaps(r,bounds,2))rect(c,r,1.85);
  c.fillStyle='#424e50';for(const r of ROADS)if(overlaps(r,bounds))rect(c,r);
  c.strokeStyle=detail?'#c5bc8b':'#97a090';c.lineWidth=detail?.16:.24;
  c.setLineDash([2,4]);
  for(const r of ROADS){
   if(!overlaps(r,bounds))continue;
   const horizontal=r.w>r.d;c.beginPath();
   c.moveTo(r.x-(horizontal?r.w/2:0),r.z-(horizontal?0:r.d/2));
   c.lineTo(r.x+(horizontal?r.w/2:0),r.z+(horizontal?0:r.d/2));c.stroke();
  }
  c.setLineDash([]);
  // Remove lane paint at intersections using the same authored road rectangles.
  c.fillStyle='#424e50';
  for(const a of ROADS)if(a.w>a.d&&overlaps(a,bounds))for(const b of ROADS)if(b.d>b.w){
   const left=Math.max(a.x-a.w/2,b.x-b.w/2),top=Math.max(a.z-a.d/2,b.z-b.d/2);
   const right=Math.min(a.x+a.w/2,b.x+b.w/2),bottom=Math.min(a.z+a.d/2,b.z+b.d/2);
   if(right>left&&bottom>top)c.fillRect(left,top,right-left,bottom-top);
  }
  for(const lot of centralLots)if(overlaps(lot,bounds)){
   c.fillStyle='#b4b49d';rect(c,lot);c.fillStyle='#899d76';rect(c,lot,-.9);
  }
  for(const site of CITY_SITES)if(overlaps(site,bounds,8)){
   c.fillStyle='#b0b09a';rect(c,site,3.5);
   if(site.kind==='cemetery'){
    c.fillStyle='#718865';rect(c,site);
    c.fillStyle='#a7aa90';c.fillRect(site.x-1.15,site.z-site.d/2,2.3,site.d);
    c.fillRect(site.x-site.w/2,site.z-1.15,site.w,2.3);
    c.fillStyle='#bdbaa5';for(const p of site.props)rect(c,{...p,x:site.x+p.x,z:site.z+p.z});
   }
   if(site.kind==='school'){
    c.fillStyle='#607c67';c.fillRect(site.x-10,site.z-site.d/2-12.5,20,9);
    c.strokeStyle='#c1c4a7';c.lineWidth=.16;c.strokeRect(site.x-9,site.z-site.d/2-12,18,8);
   }
   if(site.kind==='gas'){
    c.fillStyle='#c4b58c';c.fillRect(site.x-7.5,site.z+site.d/2+2.5,15,5);
   }
  }
  for(const r of REGIONS.slice(2,12))if((r.icon==='E'||r.name==='TRIAGEM EXTERNA')&&overlaps({...r,w:25,d:24},bounds)){
   c.fillStyle='#b0b49c';rect(c,{...r,w:25,d:24});
   for(let i=0;i<3;i++){c.fillStyle=i%2?'#8c9a7d':'#c3c2a4';rect(c,{x:r.x-7+i*6,z:r.z+5,w:3.6,d:3.6});}
  }
  c.fillStyle='#657d79';rect(c,PLAZA_MONUMENT);
  c.fillStyle='#bfb79a';c.fillRect(-.75,.2,3.5,9);

  for(const b of roofs)if(overlaps(b,bounds,3)){
   if(detail){c.fillStyle='#b4b19a';rect(c,b,1);}
   c.fillStyle='#334b4390';rect(c,{...b,x:b.x+1.05,z:b.z+1.35},.3);
   c.fillStyle=b.color;rect(c,b,.2);
   if(b.pitched){
    c.fillStyle='#edcca12b';c.fillRect(b.x-b.w/2-.2,b.z-b.d/2-.2,b.w+.4,b.d/2+.2);
    c.fillStyle='#4d392628';c.fillRect(b.x-b.w/2-.2,b.z,b.w+.4,b.d/2+.2);
    c.strokeStyle='#dcba91';c.lineWidth=.22;c.beginPath();c.moveTo(b.x-b.w/2,b.z);c.lineTo(b.x+b.w/2,b.z);c.stroke();
   }else if(detail){
    c.strokeStyle='#d3d1b680';c.lineWidth=.22;c.strokeRect(b.x-b.w/2+.25,b.z-b.d/2+.25,b.w-.5,b.d-.5);
    c.fillStyle='#4c6568';rect(c,{x:b.x-b.w*.2,z:b.z-b.d*.15,w:Math.min(2.4,b.w*.22),d:Math.min(1.8,b.d*.22)});
   }
   if(detail){
    c.fillStyle=b.pitched?'#dcc59f':'#c3c7b1';
    const front=b.front??1;c.fillRect(b.x-1.2,b.z+front*(b.d/2+.35)-.2,2.4,.45);
   }
  }
  c.fillStyle='#9d8062';for(const r of CARGO_OBSTACLES)if(overlaps(r,bounds)){
   rect(c,r);c.fillStyle='#c6aa7b';rect(c,{...r,w:.18});c.fillStyle='#9d8062';
  }
  if(detail){
   c.fillStyle='#d4cfac';for(const center of [-12,15])for(let i=0;i<6;i++)for(const z of [7.8,18.3])rect(c,{x:center-2.8+i*1.1,z,w:.65,d:2});
   c.fillStyle='#e1c89b';for(const fence of FENCES)rect(c,fence);
   for(const v of vehicles)if(overlaps(v,bounds,6)){
    c.save();c.translate(v.x,v.z);c.rotate(-v.angle);
    c.fillStyle='#263c3b';c.fillRect(-v.w/2-.12,-v.d/2-.1,v.w+.24,v.d+.2);
    c.fillStyle=v.color;c.fillRect(-v.w/2,-v.d/2,v.w,v.d);
    c.fillStyle='#39595a';c.fillRect(-v.w*.39,-v.d*.24,v.w*.78,v.d*.12);c.fillRect(-v.w*.39,v.d*.2,v.w*.78,v.d*.12);
    c.restore();
   }
  }
  // Crowns use the actual collision-tree locations; no invented parks or water.
  for(let i=0;i<TREE_TRUNKS.length;i++){
   const t=TREE_TRUNKS[i];if(!overlaps(t,bounds,3.5))continue;
   const radius=1.7+(i%3)*.3;
   c.beginPath();c.arc(t.x+.8,t.z+1,radius+.25,0,Math.PI*2);c.fillStyle='#314c3b70';c.fill();
   c.beginPath();c.arc(t.x,t.z,radius,0,Math.PI*2);c.fillStyle=['#426c4c','#527954','#65895a'][i%3];c.fill();
   if(detail){c.beginPath();c.arc(t.x-.45,t.z-.5,radius*.57,0,Math.PI*2);c.fillStyle='#97ac713f';c.fill();}
  }
  c.restore();
  c.strokeStyle='#d1c5a16b';c.lineWidth=1/scale;c.strokeRect(-WORLD_LIMIT,-WORLD_LIMIT,WORLD_LIMIT*2,WORLD_LIMIT*2);
  return sheet;
 }
}
