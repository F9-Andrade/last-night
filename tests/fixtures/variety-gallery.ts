import * as THREE from 'three';
import {Character,textSign} from '../../src/render/models';
import {CorpseView} from '../../src/render/corpses';
import {WEAPONS} from '../../src/game/weapons';
import type {WeaponId} from '../../src/game/weapons';
import {ENEMIES} from '../../src/game/enemies';
import type {EnemyKind} from '../../src/game/enemies';
import type {Walker} from '../../src/game/simulation';
import type {Wound} from '../../src/game/combat';
const wounds:Wound[]=[{zone:'TORSO',side:1,y:1.2},{zone:'HEAD',side:1,y:1.89},{zone:'ARMS',side:-1,y:1.15}];
const scene=new THREE.Scene();scene.background=new THREE.Color(0x273b35);const camera=new THREE.OrthographicCamera(-15,15,9,-9,.1,100);camera.position.set(5,18,28);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true});renderer.setSize(1800,1080);renderer.outputColorSpace=THREE.SRGBColorSpace;scene.add(new THREE.HemisphereLight(0xffedd0,0x425248,3));const light=new THREE.DirectionalLight(0xffd89f,3);light.position.set(-3,12,8);scene.add(light);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(45,40),new THREE.MeshStandardMaterial({color:0x58695b}));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;scene.add(ground);
for(const [i,id]of (Object.keys(WEAPONS) as WeaponId[]).entries()){const c=new Character();c.setWeapon(id);c.root.position.set(-11+i*4.5,0,-6);c.root.rotation.y=-.6;scene.add(c.root);c.animate(1,false,false,0);c.reloadPose(0);textSign(scene,WEAPONS[id].name.toUpperCase(),-11+i*4.5,.1,-3.8,4,.5).rotation.x=-Math.PI/2;}
for(const [i,kind]of (Object.keys(ENEMIES)as EnemyKind[]).entries()){const c=new Character(true,i);c.setKind(kind);c.root.position.set(-10+i*5,0,1);scene.add(c.root);c.animate(1.8,true,false,0);c.wounds({reaction:0,side:1,zone:'TORSO',slow:0,wounds} as Walker);textSign(scene,ENEMIES[kind].name.toUpperCase(),-10+i*5,.1,3.3,4,.5).rotation.x=-Math.PI/2;}
const corpses=new CorpseView(scene);corpses.update((Object.keys(ENEMIES)as EnemyKind[]).map((kind,i)=>({id:i,kind,x:-10+i*5,z:7,age:1.5,fall:0,angle:.2,variant:i%3,wounds})));renderer.render(scene,camera);document.body.dataset.ready='true';
