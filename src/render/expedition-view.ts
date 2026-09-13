import * as THREE from 'three';
import type { Simulation } from '../game/simulation';
import { FACILITIES } from '../game/expedition';
import { ACID } from '../game/enemies';
import { RARITIES } from '../game/weapons';
import type { WeaponId } from '../game/weapons';
import { createWeaponVisual } from './weapon-assets';
import { voxelMesh, voxelMaterial } from './voxel';
import { batch } from './models';

// The courtyard path/sign reaches y=.25; hazards must clear raised walking surfaces.
const HAZARD_FLOOR = .28;

/** Bounded presentation pools. Item geometry is shared by family, even after repeated swaps. */
export class ExpeditionView {
  private guns:{root:THREE.Mesh;uid:number}[]=[];private gunGeometry=new Map<WeaponId,THREE.BufferGeometry>();
  private bands:THREE.InstancedMesh;private acid:THREE.InstancedMesh;private splash:THREE.InstancedMesh;private warning:THREE.InstancedMesh;
  private facilities:{root:THREE.Group;lid:THREE.Mesh}[]=[];private eventRoot:THREE.Group;private eventBody:THREE.Mesh;
  private generatorLight=new THREE.PointLight(0xd6dba1,0,12,2);private dummy=new THREE.Object3D();
  constructor(private scene:THREE.Scene){
    this.bands=new THREE.InstancedMesh(new THREE.BoxGeometry(.55,.025,.06),new THREE.MeshBasicMaterial({color:0xffffff}),48);this.bands.count=0;this.bands.frustumCulled=false;scene.add(this.bands);
    this.acid=new THREE.InstancedMesh(new THREE.CylinderGeometry(ACID.radius,ACID.radius,.025,14),new THREE.MeshStandardMaterial({color:0x869249,emissive:0x45511d,emissiveIntensity:.3,transparent:true,opacity:.72,depthWrite:false}),ACID.capacity);
    this.splash=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.17,0),new THREE.MeshStandardMaterial({color:0xc3cd87,emissive:0x657c2f,emissiveIntensity:.35}),ACID.capacity);
    this.warning=new THREE.InstancedMesh(new THREE.RingGeometry(ACID.radius-.06,ACID.radius,24,1,0,Math.PI*1.9),new THREE.MeshBasicMaterial({color:0xe4c980,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}),ACID.capacity);
    for(const mesh of [this.acid,this.splash,this.warning]){mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);}
    for(const f of FACILITIES){const model=this.facility(f.kind);model.root.position.set(f.x,0,f.z);scene.add(model.root);this.facilities.push(model);}
    this.generatorLight.position.set(25,3.2,-24);scene.add(this.generatorLight);
    this.eventRoot=this.facility('cache').root;scene.add(this.eventRoot);this.eventRoot.visible=false;
    this.eventBody=voxelMesh({id:'city:fallen-survivor:v1',unit:.1,build(g){g.fill(-3,1,-4,6,3,8,0x596c62).fill(-2,1,4,4,3,4,0xb5a386).fill(-3,1,-11,2,2,7,0x394f48).fill(1,1,-11,2,2,7,0x394f48).fill(-6,1,-3,3,2,7,0x6c7d67).fill(3,1,-5,3,2,7,0x6c7d67);}});scene.add(this.eventBody);this.eventBody.visible=false;
  }
  private facility(kind:string):{root:THREE.Group;lid:THREE.Mesh}{
    const root=new THREE.Group();root.name=`expedition-${kind}`;
    const body=voxelMesh({id:`expedition:${kind}:v1`,unit:.08,build(g){
      if(kind==='generator'){
        g.fill(-8,2,-5,16,8,10,0x485f50).fill(-7,1,-6,14,2,12,0x293f3a).fill(-6,10,-4,12,2,8,0x8b895b);
        for(let x=-6;x<3;x+=2)g.fill(x,4,5,1,5,1,0x203b38);
        g.fill(3,5,5,4,3,1,0xa9a578).set(4,6,6,0xd1b771).fill(5,8,-3,2,9,2,0x68796a).fill(-5,10,-2,3,1,4,0x58664d);
      }else if(kind==='trunk'){
        g.fill(-11,2,-7,22,7,14,0x6f7965).fill(-9,9,-5,18,2,10,0x82917a).fill(-10,4,-8,20,2,1,0x334b43);
        g.fill(-11,1,-6,3,4,4,0x283c35).fill(8,1,-6,3,4,4,0x283c35).fill(-10,6,7,4,2,1,0xb68665).fill(6,6,7,4,2,1,0xb68665);
        g.fill(-4,7,7,8,1,1,0xc0b68e).fill(-1,8,7,2,1,1,0x293f39);
      }else{
        g.fill(-6,1,-4,12,9,8,0x526859).fill(-7,1,-4,1,9,8,0x899177).fill(6,1,-4,1,9,8,0x899177);
        g.fill(-6,1,4,12,2,1,0x3a5349).fill(-4,5,4,8,2,1,0x9ca581).fill(-1,4,5,2,4,1,0x3b5146);
        g.fill(-4,6,5,3,1,1,0xd2c99b).set(4,8,5,0xab9471);
      }
    }});root.add(body);
    const lid=voxelMesh({id:`expedition:${kind}:lid`,unit:.08,build(g){g.fill(kind==='trunk'?-10:-6,0,0,kind==='trunk'?20:12,2,kind==='trunk'?12:8,kind==='trunk'?0x74826b:0x899071);g.fill(-1,0,7,2,2,1,0xc0b28a);}});
    lid.position.set(0,kind==='trunk'?.78:.83,kind==='trunk'?-.48:-.32);root.add(lid);if(kind==='generator')lid.visible=false;return {root,lid};
  }
  private geometry(type:WeaponId):THREE.BufferGeometry{
    let geo=this.gunGeometry.get(type);if(geo)return geo;
    const visual=createWeaponVisual(type);if(type==='shotgun')visual.magazine.visible=false;
    if(type==='shotgun')visual.magazine.removeFromParent();batch(visual.root);geo=(visual.root.children[0] as THREE.Mesh).geometry;this.gunGeometry.set(type,geo);return geo;
  }
  update(sim:Simulation,time:number):void{
    let band=0;const visible=sim.groundWeapons.filter(g=>Math.hypot(g.x-sim.player.x,g.z-sim.player.z)<40);
    for(let i=0;i<Math.max(this.guns.length,visible.length);i++){
      const g=visible[i];let slot=this.guns[i];if(!slot&&g){const root=new THREE.Mesh(this.geometry(g.item.type),voxelMaterial);root.castShadow=true;root.receiveShadow=true;this.scene.add(root);slot={root,uid:-1};this.guns.push(slot);}if(!slot)continue;
      slot.root.visible=!!g;if(!g)continue;if(slot.uid!==g.item.uid){slot.uid=g.item.uid;slot.root.geometry=this.geometry(g.item.type);}
      slot.root.position.set(g.x,.18,g.z);slot.root.rotation.set(0,.65,Math.PI/2);slot.root.scale.setScalar(1);
      this.dummy.position.set(g.x,.09,g.z+.55);this.dummy.rotation.set(0,.65,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.bands.setMatrixAt(band,this.dummy.matrix);this.bands.setColorAt(band++,new THREE.Color(RARITIES[g.item.rarity].color));
    }
    this.bands.count=band;this.bands.instanceMatrix.needsUpdate=true;if(this.bands.instanceColor)this.bands.instanceColor.needsUpdate=true;
    let acidCount=0,flightCount=0,warningCount=0;
    for(const a of sim.acids){const t=Math.min(1,a.age/ACID.flight),fade=Math.min(1,(ACID.flight+ACID.lifetime-a.age)*2);
      this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1);
      if(t<1){this.dummy.position.set(a.from.x+(a.x-a.from.x)*t,1.8*(1-t)+HAZARD_FLOOR*t+Math.sin(t*Math.PI)*1.8,a.from.z+(a.z-a.from.z)*t);this.dummy.updateMatrix();this.splash.setMatrixAt(flightCount++,this.dummy.matrix);}
      else{this.dummy.position.set(a.x,HAZARD_FLOOR,a.z);this.dummy.scale.set(fade,1,fade);this.dummy.updateMatrix();this.acid.setMatrixAt(acidCount++,this.dummy.matrix);}
      this.dummy.position.set(a.x,HAZARD_FLOOR+.025,a.z);this.dummy.rotation.set(-Math.PI/2,0,time*.1);this.dummy.scale.setScalar(t<1?.7+.3*t:fade);this.dummy.updateMatrix();this.warning.setMatrixAt(warningCount++,this.dummy.matrix);
    }
    this.acid.count=acidCount;this.splash.count=flightCount;this.warning.count=warningCount;for(const mesh of [this.acid,this.splash,this.warning])mesh.instanceMatrix.needsUpdate=true;
    sim.facilities.forEach((f,i)=>{const v=this.facilities[i];v.root.visible=Math.hypot(f.x-sim.player.x,f.z-sim.player.z)<65;v.lid.rotation.x=f.state==='opened'?-1.35:0;});
    this.generatorLight.intensity=sim.facilities[0].state==='powered'?12:0;
    const event=sim.worldEvent;this.eventRoot.visible=event?.kind==='cache'&&!event.triggered;if(event)this.eventRoot.position.set(event.x,0,event.z);this.eventBody.visible=this.eventRoot.visible&&event?.flavor==='survivor';if(event)this.eventBody.position.set(event.x-1.4,0,event.z);
  }
}
