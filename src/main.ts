import {configureWorld} from './game/world-layout';
import {MerchantsView} from './render/merchants';
import {TradeHUD} from './ui/trade';
import {focusedMerchant} from './game/trading';
import {CloudController} from './services/cloud-controller';
import type {CloudRun} from './services/cloud-controller';
import {playerRecord} from './services/save-codec';
import {ConstructionHUD,BUILD_SLOTS} from './ui/construction';
import {structurePlacement,placeStructure,focusedStructure,manageStructure,MAX_LEVEL} from './game/construction';
import type {StructureKind,Structure} from './game/construction';
import {furniturePlacement,placeFurniture,relocateFurniture} from './game/relocation';
import type {FurnitureKind} from './game/relocation';
import {ChestHUD} from './ui/chests';
import {focusedChest,moveChest,reclaimChest} from './game/chests';
import {craft,reclaimBench,focusedBench,RECIPES,craftReason} from './game/crafting';
import type {MeleeId} from './game/crafting';
import {CoopSession} from './network/coop-session';
import {CoopWorld} from './network/coop-world';
import {isFood} from './game/nutrition';
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
import {LoadingScreen,paintLoading} from './ui/loading';
import './ui/field-hud.css';

const hud = new HUD();
const loading=new LoadingScreen();loading.show();
let renderingReady=false;
let loadingSession=false,scenePreparing=false,sessionPrepared=false,loadGeneration=0;
const startButton=hud.el('start') as HTMLButtonElement,onlineButton=hud.el('coop-online') as HTMLButtonElement;
const startLabel=startButton.innerHTML;
startButton.disabled=true;onlineButton.disabled=true;startButton.textContent='Preparando Santa Luz…';hud.el('menu').setAttribute('aria-busy','true');
let view: GameScene;
try { view = new GameScene(hud.canvas); }
catch (error) {
  loading.hide();
  console.error('Não foi possível inicializar o renderizador:', error);
  hud.el('load-error').hidden = false;
  hud.text('error-detail', 'Seu navegador precisa de WebGL 2 e aceleração de hardware para abrir LAST NIGHT. Ative a aceleração nas configurações e tente novamente.');
  hud.el('reload-page').onclick = () => location.reload();
  throw error;
}
let sim = new Simulation(), started = false, paused = false, openingLan=false;
const merchantsView=new MerchantsView();view.scene.add(merchantsView.root);
const sound = new Sound();
const network=new NetworkManager();
network.layoutVersion=import.meta.env.DEV&&new URLSearchParams(location.search).has('test')&&!new URLSearchParams(location.search).has('layout')?0:1;
let coop:CoopSession|undefined;
const coopHUD=new CoopGameplayHUD(hud.root);
// Reuse the already interpolated avatars; map refreshes never add network traffic.
hud.mapPeers=()=>view.remoteStates.flatMap(({snapshot,gameplay})=>snapshot?[{x:snapshot.x,z:snapshot.z,angle:snapshot.yaw,hp:gameplay?.hp??100}]:[]);
const chestHUD=new ChestHUD(hud.root);
const constructionHUD=new ConstructionHUD(hud.root);
const tradeHUD=new TradeHUD(hud.root);
const coopUI=new CoopUI(network,hud.root,()=>sound.event('select'));
// The lobby subscription renders immediately, so apply the loading gate afterwards.
hud.el('menu').inert=true;
network.onStart=async data=>{
 if(openingLan&&started&&!coop){
  const preserved=CoopWorld.fromSolo(sim,network.localActor);coop=new CoopSession(network,sim,data,preserved);
  if(cloud.current){const run=cloud.current;run.sim=sim;run.record=playerRecord(sim,network.localActor);await cloud.attach(run,coop,data);}
  hud.root.classList.add('coop-playing');hud.paused(paused);input.clear();syncCursor();return;
 }
 return startSession(data,await cloud.networkRun(data));
};
network.onEnded=()=>{if(started||loadingSession){if(cloud.current){if(loadingSession){loadingSession=false;loading.hide();}void cloud.end();}else menu(false);}if(network.state==='error')coopUI.showError();};
network.subscribe(()=>{if(loadingSession&&sessionPrepared&&network.state==='playing')finishSessionLoad();if(network.state==='playing'||network.state==='error')openingLan=false;updateLanPause();});
hud.el('coop-online').onclick=()=>{cloud.ephemeral();coopUI.open();};
const settings=loadSettings();
let settingsReturn='menu';
let placingItem:FurnitureKind|undefined;
let furnitureMove:{kind:FurnitureKind;id:number;revision:number}|undefined,furnitureRotation=0;
let buildPreview:{kind:StructureKind;rotation:0|1|2|3;level:number}|undefined;
let hammerSelection={kind:'wall' as StructureKind,rotation:0 as 0|1|2|3,level:0},wasHammerEquipped=false;
let hammerReturnSlot:0|1|2|3=1;
function clearPlacement(){placingItem=undefined;furnitureMove=undefined;buildPreview=undefined;}
function closeConstruction(capture=true){constructionHUD.close();input.clear();syncCursor(capture);}
function isPlacing(){return !!placingItem||!!buildPreview;}

