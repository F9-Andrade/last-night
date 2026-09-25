import * as THREE from 'three';
import {OBSTACLES,floorHeight} from '../game/world';
import type {GameEvent} from '../game/simulation';
import {visualPreset} from './visual-config';

interface Mark {position:THREE.Vector3;normal:THREE.Vector3;size:number;angle:number;life:number;color:THREE.Color;blood:boolean}
interface GroundFace {ax:number;az:number;bx:number;bz:number;cx:number;cz:number;y:number}
/** Cosmetic event-derived marks. Fixed pool; never synchronized as network objects. */
export class ImpactDecals {
 private marks:Mark[]=[];private index=0;private dummy=new THREE.Object3D();private up=new THREE.Vector3(0,0,1);
 private blood:THREE.InstancedMesh;private impact:THREE.InstancedMesh;private limit=96;
 private ground=new Map<string,GroundFace[]>();
 constructor(scene:THREE.Scene){
  this.cacheGround(scene);
  const texture=(blood:boolean)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d')!;let seed=blood?1709:451;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   c.fillStyle='#fff';if(blood){for(let i=0;i<24;i++){const x=32+(rand()-.5)*38,y=32+(rand()-.5)*38,r=3+rand()*10;c.fillRect(x,y,r,Math.max(2,r*.6));}for(let i=0;i<12;i++)c.fillRect(rand()*62,rand()*62,1+rand()*3,1+rand()*3);}
   else{c.translate(32,32);c.beginPath();for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=7+rand()*7;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.lineWidth=1.2;for(let i=0;i<5;i++){const a=rand()*Math.PI*2;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*23,Math.sin(a)*23);c.strokeStyle='#999';c.stroke();}}
   const t=new THREE.CanvasTexture(canvas);t.magFilter=THREE.NearestFilter;t.colorSpace=THREE.SRGBColorSpace;return t;};
  const geometry=new THREE.PlaneGeometry(1,1);
  const mesh=(isBlood:boolean)=>{const material=new THREE.MeshStandardMaterial({map:texture(isBlood),color:0xffffff,roughness:isBlood?.82:1,transparent:true,alphaTest:.25,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});const m=new THREE.InstancedMesh(geometry,material,96);m.count=0;m.frustumCulled=false;m.receiveShadow=true;m.userData.skipAO=true;scene.add(m);return m;};this.blood=mesh(true);this.impact=mesh(false);
 }
 /** Cache actual flat walking surfaces, not the approximate simulation step height.
  * Only immutable static batches and flat mapped signs qualify: actors, instanced
  * drops/vegetation, moving doors, sky and the decal pools are excluded. */
 private cacheGround(scene:THREE.Scene):void {
  scene.updateMatrixWorld(true);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  scene.traverse(object=>{
   if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh)return;
   const geometry=object.geometry,paint=object.material;
   if(!geometry.getAttribute('surfaceType')&&(Array.isArray(paint)||!(paint as THREE.MeshStandardMaterial).map))return;
   const positions=geometry.getAttribute('position'),indices=geometry.index,count=indices?.count??positions.count;
   for(let i=0;i<count;i+=3){
    a.fromBufferAttribute(positions,indices?indices.getX(i):i).applyMatrix4(object.matrixWorld);
    b.fromBufferAttribute(positions,indices?indices.getX(i+1):i+1).applyMatrix4(object.matrixWorld);
    c.fromBufferAttribute(positions,indices?indices.getX(i+2):i+2).applyMatrix4(object.matrixWorld);
    // Santa Luz has no walkable upper storeys. Keep curb-height upward faces only.
    if(a.y<-.15||a.y>.35||Math.abs(a.y-b.y)>.002||Math.abs(a.y-c.y)>.002)continue;
    const upward=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);if(upward<.00001)continue;
    const face:GroundFace={ax:a.x,az:a.z,bx:b.x,bz:b.z,cx:c.x,cz:c.z,y:a.y};
    for(let x=Math.floor(Math.min(a.x,b.x,c.x)/16);x<=Math.floor(Math.max(a.x,b.x,c.x)/16);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/16);z<=Math.floor(Math.max(a.z,b.z,c.z)/16);z++){
     const key=`${x}:${z}`,faces=this.ground.get(key);if(faces)faces.push(face);else this.ground.set(key,[face]);
    }
   }
  });
 }
 private groundY(x:number,z:number):number {
  const fallback=floorHeight({x,z});let top=-Infinity;
  for(const f of this.ground.get(`${Math.floor(x/16)}:${Math.floor(z/16)}`)??[]){
   if(f.y<=top||f.y<fallback-.3||f.y>fallback+.3)continue;
   const ab=(x-f.bx)*(f.az-f.bz)-(f.ax-f.bx)*(z-f.bz),bc=(x-f.cx)*(f.bz-f.cz)-(f.bx-f.cx)*(z-f.cz),ca=(x-f.ax)*(f.cz-f.az)-(f.cx-f.ax)*(z-f.az);
   if(!((ab<-.00001||bc<-.00001||ca<-.00001)&&(ab>.00001||bc>.00001||ca>.00001)))top=f.y;
  }
  return (Number.isFinite(top)?top:fallback)+.004;
 }
 reset():void {this.marks.length=0;this.index=0;this.blood.count=this.impact.count=0;}
 private add(position:THREE.Vector3,normal:THREE.Vector3,size:number,blood:boolean,color:number):void {
  const mark:Mark={position,normal,size,angle:this.index*2.399,life:blood?85:55,color:new THREE.Color(color),blood};
  if(this.marks.length<this.limit)this.marks.push(mark);else this.marks[this.index%this.limit]=mark;this.index++;
 }
 private floor(x:number,z:number,size:number):void {this.add(new THREE.Vector3(x,this.groundY(x,z),z),new THREE.Vector3(0,1,0),size,true,0x5a201c);}
 event(e:GameEvent):void {
  if(e.type==='death'){this.floor(e.position.x,e.position.z,.55);return;}
  if(e.type!=='shot'||e.primary===false||e.material==='air')return;
  if(e.hit){this.floor(e.to.x,e.to.z,.20);return;}
  const y=e.y??1.2,p=new THREE.Vector3(e.to.x,y,e.to.z),floor=floorHeight(e.to);
  if(y<floor+.18){this.add(new THREE.Vector3(p.x,this.groundY(p.x,p.z),p.z),new THREE.Vector3(0,1,0),.17,false,0x393733);return;}
  // Normal of the existing hit obstacle. This is presentation-only; authoritative ray is untouched.
  let best=.28,normal:THREE.Vector3|undefined;
  for(const o of OBSTACLES){if(y>(o.h??3)+.1||y<(o.bottom??0)-.1||Math.abs(p.x-o.x)>o.w/2+.2||Math.abs(p.z-o.z)>o.d/2+.2)continue;
   const dx=Math.abs(Math.abs(p.x-o.x)-o.w/2),dz=Math.abs(Math.abs(p.z-o.z)-o.d/2);
   if(Math.min(dx,dz)<best){best=Math.min(dx,dz);normal=dx<dz?new THREE.Vector3(Math.sign(p.x-o.x),0,0):new THREE.Vector3(0,0,Math.sign(p.z-o.z));}
  }
  if(normal)this.add(p.addScaledVector(normal,.012),normal,e.material==='glass'?.22:.13,false,e.material==='metal'?0x282a2a:e.material==='wood'?0x524333:0x55534e);
 }
 update(dt:number,x:number,z:number,quality:string):void {
  this.limit=Math.round(96*visualPreset(quality).detail);if(this.marks.length>this.limit)this.marks.length=this.limit;
  let b=0,i=0;for(const m of this.marks){m.life-=dt;if(m.life<=0||Math.hypot(m.position.x-x,m.position.z-z)>55)continue;const mesh=m.blood?this.blood:this.impact,index=m.blood?b++:i++;
   this.dummy.position.copy(m.position);this.dummy.quaternion.setFromUnitVectors(this.up,m.normal);this.dummy.rotateZ(m.angle);this.dummy.scale.setScalar(m.size*Math.min(1,m.life/5));this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);mesh.setColorAt(index,m.color);
  }
  this.blood.count=b;this.impact.count=i;for(const mesh of [this.blood,this.impact]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 }
 metrics(){return {limit:this.limit,active:this.blood.count+this.impact.count};}
}
