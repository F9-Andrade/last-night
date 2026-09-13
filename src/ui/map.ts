import { REGIONS, ROADS, WAREHOUSES } from '../game/districts';
import { BUILDINGS, WORLD_LIMIT } from '../game/world';
import { CITY_SITES } from '../game/city';
import type { Simulation } from '../game/simulation';
import { icon } from './icons';
import type { Icon } from './icons';
export const regionIcons:Icon[]=['shelter','market','hospital','police','gas','industry','shelter','market','map','shelter','hospital','scrap',...CITY_SITES.map(s=>({hospital:'hospital',school:'school',motel:'shelter',market:'market',industry:'industry',fire:'fire',cemetery:'cemetery',quarantine:'quarantine',gas:'gas',police:'police',house:'shelter'}[s.kind] as Icon))];
const mapLabels=['Abrigo 07','Mercado','Hospital central','Delegacia','Posto','Indústria','Jardins do Norte','Galeria','Praça','Vila das Acácias','Triagem','Manutenção','Escola Aurora','Hospital norte','Motel','Hipermercado','Fundição','Bombeiros','Cemitério','Quarentena','Posto rodoviário','Depósito da guarda',...Array.from({length:8},(_,i)=>`Casa ${i+1}`)];
const SCALE=900/(WORLD_LIMIT*2+20);
export class FieldMap {
 visited=new Set<number>();private sheet=document.createElement('canvas');private paths:Path2D[]=[];
 constructor(){
  this.sheet.width=this.sheet.height=900;const c=this.sheet.getContext('2d')!;c.fillStyle='#c9c4a7';c.fillRect(0,0,900,900);
  c.strokeStyle='#68765e25';for(let i=0;i<900;i+=50){c.beginPath();c.moveTo(i,0);c.lineTo(i,900);c.moveTo(0,i);c.lineTo(900,i);c.stroke();}
  c.fillStyle='#e1dac0';for(const r of ROADS)c.fillRect(this.p(r.x-r.w/2),this.p(r.z-r.d/2),r.w*SCALE,r.d*SCALE);
  for(const b of [...BUILDINGS,...WAREHOUSES,...CITY_SITES]){c.fillStyle='#8a957a';c.fillRect(this.p(b.x-b.w/2),this.p(b.z-b.d/2),b.w*SCALE,b.d*SCALE);}
  this.paths=regionIcons.map(k=>new Path2D(icon(k).match(/<path d="([^"]+)"/)![1]));
 }
 private p(v:number):number{return 450+v*SCALE;}
 reset():void{this.visited.clear();}
 draw(canvas:HTMLCanvasElement,sim:Simulation,full=false):void {
  const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,span=full?900:100*SCALE,left=full?0:Math.max(0,Math.min(900-span,this.p(sim.player.x)-span/2)),top=full?0:Math.max(0,Math.min(900-span,this.p(sim.player.z)-span/2));
  c.clearRect(0,0,w,h);c.drawImage(this.sheet,left,top,span,span,0,0,w,h);const sx=(v:number)=>(this.p(v)-left)*w/span,sz=(v:number)=>(this.p(v)-top)*h/span;
  for(const [i,r]of REGIONS.entries()){
   if(i===0||Math.hypot(r.x-sim.player.x,r.z-sim.player.z)<18||i>=12&&sim.discoveredSites.has(CITY_SITES[i-12].id))this.visited.add(i);
   const x=sx(r.x),z=sz(r.z);if(x<-20||z<-20||x>w+20||z>h+20)continue;
   if(!this.visited.has(i)){if(full&&i>=12&&CITY_SITES[i-12].kind!=='house'){c.font='15px Field Sans';c.fillStyle='#526148';c.textAlign='center';c.fillText(mapLabels[i],x,z,135);}continue;}
   c.save();c.translate(x,z);const scale=full?.8:.7;c.scale(scale,scale);c.fillStyle='#eae2c9';c.strokeStyle='#405346';c.lineWidth=1.5;c.fillRect(-15,-15,30,30);c.strokeRect(-15,-15,30,30);c.translate(-12,-12);c.stroke(this.paths[i]);c.restore();
   if(full){c.font='bold 14px Field Sans';c.textAlign='center';c.fillStyle='#33483e';c.fillText(mapLabels[i],x,z+25,135);}
  }
  if(sim.worldEvent&&!sim.worldEvent.triggered){const e=sim.worldEvent;c.save();c.translate(sx(e.x),sz(e.z));c.fillStyle=e.kind==='cache'?'#9b783e':'#8d5441';c.rotate(Math.PI/4);c.fillRect(-5,-5,10,10);c.restore();if(full){c.font='11px Field Sans';c.fillStyle='#694c31';c.textAlign='center';c.fillText(e.name,sx(e.x),sz(e.z)-13);}}
  c.save();c.translate(sx(sim.player.x),sz(sim.player.z));c.rotate(-sim.player.angle);c.fillStyle='#354b43';c.strokeStyle='#fff0ce';c.lineWidth=2;c.beginPath();c.moveTo(0,9);c.lineTo(-6,-6);c.lineTo(0,-3);c.lineTo(6,-6);c.closePath();c.fill();c.stroke();c.restore();
 }
}