function closeChest(capture=true){chestHUD.close();input.clear();syncCursor(capture);}
function closeTrade(capture=true){tradeHUD.close();input.clear();syncCursor(capture);}
tradeHUD.onClose=()=>closeTrade();
tradeHUD.onTrade=request=>{if(coop)coop.action({kind:'trade',trade:request});else sim.trade(request);};
function closeWorkbench(){hud.variety.craft.close();input.clear();syncCursor(true);}
function holsterHammer(){
 if(!sim.buildingHammerEquipped)return;
 const previous=hammerReturnSlot===2?1:hammerReturnSlot;
 const slot=previous<2&&!sim.loadout[previous as 0|1]?3:previous;
 if(coop)coop.action({kind:'switch',slot});sim.switchWeapon(slot);clearPlacement();input.clear();
}
function cancelPlacement(){if(!isPlacing()&&!sim.buildingHammerEquipped)return false;if(placingItem)clearPlacement();else holsterHammer();input.clear();syncCursor(true);return true;}
function syncBuildMode(){
 const equipped=sim.buildingHammerEquipped;
 if(equipped&&!wasHammerEquipped)hammerSelection.level=Math.min(MAX_LEVEL,Math.max(0,Math.floor(sim.groundY/3)));
 wasHammerEquipped=equipped;
 buildPreview=equipped&&started&&!input.blocked&&!placingItem&&!coop?.incapacitated?hammerSelection:undefined;
}
function equipMelee(melee:MeleeId){
 if(!started||paused||sim.gameOver||!sim.gear.owned.includes(melee))return;
 if(melee==='hammer'&&!sim.buildingHammerEquipped)hammerReturnSlot=sim.activeSlot;
 if(coop)coop.action({kind:'melee-equip',melee});else{sim.gear.melee=melee;sim.switchWeapon(2);}
 if(melee==='hammer'){hud.inventory(false);hud.variety.craft.close();input.clear();syncCursor(true);}
}

