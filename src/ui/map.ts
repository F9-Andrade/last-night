import { REGIONS } from '../game/districts';
import { CITY_SITES } from '../game/city';
import { EXPANSION_DISTRICTS } from '../game/expansion';
import type { Simulation } from '../game/simulation';
import { CityMapAtlas, MAP_EXTENT } from './map-atlas';
import type { MapBounds } from './map-atlas';
import { icon } from './icons';
import type { Icon } from './icons';

export const regionIcons:Icon[]=['shelter','market','hospital','police','gas','industry','shelter','market','map','shelter','hospital','scrap',...CITY_SITES.map(s=>({hospital:'hospital',school:'school',motel:'shelter',market:'market',industry:'industry',fire:'fire',cemetery:'cemetery',quarantine:'quarantine',gas:'gas',police:'police',house:'shelter',church:'cemetery',terminal:'map'}[s.kind] as Icon))];
const mapLabels=['Abrigo 07','Mercado','Hospital central','Delegacia','Posto','Indústria','Jardins do Norte','Galeria','Praça','Vila das Acácias','Triagem','Manutenção','Escola Aurora','Hospital norte','Motel','Hipermercado','Fundição','Bombeiros','Cemitério','Quarentena','Posto rodoviário','Depósito da guarda',...Array.from({length:8},(_,i)=>`Casa ${i+1}`),'Igreja São Miguel','Terminal Santa Luz'];
const LOCAL_SPAN=100, HOME='#d9b569', SELF='#69dec3', TEAM='#8ac9df';
interface ScreenRect {x:number;y:number;w:number;h:number}
interface Marker {index:number;x:number;y:number;known:boolean;distance:number}
export interface MapPeer {x:number;z:number;angle:number;hp:number}
const intersects=(a:ScreenRect,b:ScreenRect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const titleCase=(text:string)=>text.toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g,letter=>letter.toLocaleUpperCase('pt-BR'));
const locationLabel=(index:number)=>mapLabels[index]??titleCase(REGIONS[index].name);

