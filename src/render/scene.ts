import { REGIONS } from '../game/districts';
import { WEAPONS } from '../game/weapons';
import { ExpeditionView } from './expedition-view';
import { CityView } from './city-view';
import { WORLD_LIMIT } from '../game/world';
import { bodyHit } from '../game/combat';
import { CorpseView } from './corpses';
import * as THREE from 'three';
import { Character } from './models';
import { voxelStats } from './voxel';
import { SurvivalView } from './survival-view';
import { BALANCE } from '../game/config';
import { createTown } from './town';
import type { Town } from './town';
import type { Simulation, GameEvent } from '../game/simulation';

interface Particle { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number }
export class GameScene {
  shake=true; aimResponse=1; aimTarget=false; flashlightOn=false; private torch=new THREE.SpotLight(0xe2d5b1,0,15,.48,.65,1.5);
  private corpses: CorpseView; private kick=0;
  scene = new THREE.Scene(); camera = new THREE.OrthographicCamera(-25, 25, 20, -20, .1, 160);
  renderer: THREE.WebGLRenderer;
  private survival: SurvivalView;
  private expedition:ExpeditionView; town: Town; survivor = new Character(); walkers: Character[] = [];
  private city:CityView;
  private sun = new THREE.DirectionalLight(0xffdeb0, 3.1);
  private ambient = new THREE.HemisphereLight(0xc5ddd3, 0x626e59, 2.3);
  private focus = new THREE.Vector3(1, 0, 7); private target = new THREE.Vector3(); private offset = new THREE.Vector3(25, 32, 25);
  private raycaster = new THREE.Raycaster(); private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1);
  private particles: Particle[] = []; private particleIndex = 0;
  private particlePaint = new Map<number, THREE.MeshBasicMaterial>();
  private tracers: { mesh: THREE.Mesh; life: number }[] = []; private tracerIndex = 0;
  private ring: THREE.Mesh; private destination = new THREE.Vector3(); private flashLight = new THREE.PointLight(0xffd392, 0, 6, 1.5);
  private dayColor = new THREE.Color(0xa7b9a6); private nightColor = new THREE.Color(0x263e50); private sky = new THREE.Color();
  private dust: THREE.Points; private dustArray: Float32Array;
  private viewSize = 47; gameplaySpan = 28.5; quality = 'high';
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    this.scene.background = new THREE.Color(0xa7b9a6); this.scene.fog = new THREE.FogExp2(0xa7b9a6, .010);
    this.sun.position.set(-22, 38, 12); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 110 });
    this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .07;
    this.scene.add(this.sun, this.sun.target, this.ambient, this.flashLight,this.torch,this.torch.target);
    this.town = createTown(this.scene);this.expedition=new ExpeditionView(this.scene); this.corpses=new CorpseView(this.scene); this.survival = new SurvivalView(this.scene); this.scene.add(this.survivor.root);
    this.city=new CityView(this.scene);
    for (let i = 0; i < BALANCE.walker.capacity; i++) { const c = new Character(true, i); c.root.visible = false; this.walkers.push(c); this.scene.add(c.root); }
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.69, .74, 40), new THREE.MeshBasicMaterial({ color: 0xe8d7a5, transparent: true, opacity: .65, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring);
    const particleGeo = new THREE.BoxGeometry(.09, .09, .09);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xe0b56f }); this.particlePaint.set(0xe0b56f, particleMaterial);
    for (let i = 0; i < BALANCE.combat.particles; i++) { const mesh = new THREE.Mesh(particleGeo, particleMaterial); mesh.visible = false; this.scene.add(mesh); this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1 }); }
    const tracerGeo = new THREE.BoxGeometry(.035, .035, 1);
    const tracerMaterial = new THREE.MeshBasicMaterial({ color: 0xffd794, transparent: true, opacity: .8 });
    for (let i = 0; i < 10; i++) { const mesh = new THREE.Mesh(tracerGeo, tracerMaterial); mesh.visible = false; this.scene.add(mesh); this.tracers.push({ mesh, life: 0 }); }
    this.dustArray = new Float32Array(160 * 3);
    for (let i = 0; i < this.dustArray.length; i += 3) { this.dustArray[i] = Math.random() * 80 - 40; this.dustArray[i + 1] = .5 + Math.random() * 8; this.dustArray[i + 2] = Math.random() * 80 - 40; }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustArray, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe5d6ae, size: .05, transparent: true, opacity: .4, depthWrite: false })); this.scene.add(this.dust);
    this.resize();
  }
  reset(): void { this.particles.forEach(p => { p.life = 0; p.mesh.visible = false; }); this.tracers.forEach(t => { t.life = 0; t.mesh.visible = false; }); this.flashLight.intensity = 0;this.flashlightOn=false; }
  metrics(): { meshes: number; materials: number; geometries: number; textures: number; geometryMB: number; cacheMB: number; heapMB: number | null; voxelAssets: number; activeChunks:number } {
    const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>(); let meshes = 0, bytes = 0;
    this.scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Points) { meshes++; geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
    geometries.forEach(g => { for (const a of Object.values(g.attributes)) bytes += a.array.byteLength; bytes += g.index?.array.byteLength ?? 0; });
    const cache = voxelStats(), memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return { meshes, materials: materials.size, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, geometryMB: Math.round(bytes / 104857.6) / 10, cacheMB: Math.round(cache.geometryBytes / 104857.6) / 10, heapMB: memory ? Math.round(memory.usedJSHeapSize / 104857.6) / 10 : null, voxelAssets: cache.assets,activeChunks:this.city.active+this.town.chunks.filter(g=>g.visible).length };
  }
  setQuality(quality: string): void {
    this.quality = quality; this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.75 : 1));
    this.renderer.shadowMap.enabled = quality === 'high'; this.resize();
  }
  resize(): void {
    const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h, false); this.projection();
  }
  private projection(): void { const a = innerWidth / innerHeight; this.camera.left = -this.viewSize * a / 2; this.camera.right = this.viewSize * a / 2; this.camera.top = this.viewSize / 2; this.camera.bottom = -this.viewSize / 2; this.camera.updateProjectionMatrix(); }
  aim(clientX: number, clientY: number): THREE.Vector3 {
    this.raycaster.setFromCamera(new THREE.Vector2(clientX / innerWidth * 2 - 1, -clientY / innerHeight * 2 + 1), this.camera);
    const ray=this.raycaster.ray,h=Math.hypot(ray.direction.x,ray.direction.z),dir={x:ray.direction.x/h,z:ray.direction.z/h};let nearest=300,found=false;
    for(const c of this.walkers)if(c.root.visible){const hit=bodyHit(ray.origin,dir,ray.direction.y/h,{x:c.root.position.x,z:c.root.position.z,angle:c.root.rotation.y,kind:c.kind},nearest,ray.origin.y);if(hit){nearest=hit.distance;found=true;}}
    this.aimTarget=found;
    if(found)return this.destination.set(ray.origin.x+dir.x*nearest,ray.origin.y+ray.direction.y/h*nearest,ray.origin.z+dir.z*nearest);
    this.raycaster.ray.intersectPlane(this.ground, this.destination); return this.destination;
  }
  inSpawnView(x: number, z: number): boolean { const p = new THREE.Vector3(x, 1.5, z).project(this.camera); return Math.abs(p.x) < 1.18 && Math.abs(p.y) < 1.18; }
  project(x: number, z: number, y=1.1): { x: number; y: number } { const p = new THREE.Vector3(x, y, z).project(this.camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }
  private burst(x: number, y: number, z: number, color: number, count: number): void {
    let paint = this.particlePaint.get(color); if (!paint) { paint = new THREE.MeshBasicMaterial({ color }); this.particlePaint.set(color, paint); }
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleIndex++ % this.particles.length]; p.life = p.maxLife = .25 + Math.random() * .35; p.mesh.position.set(x, y, z); p.mesh.visible = true;
      p.mesh.material = paint; p.velocity.set((Math.random() - .5) * 5, Math.random() * 3, (Math.random() - .5) * 5); p.mesh.scale.setScalar(1 + Math.random() * 1.8);
    }
  }
  event(e: GameEvent): void {
    if (e.type === 'shot') {
      const t = this.tracers[this.tracerIndex++ % this.tracers.length], length = Math.hypot(e.to.x - e.from.x, e.to.z - e.from.z);
      t.life = .065; t.mesh.visible = true; t.mesh.position.set((e.to.x + e.from.x) / 2, 1.29, (e.to.z + e.from.z) / 2); t.mesh.rotation.y = Math.atan2(e.to.x - e.from.x, e.to.z - e.from.z); t.mesh.scale.z = length;
      if(e.material!=='air')this.burst(e.to.x, e.y??1.1, e.to.z, e.hit ? 0x793e33 : e.material==='metal'?0xf1c886:e.material==='wood'?0xa8865d:0xa4a496, e.hit ? 8 : 4);
      const bloodCount=e.hit?8:e.material==='air'?0:4;for(let i=0;i<bloodCount;i++){const p=this.particles[(this.particleIndex-1-i+this.particles.length)%this.particles.length];p.velocity.x+=(e.to.x-e.from.x)/Math.max(1,length)*2;p.velocity.z+=(e.to.z-e.from.z)/Math.max(1,length)*2;}
      const start=new THREE.Vector3(e.from.x,1.3,e.from.z),end=new THREE.Vector3(e.to.x,e.y??1.3,e.to.z);t.mesh.position.copy(start).lerp(end,.5);t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),end.clone().sub(start).normalize());t.mesh.scale.z=start.distanceTo(end);
      if(e.primary!==false)this.kick=this.shake?Math.min(.13,BALANCE.combat.cameraKick*WEAPONS[e.weapon??'pistol'].recoil):0; this.burst(e.from.x+.25,1.25,e.from.z,0xc4a269,1);
      this.flashLight.position.set(e.from.x, 1.7, e.from.z); this.flashLight.intensity = 3+WEAPONS[e.weapon??'pistol'].flash;
    } else if (e.type === 'barricade-hit' || e.type === 'barricade-break') this.burst(e.position.x, .9, e.position.z, 0x9f835b, e.type === 'barricade-break' ? 24 : 4);
    else if (e.type === 'build' || e.type === 'repair') this.burst(e.position.x, .6, e.position.z, 0xbeab75, 6);
    else if(e.type==='heavy-step'){this.burst(e.position.x,.1,e.position.z,0x8b896b,4);}
    else if(e.type==='spit'){this.burst(e.position.x,1.8,e.position.z,0xa5ad6c,4);}
    else if(e.type==='hurt')this.kick=this.shake?.09:0;
    else if (e.type === 'death') this.burst(e.position.x, .7, e.position.z, 0x64372f, 12);
  }
  render(sim: Simulation, dt: number, elapsed: number, menu: boolean): void {
    const blend = 1 - Math.exp(-dt * 4);
    this.target.set(sim.player.x, 0, sim.player.z);
    if(!menu){const dx=this.destination.x-sim.player.x,dz=this.destination.z-sim.player.z,len=Math.max(1,Math.hypot(dx,dz));this.target.x+=dx/len*.8;this.target.z+=dz/len*.8;}
    if (menu) this.target.set(-4, 0, 0);
    this.target.x=THREE.MathUtils.clamp(this.target.x,-WORLD_LIMIT+12,WORLD_LIMIT-12);this.target.z=THREE.MathUtils.clamp(this.target.z,-WORLD_LIMIT+12,WORLD_LIMIT-12);
    this.focus.lerp(this.target, blend); this.viewSize += ((menu ? 39 : this.gameplaySpan) - this.viewSize) * blend;
    this.projection(); this.camera.position.copy(this.focus).add(this.offset); this.camera.lookAt(this.focus); this.camera.position.y+=this.kick; this.kick*=Math.exp(-dt*24);
    this.survivor.root.position.set(sim.player.x, .18, sim.player.z);
    const difference = Math.atan2(Math.sin(sim.player.angle - this.survivor.root.rotation.y), Math.cos(sim.player.angle - this.survivor.root.rotation.y));
    this.survivor.root.rotation.y += difference * (1 - Math.exp(-dt * 25*this.aimResponse));
    this.survivor.setWeapon(sim.equipped.type);this.survivor.animate(elapsed, sim.player.moving && !menu, sim.player.running, sim.recoil, sim.player.invulnerable > .35 ? 1 : 0);
    this.survivor.reloadPose(sim.reloadTimer,sim.reloadDuration,sim.switchTimer); this.corpses.update(sim.corpses.bodies);
    this.ring.position.set(sim.player.x, .24, sim.player.z);this.dust.position.set(sim.player.x,0,sim.player.z);
    for (let i = 0; i < this.walkers.length; i++) {
      const c = this.walkers[i], z = sim.zombies[i]; c.root.visible = !!z?.active;
      if (z?.active) { c.setKind(z.kind);c.root.position.set(z.x, .1, z.z); c.root.rotation.y = z.angle; c.animate(z.gait, z.path.length > 0, false, z.attack > .8 ? .4 : 0, z.flash); c.wounds(z);if(z.screamTimer){c.body.rotation.x=-.22;c.head.rotation.x=-.6;c.arms.rotation.x=-1.8;}else if(z.spitTarget){c.body.rotation.x=-.16;c.head.rotation.x=-.35;c.arms.rotation.x=-.4;}else if(z.winding){c.arms.rotation.x=-.7;c.body.rotation.x=-.12;} }
    }
    this.survival.update(sim, dt, elapsed, menu);this.expedition.update(sim,elapsed);
    if (sim.action) { this.survivor.arms.rotation.x = -.35 + Math.sin(elapsed * 8) * .08; this.survivor.body.rotation.x = .08; }
    else this.survivor.body.rotation.x = sim.player.running?.12:sim.player.exhausted?.05+Math.sin(elapsed*4)*.012:0;
    const smooth = (x: number): number => { x = THREE.MathUtils.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    const night = menu ? .9 : smooth(sim.cycle.darkness);
    this.city.update(sim,night);
    this.sky.copy(this.dayColor).lerp(this.nightColor, night); (this.scene.background as THREE.Color).copy(this.sky);
    const fog = this.scene.fog as THREE.FogExp2; fog.color.copy(this.sky); fog.density = .009 + night * .003;
    this.sun.intensity = 2.85 - night * 2.1; this.sun.color.setHex(0xffdeb0).lerp(new THREE.Color(0x88b4e4), night);
    const sunset = sim.phase === 'night' || sim.phase === 'dawn' ? 0 : Math.sin(sim.cycle.darkness * Math.PI);
    this.sun.color.lerp(new THREE.Color(0xf2a16a), sunset * .85);
    this.sun.position.y = 38 - night * 21;
    this.ambient.intensity = 1.95 - night * .35; this.ambient.color.setHex(0xc5ddd3).lerp(new THREE.Color(0x87afd2), night);
    this.town.lamps.emissiveIntensity = .1 + night * 3;
    this.town.emergency.emissiveIntensity = night * (1.7 + Math.sin(elapsed * 1.5) * .15);
    const lightPoints=[{x:-5.4,z:6},{x:9.6,z:8},{x:-15.9,z:-12},...REGIONS.slice(2).map(r=>({x:r.x-8.8,z:r.z}))].sort((a,b)=>Math.hypot(a.x-this.focus.x,a.z-this.focus.z)-Math.hypot(b.x-this.focus.x,b.z-this.focus.z));
    this.town.lights.forEach((l,i)=>l.position.set(lightPoints[i].x,4.4,lightPoints[i].z));
    this.town.lights.forEach(l => { l.intensity = night * 25 * (l===this.town.lights[2] ? .85+.15*Math.sin(elapsed*.7):1); }); this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 60);
    this.torch.intensity=this.flashlightOn&&!menu?22:0;this.torch.position.set(sim.player.x,1.6,sim.player.z);this.torch.target.position.set(sim.player.x+Math.sin(sim.player.angle)*9,.4,sim.player.z+Math.cos(sim.player.angle)*9);
    this.sun.position.x=this.focus.x-22;this.sun.position.z=this.focus.z+12;this.sun.target.position.copy(this.focus);
    this.town.chunks.forEach(g=>{g.visible=Math.hypot(g.position.x-this.focus.x,g.position.z-this.focus.z)<65;});
    for (const b of this.town.buildings) {
      b.group.visible=Math.hypot(b.data.x-this.focus.x,b.data.z-this.focus.z)<70;
      const dx = b.data.x - sim.player.x, dz = b.data.z - sim.player.z;
      const inRoom=!!b.group.userData.interiorRoom&&Math.abs(dx)<b.data.w/2+3&&Math.abs(dz)<b.data.d/2+3;
      if(b.group.userData.interiorRoof)b.group.userData.interiorRoof.visible=!inRoom;
      if(b.group.userData.interiorRoom)b.group.userData.interiorRoom.visible=b.group.visible;
      const occluding = inRoom || !menu && dx + dz > 0 && Math.abs(dx - dz) < Math.max(b.data.w, b.data.d) * .8 && Math.hypot(dx, dz) < b.data.h * 2.6;
      for (const m of b.materials) { const goal = occluding ? .22 : 1; m.opacity += (goal - m.opacity) * blend; const transparent = m.opacity < .99; if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; } m.depthWrite = !transparent; }
    }
    for (const p of this.particles) if (p.life > 0) { p.life -= dt; p.mesh.visible = p.life > 0; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= dt * 8; p.mesh.rotation.x += dt * 4; p.mesh.scale.multiplyScalar(Math.exp(-dt * 2)); }
    for (const t of this.tracers) { t.life -= dt; t.mesh.visible = t.life > 0; }
    for (let i = 0; i < this.dustArray.length; i += 3) { this.dustArray[i] += dt * .15; if (this.dustArray[i] > 40) this.dustArray[i] = -40; }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}