const input = new Input(hud.canvas, () => { if(tradeHUD.opened){closeTrade();return;}if(constructionHUD.open){closeConstruction();return;}if(chestHUD.open){closeChest();return;}if(hud.variety.craft.open){closeWorkbench();return;}if(hud.settingsOpen){closeSettings();return;}if(hud.mapOpen){hud.map(false);input.clear();syncCursor(true);return;}if (hud.inventoryOpen) { hud.inventory(false); input.clear();syncCursor(true); } else togglePause(); }, toggleInventory,()=>{if(started&&!paused&&!hud.inventoryOpen&&!hud.variety.craft.open&&!chestHUD.open&&!constructionHUD.open&&!tradeHUD.opened&&!hud.mapOpen&&!sim.gameOver)togglePause();});
view.look=input.look;
function syncCursor(capture=false):void {input.enabled=(started||loadingSession)&&!sim.gameOver;input.loading=loadingSession;input.blocked=loadingSession||!input.enabled||network.state==='loading'||paused||hud.inventoryOpen||hud.variety.craft.open||chestHUD.open||constructionHUD.open||hud.mapOpen||hud.settingsOpen||cloud.ui.opened||tradeHUD.opened||sim.pendingPerks.length>0;if(input.blocked&&!loadingSession)input.release();else if(capture)input.capture();}
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
function menu(disconnect=true):void {tradeHUD.close();openingLan=false;clearPlacement();constructionHUD.close();chestHUD.close();hud.variety.craft.close();loadGeneration++;loadingSession=false;sessionPrepared=false;loading.hide();coop?.dispose();coop=undefined;coopHUD.update(undefined);started=false;if(disconnect)network.leave();view.remoteStates=[];view.remoteView.clear();hud.root.classList.remove('coop-playing');input.enabled=false;input.loading=false;input.release();sound.reset();started=false;paused=false;sim=new Simulation();view.reset();hud.reset();hud.paused(false);hud.showMenu(true);hud.el('game-over').hidden=true;hud.el('settings-screen').hidden=true;hud.settingsOpen=false;input.clear();sound.suspend();}
function toggleMap():void {if(tradeHUD.opened)closeTrade(false);if(constructionHUD.open)closeConstruction();if(chestHUD.open)closeChest();if(hud.variety.craft.open)closeWorkbench();clearPlacement();if(!started||paused||sim.gameOver||sim.pendingPerks.length)return;hud.map(!hud.mapOpen);input.clear();syncCursor(!hud.mapOpen);sound.event('inventory');}
function toggleInventory(): void {
  if(tradeHUD.opened){closeTrade();return;}
  if(constructionHUD.open){closeConstruction();return;}if(chestHUD.open){closeChest();return;}if(hud.variety.craft.open){closeWorkbench();return;}clearPlacement();
  if (loadingSession || !started || paused || sim.gameOver || sim.pendingPerks.length || coop?.incapacitated) return;
  if(hud.mapOpen)hud.map(false);
  const opening=!hud.inventoryOpen;
  hud.inventory(opening); if(opening) hud.selectItem(sim.atBase?'wood':'ammo'); input.clear(); syncCursor(!opening);sound.event('inventory');
}
function togglePause(): void {
  tradeHUD.close();
  clearPlacement();constructionHUD.close();chestHUD.close();hud.variety.craft.close();
  if(loadingSession)return;
  hud.map(false);
  if (hud.inventoryOpen) { hud.inventory(false); input.clear(); }
  if (!started || sim.gameOver || sim.pendingPerks.length) return;
  paused = !paused; hud.paused(paused);updateLanPause(); input.clear(); accumulator = 0;
  if(paused&&network.inSession)network.updateLocal({x:sim.player.x,y:sim.groundY,z:sim.player.z,yaw:sim.player.angle,pitch:sim.player.pitch,vx:0,vz:0,locomotion:0});
  if (paused) sound.suspend(); else sound.start();syncCursor(!paused);
}
function start():void {if(loadingSession||scenePreparing)return;void (async()=>{if(cloud.current&&!await cloud.end())return;cloud.ephemeral();openingLan=false;network.leave();cloud.beginSolo(()=>startSession().catch(error=>{console.error('Não foi possível preparar a partida:',error);menu();hud.el('load-error').hidden=false;hud.text('error-detail','Não foi possível concluir o carregamento. Tente novamente.');}));})().catch(error=>{
  console.error('Não foi possível preparar a partida:',error);menu();loadingSession=false;
  hud.el('load-error').hidden=false;hud.text('error-detail','Não foi possível concluir o carregamento. Tente novamente.');
});}
function finishSessionLoad():void {
  loadingSession=false;sessionPrepared=false;input.loading=false;started=true;
  accumulator=0;last=performance.now();frames=0;statsTime=0;
  loading.hide();hud.canvas.focus();syncCursor();
}
async function startSession(session?:StartData,cloudRun?:CloudRun): Promise<void> {
  if(!renderingReady||loadingSession||scenePreparing)throw new Error('O jogo ainda está carregando.');
  const generation=++loadGeneration;loadingSession=true;sessionPrepared=false;paused=false;
  sound.reset();sound.start();input.look.reset();input.clear();
  // Preserve the click's user activation while controls remain blocked.
  input.enabled=true;input.loading=true;input.blocked=true;input.capture();
  loading.show('Preparando sua expedição…');
  await paintLoading();
  if(generation!==loadGeneration){loadingSession=false;return;}
  coop?.dispose();coop=undefined;
  const parameters=new URLSearchParams(location.search);
  const seed=cloudRun?.world.seed??session?.seed??(import.meta.env.DEV&&parameters.has('test')?Number(parameters.get('seed')??1977):crypto.getRandomValues(new Uint32Array(1))[0]);
  configureWorld(seed,cloudRun?.sim.layoutVersion??session?.layoutVersion??network.layoutVersion);
  sim = cloudRun?.sim??new Simulation(undefined,seed);sim.firstPerson=true; sim.spawnBlockedByView = p => view.inSpawnView(p.x, p.z); started = false; input.clear(); accumulator = 0; elapsed = 0; testSpeed = 1;
  if(session){let preserved:CoopWorld|undefined;if(cloudRun&&network.isHost){preserved=CoopWorld.fromSolo(sim,network.localActor);}else if(!cloudRun){Object.assign(sim.player,spawnFor(session.actors,network.localActor));sim.player.eyeY=floorHeight(sim.player)+1.72;}coop=new CoopSession(network,sim,session,preserved);}
  if(cloudRun){await cloud.attach(cloudRun,coop,session);input.look.yaw=sim.player.angle;input.look.pitch=sim.player.pitch;}
  hud.root.classList.toggle('coop-playing',!!session);
  hud.reset(); hud.inventory(false); view.reset(); hud.showMenu(false); hud.paused(false); hud.el('game-over').hidden = true;
  if(session)view.remoteStates=network.players.filter(p=>!p.isLocal).map(identity=>({identity,snapshot:{...spawnFor(session.actors,identity.actorNumber),y:0,yaw:Math.PI,pitch:0,vx:0,vz:0,locomotion:0,sequence:0,time:0}}));
  try{
    scenePreparing=true;
    merchantsView.update(sim.economy,sim.player,elapsed);
    await view.prepare(sim,(message,value)=>loading.update(message,value));
    loading.update('Preparando sons e interface…',90);
    await Promise.all([sound.prepare(),document.fonts.ready]);
    if(generation!==loadGeneration){loadingSession=false;return;}
    view.render(sim,0,0,false);
    hud.update(sim,0,{x:innerWidth/2,y:innerHeight/2},(x,z,y)=>view.project(x,z,y),view.aimTarget);
    if(sim.gameOver)hud.end(sim);
    hud.notice(session?'Vocês chegaram juntos':'Um lugar para voltar',session?'Explore Santa Luz com seus amigos.':'Encontre suprimentos. Volte antes de escurecer.');
    sessionPrepared=true;
    if(session)loading.update('Aguardando os outros sobreviventes…',100);else finishSessionLoad();
  }catch(error){loadingSession=false;input.loading=false;loading.hide();throw error;}
  finally{scenePreparing=false;}
}
function updateLanPause(){
 const button=hud.el('pause-lan') as HTMLButtonElement;
 const active=network.mode==='lan'&&network.state==='playing';
 button.hidden=!!coop;button.disabled=openingLan;button.textContent=openingLan?'Abrindo LAN…':'Abrir para LAN';
 hud.el('pause-lan-invite').hidden=!active;
 (hud.el('pause-lan-code') as HTMLInputElement).value=active?network.code:'';
 hud.text('pause-lan-status',active?`LAN aberta · ${network.players.length}/4 jogadores. A partida continua durante a pausa.`:openingLan?'Conectando a sinalização LAN…':network.mode==='lan'&&network.state==='error'?network.message:'');
}
coopUI.onCreateLocal=()=>{const selected=cloud.selected;if(selected)void cloud.networkRun({worldId:selected.id,seed:selected.seed,actors:[1],token:'local-cloud'}).then(run=>run&&startSession(undefined,run)).catch(error=>{cloud.ui.show('Não foi possível abrir o mundo');cloud.ui.feedback(error.message,true);});else start();};
hud.el('pause-lan').onclick=async()=>{
 if(!started||coop||openingLan||loadingSession||sim.gameOver)return;
 let name='Sobrevivente';try{name=localStorage.getItem('last-night-player-name')||name;}catch{/* Optional storage. */}
 if(!await cloud.save())return;openingLan=true;updateLanPause();network.openLan(name,sim.runSeed,sim.layoutVersion);
};
hud.el('pause-lan-copy').onclick=async()=>{
 const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('coop','lan');url.searchParams.set('room',network.code);if(new URLSearchParams(location.search).get('lan')==='server')url.searchParams.set('lan','server');
 try{await navigator.clipboard.writeText(url.href);hud.text('pause-lan-status','Convite copiado. Abra no outro dispositivo da mesma rede.');}catch{(hud.el('pause-lan-code') as HTMLInputElement).select();hud.text('pause-lan-status','Copie o código selecionado e compartilhe com seus amigos.');}
};
hud.el('capture-mouse').onclick=()=>{syncCursor(true);};
hud.el('start').onclick = start; hud.el('retry').onclick = start; hud.el('restart').onclick = start;
hud.el('inventory-close').onclick = toggleInventory;
hud.onConsume=item=>{
 if(!started||paused||sim.gameOver||coop?.incapacitated||!isFood(item))return;
 hud.inventory(false);input.clear();syncCursor(true);if(coop)coop.action({kind:'consume',item});else sim.beginConsume(item);
};
hud.el('use-med').onclick = () => { if (started && !paused && !sim.gameOver) { hud.inventory(false);syncCursor(true); input.requestHeal(); } };
hud.el('use-rare').onclick = () => { if (started && !paused && !sim.gameOver&&!coop) sim.manage('rare', 'rare'); };
for (const item of itemKeys) for (const action of ['discard'] as const) hud.el(`${action}-${item}`).onclick = () => { if (started && !paused && !sim.gameOver) { if(coop)coop.inventory(action,item);else sim.manage(action, item); sound.event('inventory'); } };
hud.el('pause').onclick = togglePause; hud.el('resume').onclick = togglePause;
hud.el('sound').onclick = () => { sound.toggle(); hud.el('sound').classList.toggle('muted', sound.muted); hud.el('sound').setAttribute('aria-label', sound.muted ? 'Ativar som' : 'Desativar som'); };
hud.el('quality').onclick=()=>{settings.quality=QUALITY_LEVELS[(QUALITY_LEVELS.indexOf(settings.quality)+1)%QUALITY_LEVELS.length];settings.shadows=settings.quality!=='low';applySettings();};
hud.el('bag-toggle').onclick=toggleInventory;hud.el('map-toggle').onclick=toggleMap;hud.el('map-close').onclick=toggleMap;
for(const id of ['menu-settings','pause-settings'])hud.el(id).onclick=openSettings;
hud.el('settings-close').onclick=closeSettings;
for(const id of ['pause-menu','end-menu'])hud.el(id).onclick=()=>{void cloud.end();};
hud.el('credits-open').onclick=()=>{hud.el('credits-screen').hidden=false;};hud.el('credits-close').onclick=()=>{hud.el('credits-screen').hidden=true;};
hud.variety.craft.onCraft=id=>{if(!started||paused||sim.gameOver)return;
 const recipe=RECIPES.find(r=>r.id===id);if(!recipe)return;const reason=craftReason(sim,recipe);if(reason){hud.notice('FABRICAÇÃO INDISPONÍVEL',reason);return;}
 if(id==='hammer')hammerReturnSlot=sim.activeSlot;
 if(coop)coop.action({kind:'craft',recipe:id});else craft(sim,id);
 if(id==='hammer'){hud.variety.craft.close();hud.inventory(false);input.clear();syncCursor(true);}
};
hud.variety.craft.onReclaim=()=>{if(!started||paused||sim.gameOver)return;if(coop)coop.action({kind:'reclaim-bench',table: hud.variety.craft.tableId});else reclaimBench(sim,hud.variety.craft.tableId);closeWorkbench();};
hud.variety.craft.onClose=closeWorkbench;
function startFurniture(kind:FurnitureKind,id?:number){
 if(!started||paused||sim.gameOver||coop?.incapacitated)return;
 const object=id===undefined?undefined:kind==='bench'?sim.crafting.tables.find(t=>t.id===id):sim.crafting.chests.find(c=>c.id===id);
 if(id!==undefined&&!object||id===undefined&&!sim.inventory.items[kind])return;
 clearPlacement();placingItem=kind;furnitureRotation=object?.angle??Math.round(sim.player.angle/(Math.PI/2))*(Math.PI/2);
 if(object)furnitureMove={kind,id:object.id,revision:kind==='bench'?sim.crafting.revision:('revision' in object?object.revision:0)};
 hud.inventory(false);hud.variety.craft.close();chestHUD.close();input.clear();syncCursor(true);
}
hud.variety.craft.onPlace=()=>startFurniture('bench');
hud.variety.craft.onRelocate=()=>startFurniture('bench',hud.variety.craft.tableId);
chestHUD.onRelocate=id=>startFurniture('chest',id);
constructionHUD.onClose=closeConstruction;
function structureAction(p:Structure,operation:'fortify'|'repair'|'toggle'|'dismantle'){
 if(coop)coop.action({kind:'manage-structure',id:p.id,revision:p.revision,operation});else manageStructure(sim,p.id,p.revision,operation);
 if(operation==='dismantle')closeConstruction();
}
constructionHUD.onAction=structureAction;
chestHUD.onClose=closeChest;
chestHUD.onMove=move=>{if(coop)coop.action({kind:'chest-move',move});else if(!moveChest(sim,move))hud.notice('TRANSFERÊNCIA INDISPONÍVEL','Confira o espaço e selecione a pilha novamente.');sound.event('inventory');};
chestHUD.onReclaim=chest=>{if(coop)coop.action({kind:'reclaim-chest',chest});else reclaimChest(sim,chest);closeChest();};
hud.el('place-chest').onclick=()=>startFurniture('chest');
input.onCancel=()=>{if(constructionHUD.open){closeConstruction(false);return true;}if(chestHUD.open){closeChest(false);return true;}if(hud.variety.craft.open){closeWorkbench();return true;}if(hud.inventoryOpen||hud.mapOpen||paused||hud.settingsOpen)return false;return cancelPlacement();};
input.onPrimary=()=>{
 if(!isPlacing())return false;sim.player.angle=input.look.yaw;sim.player.pitch=input.look.pitch;
 if(buildPreview){const p=structurePlacement(sim,buildPreview.kind,buildPreview.rotation,buildPreview.level);if(p.valid){if(coop)coop.action({kind:'place-structure',placement:p});else placeStructure(sim,p);}else hud.notice('ENCAIXE INDISPONÍVEL',p.reason);return true;}
 const kind=placingItem!,p=furniturePlacement(sim,kind,furnitureRotation,furnitureMove?.id);
 if(!p.valid){hud.notice('LOCAL INDISPONÍVEL',p.reason);return true;}
 let ok=true;
 if(furnitureMove){const move=furnitureMove;if(coop)coop.action({kind:'relocate-furniture',furniture:kind,id:move.id,revision:move.revision,placement:p});else ok=relocateFurniture(sim,kind,move.id,move.revision,p);}
 else if(coop)coop.action({kind:'place-furniture',furniture:kind,placement:p});else ok=placeFurniture(sim,kind,p);
 if(ok)clearPlacement();return true;
};
input.onSecondary=()=>buildPreview?input.onRotate():cancelPlacement();
input.onBuildSlot=slot=>{if(!buildPreview)return false;hammerSelection.kind=BUILD_SLOTS[slot];return true;};
input.onBuildWheel=delta=>{if(!buildPreview)return false;const index=BUILD_SLOTS.indexOf(hammerSelection.kind);hammerSelection.kind=BUILD_SLOTS[(index+delta+BUILD_SLOTS.length)%BUILD_SLOTS.length];return true;};
input.onHammer=()=>{if(placingItem)return false;if(sim.buildingHammerEquipped)holsterHammer();else if(sim.gear.owned.includes('hammer'))equipMelee('hammer');else return false;return true;};
constructionHUD.onSelect=kind=>{if(buildPreview)hammerSelection.kind=kind;};
constructionHUD.onHolster=()=>{holsterHammer();syncCursor(true);};
input.onRotate=()=>{if(!isPlacing())return false;if(buildPreview)buildPreview.rotation=((buildPreview.rotation+1)%4) as 0|1|2|3;else furnitureRotation+=Math.PI/2;return true;};
input.onLevel=delta=>{if(!isPlacing())return false;if(buildPreview)buildPreview.level=Math.max(0,Math.min(MAX_LEVEL,buildPreview.level+delta));return true;};
input.onInteract=()=>{
 if(placingItem)return true;sim.player.angle=input.look.yaw;sim.player.pitch=input.look.pitch;
 const merchant=focusedMerchant(sim);if(merchant){hud.inventory(false);hud.watch.close();tradeHUD.show(merchant.id);tradeHUD.update(sim);input.clear();syncCursor();sound.event('inventory');return true;}
 const chest=focusedChest(sim);if(chest!==undefined){hud.inventory(false);chestHUD.show(chest);input.clear();syncCursor();sound.event('inventory');return true;}
 const id=focusedBench(sim);if(id!==undefined){hud.inventory(false);hud.variety.craft.show(id);input.clear();syncCursor();return true;}
 const piece=focusedStructure(sim);if(!piece)return false;
 if(piece.kind==='door')structureAction(piece,'toggle');else{constructionHUD.show(piece);input.clear();syncCursor();}return true;
};
input.onManage=()=>{if(placingItem)return true;sim.player.angle=input.look.yaw;sim.player.pitch=input.look.pitch;const p=focusedStructure(sim);if(!p)return false;constructionHUD.show(p);input.clear();syncCursor();return true;};
hud.variety.craft.onMelee=equipMelee;hud.variety.onMelee=equipMelee;
hud.variety.onSlot=slot=>{if(started&&!paused&&!sim.gameOver&&!sim.pendingPerks.length){if(coop)coop.action({kind:'switch',slot});sim.switchWeapon(slot);}};
hud.variety.onStore=slot=>{if(coop){coop.action({kind:'store',slot});return;}if(started&&!paused&&sim.storeWeapon(slot)){sound.event('inventory');hud.variety.update(sim);}};
hud.variety.onRetrieve=uid=>{if(coop){coop.action({kind:'retrieve',uid});return;}if(started&&!paused&&sim.retrieveWeapon(uid)){sound.event('switch');hud.variety.update(sim);}};
hud.variety.onPerk=id=>{if(started&&!paused&&sim.choosePerk(id)){input.clear();accumulator=0;hud.variety.update(sim);hud.canvas.focus();syncCursor(true);}};
hud.root.addEventListener('item-select',()=>sound.event('select'));
for(const key of Object.keys(settings) as (keyof Settings)[]){const control=hud.el(`setting-${key}`) as HTMLInputElement;control.oninput=()=>{Object.assign(settings,{[key]:control.type==='checkbox'?control.checked:key==='quality'?control.value:Number(control.value)});applySettings();};}
hud.el('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();hud.text('fullscreen-status','');}catch{hud.text('fullscreen-status','Tela cheia indisponível neste navegador.');}};
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&hud.settingsOpen&&(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)){closeSettings();return;}if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;if(!started||paused||sim.gameOver||hud.settingsOpen||e.repeat)return;if(e.code==='KeyK'&&!input.blocked){e.preventDefault();hud.watch.toggle(sim);}if(e.code==='KeyM'){e.preventDefault();toggleMap();}if(e.code==='KeyF'){view.flashlightOn=!view.flashlightOn;sound.event('select');if(settings.captions)hud.notice(view.flashlightOn?'Lanterna ligada':'Lanterna apagada','');}});
const cloud=new CloudController(hud.root,network,{launch:run=>startSession(undefined,run),lobby:()=>coopUI.open(),exit:()=>menu(),source:()=>({player:sim,world:coop?.owner?.sim??sim,checkpoint:coop?.checkpoint,confirmed:coop?.localRecord}),authority:()=>!coop||!!coop.owner,running:()=>started,pause:()=>{if(started&&!paused&&!sim.gameOver)togglePause();input.release();},name:name=>{if(name)coopUI.setAccountName(name);else coopUI.clearAccountName();}});
coopUI.onCreateRoom=create=>cloud.beginCoop(create);
applySettings();
const inviteCode=new URLSearchParams(location.search).get('room');
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
  if(loadingSession||scenePreparing){last=now;requestAnimationFrame(frame);return;}
  const wallDt = (now - last) / 1000, dt = Math.min(wallDt, .1), simFrameDt = Math.min(wallDt, .25); last = now;
  frames++; statsTime += wallDt; if (statsTime >= 1) { fps = Math.round(frames / statsTime); frames = 0; statsTime = 0; if (debugStats) { const m = view.metrics(); debugStats.textContent = `${fps} FPS · ${view.renderer.info.render.calls} DRAW CALLS · ${view.quality.toUpperCase()} | ${Math.round(view.renderer.info.render.triangles / 1000)}k TRI · ${m.materials} MAT · ${m.geometryMB} MB`; } }
  syncCursor();syncBuildMode();
  if (started && (!paused||network.inSession) && !sim.gameOver && !sim.pendingPerks.length) {
    cloud.touch();
    elapsed += simFrameDt * testSpeed; accumulator += simFrameDt * testSpeed;
    while (accumulator >= FIXED_DT && !sim.pendingPerks.length && !sim.gameOver) {
      const oldX=sim.player.x,oldZ=sim.player.z;
      const command=input.command();if(isPlacing())Object.assign(command,{fire:false,trigger:false,ads:false,reload:false,dismantle:false});if(placingItem)Object.assign(command,{interact:false,heldInteract:false,slot:undefined});sim.update(FIXED_DT,coop?coop.beforeStep(FIXED_DT,command):command);coop?.afterStep(); accumulator -= FIXED_DT;
      if(network.inSession)network.updateLocal({x:sim.player.x,y:sim.groundY,z:sim.player.z,yaw:sim.player.angle,pitch:sim.player.pitch,vx:(sim.player.x-oldX)/FIXED_DT,vz:(sim.player.z-oldZ)/FIXED_DT,locomotion:sim.player.crouched?3:sim.player.running?2:sim.player.moving?1:0});
      for (const event of sim.events) {
        if(['pickup','rare-pickup','build','repair','night','dawn','death','consume-done','door'].includes(event.type))cloud.touch(true);
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
      if(['pickup','build','repair','night','dawn','death','consume-done'].includes(event.type))cloud.touch(true);
      const remote=actor!==network.localActor;
      if(event.type==='hurt'&&remote)continue;
      view.event(event,remote);sound.event(event,sim.player,remote);
      if((event.type==='melee'||event.type==='shot'&&event.primary!==false)&&remote)view.remoteView.shot(actor);
      if(remote&&(event.type==='build'||event.type==='repair'))view.remoteView.build(actor);
      if(event.type==='hit'&&!remote)hud.hit(event.zone==='HEAD');
      if(event.type==='hurt')hud.hurt(event.position?Math.atan2(event.position.x-sim.player.x,event.position.z-sim.player.z)-sim.player.angle:undefined);
      if(event.type==='notice'&&(!remote||event.text==='Sobrevivente incapacitado'))hud.notice(event.text,event.sub);
    }
    coop.render();if(sim.gameOver&&hud.el('game-over').hidden){hud.end(sim);hud.text('end-title','Ninguém ficou de pé.');hud.text('end-reason','O grupo foi incapacitado. Volte ao menu para reunir os sobreviventes.');syncCursor();}
  }
  view.remoteStates=network.inSession?(coop?.decorate(network.remoteStates())??network.remoteStates()):[];
  if(sim.gameOver||coop?.incapacitated){clearPlacement();if(chestHUD.open)closeChest();if(hud.variety.craft.open)closeWorkbench();if(constructionHUD.open)closeConstruction();}
  if(sim.gameOver||coop?.incapacitated){if(tradeHUD.opened)closeTrade(false);}
  tradeHUD.update(sim);
  chestHUD.update(sim);view.openChest=chestHUD.id;syncBuildMode();
  view.craftPreview=placingItem;view.buildPreview=buildPreview;view.furnitureMove=furnitureMove;view.furnitureRotation=furnitureRotation;
  const build=buildPreview?structurePlacement(sim,buildPreview.kind,buildPreview.rotation,buildPreview.level):undefined;
  const queryFocus=started&&!sim.gameOver&&(!paused||constructionHUD.open);
  const focusedPiece=queryFocus&&sim.crafting.structures.length?focusedStructure(sim):undefined;
  constructionHUD.update(sim,build,paused||!started||sim.gameOver,focusedPiece??null);
  view.buildPlacement=build;
  const furniture=placingItem?furniturePlacement(sim,placingItem,furnitureRotation,furnitureMove?.id):undefined;
  hud.text('placement-help',build?'Clique: construir · R / Direito: girar · PgUp / PgDn: andar · G: fortificar':`${furnitureMove?'REPOSICIONAR':'POSICIONAR'} ${placingItem==='chest'?'BAÚ':'MESA'} · ${furniture?.valid?'Clique: confirmar · R: girar · Direito / Esc: cancelar':furniture?.reason??''}`);
  const placementHidden=!isPlacing()||paused;if(hud.el('placement-help').hidden!==placementHidden)hud.el('placement-help').hidden=placementHidden;
  const showInteraction=queryFocus&&!tradeHUD.opened&&!hud.inventoryOpen&&!hud.variety.craft.open&&!placingItem&&!chestHUD.open&&!constructionHUD.open;
  const focusedTable=showInteraction&&sim.crafting.tables.length?focusedBench(sim):undefined,focusedStorage=showInteraction&&sim.crafting.chests.length?focusedChest(sim):undefined;
  const merchant=showInteraction?focusedMerchant(sim):undefined;
  const interactionHidden=!showInteraction||paused||(focusedTable===undefined&&focusedStorage===undefined&&!focusedPiece&&!merchant);
  if(hud.el('bench-interact').hidden!==interactionHidden)hud.el('bench-interact').hidden=interactionHidden;
  hud.text('bench-interact',merchant?`E · Negociar com ${merchant.name}`:focusedStorage!==undefined?'E · Abrir baú':focusedTable!==undefined?'E · Mesa inteligente':focusedPiece?.kind==='door'?`E · ${focusedPiece.open?'Fechar':'Abrir'} porta · G · Fortificar / reparar`:'E / G · Fortificar / reparar estrutura');
  merchantsView.root.visible=started;merchantsView.update(sim.economy,sim.player,elapsed);
  view.render(sim, paused&&!network.inSession || sim.gameOver || sim.pendingPerks.length ? 0 : dt, elapsed, !started);
  hud.update(sim, paused || sim.gameOver ? 0 : dt, {x:innerWidth/2,y:innerHeight/2},(x,z,y)=>view.project(x,z,y),view.aimTarget);
  coopHUD.update(coop);
  requestAnimationFrame(frame);
}
// Keep all rendering preparation out of the playable loop. There is no fixed
// delay or quality downgrade: controls unlock as soon as the GPU is ready.
void (async()=>{
  try {
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    merchantsView.update(sim.economy,sim.player,elapsed);
    await view.prepare(sim,(message,value)=>loading.update(message,value));
    view.render(sim,0,0,true);
    renderingReady=true;startButton.disabled=false;onlineButton.disabled=false;startButton.innerHTML=startLabel;
    hud.el('menu').inert=false;hud.el('menu').removeAttribute('aria-busy');
    loading.hide();
    last=performance.now();frames=0;statsTime=0;
    requestAnimationFrame(frame);
    await cloud.initialize();
    if(inviteCode&&!cloud.ui.opened)coopUI.open(inviteCode);
  } catch(error) {
    loading.hide();
    console.error('Não foi possível preparar o jogo:',error);
    hud.el('load-error').hidden=false;hud.text('error-detail','A preparação gráfica foi interrompida. Tente carregar o jogo novamente.');
  }
})();

