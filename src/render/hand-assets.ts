import * as THREE from 'three';
import {voxelMesh} from './voxel.ts';

/** Wrist origin, fingers towards -Z; contact centre inside the curled fingers. */
export const HAND_GRIP=new THREE.Vector3(0,-.018,-.065);
export interface SurvivorHand {root:THREE.Group;fingers:THREE.Group[];thumb:THREE.Group;pose:(curl:number,trigger?:number)=>void}
const glove=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:0,flatShading:true});
/** Six shared voxel meshes, mirrored anatomy (never negative scale/normals). */
export function createSurvivorHand(side:1|-1):SurvivorHand {
 const root=new THREE.Group();root.name=side===1?'right-hand':'left-hand';
 root.add(voxelMesh({id:`hand:palm:${side}:v2`,unit:.005,build(g){
  g.fill(-8,-3,-13,16,7,12,0x655442).fill(-7,-3,-2,14,6,5,0xa78668);
  g.fill(-8,1,-12,16,4,10,0x485044).fill(-7,5,-11,14,1,8,0x5e6755);
  g.fill(-7,-4,-10,14,2,8,0x303930).fill(-7,3,-3,14,2,3,0x333d34);
  g.fill(-8,-4,0,16,9,4,0x414d40).fill(-7,5,0,14,1,3,0x747760);
  g.fill(side===1?-8:6,1,-6,2,3,5,0x776c53);
  for(let x=-6;x<7;x+=4)g.fill(x,6,-10,2,1,6,0x85816a);
  g.fill(-5,5,-3,10,1,1,0x929079);g.set(5,6,-7,0x9b9274);
 }},glove));
 const fingers:THREE.Group[]=[];
 for(let i=0;i<4;i++){
  const finger=new THREE.Group();finger.position.set(side*(-.03+i*.02),0,-.061);root.add(finger);fingers.push(finger);
  finger.add(voxelMesh({id:`hand:finger:${i}:v2`,unit:.005,build(g){
   const length=i===3?5:7;
   g.fill(-1,-2,-length,3,5,length+1,0xa98969).fill(-1,3,-length+1,3,1,length-1,0xc0a17e);
   g.fill(-1,-2,-3,3,4,4,0x525b48).fill(-1,-3,-length,3,2,3,0x776044);
   g.fill(-1,1,-length,3,1,1,0x876c50);
   // Bent distal phalanx, seam and a muted nail. The silhouette stays squared.
   g.fill(-1,-6,-length,3,5,3,0x987755).fill(-1,-7,-length+1,3,2,5,0xb28f6c);
   g.fill(-1,-7,-length+4,3,1,2,0xd0b595);
  }},glove));
 }
 const thumb=new THREE.Group();thumb.position.set(-side*.041,-.003,-.029);root.add(thumb);
 thumb.add(voxelMesh({id:`hand:thumb:${side}:v2`,unit:.005,build(g){
  g.fill(-2,-3,-6,4,7,7,0x9e7c5c).fill(-2,3,-4,4,1,4,0xc09b73);
  g.fill(-2,-4,-8,4,5,4,0xaf8d67).fill(-1,-3,-9,3,3,1,0xd2b595);
  g.fill(-2,-3,-1,4,5,3,0x525b48);
 }},glove));
 let previousCurl=-1,previousTrigger=-1;
 const pose=(curl:number,trigger=0)=>{
  if(curl===previousCurl&&trigger===previousTrigger)return;previousCurl=curl;previousTrigger=trigger;
  fingers.forEach((finger,i)=>{finger.rotation.x=-(.15+curl*.88)+(i===0?trigger*.3:0);finger.rotation.y=side*(i-1.5)*.025*(1-curl);});
  thumb.rotation.set(-.32-curl*.32,side*(.45+curl*.28),side*.25);
 };
 pose(1);return {root,fingers,thumb,pose};
}

/** Separate cuff/forearm and upper sleeve allow fixed-length two-bone IK. */
export function createSleeve(upper=false):THREE.Mesh {
 return voxelMesh({id:`hand:sleeve:${upper?'upper':'forearm'}:v2`,unit:.005,build(g){
  const length=upper?76:85;
  g.fill(-9,-9,0,18,18,length,0x505747);
  g.fill(-10,-9,12,20,18,length-20,0x565e4c).fill(-11,-10,28,22,20,length-36,0x4b5545);
  g.fill(-9,-10,0,18,2,length,0x303d32).fill(-9,9,12,18,2,length-20,0x69705b);
  for(const z of [18,40,65]){g.fill(-10,7,z,20,3,3,0x3b473a);g.fill(-9,10,z+3,18,1,2,0x767963);}
  g.fill(-11,-7,length-15,2,14,5,0x78806a).fill(-11,-5,length-14,1,10,2,0x353f34);
  if(!upper){g.fill(-10,-10,0,20,20,5,0x333f34).fill(-9,10,0,18,1,5,0x878b70);g.fill(10,-3,1,2,7,3,0x7e806c);}
 }});
}
