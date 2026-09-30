import {StaticChunk,VisibleGroup} from './static-chunk.ts';
import * as THREE from 'three';
import {CITY_SITES,CITY_PORTALS,activeCityChunks} from '../game/city';
import type {CitySite,CityProp} from '../game/city';
import type {Simulation} from '../game/simulation';
import {box,batch,textSign} from './models';
import {voxelMesh} from './voxel';
import {treeRecipe,propRecipe,carRecipe} from './environment-assets';
import {weatherSurface,surfaceBatchMaterial} from './surface-materials';
import {facadeWeathering} from './facade-weathering';

/** Static district batches, independently hidden roofs and a small mutable portal layer. */
export class CityView {
 private chunks:{site:CitySite;root:StaticChunk;roof:THREE.Group;walls:THREE.Group;paint:THREE.MeshStandardMaterial}[]=[];
 private portals=new Map<string,{root:THREE.Group;panel:THREE.Mesh;boards:THREE.Group}>();
 private lights=[new THREE.PointLight(0xe6d6ba,0,19,2),new THREE.PointLight(0xb7c5d2,0,19,2)];
 active=0;
 constructor(scene:THREE.Scene){
  for(const site of CITY_SITES){
   const root=new StaticChunk();root.name=`city:${site.id}`;root.position.set(site.x,0,site.z);scene.add(root);
   const floor=new THREE.Group();root.add(floor);box(floor,0,.08,0,site.w+7,.16,site.d+7,0x8c947d,'paving');box(floor,0,.19,0,site.w,.06,site.d,site.kind==='hospital'?0xb3b9a4:0x7d8a79,'paving');
   const walls=new THREE.Group();root.add(walls);const roof=new THREE.Group();root.add(roof);
   const h=site.kind==='cemetery'?1.7:site.h;
   const segment=(x:number,z:number,w:number,d:number)=>{box(walls,x,h/2,z,w,h,d,site.color);box(walls,x,.45,z,w+.08,.25,d+.08,0x687c6b);box(walls,x,h-.14,z,w+.08,.28,d+.08,0xb4baa0);};
   segment(-site.w/2,0,.4,site.d);segment(0,-site.d/2,site.w,.4);
   const fw=(site.w-3.2)/2,sd=(site.d-2.8)/2;for(const sign of [-1,1]){segment(sign*(1.6+fw/2),site.d/2,fw,.4);segment(site.w/2,sign*(1.4+sd/2),.4,sd);}
   box(walls,0,h-.5,site.d/2,3.2,1,.45,site.color);box(walls,site.w/2,h-.6,0,.45,1.2,2.8,site.color);
   for(const p of site.partitions){box(walls,p.x,1.5,p.z,p.w,3,p.d,0x929f87);box(walls,p.x,3,p.z,p.w+.08,.14,p.d+.08,0xb9b79c);}
   for(const p of site.props)this.furniture(floor,p);
   if(site.kind!=='cemetery'){
    // Boarded facade bays remain solid; the unboarded side opening is the usable window.
    for(let x=-site.w/2+3;x<site.w/2-1;x+=4){if(Math.abs(x)<3)continue;
     box(walls,x,2,site.d/2+.23,2.4,1.55,.15,0x405c55);box(walls,x,1.2,site.d/2+.34,2.7,.16,.3,0xc0b899);
     for(const y of [1.6,2.2]){const plank=box(walls,x,y,site.d/2+.38,2.5,.2,.14,0x938266);plank.rotation.z=.14;}
    }
    const awning=site.kind==='house'?4:7;box(walls,0,3.1,site.d/2+1,awning,.2,2.4,site.kind==='hospital'?0x67877e:0x9b8767);
    for(const x of [-awning/2+.2,awning/2-.2])box(walls,x,1.5,site.d/2+1.7,.16,3,.16,0x607a67);
    for(const x of [-site.w/2+.3,site.w/2-.3])box(walls,x,site.h/2,site.d/2+.25,.18,site.h,.2,0x61786c);
    // Floor seams and a central circulation strip make rooms readable without textures.
    if(site.kind==='hospital'||site.kind==='school'){box(floor,0,.225,0,5,.018,site.d-.5,0x83998b);for(let z=-site.d/2+1;z<site.d/2;z+=2)box(floor,0,.23,z,site.w-.5,.01,.028,0x758a7a);}
    for(let x=-site.w/2+2;x<site.w/2;x+=3)box(floor,x,.095,site.d/2+5.4,.09,.025,3,0xb6b69b);
   }

   if(site.kind!=='cemetery'){
    box(roof,0,site.h+.1,0,site.w+.6,.25,site.d+.6,0x718979,'roof');
    for(let z=-site.d/2;z<=site.d/2;z+=.7)box(roof,0,site.h+.28,z,site.w+.8,.12,.12,site.kind==='motel'||site.kind==='house'?0xa37e60:0x8a9c87);
    box(roof,-site.w*.25,site.h+.7,0,3,1,2,0x5d716b);
   }
   // Large quiet signs and one specific landmark identify each place at street level.
   textSign(walls,site.kind==='house'?site.name.split(' · ')[0]:site.name,site.kind==='house'?3.8:0,h-.55,site.d/2+.27,site.kind==='house'?1.7:Math.min(18,site.w-3),site.kind==='house'?.4:.8,site.kind==='hospital'?'#a9b29a':'#40594f');
   this.landmark(floor,site);this.dressing(floor,site);facadeWeathering(walls,site.w,site.d,h,1,Math.round(site.x+site.z));
   for(let i=0;i<6;i++){const tree=voxelMesh(treeRecipe(i%3));tree.position.set((i%2?1:-1)*(site.w/2+5),0,-site.d/2+i*(site.d/5));root.add(tree);}
   for(let i=0;i<5;i++){const prop=voxelMesh(propRecipe(i%2?'bag':'rubble'));prop.position.set(-site.w/2+2+i*2,.2,site.d/2+2.3);floor.add(prop);}
   if(site.kind!=='house'){const car=voxelMesh(carRecipe(site.kind==='police'?'police':'wreck',site.kind==='hospital'?0xc3c3ac:0x8e8770));car.position.set(-site.w/2+3,.1,site.d/2+5.8);car.rotation.y=Math.PI/2;root.add(car);}
   for(const x of [-site.w/2-2,site.w/2+2]){box(floor,x,2.5,site.d/2,.14,5,.14,0x536e5f);const bulb=box(floor,x,5,site.d/2,.5,.18,.5,0xd2c38d);bulb.material=new THREE.MeshStandardMaterial({color:0xd2c38d,emissive:0xc7bc86,emissiveIntensity:1.2});}
   batch(floor);batch(roof);batch(walls);const paint=surfaceBatchMaterial('plaster');walls.traverse(o=>{if(o instanceof THREE.Mesh&&!(o.material as THREE.MeshStandardMaterial).map)o.material=paint;});
   root.freeze();this.chunks.push({site,root,roof,walls,paint});
  }
  for(const p of CITY_PORTALS){const root=new VisibleGroup();root.position.set(p.x,0,p.z);scene.add(root);const panel=box(root,0,p.kind==='window'?1.2:1.4,0,p.w, p.kind==='window'?2.4:2.8,p.d,p.kind==='window'?0x8aaea0:p.heavy?0x566f67:0x997f5d);if(p.kind==='window'){panel.material=weatherSurface(new THREE.MeshStandardMaterial({color:0x7b9591,transparent:true,opacity:.42,roughness:.35}),'glass');}
   const boards=new THREE.Group();root.add(boards);for(const y of [.6,1.3,2])box(boards,0,y,0,p.w>p.d?p.w+.2:.5,.18,p.d>p.w?p.d+.2:.5,0xa28c69);batch(boards);this.portals.set(p.id,{root,panel,boards});
  }
  for(const light of this.lights)scene.add(light);
 }
 private furniture(parent:THREE.Group,p:CityProp):void {
  if(p.kind==='bed'){box(parent,p.x,.62,p.z,p.w,.3,p.d,0x687e72);box(parent,p.x,.86,p.z,p.w-.1,.18,p.d-.1,0xc2c2a6);box(parent,p.x,1,p.z-p.d*.3,p.w-.15,.12,.65,0xdfd7b9);box(parent,p.x,1.18,p.z-p.d/2,p.w,1,.1,0x6b8175);for(const x of [-p.w*.4,p.w*.4]){box(parent,p.x+x,.45,p.z,.09,.8,p.d-.3,0x4c645b);box(parent,p.x+x,.3,p.z-p.d*.35,.25,.25,.25,0x354e46);}}
  else if(p.kind==='grave'){box(parent,p.x,.3,p.z,p.w,.2,p.d,0x7d8875);box(parent,p.x,.9,p.z-p.d*.4,p.w*.8,1.3,.3,0xb1af98);box(parent,p.x,1,p.z-p.d*.4+.17,.08,.4,.04,0x6e7e6b);}
  else if(p.kind==='shelf'){for(const y of [.4,1,1.6]){box(parent,p.x,y,p.z,p.w,.12,p.d,0x596f5e);for(let z=-p.d*.35;z<=p.d*.35;z+=.6)box(parent,p.x,y+.22,p.z+z,p.w*.7,.3,.4,Math.round(z*10)%2?0xa69774:0x8b9471);}for(const z of [-p.d/2,p.d/2])box(parent,p.x,1,p.z+z,p.w,1.9,.1,0x5a7163);}
  else if(p.kind==='crate'){box(parent,p.x,.85,p.z,p.w,1.3,p.d,0x8e916f);for(const x of [-p.w*.3,p.w*.3])box(parent,p.x+x,.85,p.z,.15,1.4,p.d+.08,0x4d6958);}
  else if(p.kind==='kitchen'){box(parent,p.x,.65,p.z,p.w,1.1,p.d,0x8a9986);box(parent,p.x,1.25,p.z,p.w+.1,.12,p.d+.1,0xc9c1a6);box(parent,p.x-.5,1.32,p.z,.7,.04,.7,0x566963);for(const x of [-.7,.4])box(parent,p.x+x,.85,p.z+p.d/2+.03,.4,.04,.04,0x4e5e54);box(parent,p.x+.65,1.4,p.z,.4,.18,.4,0x66746a);}
  else if(p.kind==='sofa'){box(parent,p.x,.45,p.z,p.w,.55,p.d,0x746f57);box(parent,p.x,.9,p.z-p.d*.4,p.w,.7,.2,0x827d64);for(const x of [-p.w*.45,p.w*.45])box(parent,p.x+x,.7,p.z,.2,.6,p.d,0x67664f);}
  else if(p.kind==='locker'){box(parent,p.x,1,p.z,p.w,1.9,p.d,0x839487);for(let x=-p.w/2+.1;x<p.w/2;x+=.6){box(parent,p.x+x,1,p.z+p.d/2+.03,.025,1.8,.03,0x566c60);box(parent,p.x+x+.2,1.1,p.z+p.d/2+.07,.04,.2,.08,0xc5b887);}}
  else if(p.kind==='machine'){box(parent,p.x,.8,p.z,p.w,1.4,p.d,0x687e70);box(parent,p.x,1.65,p.z,p.w*.8,.5,p.d*.5,0x586a60);for(let z=-p.d*.35;z<p.d*.4;z+=.5)box(parent,p.x,1.15,p.z+z,p.w+.04,.08,.2,0x8e977a);box(parent,p.x,1.5,p.z+p.d*.4,.45,.5,.15,0xb4ab79);}
  else{box(parent,p.x,p.kind==='bench'?.65:1,p.z,p.w,.18,p.d,0xb1a17b);for(const x of [-p.w*.4,p.w*.4])box(parent,p.x+x,p.kind==='bench'?.36:.55,p.z,.15,p.kind==='bench'?.55:1,.15,0x566b5c);if(p.kind==='bench'){box(parent,p.x,1.02,p.z-p.d*.4,p.w,.22,.12,0x8d8b6a);}}
 }
 private dressing(g:THREE.Group,s:CitySite):void {
  // Wall-mounted detail and tabletop clutter preserve authored circulation and loot access.
  for(const [i,p] of s.props.entries()){
   if(p.kind==='desk'){box(g,p.x+.3,1.28,p.z,.6,.45,.12,0x324941);box(g,p.x+.3,1.25,p.z+.08,.48,.27,.02,0x68847b);box(g,p.x-.4,1.12,p.z+.25,.4,.02,.5,0xc3bd9c);}
   if(p.kind==='bed'&&i%2===0){box(g,p.x,.97,p.z+.3,.6,.025,.4,0x7e5041);box(g,p.x-.2,.97,p.z+.7,.2,.02,.3,0x704e41);}
   if(p.kind==='crate'){box(g,p.x,p.kind==='crate'?1.53:1,p.z,p.w*.6,.04,p.d*.3,0xbbb58e);}
  }
  for(const side of [-1,1]){
   box(g,side*(s.w/2-.25),2.1,-s.d*.22,.05,1.2,1.8,0xa4a78c);
   for(let i=0;i<4;i++)box(g,side*(s.w/2-.21),1.8+i*.19,-s.d*.22,.03,.05,1.3,0x687c6b);
   const fixture=box(g,side*(s.w/2-.3),2.9,0,.25,.25,1.2,0xbab58d);fixture.material=new THREE.MeshStandardMaterial({color:s.kind==='hospital'?0xb7c5d2:0xe6d6ba,emissive:s.kind==='hospital'?0xb7c5d2:0xe6d6ba,emissiveIntensity:.75,roughness:.6});
  }
  for(let i=0;i<8;i++){const x=(i%2?1:-1)*(s.w/2-1),z=-s.d/2+1+i*s.d/9;box(g,x,.235,z,.3,.025,.45,i%3?0xbdb79c:0x76564b);}
  if(s.kind==='police')for(let x=-s.w/2+.7;x<-s.w*.2;x+=.45)box(g,x,1.5,-s.d*.3,.055,2.6,.08,0x455e54);
  if(s.kind==='hospital'){textSign(g,'ENFERMARIA  ←  |  FARMÁCIA  →',0,2.8,-s.d*.2,5,.45,'#4a6c60');box(g,0,2.5,-s.d/2+.25,1,.2,.15,0xb87954);}
  if(s.kind==='market'){textSign(g,'UNIÃO · CAIXAS  →',0,2.8,-s.d*.1,5,.5,'#7d7651');}
  if(s.kind==='church'){box(g,0,2.3,-s.d/2+.3,.18,1.7,.18,0x897659);box(g,0,2.65,-s.d/2+.3,1.2,.18,.18,0x897659);for(const x of [-1,-.6,.6,1])box(g,x,1.25,-s.d*.4,.1,.4,.1,0xd7bf8c);box(g,-s.w*.32,s.h+3,-s.d*.25,2.5,6,2.5,0xada789);box(g,-s.w*.32,s.h+7,-s.d*.25,.2,2,.2,0x665a45);box(g,-s.w*.32,s.h+7.4,-s.d*.25,1.3,.15,.2,0x665a45);textSign(g,'SETOR ZERO →  CANAL 07',0,1.8,-s.d/2+.3,4,.55,'#667662');}
  if(s.kind==='terminal'){textSign(g,'PARTIDAS CANCELADAS',0,2.7,-s.d/2+.3,7,.6,'#495c52');box(g,-s.w*.3,1.18,-s.d*.22,.8,.4,.4,0x44594b);box(g,-s.w*.3,1.6,-s.d*.22,.035,.7,.035,0xa69d7e);}
 }
 private landmark(g:THREE.Group,s:CitySite):void {
  if(s.kind==='hospital'){for(const [w,h]of [[1,4],[4,1]])box(g,-s.w/2+3,s.h+1,s.d/2+.5,w,h,.35,0xb87a61);for(let i=0;i<3;i++){box(g,6+i*2,1.3,-s.d/2+2,1.4,.2,3,0x8d9c88);box(g,6+i*2,1.7,-s.d/2+1,.8,.6,.4,0xd1cab0);}}
  else if(s.kind==='school'){box(g,0,.18,-s.d/2-8,20,.05,9,0x6f8a72);box(g,0,.22,-s.d/2-8,.1,.03,9,0xc7c6a5);for(const x of [-9,9]){box(g,x,2,-s.d/2-8,.14,4,.14,0x687e71);box(g,x,3.8,-s.d/2-8,1.4,1,.1,0xc2bea0);}}
  else if(s.kind==='industry'){box(g,-s.w/2+3,6,-s.d/2-2,2,12,2,0x837b65);for(const y of [3,6,9])box(g,-s.w/2+3,y,-s.d/2-2,2.2,.3,2.2,0x697b6d);}
  else if(s.kind==='quarantine'){for(const side of [-1,1]){box(g,side*(s.w/2-2),3,-s.d/2,1,6,1,0x6e8372);box(g,side*(s.w/2-2),6,-s.d/2,2,.5,1,0xcecda8);}for(const x of [-8,8]){box(g,x,2,-4,6,.3,5,0xa6aa88);for(const sign of [-1,1])box(g,x+sign*2.7,1,-4,.14,2,5,0x72866c);}for(const z of [-s.d/2,s.d/2])for(let x=-s.w/2;x<s.w/2;x+=2)box(g,x,4,z,.08,.5,.08,0x4c6456);}
  else if(s.kind==='fire'){box(g,0,2.1,-s.d/2+3,9,.2,1,0x9a7c5c);for(let i=0;i<4;i++){box(g,-3+i*2,1.5,-s.d/2+3,1,1,.6,0xc1a265);box(g,-3+i*2,2.3,-s.d/2+3,1.2,.3,.8,0xab7957);}}
  else if(s.kind==='motel')for(let i=0;i<6;i++)textSign(g,String(i+1).padStart(2,'0'),i%2?3.8:-3.8,2,-s.d*.3+Math.floor(i/2)*s.d*.3,.7,.4);
  else if(s.kind==='gas'){for(const x of [-5,5]){box(g,x,1.1,s.d/2+5,1,2,1,0xa48366);box(g,x,1.65,s.d/2+5.55,.65,.5,.08,0x465f54);}box(g,0,3.5,s.d/2+5,15,.3,5,0xb6ad88);}
 }
 update(sim:Simulation,night:number,dt=1/60):void {
  const active=new Set(activeCityChunks(sim.player.x,sim.player.z).map(s=>s.id));this.active=active.size;
  for(const c of this.chunks){c.root.visible=active.has(c.site.id);if(!c.root.visible)continue;c.roof.visible=true;c.paint.transparent=false;c.paint.opacity=1;c.paint.depthWrite=true;}
  for(const p of sim.portals){const v=this.portals.get(p.id)!;v.root.visible=active.has(p.site);v.panel.visible=p.kind==='door'?p.state!=='barred':p.state==='closed';if(p.kind==='door'){const angle=v.panel.rotation.y+((p.state==='open'?Math.PI/2:0)-v.panel.rotation.y)*(1-Math.exp(-dt*16));v.panel.rotation.y=angle;v.panel.position.x=-p.w/2+Math.cos(angle)*p.w/2;v.panel.position.z=-Math.sin(angle)*p.w/2;}v.boards.visible=p.state==='barred';}
  const near=CITY_SITES.filter(s=>active.has(s.id)&&s.kind!=='house').sort((a,b)=>Math.hypot(a.x-sim.player.x,a.z-sim.player.z)-Math.hypot(b.x-sim.player.x,b.z-sim.player.z));
  this.lights.forEach((l,i)=>{const s=near[i];l.intensity=s?(s.kind==='hospital'?(12+night*6)*(.96+Math.sin(sim.stats.seconds*1.7)*.04):12+night*6):0;if(s){l.position.set(s.x,3.3,s.z+2);l.color.setHex(s.kind==='hospital'?0xb7c5d2:0xe6d6ba);}});
 }
}