export class FieldMap {
 visited=new Set<number>();
 private atlas=new CityMapAtlas();
 private frames=new WeakMap<HTMLCanvasElement,string>();
 private paths=regionIcons.map(k=>new Path2D(icon(k).match(/<path d="([^"]+)"/)![1]));

 constructor(){
  // Canvas keeps rasterized text: a newly loaded font must invalidate the cached
  // frame even when the survivor and every map marker are stationary.
  document.fonts?.addEventListener('loadingdone',()=>{this.frames=new WeakMap();});
 }

 reset():void {this.visited.clear();this.frames=new WeakMap();}

 draw(canvas:HTMLCanvasElement,sim:Simulation,full=false,peers:readonly MapPeer[]=sim.coopTargets):void {
  const c=canvas.getContext('2d');if(!c||!canvas.width||!canvas.height)return;
  for(let index=0;index<REGIONS.length;index++){const r=REGIONS[index];if(index===0||Math.hypot(r.x-sim.player.x,r.z-sim.player.z)<18||index>=12&&sim.discoveredSites.has(CITY_SITES[index-12].id))this.visited.add(index);}
  const event=sim.worldEvent;
  // Do not repaint an identical atlas/marker image. Inputs remain exact (no
  // quantization or reduced cadence), so movement still updates on every call.
  const key=`${sim.runSeed}:${canvas.width}:${canvas.height}:${full}:${sim.player.x}:${sim.player.z}:${sim.player.angle}:${[...this.visited].join(',')}:${event&&!event.triggered?`${event.kind},${event.name},${event.x},${event.z}`:''}:${peers.filter(p=>p!==sim.player&&p.hp>0).map(p=>`${p.x},${p.z},${p.angle}`).join(';')}`;
  if(this.frames.get(canvas)===key)return;
  const w=canvas.width,h=canvas.height,unit=Math.min(w,h)/(full?600:240);
  // Preserve metres and directions if a layout supplies a rectangular canvas.
  const metersPerPixel=(full?MAP_EXTENT*2:LOCAL_SPAN)/Math.min(w,h);
  const width=w*metersPerPixel,height=h*metersPerPixel;
  const b:MapBounds={left:full?-width/2:sim.player.x-width/2,top:full?-height/2:sim.player.z-height/2,width,height};
  const sx=(x:number)=>(x-b.left)/metersPerPixel,sy=(z:number)=>(z-b.top)/metersPerPixel;
  c.save();c.clearRect(0,0,w,h);c.fillStyle='#48594c';c.fillRect(0,0,w,h);
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  this.atlas.draw(c,b,w,h,full);
  c.lineJoin='round';c.lineCap='round';

  const px=sx(sim.player.x),py=sy(sim.player.z);
  const occupied:ScreenRect[]=[{x:px-14*unit,y:py-14*unit,w:28*unit,h:28*unit}];
  const markers:Marker[]=[];
  for(const [index,r] of REGIONS.entries()){
   const distance=Math.hypot(r.x-sim.player.x,r.z-sim.player.z);
   const x=sx(r.x),y=sy(r.z);
   if(x<-14*unit||y<-14*unit||x>w+14*unit||y>h+14*unit)continue;
   markers.push({index,x,y,known:this.visited.has(index),distance});
  }
  markers.sort((a,b)=>Number(b.index===0)-Number(a.index===0)||Number(b.known)-Number(a.known)||a.distance-b.distance);
  const drawn:Marker[]=[];
  for(const m of markers){
   if(!m.known)continue;
   const size=(m.index===0?11:9)*unit;
   const box={x:m.x-size,y:m.y-size,w:size*2,h:size*2};
   // The dense centre is smaller than a postcode on the complete city atlas.
   // Prioritise the shelter and closest visited sites rather than stack symbols.
   if(full&&m.index!==0&&occupied.some(r=>intersects(box,r)))continue;
   this.marker(c,m.x,m.y,m.index,unit,full);
   occupied.push({...box,x:box.x-2*unit,y:box.y-2*unit,w:box.w+4*unit,h:box.h+4*unit});drawn.push(m);
  }

  for(const merchant of sim.economy.merchants){
   const x=sx(merchant.x),y=sy(merchant.z);if(x<9*unit||y<9*unit||x>w-9*unit||y>h-24*unit)continue;
   c.save();c.translate(x,y);c.beginPath();c.arc(0,0,8*unit,0,Math.PI*2);c.fillStyle='#302c20';c.fill();c.strokeStyle='#e8bf72';c.lineWidth=1.5*unit;c.stroke();
   c.fillStyle='#efcd8b';c.font=`bold ${11*unit}px "Field Sans", sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('$',0,.5*unit);c.restore();
   if(full)this.label(c,`${merchant.name} · ${merchant.title}`,x,y-18*unit,unit,w,h,occupied,'#efd199',true);
  }

  for(const target of peers){
   if(target===sim.player||target.hp<=0)continue;
   const x=sx(target.x),y=sy(target.z);
   if(x<8*unit||y<8*unit||x>w-8*unit||y>h-8*unit)continue;
   this.player(c,x,y,target.angle,unit*.75,TEAM,false);
   occupied.push({x:x-9*unit,y:y-9*unit,w:18*unit,h:18*unit});
  }
  if(event&&!event.triggered){
   const x=sx(event.x),y=sy(event.z);
   if(x>-12*unit&&y>-12*unit&&x<w+12*unit&&y<h+12*unit){
    c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle='#1d302b';c.strokeStyle=event.kind==='cache'?'#ecc783':'#ed9575';c.lineWidth=1.5*unit;
    c.fillRect(-6*unit,-6*unit,12*unit,12*unit);c.strokeRect(-6*unit,-6*unit,12*unit,12*unit);c.restore();
    c.fillStyle=event.kind==='cache'?'#ecc783':'#ed9575';c.font=`bold ${11*unit}px "Field Sans", sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('!',x,y+.5*unit);
    occupied.push({x:x-10*unit,y:y-10*unit,w:20*unit,h:20*unit});
    if(full)this.label(c,event.name,x,y-19*unit,unit,w,h,occupied,'#f0d5a5',true);
   }
  }
  if(full){
   for(const m of drawn)this.label(c,locationLabel(m.index),m.x,m.y+20*unit,unit,w,h,occupied,m.index===0?HOME:'#f0e6cd',true);
   // District names provide the regional overview. Unknown destinations remain
   // unmarked; the original central landmark names are still public map hints.
   for(const district of EXPANSION_DISTRICTS){
    this.label(c,titleCase(district.name),sx(district.x),sy(district.z-97),unit,w,h,occupied,'#e0dfc1',false);
   }
   for(const m of markers)if(!m.known&&m.index>=12&&m.index<32&&CITY_SITES[m.index-12].kind!=='house'){
    this.label(c,locationLabel(m.index),m.x,m.y,unit,w,h,occupied,'#dddcca',false);
   }
  }else{
   const shelter=drawn.find(m=>m.index===0);
   if(shelter)this.label(c,'ABRIGO',shelter.x,shelter.y-18*unit,unit,w,h,occupied,HOME,true);
   // A return bearing remains visible as the shelter leaves the local view.
   if(!shelter)this.homeBearing(c,sx(REGIONS[0].x)-px,sy(REGIONS[0].z)-py,w,h,unit);
  }
  this.player(c,px,py,sim.player.angle,unit,SELF,true);
  this.scale(c,w,h,unit,metersPerPixel,full);
  c.restore();this.frames.set(canvas,key);
 }

