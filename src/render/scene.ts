import {CraftingView} from './crafting-view';
import {ConstructionView} from './construction-view';
import type {BuildPreview} from './construction-view';
import {structureFloorHeight,structureSurfaceY} from '../game/construction';
import {EnvironmentalDressing} from './environmental-dressing';
import {ImpactDecals} from './impact-decals';
import {surfaceStats} from './surface-materials';
import {CinematicSky} from './cinematic-sky';
import {PostProcessing} from './post-processing';
import {VISUAL,visualPreset} from './visual-config';
import {CITY_SITES} from '../game/city';
import {BUILDINGS} from '../game/world';
import {hasInterior} from '../game/interiors';
import { RemotePlayers } from './remote-players';
import type { RemotePlayerState } from '../network/protocol';
import {UrbanView} from './urban-view';
import { REGIONS } from '../game/districts';
import { WEAPONS } from '../game/weapons';
import { ExpeditionView } from './expedition-view';
import { CityView } from './city-view';
import { FPS,lookDirection } from '../game/first-person';
import { Viewmodel } from './viewmodel';
import type { MouseLook } from '../game/first-person';
import { rayWorld } from '../game/world';
import { bodyHit } from '../game/combat';
import { CorpseView } from './corpses';
import * as THREE from 'three';
import { Character } from './models';
import {characterPart} from './character-assets';
import { voxelStats,voxelGeometry } from './voxel';
import { SurvivalView } from './survival-view';
import { BALANCE } from '../game/config';
import { createTown } from './town';
import type { Town } from './town';
import type { Simulation, GameEvent } from '../game/simulation';

