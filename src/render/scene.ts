import {CraftingView} from './crafting-view';
import {ConstructionView} from './construction-view';
import type {BuildPreview} from './construction-view';
import {structureFloorHeight,structureSurfaceY} from '../game/construction';
import type {StructurePlacement} from '../game/construction';
import {EnvironmentalDressing} from './environmental-dressing';
import {ImpactDecals} from './impact-decals';
import {surfaceStats,sharedSurfaceMaterial} from './surface-materials';
import {CinematicSky} from './cinematic-sky';
import {PostProcessing} from './post-processing';
import {VISUAL,visualPreset} from './visual-config';
import {CITY_SITES} from '../game/city';
import {BUILDINGS} from '../game/world';
import {worldLayoutEpoch} from '../game/world-layout';
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
import { Character,sharedModelResource } from './models';
import {characterPart} from './character-assets';
import { voxelStats,voxelGeometry,voxelMaterial } from './voxel';
import { SurvivalView } from './survival-view';
import { BALANCE } from '../game/config';
import { createTown } from './town';
import type { Town } from './town';
import type { Simulation, GameEvent } from '../game/simulation';

type ParticleKind='debris'|'blood'|'spark'|'glass'|'wood';
interface Particle { mesh: THREE.Mesh; velocity: THREE.Vector3; spin:THREE.Vector3; life: number; maxLife: number; drag:number; gravity:number; shrink:number }
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
  craftPreview:'bench'|'chest'|undefined;openChest:number|undefined;buildPreview:BuildPreview|undefined;buildPlacement:StructurePlacement|undefined;
  furnitureMove:{kind:'bench'|'chest';id:number}|undefined;furnitureRotation=0;
  readonly remoteView=new RemotePlayers(this.scene);remoteStates:RemotePlayerState[]=[];
  private expedition:ExpeditionView; town: Town; survivor = new Character(); walkers: Character[] = [];
  private city:CityView; private urban:UrbanView;
  private layoutEpoch=worldLayoutEpoch();private layoutRoots=new Set<THREE.Object3D>();
  private sun = new THREE.DirectionalLight(0xffdeb0, 3.1);
  private ambient = new THREE.HemisphereLight(0xc5ddd3, 0x626e59, 2.3);
  private focus = new THREE.Vector3(1, 0, 7);

  private particles: Particle[] = []; private particleIndex = 0;
  private particlePaint = new Map<number, THREE.MeshBasicMaterial|THREE.MeshStandardMaterial>();
  private casings:{mesh:THREE.Mesh;velocity:THREE.Vector3;spin:THREE.Vector3;life:number}[]=[];private casingIndex=0;
  private casingGeometry=new Map<string,THREE.BufferGeometry>();
  private tracers: { mesh: THREE.Mesh<THREE.BoxGeometry,THREE.MeshBasicMaterial>; start:THREE.Vector3; direction:THREE.Vector3; distance:number; life: number; duration:number; opacity:number }[] = []; private tracerIndex = 0;
  private shotStart=new THREE.Vector3();private shotEnd=new THREE.Vector3();private shotDirection=new THREE.Vector3();private shotRight=new THREE.Vector3();private shotEjection=new THREE.Vector3();private shotAxis=new THREE.Vector3(0,0,1);
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
    let existingRoots=new Set(this.scene.children);
    this.town = createTown(this.scene);this.expedition=new ExpeditionView(this.scene);this.survival = new SurvivalView(this.scene);this.rememberLayoutRoots(existingRoots);
    this.corpses=new CorpseView(this.scene);this.scene.add(this.survivor.root);
    existingRoots=new Set(this.scene.children);this.city=new CityView(this.scene);this.urban=new UrbanView(this.scene);this.rememberLayoutRoots(existingRoots);
    this.craftingView=new CraftingView(this.scene);this.constructionView=new ConstructionView(this.scene);
    for (let i = 0; i < BALANCE.walker.capacity; i++) { const c = new Character(true, i); c.root.visible = false; this.walkers.push(c); this.scene.add(c.root); }
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.69, .74, 40), new THREE.MeshBasicMaterial({ color: 0xe8d7a5, transparent: true, opacity: .65, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring);
    const particleGeo = new THREE.BoxGeometry(.09, .09, .09);
    // The entire palette and every casing are prepared under the loader. A shot
    // only reuses pool entries; it never creates geometry or a material.
    for(const color of [0xe0b56f,0x793e33,0xb9d2c3,0x9f835b,0xbeab75,0x8b896b,0xa5ad6c,0x64372f,0xa8865d,0xa4a496,0x6c706e])this.particlePaint.set(color,new THREE.MeshStandardMaterial({color,roughness:color===0xb9d2c3?.3:.88,metalness:color===0x6c706e?.55:0}));
    const sparkPaint=new THREE.MeshBasicMaterial({color:0xffd699,toneMapped:false});sparkPaint.color.multiplyScalar(2.1);this.particlePaint.set(0xffd699,sparkPaint);
    const particleMaterials=[...this.particlePaint.values()];
    for (let i = 0; i < BALANCE.combat.particles; i++) { const mesh = new THREE.Mesh(particleGeo, particleMaterials[i%particleMaterials.length]); mesh.visible = false;mesh.userData.skipAO=true; this.scene.add(mesh); this.particles.push({ mesh, velocity: new THREE.Vector3(),spin:new THREE.Vector3(), life: 0, maxLife: 1,drag:1,gravity:8,shrink:2 }); }
    for(const [ammo,length,unit] of [['ammo',7,.004],['rifleAmmo',12,.004],['shells',10,.006]] as const){
      const geometry=voxelGeometry({id:`spent-${ammo}:v2`,unit,build(g){
        const z=-Math.floor(length/2),body=ammo==='shells'?0x9a3826:0xad8543;
        g.fill(-2,-1,z,4,2,length,body).fill(-1,-2,z,2,4,length,body);
        g.fill(-2,-2,z,4,4,1,0xc4a25b).fill(-1,-1,z-1,2,2,1,0x625443);
        if(ammo==='shells')g.fill(-2,-1,z+1,4,2,2,0xb48c4b).fill(-1,-2,z+1,2,4,2,0xb48c4b);
        g.carve(-1,-1,z+length-1,2,2,1).fill(-1,-1,z+length-2,2,2,1,0x3d352a);
      }});this.casingGeometry.set(ammo,geometry);
    }
    const casingPaint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.43,metalness:.5});
    for(let i=0;i<24;i++){const mesh=new THREE.Mesh(this.casingGeometry.get('ammo')!,casingPaint);mesh.visible=false;mesh.userData.skipAO=true;this.scene.add(mesh);this.casings.push({mesh,velocity:new THREE.Vector3(),spin:new THREE.Vector3(),life:0});}
    const tracerGeo = new THREE.BoxGeometry(.009, .009, 1);
    for (let i = 0; i < 10; i++) {const paint=new THREE.MeshBasicMaterial({color:0xffd8a0,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});paint.color.multiplyScalar(1.7); const mesh = new THREE.Mesh(tracerGeo,paint); mesh.visible = false;mesh.userData.skipAO=true; this.scene.add(mesh); this.tracers.push({ mesh,start:new THREE.Vector3(),direction:new THREE.Vector3(),distance:0,life:0,duration:.065,opacity:.65 }); }
    this.dustArray = new Float32Array(160 * 3);
    for (let i = 0; i < this.dustArray.length; i += 3) { this.dustArray[i] = Math.random() * 80 - 40; this.dustArray[i + 1] = .5 + Math.random() * 8; this.dustArray[i + 2] = Math.random() * 80 - 40; }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustArray, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe5d6ae, size: .05, transparent: true, opacity: .4, depthWrite: false })); this.scene.add(this.dust);
    this.atmosphere=new CinematicSky(this.scene);existingRoots=new Set(this.scene.children);this.dressing=new EnvironmentalDressing(this.scene);this.rememberLayoutRoots(existingRoots);this.impactDecals=new ImpactDecals(this.scene);
    // The world is rendered for both colour and AO. Transform it once after all
    // presentation updates; both passes must consume that same frame snapshot.
    this.scene.matrixWorldAutoUpdate=false;
    this.post=new PostProcessing(this.renderer,this.scene,this.camera,this.viewmodel);
    this.renderer.info.autoReset=false;this.resize();
  }
  reset(): void {this.corpses.reset();this.impactDecals.reset();this.viewmodel.reset();this.casings.forEach(c=>{c.life=0;c.mesh.visible=false;}); this.particles.forEach(p => { p.life = 0; p.mesh.visible = false; }); this.tracers.forEach(t => { t.life = 0; t.mesh.visible = false; }); this.flashLight.intensity = 0;this.flashlightOn=false; }
  private rememberLayoutRoots(before:Set<THREE.Object3D>):void {for(const root of this.scene.children)if(!before.has(root))this.layoutRoots.add(root);}
  /** Only runs behind the existing load screen. Shared voxel assets and all actor/effect pools survive. */
  private prepareWorldLayout():void {
    if(this.layoutEpoch===worldLayoutEpoch())return;
    this.expedition.detachDroppedWeapons();
    const retired=[...this.layoutRoots];for(const root of retired)root.removeFromParent();
    const retainedGeometry=new Set<THREE.BufferGeometry>(),retainedMaterial=new Set<THREE.Material>();
    for(const scene of [this.scene,this.viewmodel.scene])scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){retainedGeometry.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])retainedMaterial.add(material);}});
    const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    for(const root of retired)root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){if(!o.geometry.userData.asset&&!retainedGeometry.has(o.geometry)&&!sharedModelResource(o.geometry))geometry.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])if(!retainedMaterial.has(material)&&material!==voxelMaterial&&!sharedModelResource(material)&&!sharedSurfaceMaterial(material))materials.add(material);}});
    for(const g of geometry)g.dispose();for(const m of materials){const map=(m as THREE.MeshStandardMaterial).map;if(map&&!m.userData.surfaceKind)map.dispose();m.dispose();}
    this.layoutRoots.clear();const before=new Set(this.scene.children);
    this.town=createTown(this.scene);this.expedition=new ExpeditionView(this.scene);this.survival=new SurvivalView(this.scene);
    this.city=new CityView(this.scene);this.urban=new UrbanView(this.scene);this.dressing=new EnvironmentalDressing(this.scene);this.rememberLayoutRoots(before);
    this.lightPoints=[{x:-5.4,z:6},{x:9.6,z:8},{x:-15.9,z:-12},...REGIONS.slice(2).map(r=>({x:r.x-8.8,z:r.z}))].map((p,index)=>({...p,index,distance:0}));
    this.layoutEpoch=worldLayoutEpoch();this.renderer.renderLists.dispose();this.renderer.shadowMap.needsUpdate=true;
  }
  /** Prepare the actual HDR pipeline and FPS rig before the first playable frame.
   * Rendering the menu alone never visits the gun or all materials seen at spawn. */
  async prepare(sim:Simulation,progress:(message:string,value:number)=>void=()=>{}):Promise<void> {
    this.prepareWorldLayout();
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
  private burst(x: number, y: number, z: number, color: number, count: number,kind:ParticleKind='debris',direction?:THREE.Vector3): void {
    const paint=this.particlePaint.get(color)??this.particlePaint.get(0xe0b56f)!;
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleIndex++ % this.particles.length],spark=kind==='spark',glass=kind==='glass',blood=kind==='blood',wood=kind==='wood';
      p.life=p.maxLife=spark?.12+Math.random()*.13:glass?.3+Math.random()*.32:.25+Math.random()*.28;p.mesh.position.set(x,y,z);p.mesh.visible=true;p.mesh.material=paint;
      const spread=spark?3.2:blood?1.2:2;p.velocity.set((Math.random()-.5)*spread,Math.random()*(spark?1.9:1.2),(Math.random()-.5)*spread);
      // Chips rebound off the struck surface; blood carries a little momentum
      // into the target. Both use the authoritative three-dimensional shot.
      if(direction)p.velocity.addScaledVector(direction,blood?.8:spark?-1.4:-.65);
      p.drag=spark?.25:glass?.45:blood?1.4:1.1;p.gravity=spark?5:8;p.shrink=spark?.4:glass?.5:1.4;
      const size=.35+Math.random()*.65;
      if(spark){p.mesh.scale.set(.14,.14,.8+Math.random()*.8);this.shotRight.copy(p.velocity).normalize();p.mesh.quaternion.setFromUnitVectors(this.shotAxis,this.shotRight);}
      else {p.mesh.scale.set(size*(wood?.38:1),size*(glass?.16:wood?.5:1),size*(wood?1.5:1));p.mesh.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);}
      p.spin.set(spark?0:(Math.random()-.5)*14,spark?0:(Math.random()-.5)*12,spark?0:(Math.random()-.5)*9);
    }
  }
  event(e: GameEvent,remote=false): void {this.impactDecals.event(e);if(!remote)this.viewmodel.event(e);
    if (e.type === 'shot') {
      const weapon=e.weapon??'pistol',start=this.shotStart.set(e.from.x,e.fromY??1.3,e.from.z),end=this.shotEnd.set(e.to.x,e.y??1.3,e.to.z),direction=this.shotDirection.subVectors(end,start).normalize();
      // Only the presentation origin moves to the model's barrel. Hit points,
      // collision, damage and the existing network event remain untouched.
      if(!remote&&this.viewmodel.getMuzzleWorldPosition(this.shotEjection)&&this.shotRight.subVectors(end,this.shotEjection).dot(direction)>.02)start.copy(this.shotEjection);
      const distance=start.distanceTo(end);direction.subVectors(end,start).normalize();
      const t=this.tracers[this.tracerIndex++%this.tracers.length];t.duration=weapon==='shotgun'?.045:.065;t.life=distance>.04?t.duration:0;t.distance=distance;t.start.copy(start);t.direction.copy(direction);t.opacity=e.primary===false?.24:e.suppressed?.3:.65;
      t.mesh.visible=t.life>0;t.mesh.position.copy(start);t.mesh.scale.setScalar(weapon==='shotgun'?.65:1);t.mesh.scale.z=0;t.mesh.quaternion.setFromUnitVectors(this.shotAxis,direction);t.mesh.material.opacity=t.opacity;
      if(e.hit)this.burst(end.x,end.y,end.z,0x793e33,6,'blood',direction);
      else if(e.material==='metal'){this.burst(end.x,end.y,end.z,0x6c706e,2,'debris',direction);this.burst(end.x,end.y,end.z,0xffd699,4,'spark',direction);}
      else if(e.material==='glass')this.burst(end.x,end.y,end.z,0xb9d2c3,7,'glass',direction);
      else if(e.material==='wood')this.burst(end.x,end.y,end.z,0xa8865d,5,'wood',direction);
      else if(e.material!=='air')this.burst(end.x,end.y,end.z,0xa4a496,5,'debris',direction);
      if(!remote&&e.primary!==false&&weapon==='shotgun')this.kick=this.shake?FPS.cameraShakeAmount:0;
      if(e.primary!==false&&weapon!=='revolver'){
        const c=this.casings[this.casingIndex++%this.casings.length],right=this.shotRight.set(-direction.z,0,direction.x);if(right.lengthSq()<.00001)right.set(1,0,0);else right.normalize();
        if(!remote&&this.viewmodel.getEjectionWorldPosition(this.shotEjection))c.mesh.position.copy(this.shotEjection);else c.mesh.position.copy(start).addScaledVector(direction,-.19).addScaledVector(right,.07);
        c.velocity.copy(right).multiplyScalar(1.2+Math.random()*.55).addScaledVector(direction,-.25);c.velocity.y=1.25+Math.random()*.35;c.spin.set(10+Math.random()*9,5+Math.random()*8,7+Math.random()*8);
        c.life=1.8;c.mesh.visible=true;c.mesh.scale.setScalar(1);c.mesh.geometry=this.casingGeometry.get(WEAPONS[weapon].ammo)!;c.mesh.quaternion.copy(t.mesh.quaternion);
      }
      this.flashLight.position.copy(start);this.flashLight.intensity=(3+WEAPONS[weapon].flash)*(e.suppressed?.22:1);
    } else if(e.type==='hit'&&!remote)this.burst(e.position.x,e.zone==='HEAD'?1.65:e.zone==='LEGS'?.45:1.05,e.position.z,0x793e33,6,'blood');
    else if(e.type==='glass')this.burst(e.position.x,1.3,e.position.z,0xb9d2c3,18,'glass');
    else if (e.type === 'barricade-hit' || e.type === 'barricade-break') this.burst(e.position.x, e.y??.9, e.position.z, 0x9f835b, e.type === 'barricade-break' ? 24 : 4,'wood');
    else if (e.type === 'build' || e.type === 'repair') this.burst(e.position.x, e.y??.6, e.position.z, 0xbeab75, 6);
    else if(e.type==='heavy-step'){this.burst(e.position.x,.1,e.position.z,0x8b896b,4);}
    else if(e.type==='spit'){this.burst(e.position.x,1.8,e.position.z,0xa5ad6c,4);}
    else if(e.type==='hurt'&&!remote){this.kick=this.shake?FPS.cameraShakeAmount:0;this.post.hurt();}
    else if (e.type === 'death') this.burst(e.position.x, .7, e.position.z, 0x64372f, 12,'blood');
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
    this.constructionView.update(sim,menu?undefined:this.buildPreview,dt,this.buildPlacement);this.survival.update(sim, dt, elapsed, menu);this.expedition.update(sim,elapsed);
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
    for (const p of this.particles) if (p.life > 0) {
      p.life-=dt;p.mesh.visible=p.life>0;if(!p.mesh.visible)continue;
      p.mesh.position.addScaledVector(p.velocity,dt);p.velocity.multiplyScalar(Math.exp(-dt*p.drag));p.velocity.y-=dt*p.gravity;
      p.mesh.rotation.x+=dt*p.spin.x;p.mesh.rotation.y+=dt*p.spin.y;p.mesh.rotation.z+=dt*p.spin.z;p.mesh.scale.multiplyScalar(Math.exp(-dt*p.shrink));
    }
    for(const c of this.casings)if(c.life>0){
      const previousY=c.mesh.position.y;
      c.life-=dt;c.mesh.visible=c.life>0;if(!c.mesh.visible)continue;
      c.mesh.position.addScaledVector(c.velocity,dt);c.velocity.y-=9*dt;
      const ground=structureFloorHeight(sim,{x:c.mesh.position.x,z:c.mesh.position.z},previousY-.025)+.025;
      if(c.mesh.position.y<ground){c.mesh.position.y=ground;c.velocity.y=Math.abs(c.velocity.y)>.6?Math.abs(c.velocity.y)*.22:0;c.velocity.x*=.65;c.velocity.z*=.65;c.spin.multiplyScalar(.42);}
      c.mesh.rotation.x+=dt*c.spin.x;c.mesh.rotation.y+=dt*c.spin.y;c.mesh.rotation.z+=dt*c.spin.z;c.mesh.scale.setScalar(Math.min(1,c.life/.22));
    }
    for (const t of this.tracers) if(t.life>0){
      t.life-=dt;t.mesh.visible=t.life>0;if(!t.mesh.visible)continue;
      // A fast, short streak travels along the shot instead of a solid beam
      // joining shooter and target. Each pooled shot owns its fading material.
      const progress=1-t.life/t.duration,length=Math.min(t.distance,1.6),head=Math.min(t.distance,Math.max(length,t.distance*progress)),tail=Math.max(0,head-length);
      t.mesh.position.copy(t.start).addScaledVector(t.direction,(head+tail)*.5);t.mesh.scale.z=head-tail;
      t.mesh.material.opacity=t.opacity*Math.min(1,t.life/(t.duration*.55));
    }
    for (let i = 0; i < this.dustArray.length; i += 3) { this.dustArray[i] += dt * .15; if (this.dustArray[i] > 40) this.dustArray[i] = -40; }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.viewmodel.syncLighting(this.sun,this.ambient,this.camera,this.interior,this.flashlightOn&&!menu);
    this.viewmodel.update(sim,this.camera,dt,elapsed,!menu&&!sim.gameOver&&(sim.coopMode==='solo'||sim.player.hp>0));this.remoteView.update(this.remoteStates,elapsed,dt,this.camera);
    this.scene.updateMatrixWorld();this.renderer.info.reset();if(draw)this.post.render(dt,sim.player.hp);
  }
}