 private marker(c:CanvasRenderingContext2D,x:number,y:number,index:number,unit:number,full:boolean):void {
  c.save();c.translate(x,y);const radius=(index===0?10:8.5)*unit;
  c.fillStyle=index===0?'#3b3826':'#243c35';c.strokeStyle=index===0?HOME:'#d8debd';c.lineWidth=1.25*unit;
  c.beginPath();c.roundRect(-radius,-radius,radius*2,radius*2,3*unit);c.fill();c.stroke();
  const size=(index===0?14:full?12:12.5)*unit;c.scale(size/24,size/24);c.translate(-12,-12);c.lineWidth=1.7;c.stroke(this.paths[index]);c.restore();
 }

 private player(c:CanvasRenderingContext2D,x:number,y:number,angle:number,unit:number,color:string,local:boolean):void {
  c.save();c.translate(x,y);c.rotate(-angle);
  if(local){
   c.fillStyle='#69dec323';c.beginPath();c.moveTo(0,0);c.arc(0,0,29*unit,Math.PI/2-.48,Math.PI/2+.48);c.closePath();c.fill();
   c.beginPath();c.arc(0,0,12*unit,0,Math.PI*2);c.strokeStyle='#69dec382';c.lineWidth=unit;c.stroke();
  }
  // Yaw zero looks towards +Z (down); positive yaw turns towards +X (right).
  c.beginPath();c.moveTo(0,10*unit);c.lineTo(-6.5*unit,-6*unit);c.lineTo(0,-3*unit);c.lineTo(6.5*unit,-6*unit);c.closePath();
  c.fillStyle=color;c.strokeStyle='#17372e';c.lineWidth=4*unit;c.stroke();c.fill();
  c.strokeStyle='#f2ffe2';c.lineWidth=1.15*unit;c.stroke();c.restore();
 }

 private label(c:CanvasRenderingContext2D,text:string,x:number,y:number,unit:number,w:number,h:number,occupied:ScreenRect[],color:string,emphasis:boolean):void {
  c.font=`${emphasis?'600':'500'} ${10.5*unit}px "Field Sans", sans-serif`;
  const width=c.measureText(text).width;
  const box={x:x-width/2-4*unit,y:y-7*unit,w:width+8*unit,h:14*unit};
  if(box.x<6*unit||box.y<6*unit||box.x+box.w>w-6*unit||box.y+box.h>h-24*unit||occupied.some(r=>intersects(box,r)))return;
  c.textAlign='center';c.textBaseline='middle';c.lineWidth=3*unit;c.strokeStyle='#314638d9';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);occupied.push(box);
 }

 private homeBearing(c:CanvasRenderingContext2D,dx:number,dy:number,w:number,h:number,unit:number):void {
  const factor=Math.min((w/2-19*unit)/(Math.abs(dx)||1),(h/2-25*unit)/(Math.abs(dy)||1));
  if(factor>=1)return;
  const x=w/2+dx*factor,y=h/2+dy*factor;
  this.marker(c,x,y,0,unit*.8,false);
  c.save();c.translate(x,y);c.rotate(Math.atan2(dy,dx));c.fillStyle=HOME;
  c.beginPath();c.moveTo(13*unit,0);c.lineTo(9.5*unit,-3*unit);c.lineTo(9.5*unit,3*unit);c.closePath();c.fill();c.restore();
 }

 private scale(c:CanvasRenderingContext2D,w:number,h:number,unit:number,metersPerPixel:number,full:boolean):void {
  const meters=full?100:20,length=meters/metersPerPixel,x=13*unit,y=h-13*unit;
  c.fillStyle='#23362bde';c.beginPath();c.roundRect(x-6*unit,y-18*unit,length+12*unit,24*unit,3*unit);c.fill();
  c.strokeStyle='#dddcc1';c.lineWidth=1.1*unit;c.beginPath();c.moveTo(x,y-3*unit);c.lineTo(x,y);c.lineTo(x+length,y);c.lineTo(x+length,y-3*unit);c.stroke();
  c.fillStyle='#e2dfc5';c.font=`600 ${8*unit}px "Field Sans", sans-serif`;c.textAlign='left';c.textBaseline='bottom';c.fillText(`${meters} m`,x,y-5*unit);
  if(full){
   c.textAlign='center';c.font=`600 ${11*unit}px "Field Sans", sans-serif`;c.fillStyle='#f0e6ca';c.strokeStyle='#314638';c.lineWidth=3*unit;
   c.strokeText('N',w-22*unit,23*unit);c.fillText('N',w-22*unit,23*unit);
   c.beginPath();c.moveTo(w-22*unit,28*unit);c.lineTo(w-22*unit,46*unit);c.moveTo(w-26*unit,33*unit);c.lineTo(w-22*unit,28*unit);c.lineTo(w-18*unit,33*unit);c.strokeStyle='#e0ddbd';c.lineWidth=1.5*unit;c.stroke();
  }
 }
}