interface Particle { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number }
export class GameScene {
  shake=true; fov=FPS.fov; headBob=.5; look?:MouseLook; readonly viewmodel=new Viewmodel(); aimTarget=false; flashlightOn=false; private torch=new THREE.SpotLight(0xe2d5b1,0,24,.52,.8,1.5);
  private corpses: CorpseView; private kick=0;private infectedPrepared=false;
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(FPS.fov,innerWidth/innerHeight,.035,FPS.viewDistance);
  renderer: THREE.WebGLRenderer;
  private post:PostProcessing;private atmosphere:CinematicSky;private dressing:EnvironmentalDressing;private impactDecals:ImpactDecals;
  private projectedFov=NaN;private projectedAspect=NaN;private projectedFar=NaN;
  private projectionScratch=new THREE.Vector3();private directionScratch=new THREE.Vector3();
  private sunOffset=new THREE.Vector3(...VISUAL.sun.offset);
  private moonColor=new THREE.Color(VISUAL.sun.moon);private sunsetColor=new THREE.Color(0xf2aa7a);private nightAmbient=new THREE.Color(0x7894b4);
  private lightPoints=[{x:-5.4,z:6},{x:9.6,z:8},{x:-15.9,z:-12},...REGIONS.slice(2).map(r=>({x:r.x-8.8,z:r.z}))].map((p,index)=>({...p,index,distance:0}));
  private shadowCenter=new THREE.Vector3();private sunDirection=new THREE.Vector3(...VISUAL.sun.offset).normalize();
  private shadowRight=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),this.sunDirection).normalize();
  private shadowUp=new THREE.Vector3().crossVectors(this.sunDirection,this.shadowRight);
  private survival: SurvivalView;private craftingView:CraftingView;private constructionView:ConstructionView;
  craftPreview:'bench'|'chest'|undefined;openChest:number|undefined;buildPreview:BuildPreview|undefined;
  furnitureMove:{kind:'bench'|'chest';id:number}|undefined;furnitureRotation=0;
  readonly remoteView=new RemotePlayers(this.scene);remoteStates:RemotePlayerState[]=[];
  private expedition:ExpeditionView; town: Town; survivor = new Character(); walkers: Character[] = [];
  private city:CityView; private urban:UrbanView;
  private sun = new THREE.DirectionalLight(0xffdeb0, 3.1);
  private ambient = new THREE.HemisphereLight(0xc5ddd3, 0x626e59, 2.3);
  private focus = new THREE.Vector3(1, 0, 7);

  private particles: Particle[] = []; private particleIndex = 0;
  private particlePaint = new Map<number, THREE.MeshBasicMaterial>();
  private casings:{mesh:THREE.Mesh;velocity:THREE.Vector3;life:number}[]=[];private casingIndex=0;
  private tracers: { mesh: THREE.Mesh; life: number }[] = []; private tracerIndex = 0;
  private ring: THREE.Mesh; private destination = new THREE.Vector3(); private flashLight = new THREE.PointLight(0xffd392, 0, 6, 1.5);
  private interior=0;
  private dayColor = new THREE.Color(VISUAL.fog.day); private nightColor = new THREE.Color(VISUAL.fog.night); private sky = new THREE.Color();
  private dust: THREE.Points; private dustArray: Float32Array;
  quality = 'high';
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.AgXToneMapping; this.renderer.toneMappingExposure = VISUAL.exposure;
    this.scene.background = new THREE.Color(0xa7b9a6); this.scene.fog = new THREE.FogExp2(0xa7b9a6, .010);
    this.sun.position.set(-22, 38, 12); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -VISUAL.shadow.span, right: VISUAL.shadow.span, top: VISUAL.shadow.span, bottom: -VISUAL.shadow.span, near: VISUAL.shadow.near, far: VISUAL.shadow.far });
    this.sun.shadow.bias = VISUAL.shadow.bias; this.sun.shadow.normalBias = VISUAL.shadow.normalBias;
    this.torch.shadow.mapSize.set(512,512);this.torch.shadow.bias=-.00015;this.torch.shadow.normalBias=.02;this.torch.shadow.camera.near=.15;this.torch.shadow.camera.far=25;
    this.scene.add(this.sun, this.sun.target, this.ambient, this.flashLight,this.torch,this.torch.target);
    this.town = createTown(this.scene);this.expedition=new ExpeditionView(this.scene); this.corpses=new CorpseView(this.scene); this.survival = new SurvivalView(this.scene); this.scene.add(this.survivor.root);
    this.city=new CityView(this.scene);this.urban=new UrbanView(this.scene);this.craftingView=new CraftingView(this.scene);this.constructionView=new ConstructionView(this.scene);
    for (let i = 0; i < BALANCE.walker.capacity; i++) { const c = new Character(true, i); c.root.visible = false; this.walkers.push(c); this.scene.add(c.root); }
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.69, .74, 40), new THREE.MeshBasicMaterial({ color: 0xe8d7a5, transparent: true, opacity: .65, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring);
    const particleGeo = new THREE.BoxGeometry(.09, .09, .09);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xe0b56f }); this.particlePaint.set(0xe0b56f, particleMaterial);
    for (let i = 0; i < BALANCE.combat.particles; i++) { const mesh = new THREE.Mesh(particleGeo, particleMaterial); mesh.visible = false; this.scene.add(mesh); this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1 }); }
    const casingGeo=new THREE.BoxGeometry(.022,.022,.065),casingPaint=new THREE.MeshStandardMaterial({color:0xb49b60,roughness:.45});
    for(let i=0;i<24;i++){const mesh=new THREE.Mesh(casingGeo,casingPaint);mesh.visible=false;this.scene.add(mesh);this.casings.push({mesh,velocity:new THREE.Vector3(),life:0});}
    const tracerGeo = new THREE.BoxGeometry(.035, .035, 1);
    const tracerMaterial = new THREE.MeshBasicMaterial({ color: 0xffd794, transparent: true, opacity: .8 });
    for (let i = 0; i < 10; i++) { const mesh = new THREE.Mesh(tracerGeo, tracerMaterial); mesh.visible = false; this.scene.add(mesh); this.tracers.push({ mesh, life: 0 }); }
    this.dustArray = new Float32Array(160 * 3);
    for (let i = 0; i < this.dustArray.length; i += 3) { this.dustArray[i] = Math.random() * 80 - 40; this.dustArray[i + 1] = .5 + Math.random() * 8; this.dustArray[i + 2] = Math.random() * 80 - 40; }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustArray, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe5d6ae, size: .05, transparent: true, opacity: .4, depthWrite: false })); this.scene.add(this.dust);
    this.atmosphere=new CinematicSky(this.scene);this.dressing=new EnvironmentalDressing(this.scene);this.impactDecals=new ImpactDecals(this.scene);
    this.post=new PostProcessing(this.renderer,this.scene,this.camera,this.viewmodel);
    this.renderer.info.autoReset=false;this.resize();
  }
  reset(): void {this.corpses.reset();this.impactDecals.reset();this.viewmodel.reset();this.casings.forEach(c=>{c.life=0;c.mesh.visible=false;}); this.particles.forEach(p => { p.life = 0; p.mesh.visible = false; }); this.tracers.forEach(t => { t.life = 0; t.mesh.visible = false; }); this.flashLight.intensity = 0;this.flashlightOn=false; }
  /** Prepare the actual HDR pipeline and FPS rig before the first playable frame.
   * Rendering the menu alone never visits the gun or all materials seen at spawn. */
  async prepare(sim:Simulation,progress:(message:string,value:number)=>void=()=>{}):Promise<void> {
    const composer=this.post.composer,target=this.renderer.getRenderTarget(),toScreen=composer.renderToScreen;
    const yaw=this.look?.yaw,pitch=this.look?.pitch,flashlight=this.flashlightOn,interior=this.interior;
    composer.renderToScreen=false;
    try {
      if(!this.infectedPrepared){
        progress('Preparando os infectados…',10);
        // Build the small-voxel variants under the loader, not on the first encounter.
        for(const kind of ['walker','runner','tank','spitter','screamer','armored','stalker','bloater'] as const){
          for(let variant=0;variant<3;variant++)for(const part of ['torso','head','left-arm','right-arm','left-leg','right-leg'] as const)voxelGeometry(characterPart(part,true,variant,kind));
          this.corpses.prepareKind(kind);
          await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
        }
        this.infectedPrepared=true;
      }
      progress('Preparando as estruturas do abrigo…',18);
      await this.constructionView.prepare();
      progress('Preparando a iluminação de Santa Luz…',20);
      this.render(sim,0,0,false,false);
      // Match the render target used during gameplay: compiling against the canvas
      // would prepare different tone-mapping shader variants.
      this.renderer.setRenderTarget(composer.readBuffer);
      await this.renderer.compileAsync(this.scene,this.camera);
      progress('Preparando seu equipamento…',40);
      this.viewmodel.prepareProvisions();
      await this.renderer.compileAsync(this.viewmodel.scene,this.camera);
      this.viewmodel.warmProvisions(this.renderer,this.camera);
      // Allocate/upload geometry, textures, shadow maps and post-process targets.
      // These frames never reach the canvas and never advance the simulation.
      // Upload the area around the actual spawn, including the view behind the
      // player. Looking around after loading must not be the first draw of it.
      for(let angle=0;angle<4;angle++){
        progress('Carregando os arredores do abrigo…',50+angle*8);
        if(this.look)this.look.yaw=(yaw??sim.player.angle)+angle*Math.PI/2;
        this.flashlightOn=angle===3;
        this.render(sim,0,0,false);
        await this.waitForGPU();
      }
      if(this.look){this.look.yaw=yaw!;this.look.pitch=pitch!;}
      this.flashlightOn=flashlight;
      this.render(sim,0,0,false);await this.waitForGPU();
      this.render(sim,0,0,true);
      await this.waitForGPU();
    } finally {
      if(this.look){this.look.yaw=yaw!;this.look.pitch=pitch!;}
      this.interior=interior;this.flashlightOn=flashlight;
      composer.renderToScreen=toScreen;this.renderer.setRenderTarget(target);this.reset();
    }
  }
  private async waitForGPU():Promise<void> {
    // Three r180 requires WebGL 2; the installed types still include the old context union.
    const gl=this.renderer.getContext() as WebGL2RenderingContext,fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
    if(!fence)throw new Error('Não foi possível preparar os recursos gráficos.');
    gl.flush();const deadline=performance.now()+30000;
    try {
      for(;;){
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
        const status=gl.clientWaitSync(fence,0,0);
        if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return;
        if(status===gl.WAIT_FAILED||gl.isContextLost()||performance.now()>deadline)throw new Error('A GPU não concluiu a preparação da cena.');
      }
    } finally {gl.deleteSync(fence);}
  }
  metrics(): { meshes: number; materials: number; geometries: number; textures: number; geometryMB: number; cacheMB: number; heapMB: number | null; voxelAssets: number; activeChunks:number; visual:ReturnType<PostProcessing['metrics']>; surfaces:ReturnType<typeof surfaceStats>; dressing:ReturnType<EnvironmentalDressing['stats']>; decals:ReturnType<ImpactDecals['metrics']>; construction:ReturnType<ConstructionView['metrics']> } {
    const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>(); let meshes = 0, bytes = 0;
    [this.scene,this.viewmodel.scene].forEach(scene=>scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Points) { meshes++; geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } }));
    geometries.forEach(g => { for (const a of Object.values(g.attributes)) bytes += a.array.byteLength; bytes += g.index?.array.byteLength ?? 0; });
    const cache = voxelStats(), memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return { meshes, materials: materials.size, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, geometryMB: Math.round(bytes / 104857.6) / 10, cacheMB: Math.round(cache.geometryBytes / 104857.6) / 10, heapMB: memory ? Math.round(memory.usedJSHeapSize / 104857.6) / 10 : null, voxelAssets: cache.assets,visual:this.post.metrics(),surfaces:surfaceStats(),dressing:this.dressing.stats(),decals:this.impactDecals.metrics(),construction:this.constructionView.metrics(),activeChunks:this.urban.active+this.city.active+this.town.chunks.filter(g=>g.visible).length };
  }
  setQuality(quality: string): void {
    this.quality = quality;const preset=visualPreset(quality),ratio=Math.min(devicePixelRatio,preset.pixelRatio);if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled=preset.shadow>0;
    const shadowSize=preset.shadow||512;if(this.sun.shadow.mapSize.x!==shadowSize){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(shadowSize,shadowSize);}
    this.torch.castShadow=quality==='high'||quality==='ultra';this.camera.far=preset.distance;
    this.post.setQuality(quality);this.resize();
  }
  resize(): void {
    const w = window.innerWidth, h = window.innerHeight,ratio=this.renderer.getPixelRatio();if(this.renderer.domElement.width!==Math.floor(w*ratio)||this.renderer.domElement.height!==Math.floor(h*ratio))this.renderer.setSize(w, h, false);this.post.resize(w,h); this.projection();
  }
  private projection(): void {
    const aspect=innerWidth/innerHeight;
    if(this.projectedFov===this.camera.fov&&this.projectedAspect===aspect&&this.projectedFar===this.camera.far)return;
    this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
    this.projectedFov=this.camera.fov;this.projectedAspect=aspect;this.projectedFar=this.camera.far;
  }
  aim(_clientX=innerWidth/2,_clientY=innerHeight/2):THREE.Vector3 {
    const d=this.camera.getWorldDirection(this.directionScratch);return this.destination.copy(this.camera.position).addScaledVector(d,50);
  }
  inSpawnView(x: number, z: number): boolean { const p = this.projectionScratch.set(x, 1.5, z).project(this.camera); return p.z>-1&&p.z<1&&Math.abs(p.x)<1.18&&Math.abs(p.y)<1.18; }
  project(x: number, z: number, y=1.1): { x: number; y: number } { const p = this.projectionScratch.set(x, y, z).project(this.camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }
  private burst(x: number, y: number, z: number, color: number, count: number): void {
    let paint = this.particlePaint.get(color); if (!paint) { paint = new THREE.MeshBasicMaterial({ color }); this.particlePaint.set(color, paint); }
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleIndex++ % this.particles.length]; p.life = p.maxLife = .25 + Math.random() * .35; p.mesh.position.set(x, y, z); p.mesh.visible = true;
      p.mesh.material = paint; p.velocity.set((Math.random() - .5) * 5, Math.random() * 3, (Math.random() - .5) * 5); p.mesh.scale.setScalar(1 + Math.random() * 1.8);
    }
  }
  event(e: GameEvent,remote=false): void {this.impactDecals.event(e);if(!remote)this.viewmodel.event(e);
    if (e.type === 'shot') {
      const t = this.tracers[this.tracerIndex++ % this.tracers.length], length = Math.hypot(e.to.x - e.from.x, e.to.z - e.from.z);
      t.life = .065; t.mesh.visible = true; t.mesh.position.set((e.to.x + e.from.x) / 2, 1.29, (e.to.z + e.from.z) / 2); t.mesh.rotation.y = Math.atan2(e.to.x - e.from.x, e.to.z - e.from.z); t.mesh.scale.z = length;
      if(e.material!=='air')this.burst(e.to.x, e.y??1.1, e.to.z, e.hit ? 0x793e33 : e.material==='metal'?0xf1c886:e.material==='wood'?0xa8865d:0xa4a496, e.hit ? 8 : 4);
      const bloodCount=e.hit?8:e.material==='air'?0:4;for(let i=0;i<bloodCount;i++){const p=this.particles[(this.particleIndex-1-i+this.particles.length)%this.particles.length];p.velocity.x+=(e.to.x-e.from.x)/Math.max(1,length)*2;p.velocity.z+=(e.to.z-e.from.z)/Math.max(1,length)*2;}
      const start=new THREE.Vector3(e.from.x,e.fromY??1.3,e.from.z),end=new THREE.Vector3(e.to.x,e.y??1.3,e.to.z);t.mesh.position.copy(start).lerp(end,.5);t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),end.clone().sub(start).normalize());t.mesh.scale.z=start.distanceTo(end);
      if(!remote&&e.primary!==false&&e.weapon==='shotgun')this.kick=this.shake?FPS.cameraShakeAmount:0; if(e.primary!==false&&e.weapon!=='revolver'){const c=this.casings[this.casingIndex++%this.casings.length],right=new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion);c.mesh.position.copy(start).addScaledVector(right,.12);c.velocity.copy(right).multiplyScalar(1.6);c.velocity.y=1.4;c.life=1.4;c.mesh.visible=true;c.mesh.scale.set(1,1,e.weapon==='shotgun'?1.3:1);}
      this.flashLight.position.set(e.from.x, e.fromY??1.7, e.from.z); this.flashLight.intensity = 3+WEAPONS[e.weapon??'pistol'].flash;
    } else if(e.type==='hit'&&!remote)this.burst(e.position.x,e.zone==='HEAD'?1.65:e.zone==='LEGS'?.45:1.05,e.position.z,0x793e33,8);
    else if(e.type==='glass')this.burst(e.position.x,1.3,e.position.z,0xb9d2c3,18);
    else if (e.type === 'barricade-hit' || e.type === 'barricade-break') this.burst(e.position.x, e.y??.9, e.position.z, 0x9f835b, e.type === 'barricade-break' ? 24 : 4);
    else if (e.type === 'build' || e.type === 'repair') this.burst(e.position.x, e.y??.6, e.position.z, 0xbeab75, 6);
    else if(e.type==='heavy-step'){this.burst(e.position.x,.1,e.position.z,0x8b896b,4);}
    else if(e.type==='spit'){this.burst(e.position.x,1.8,e.position.z,0xa5ad6c,4);}
    else if(e.type==='hurt'&&!remote){this.kick=this.shake?FPS.cameraShakeAmount:0;this.post.hurt();}
    else if (e.type === 'death') this.burst(e.position.x, .7, e.position.z, 0x64372f, 12);
  }
  render(sim: Simulation, dt: number, elapsed: number, menu: boolean, draw=true): void {
    const yaw=menu?Math.PI*.75:this.look?.yaw??sim.player.angle,pitch=menu?-.03:(this.look?.pitch??sim.player.pitch)+sim.player.aimKick;
    this.focus.set(sim.player.x,menu?0:sim.groundY,sim.player.z);
    const bob=sim.player.moving?Math.sin(elapsed*(sim.player.running?13:9))*FPS.headBobAmount*this.headBob*(sim.player.crouched?.2:sim.player.running?1:.5):0;
    this.camera.position.set(menu?1:sim.player.x,menu?1.85:sim.player.eyeY+bob+this.kick,menu?7:sim.player.z);
    this.camera.rotation.set(pitch,yaw+Math.PI,0,'YXZ');this.kick*=Math.exp(-dt*24);
    const targetFov=sim.player.ads?(sim.equipped.type==='marksman'?FPS.precisionFov:Math.min(this.fov-14,FPS.adsFov)):this.fov+(sim.player.running?2:0);
    this.camera.fov+=(targetFov-this.camera.fov)*(1-Math.exp(-dt*FPS.adsSpeed));this.projection();this.camera.updateMatrixWorld();
    const direction=lookDirection(yaw,pitch),horizontal=Math.hypot(direction.x,direction.z),origin=this.camera.position;
    const max=rayWorld(origin,direction,sim.weapon.range,sim.solidDefenses.map(b=>({...b,h:b.h??('kind' in b?b.kind==='window'?2.4:2.8:1.4)})));
    this.aimTarget=sim.zombies.some(z=>z.active&&bodyHit(origin,{x:direction.x/horizontal,z:direction.z/horizontal},direction.y/horizontal,z,max*horizontal,origin.y));
    this.survivor.root.visible=false;this.ring.visible=false;
    this.survivor.root.position.set(sim.player.x, sim.groundY, sim.player.z);
    const difference = Math.atan2(Math.sin(sim.player.angle - this.survivor.root.rotation.y), Math.cos(sim.player.angle - this.survivor.root.rotation.y));
    this.survivor.root.rotation.y += difference * (1 - Math.exp(-dt * 25));
    this.survivor.setWeapon(sim.equipped.type);this.survivor.animate(elapsed, sim.player.moving && !menu, sim.player.running, sim.recoil, sim.player.invulnerable > .35 ? 1 : 0);
    this.survivor.reloadPose(sim.reloadTimer,sim.reloadDuration,sim.switchTimer); this.corpses.update(sim.corpses.bodies);
    this.ring.position.set(sim.player.x, .24, sim.player.z);this.dust.position.set(sim.player.x,0,sim.player.z);
    for (let i = 0; i < this.walkers.length; i++) {
      const c = this.walkers[i], z = sim.zombies[i]; c.root.visible = !!z?.active;
      if (z?.active) {c.setKind(z.kind,z.id%3);c.root.position.set(z.x,.1,z.z);c.root.rotation.y=z.angle;c.animateInfected(z,dt,elapsed,Math.hypot(z.x-sim.player.x,z.z-sim.player.z)<2);}
    }
    this.craftingView.update(sim,menu?undefined:this.craftPreview,this.openChest,dt,this.furnitureMove,this.furnitureRotation);
    this.constructionView.update(sim,menu?undefined:this.buildPreview,dt);this.survival.update(sim, dt, elapsed, menu);this.expedition.update(sim,elapsed);
    if (sim.action) { this.survivor.arms.rotation.x = -.35 + Math.sin(elapsed * 8) * .08; this.survivor.body.rotation.x = .08; }
    else this.survivor.body.rotation.x = sim.player.running?.12:sim.player.exhausted?.05+Math.sin(elapsed*4)*.012:0;
    const smooth = (x: number): number => { x = THREE.MathUtils.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    const night = menu ? .9 : smooth(sim.cycle.darkness);
    this.city.update(sim,night,dt);this.urban.update(sim,elapsed);this.dressing.update(sim.player.x,sim.player.z,this.quality);this.impactDecals.update(dt,sim.player.x,sim.player.z,this.quality,sim.solidDefenses);
    this.sky.copy(this.dayColor).lerp(this.nightColor, night); (this.scene.background as THREE.Color).copy(this.sky);
    const fog = this.scene.fog as THREE.FogExp2; fog.color.copy(this.sky); fog.density = THREE.MathUtils.lerp(VISUAL.fog.density,VISUAL.fog.nightDensity,night);
    this.atmosphere.update(this.camera,night,this.sunDirection,elapsed);
    this.sun.intensity = THREE.MathUtils.lerp(VISUAL.sun.day,VISUAL.sun.night,night); this.sun.color.setHex(VISUAL.sun.color).lerp(this.moonColor,night);
    const sunset = sim.phase === 'night' || sim.phase === 'dawn' ? 0 : Math.sin(sim.cycle.darkness * Math.PI);
    this.sun.color.lerp(this.sunsetColor, sunset * .3);
    this.sun.position.y = VISUAL.sun.offset[1];
    const shelterRoof=sim.crafting.structures.some(p=>p.hp>0&&(p.kind==='roof'||p.kind==='floor')&&Math.abs(sim.player.x-p.x)<1.5&&Math.abs(sim.player.z-p.z)<1.5&&structureSurfaceY(p)>sim.player.eyeY&&structureSurfaceY(p)-sim.player.eyeY<4);
    const inside=shelterRoof||CITY_SITES.some(s=>s.kind!=='cemetery'&&Math.abs(sim.player.x-s.x)<s.w/2-.25&&Math.abs(sim.player.z-s.z)<s.d/2-.25)||BUILDINGS.some(b=>hasInterior(b)&&Math.abs(sim.player.x-b.x)<b.w/2&&Math.abs(sim.player.z-b.z)<b.d/2);
    this.interior+=(Number(inside)-this.interior)*(1-Math.exp(-Math.max(dt,.001)*2.5));
    this.ambient.intensity=THREE.MathUtils.lerp(VISUAL.ambient.day,VISUAL.ambient.night,night)*(1-this.interior*.42);this.ambient.color.setHex(VISUAL.ambient.sky).lerp(this.nightAmbient,night);this.ambient.groundColor.setHex(VISUAL.ambient.ground);
    this.renderer.toneMappingExposure=VISUAL.exposure+this.interior*.10;
    this.town.lamps.emissiveIntensity = .1 + night * 3;
    this.town.emergency.emissiveIntensity = night * (1.7 + Math.sin(elapsed * 1.5) * .15);
    const lightPoints=this.lightPoints;
    for(const point of lightPoints)point.distance=(point.x-this.focus.x)**2+(point.z-this.focus.z)**2;
    lightPoints.sort((a,b)=>a.distance-b.distance||a.index-b.index);
    this.town.lights.forEach((l,i)=>l.position.set(lightPoints[i].x,4.4,lightPoints[i].z));
    this.town.lights.forEach(l => { l.intensity = night * 25 * (l===this.town.lights[2] ? .85+.15*Math.sin(elapsed*.7):1); }); this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 60);
    this.torch.intensity=this.flashlightOn&&!menu?48:0;this.torch.position.copy(this.camera.position);this.torch.target.position.copy(this.camera.position).addScaledVector(this.directionScratch.set(direction.x,direction.y,direction.z),12);
    // Snap the shadow center in light space, keeping the orthographic projection stable while walking.
    this.shadowCenter.copy(this.focus).add(this.directionScratch.set(direction.x*12,0,direction.z*12));
    const texel=VISUAL.shadow.span*2/this.sun.shadow.mapSize.x;
    for(const axis of [this.shadowRight,this.shadowUp]){const p=this.shadowCenter.dot(axis);this.shadowCenter.addScaledVector(axis,Math.round(p/texel)*texel-p);}
    this.sun.target.position.copy(this.shadowCenter);this.sun.position.copy(this.shadowCenter).add(this.sunOffset);
    this.town.chunks.forEach(g=>{g.visible=Math.hypot(g.position.x-this.focus.x,g.position.z-this.focus.z)<FPS.chunkDistance;});
    for (const b of this.town.buildings) {
      b.group.visible=Math.hypot(b.data.x-this.focus.x,b.data.z-this.focus.z)<FPS.chunkDistance;
      if(b.group.userData.interiorRoof)b.group.userData.interiorRoof.visible=true;
      if(b.group.userData.interiorRoom)b.group.userData.interiorRoom.visible=b.group.visible;


    }
    for (const p of this.particles) if (p.life > 0) { p.life -= dt; p.mesh.visible = p.life > 0; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= dt * 8; p.mesh.rotation.x += dt * 4; p.mesh.scale.multiplyScalar(Math.exp(-dt * 2)); }
    for(const c of this.casings)if(c.life>0){
      const previousY=c.mesh.position.y;
      c.life-=dt;c.mesh.visible=c.life>0;c.mesh.position.addScaledVector(c.velocity,dt);c.velocity.y-=9*dt;
      const ground=structureFloorHeight(sim,{x:c.mesh.position.x,z:c.mesh.position.z},previousY-.025)+.025;
      if(c.mesh.position.y<ground){c.mesh.position.y=ground;c.velocity.y=Math.abs(c.velocity.y)*.22;c.velocity.x*=.65;c.velocity.z*=.65;}
      c.mesh.rotation.x+=dt*12;c.mesh.rotation.z+=dt*7;
    }
    for (const t of this.tracers) { t.life -= dt; t.mesh.visible = t.life > 0; }
    for (let i = 0; i < this.dustArray.length; i += 3) { this.dustArray[i] += dt * .15; if (this.dustArray[i] > 40) this.dustArray[i] = -40; }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.viewmodel.syncLighting(this.sun,this.ambient,this.camera,this.interior,this.flashlightOn&&!menu);
    this.viewmodel.update(sim,this.camera,dt,elapsed,!menu&&!sim.gameOver&&(sim.coopMode==='solo'||sim.player.hp>0));this.remoteView.update(this.remoteStates,elapsed,dt,this.camera);this.renderer.info.reset();if(draw)this.post.render(dt,sim.player.hp);
  }
}
