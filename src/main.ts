import {CoopSession} from './network/coop-session';
import {CoopGameplayHUD} from './ui/coop-gameplay';
import './style.css';
import { NetworkManager } from './network/manager';
import { CoopUI } from './ui/coop';
import { spawnFor } from './network/protocol';
import type { StartData } from './network/protocol';
import './ui/variety.css';
import './ui/survival-theme.css';
import type { EnemyKind } from './game/enemies';
import type { WeaponId, Rarity } from './game/weapons';
import { Simulation } from './game/simulation';
import { Input } from './game/input';
import { Sound } from './game/audio';
import { GameScene } from './render/scene';
import { itemKeys } from './game/inventory';
import { findPath, wallDistance, floorHeight } from './game/world';
import type { Phase } from './game/cycle';
import { HUD } from './ui/hud';
import { loadSettings, saveSettings, QUALITY_LEVELS, QUALITY_LABELS } from './game/settings';
import type { Settings } from './game/settings';

const hud = new HUD();
let view: GameScene;
try { view = new GameScene(hud.canvas); }
catch (error) {
  console.error('Não foi possível inicializar o renderizador:', error);
  hud.el('load-error').hidden = false;
  hud.text('error-detail', 'Seu navegador precisa de WebGL 2 e aceleração de hardware para abrir LAST NIGHT. Ative a aceleração nas configurações e tente novamente.');
  hud.el('reload-page').onclick = () => location.reload();
  throw error;
}
let sim = new Simulation(), started = false, paused = false;
const sound = new Sound();
const network=new NetworkManager();
let coop:CoopSession|undefined;
const coopHUD=new CoopGameplayHUD(hud.root);
const coopUI=new CoopUI(network,hud.root,()=>sound.event('select'));
network.onStart=data=>startSession(data);
network.onEnded=()=>{if(started)menu(false);if(network.state==='error')coopUI.showError();};
hud.el('coop-online').onclick=()=>coopUI.open();
const settings=loadSettings();
let settingsReturn='menu';
const input = new Input(hud.canvas, () => { if(hud.settingsOpen){closeSettings();return;}if(hud.mapOpen){hud.map(false);input.clear();syncCursor(true);return;}if (hud.inventoryOpen) { hud.inventory(false); input.clear();syncCursor(true); } else togglePause(); }, toggleInventory,()=>{if(started&&!paused&&!hud.inventoryOpen&&!hud.mapOpen&&!sim.gameOver)togglePause();});
view.look=input.look;
function syncCursor(capture=false):void {input.enabled=started&&!sim.gameOver;input.blocked=!input.enabled||network.state==='loading'||paused||hud.inventoryOpen||hud.mapOpen||hud.settingsOpen||sim.pendingPerks.length>0;if(input.blocked)input.release();else if(capture)input.capture();}
function applySettings():void {
  sound.configure(settings);view.setQuality(settings.quality);view.renderer.shadowMap.enabled=settings.shadows&&settings.quality!=='low';view.shake=settings.shake;input.look.sensitivity=settings.sensitivity;view.fov=settings.fov;view.headBob=settings.headBob;
  hud.root.style.setProperty('--ui-scale',String(settings.uiScale));hud.root.classList.toggle('reduce-motion',!settings.shake);hud.captions=settings.captions;
  hud.text('quality',QUALITY_LABELS[settings.quality]);
  for(const key of ['master','music','effects','ambient','sensitivity','fov','headBob','uiScale'] as const){(hud.el(`setting-${key}`) as HTMLInputElement).value=String(settings[key]);hud.text(`value-${key}`,key==='sensitivity'?`${settings[key].toFixed(2)}×`:key==='fov'?`${settings[key]}°`:`${Math.round(settings[key]*(['uiScale','headBob'].includes(key)?100:1))}%`);}
  for(const key of ['shadows','shake','captions'] as const)(hud.el(`setting-${key}`) as HTMLInputElement).checked=settings[key];
  (hud.el('setting-quality') as HTMLSelectElement).value=settings.quality;saveSettings(settings);
}
function openSettings():void {settingsReturn=started?'pause':'menu';if(started&&!paused)togglePause();hud.settingsOpen=true;hud.el('settings-screen').hidden=false;hud.root.classList.add('paused');input.clear();}
function closeSettings():void {hud.settingsOpen=false;hud.el('settings-screen').hidden=true;if(settingsReturn==='menu')hud.root.classList.remove('paused');input.clear();}
function menu(disconnect=true):void {coop?.dispose();coop=undefined;coopHUD.update(undefined);started=false;if(disconnect)network.leave();view.remoteStates=[];view.remoteView.clear();hud.root.classList.remove('coop-playing');input.enabled=false;input.release();sound.reset();started=false;paused=false;sim=new Simulation();view.reset();hud.reset();hud.paused(false);hud.showMenu(true);hud.el('game-over').hidden=true;hud.el('settings-screen').hidden=true;hud.settingsOpen=false;input.clear();sound.suspend();}
function toggleMap():void {if(!started||paused||sim.gameOver||sim.pendingPerks.length)return;hud.map(!hud.mapOpen);input.clear();syncCursor(!hud.mapOpen);sound.event('inventory');}
function toggleInventory(): void {
  if (!started || paused || sim.gameOver || sim.pendingPerks.length || coop?.incapacitated) return;
  if(hud.mapOpen)hud.map(false);
  const opening=!hud.inventoryOpen;
  hud.inventory(opening); if(opening) hud.selectItem(sim.atBase?'wood':'ammo'); input.clear(); syncCursor(!opening);sound.event('inventory');
}
function togglePause(): void {
  hud.map(false);
  if (hud.inventoryOpen) { hud.inventory(false); input.clear(); }
  if (!started || sim.gameOver || sim.pendingPerks.length) return;
  paused = !paused; hud.paused(paused); input.clear(); accumulator = 0;
  if(paused&&network.inSession)network.updateLocal({x:sim.player.x,y:floorHeight(sim.player),z:sim.player.z,yaw:sim.player.angle,pitch:sim.player.pitch,vx:0,vz:0,locomotion:0});
  if (paused) sound.suspend(); else sound.start();syncCursor(!paused);
}
function start():void {network.leave();startSession();}
function startSession(session?:StartData): void {
  sound.reset();input.look.reset();
  const parameters=new URLSearchParams(location.search);
  const seed=session?.seed??(import.meta.env.DEV&&parameters.has('test')?Number(parameters.get('seed')??1977):crypto.getRandomValues(new Uint32Array(1))[0]);
  sim = new Simulation(undefined,seed);sim.firstPerson=true; sim.spawnBlockedByView = p => view.inSpawnView(p.x, p.z); started = true; paused = false; input.clear(); accumulator = 0; elapsed = 0; testSpeed = 1;
  if(session){Object.assign(sim.player,spawnFor(session.actors,network.localActor));sim.player.eyeY=floorHeight(sim.player)+1.72;coop=new CoopSession(network,sim,session);}
  hud.root.classList.toggle('coop-playing',!!session);
  hud.reset(); hud.inventory(false); view.reset(); hud.showMenu(false); hud.paused(false); hud.el('game-over').hidden = true;
  sound.start(); hud.notice(session?'Vocês chegaram juntos':'Um lugar para voltar',session?'Explore Santa Luz com seus amigos.':'Encontre suprimentos. Volte antes de escurecer.');
  hud.canvas.focus();syncCursor(true);
}
hud.el('capture-mouse').onclick=()=>{syncCursor(true);};
hud.el('start').onclick = start; hud.el('retry').onclick = start; hud.el('restart').onclick = start;
hud.el('inventory-close').onclick = toggleInventory;
hud.el('use-med').onclick = () => { if (started && !paused && !sim.gameOver) { hud.inventory(false);syncCursor(true); input.requestHeal(); } };
hud.el('use-rare').onclick = () => { if (started && !paused && !sim.gameOver&&!coop) sim.manage('rare', 'rare'); };
for (const item of itemKeys) for (const action of ['deposit', 'withdraw', 'discard'] as const) hud.el(`${action}-${item}`).onclick = () => { if (started && !paused && !sim.gameOver) { if(coop)coop.inventory(action,item);else sim.manage(action, item); sound.event('inventory'); } };
hud.el('pause').onclick = togglePause; hud.el('resume').onclick = togglePause;
hud.el('sound').onclick = () => { sound.toggle(); hud.el('sound').classList.toggle('muted', sound.muted); hud.el('sound').setAttribute('aria-label', sound.muted ? 'Ativar som' : 'Desativar som'); };
hud.el('quality').onclick=()=>{settings.quality=QUALITY_LEVELS[(QUALITY_LEVELS.indexOf(settings.quality)+1)%QUALITY_LEVELS.length];settings.shadows=settings.quality!=='low';applySettings();};
hud.el('bag-toggle').onclick=toggleInventory;hud.el('map-toggle').onclick=toggleMap;hud.el('map-close').onclick=toggleMap;
for(const id of ['menu-settings','pause-settings'])hud.el(id).onclick=openSettings;
hud.el('settings-close').onclick=closeSettings;
for(const id of ['pause-menu','end-menu'])hud.el(id).onclick=()=>menu();
hud.el('credits-open').onclick=()=>{hud.el('credits-screen').hidden=false;};hud.el('credits-close').onclick=()=>{hud.el('credits-screen').hidden=true;};
hud.variety.onSlot=slot=>{if(started&&!paused&&!sim.gameOver&&!sim.pendingPerks.length){if(coop)coop.action({kind:'switch',slot});sim.switchWeapon(slot);}};
hud.variety.onStore=slot=>{if(coop){coop.action({kind:'store',slot});return;}if(started&&!paused&&sim.storeWeapon(slot)){sound.event('inventory');hud.variety.update(sim);}};
hud.variety.onRetrieve=uid=>{if(coop){coop.action({kind:'retrieve',uid});return;}if(started&&!paused&&sim.retrieveWeapon(uid)){sound.event('switch');hud.variety.update(sim);}};
hud.variety.onPerk=id=>{if(started&&!paused&&sim.choosePerk(id)){input.clear();accumulator=0;hud.variety.update(sim);hud.canvas.focus();syncCursor(true);}};
hud.root.addEventListener('item-select',()=>sound.event('select'));
for(const key of Object.keys(settings) as (keyof Settings)[]){const control=hud.el(`setting-${key}`) as HTMLInputElement;control.oninput=()=>{Object.assign(settings,{[key]:control.type==='checkbox'?control.checked:key==='quality'?control.value:Number(control.value)});applySettings();};}
hud.el('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();hud.text('fullscreen-status','');}catch{hud.text('fullscreen-status','Tela cheia indisponível neste navegador.');}};
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&hud.settingsOpen&&(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)){closeSettings();return;}if(!started||paused||sim.gameOver||hud.settingsOpen||e.repeat)return;if(e.code==='KeyM'){e.preventDefault();toggleMap();}if(e.code==='KeyF'){view.flashlightOn=!view.flashlightOn;sound.event('select');if(settings.captions)hud.notice(view.flashlightOn?'Lanterna ligada':'Lanterna apagada','');}});
applySettings();
const inviteCode=new URLSearchParams(location.search).get('room');if(inviteCode)coopUI.open(inviteCode);
window.addEventListener('pagehide',()=>network.leave());
window.addEventListener('resize', () => view.resize());
window.addEventListener('blur', () => { if (started && !paused && !sim.gameOver) { hud.inventory(false); togglePause(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && started && !paused && !sim.gameOver) { hud.inventory(false); togglePause(); } });
hud.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (started && !paused) togglePause(); hud.el('load-error').hidden = false; hud.text('error-detail', 'A conexão com a GPU foi interrompida. Recarregue para iniciar uma nova expedição.'); });
hud.el('reload-page').onclick = () => location.reload();

