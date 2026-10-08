import {VisibleGroup} from './static-chunk.ts';
import type { Walker } from '../game/simulation';
import { BALANCE } from '../game/config.ts';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { voxelMaterial, voxelMesh, voxelGeometry } from './voxel.ts';
import { characterPart } from './character-assets.ts';
import { createWeaponVisual, type WeaponVisual } from './weapon-assets.ts';
import { createSurvivorHand, createSleeve, HAND_GRIP, type SurvivorHand } from './hand-assets.ts';
import { solveArm } from './melee-motion.ts';
import { MELEE_VISUALS } from './melee-assets.ts';
import type { MeleeId } from '../game/crafting.ts';
import { ENEMIES } from '../game/enemies.ts';
import type { EnemyKind } from '../game/enemies.ts';
import { WEAPONS } from '../game/weapons.ts';
import type { WeaponId } from '../game/weapons.ts';
import type { Wound } from '../game/combat.ts';
import { surfaceAtlasMaterial, SURFACE_KINDS, weatherSurface } from './surface-materials.ts';
import type { SurfaceKind } from './surface-materials.ts';

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

const materials = new Map<string, THREE.MeshStandardMaterial>();
export function material(color: number, surface?: SurfaceKind): THREE.MeshStandardMaterial {
  const key = `${color}:${surface ?? 'plain'}`;
  let m = materials.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: .92, flatShading: true }); if (surface) weatherSurface(m, surface); materials.set(key, m); }
  return m;
}
const cube = new THREE.BoxGeometry(1, 1, 1);
/** Cached primitives/paints can be used by a future model even when absent from the current scene. */
export function sharedModelResource(value:THREE.BufferGeometry|THREE.Material):boolean {if(value===cube)return true;for(const paint of materials.values())if(paint===value)return true;return false;}
export function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number, surface?: SurfaceKind): THREE.Mesh {
  const m = new THREE.Mesh(cube, material(color, surface)); m.position.set(x, y, z); m.scale.set(w, h, d); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
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
    if (!geometry.attributes.surfaceType) {
      const family = Math.max(0, SURFACE_KINDS.indexOf(source.userData.surfaceKind ?? 'voxel'));
      geometry.setAttribute('surfaceType', new THREE.Float32BufferAttribute(new Float32Array(count).fill(family), 1));
    }
    const target = source.emissive?.getHex() ? source : surfaceAtlasMaterial();
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

interface SurvivorArm {
  hand: SurvivorHand; upper: THREE.Mesh; forearm: THREE.Mesh;
  wrist: THREE.Vector3; elbow: THREE.Vector3;
}
const armAxis = new THREE.Vector3(0,0,1), handUp = new THREE.Vector3(0,1,0), shoulderOrigin = new THREE.Vector3();
const handScale = 1.6, upperLength=.43, forearmLength=.47;

export class Character {
  root = new VisibleGroup(); body = new THREE.Group(); leftLeg = new THREE.Group(); rightLeg = new THREE.Group(); arms = new THREE.Group();
  head = new THREE.Group(); leftArm = new THREE.Group(); rightArm = new THREE.Group();
  weapon?: THREE.Group; magazine?: THREE.Mesh; private marks: THREE.Mesh[]=[];
  muzzle: THREE.Mesh | null = null; private paint: THREE.MeshStandardMaterial;
  readonly zombie: boolean; private variant: number;
  private survivorArms:SurvivorArm[]=[];private heldVisual?:WeaponVisual;
  private attachment=new THREE.Vector3();private handOffset=new THREE.Vector3();private attachmentMatrix=new THREE.Matrix4();
  private handRotation=new THREE.Quaternion();private equipmentRotation=new THREE.Quaternion();
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
    if(zombie){
      this.leftArm.add(voxelMesh(characterPart('left-arm', true, variant), this.paint));
      this.rightArm.add(voxelMesh(characterPart('right-arm', true, variant), this.paint));
    }else for(const [side,arm] of [[1,this.rightArm],[-1,this.leftArm]] as const){
      const hand=createSurvivorHand(side),upper=createSleeve(true),forearm=createSleeve();
      hand.root.scale.setScalar(handScale);hand.root.rotation.y=Math.PI;
      upper.scale.set(2,2,upperLength/.38);forearm.scale.set(1.8,1.8,forearmLength/.425);
      arm.add(upper,forearm,hand.root);
      this.survivorArms.push({hand,upper,forearm,wrist:new THREE.Vector3(),elbow:new THREE.Vector3()});
    }
    if (zombie) { this.body.rotation.x = .16; this.head.rotation.set(.08, -.13, .16 * (variant % 2 ? -1 : 1)); }
    else {
      const weapon = createWeaponVisual('pistol');this.weaponCache.set('pistol',weapon);this.heldVisual=weapon;this.weapon=weapon.root;this.magazine=weapon.magazine;weapon.root.scale.setScalar(weapon.scale);this.rightArm.add(weapon.root);
      this.muzzle = new THREE.Mesh(new THREE.IcosahedronGeometry(.22, 0), new THREE.MeshBasicMaterial({ color: 0xffdc88 }));
      this.muzzle.position.copy(weapon.muzzle); this.muzzle.scale.set(.7, .7, 1.7); this.muzzle.visible = false; weapon.root.add(this.muzzle);this.updateHands();
    }

    const shadow = new THREE.Mesh(contactGeometry, contactMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .03; this.root.add(shadow);
  }
  dispose():void {
    this.root.removeFromParent();this.paint.dispose();
    if(this.muzzle){this.muzzle.geometry.dispose();(this.muzzle.material as THREE.Material).dispose();}
    this.root.clear();this.weaponCache.clear();
  }
  setWeapon(id:WeaponId):void {
    if(this.zombie||this.weaponId===id)return;
    this.weaponId=id;let visual=this.weaponCache.get(id);if(!visual){visual=createWeaponVisual(id);this.weaponCache.set(id,visual);}
    this.weapon?.removeFromParent();this.heldVisual=visual;this.weapon=visual.root;this.magazine=visual.magazine;this.weapon.scale.setScalar(visual.scale);this.rightArm.add(this.weapon);this.updateHands();
    if(this.muzzle){this.weapon.add(this.muzzle);this.muzzle.position.copy(visual.muzzle);this.muzzle.scale.set(.7,.7,1.7).multiplyScalar(WEAPONS[id].flash);}
  }
  setKind(kind:EnemyKind,variant=this.variant):void {
    variant=((variant%3)+3)%3;
    if(!this.zombie||(this.kind===kind&&this.variant===variant))return;this.kind=kind;this.variant=variant;this.root.name=`voxel-${kind}`;
    for(const [part,parent] of [['torso',this.body],['head',this.head],['left-leg',this.leftLeg],['right-leg',this.rightLeg],['left-arm',this.leftArm],['right-arm',this.rightArm]] as const){const mesh=parent.children.find(o=>o instanceof THREE.Mesh&&o.userData.voxelAsset) as THREE.Mesh;mesh.geometry=voxelGeometry(characterPart(part,true,this.variant,kind));}
    const d=ENEMIES[kind];this.head.position.set(-.07,d.headY-.37,d.headZ);
    this.leftLeg.position.set(-.23*d.scaleX,.8*d.scaleY,0);this.rightLeg.position.set(.23*d.scaleX,.8*d.scaleY,0);
    this.leftArm.position.set(-.45*d.scaleX,1.37*d.scaleY,0);this.rightArm.position.set(.45*d.scaleX,1.32*d.scaleY,0);
  }
  wounds(z:Walker,presentationReaction=z.reaction):void {
    const reaction=presentationReaction/BALANCE.combat.stagger;
    this.body.rotation.z+=reaction*z.side*(z.zone==='ARMS'?.25:.12);
    this.body.rotation.x-=reaction*(z.zone==='TORSO'?.22:.08);
    if(z.zone==='LEGS'){this.body.position.y-=Math.min(.3,reaction*.16);(z.side<0?this.leftLeg:this.rightLeg).rotation.x+=reaction*.45;}
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
  private animatedId=-1;private walkBlend=0;private hitTime=0;private previousHP=0;private previousAttack=0;
  private attackBlend=0;private screamBlend=0;private spitBlend=0;private windupBlend=0;
  private lastX=0;private lastZ=0;
  /** Local presentation only; interpolation provides position/gait and the host still owns combat. */
  animateInfected(z:Walker,dt:number,time:number,near:boolean):void {
    const fresh=this.animatedId!==z.id;
    if(fresh){this.animatedId=z.id;this.walkBlend=0;this.hitTime=0;this.previousHP=z.hp;this.previousAttack=z.attack;this.lastX=z.x;this.lastZ=z.z;this.attackBlend=this.screamBlend=this.spitBlend=this.windupBlend=0;}
    const step=Math.min(.1,Math.max(0,dt)),ease=1-Math.exp(-step*12);
    const speed=step>0?Math.hypot(z.x-this.lastX,z.z-this.lastZ)/step:0;
    this.lastX=z.x;this.lastZ=z.z;
    this.walkBlend+=(Number(speed>.07&&!fresh)-this.walkBlend)*ease;
    if(z.hp<this.previousHP)this.hitTime=Math.min(.45,Math.max(z.reaction,.22));
    this.previousHP=z.hp;this.hitTime=Math.max(0,this.hitTime-step);
    this.animate(z.gait,true,false,0,z.flash);
    this.leftLeg.rotation.x*=this.walkBlend;this.rightLeg.rotation.x*=this.walkBlend;
    const breath=time*(this.kind==='runner'?2.2:1.65)+z.id*1.71;
    this.body.position.y=Math.abs(Math.sin(z.gait))*.045*this.walkBlend+Math.sin(breath)*.008;
    this.body.rotation.z*=.35+.65*this.walkBlend;
    this.body.rotation.x+=Math.sin(breath)*.016;
    this.head.rotation.y=-.09+Math.sin(breath*.47)*.065;
    this.head.rotation.z=Math.sin(breath*.61)*.035+(z.id%2?-.08:.08);
    this.head.rotation.x+=Math.sin(breath+.8)*.027-Math.sin(z.gait)*this.walkBlend*.025;
    this.leftArm.rotation.x*=.3+.7*this.walkBlend;this.rightArm.rotation.x*=.3+.7*this.walkBlend;
    this.leftArm.rotation.x+=Math.sin(breath+.8)*.035;this.rightArm.rotation.x+=Math.sin(breath*.9+2)*.04;
    this.leftArm.rotation.y=Math.sin(breath*.7)*.025;this.rightArm.rotation.y=-Math.sin(breath*.7+.5)*.025;
    // Blend attack anticipation/recovery instead of snapping entire limbs into a fixed pose.
    const attacking=z.attack>.4&&(near||this.previousAttack<z.attack);
    this.previousAttack=z.attack;
    this.attackBlend+=(Number(attacking)-this.attackBlend)*(1-Math.exp(-step*(attacking?18:7)));
    this.screamBlend+=(Number(!!z.screamTimer)-this.screamBlend)*ease;
    this.spitBlend+=(Number(!!z.spitTarget)-this.spitBlend)*ease;
    this.windupBlend+=(Number(z.winding)-this.windupBlend)*ease;
    this.leftArm.rotation.x+=(-1.25-this.leftArm.rotation.x)*this.attackBlend;
    this.rightArm.rotation.x+=(-1.4-this.rightArm.rotation.x)*this.attackBlend;
    this.body.rotation.x+=(.25-this.body.rotation.x)*this.attackBlend;
    this.arms.rotation.x-=this.windupBlend*.7+this.spitBlend*.4+this.screamBlend*1.8;
    this.body.rotation.x-=this.windupBlend*.18+this.spitBlend*.28+this.screamBlend*.36;
    this.head.rotation.x-=this.spitBlend*.2+this.screamBlend*.5;
    if(z.kind==='stalker'&&z.chargeTarget){this.body.rotation.x+=z.windup>0?.3:.5;this.leftArm.rotation.x-=.5;this.rightArm.rotation.x-=.5;}
    this.wounds(z,this.hitTime);
  }
  /** Anchor both palms on real equipment contacts, then solve sleeves back to fixed shoulders. */
  updateHands(melee?:THREE.Mesh,meleeId?:MeleeId):void {
    if(this.zombie)return;
    const right=this.survivorArms[0],left=this.survivorArms[1],visual=this.heldVisual!;
    const firearm=!meleeId,short=WEAPONS[this.weaponId].slot===1;
    right.wrist.set(firearm?-.30:meleeId==='spear'?-.38:-.10,-.15,firearm?(short?.34:.15):meleeId==='spear'?.02:.38);
    left.wrist.set(meleeId==='fists'?.10:.08,-.17,meleeId==='fists'?.38:.32);
    right.hand.root.rotation.set(0,Math.PI,0);left.hand.root.rotation.set(0,Math.PI,0);
    right.hand.pose(1,firearm?.8:0);left.hand.pose(1);
    const held=firearm?this.weapon:melee;
    if(held){
      this.handOffset.copy(HAND_GRIP).multiplyScalar(handScale).applyQuaternion(right.hand.root.quaternion);
      this.attachment.copy(firearm?visual.grip:shoulderOrigin).multiply(held.scale).applyQuaternion(held.quaternion);
      held.position.copy(right.wrist).add(this.handOffset).sub(this.attachment);
      const support=firearm?visual.supportGrip:meleeId&&MELEE_VISUALS[meleeId].supportGrip;
      if(support){
        if(support instanceof THREE.Vector3)this.attachment.copy(support);else this.attachment.set(...support);
        // Pump contact follows the moving fore-end. Magazine/cylinder follows the reload hand.
        if(firearm&&visual.actionKind==='pump')this.attachment.add(visual.action.position).sub(visual.actionHome);
        if(firearm&&this.reloadHandBlend>0)this.attachment.lerp(this.handOffset.copy(visual.magazine.position),this.reloadHandBlend);
        held.updateMatrix();this.rightArm.updateMatrix();this.leftArm.updateMatrix();
        this.attachmentMatrix.copy(this.leftArm.matrix).invert().multiply(this.rightArm.matrix).multiply(held.matrix);
        left.wrist.copy(this.attachment).applyMatrix4(this.attachmentMatrix);
        this.equipmentRotation.copy(this.leftArm.quaternion).invert().multiply(this.rightArm.quaternion).multiply(held.quaternion);
        this.handRotation.setFromAxisAngle(armAxis,firearm&& !short?Math.PI/2:0);
        left.hand.root.quaternion.copy(this.equipmentRotation).multiply(this.handRotation);
        this.handRotation.setFromAxisAngle(handUp,Math.PI);left.hand.root.quaternion.multiply(this.handRotation);
        this.handOffset.copy(HAND_GRIP).multiplyScalar(handScale).applyQuaternion(left.hand.root.quaternion);left.wrist.sub(this.handOffset);
      }
    }
    for(const [index,arm] of this.survivorArms.entries()){
      solveArm(shoulderOrigin,arm.wrist,arm.elbow,index===0?1:-1,upperLength,forearmLength);
      arm.hand.root.position.copy(arm.wrist);
      arm.upper.position.copy(arm.elbow);this.attachment.copy(arm.elbow).negate().normalize();arm.upper.quaternion.setFromUnitVectors(armAxis,this.attachment);
      arm.forearm.position.copy(arm.wrist);this.attachment.subVectors(arm.elbow,arm.wrist).normalize();arm.forearm.quaternion.setFromUnitVectors(armAxis,this.attachment);
    }
  }
  private reloadHandBlend=0;
  reloadPose(timer:number,duration=BALANCE.pistol.reload,switchTimer=0):void {
    const visual=this.heldVisual;if(!this.magazine||!visual)return;
    const p=timer?1-timer/duration:0,style=WEAPONS[this.weaponId].reloadStyle;
    const remove=p>.16&&p<.65?Math.sin((p-.16)/.49*Math.PI):0;
    this.magazine.position.copy(visual.magazineHome);this.magazine.rotation.set(0,0,0);
    this.magazine.position.y-=.44*remove;this.magazine.rotation.z=-.3*remove;
    if(style==='cylinder'&&timer)this.magazine.position.x-=.2*Math.sin(p*Math.PI);
    if(style==='shell'){this.magazine.visible=timer>0;this.magazine.position.y-=timer?.2*Math.sin(p*Math.PI):0;}
    else this.magazine.visible=true;
    this.reloadHandBlend=timer?Math.min(1,p*7,(1-p)*7):0;
    if(timer){const ease=this.reloadHandBlend;this.arms.rotation.x=.55*ease;this.rightArm.rotation.z=-.15*ease;}
    if(switchTimer)this.arms.rotation.x=.9*Math.sin(switchTimer/.32*Math.PI);
    this.updateHands();
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
    if(this.zombie&&(this.kind==='runner'||this.kind==='stalker')){this.body.rotation.x=.32;this.body.position.y-=.03;this.leftArm.rotation.x=Math.sin(gait)*.8;this.rightArm.rotation.x=-Math.sin(gait)*.75;this.head.rotation.x=-.2;}
    if(this.zombie&&this.kind==='tank'){this.body.rotation.x=.11;this.body.position.y=Math.abs(Math.sin(gait))*.035;this.body.rotation.z=Math.sin(gait)*.04;this.leftArm.rotation.x=Math.sin(gait)*.12;this.rightArm.rotation.x=-Math.sin(gait)*.12;}
    if(this.zombie&&this.kind==='spitter'){this.body.rotation.x=.18;this.head.rotation.x=-.16;this.head.rotation.z=Math.sin(gait*.2)*.07;this.leftArm.rotation.x=.3;}
    if(this.weapon&&this.heldVisual){
      this.leftArm.rotation.set(0,0,0);this.rightArm.rotation.y=0;this.weapon.rotation.set(-recoil*.06,0,0);
      const v=this.heldVisual;v.action.position.copy(v.actionHome);v.action.rotation.set(0,0,0);
      if(v.actionKind==='hammer')v.action.rotation.x=-recoil*.3;else v.action.position.z-=recoil*(v.actionKind==='pump'?.10:.025);
    }
    this.arms.position.z = -recoil * .16; this.arms.rotation.x = -recoil * .1;
    if (this.muzzle) this.muzzle.visible = recoil > WEAPONS[this.weaponId].recoil*.72;
    this.paint.emissive.setHex(flash > 0 ? 0x9a643f : 0);if(!this.zombie)this.updateHands();
  }
}
