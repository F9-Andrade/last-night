import { REGIONS, ROADS, WAREHOUSES } from '../game/districts';
import { BUILDINGS } from '../game/world';
import type { Simulation } from '../game/simulation';
import { icon } from './icons';
import type { Icon } from './icons';
export const regionIcons:Icon[]=['shelter','market','hospital','police','gas','industry','shelter','market','map','shelter','hospital','scrap'];
export class FieldMap {
  visited=new Set<number>(); private sheet=document.createElement('canvas'); private paths:Path2D[]=[];
  constructor(){
    this.sheet.width=this.sheet.height=900;const c=this.sheet.getContext('2d')!;
    c.fillStyle='#c9c4a7';c.fillRect(0,0,900,900);
    c.strokeStyle='#68765e25';c.lineWidth=1;for(let i=0;i<900;i+=50){c.beginPath();c.moveTo(i,0);c.lineTo(i,900);c.moveTo(0,i);c.lineTo(900,i);c.stroke();}
    c.fillStyle='#e1dac0';for(const r of ROADS)c.fillRect(this.p(r.x-r.w/2),this.p(r.z-r.d/2),r.w*5.25,r.d*5.25);
    for(const b of [...BUILDINGS,...WAREHOUSES]){c.fillStyle='#8a957a';c.fillRect(this.p(b.x-b.w/2),this.p(b.z-b.d/2),b.w*5.25,b.d*5.25);c.strokeStyle='#65745d';c.strokeRect(this.p(b.x-b.w/2),this.p(b.z-b.d/2),b.w*5.25,b.d*5.25);}
    c.strokeStyle='#596b5733';c.beginPath();c.moveTo(450,0);c.lineTo(450,900);c.moveTo(0,450);c.lineTo(900,450);c.stroke();
    this.paths=regionIcons.map(k=>new Path2D(icon(k).match(/<path d="([^"]+)"/)![1]));
  }
  private p(v:number):number{return 450+v*5.25;}
  reset():void{this.visited.clear();}
  draw(canvas:HTMLCanvasElement,sim:Simulation,full=false):void {
    const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.drawImage(this.sheet,0,0,w,h);
    const sx=(v:number)=>this.p(v)*w/900,sz=(v:number)=>this.p(v)*h/900;
    for(const [i,r] of REGIONS.entries()){
      if(Math.hypot(r.x-sim.player.x,r.z-sim.player.z)<18)this.visited.add(i);
      if(!full&&i>5)continue;
      c.save();c.translate(sx(r.x),sz(r.z));const s=full?1.25:.75;c.scale(s,s);c.fillStyle=this.visited.has(i)?'#eae2c9':'#c9c4a7';c.strokeStyle='#405346';c.lineWidth=1.5;c.beginPath();c.rect(-15,-15,30,30);c.fill();c.stroke();c.translate(-12,-12);c.stroke(this.paths[i]);c.restore();
      if(full){c.font='bold 13px Field Sans, sans-serif';c.textAlign='center';c.fillStyle='#33483e';c.fillText(r.name,sx(r.x),sz(r.z)+32,180);}
    }
    if(sim.worldEvent&&!sim.worldEvent.triggered){const e=sim.worldEvent;c.save();c.translate(sx(e.x),sz(e.z));c.fillStyle=e.kind==='cache'?'#9b783e':'#8d5441';c.rotate(Math.PI/4);c.fillRect(-5,-5,10,10);c.restore();if(full){c.font='12px Field Sans';c.fillStyle='#694c31';c.textAlign='center';c.fillText(e.name,sx(e.x),sz(e.z)-13);}}
    c.save();c.translate(sx(sim.player.x),sz(sim.player.z));c.rotate(-sim.player.angle);c.fillStyle='#354b43';c.strokeStyle='#fff0ce';c.lineWidth=2;c.beginPath();c.moveTo(0,9);c.lineTo(-6,-6);c.lineTo(0,-3);c.lineTo(6,-6);c.closePath();c.fill();c.stroke();c.restore();
  }
}