let testSpeed = 1;
let last = performance.now(), accumulator = 0, elapsed = 0, frames = 0, statsTime = 0, fps = 0;
let lastBackdropRender=0;
let debugStats: HTMLDivElement | undefined;
const testEvents:string[]=[];
const FIXED_DT = 1 / 60;
function frame(now: number): void {
  const wallDt = (now - last) / 1000, dt = Math.min(wallDt, .1), simFrameDt = Math.min(wallDt, .25); last = now;
  frames++; statsTime += wallDt; if (statsTime >= 1) { fps = Math.round(frames / statsTime); frames = 0; statsTime = 0; if (debugStats) { const m = view.metrics(); debugStats.textContent = `${fps} FPS · ${view.renderer.info.render.calls} DRAW CALLS · ${view.quality.toUpperCase()} | ${Math.round(view.renderer.info.render.triangles / 1000)}k TRI · ${m.materials} MAT · ${m.geometryMB} MB`; } }
  syncCursor();
  if (started && (!paused||network.inSession) && !sim.gameOver && !sim.pendingPerks.length) {
    elapsed += simFrameDt * testSpeed; accumulator += simFrameDt * testSpeed;
    while (accumulator >= FIXED_DT && !sim.pendingPerks.length && !sim.gameOver) {
      const oldX=sim.player.x,oldZ=sim.player.z;
      const command=input.command();sim.update(FIXED_DT,coop?coop.beforeStep(FIXED_DT,command):command);coop?.afterStep(); accumulator -= FIXED_DT;
      if(network.inSession)network.updateLocal({x:sim.player.x,y:floorHeight(sim.player),z:sim.player.z,yaw:sim.player.angle,pitch:sim.player.pitch,vx:(sim.player.x-oldX)/FIXED_DT,vz:(sim.player.z-oldZ)/FIXED_DT,locomotion:sim.player.crouched?3:sim.player.running?2:sim.player.moving?1:0});
      for (const event of sim.events) {
        if(debugStats){testEvents.push(event.type);if(testEvents.length>128)testEvents.shift();}
        view.event(event); sound.event(event,sim.player);
        if (event.type === 'notice') hud.notice(event.text, event.sub);
        if (event.type === 'hit') hud.hit(event.zone==='HEAD'); if (event.type === 'hurt') hud.hurt(event.position?Math.atan2(event.position.x-sim.player.x,event.position.z-sim.player.z)-sim.player.angle:undefined);
      }
      sim.events.length = 0;
    }
    sound.music(dt,sim); sound.threats(dt,sim); sound.breathing(dt,sim); sound.ambience(sim.cycle.darkness); sound.step(dt, sim.player.moving, sim.player.running,sim.player.crouched);
    if (sim.gameOver) { hud.inventory(false); input.clear(); hud.end(sim);syncCursor(); sound.music(dt,sim,true); }
  } else accumulator = 0;
  if(!started)elapsed+=dt;
  if(sim.gameOver)sound.music(dt,sim,true);
  sound.sync(sim,started&&!sim.gameOver&&!sim.pendingPerks.length);
  // The opaque coop panel needs only an occasional backdrop refresh. Leave network timers independent.
  if(!started&&network.state!=='disconnected'&&now-lastBackdropRender<200){requestAnimationFrame(frame);return;}
  lastBackdropRender=now;
  if(coop){
    for(const {event,actor} of coop.effects.splice(0)){
      const remote=actor!==network.localActor;
      if(event.type==='hurt'&&remote)continue;
      view.event(event,remote);sound.event(event,sim.player,remote);
      if(event.type==='shot'&&remote&&event.primary!==false)view.remoteView.shot(actor);
      if(event.type==='hit'&&!remote)hud.hit(event.zone==='HEAD');
      if(event.type==='hurt')hud.hurt(event.position?Math.atan2(event.position.x-sim.player.x,event.position.z-sim.player.z)-sim.player.angle:undefined);
      if(event.type==='notice'&&(!remote||event.text==='Sobrevivente incapacitado'))hud.notice(event.text,event.sub);
    }
    coop.render();if(sim.gameOver&&hud.el('game-over').hidden){hud.end(sim);hud.text('end-title','Ninguém ficou de pé.');hud.text('end-reason','O grupo foi incapacitado. Volte ao menu para reunir os sobreviventes.');syncCursor();}
  }
  view.remoteStates=network.inSession?(coop?.decorate(network.remoteStates())??network.remoteStates()):[];
  view.render(sim, paused&&!network.inSession || sim.gameOver || sim.pendingPerks.length ? 0 : dt, elapsed, !started);
  hud.update(sim, paused || sim.gameOver ? 0 : dt, {x:innerWidth/2,y:innerHeight/2},(x,z,y)=>view.project(x,z,y),view.aimTarget);
  coopHUD.update(coop);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Explicit opt-in development hook for repeatable gameplay tests; absent in production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  debugStats = document.createElement('div'); debugStats.id = 'debug-stats'; debugStats.style.cssText = 'position:absolute;right:34px;top:190px;color:#d7e0bb;font:10px monospace;pointer-events:none;z-index:9;background:#152b2bcc;padding:6px'; document.body.append(debugStats);
  Object.assign(window, { __LAST_NIGHT__: {
    state: () => ({coop:coop?.debug(),network:{state:network.state,region:network.region,code:network.code,players:network.players,metrics:{...network.metrics},remotes:network.remoteStates(),avatars:view.remoteView.count,buffers:[...network.remotes.values()].map(b=>b.size)}, director:{state:sim.director.state,elapsed:sim.director.elapsed,transitions:sim.director.transitions,allowPressure:sim.director.allowPressure},escapeClues:[...sim.escapeClues],events:[...testEvents], camera:{fov:view.camera.fov,position:view.camera.position.toArray(),yaw:input.look.yaw,pitch:input.look.pitch,pointerLocked:input.captured},focus:sim.focus,player: { ...sim.player }, runSeed:sim.runSeed, portals:sim.portals, discoveredSites:[...sim.discoveredSites], activatedSites:[...sim.activatedSites], dormant:sim.dormantZombies.length, weaponStorage:sim.weaponStorage, weapon:sim.equipped, loadout:sim.loadout, groundWeapons:sim.groundWeapons, perks:[...sim.perks], pendingPerks:sim.pendingPerks, facilities:sim.facilities, worldEvent:sim.worldEvent, acids:sim.acids, switchTimer:sim.switchTimer, stats:{...sim.stats}, mapOpen:hud.mapOpen, settings:{...settings}, flashlight:view.flashlightOn, ui:{nodes:document.querySelectorAll('*').length,updates:hud.updates,mutations:hud.mutations}, ammo: sim.ammo, reserve: sim.reserve, phase: sim.phase, time: sim.time, day: sim.day, kills: sim.kills, corpses: sim.corpses.bodies, baseHP: sim.baseHP, inventory: { ...sim.inventory.items }, storage: { ...sim.storage.items }, weight: sim.inventory.weight, loot: sim.loot, barricades: sim.barricades, action: sim.action, horde: { budget: sim.horde.budget, spawned: sim.horde.spawned, complete: sim.horde.complete }, threat: sim.threat, phaseElapsed: sim.cycle.elapsed, inventoryOpen: hud.inventoryOpen, paused, gameOver: sim.gameOver, reloadTimer: sim.reloadTimer, shotTimer: sim.shotTimer, zombies: sim.zombies.filter(z => z.active).map(z => ({ id:z.id,x: z.x, z: z.z, hp: z.hp, kind:z.kind, windup:z.windup, spitTarget:z.spitTarget,screamTimer:z.screamTimer,screamCooldown:z.screamCooldown,siege:z.siege,patrol:z.patrol, zone:z.zone, wounds:z.wounds, hearing:z.hearing,heard:z.heard,awareness:z.awareness,lastSeen:z.lastSeen,memory:z.memory,reaction:z.reaction })), fps, calls: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles, audio: sound.metrics(), render: view.metrics() }),
    coopFixture: () => coop?.owner,
    project: (x: number, z: number, y=1.1) => view.project(x, z, y),
    combatStress: (count:number) => {
      sim.zombies=[];sim.corpses.bodies=[];sim.setPhase('dusk',0);const original={...sim.player};
      for(let i=0;i<count;i++) {const x=-7+(i%10)*1.6,z=13+Math.floor(i/10)*1.4;const walker=sim.spawn({x,z});if(!walker)continue;walker.angle=(i%4)*Math.PI/2;sim.player.x=x;sim.player.z=z-2;sim.player.angle=0;sim.anatomicalAim=true;sim.aimHeight=1.9;sim.aimDistance=2;sim.ammo=12;sim.shotTimer=0;sim.reloadTimer=0;sim.shoot();}
      Object.assign(sim.player,original);
    },
    setAmmo: (amount:number) => {sim.cancelReload();sim.ammo=Math.max(0,Math.min(sim.weapon.magazine,amount));},
    setLook: (yaw:number,pitch=0) => {input.look.yaw=yaw;input.look.pitch=Math.max(-1.49,Math.min(1.49,pitch));},
    pathTo: (x: number, z: number) => findPath(sim.player, { x, z }, sim.solidDefenses),
    clearShot: (x: number, z: number) => { const d = Math.hypot(x - sim.player.x, z - sim.player.z); return d > 0 && wallDistance(sim.player, { x: (x - sim.player.x) / d, z: (z - sim.player.z) / d }, d) >= d - .05; },
    setSpeed: (speed: number) => { testSpeed = Math.max(1, Math.min(12, speed)); },
    setPhase: (phase: Phase, elapsed = 0) => sim.setPhase(phase, elapsed),
    finishSpawning: () => { sim.horde.spawned = sim.horde.budget; },
    damageDefense: (id: string, amount: number) => { const b = sim.barricades.find(b => b.id === id); if (b) sim.damageBarricade(b, amount); },
    setInventory: (items: Partial<typeof sim.inventory.items>) => { for (const k of itemKeys) if (items[k] !== undefined) sim.inventory.items[k] = Math.max(0, Math.floor(items[k]!)); },
    setTime: (time: number) => { sim.time = time; },
    setPlayer: (x: number, z: number) => {sim.player.x=x;sim.player.z=z;},
    clearWalkers: () => { sim.zombies.forEach(z => { z.active = false; }); },
    spawn: (x: number, z: number, kind:EnemyKind='walker') => sim.spawn({ x, z },kind),
    dropWeapon: (type:WeaponId,x:number,z:number,rarity:Rarity='common') => sim.dropWeapon(type,{x,z},rarity),
    offerPerks: () => {sim.pendingPerks=['cold','opening','engineer'];},
    setDay: (day:number) => {sim.cycle.day=day;},
    spawnRoaming: () => sim.spawnRoaming(),
    setEventTimer: (time:number) => {sim.eventTimer=time;},
    setHealth: (hp: number) => { sim.player.hp = hp; },
    setBase: (hp: number) => { sim.baseHP = hp; },
  } });
}
