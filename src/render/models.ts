import type { Walker } from '../game/simulation';
import { BALANCE } from '../game/config.ts';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { voxelMaterial, voxelMesh, voxelGeometry } from './voxel.ts';
import { characterPart } from './character-assets.ts';
import { createWeaponVisual } from './weapon-assets.ts';
import { ENEMIES } from '../game/enemies.ts';
import type { EnemyKind } from '../game/enemies.ts';
import { WEAPONS } from '../game/weapons.ts';
import type { WeaponId } from '../game/weapons.ts';
import type { Wound } from '../game/combat.ts';

export function woundPart(w:Wound):'head'|'body'|'leftArm'|'rightArm'|'leftLeg'|'rightLeg' {
  return w.zone==='HEAD'?'head':w.zone==='ARMS'?(w.side<0?'leftArm':'rightArm'):w.zone==='LEGS'?(w.side<0?'leftLeg':'rightLeg'):'body';
}
/** Local anchors sit on each anatomical surface, shared by live and fallen rigs. */
export function woundPosition(target:THREE.Vector3,kind:EnemyKind,w:Wound,index:number):void {
  const torso=w.zone==='TORSO',shape=ENEMIES[kind];
  const depth=torso?(kind==='tank'?.59:kind==='spitter'?.65:.34):w.zone==='HEAD'?.35:w.zone==='ARMS'?(kind==='runner'?.19:kind==='tank'?.27:.19):.27;
  target.set(torso?w.side*.14:0,w.zone==='HEAD'?.3:torso?1.2*shape.scaleY:w.zone==='ARMS'?-.22:-.34,depth);
  target.x+=(index%3-1)*.065;target.y+=Math.floor(index/3)*.08;
}

const materials = new Map<number, THREE.MeshStandardMaterial>();
export function material(color: number): THREE.MeshStandardMaterial {
  let m = materials.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: .92, flatShading: true }); materials.set(color, m); }
  return m;
}
const cube = new THREE.BoxGeometry(1, 1, 1);
export function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(cube, material(color)); m.position.set(x, y, z); m.scale.set(w, h, d); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export function cylinder(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, h: number, color: number, sides = 8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, sides), material(color)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export function textSign(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width: number, height: number, bg = '#344747', ink = '#ede6cc'): THREE.Mesh {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = ink; ctx.font = 'bold 66px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 68, 475);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 1, side: THREE.DoubleSide }));
  mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
/** Merge static colors into vertex paint, preserving emissive/textured materials and part ranges. */
export function batch(group: THREE.Group): void {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  const buckets = new Map<THREE.Material, { geometry: THREE.BufferGeometry; asset: string; transform: number[] }[]>();
  const originals: THREE.Mesh[] = [];
  group.traverse(o => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || o.material.map || o.material.transparent) return;
    const source = o.material as THREE.MeshStandardMaterial;
    const transform = inverse.clone().multiply(o.matrixWorld);
    const geometry = o.geometry.clone().applyMatrix4(transform);
    if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    const count = geometry.attributes.position.count, color = new Float32Array(count * 3), oldColor = geometry.attributes.color;
    for (let i = 0; i < count; i++) {
      color[i * 3] = source.color.r * (source.vertexColors && oldColor ? oldColor.getX(i) : 1);
      color[i * 3 + 1] = source.color.g * (source.vertexColors && oldColor ? oldColor.getY(i) : 1);
      color[i * 3 + 2] = source.color.b * (source.vertexColors && oldColor ? oldColor.getZ(i) : 1);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    const target = source.emissive?.getHex() ? source : voxelMaterial;
    const entries = buckets.get(target) ?? []; entries.push({ geometry, asset: o.userData.voxelAsset ?? o.name, transform: transform.toArray() }); buckets.set(target, entries); originals.push(o);
  });
  for (const [mat, entries] of buckets) {
    const merged = mergeGeometries(entries.map(e => e.geometry));
    if (merged) {
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true;
      let offset = 0; mesh.userData.parts = entries.map(e => { const part = { asset: e.asset, firstIndex: offset, indexCount: e.geometry.index!.count, transform: e.transform }; offset += part.indexCount; return part; });
      group.add(mesh);
    }
    entries.forEach(e => e.geometry.dispose());
  }
  originals.forEach(o => o.removeFromParent());
}

const contactGeometry = new THREE.CircleGeometry(.57, 20);
const contactMaterial = new THREE.MeshBasicMaterial({ color: 0x152627, transparent: true, opacity: .25, depthWrite: false });

