import * as THREE from 'three';
import { box, batch, textSign } from './models';
import { voxelMesh } from './voxel';
import { propRecipe, treeRecipe, voxelBox } from './environment-assets';
import { WAREHOUSES, REGIONS, OUTER_HOUSES } from '../game/districts';
export function createDistricts(scene:THREE.Scene,lamps:THREE.Material):THREE.Group[] {
  const chunks:THREE.Group[]=[];
  for(const region of REGIONS.slice(2)) {
    const g=new THREE.Group();g.position.set(region.x,0,region.z);g.name=region.name;scene.add(g);chunks.push(g);
    const prop=(kind:Parameters<typeof propRecipe>[0],x:number,z:number,angle=0)=>{const m=voxelMesh(propRecipe(kind));m.position.set(x,.15,z);m.rotation.y=angle;g.add(m);};
    for(let i=0;i<6;i++){prop(i%3===0?'rubble':i%3===1?'bag':'pallet',-7+i*2,8+Math.sin(i*2)*2,i*.8);}
    if(region.icon==='I'||region.icon==='S') {
      for(let i=0;i<3;i++){
        const container=voxelMesh({id:`shipping-container:${i}:v1`,unit:.15,build(v){
          voxelBox(v,0,1.2,0,2.7,2.4,6,[0x778d88,0x9c7154,0x838768][i]);
          for(let z=-2.8;z<3;z+=.45)for(const x of [-1.4,1.4])voxelBox(v,x,1.2,z,.12,2.4,.15,0x556c65);
          for(const x of [-.7,.7])voxelBox(v,x,1.2,3.04,.08,2.1,.1,0xb0ab8e);
        }});container.position.set(-7+i*4,.1,region.icon==='I'?-8:-4);g.add(container);
        prop('pallet',-7+i*3,9);prop('crate',-7+i*3,10.5);
      }
    }
    if(region.icon==='E'||region.name==='TRIAGEM EXTERNA') {
      box(g,0,.02,0,25,.1,24,0x9b9f89);
      for(const [x,z] of [[-9,-8],[9,-8],[-9,9],[9,9]]){const tree=voxelMesh(treeRecipe(1));tree.position.set(x,.15,z);g.add(tree);prop('bench',x*.7,z*.7);}
      if(region.icon==='E'){
        box(g,0,.3,0,5,.6,5,0x797f73);box(g,0,.65,0,4,.15,4,0x536e6b);box(g,0,1.6,0,.8,2,.8,0xa8aa92);box(g,0,2.8,0,1.5,.4,1.5,0x929b86);
      }
      for(let i=0;i<3;i++){
        const tent=voxelMesh({id:`evacuation-tent:${i%2}`,unit:.15,build(v){
          for(let x=-12;x<=12;x++){const h=1.8-Math.abs(x)*.12;voxelBox(v,x*.15,h,0,.15,.15,3.6,i%2?0x8a9479:0xb9b9a0);}
          voxelBox(v,0,.05,0,3.6,.1,3.6,0x596b60);
        }});tent.position.set(-7+i*6,.15,5);g.add(tent);
      }
      textSign(g,'EVACUAÇÃO →',0,1.3,-8,3,.6,'#536b61');
    }
    if(region.icon==='P') {for(let i=0;i<5;i++){prop('cone',5+i*1.5,-7);box(g,7+i*1.5,.65,-9,1.2,1.3,.7,0x8c9989);}textSign(g,'CONTROLE / PARE',10,2,-8,4,.7,'#455f68');}
    if(region.name==='HOSPITAL SANTA LUZ'){
      for(let i=0;i<5;i++){box(g,8+i*2,.03,-3,.1,.03,5,0xb7b69e);prop('cone',8+i*2,1);}
      // Wrecked ambulance: voxel cabin remains the existing car; box body and red cross identify it.
      const ambulance=voxelMesh({id:'ambulance:body:v1',unit:.1,build(v){
        voxelBox(v,0,1.5,0,1.9,1.6,2.5,0xc8c7af);voxelBox(v,0,1.25,1.3,1.7,.3,.1,0xa36b55);
        for(const x of [-1,1]){voxelBox(v,x,1.7,0,.1,.65,.2,0xa46550);voxelBox(v,x,1.7,0,.1,.2,.65,0xa46550);}
        voxelBox(v,0,2.4,.8,.9,.2,.3,0x9c604e);voxelBox(v,0,1.9,-1.3,1.5,.5,.1,0x557474);
      }});ambulance.position.set(10,0,6);ambulance.rotation.y=1.3;g.add(ambulance);prop('rubble',12,6);prop('pallet',14,7);
    }
    if(region.icon==='C'){
      for(const [label,z,color] of [['FARMÁCIA',-20.8,'#647c6b'],['ARMAZÉM',1.2,'#85664f'],['OFICINA',25.2,'#4c6567']] as const){textSign(g,label,-2,3,z,6,.7,color);box(g,-2,2.5,z,8,.15,1.5,0xb4a27b);prop('bin',4,z);}
      const cart=voxelMesh({id:'cart:fallen:v1',unit:.1,build(v){for(let y=2;y<10;y+=2)voxelBox(v,0,y*.1,0,1,.07,.6,0x7f9691);for(const x of [-.5,.5])voxelBox(v,x,.6,0,.08,1,.6,0x9da796);}});cart.position.set(5,.2,4);cart.rotation.z=Math.PI/2;g.add(cart);
    }
    // Authored pools of street litter, old stains and abandoned furniture.
    for(let i=0;i<12;i++){const x=Math.sin(i*7+region.x)*11,z=Math.cos(i*11+region.z)*10;const debris=box(g,x,.12,z,.2+(i%3)*.2,.025,.25,i%4===0?0x614b3e:0x9d9e87);debris.rotation.y=i;}
    box(g,-10,2.5,0,.16,5,.16,0x536c65);box(g,-9.4,5,0,1.4,.14,.2,0x68796b);box(g,-8.8,4.9,0,.4,.12,.3,0xd4b583).material=lamps;
    batchDistrict(g);
  }
  for(const w of WAREHOUSES){
    const g=new THREE.Group();g.position.set(w.x,0,w.z);scene.add(g);chunks.push(g);
    const m=voxelMesh({id:`warehouse:${w.w}:${w.d}:${w.h}`,unit:.2,build(v){
      voxelBox(v,0,w.h/2,0,w.w,w.h,w.d,0x718984);voxelBox(v,0,.3,0,w.w+.6,.6,w.d+.6,0x7c8172);
      for(let x=-w.w/2;x<w.w/2;x+=.6){voxelBox(v,x,w.h/2,w.d/2+.1,.15,w.h,.15,0x8c9b8a);voxelBox(v,x,w.h+.1,0,.14,.2,w.d+.5,0xa2a890);}
      for(const x of [-w.w*.28,w.w*.28]){voxelBox(v,x,1.8,w.d/2+.2,4,3.6,.15,0x415e5b);for(let y=.4;y<3.5;y+=.4)voxelBox(v,x,y,w.d/2+.3,4,.1,.1,0x72847a);}
      voxelBox(v,0,w.h+.7,-w.d/4,2,1.4,2,0x596e68);
      for(let i=0;i<20;i++){const x=-w.w/2+1+i*(w.w-2)/20;voxelBox(v,x,.5+(i%4)*.5,w.d/2+.21,.2,.5+(i%3)*.2,.12,i%2?0x96795b:0x92997e);}
    }});g.add(m);
    box(g,0,.04,w.d/2+3,w.w+2,.1,6,0x777e6e);
    for(let i=0;i<8;i++){const prop=voxelMesh(propRecipe(i%3===0?'pallet':i%3===1?'bag':'rubble'));prop.position.set(-w.w/2+1+i*2.4,.15,w.d/2+2+(i%2)*1.2);g.add(prop);}
    textSign(g,'SANTA LUZ / CARGAS',0,w.h-.8,w.d/2+.4,8,.8,'#536b63');batchDistrict(g);
  }
  for(const [x,z] of OUTER_HOUSES){
    const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);chunks.push(g);
    box(g,0,.02,1,13,.12,12,0x999e87);box(g,0,.1,1,11.7,.06,10.7,0x75876b);box(g,0,.14,5.5,2,.05,3,0xa5a38a);
    for(let i=0;i<8;i++) {box(g,-6+i*1.6,.6,-6,.12,1.2,.12,0x8a8e72);box(g,-6+i*1.6,.75,-6,1.5,.12,.12,0x9a9b7d);}
    for(const kind of ['pallet','bin'] as const){const m=voxelMesh(propRecipe(kind));m.position.set(kind==='bin'?6:-6,.15,3);g.add(m);}
    const tree=voxelMesh(treeRecipe(0));tree.position.set(7,0,-5);g.add(tree);batchDistrict(g);
  }
  const edge=new THREE.Group();scene.add(edge);
  for(let i=0;i<40;i++){const tree=voxelMesh(treeRecipe(i%3));const side=i%4,offset=-78+Math.floor(i/4)*17;tree.position.set(side<2?(side===0?-83:83):offset,0,side>=2?(side===2?-83:83):offset);tree.castShadow=false;edge.add(tree);}
  return chunks;
}

function batchDistrict(g:THREE.Group):void {
  // Repeated detailed trees retain shared geometry, instead of being copied into every chunk.
  const trees=g.children.filter(o=>String(o.userData.voxelAsset??'').includes('tree'));
  trees.forEach(o=>o.removeFromParent());batch(g);trees.forEach(o=>g.add(o));
}
