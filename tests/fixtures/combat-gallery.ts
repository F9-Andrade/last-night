import * as THREE from 'three';
import {Character, textSign} from '../../src/render/models';
import {CorpseView} from '../../src/render/corpses';
import type {Walker} from '../../src/game/simulation';
import {BALANCE} from '../../src/game/config';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x273b35);
const camera=new THREE.OrthographicCamera(-12,12,8,-8,.1,100);camera.position.set(8,16,22);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true});renderer.setSize(1500,1000);renderer.outputColorSpace=THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xffedd0,0x425248,3));const light=new THREE.DirectionalLight(0xffd89f,3);light.position.set(-3,12,8);scene.add(light);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(45,35),new THREE.MeshStandardMaterial({color:0x58695b}));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;scene.add(ground);
for(const [i,zone] of (['HEAD','TORSO','ARMS','LEGS'] as const).entries()){
  const c=new Character(true,i);c.root.position.set(-8+i*5,0,-4);scene.add(c.root);c.animate(1.4,false,false,0);
  c.wounds({reaction:.18,zone,side:-1,slow:zone==='LEGS'?2:0,wounds:[{zone,side:-1,y:1.3}]} as Walker);
  textSign(scene,zone,-8+i*5,.1,-2,3,.55).rotation.x=-Math.PI/2;
}
for(const [i,p] of [.27,.57,.88].entries()){
  const c=new Character();c.root.position.set(-7+i*5,0,1);scene.add(c.root);c.animate(0,false,false,0);c.reloadPose(BALANCE.pistol.reload*(1-p));textSign(scene,['RETIRAR','INSERIR','FERROLHO'][i],-7+i*5,.1,3,3,.55).rotation.x=-Math.PI/2;
}
const shooter=new Character();shooter.root.position.set(8,0,1);scene.add(shooter.root);shooter.animate(0,false,false,1);const flash=new THREE.PointLight(0xffcf86,3,4);flash.position.set(8,1.4,2);scene.add(flash);textSign(scene,'DISPARO',8,.1,3,3,.55).rotation.x=-Math.PI/2;
const corpses=new CorpseView(scene);corpses.update([0,Math.PI/2,Math.PI].map((fall,i)=>({id:i,x:-6+i*5,z:6,age:1,fall,angle:0,variant:i,wounds:[{zone:'TORSO',side:1,y:1.3}]})));
renderer.render(scene,camera);document.body.dataset.ready='true';
