import {defenseMaxHP} from './defenses.ts';
import {createCraftWorld, MELEE, RECIPES, benchNearby, craft, absorb, harvest, infectedLoot, updateCraftWorld} from './crafting.ts';
import type {CraftGear, MeleeId} from './crafting.ts';
import {TensionDirector} from './tension.ts';
import { FPS } from './first-person.ts';
import { interactionFocus } from './interaction.ts';
import type { Focus } from './interaction.ts';
import { ENCOUNTERS, ALARMS } from './districts.ts';
import { bodyHit, CorpseManager } from './combat.ts';
import { createWeapon, weaponStats, WEAPONS, RARITIES, rollRarity, rollWeapon } from './weapons.ts';
import type { WeaponId, WeaponItem, GroundWeapon, Rarity } from './weapons.ts';
import { ENEMIES, ACID, nightEnemy } from './enemies.ts';
import type { EnemyKind } from './enemies.ts';
import { PERKS, perkOffer } from './perks.ts';
import type { PerkId } from './perks.ts';
import { FACILITIES, EVENT_POINTS, CACHE_STORIES, encounterKinds } from './expedition.ts';
import type { Facility, WorldEvent } from './expedition.ts';
import type { HitZone, Wound } from './combat.ts';
import { BASE, collides, distance, findPath, move, wallDistance, WORLD_LIMIT, impactMaterial, rayWorld, floorHeight, ceilingHeight, URBAN } from './world.ts';
import type { Vec2 } from './world.ts';
import { BALANCE } from './config.ts';
import { MatchCycle } from './cycle.ts';
import type { Phase } from './cycle.ts';
import { Inventory, ITEMS, itemKeys, emptyStock } from './inventory.ts';
import type { Item } from './inventory.ts';
import { createLoot, rollLoot, LOOT_POINTS } from './loot.ts';
import { createDefenses, obstacleDistance } from './defenses.ts';
import type { Barricade } from './defenses.ts';
import { Horde } from './horde.ts';
import { updateStamina } from './stamina.ts';
import { CITY_PORTALS, CITY_SITES } from './city.ts';
import type { Portal } from './city.ts';
import {cityEncounter,SCREAM,CITY_PACING} from './city-director.ts';
export type { Phase } from './cycle.ts';
export const PISTOL = BALANCE.pistol;
export interface InputCommand { moveX: number; moveZ: number; yaw?:number; pitch?:number; ads?:boolean; crouch?:boolean; aimX: number; aimZ: number; aimY?: number; fire: boolean; trigger?:boolean; slot?:0|1|2|3; run: boolean; reload: boolean; interact: boolean; heldInteract?: boolean; heal?: boolean; dismantle?: boolean }
export interface Walker extends Vec2 { id: number; kind:EnemyKind; hp: number; angle: number; attack: number; flash: number; gait: number; path: Vec2[]; replan: number; active: boolean; defense?: string; wounds: Wound[]; reaction: number; zone: HitZone; side: number; slow: number; heard?: Vec2; hearing: number; windup:number; winding:boolean; spitCooldown:number; spitTarget?:Vec2; screamTimer?:number; screamCooldown?:number; siege?:boolean; patrol?:Vec2; speedFactor?:number; hearingFactor?:number; lastSeen?:Vec2; memory?:number; awareness?:'idle'|'investigate'|'search'|'chase'; staggerCooldown?:number; searchStep?:number; chargeTarget?:Vec2;chargeTime?:number }
export type GameEvent = { type: 'shot'; from: Vec2; to: Vec2; hit: boolean; y?: number; fromY?:number; zone?: HitZone; material?: string; last?: boolean; weapon?:WeaponId; primary?:boolean; suppressed?:boolean } | { type: 'melee' | 'death' | 'hit' | 'barricade-hit' | 'barricade-break' | 'build' | 'repair' | 'spit-ready' | 'spit' | 'heavy-step' | 'enemy-call' | 'enemy-attack' | 'door' | 'glass' | 'scream-ready' | 'scream' | 'suspense'; position: Vec2; zone?: HitZone; enemy?:EnemyKind; entity?:number;damage?:number;remainingHP?:number } | { type: 'reload-out' | 'reload-in' | 'reload-slide' | 'reload-done' | 'alarm' | 'switch' | 'rare-pickup'; position?: Vec2; weapon?:WeaponId } | { type:'reload' | 'empty'; weapon?:WeaponId; duration?:number } | {type:'hurt';position?:Vec2} | { type: 'pickup' | 'search' | 'heal' | 'healed' | 'warning' | 'night' | 'dawn' | 'countdown' } | { type: 'notice'; text: string; sub: string };
export interface Action { kind: 'search' | 'heal' | 'build' | 'repair' | 'dismantle' | 'base' | 'facility' | 'silence' | 'event' | 'portal' | 'board'; target: string; elapsed: number; duration: number; origin: Vec2 }
export interface Acid extends Vec2 {id:number;from:Vec2;age:number;tick:number}
export class Simulation {
  foundationMode=false;
  /** Solo stays unchanged. Replicas predict presentation; actor runs only survivor rules. */
  coopMode:'solo'|'replica'|'actor'='solo';
  onBeforeShot?:()=>void;
  coopTargets:Simulation['player'][]=[];
  onCoopDamage?:(player:Simulation['player'],damage:number,position?:Vec2)=>void;
  stats = { seconds: 0, headshots: 0, loot: 0, damage: 0, nights: 0, specials:0, weapons:0, bestRarity:'common' as Rarity, repairs:0 };
  firstPerson=false; focus:Focus|null=null;
  player = {pitch:0,ads:false,crouched:false,eyeY:FPS.eyeHeight+.22,aimKick:0,bloom:0, x: 1, z: 7, hp: BALANCE.player.hp, stamina: 100, exhausted:false, staminaDelay:0, angle: Math.PI, moving: false, running: false, invulnerable: 0 };
  encounters=new Set<number>(); alarms=new Set<number>(); alarmTimer=0; vehicleAlarms=new Set<string>(); alarmPosition?:Vec2;
  corpses = new CorpseManager(); aimHeight = 1.3; aimDistance = 1; anatomicalAim = false; noiseTimer = 0;
  director=new TensionDirector(); escapeClues=new Set<string>();generatorPulse=0; private usedRoaming=new Set<number>();
  zombies: Walker[] = []; loot = createLoot(); barricades = createDefenses();
  inventory = new Inventory(); storage = new Inventory(Infinity); cycle: MatchCycle; horde = new Horde();
  events: GameEvent[] = []; action: Action | null = null;
  kills = 0; baseHP = BALANCE.base.hp;
  loadout:[WeaponItem|null,WeaponItem|null]=[null,createWeapon('pistol',0)]; activeSlot:0|1|2|3=1;
  crafting=createCraftWorld();gear:CraftGear={melee:'fists',owned:['fists'],armor:0,armorTier:0};packCrafted=false;
  private emptyHands=createWeapon('pistol',0);
  groundWeapons:GroundWeapon[]=[]; nextWeaponId=1; equipmentRolled=new Set<string>(); discoveredWeapons=new Set<number>([0]);
  portals:(Portal&Barricade)[]=CITY_PORTALS.map(p=>({...p,label:p.kind==='window'?'Janela':'Porta',built:true,flash:0}));
  discoveredSites=new Set<string>(); activatedSites=new Set<string>(); weaponStorage:WeaponItem[]=[];
  dormantZombies:Walker[]=[]; cityTimer=0; roamTimer=65; outsideTimer=20;
  perks=new Set<PerkId>(); pendingPerks:PerkId[]=[]; builderUsed=false; openingReady=false;
  facilities:Facility[]=FACILITIES.map(f=>({...f,state:'ready'})); worldEvent?:WorldEvent; eventTimer=110; nextEventId=0; acids:Acid[]=[]; nextAcidId=0; seenEnemies=new Set<EnemyKind>();
  reloadTimer = 0; reloadDuration=PISTOL.reload; switchTimer=0; shotTimer = 0; recoil = 0; gameOver = false; private fireHeld=false;
  spawnBlockedByView: ((p: Vec2) => boolean) | undefined;
  spawnTimer = BALANCE.horde.dayInterval; nextId = 0; seed = 1977; contentSeed=1977; readonly runSeed:number;
  constructor(durations = BALANCE.cycle, seed=1977) {
    this.runSeed=seed>>>0;this.seed=this.runSeed;this.contentSeed=(this.runSeed^0x9e3779b9)>>>0;
    this.cycle = new MatchCycle(durations);
    for (const key of ['ammo', 'med', 'wood', 'scrap'] as const) this.inventory.add(key, BALANCE.inventory[key]);
    for (const p of [{ x: -8, z: 12 }, { x: 10, z: 19 }, { x: -17, z: -16 }, { x: 15, z: -10 }]) this.spawn(p);
    // Guaranteed starter supplies stay active. A few optional caches vary between expeditions.
    for(const l of this.loot)if(!l.guaranteed&&this.contentRandom()<.18)l.searched=true;
  }
  random(): number { this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0; return this.seed / 4294967296; }
  contentRandom=():number=>{this.contentSeed=(Math.imul(1664525,this.contentSeed)+1013904223)>>>0;return this.contentSeed/4294967296;};
  get meleeMode(){return this.activeSlot>=2;}
  get meleeId():MeleeId{return this.activeSlot===3?'fists':this.gear.melee;}
  get equipped():WeaponItem {return (this.activeSlot<2?this.loadout[this.activeSlot as 0|1]:null)??this.emptyHands;}
  get weapon(){const gun=weaponStats(this.equipped);if(!this.meleeMode)return gun;const m=MELEE[this.meleeId];return {...gun,name:m.name,damage:m.damage,range:m.reach,falloff:m.reach,cooldown:m.cooldown,recoil:.15,kick:.12,pellets:1,spread:0,noise:7,move:1,magazine:0,automatic:false};}
  get ammo():number{return this.meleeMode?0:this.equipped.magazine;}
  set ammo(n:number){this.equipped.magazine=Math.max(0,Math.floor(n));}
  get maxHP():number{return BALANCE.player.hp+(this.perks.has('tough')?15:0);}
  get buildWood():number{return BALANCE.barricade.wood-(this.perks.has('builder')&&!this.builderUsed?2:0);}
  get repairScrap():number{return this.perks.has('engineer')?0:BALANCE.barricade.repairScrap;}
  get day(): number { return this.cycle.day; }
  get time(): number { return this.cycle.time; }
  set time(time: number) {
    const d = this.cycle.durations;
    this.setPhase(time < d.day ? 'day' : time < d.day + d.dusk ? 'dusk' : time < this.cycle.daylight ? 'preparation' : 'night', time < d.day ? time : time < d.day + d.dusk ? time - d.day : time < this.cycle.daylight ? time - d.day - d.dusk : time - this.cycle.daylight);
  }
  get phase(): Phase { return this.cycle.phase; }
  get untilNight(): number { return this.cycle.untilNight; }
  get reserve(): number { return this.meleeMode?0:this.inventory.items[this.weapon.ammo]; }
  set reserve(value: number) { this.inventory.items[this.weapon.ammo] = Math.max(0, Math.floor(value)); }
  get activeWalkers(): number { return this.zombies.filter(z => z.active).length; }
  get threat(): number { return this.activeWalkers + (this.phase === 'night' ? Math.max(0, this.horde.budget - this.horde.spawned) : 0); }
  get atBase(): boolean { return this.player.x > -5 && this.player.x < 7 && this.player.z > .35 && this.player.z < 12; }
  private craftCollisionSource?:typeof this.crafting;private craftCollisionRevision=-1;private craftCollisionTables=-1;private craftCollisions:Barricade[]=[];
  get solidDefenses():Barricade[] {
    if(this.craftCollisionSource!==this.crafting||this.craftCollisionRevision!==this.crafting.revision||this.craftCollisionTables!==this.crafting.tables.length){
      this.craftCollisionSource=this.crafting;this.craftCollisionRevision=this.crafting.revision;this.craftCollisionTables=this.crafting.tables.length;
      this.craftCollisions=[...this.crafting.trees.filter(t=>t.hp>0).map(t=>({id:`tree-${t.id}`,label:'Árvore',x:t.x,z:t.z,w:.58,d:.58,h:3.8,hp:1e6,built:true,flash:0})),...this.crafting.chests.map(t=>({id:`chest-${t.id}`,label:'Baú',x:t.x,z:t.z,w:1.3,d:1.3,h:.95,hp:1e6,built:true,flash:0})),...this.crafting.tables.map(t=>({id:`table-${t.id}`,label:'Mesa inteligente',x:t.x,z:t.z,w:1.5,d:1.5,h:1.1,hp:t.hp,built:true,flash:0}))];
    }
    return [...this.barricades.filter(b=>b.hp>0&&!b.open&&(!b.trap||b.trap==='wire')),...this.portals.filter(p=>p.state!=='open'&&p.hp>0),...this.craftCollisions];
  }
  get nearbyPortal(){if(this.firstPerson)return this.focus?.kind==='portal'?this.portals.find(v=>v.id===this.focus!.id):undefined;return this.portals.find(p=>distance(p,this.player)<2.5&&this.canReach(p,p.id));}
  get nearbyLoot() {if(this.firstPerson)return this.focus?.kind==='loot'?this.loot.find(v=>v.id===this.focus!.id):undefined; return this.loot.find(s => (!s.searched || itemKeys.some(k => s.contents[k] > 0)) && distance(s, this.player) < BALANCE.interaction.range && this.canReach(s)); }
  get nearbyDefense() {if(this.firstPerson)return this.focus?.kind==='defense'?this.barricades.find(v=>v.id===this.focus!.id):undefined; return this.barricades.find(b => obstacleDistance(this.player, b) < 2.1 && this.canReach({ x: Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, this.player.x)), z: b.z })); }
  get nearbyWeapon(){if(this.firstPerson)return this.focus?.kind==='weapon'?this.groundWeapons.find(v=>String(v.item.uid)===this.focus!.id):undefined;return this.groundWeapons.filter(g=>distance(g,this.player)<2.4&&this.canReach(g)).sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0];}
  get nearbyFacility(){if(this.firstPerson)return this.focus?.kind==='facility'?this.facilities.find(v=>v.id===this.focus!.id):undefined;return this.facilities.find(f=>f.state==='ready'&&distance(f,this.player)<2.4&&this.canReach(f));}
  get nearbyAlarm():boolean{if(this.firstPerson)return this.focus?.kind==='alarm';return this.alarmTimer>0&&!!this.alarmPosition&&distance(this.player,this.alarmPosition)<2.5&&this.canReach(this.alarmPosition);}
  get nearbyEvent(){if(this.firstPerson)return this.focus?.kind==='event'?this.worldEvent:undefined;const e=this.worldEvent;return e?.kind==='cache'&&!e.triggered&&distance(e,this.player)<2.4&&this.canReach(e)?e:undefined;}
  private canReach(p: Vec2,ignore=''): boolean { const d = distance(p, this.player); return d < .01 || wallDistance(this.player, { x: (p.x - this.player.x) / d, z: (p.z - this.player.z) / d }, d,this.portals.filter(p=>p.id!==ignore&&p.state!=='open'&&p.hp>0)) >= d - .05; }
  setPhase(phase: Phase, elapsed = 0): void { this.cycle.seek(phase, elapsed); if (phase === 'night') {this.horde.start(this.day);for(const z of this.zombies)if(z.active&&distance(z,BASE)<65)z.siege=true;} else this.horde.active = false; }
  notice(text: string, sub: string): void { this.events.push({ type: 'notice', text, sub }); }
  spawn(p?: Vec2, kind:EnemyKind='walker'): Walker | undefined {
    if (this.activeWalkers >= BALANCE.walker.capacity || this.activeWalkers+this.corpses.bodies.length>=BALANCE.combat.corpseLimit) return;
    let location = p;
    if (!location) {
      // Map edges beyond the gameplay camera's immediate view; never spawn beside the player.
      const candidates: Vec2[] = [];
      for (let edge = 0; edge < 4; edge++) for (const offset of [-33, -12, 12, 34]) candidates.push(edge === 0 ? { x: offset, z: -37 } : edge === 1 ? { x: 37, z: offset } : edge === 2 ? { x: offset, z: 37 } : { x: -37, z: offset });
      const start = Math.floor(this.random() * candidates.length);
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[(start + i) % candidates.length];
        if (!collides(candidate, .65) && distance(candidate, this.player) > BALANCE.horde.spawnDistance && !this.spawnBlockedByView?.(candidate) && !this.zombies.some(z => z.active && distance(z, candidate) < 1.5)) { location = candidate; break; }
      }
    }
    if(location&&(this.loot.some(l=>distance(l,location!)<.85)||this.facilities.some(f=>distance(f,location!)<1)))return;
    if (!location || Math.abs(location.x) > WORLD_LIMIT || Math.abs(location.z)>WORLD_LIMIT || collides(location, ENEMIES[kind].radius, this.solidDefenses)) return;
    const z: Walker = { ...location, id: this.nextId++, kind, hp: ENEMIES[kind].hp, angle: 0, attack: .6, flash: 0, gait: this.random() * 10, path: [], replan: 0, active: true, wounds: [], reaction: 0, zone: 'TORSO', side: 1, slow: 0, hearing: 0, windup:0,winding:false,spitCooldown:2,siege:this.phase==='night'&&distance(location,BASE)<65,speedFactor:kind==='walker'?.9+(this.nextId%5)*.06:1,hearingFactor:kind==='walker'?.9+(this.nextId%4)*.08:1 };
    const free = this.zombies.findIndex(z => !z.active);
    if (free >= 0) this.zombies[free] = z; else this.zombies.push(z);
    return z;
  }
  reload(): void {
    if(this.meleeMode)return;
    if (this.gameOver || this.switchTimer || this.reloadTimer || this.ammo >= this.weapon.magazine || !this.reserve) return;
    this.reloadDuration=this.weapon.reload*(this.perks.has('pressure')&&this.player.hp<this.maxHP*.35?.75:1);
    this.reloadTimer = this.reloadDuration; this.events.push({ type: 'reload', weapon:this.equipped.type, duration:this.reloadDuration });
  }
  switchWeapon(slot:0|1|2|3):void {
    if(this.gameOver||(slot<2&&!this.loadout[slot as 0|1])||slot===this.activeSlot||this.switchTimer)return;
    this.cancelReload();this.action=null;this.activeSlot=slot;this.switchTimer=.32;this.recoil=0;this.events.push({type:'switch',weapon:this.equipped.type});
  }
  private equipmentPosition(center:Vec2):Vec2 {
    const candidates=[{x:center.x+1.35,z:center.z},{x:center.x-1.35,z:center.z},{x:center.x,z:center.z+1.35},{x:center.x,z:center.z-1.35}];
    return candidates.filter(p=>!collides(p,.6)&&distance(p,this.player)>.8&&this.canReach(p)).sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0]??{...center};
  }
  dropWeapon(type:WeaponId,position:Vec2,rarity:Rarity='common',source='Equipamento abandonado'):GroundWeapon|undefined {
    if(this.groundWeapons.length>=48)return;
    const g={...position,item:createWeapon(type,this.nextWeaponId++,rarity,this.contentRandom),source};this.groundWeapons.push(g);return g;
  }
  equipGround(uid:number):boolean {
    if(this.gameOver||this.switchTimer)return false;
    const index=this.groundWeapons.findIndex(g=>g.item.uid===uid&&distance(g,this.player)<2.4&&this.canReach(g));if(index<0)return false;
    const ground=this.groundWeapons[index],slot=WEAPONS[ground.item.type].slot,old=this.loadout[slot];
    this.groundWeapons.splice(index,1);if(old)this.groundWeapons.push({...ground,item:old,source:'Arma substituída'});
    this.cancelReload();this.action=null;this.loadout[slot]=ground.item;this.activeSlot=slot;this.switchTimer=.32;
    if(!this.discoveredWeapons.has(uid)){this.discoveredWeapons.add(uid);this.stats.weapons++;}
    if(RARITIES[ground.item.rarity].rank>RARITIES[this.stats.bestRarity].rank)this.stats.bestRarity=ground.item.rarity;
    this.events.push({type:RARITIES[ground.item.rarity].rank>=2?'rare-pickup':'switch',weapon:ground.item.type});return true;
  }
  choosePerk(id:PerkId):boolean {
    if(this.gameOver||!this.pendingPerks.includes(id)||this.perks.has(id))return false;
    this.perks.add(id);this.pendingPerks=[];
    if(id==='tough')this.player.hp=Math.min(this.maxHP,this.player.hp+15);
    if(id==='pack')this.inventory.capacity+=3;
    this.notice(PERKS[id].name.toUpperCase(),PERKS[id].hint);this.events.push({type:'rare-pickup'});return true;
  }
  shoot(): void {
    if (this.firstPerson&&this.player.running)return;
    if (this.gameOver || this.shotTimer > 1e-8 || this.switchTimer > 0) return;
    const weapon=this.weapon;
    if(this.reloadTimer>0){if(weapon.reloadStyle==='shell'&&this.ammo>0)this.cancelReload();else return;}
    if (this.meleeMode&&this.player.stamina<MELEE[this.meleeId].stamina){this.notice('SEM FÔLEGO','Recupere o fôlego antes de atacar.');return;}
    if (!this.meleeMode&&!this.ammo) { this.events.push({ type: 'empty', weapon:this.equipped.type }); this.shotTimer = .4; this.reload(); return; }
    this.onBeforeShot?.();
    if(this.meleeMode){this.player.stamina-=MELEE[this.meleeId].stamina;this.player.staminaDelay=1.4;this.events.push({type:'melee',position:{...this.player}});}else this.ammo--; this.shotTimer += weapon.cooldown; this.recoil = weapon.recoil*(this.perks.has('steady')?.85:1);
    if(this.meleeMode&&this.coopMode!=='replica'&&harvest(this)){this.noise(this.player,9);return;}
    const slope=this.anatomicalAim ? (this.aimHeight-1.3)/this.aimDistance : 0;
    const impacts=new Map<Walker,{damage:number;zone:HitZone;side:number;y:number;dir:Vec2}>();
    for(let pellet=0;pellet<weapon.pellets;pellet++){
      // Stratified pellets keep the cone legible without giving each trigger an arbitrary damage lottery.
      const spread=weapon.pellets>1?(pellet/(weapon.pellets-1)-.5)+(this.random()-.5)*.08:this.random()-.5;
      const angle=this.player.angle+spread*weapon.spread*(this.firstPerson?(this.player.ads?.35:1)*(this.player.crouched?.8:1)*(1+this.player.bloom*12)*(this.player.moving?1.4:1):1)*(this.perks.has('steady')?.85:1)*(this.player.running?4:1);
      const dir={x:Math.sin(angle),z:Math.cos(angle)};
      const fps=this.firstPerson,originY=fps?this.player.eyeY:1.3;
      const shotPitch=this.player.pitch+this.player.aimKick+(weapon.pellets>1?Math.sin(pellet*2.4)*weapon.spread*.28:0);
      const shotSlope=fps?Math.tan(Math.max(-FPS.pitchLimit,Math.min(FPS.pitchLimit,shotPitch))):slope;
      const cos=1/Math.sqrt(1+shotSlope*shotSlope),ray={x:dir.x*cos,y:shotSlope*cos,z:dir.z*cos};
      const origin={x:this.player.x,y:originY,z:this.player.z};
      const barriers=this.solidDefenses.map(p=>({...p,h:'kind' in p?p.kind==='window'?2.4:2.8:p.h??1.4}));
      let limit=fps?rayWorld(origin,ray,weapon.range,barriers)*cos:wallDistance(this.player,dir,weapon.range,this.portals.filter(p=>p.state!=='open'&&p.hp>0));
      if(!fps&&slope<0)limit=Math.min(limit,1.3/-slope);
      let hits=(this.coopMode==='replica'?[]:this.zombies).filter(z=>z.active).map(z=>({z,hit:bodyHit(this.player,dir,shotSlope,z,limit,originY)})).filter(v=>v.hit).sort((a,b)=>a.hit!.distance-b.hit!.distance).slice(0,this.equipped.affix==='piercing'?2:1);
      let blockedPoint:{x:number;y:number;z:number}|undefined;
      let muzzle={x:origin.x+dir.x*.28-dir.z*.13,y:originY-.16,z:origin.z+dir.z*.28+dir.x*.13};
      if(fps){
        const offset={x:muzzle.x-origin.x,y:muzzle.y-origin.y,z:muzzle.z-origin.z},md=Math.hypot(offset.x,offset.y,offset.z);
        const clearance=rayWorld(origin,{x:offset.x/md,y:offset.y/md,z:offset.z/md},md,barriers);
        if(clearance<md-.01){blockedPoint={x:origin.x+offset.x/md*clearance,y:origin.y+offset.y/md*clearance,z:origin.z+offset.z/md*clearance};muzzle=origin;limit=0;hits=[];}
        else {
          const at=hits.at(-1)?.hit?.distance??limit,target={x:origin.x+dir.x*at,y:originY+shotSlope*at,z:origin.z+dir.z*at};
          const d=Math.hypot(target.x-muzzle.x,target.y-muzzle.y,target.z-muzzle.z),v={x:(target.x-muzzle.x)/Math.max(.001,d),y:(target.y-muzzle.y)/Math.max(.001,d),z:(target.z-muzzle.z)/Math.max(.001,d)};
          const obstruction=rayWorld(muzzle,v,d,barriers);
          if(obstruction<d-.04){hits=[];limit=Math.max(0,obstruction*cos);blockedPoint={x:muzzle.x+v.x*obstruction,y:muzzle.y+v.y*obstruction,z:muzzle.z+v.z*obstruction};}
        }
      }
      const glass=this.portals.find(p=>p.kind==='window'&&p.state!=='open'&&Math.abs(this.player.x+dir.x*limit-p.x)<=p.w/2+.04&&Math.abs(this.player.z+dir.z*limit-p.z)<=p.d/2+.04&&originY+shotSlope*limit<=2.4);
      for(let n=0;n<hits.length;n++){
        const {z,hit}=hits[n];const h=hit!;
        const falloff=h.distance<=weapon.falloff?1:Math.max(.25,1-(h.distance-weapon.falloff)/(weapon.range-weapon.falloff)*.75);
        const damage=weapon.damage*BALANCE.combat.multipliers[h.zone]*falloff*(n?.55:1)*(!this.meleeMode&&this.ammo===0&&this.perks.has('last')?1.2:1)*(h.zone==='HEAD'&&this.equipped.affix==='precise'?1.1:1);
        const prior=impacts.get(z);impacts.set(z,{damage:damage+(prior?.damage??0),zone:prior?.zone==='HEAD'?'HEAD':h.zone,side:h.side,y:h.y,dir});
      }
      const first=hits[0]?.hit,last=hits.at(-1)?.hit,nearest=last?.distance??limit;
      if(this.coopMode!=='replica'&&glass&&glass.state==='closed'&&!hits.length){glass.state='open';glass.hp=0;this.noise(glass,35);this.events.push({type:'glass',position:glass});}
      const end=blockedPoint??{x:this.player.x+dir.x*nearest,z:this.player.z+dir.z*nearest};
      if(this.coopMode==='solo'&&pellet===0&&!first){const car=URBAN.vehicles.find(v=>['police','hatch'].includes(v.kind)&&Math.abs(v.x-end.x)<=v.w/2+.12&&Math.abs(v.z-end.z)<=v.d/2+.12);if(car&&!this.vehicleAlarms.has(car.id)){this.vehicleAlarms.add(car.id);this.startAlarm(car,16);}}
      if(!this.meleeMode)this.events.push({type:'shot',from:fps?{x:muzzle.x,z:muzzle.z}:{x:this.player.x+dir.x*.75,z:this.player.z+dir.z*.75},fromY:fps?muzzle.y:1.3,to:end,hit:!!first,y:blockedPoint?.y??last?.y??originY+shotSlope*nearest,zone:first?.zone,material:nearest>=weapon.range*cos-.01?'air':impactMaterial(end,this.solidDefenses),last:this.ammo===0,weapon:this.equipped.type,primary:pellet===0,suppressed:this.equipped.affix==='quiet'});
    }
    if(this.firstPerson){this.player.aimKick=Math.min(.12,this.player.aimKick+weapon.recoil*FPS.recoilScale);this.player.bloom=Math.min(.09,this.player.bloom+weapon.recoil*.012);}
    if(this.coopMode!=='replica')this.noise(this.player,weapon.noise);
    for(const [victim,impact] of impacts){
      const {zone,side,y,dir}=impact;const damage=impact.damage*(victim.kind==='armored'&&zone==='TORSO'?.5:1);
      const enemy=ENEMIES[victim.kind];
      if(zone==='HEAD')this.stats.headshots++;
      if(zone==='HEAD'&&this.perks.has('cold'))this.player.stamina=Math.min(100,this.player.stamina+8);
      victim.hp -= damage; victim.flash = .14; const stagger=(victim.staggerCooldown??0)<=0; victim.reaction=stagger?BALANCE.combat.stagger*enemy.stagger*(weapon.pellets>1&&damage>70?2:1):Math.min(victim.reaction,.05); if(stagger)victim.staggerCooldown=.85; victim.zone=zone; victim.side=side;
      if(zone==='HEAD'&&this.openingReady&&this.perks.has('opening')){victim.reaction*=2;this.openingReady=false;}
      if(victim.chargeTarget&&victim.windup>0&&(damage>=20||zone==='HEAD')){victim.chargeTarget=undefined;victim.chargeTime=0;victim.windup=0;victim.spitCooldown=5;}
      if(victim.kind==='spitter'&&victim.spitTarget&&(damage>=20||zone==='HEAD')){victim.spitTarget=undefined;victim.windup=0;victim.spitCooldown=2;}
      if(victim.kind==='screamer'&&victim.screamTimer&&(damage>=SCREAM.interrupt||zone==='HEAD')){victim.screamTimer=0;victim.screamCooldown=5;}
      if(zone==='LEGS'&&stagger) victim.slow=damage>=18?BALANCE.combat.legSlow:.25;
      victim.wounds.push({zone,side,y}); if(victim.wounds.length>BALANCE.combat.woundLimit) victim.wounds.shift();
      const kick=weapon.kick*enemy.knockback*(stagger?1:.1);move(victim, dir.x*kick, dir.z*kick, enemy.radius, this.solidDefenses);
      this.events.push({ type: 'hit', position: { x: victim.x, z: victim.z }, zone,enemy:victim.kind,entity:victim.id,damage:Math.min(damage,Math.max(0,victim.hp+damage)),remainingHP:Math.max(0,victim.hp) });
      if(victim.hp<=0)this.killInfected(victim,dir,zone);
    }
  }
  private killInfected(z:Walker,dir:Vec2,zone:HitZone='TORSO'):void {
    if(!z.active)return;z.active=false;z.path=[];this.corpses.add(z,dir,z.id%3);infectedLoot(this,z);this.kills++;if(z.kind!=='walker')this.stats.specials++;
    if(z.kind==='bloater'&&this.acids.length<ACID.capacity){this.acids.push({id:this.nextAcidId++,x:z.x,z:z.z,from:{x:z.x,z:z.z},age:0,tick:ACID.flight});this.events.push({type:'spit',position:{x:z.x,z:z.z},enemy:z.kind});}
    this.events.push({type:'death',position:{x:z.x,z:z.z},zone,enemy:z.kind,entity:z.id,remainingHP:0});
  }
  noise(position: Vec2,radius:number):void {
    this.director.hear(radius);
    // Stable uncertainty per listener, separate from loot/combat random streams.
    for(const z of this.zombies) if(z.active) {
      const d=distance(z,position),dir={x:(position.x-z.x)/(d||1),z:(position.z-z.z)/(d||1)};
      const blocked=wallDistance(z,dir,d,this.solidDefenses)<d-.1;
      if(d>=radius*(z.hearingFactor??1)*(blocked?.65:1))continue;
      const spread=Math.min(3.5,d*.12)*(blocked?1.3:1),angle=(z.id*2.399+radius*.31);
      const guess={x:position.x+Math.cos(angle)*spread,z:position.z+Math.sin(angle)*spread};
      z.heard=!collides(guess,.5,this.solidDefenses)?guess:{...position};
      z.hearing=BALANCE.noise.memory;z.searchStep=0;if(z.awareness!=='chase')z.awareness='investigate';z.replan=0;
    }
  }
  cancelReload():void { this.reloadTimer=0; }
  startAlarm(position:Vec2,seconds:number):void {if(this.coopMode!=='solo')return;this.alarmPosition={...position};this.alarmTimer=seconds;this.noise(position,BALANCE.noise.alarm);this.events.push({type:'alarm',position});}
  private rewardCache(position:Vec2,area:string):void {
    const contents=emptyStock();
    if(area==='hospital'){contents.med=3;contents.rare=1;}
    else {
      const g=this.dropWeapon(rollWeapon(area,this.contentRandom),this.equipmentPosition(position),rollRarity(this.contentRandom,true),'Reserva selada');
      if(g)contents[WEAPONS[g.item.type].ammo]=g.item.type==='shotgun'?8:24;
      if(area==='gas'){contents.scrap=8;contents.wood=6;}else contents.ammo+=12;
    }
    for(const k of itemKeys){const n=this.inventory.add(k,contents[k]);this.stats.loot+=n;contents[k]-=n;}
    if(itemKeys.some(k=>contents[k]))this.loot.push({...position,id:`reward-${this.nextWeaponId}-${this.nextEventId}`,area:'outside',label:'Suprimentos restantes',searched:true,contents,lastFound:null});
    this.events.push({type:'rare-pickup'});this.notice('RESERVA ABERTA','Suprimentos recolhidos. Confira o equipamento antes de sair.');
  }
  private hurt(damage:number,position?:Vec2):void {
    if(this.player.invulnerable>0)return;
    damage=absorb(this,damage);this.stats.damage+=Math.min(this.player.hp,damage);this.player.hp=Math.max(0,this.player.hp-damage);this.player.invulnerable=.55;this.action=null;this.cancelReload();this.events.push({type:'hurt',position});
  }
  private updateWorld(dt:number):void {
    for(const acid of this.acids){acid.age+=dt;acid.tick-=dt;if(acid.age>=ACID.flight&&acid.tick<=0){acid.tick=ACID.interval;const d=distance(acid,this.player);if(d<ACID.radius&&(d<.01||wallDistance(acid,{x:(this.player.x-acid.x)/d,z:(this.player.z-acid.z)/d},d,this.solidDefenses)>=d-.05))this.hurt(ACID.damage,acid.from);}}
    this.acids=this.acids.filter(a=>a.age<ACID.flight+ACID.lifetime);
    if(this.worldEvent){this.worldEvent.life-=dt;if(this.worldEvent.life<=0)this.worldEvent=undefined;}
    if(this.phase!=='day')return;
    this.eventTimer-=dt;if(this.eventTimer>0||this.worldEvent||this.player.hp<30||this.director.state==='RELIEF')return;
    const candidates=EVENT_POINTS.filter(p=>distance(p,this.player)>30&&!this.spawnBlockedByView?.(p)&&!collides(p,.7));
    if(!candidates.length){this.eventTimer=12;return;}
    const point=candidates[Math.floor(this.contentRandom()*candidates.length)],r=this.contentRandom();
    const kind=r<.5?'cache':r<.75?'alarm':'roaming';
    const stories=CACHE_STORIES.filter(p=>distance(p,this.player)>30&&!this.spawnBlockedByView?.(p)&&!(p.flavor==='house'&&this.discoveredSites.has('home-4')));
    const story=kind==='cache'?stories[Math.floor(this.contentRandom()*stories.length)]:undefined;
    this.worldEvent={...(story??point),id:this.nextEventId++,kind,name:story?.name??(kind==='cache'?'Suprimentos abandonados':kind==='alarm'?'Alarme distante':'Movimento nas ruas'),life:140,triggered:false,flavor:story?.flavor};
    if(story?.flavor==='house'){const door=this.portals.find(p=>p.id==='home-4-front')!;door.state='barred';door.hp=180;}

    this.eventTimer=160+this.contentRandom()*90;
    if(kind==='alarm')this.startAlarm(point,18);
    if(kind==='roaming'){const first=this.nextId;const count=this.spawnRoaming();const lead=this.zombies.find(z=>z.id===first);if(!count){this.worldEvent=undefined;this.eventTimer=20;return;}if(lead){this.worldEvent.x=lead.x;this.worldEvent.z=lead.z;}}
    this.notice(this.worldEvent.name.toUpperCase(),this.atBase?'Rádio do abrigo: há um sinal temporário marcado no mapa.':'Um sinal distante foi marcado no mapa; avalie o tempo de retorno.');
  }

  resource(item: Item): number { return this.inventory.items[item]; }
  private pay(cost: Partial<Record<Item, number>>): boolean {
    if (itemKeys.some(k => this.resource(k) < (cost[k] ?? 0))) return false;
    for (const k of itemKeys) { const amount = cost[k] ?? 0, carried = Math.min(amount, this.inventory.items[k]); this.inventory.take(k, carried);  }
    return true;
  }
  manage(kind: 'deposit' | 'withdraw' | 'discard' | 'rare', item: Item): void {
    if (this.gameOver || this.action) return;
    if (kind === 'discard') { this.inventory.take(item, Math.min(ITEMS[item].step, this.inventory.items[item])); return; }
    if (!this.atBase) return;

    if (kind === 'rare' && this.baseHP < BALANCE.base.hp && this.pay({ rare: 1 })) { this.baseHP = Math.min(BALANCE.base.hp, this.baseHP + BALANCE.base.rareRepair); this.events.push({ type: 'repair', position: BASE }); this.notice('REFORÇO DE EMERGÊNCIA', `Abrigo +${BALANCE.base.rareRepair} HP`); }
  }
  // Legacy requests cannot access an invisible shelter stash. Use a placed chest.
  storeWeapon(_slot:0|1):boolean { return false; }
  retrieveWeapon(_uid:number):boolean { return false; }
  grantItems(item:Item,amount:number,position:Vec2=this.player):void {
    const accepted=this.inventory.add(item,amount),left=amount-accepted;
    if(left)this.loot.push({id:`reward-${this.crafting.next++}`,x:position.x,z:position.z,area:'outside',label:'Suprimentos recuperados',searched:true,lastFound:null,contents:{...emptyStock(),[item]:left}});
  }
  private begin(kind: Action['kind'], target: string, duration: number): void {
    this.cancelReload();
    this.action = { kind, target, duration, elapsed: 0, origin: { x: this.player.x, z: this.player.z } };
    if(kind==='search' && (target.includes('locker')||target==='gallery-store')) this.noise(this.player,BALANCE.noise.search);
    if (kind === 'search' || kind === 'heal') this.events.push({ type: kind });
  }
  private interact(input: InputCommand, dt: number): void {
    if (this.action && (this.player.moving || input.fire || input.reload || distance(this.action.origin, this.player) > .25 || (this.action.kind === 'repair' && !input.heldInteract && !input.interact))) this.action = null;
    if (!this.action && !this.player.moving && !input.fire && !this.reloadTimer) {
      if (input.heal && this.player.hp < this.maxHP && this.inventory.items.med > 0) this.begin('heal', '', BALANCE.interaction.heal);
      else if(input.dismantle&&this.nearbyPortal?.state==='open'){
        if(this.inventory.items.wood>=2)this.begin('board',this.nearbyPortal.id,1.8);else this.notice('FALTAM TÁBUAS','Leve 2 madeiras para barricar esta entrada.');
      }
      else if (input.dismantle && this.nearbyDefense?.hp) this.begin('dismantle', this.nearbyDefense.id, BALANCE.interaction.dismantle);
      else if (input.interact || input.heldInteract) {
        const loot = this.nearbyLoot, b = this.nearbyDefense;
        if(input.interact&&this.nearbyAlarm)this.begin('silence','',1.4);
        else if(input.interact&&this.nearbyPortal){const p=this.nearbyPortal;if(p.state==='open'){if(p.kind==='door'&&obstacleDistance(this.player,p)>.5&&!this.zombies.some(z=>z.active&&obstacleDistance(z,p)<ENEMIES[z.kind].radius+.05)){p.state='closed';p.hp=120;this.noise(p,8);this.events.push({type:'door',position:p});}}else this.begin('portal',p.id,p.kind==='window'?.6:p.state==='barred'?(p.heavy?5:3.5):.7);}
        else if(input.interact&&this.nearbyWeapon)this.equipGround(this.nearbyWeapon.item.uid);
        else if(input.interact&&this.nearbyFacility){const f=this.nearbyFacility;
          if(f.requires&&this.facilities.find(p=>p.id===f.requires)?.state!=='powered')this.notice('ALIMENTAÇÃO DESLIGADA','Ative o gerador deste local para abrir o estoque.');
          else this.begin('facility',f.id,f.kind==='generator'?2.5:2);
        }
        else if(input.interact&&this.nearbyEvent)this.begin('event',String(this.nearbyEvent.id),1.8);
        else if (loot && input.interact) this.begin('search', loot.id, loot.searched ? .4 : BALANCE.interaction.search);
        else if (b) {
          if(b.id==='bed-gate'&&b.hp>0&&input.interact){if(!b.open||obstacleDistance(this.player,b)>.6&&!this.zombies.some(z=>z.active&&obstacleDistance(z,b)<.7)&&!this.coopTargets.some(p=>obstacleDistance(p,b)<.6)){b.open=!b.open;this.zombies.forEach(z=>z.replan=0);this.events.push({type:'door',position:b});}return;}

          if (b.hp <= 0 && input.interact) {
            if(RECIPES.some(r=>r.module===b.id)&&!benchNearby(this)){this.notice('MESA NECESSÁRIA','Posicione uma mesa próxima para construir este módulo.');return;}
            if (obstacleDistance(this.player, b) < .6 || this.zombies.some(z => z.active && obstacleDistance(z, b) < .6)) this.notice('PONTO OCUPADO', 'Afaste-se um pouco da marcação para construir.');
            else if (this.resource('wood') >= this.buildWood && this.resource('scrap') >= BALANCE.barricade.scrap) this.begin('build', b.id, BALANCE.interaction.build);
            else this.notice('FALTAM MATERIAIS', `${this.buildWood} madeira + ${BALANCE.barricade.scrap} sucata · explore as caixas próximas`);
          } else if (b.hp > 0 && b.hp < defenseMaxHP(b) && this.resource('wood') >= BALANCE.barricade.repairWood && this.resource('scrap') >= this.repairScrap) this.begin('repair', b.id, BALANCE.interaction.repair);
        } else if (input.interact && distance(this.player, BASE) < 2.7 && (!this.firstPerson||this.focus?.kind==='base') && this.baseHP < BALANCE.base.hp && this.resource('scrap') >= BALANCE.base.repairCost) this.begin('base', '', BALANCE.base.repairTime);
      }
    }
    const action = this.action; if (!action) return;
    action.elapsed += dt; if (action.elapsed < action.duration) return;
    this.action = null;
    if (action.kind === 'heal') {
      if (this.inventory.take('med', 1)) { this.player.hp = Math.min(this.maxHP, this.player.hp + BALANCE.interaction.healAmount);if(this.perks.has('medic'))this.player.stamina=100; this.events.push({ type: 'healed' }); }
    } else if (action.kind === 'search') {
      const loot = this.loot.find(l => l.id === action.target);if(!loot)return;
      if (!loot.searched) {
        loot.contents = loot.area === 'base' || loot.id === 'base-wood' ? emptyStock() : rollLoot(loot.area, () => this.random());
        if(loot.restocked)for(const key of itemKeys)loot.contents[key]=Math.floor(loot.contents[key]*.5);
        if(loot.valuable){loot.contents[loot.area==='hospital'?'med':loot.area==='gas'?'scrap':'rifleAmmo']+=loot.area==='hospital'?2:loot.area==='gas'?6:12;}
        for (const k of itemKeys) loot.contents[k] += loot.guaranteed?.[k] ?? 0;
        if(loot.area!=='base'&&loot.id!=='base-wood'){
          if(['police','gas','house'].includes(loot.area))loot.contents.shells+=1+Math.floor(this.contentRandom()*3);
          if(loot.area==='police')loot.contents.rifleAmmo+=6+Math.floor(this.contentRandom()*9);
          if(this.perks.has('scavenger')&&this.contentRandom()<.2)loot.contents[this.weapon.ammo]+=this.weapon.ammo==='shells'?4:12;
          if(!this.equipmentRolled.has(loot.id)){
            this.equipmentRolled.add(loot.id);
            if(loot.area==='police'||this.contentRandom()<(loot.area==='gas'?.45:loot.area==='house'?.3:.12)){
              const g=this.dropWeapon(rollWeapon(loot.area,this.contentRandom),this.equipmentPosition(loot),rollRarity(this.contentRandom,!!loot.valuable||loot.id.includes('cache')),loot.label);
              if(g&&RARITIES[g.item.rarity].rank>=2)this.events.push({type:'rare-pickup'});
            }
          }
        }
        loot.searched = true;
      }
      const found: string[] = []; loot.lastFound = null;
      for (const k of itemKeys) { const accepted = this.inventory.add(k, loot.contents[k]); loot.contents[k] -= accepted; this.stats.loot += accepted; if (accepted) { loot.lastFound ??= k; found.push(`+${accepted} ${ITEMS[k].label.toLowerCase()}`); } }
      const left = itemKeys.some(k => loot.contents[k]);
      this.events.push({ type: 'pickup' });
      this.notice(found.length ? found.join(' · ') : 'MOCHILA CHEIA', left ? 'Ainda há itens aqui. TAB para administrar espaço.' : 'Guardado na mochila. TAB para inventário · H para bandagem.');
    } else if(action.kind==='portal'||action.kind==='board'){
      const p=this.portals.find(p=>p.id===action.target);if(!p)return;
      if(action.kind==='board'){if(obstacleDistance(this.player,p)>.5&&!this.zombies.some(z=>z.active&&obstacleDistance(z,p)<ENEMIES[z.kind].radius+.05)&&this.inventory.take('wood',2)){p.state='barred';p.hp=180;this.noise(p,12);}}
      else{this.noise(p,p.kind==='window'?35:p.state==='barred'?42:8);const kind=p.kind==='window'?'glass':p.state==='barred'?'barricade-break':'door';p.state='open';p.hp=0;this.events.push({type:kind,position:p});}
      this.zombies.forEach(z=>z.replan=0);
    } else if(action.kind==='silence'){this.alarmTimer=0;this.notice('ALARME DESLIGADO','Os infectados ainda investigam o último ruído.');
    } else if(action.kind==='event'){
      if(this.worldEvent?.id===Number(action.target)&&!this.worldEvent.triggered){this.worldEvent.triggered=true;this.rewardCache(this.worldEvent,CACHE_STORIES.find(c=>c.flavor===this.worldEvent?.flavor)?.area??'outside');}
    } else if(action.kind==='facility'){
      const f=this.facilities.find(f=>f.id===action.target);if(!f||f.state!=='ready')return;
      f.state=f.kind==='generator'?'powered':'opened';
      if(f.kind==='generator'){this.noise(f,28);this.generatorPulse=4;this.notice('GERADOR ATIVADO',this.coopMode==='solo'?'Depósito energizado. O motor continua atraindo quem estiver por perto.':'Depósito energizado.');}
      else {this.rewardCache(f,f.area);if(f.id==='terminal-radio'&&this.coopMode==='solo'){this.escapeClues.add('frequency');this.notice('CANAL 07 · SETOR ZERO','Uma rota de evacuação ainda pode existir. Procure o checkpoint a sudeste.');}if(f.kind==='trunk'&&this.coopMode==='solo'){this.startAlarm(f,18);this.notice('ALARME DISPARADO','Recolha o equipamento ou segure a posição para desligar.');}}
    } else if (action.kind === 'base') {
      if (this.pay({ scrap: BALANCE.base.repairCost })) { this.baseHP = Math.min(BALANCE.base.hp, this.baseHP + BALANCE.base.repairAmount); this.events.push({ type: 'repair', position: BASE }); }
    } else {
      const b = this.barricades.find(b => b.id === action.target)!;
      if(action.kind==='build'){const recipe=RECIPES.find(r=>r.module===b.id);if(recipe){craft(this,recipe.id);return;}}
      if (action.kind === 'build' && b.hp <= 0 && obstacleDistance(this.player, b) >= .6 && !this.zombies.some(z => z.active && obstacleDistance(z, b) < .6) && this.pay({ wood: this.buildWood, scrap: BALANCE.barricade.scrap })) {
        if(this.perks.has('builder'))this.builderUsed=true;b.hp = BALANCE.barricade.hp; b.built = true;b.open=false; this.events.push({ type: 'build', position: b }); this.notice('BARRICADA ERGUIDA', 'Segure E para reparar · X para desmontar e liberar passagem.');
      } else if (action.kind === 'repair' && b.hp > 0 && b.hp < defenseMaxHP(b) && this.pay({ wood: BALANCE.barricade.repairWood, scrap: this.repairScrap })) {
        this.stats.repairs++;b.hp = Math.min(defenseMaxHP(b), b.hp + BALANCE.barricade.repairAmount); this.events.push({ type: 'repair', position: b });
      } else if (action.kind === 'dismantle' && b.hp > 0) {
        this.grantItems('wood', Math.floor(BALANCE.barricade.wood * .5 * b.hp / defenseMaxHP(b))); b.hp = 0; b.built = false; this.events.push({ type: 'barricade-break', position: b });
      }
      this.zombies.forEach(z => { z.replan = 0; });
    }
  }
  damageBarricade(b: Barricade, amount: number): void {
    if(b.id.startsWith('table-')){const t=this.crafting.tables.find(t=>`table-${t.id}`===b.id);if(!t||amount<=0)return;t.hp=Math.max(0,t.hp-amount);b.hp=t.hp;this.crafting.revision++;if(!t.hp){this.crafting.tables.splice(this.crafting.tables.indexOf(t),1);this.zombies.forEach(z=>z.replan=0);}this.events.push({type:t.hp?'barricade-hit':'barricade-break',position:t});return;}

    if (b.hp <= 0 || amount <= 0) return;
    b.hp = Math.max(0, b.hp - amount); b.flash = .18;
    if(!b.hp){const p=this.portals.find(p=>p.id===b.id);if(p)p.state='open';}
    this.events.push({ type: b.hp ? 'barricade-hit' : 'barricade-break', position: b });this.noise(b,b.hp?12:28);
    if (!b.hp) { this.zombies.forEach(z => { z.replan = 0; }); if (this.action?.target === b.id) this.action = null; this.notice('DEFESA ROMPIDA', `${b.label} · ${this.portals.some(p=>p.id===b.id)?'a passagem ficou exposta.':'proteja a entrada do abrigo.'}`); }
  }
  private transition(event: string): void {
    if (event === 'dusk') { this.events.push({ type: 'warning' }); this.notice('ANOITECER SE APROXIMANDO', 'Último minuto. Volte ao abrigo com seus recursos.'); }
    if (event === 'preparation') { this.events.push({ type: 'warning' }); this.notice('PREPARE AS DEFESAS', '30 segundos. Recarregue e confira as barricadas.'); }
    if (event === 'countdown') this.events.push({ type: 'countdown' });
    if (event === 'night') { for(const z of this.zombies)if(z.active&&distance(z,BASE)<65)z.siege=true;this.horde.start(this.day); this.zombies.forEach(z => { z.replan = 0; }); this.events.push({ type: 'night' }); this.notice(`NOITE ${this.day}`, 'Defenda o abrigo.'); }
    if (event === 'survived') this.notice('VOCÊ SOBREVIVEU', 'Por um instante, a cidade fica em silêncio.');
    if (event === 'dawn') { this.stats.nights++;this.pendingPerks=perkOffer(this.perks,this.contentRandom); this.events.push({ type: 'dawn' }); this.horde.active = false; this.grantItems('scrap', BALANCE.reward.scrap); this.grantItems('rare', BALANCE.reward.rare); this.notice(`AMANHECER — DIA ${this.day + 1}`, '+3 sucata · +1 reserva selada. Excedentes ficam no chão.'); }
    if (event === 'day') {
      const empty = this.loot.filter(l => l.searched && !itemKeys.some(k => l.contents[k]) && l.area !== 'base'&&!l.site&&!l.restocked&&LOOT_POINTS.some(p=>p.id===l.id));
      // Refill only a subset; leftovers are never overwritten and the opening cache stays exhausted.
      for (let i = empty.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [empty[i], empty[j]] = [empty[j], empty[i]]; }
      empty.slice(0, Math.ceil(empty.length * BALANCE.reward.restock)).forEach(l => { l.searched = false; l.guaranteed = undefined;l.restocked=true; });
      this.spawnTimer = 2; this.notice('MAIS UM DIA', 'Alguns locais têm novos recursos. A próxima noite será mais forte.');
    }
  }
  update(dt: number, input: InputCommand): void {
    if (this.gameOver) return;
    if(this.foundationMode)input={...input,fire:false,trigger:false,interact:false,heldInteract:false,reload:false,heal:false,dismantle:false,slot:undefined};
    this.stats.seconds += dt;
    for(const site of CITY_SITES)if(!this.discoveredSites.has(site.id)&&distance(site,this.player)<Math.max(site.w,site.d)/2+7){this.discoveredSites.add(site.id);if(site.id==='church'||site.id==='quarantine')this.escapeClues.add(site.id);this.notice(site.name,site.story);}
    const solid = this.solidDefenses;
    // Retain fractional cadence debt only while firing; long idle periods never bank shots.
    this.shotTimer = Math.max(input.fire?-dt:0, this.shotTimer - dt); this.recoil = Math.max(0, this.recoil - dt * 7);this.switchTimer=Math.max(0,this.switchTimer-dt);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    if(this.coopMode==='solo')this.corpses.update(dt,this.player);
    const length = Math.hypot(input.moveX, input.moveZ); this.player.moving = this.coopMode==='actor'?this.player.moving:length > .01;
    if(input.yaw!==undefined){this.firstPerson=true;this.player.angle=input.yaw;this.player.pitch=input.pitch??0;}
    this.player.aimKick*=Math.exp(-dt*7);this.player.bloom=Math.max(0,this.player.bloom-dt*.07);
    this.player.crouched=!!input.crouch||(this.player.crouched&&ceilingHeight(this.player,FPS.radius)-floorHeight(this.player)<FPS.bodyHeight);
    this.player.ads=!!input.ads&&!input.run&&!this.reloadTimer;
    updateStamina(this.player,dt,input.run&&this.player.moving&&!this.player.crouched&&!this.player.ads);
    if (this.player.running || input.heal || input.interact || input.dismantle) this.cancelReload();
    if(input.slot!==undefined)this.switchWeapon(input.slot);
    if (this.reloadTimer > 0) { const previous=1-this.reloadTimer/this.reloadDuration; const next=previous+dt/this.reloadDuration;
      for(const [at,type] of [[.22/1.35,'reload-out'],[.78/1.35,'reload-in'],[1.12/1.35,'reload-slide']] as const) if(previous<at && next>=at) this.events.push({type,weapon:this.equipped.type});
      this.reloadTimer = Math.max(0, this.reloadTimer - dt); if (!this.reloadTimer) {const shell=this.weapon.reloadStyle==='shell'; const amount = Math.min(shell?1:this.weapon.magazine-this.ammo, this.reserve);this.ammo+=amount;this.reserve-=amount;this.openingReady=true;this.events.push({type:'reload-done',weapon:this.equipped.type});if(shell&&this.ammo<this.weapon.magazine&&this.reserve)this.reload();} }
    if (input.reload&&!this.player.running) this.reload();
    const speed = this.player.crouched?FPS.crouchSpeed:(this.player.ads?FPS.adsMove:1)*(this.player.running ? BALANCE.player.sprint*(this.perks.has('runner')?1.1:1) : BALANCE.player.walk)*this.weapon.move;
    if (length) move(this.player, input.moveX / Math.max(1,length) * speed * dt, input.moveZ / Math.max(1,length) * speed * dt, FPS.radius, solid,this.firstPerson?(this.player.crouched?FPS.crouchEye+.15:FPS.bodyHeight):0);
    if(!this.firstPerson)this.player.angle = Math.atan2(input.aimX - this.player.x, input.aimZ - this.player.z);
    this.player.eyeY+=((this.player.crouched?FPS.crouchEye:FPS.eyeHeight)+floorHeight(this.player)-this.player.eyeY)*(1-Math.exp(-dt*FPS.stepSpeed));
    if(this.foundationMode){this.focus=null;this.events.length=0;return;}
    if(this.firstPerson)this.focus=interactionFocus(this);
    this.anatomicalAim=input.aimY!==undefined; this.aimHeight=input.aimY??1.3; this.aimDistance=Math.max(.1,Math.hypot(input.aimX-this.player.x,input.aimZ-this.player.z));
    this.noiseTimer-=dt; if(this.coopMode!=='replica' && this.player.running && this.noiseTimer<=0) { this.noise(this.player,BALANCE.noise.sprint); this.noiseTimer=.6; }
    if (input.fire&&(this.weapon.automatic||input.trigger||!this.fireHeld)) { this.action = null;this.shoot(); }
    this.fireHeld=input.fire;
    if(this.coopMode!=='replica')this.interact(input, dt);
    if(this.coopMode!=='solo')return;
    updateCraftWorld(this,dt);
    this.barricades.forEach(b => { b.flash = Math.max(0, b.flash - dt); });
    if (this.phase === 'night') this.horde.update(dt, this.day, () => !!this.spawn(undefined,nightEnemy(this.day,this.horde.spawned,this.horde.budget)));
    else if (this.phase === 'day') { this.spawnTimer -= dt; if (this.spawnTimer <= 0) { if (distance(this.player,BASE)<65&&this.activeWalkers < Math.min(10, BALANCE.horde.dayCap + this.day - 1)) this.spawn(); this.spawnTimer = BALANCE.horde.dayInterval; } }
    if(this.phase==='day') ENCOUNTERS.forEach((e,i)=>{
      if(this.encounters.has(i)||distance(e,this.player)>BALANCE.exploration.activation||this.activeWalkers+e.count>BALANCE.walker.capacity)return;
      // Authored groups are activated outside the close gameplay view, once per expedition.
      if(this.spawnBlockedByView?.(e))return;
      const count=Math.max(1,e.count-(this.player.hp<35?1:0));const kinds=encounterKinds(i,count,this.day,this.player.hp,this.contentRandom);
      let spawned=0;for(let n=0;n<count;n++){const p={x:e.x+n*1.5,z:e.z+(n%2)*1.5};if(!this.spawnBlockedByView?.(p)&&this.spawn(p,kinds[n]))spawned++;}
      if(spawned)this.encounters.add(i);
    });
    ALARMS.forEach((p,i)=>{if(!this.alarms.has(i)&&distance(p,this.player)<3){this.alarms.add(i);this.alarmTimer=7;this.alarmPosition=p;this.notice('ALARME DISPARADO','O ruído atraiu os errantes próximos.');}});
    if(this.alarmTimer>0&&this.alarmPosition){const before=Math.ceil(this.alarmTimer);this.alarmTimer=Math.max(0,this.alarmTimer-dt);if(Math.ceil(this.alarmTimer)<before){this.noise(this.alarmPosition,BALANCE.noise.alarm);this.events.push({type:'alarm',position:this.alarmPosition});}}
    const near=this.zombies.filter(z=>z.active&&distance(z,this.player)<22);
    if(this.director.update(dt,[{hp:this.player.hp,ammo:this.ammo+this.reserve,healing:this.inventory.items.med,stamina:this.player.stamina,nearby:near.length,engaged:near.filter(z=>z.awareness==='chase'||z.attack>.5&&distance(z,this.player)<2).length,atShelter:this.atBase,inside:CITY_SITES.some(s=>Math.abs(s.x-this.player.x)<s.w/2&&Math.abs(s.z-this.player.z)<s.d/2),night:this.phase==='night'}],this.alarmTimer>0)&&this.director.cue){
      const source=CITY_SITES.filter(s=>distance(s,this.player)>12&&distance(s,this.player)<40).sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0];
      if(source)this.events.push({type:'suspense',position:{x:source.x,z:source.z}});
    }
    this.updateCity(dt);
    this.updateWalkers(dt, solid);
    this.generatorPulse-=dt;if(this.generatorPulse<=0){this.generatorPulse=4;for(const f of this.facilities)if(f.kind==='generator'&&f.state==='powered'&&distance(f,this.player)<90)this.noise(f,28);}
    this.updateWorld(dt);
    if (this.player.hp <= 0 || this.baseHP <= 0) { this.gameOver = true; this.action = null; return; }
    for (const event of this.cycle.update(dt, this.horde.complete && !this.zombies.some(z=>z.active&&(z.siege||distance(z,BASE)<50)))) this.transition(event);
  }
  private updateCity(dt:number):void {
    this.cityTimer-=dt;if(this.cityTimer>0)return;this.cityTimer=.5;
    for(const z of this.dormantZombies){z.hearing=Math.max(0,z.hearing-.5);z.memory=Math.max(0,(z.memory??0)-.5);if(!z.memory)z.lastSeen=undefined;if(!z.hearing)z.heard=undefined;if(!z.memory&&!z.hearing){z.awareness='idle';z.defense=undefined;}}
    // Dormant actors retain identity, wounds and HP; cleared rooms never roll new guards.
    const distant=this.zombies.filter(z=>z.active&&!z.siege&&distance(z,this.player)>CITY_PACING.sleep);
    for(const z of distant){z.path=[];this.dormantZombies.push(z);}
    this.zombies=this.zombies.filter(z=>!distant.includes(z));
    for(let i=this.dormantZombies.length-1;i>=0;i--){const z=this.dormantZombies[i];if(distance(z,this.player)<70&&this.activeWalkers<34&&this.activeWalkers+this.corpses.bodies.length<BALANCE.combat.corpseLimit){this.dormantZombies.splice(i,1);const free=this.zombies.findIndex(a=>!a.active);if(free<0)this.zombies.push(z);else this.zombies[free]=z;z.replan=0;}}
    for(const site of CITY_SITES){
      if(this.discoveredSites.has(site.id)){this.activatedSites.add(site.id);continue;}
      if(this.activatedSites.has(site.id)||distance(site,this.player)>CITY_PACING.activation||this.activeWalkers>28)continue;
      const kinds=cityEncounter(site,this.day,this.player.hp),positions:Vec2[]=[];
      for(const z of [-site.d*.35,-site.d*.12,site.d*.18,site.d*.38])for(const x of [-2,2])positions.push({x:site.x+x,z:site.z+z});
      for(const side of [-1,1])for(const offset of [-5,0,5])positions.push({x:site.x+side*(site.w/2+4),z:site.z+offset});
      const free=positions.filter(p=>distance(p,this.player)>20&&!this.spawnBlockedByView?.(p)&&!collides(p,.7,this.solidDefenses));
      if(free.length<kinds.length)continue;
      let count=0;for(const [i,kind]of kinds.entries()){const z=this.spawn(free[i],kind);if(z)count++;}
      if(count)this.activatedSites.add(site.id);
    }
    this.roamTimer-=.5;this.outsideTimer-=.5;
    if(this.director.allowPressure&&this.roamTimer<=0&&distance(this.player,BASE)>45&&this.activeWalkers<25){this.spawnRoaming();this.roamTimer=CITY_PACING.roamInterval;}
    if(this.director.allowPressure&&this.phase==='night'&&distance(this.player,BASE)>55&&this.outsideTimer<=0&&this.activeWalkers<34){this.spawnRoaming(4+Math.min(3,this.day));this.outsideTimer=CITY_PACING.nightOutsideInterval;}
  }
  spawnRoaming(count=CITY_PACING.roamCount):number {
    const routes=[{x:-88,z:-80},{x:88,z:-80},{x:88,z:35},{x:-88,z:45},{x:35,z:88},{x:-30,z:-88},{x:142,z:70},{x:-142,z:-50}];
    for(const [route,center] of routes.entries()){
      if(this.usedRoaming.has(route)||distance(center,this.player)<40||distance(center,this.player)>100)continue;
      const positions=Array.from({length:count},(_,i)=>({x:center.x+(i%4)*1.7,z:center.z+Math.floor(i/4)*1.7}));
      if(positions.some(p=>this.spawnBlockedByView?.(p)||collides(p,.7,this.solidDefenses)||distance(p,this.player)<24||CITY_SITES.some(s=>Math.abs(p.x-s.x)<s.w/2&&Math.abs(p.z-s.z)<s.d/2)))continue;
      const target={x:center.x,z:center.z+32};if(!findPath(center,target,this.solidDefenses).length)continue;
      let spawned=0;for(const p of positions){const z=this.spawn(p);if(z){z.patrol=target;spawned++;}}if(spawned)this.usedRoaming.add(route);return spawned;
    }return 0;
  }
  updateCoopWorld(dt:number,targets:Simulation['player'][]):void {
    this.coopTargets=targets;
    updateCraftWorld(this,dt,targets);
    if(this.phase==='night')this.horde.update(dt,this.day,()=>!!this.spawn(undefined,nightEnemy(this.day,this.horde.spawned,this.horde.budget)));
    for(const event of this.cycle.update(dt,this.horde.complete&&!this.zombies.some(z=>z.active&&(z.siege||distance(z,BASE)<50))))this.transition(event);
    if(targets.length)this.player=targets[0];
    this.updateWalkers(dt,this.solidDefenses);
    for(const acid of this.acids){acid.age+=dt;acid.tick-=dt;if(acid.age>=ACID.flight&&acid.tick<=0){acid.tick=ACID.interval;for(const p of targets){const d=distance(acid,p);if(p.hp>0&&d<ACID.radius&&(d<.01||wallDistance(acid,{x:(p.x-acid.x)/d,z:(p.z-acid.z)/d},d,this.solidDefenses)>=d-.05))this.onCoopDamage?.(p,ACID.damage,acid.from);}}}
    this.acids=this.acids.filter(a=>a.age<ACID.flight+ACID.lifetime);
    this.corpses.update(dt,this.player);
  }
  private updateTraps(dt:number):void {
    for(const b of this.barricades){if(!b.trap||b.hp<=0)continue;b.trapTimer=Math.max(0,(b.trapTimer??0)-dt);if(b.trapTimer>0)continue;
      const targets=this.zombies.filter(z=>z.active&&obstacleDistance(z,b)<(b.trap==='wire'?1:.45));if(!targets.length)continue;b.trapTimer=1;
      for(const z of targets.slice(0,4)){const damage=b.trap==='spikes'?24:b.trap==='wire'?12:8;z.hp-=damage;z.flash=.12;z.slow=Math.max(z.slow,b.trap==='snare'?3:1.2);b.hp=Math.max(0,b.hp-5);
        this.events.push({type:'hit',position:{x:z.x,z:z.z},zone:'LEGS',enemy:z.kind,entity:z.id,damage,remainingHP:Math.max(0,z.hp)});
        if(z.hp<=0)this.killInfected(z,{x:0,z:1},'LEGS');
      }
      if(!b.hp)this.events.push({type:'barricade-break',position:b});
    }
  }
  private updateWalkers(dt: number, worldSolids: Barricade[]): void {
    this.updateTraps(dt);
    // Spatial bins avoid all-pairs separation as the horde grows.
    const bins = new Map<string, Walker[]>(); const cell = 2;
    for (const z of this.zombies) if (z.active) { const key = `${Math.floor(z.x / cell)},${Math.floor(z.z / cell)}`; const bucket = bins.get(key) ?? []; bucket.push(z); bins.set(key, bucket); }
    for (const z of this.zombies) {
      if (!z.active) continue;
      const player=this.coopTargets.length?this.coopTargets.filter(p=>p.hp>0).sort((a,b)=>{
        const score=(p:Simulation['player'])=>distance(z,p)+(z.heard&&z.hearing>0?distance(p,z.heard)*.65:0);
        return score(a)-score(b);
      })[0]:this.player;
      if(!player){z.path=[];continue;}
      const definition=ENEMIES[z.kind];
      if(distance(z,player)>CITY_PACING.sleep&&!z.siege)continue;
      const solid=worldSolids.filter(b=>Math.abs(b.x-z.x)<=100+b.w/2&&Math.abs(b.z-z.z)<=100+b.d/2);
      z.screamCooldown=Math.max(0,(z.screamCooldown??0)-dt);
      if(z.screamTimer){z.screamTimer=Math.max(0,z.screamTimer-dt);if(!z.screamTimer){this.noise(z,SCREAM.noise);z.screamCooldown=SCREAM.cooldown;this.events.push({type:'scream',position:{x:z.x,z:z.z},enemy:z.kind});}continue;}
      z.staggerCooldown=Math.max(0,(z.staggerCooldown??0)-dt);z.memory=Math.max(0,(z.memory??0)-dt);z.reaction=Math.max(0,z.reaction-dt); z.slow=Math.max(0,z.slow-dt); z.hearing=Math.max(0,z.hearing-dt);
      z.flash = Math.max(0, z.flash - dt); z.attack -= dt; z.replan -= dt;z.spitCooldown-=dt;
      if(z.kind!=='walker'&&!this.seenEnemies.has(z.kind)&&distance(z,player)<18){this.seenEnemies.add(z.kind);this.notice(definition.name.toUpperCase(),definition.hint);this.events.push({type:'enemy-call',position:z,enemy:z.kind});}
      if(z.spitTarget){z.windup-=dt;z.angle=Math.atan2(z.spitTarget.x-z.x,z.spitTarget.z-z.z);
        if(z.windup<=0){const d=distance(z,z.spitTarget),dir={x:(z.spitTarget.x-z.x)/d,z:(z.spitTarget.z-z.z)/d};if(this.acids.length<ACID.capacity&&wallDistance(z,dir,d,solid)>=d-.05){this.acids.push({...z.spitTarget,id:this.nextAcidId++,from:{x:z.x,z:z.z},age:0,tick:ACID.flight});this.events.push({type:'spit',position:z,enemy:z.kind});}z.spitTarget=undefined;z.spitCooldown=ACID.cooldown;}
        continue;
      }
      const chaseRange=z.kind==='spitter'?20:z.kind==='screamer'?SCREAM.range:z.kind==='runner'?22:this.phase==='night'?18:BALANCE.walker.chaseDay;
      const pd=distance(z,player),vision={x:(player.x-z.x)/(pd||1),z:(player.z-z.z)/(pd||1)};
      // Glass allows sight, but closed doors and solid walls do not. Attacks still
      // use all barriers below, so seeing a target never permits hitting through it.
      const sightBarriers=solid.filter(b=>!this.portals.some(p=>p.id===b.id&&p.kind==='window'&&p.state==='closed'));
      const sees=pd<chaseRange&&wallDistance(z,vision,pd,sightBarriers)>=pd-.05;
      const chasing=sees;
      if(sees){z.lastSeen={x:player.x,z:player.z};z.memory=7;z.awareness='chase';}
      else if(z.memory&&z.lastSeen){z.awareness='search';}
      else if(z.hearing>0){z.awareness='investigate';}
      else {z.awareness='idle';z.lastSeen=undefined;z.heard=undefined;}
      if(!sees&&z.heard&&z.hearing>0&&distance(z,z.heard)<1.3){
        z.awareness='search';if((z.searchStep??0)<3){const angle=z.id+(z.searchStep??0)*2.4;const point={x:z.heard.x+Math.cos(angle)*1.8,z:z.heard.z+Math.sin(angle)*1.8};if(!collides(point,.6,solid))z.heard=point;z.searchStep=(z.searchStep??0)+1;z.replan=0;}
      }
      if(z.patrol&&distance(z,z.patrol)<2){const next={x:z.patrol.x+24,z:z.patrol.z-20};if(!collides(next,.7,solid))z.patrol=next;else z.patrol=undefined;}
      const target = chasing ? player : z.memory&&z.lastSeen ? z.lastSeen : z.hearing>0&&(!z.siege||!z.heard||distance(z.heard,BASE)>12) ? z.heard : this.phase==='night'&&z.siege ? BASE : z.patrol??solid.find(b=>b.id===z.defense&&b.hp>0);
      if (!target) { z.path = []; z.gait += dt * .8; continue; }
      let defense = solid.find(b => b.id === z.defense && b.hp > 0);
      if (z.replan <= 0) {
        const route = findPath(z, target,solid.filter(b=>b.id.startsWith('tree-'))); let previous: Vec2 = z; defense = undefined;
        // A barricade intersecting the static route is a purposeful target, not a failed path.
        for (const point of route.length ? route : [target]) {
          const d = distance(previous, point), steps = Math.ceil(d / .3);
          for (let i = 0; i <= steps && !defense; i++) { const t = steps ? i / steps : 0; defense = solid.find(b => b.hp > 0 && !b.id.startsWith('tree-') && obstacleDistance({ x: previous.x + (point.x - previous.x) * t, z: previous.z + (point.z - previous.z) * t }, b) < .5); }
          if (defense) break; previous = point;
        }
        z.defense = defense?.id;
        const goal = defense ? defense.d>defense.w?{x:defense.x+(z.x>=defense.x?1:-1)*(defense.w/2+.8),z:Math.max(defense.z-defense.d/2+.7,Math.min(defense.z+defense.d/2-.7,z.z))}:{ x: defense.w < 3 ? defense.x : Math.max(defense.x - defense.w / 2 + .8, Math.min(defense.x + defense.w / 2 - .8, z.x)), z: defense.z + (z.z >= defense.z ? 1 : -1) * (defense.d / 2 + .9) } : target;
        z.path = findPath(z, goal, solid);
        // Adjacent prefab modules can cover a barrier's preferred approach face.
        // Try its other exposed faces instead of repeatedly targeting a blocked point.
        if(!z.path.length&&defense){const b=defense,margin=.8;
          const approaches=[{x:b.x-b.w/2-margin,z:b.z},{x:b.x+b.w/2+margin,z:b.z},{x:b.x,z:b.z-b.d/2-margin},{x:b.x,z:b.z+b.d/2+margin}].filter(p=>!collides(p,.49,solid)).sort((a,b)=>distance(z,a)-distance(z,b));
          for(const p of approaches){z.path=findPath(z,p,solid);if(z.path.length)break;}
        }
        z.replan = (distance(z,player)>45?2:.7) + this.random() * .4;
      }
      // Never hit a target through a live barrier or a building.
      const td = distance(z, target), direct = { x: (target.x - z.x) / (td || 1), z: (target.z - z.z) / (td || 1) };
      const clearTarget = wallDistance(z, direct, td, solid.filter(b => b.hp > 0)) >= td - .05;
      if(z.kind==='stalker'&&chasing&&clearTarget&&td>3&&td<13&&z.spitCooldown<=0&&!z.chargeTarget&&z.reaction<=0){z.chargeTarget={x:player.x,z:player.z};z.windup=.7;z.chargeTime=1.1;z.spitCooldown=8;this.events.push({type:'enemy-call',position:{x:z.x,z:z.z},enemy:z.kind});}
      if(z.chargeTarget){
        const cd=distance(z,z.chargeTarget),cx=(z.chargeTarget.x-z.x)/(cd||1),cz=(z.chargeTarget.z-z.z)/(cd||1);z.angle=Math.atan2(cx,cz);
        if(z.windup>0){z.windup=Math.max(0,z.windup-dt);continue;}
        z.chargeTime=Math.max(0,(z.chargeTime??0)-dt);const before={x:z.x,z:z.z};
        move(z,cx*7.2*dt,cz*7.2*dt,definition.radius,solid);z.gait+=dt*9;
        const hit=distance(z,player)<1.35&&clearTarget;if(hit){if(this.onCoopDamage)this.onCoopDamage(player,18,z);else this.hurt(18,z);z.attack=1.5;this.events.push({type:'enemy-attack',position:{x:z.x,z:z.z},enemy:z.kind});}
        if(hit||cd<.6||!z.chargeTime||distance(before,z)<dt){z.chargeTarget=undefined;z.chargeTime=0;z.replan=0;}continue;
      }
      if(z.kind==='spitter'&&chasing&&clearTarget&&td>2.7&&td<ACID.range&&z.spitCooldown<=0&&z.reaction<=0){z.spitTarget={x:player.x,z:player.z};z.windup=ACID.windup;this.events.push({type:'spit-ready',position:z,enemy:z.kind});continue;}
      if(z.kind==='screamer'&&chasing&&clearTarget&&!z.screamCooldown&&z.reaction<=0){z.screamTimer=SCREAM.windup;this.events.push({type:'scream-ready',position:{x:z.x,z:z.z},enemy:z.kind});continue;}
      const canHitPlayer = chasing && td < BALANCE.walker.playerRange && clearTarget;
      const canHitDefense = defense && defense.hp > 0 && obstacleDistance(z, defense) < 1.15;
      const canHitBase = this.phase === 'night' && !!z.siege && target===BASE && !chasing && td < 1.9 && clearTarget;
      if (canHitPlayer || canHitDefense || canHitBase) {
        const at = canHitDefense && !canHitPlayer ? defense! : target; z.angle = Math.atan2(at.x - z.x, at.z - z.z);
        if(z.attack<=0&&!z.winding&&definition.windup){z.winding=true;z.windup=definition.windup;}
        if(z.winding)z.windup-=dt;
        if (z.attack <= 0&&(!z.winding||z.windup<=0)) {
          z.winding=false;z.attack = definition.interval;
          this.events.push({type:'enemy-attack',position:{x:z.x,z:z.z},enemy:z.kind});
          if (canHitPlayer){if(this.onCoopDamage)this.onCoopDamage(player,definition.damage,z);else this.hurt(definition.damage,z);}
          else if (canHitDefense) this.damageBarricade(defense!, definition.structure);
          else this.baseHP = Math.max(0, this.baseHP - definition.baseDamage);
          if(z.kind==='tank')this.events.push({type:'heavy-step',position:z,enemy:z.kind});
        }
        continue;
      }
      if(z.winding){z.winding=false;z.windup=0;z.attack=.3;}
      while (z.path.length > 1 && distance(z, z.path[0]) < .5) z.path.shift();
      const waypoint = !defense && wallDistance(z, direct, td, solid.filter(b => b.hp > 0), .49) >= td ? target : z.path[0];
      if (!waypoint) { z.replan = Math.min(z.replan, .15); continue; }
      let dx = waypoint.x - z.x, dz = waypoint.z - z.z; const length = Math.hypot(dx, dz) || 1; dx /= length; dz /= length;
      const bx = Math.floor(z.x / cell), bz = Math.floor(z.z / cell);
      for (let x = bx - 1; x <= bx + 1; x++) for (let y = bz - 1; y <= bz + 1; y++) for (const other of bins.get(`${x},${y}`) ?? []) {
        if (other === z || !other.active) continue; const d = distance(z, other);
        if (d > .001 && d < BALANCE.walker.separation) { dx += (z.x - other.x) / d * (1 - d / BALANCE.walker.separation) * 1.1; dz += (z.z - other.z) / d * (1 - d / BALANCE.walker.separation) * 1.1; }
      }
      // The ranged actor gives ground while its attack recharges, respecting the same collision path.
      if(z.kind==='spitter'&&chasing&&clearTarget){if(td<5){dx=-direct.x;dz=-direct.z;}else if(td<9){z.angle=Math.atan2(direct.x,direct.z);continue;}}
      const speed = (definition.speed + (z.kind==='walker'?Math.min(this.day * BALANCE.walker.speedPerDay, BALANCE.walker.maxSpeedBonus):0) + Math.sin(z.gait * 1.7) * .16) * (z.slow>0?.55:1) * (z.reaction>0?.55:1)*(z.speedFactor??1);
      const norm = Math.hypot(dx, dz) || 1; move(z, dx / norm * speed * dt, dz / norm * speed * dt, definition.radius, solid.filter(b => b.hp > 0));
      const oldGait=z.gait;z.angle = Math.atan2(dx, dz); z.gait += dt * (z.kind==='runner'?8:z.kind==='tank'?2.4:4);
      if(z.kind==='tank'&&Math.floor(oldGait/Math.PI)!==Math.floor(z.gait/Math.PI)&&distance(z,player)<20)this.events.push({type:'heavy-step',position:z,enemy:z.kind});
    }
  }
}