export class Character {
  root = new THREE.Group(); body = new THREE.Group(); leftLeg = new THREE.Group(); rightLeg = new THREE.Group(); arms = new THREE.Group();
  head = new THREE.Group(); leftArm = new THREE.Group(); rightArm = new THREE.Group();
  weapon?: THREE.Group; magazine?: THREE.Mesh; private marks: THREE.Mesh[]=[];
  muzzle: THREE.Mesh | null = null; private paint: THREE.MeshStandardMaterial;
  readonly zombie: boolean; private variant: number;
  kind:EnemyKind='walker'; weaponId:WeaponId='pistol';private weaponCache=new Map<WeaponId,ReturnType<typeof createWeaponVisual>>();
  constructor(zombie = false, variant = 0) {
    this.zombie = zombie; this.variant = variant;
    this.paint = voxelMaterial.clone(); this.root.name = zombie ? 'voxel-walker' : 'voxel-survivor';
    this.root.add(this.body); this.body.add(this.leftLeg, this.rightLeg, this.arms, this.head);
    this.body.add(voxelMesh(characterPart('torso', zombie, variant), this.paint));
    this.head.position.set(zombie ? -.07 : 0, zombie ? 1.52 : 1.6, zombie ? .18 : 0);
    this.head.add(voxelMesh(characterPart('head', zombie, variant), this.paint));
    this.leftLeg.position.set(-.23, .8, 0); this.rightLeg.position.set(.23, .8, 0);
    this.leftLeg.add(voxelMesh(characterPart('left-leg', zombie, variant), this.paint));
    this.rightLeg.add(voxelMesh(characterPart('right-leg', zombie, variant), this.paint));
    this.arms.add(this.leftArm, this.rightArm);
    this.leftArm.position.set(-.45, zombie ? 1.37 : 1.42, 0); this.rightArm.position.set(.45, zombie ? 1.32 : 1.42, 0);
    this.leftArm.add(voxelMesh(characterPart('left-arm', zombie, variant), this.paint));
    this.rightArm.add(voxelMesh(characterPart('right-arm', zombie, variant), this.paint));
    if (zombie) { this.body.rotation.x = .16; this.head.rotation.set(.08, -.13, .16 * (variant % 2 ? -1 : 1)); }
    else {
      this.leftArm.rotation.y = .8;
      const weapon = createWeaponVisual('pistol');this.weaponCache.set('pistol',weapon); this.weapon=weapon.root; this.magazine=weapon.magazine; weapon.root.position.set(0, -.15, .66); this.rightArm.add(weapon.root);
      this.muzzle = new THREE.Mesh(new THREE.IcosahedronGeometry(.22, 0), new THREE.MeshBasicMaterial({ color: 0xffdc88 }));
      this.muzzle.position.copy(weapon.muzzle); this.muzzle.scale.set(.7, .7, 1.7); this.muzzle.visible = false; weapon.root.add(this.muzzle);
    }

    const shadow = new THREE.Mesh(contactGeometry, contactMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .03; this.root.add(shadow);
  }
  setWeapon(id:WeaponId):void {
    if(this.zombie||this.weaponId===id)return;
    this.weaponId=id;let visual=this.weaponCache.get(id);if(!visual){visual=createWeaponVisual(id);this.weaponCache.set(id,visual);}
    this.weapon?.removeFromParent();this.weapon=visual.root;this.magazine=visual.magazine;this.weapon.position.set(0,-.15,WEAPONS[id].slot===0?.38:.66);this.rightArm.add(this.weapon);
    if(this.muzzle){this.weapon.add(this.muzzle);this.muzzle.position.copy(visual.muzzle);this.muzzle.scale.set(.7,.7,1.7).multiplyScalar(WEAPONS[id].flash);}
  }
  setKind(kind:EnemyKind):void {
    if(!this.zombie||this.kind===kind)return;this.kind=kind;this.root.name=`voxel-${kind}`;
    for(const [part,parent] of [['torso',this.body],['head',this.head],['left-leg',this.leftLeg],['right-leg',this.rightLeg],['left-arm',this.leftArm],['right-arm',this.rightArm]] as const){const mesh=parent.children.find(o=>o instanceof THREE.Mesh&&o.userData.voxelAsset) as THREE.Mesh;mesh.geometry=voxelGeometry(characterPart(part,true,this.variant,kind));}
    const d=ENEMIES[kind];this.head.position.set(-.07,d.headY-.37,d.headZ);
    this.leftLeg.position.set(-.23*d.scaleX,.8*d.scaleY,0);this.rightLeg.position.set(.23*d.scaleX,.8*d.scaleY,0);
    this.leftArm.position.set(-.45*d.scaleX,1.37*d.scaleY,0);this.rightArm.position.set(.45*d.scaleX,1.32*d.scaleY,0);
  }
  wounds(z:Walker):void {
    const reaction=z.reaction/BALANCE.combat.stagger;
    this.body.rotation.z+=reaction*z.side*(z.zone==='ARMS'?.25:.12);
    this.body.rotation.x-=reaction*(z.zone==='TORSO'?.22:.08);
    if(z.zone==='HEAD') this.head.rotation.x-=reaction*.55;
    if(z.zone==='ARMS') (z.side<0?this.leftArm:this.rightArm).rotation.z+=reaction*z.side*.65;
    if(z.slow>0) this.leftLeg.rotation.x+=.25;
    while(this.marks.length<Math.min(z.wounds.length,BALANCE.combat.woundLimit)){const m=new THREE.Mesh(cube,material(this.marks.length%2?0x65352e:0x71392e));this.marks.push(m);this.body.add(m);}
    this.marks.forEach((m,i)=>{const w=z.wounds[i];m.visible=!!w;if(!w)return;
      const part=this[woundPart(w)];
      if(m.parent!==part)part.add(m);
      woundPosition(m.position,this.kind,w,i);m.scale.set(.15,.12,.07);
    });
  }
  reloadPose(timer:number,duration=BALANCE.pistol.reload,switchTimer=0):void {
    if(!this.magazine)return;
    const p=timer?1-timer/duration:0,style=WEAPONS[this.weaponId].reloadStyle;
    this.magazine.position.y=p>.16&&p<.65?-.44*Math.sin((p-.16)/.49*Math.PI):0;
    this.magazine.rotation.z=p>.16&&p<.65?-.3*Math.sin((p-.16)/.49*Math.PI):0;
    this.magazine.position.x=style==='cylinder'&&timer?-.2*Math.sin(p*Math.PI):0;
    if(style==='shell'){this.magazine.visible=timer>0;this.magazine.position.y=timer?-.2*Math.sin(p*Math.PI):0;}
    if(timer){const ease=Math.min(1,p*7,(1-p)*7);this.arms.rotation.x=.55*ease;this.leftArm.rotation.x=-.5*ease;this.leftArm.rotation.z=.4*ease;this.rightArm.rotation.z=-.15*ease;}
    if(switchTimer)this.arms.rotation.x=.9*Math.sin(switchTimer/.32*Math.PI);
  }
  animate(time: number, moving: boolean, running: boolean, recoil: number, flash = 0): void {
    const gait = this.zombie ? time : time * (running ? 13 : 9);
    const amount = moving ? (running ? .8 : .5) : .025;
    this.leftLeg.rotation.x = Math.sin(gait) * amount;
    this.rightLeg.rotation.x = -Math.sin(gait + (this.zombie ? .5 : 0)) * amount * (this.zombie ? .7 : 1);
    this.body.position.y = Math.abs(Math.sin(gait)) * (moving ? .055 : .012);
    this.body.rotation.z = Math.sin(gait * .5) * (this.zombie ? .08 : .015);
    this.body.rotation.y = this.zombie ? 0 : Math.sin(gait) * (moving ? .025 : .006);
    this.leftArm.rotation.x = this.zombie ? -.18 + Math.sin(gait * .7) * .19 : Math.sin(gait) * (moving ? .09 : .01);
    this.rightArm.rotation.x = this.zombie ? .22 + Math.sin(gait * .9 + this.variant) * .16 : -recoil * .16 + Math.sin(gait) * (moving ? .07 : .01);
    this.leftArm.rotation.z = this.zombie ? -.12 + Math.sin(gait) * .045 : running ? -.08 : 0;
    this.rightArm.rotation.z = this.zombie ? .15 : running ? .06 : 0;
    this.head.rotation.x=this.zombie?.08:0; this.body.rotation.x=this.zombie?.16:running?.12:0;
    if(this.zombie&&this.kind==='runner'){this.body.rotation.x=.32;this.body.position.y-=.03;this.leftArm.rotation.x=Math.sin(gait)*.8;this.rightArm.rotation.x=-Math.sin(gait)*.75;this.head.rotation.x=-.2;}
    if(this.zombie&&this.kind==='tank'){this.body.rotation.x=.11;this.body.position.y=Math.abs(Math.sin(gait))*.035;this.body.rotation.z=Math.sin(gait)*.04;this.leftArm.rotation.x=Math.sin(gait)*.12;this.rightArm.rotation.x=-Math.sin(gait)*.12;}
    if(this.zombie&&this.kind==='spitter'){this.body.rotation.x=.18;this.head.rotation.x=-.16;this.head.rotation.z=Math.sin(gait*.2)*.07;this.leftArm.rotation.x=.3;}
    if(this.weapon) {this.weapon.position.z=(WEAPONS[this.weaponId].slot===0?.38:.66)-recoil*.08;this.weapon.rotation.x=-recoil*.22;if(WEAPONS[this.weaponId].slot===0){this.leftArm.rotation.y=.5;this.leftArm.rotation.x=-.18;}else this.leftArm.rotation.y=.8;}
    this.arms.position.z = -recoil * .16; this.arms.rotation.x = -recoil * .1;
    if (this.muzzle) this.muzzle.visible = recoil > WEAPONS[this.weaponId].recoil*.72;
    this.paint.emissive.setHex(flash > 0 ? 0x9a643f : 0);
  }
}