// Explicit opt-in development hook for repeatable gameplay tests; absent in production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  debugStats = document.createElement('div'); debugStats.id = 'debug-stats'; debugStats.style.cssText = 'position:absolute;right:34px;top:190px;color:#d7e0bb;font:10px monospace;pointer-events:none;z-index:9;background:#152b2bcc;padding:6px'; document.body.append(debugStats);
  Object.assign(window, { __LAST_NIGHT__: {
    state: () => ({layoutVersion:sim.layoutVersion,coins:sim.coins,economy:sim.economy,tradeOpen:tradeHUD.opened,watchOpen:hud.watch.open,construction:{preview:buildPreview,furnitureMove,placingItem,furnitureRotation,focused:focusedStructure(sim),ground:sim.groundY},nutrition:{...sim.nutrition},consumption:sim.consumption,crafting:sim.crafting,gear:sim.gear,activeSlot:sim.activeSlot,capacity:sim.inventory.capacity,coop:coop?.debug(),network:{mode:network.mode,state:network.state,region:network.region,code:network.code,players:network.players,metrics:{...network.metrics},remotes:network.remoteStates(),avatars:view.remoteView.count,buffers:[...network.remotes.values()].map(b=>b.size)}, director:{state:sim.director.state,elapsed:sim.director.elapsed,transitions:sim.director.transitions,allowPressure:sim.director.allowPressure},escapeClues:[...sim.escapeClues],events:[...testEvents], camera:{fov:view.camera.fov,position:view.camera.position.toArray(),yaw:input.look.yaw,pitch:input.look.pitch,pointerLocked:input.captured},focus:sim.focus,player: { ...sim.player }, runSeed:sim.runSeed, portals:sim.portals, discoveredSites:[...sim.discoveredSites], activatedSites:[...sim.activatedSites], dormant:sim.dormantZombies.length, weaponStorage:sim.weaponStorage, weapon:sim.equipped, loadout:sim.loadout, groundWeapons:sim.groundWeapons, perks:[...sim.perks], pendingPerks:sim.pendingPerks, facilities:sim.facilities, worldEvent:sim.worldEvent, acids:sim.acids, switchTimer:sim.switchTimer, stats:{...sim.stats}, mapOpen:hud.mapOpen, settings:{...settings}, flashlight:view.flashlightOn, ui:{nodes:document.querySelectorAll('*').length,updates:hud.updates,mutations:hud.mutations}, ammo: sim.ammo, reserve: sim.reserve, phase: sim.phase, time: sim.time, day: sim.day, kills: sim.kills, corpses: sim.corpses.bodies, baseHP: sim.baseHP, inventory: { ...sim.inventory.items }, storage: { ...sim.storage.items }, weight: sim.inventory.weight, loot: sim.loot, barricades: sim.barricades, action: sim.action, horde: { budget: sim.horde.budget, spawned: sim.horde.spawned, complete: sim.horde.complete }, threat: sim.threat, phaseElapsed: sim.cycle.elapsed, inventoryOpen: hud.inventoryOpen, paused, gameOver: sim.gameOver, reloadTimer: sim.reloadTimer, shotTimer: sim.shotTimer, zombies: sim.zombies.filter(z => z.active).map(z => ({ id:z.id,x: z.x, z: z.z, hp: z.hp, kind:z.kind, windup:z.windup, spitTarget:z.spitTarget,screamTimer:z.screamTimer,screamCooldown:z.screamCooldown,siege:z.siege,patrol:z.patrol, zone:z.zone, wounds:z.wounds, hearing:z.hearing,heard:z.heard,awareness:z.awareness,lastSeen:z.lastSeen,memory:z.memory,reaction:z.reaction })), fps, calls: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles, audio: sound.metrics(), render: view.metrics() }),
    coopFixture: () => coop?.owner,
    simulationFixture: () => sim,
    infectedMotion: (id:number) => {const z=sim.zombies.find(z=>z.id===id);return z?{x:z.x,z:z.z,gait:z.gait}:null;},
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
    setNutrition: (hunger:number,thirst:number) => {sim.nutrition.hunger=Math.max(0,Math.min(100,hunger));sim.nutrition.thirst=Math.max(0,Math.min(100,thirst));},
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
