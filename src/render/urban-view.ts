import {StaticChunk} from './static-chunk.ts';
import * as THREE from 'three';
import {ROADS} from '../game/districts';
import {URBAN} from '../game/world';
import type {UrbanBuilding,UrbanVehicle,StreetScene} from '../game/urban-layout';
import {box,batch,textSign} from './models';
import type {Simulation} from '../game/simulation';
import {facadeWeathering} from './facade-weathering';
interface Chunk {root:StaticChunk;detail:THREE.Group;x:number;z:number}
/** One static batch per layer per 32 m cell. Distant skyline survives detail culling. */
export class UrbanView {
 private chunks=new Map<string,Chunk>();active=0;
 private smoke:THREE.InstancedMesh;private dummy=new THREE.Object3D();
 private smokeScenes=URBAN.scenes.filter(s=>s.kind==='crash'||s.kind==='delivery');
 constructor(scene:THREE.Scene){
  const chunk=(x:number,z:number)=>{const key=`${Math.floor(x/32)}:${Math.floor(z/32)}`;let c=this.chunks.get(key);if(!c){const root=new StaticChunk(),detail=new THREE.Group();root.position.set(Math.floor(x/32)*32+16,0,Math.floor(z/32)*32+16);root.add(detail);scene.add(root);c={root,detail,x:root.position.x,z:root.position.z};this.chunks.set(key,c);}return c;};
  for(const b of URBAN.buildings){const c=chunk(b.x,b.z),g=new THREE.Group(),detail=new THREE.Group();g.position.set(b.x-c.x,0,b.z-c.z);detail.position.copy(g.position);c.root.add(g);c.detail.add(detail);this.building(g,detail,b);}
  for(const v of URBAN.vehicles){const c=chunk(v.x,v.z),g=new THREE.Group();g.position.set(v.x-c.x,0,v.z-c.z);g.rotation.y=v.angle;c.root.add(g);this.vehicle(g,v);}
  for(const s of URBAN.scenes){const c=chunk(s.x,s.z),g=new THREE.Group();g.position.set(s.x-c.x,0,s.z-c.z);c.detail.add(g);this.story(g,s);}
  for(const road of ROADS)for(let n=-Math.max(road.w,road.d)/2+8;n<Math.max(road.w,road.d)/2-8;n+=16)for(const side of [-1,1]){
   const horizontal=road.w>road.d,x=horizontal?road.x+n:road.x+side*(road.w/2+1),z=horizontal?road.z+side*(road.d/2+1):road.z+n;
   if(ROADS.some(r=>r!==road&&Math.abs(x-r.x)<r.w/2+.5&&Math.abs(z-r.z)<r.d/2+.5))continue;
   const c=chunk(x,z),px=x-c.x,pz=z-c.z;
   box(c.root,px,.035,pz,horizontal?15.9:1.85,.07,horizontal?1.85:15.9,0x899181,'paving');
   if(Math.abs(x)<9&&Math.abs(z)<12)continue;
   for(let i=0;i<3;i++)box(c.detail,px+(horizontal?i*.5:.65),.13,pz+(horizontal?.65:i*.5),.15,.18,.3,i%2?0x8e9076:0x53664c);
  }
  for(const c of this.chunks.values()){c.detail.removeFromParent();batch(c.root);batch(c.detail);c.root.add(c.detail);c.root.freeze();}
  this.smoke=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0x55594f,transparent:true,opacity:.2,depthWrite:false}),18);this.smoke.frustumCulled=false;scene.add(this.smoke);
 }
 private building(g:THREE.Group,p:THREE.Group,b:UrbanBuilding){
  const {w,d,h,front:f}=b;
  box(g,0,.08,0,w+2,.16,d+2,0x9a9c89,'paving');box(g,0,h/2,0,w,h,d,b.color,'plaster');
  box(g,0,h+.12,0,w+.35,.24,d+.35,b.style==='house'?0x97785d:0x657773,'roof');
  for(const x of [-w/2,w/2])box(g,x,h/2,0,.2,h,d+.12,0xc2b89e);
  // Residential and commercial ground floors have deliberately different frontage.
  const face=d/2*f;
  box(p,-w*.2,1.2,face+f*.04,1.35,2.4,.12,0x33463f);box(p,-w*.2+.4,.95,face+f*.14,.12,.12,.08,0xc0ac78);
  if(b.style==='shop'||b.style==='workshop'){
   box(p,w*.19,1.25,face+f*.08,w*.42,2.2,.14,0x536765);
   for(let y=.3;y<2.4;y+=.22)box(p,w*.19,y,face+f*.18,w*.42,.05,.06,0x87938a);
   box(p,0,2.7,face+f*.7,w+.2,.18,1.6,b.damage%2?0x967252:0x657e70);
   if(Number(b.id.split('-')[1])%3===0){const sign=textSign(p,b.name,0,3.1,face+f*.22,w-.5,.65,'#374f49');if(f<0)sign.rotation.y=Math.PI;}
  }
  for(let floor=0;floor<b.floors;floor++)for(let x=-w/2+1.5;x<w/2-1;x+=2.5){
   if(floor===0&&x<0)continue;const y=1.65+floor*2.9;
   box(p,x,y,face+f*.08,1.5,1.4,.13,0x334c49,'glass');box(p,x,y-.75,face+f*.23,1.8,.13,.45,0xc5baa1);
   const broken=(floor+Math.round(x)+b.damage)%4===0;
   box(p,x-.3,y,face+f*.17,.1,1.4,.06,0x91aaa1);if(!broken)box(p,x+.4,y,face+f*.17,.65,1.25,.05,0x74958f,'glass');
   if(broken){const plank=box(p,x,y-.2,face+f*.28,1.75,.2,.14,0xa18a65);plank.rotation.z=.18;}
  }
  for(const side of [-1,1])for(let floor=0;floor<b.floors;floor++)for(let z=-d/2+1.5;z<d/2-1;z+=2.6){
   const y=1.65+floor*2.9;box(p,side*(w/2+.05),y,z,.12,1.3,1.35,0x334c49,'glass');box(p,side*(w/2+.15),y-.7,z,.3,.14,1.6,0xb9ad92);box(p,side*(w/2+.13),y,z,.08,1.3,.08,0x9aab99);
   if((floor+b.damage)%3===0)box(p,side*(w/2+.22),y-.1,z,.2,.2,1.5,0x9b8464);
  }
  if(b.style==='apartment')for(let y=2.9;y<h;y+=2.9){box(p,0,y,face+f*.5,w,.16,1.1,0x7c897e);for(let x=-w/2+.3;x<w/2;x+=.65)box(p,x,y+.45,face+f*.95,.065,.9,.065,0x3c514b);}
  box(p,w/2-.1,h/2,face+f*.23,.14,h,.14,0x64756c);
  box(p,w/2-.6,1.3,face+f*.2,.5,.7,.2,0x56675f);
  const tank=b.damage%2===0;box(g,-w*.2,h+(tank?.8:.4),-d*.2,tank?1.7:2,tank?1.5:.6,1.6,tank?0x526f77:0x919782);
  box(p,w*.2,h+1.3,d*.1,.07,2.6,.07,0x54645d);box(p,w*.2,h+2.4,d*.1,1.8,.065,.07,0x54645d);
  if(b.damage===1||b.damage===4){box(p,w*.22,1,face+f*.2,2.3,1.8,.03,0x465047);for(let i=0;i<5;i++)box(p,w*.2+i*.23,.2,face+f*(.5+i*.19),.4,.25,.5,0x7e7c6a);}
  // Small litter, vines and yard furniture; no invisible rigid bodies for ground dressing.
  for(let i=0;i<5;i++){box(p,-w/2+.4+i*.43,.2,face+f*(.55+i%2*.4),.3,.25,.32,i%2?0x445a46:0x9f9980);if(i%2===0)box(p,-w/2+.12,.4+i*.28,face+f*.15,.26,.32,.12,0x5d744e);}
  box(p,w*.27,.68,face+f*.15,.8,.6,.15,0x78684e);
  facadeWeathering(p,w,d,h,f,Number(b.id.split('-')[1]));
  if(b.style==='house'&&b.damage%2===0){box(p,-w*.3,h+.6,-d*.27,.7,1.2,.65,0x8e7961,'plaster');box(p,-w*.3,h+1.24,-d*.27,.88,.12,.82,0x4e5149,'metal');}
  if(b.damage===3){box(p,w*.32,h+.18,-d*.3,.9,.08,1.1,0x5a6454,'roof');box(p,w*.28,h+.28,-d*.25,.4,.2,.5,0x727464,'roof');}
 }
 private vehicle(g:THREE.Group,v:UrbanVehicle){
  const large=['bus','truck','van','ambulance'].includes(v.kind),length=v.kind==='bus'?9:v.kind==='truck'?7.2:large?5.2:4,width=large&&v.kind!=='van'&&v.kind!=='ambulance'?2.5:1.9;
  const color=v.kind==='ambulance'?0xc8c6ab:v.kind==='police'?0x455b61:v.color;
  box(g,0,.6,0,width,.8,length,color,'metal');box(g,0,.3,0,width+.05,.15,length+.1,0x303e39);
  if(v.kind==='truck'){box(g,0,1.85,-1.3,width,2.1,length*.58,0x7e826a,'metal');box(g,0,1.5,length*.32,width,1,1.9,color);}
  else {const cabin=v.kind==='pickup'?length*.44:large?length*.85:length*.6;box(g,0,large?1.75:1.25,0,width*.92,large?1.5:.65,cabin,color,'metal');box(g,0,large?2:1.35,cabin/2+.03,width*.8,large?.75:.5,.08,0x304b4b,'glass');for(const side of [-1,1])for(let z=-cabin*.35;z<cabin*.5;z+=1.1)box(g,side*width*.465,large?2:1.35,z,.05,large?.75:.45,.8,0x3d5756,'glass');}
  for(const side of [-1,1])for(const z of [-length*.31,length*.31]){box(g,side*width*.48,.4,z,.3,.75,.8,0x293632);box(g,side*(width*.48+.16),.4,z,.03,.35,.38,0x7e8173);}
  for(const side of [-1,1]){box(g,side*width*.34,.85,length/2+.03,.4,.22,.08,0xc9c195);box(g,side*width*.34,.8,-length/2-.03,.3,.2,.08,0x975642);}
  if(v.kind==='ambulance'){box(g,0,1.1,length/2+.07,.8,.16,.04,0xa46151);box(g,0,1.1,length/2+.08,.16,.8,.04,0xa46151);}
  if(v.kind==='ambulance'||v.kind==='police'){box(g,0,v.h+.03,0,1,.16,.35,0x637f89);box(g,-.25,v.h+.07,0,.4,.15,.35,0xb47558);}
  box(g,0,.62,length/2+.09,.5,.17,.03,0xc4bba0);for(let x=-.5;x<=.5;x+=.16)box(g,x,.75,length/2+.08,.08,.12,.04,0x3d4942);for(const side of [-1,1]){box(g,side*(width/2+.06),1.17,.4,.13,.14,.22,color);box(g,side*(width/2+.025),.88,-.1,.035,.04,.22,0xa8a991);box(g,side*(width/2+.025),.64,-.5,.025,.35,.05,0x6a6d5b);}
  if(v.open){const door=box(g,width*.46,1,1,.08,1,1, color);door.rotation.y=.55;box(g,width*.34,.12,-length/2-.4,.55,.2,.8,0x826750);}
  if(v.wreck){box(g,0,.95,length*.3,width*.8,.14,1,0x3e423a);for(let i=0;i<5;i++)box(g,i*.2-.4,.12,length/2+.5,.12,.04,.3,0x82988e);}
 }
 private story(g:THREE.Group,s:StreetScene){
  for(let i=0;i<5;i++){
   const x=3.4+(i%2)*.5,z=-4+i*1.6;
   box(g,x,.12,z,.55,.24,.8,i%2?0x87745c:0x5c6b62);box(g,x,.26,z,.35,.04,.05,0xb1a28a);
   box(g,2.8,.018,z,.15,.025,.55,0x784d40);
   if(i<3){box(g,-3,.22,z,.3,.44,.3,0xab7851);box(g,-3,.3,z,.32,.08,.32,0xbcb89b);}
  }
  box(g,3.7,.2,1, .55,.35,1.1,0x617061);box(g,3.7,.17,1.7,.4,.3,.38,0xa48d73);
  if(s.kind==='triage'){for(const z of [-3,2]){box(g,3.8,.75,z,1,.18,2.2,0xb9bba4);for(const x of [3.35,4.25])box(g,x,.4,z,.06,.65,1.8,0x60756b);}textSign(g,'TRIAGEM →',4,2.8,-5,3,.65,'#496f62');}
  if(s.kind==='checkpoint'){for(let i=0;i<6;i++)box(g,3.7,.3+i%2*.25,-4+i*.65,.8,.4,.5,0x929378);textSign(g,'EVACUAÇÃO · SETOR ZERO',0,3.8,4,6,.7,'#4d5948');}
  if(s.kind==='crash'){box(g,3,2.3,0,.13,4.6,.13,0x546b63);box(g,3,4.5,0,1,.15,.5,0xc1b48d);}
  if(s.kind==='delivery'){for(let i=0;i<4;i++)box(g,3,.15,i*1.1,1,.25,.8,0x8d805e);}
 }
 update(sim:Simulation,time:number){
  this.active=0;for(const c of this.chunks.values()){const d=(c.x-sim.player.x)**2+(c.z-sim.player.z)**2;c.root.visible=d<145*145;c.detail.visible=d<64*64;if(c.root.visible)this.active++;}
  let count=0;for(const s of this.smokeScenes){if((s.x-sim.player.x)**2+(s.z-sim.player.z)**2>145*145)continue;for(let i=0;i<9;i++){const t=(time*.13+i/9)%1;this.dummy.position.set(s.x+t*2,1+t*12,s.z+t);this.dummy.scale.setScalar(.35+t*1.6);this.dummy.rotation.set(t,0,t);this.dummy.updateMatrix();this.smoke.setMatrixAt(count++,this.dummy.matrix);}}this.smoke.count=count;this.smoke.instanceMatrix.needsUpdate=true;
 }
}
