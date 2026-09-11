import { ENCOUNTERS, ALARMS } from './districts.ts';
import { bodyHit, CorpseManager } from './combat.ts';
import { createWeapon, weaponStats, WEAPONS, RARITIES, rollRarity, rollWeapon } from './weapons.ts';
import type { WeaponId, WeaponItem, GroundWeapon, Rarity } from './weapons.ts';
import { ENEMIES, ACID, nightEnemy } from './enemies.ts';
import type { EnemyKind } from './enemies.ts';
import { PERKS, perkOffer } from './perks.ts';
import type { PerkId } from './perks.ts';
import { FACILITIES, EVENT_POINTS, encounterKinds } from './expedition.ts';
import type { Facility, WorldEvent } from './expedition.ts';
import type { HitZone, Wound } from './combat.ts';
import { BASE, collides, distance, findPath, move, wallDistance, WORLD_LIMIT, impactMaterial } from './world.ts';
import type { Vec2 } from './world.ts';
import { BALANCE } from './config.ts';
import { MatchCycle } from './cycle.ts';
import type { Phase } from './cycle.ts';
import { Inventory, ITEMS, itemKeys, emptyStock } from './inventory.ts';
import type { Item } from './inventory.ts';
import { createLoot, rollLoot } from './loot.ts';
import { createDefenses, obstacleDistance } from './defenses.ts';
import type { Barricade } from './defenses.ts';
import { Horde } from './horde.ts';
export type { Phase } from './cycle.ts';
export const PISTOL = BALANCE.pistol;
export interface InputCommand { moveX: number; moveZ: number; aimX: number; aimZ: number; aimY?: number; fire: boolean; trigger?:boolean; slot?:0|1; run: boolean; reload: boolean; interact: boolean; heldInteract?: boolean; heal?: boolean; dismantle?: boolean }
export interface Walker extends Vec2 { id: number; kind:EnemyKind; hp: number; angle: number; attack: number; flash: number; gait: number; path: Vec2[]; replan: number; active: boolean; defense?: string; wounds: Wound[]; reaction: number; zone: HitZone; side: number; slow: number; heard?: Vec2; hearing: number; windup:number; winding:boolean; spitCooldown:number; spitTarget?:Vec2 }
export type GameEvent = { type: 'shot'; from: Vec2; to: Vec2; hit: boolean; y?: number; zone?: HitZone; material?: string; last?: boolean; weapon?:WeaponId; primary?:boolean; suppressed?:boolean } | { type: 'death' | 'hit' | 'barricade-hit' | 'barricade-break' | 'build' | 'repair' | 'spit-ready' | 'spit' | 'heavy-step' | 'enemy-call'; position: Vec2; zone?: HitZone; enemy?:EnemyKind } | { type: 'reload-out' | 'reload-in' | 'reload-slide' | 'reload-done' | 'alarm' | 'switch' | 'rare-pickup'; position?: Vec2; weapon?:WeaponId } | { type: 'hurt' | 'reload' | 'pickup' | 'empty' | 'search' | 'heal' | 'healed' | 'warning' | 'night' | 'dawn' | 'countdown' } | { type: 'notice'; text: string; sub: string };
export interface Action { kind: 'search' | 'heal' | 'build' | 'repair' | 'dismantle' | 'base' | 'facility' | 'silence' | 'event'; target: string; elapsed: number; duration: number; origin: Vec2 }
export interface Acid extends Vec2 {id:number;from:Vec2;age:number;tick:number}
export class Simulation {
  stats = { seconds: 0, headshots: 0, loot: 0, damage: 0, nights: 0, specials:0, weapons:0, bestRarity:'common' as Rarity, repairs:0 };
  player = { x: 1, z: 7, hp: BALANCE.player.hp, stamina: 100, angle: Math.PI, moving: false, running: false, invulnerable: 0 };
  encounters=new Set<number>(); alarms=new Set<number>(); alarmTimer=0; alarmPosition?:Vec2;
  corpses = new CorpseManager(); aimHeight = 1.3; aimDistance = 1; anatomicalAim = false; noiseTimer = 0;
  zombies: Walker[] = []; loot = createLoot(); barricades = createDefenses();
  inventory = new Inventory(); storage = new Inventory(Infinity); cycle: MatchCycle; horde = new Horde();
  events: GameEvent[] = []; action: Action | null = null;
  kills = 0; baseHP = BALANCE.base.hp;
  loadout:[WeaponItem|null,WeaponItem|null]=[null,createWeapon('pistol',0)]; activeSlot:0|1=1;
  groundWeapons:GroundWeapon[]=[]; nextWeaponId=1; equipmentRolled=new Set<string>(); discoveredWeapons=new Set<number>([0]);
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
  get equipped():WeaponItem {return this.loadout[this.activeSlot]!;}
  get weapon(){return weaponStats(this.equipped);}
  get ammo():number{return this.equipped.magazine;}
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
  get reserve(): number { return this.inventory.items[this.weapon.ammo]; }
  set reserve(value: number) { this.inventory.items[this.weapon.ammo] = Math.max(0, Math.floor(value)); }
  get activeWalkers(): number { return this.zombies.filter(z => z.active).length; }
  get threat(): number { return this.activeWalkers + (this.phase === 'night' ? Math.max(0, this.horde.budget - this.horde.spawned) : 0); }
  get atBase(): boolean { return this.player.x > -5 && this.player.x < 7 && this.player.z > .35 && this.player.z < 12; }
  get solidDefenses(): Barricade[] { return this.barricades.filter(b => b.hp > 0); }
  get nearbyLoot() { return this.loot.find(s => (!s.searched || itemKeys.some(k => s.contents[k] > 0)) && distance(s, this.player) < BALANCE.interaction.range && this.canReach(s)); }
  get nearbyDefense() { return this.barricades.find(b => obstacleDistance(this.player, b) < 2.1 && this.canReach({ x: Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, this.player.x)), z: b.z })); }
  get nearbyWeapon(){return this.groundWeapons.filter(g=>distance(g,this.player)<2.4&&this.canReach(g)).sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0];}
  get nearbyFacility(){return this.facilities.find(f=>f.state==='ready'&&distance(f,this.player)<2.4&&this.canReach(f));}
  get nearbyAlarm():boolean{return this.alarmTimer>0&&!!this.alarmPosition&&distance(this.player,this.alarmPosition)<2.5&&this.canReach(this.alarmPosition);}
  get nearbyEvent(){const e=this.worldEvent;return e?.kind==='cache'&&!e.triggered&&distance(e,this.player)<2.4&&this.canReach(e)?e:undefined;}
  private canReach(p: Vec2): boolean { const d = distance(p, this.player); return d < .01 || wallDistance(this.player, { x: (p.x - this.player.x) / d, z: (p.z - this.player.z) / d }, d) >= d - .05; }
  setPhase(phase: Phase, elapsed = 0): void { this.cycle.seek(phase, elapsed); if (phase === 'night') this.horde.start(this.day); else this.horde.active = false; }
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
    const z: Walker = { ...location, id: this.nextId++, kind, hp: ENEMIES[kind].hp, angle: 0, attack: .6, flash: 0, gait: this.random() * 10, path: [], replan: 0, active: true, wounds: [], reaction: 0, zone: 'TORSO', side: 1, slow: 0, hearing: 0, windup:0,winding:false,spitCooldown:2 };
    const free = this.zombies.findIndex(z => !z.active);
    if (free >= 0) this.zombies[free] = z; else this.zombies.push(z);
    return z;
  }
  reload(): void {
    if (this.gameOver || this.switchTimer || this.reloadTimer || this.ammo >= this.weapon.magazine || !this.reserve) return;
    this.reloadDuration=this.weapon.reload*(this.perks.has('pressure')&&this.player.hp<this.maxHP*.35?.75:1);
    this.reloadTimer = this.reloadDuration; this.events.push({ type: 'reload' });
  }
  switchWeapon(slot:0|1):void {
    if(this.gameOver||!this.loadout[slot]||slot===this.activeSlot||this.switchTimer)return;
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
    if (this.gameOver || this.shotTimer > 1e-8 || this.switchTimer > 0) return;
    const weapon=this.weapon;
    if(this.reloadTimer>0){if(weapon.reloadStyle==='shell'&&this.ammo>0)this.cancelReload();else return;}
    if (!this.ammo) { this.events.push({ type: 'empty' }); this.shotTimer = .4; this.reload(); return; }
    this.ammo--; this.shotTimer += weapon.cooldown; this.recoil = weapon.recoil*(this.perks.has('steady')?.85:1);
    const slope=this.anatomicalAim ? (this.aimHeight-1.3)/this.aimDistance : 0;
    const impacts=new Map<Walker,{damage:number;zone:HitZone;side:number;y:number;dir:Vec2}>();
    for(let pellet=0;pellet<weapon.pellets;pellet++){
      // Stratified pellets keep the cone legible without giving each trigger an arbitrary damage lottery.
      const spread=weapon.pellets>1?(pellet/(weapon.pellets-1)-.5)+(this.random()-.5)*.08:this.random()-.5;
      const angle=this.player.angle+spread*weapon.spread*(this.perks.has('steady')?.85:1)*(this.player.running?4:1);
      const dir={x:Math.sin(angle),z:Math.cos(angle)};
      let limit=wallDistance(this.player,dir,weapon.range);if(slope<0)limit=Math.min(limit,1.3/-slope);
      const hits=this.zombies.filter(z=>z.active).map(z=>({z,hit:bodyHit(this.player,dir,slope,z,limit)})).filter(v=>v.hit).sort((a,b)=>a.hit!.distance-b.hit!.distance).slice(0,this.equipped.affix==='piercing'?2:1);
      for(let n=0;n<hits.length;n++){
        const {z,hit}=hits[n];const h=hit!;
        const falloff=h.distance<=weapon.falloff?1:Math.max(.25,1-(h.distance-weapon.falloff)/(weapon.range-weapon.falloff)*.75);
        const damage=weapon.damage*BALANCE.combat.multipliers[h.zone]*falloff*(n?.55:1)*(this.ammo===0&&this.perks.has('last')?1.2:1)*(h.zone==='HEAD'&&this.equipped.affix==='precise'?1.1:1);
        const prior=impacts.get(z);impacts.set(z,{damage:damage+(prior?.damage??0),zone:prior?.zone==='HEAD'?'HEAD':h.zone,side:h.side,y:h.y,dir});
      }
      const first=hits[0]?.hit,last=hits.at(-1)?.hit,nearest=last?.distance??limit;
      const end={x:this.player.x+dir.x*nearest,z:this.player.z+dir.z*nearest};
      this.events.push({type:'shot',from:{x:this.player.x+dir.x*.75,z:this.player.z+dir.z*.75},to:end,hit:!!first,y:last?.y??1.3+slope*nearest,zone:first?.zone,material:nearest>=weapon.range?'air':impactMaterial(end,this.solidDefenses),last:this.ammo===0,weapon:this.equipped.type,primary:pellet===0,suppressed:this.equipped.affix==='quiet'});
    }
    this.noise(this.player,weapon.noise);
    for(const [victim,{damage,zone,side,y,dir}] of impacts){
      const enemy=ENEMIES[victim.kind];
      if(zone==='HEAD')this.stats.headshots++;
      if(zone==='HEAD'&&this.perks.has('cold'))this.player.stamina=Math.min(100,this.player.stamina+8);
      victim.hp -= damage; victim.flash = .14; victim.reaction=BALANCE.combat.stagger*enemy.stagger*(weapon.pellets>1&&damage>70?2:1); victim.zone=zone; victim.side=side;
      if(zone==='HEAD'&&this.openingReady&&this.perks.has('opening')){victim.reaction*=2;this.openingReady=false;}
      if(victim.kind==='spitter'&&victim.spitTarget&&(damage>=20||zone==='HEAD')){victim.spitTarget=undefined;victim.windup=0;victim.spitCooldown=2;}
      if(zone==='LEGS') victim.slow=BALANCE.combat.legSlow;
      victim.wounds.push({zone,side,y}); if(victim.wounds.length>BALANCE.combat.woundLimit) victim.wounds.shift();
      const kick=weapon.kick*enemy.knockback;move(victim, dir.x*kick, dir.z*kick, enemy.radius, this.solidDefenses);
      this.events.push({ type: 'hit', position: { x: victim.x, z: victim.z }, zone,enemy:victim.kind });
      if (victim.hp <= 0) { victim.active = false; victim.path=[]; this.corpses.add(victim,dir,this.zombies.indexOf(victim)%3); this.kills++;if(victim.kind!=='walker')this.stats.specials++;this.events.push({ type: 'death', position: { x: victim.x, z: victim.z }, zone,enemy:victim.kind }); }
    }
  }
  noise(position: Vec2,radius:number):void {
    for(const z of this.zombies) if(z.active && distance(z,position)<radius) { z.heard={...position}; z.hearing=BALANCE.noise.memory; z.replan=0; }
  }
  cancelReload():void { this.reloadTimer=0; }
  startAlarm(position:Vec2,seconds:number):void {this.alarmPosition={...position};this.alarmTimer=seconds;this.noise(position,BALANCE.noise.alarm);this.events.push({type:'alarm',position});}
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
  private hurt(damage:number):void {
    if(this.player.invulnerable>0)return;
    this.stats.damage+=Math.min(this.player.hp,damage);this.player.hp=Math.max(0,this.player.hp-damage);this.player.invulnerable=.55;this.action=null;this.cancelReload();this.events.push({type:'hurt'});
  }
  private updateWorld(dt:number):void {
    for(const acid of this.acids){acid.age+=dt;acid.tick-=dt;if(acid.age>=ACID.flight&&acid.tick<=0){acid.tick=ACID.interval;const d=distance(acid,this.player);if(d<ACID.radius&&(d<.01||wallDistance(acid,{x:(this.player.x-acid.x)/d,z:(this.player.z-acid.z)/d},d,this.solidDefenses)>=d-.05))this.hurt(ACID.damage);}}
    this.acids=this.acids.filter(a=>a.age<ACID.flight+ACID.lifetime);
    if(this.worldEvent){this.worldEvent.life-=dt;if(this.worldEvent.life<=0)this.worldEvent=undefined;}
    if(this.phase!=='day')return;
    this.eventTimer-=dt;if(this.eventTimer>0||this.worldEvent||this.player.hp<30)return;
    const candidates=EVENT_POINTS.filter(p=>distance(p,this.player)>30&&!this.spawnBlockedByView?.(p)&&!collides(p,.7));
    if(!candidates.length){this.eventTimer=12;return;}
    const point=candidates[Math.floor(this.contentRandom()*candidates.length)],r=this.contentRandom();
    const kind=r<.5?'cache':r<.75?'alarm':'roaming';
    this.worldEvent={...point,id:this.nextEventId++,kind,name:kind==='cache'?'Suprimentos abandonados':kind==='alarm'?'Alarme distante':'Movimento nas ruas',life:100,triggered:false};
    this.eventTimer=160+this.contentRandom()*90;
    if(kind==='alarm')this.startAlarm(point,18);
    if(kind==='roaming')for(let n=0;n<3;n++){const p={x:point.x+n*1.6,z:point.z};if(this.spawnBlockedByView?.(p))continue;const z=this.spawn(p);if(z){z.heard={x:point.x-12,z:point.z+8};z.hearing=35;}}
    this.notice(this.worldEvent.name.toUpperCase(),'Uma oportunidade temporária foi marcada no mapa.');
  }

  resource(item: Item): number { return this.inventory.items[item] + this.storage.items[item]; }
  private pay(cost: Partial<Record<Item, number>>): boolean {
    if (itemKeys.some(k => this.resource(k) < (cost[k] ?? 0))) return false;
    for (const k of itemKeys) { const amount = cost[k] ?? 0, carried = Math.min(amount, this.inventory.items[k]); this.inventory.take(k, carried); this.storage.take(k, amount - carried); }
    return true;
  }
  manage(kind: 'deposit' | 'withdraw' | 'discard' | 'rare', item: Item): void {
    if (this.gameOver || this.action) return;
    if (kind === 'discard') { this.inventory.take(item, Math.min(ITEMS[item].step, this.inventory.items[item])); return; }
    if (!this.atBase) return;
    if (kind === 'deposit') this.inventory.transfer(this.storage, item, this.inventory.items[item]);
    if (kind === 'withdraw') this.storage.transfer(this.inventory, item, ITEMS[item].step);
    if (kind === 'rare' && this.baseHP < BALANCE.base.hp && this.pay({ rare: 1 })) { this.baseHP = Math.min(BALANCE.base.hp, this.baseHP + BALANCE.base.rareRepair); this.events.push({ type: 'repair', position: BASE }); this.notice('REFORÇO DE EMERGÊNCIA', `Abrigo +${BALANCE.base.rareRepair} HP`); }
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
      else if (input.dismantle && this.nearbyDefense?.hp) this.begin('dismantle', this.nearbyDefense.id, BALANCE.interaction.dismantle);
      else if (input.interact || input.heldInteract) {
        const loot = this.nearbyLoot, b = this.nearbyDefense;
        if(input.interact&&this.nearbyAlarm)this.begin('silence','',1.4);
        else if(input.interact&&this.nearbyWeapon)this.equipGround(this.nearbyWeapon.item.uid);
        else if(input.interact&&this.nearbyFacility){const f=this.nearbyFacility;
          if(f.requires&&this.facilities.find(p=>p.id===f.requires)?.state!=='powered')this.notice('ALIMENTAÇÃO DESLIGADA','Ative o gerador da triagem para abrir este estoque.');
          else this.begin('facility',f.id,f.kind==='generator'?2.5:2);
        }
        else if(input.interact&&this.nearbyEvent)this.begin('event',String(this.nearbyEvent.id),1.8);
        else if (loot && input.interact) this.begin('search', loot.id, loot.searched ? .4 : BALANCE.interaction.search);
        else if (b) {
          if (b.hp <= 0 && input.interact) {
            if (obstacleDistance(this.player, b) < .6 || this.zombies.some(z => z.active && obstacleDistance(z, b) < .6)) this.notice('PONTO OCUPADO', 'Afaste-se um pouco da marcação para construir.');
            else if (this.resource('wood') >= this.buildWood && this.resource('scrap') >= BALANCE.barricade.scrap) this.begin('build', b.id, BALANCE.interaction.build);
            else this.notice('FALTAM MATERIAIS', `${this.buildWood} madeira + ${BALANCE.barricade.scrap} sucata · explore as caixas próximas`);
          } else if (b.hp > 0 && b.hp < BALANCE.barricade.hp && this.resource('wood') >= BALANCE.barricade.repairWood && this.resource('scrap') >= this.repairScrap) this.begin('repair', b.id, BALANCE.interaction.repair);
        } else if (input.interact && distance(this.player, BASE) < 2.7 && this.baseHP < BALANCE.base.hp && this.resource('scrap') >= BALANCE.base.repairCost) this.begin('base', '', BALANCE.base.repairTime);
      }
    }
    const action = this.action; if (!action) return;
    action.elapsed += dt; if (action.elapsed < action.duration) return;
    this.action = null;
    if (action.kind === 'heal') {
      if (this.inventory.take('med', 1)) { this.player.hp = Math.min(this.maxHP, this.player.hp + BALANCE.interaction.healAmount);if(this.perks.has('medic'))this.player.stamina=100; this.events.push({ type: 'healed' }); }
    } else if (action.kind === 'search') {
      const loot = this.loot.find(l => l.id === action.target)!;
      if (!loot.searched) {
        loot.contents = loot.area === 'base' || loot.id === 'base-wood' ? emptyStock() : rollLoot(loot.area, () => this.random());
        for (const k of itemKeys) loot.contents[k] += loot.guaranteed?.[k] ?? 0;
        if(loot.area!=='base'&&loot.id!=='base-wood'){
          if(['police','gas','house'].includes(loot.area))loot.contents.shells+=2+Math.floor(this.contentRandom()*5);
          if(loot.area==='police')loot.contents.rifleAmmo+=12+Math.floor(this.contentRandom()*13);
          if(this.perks.has('scavenger')&&this.contentRandom()<.2)loot.contents[this.weapon.ammo]+=this.weapon.ammo==='shells'?4:12;
          if(!this.equipmentRolled.has(loot.id)){
            this.equipmentRolled.add(loot.id);
            if(loot.area==='police'||this.contentRandom()<(loot.area==='gas'?.45:loot.area==='house'?.3:.12)){
              const g=this.dropWeapon(rollWeapon(loot.area,this.contentRandom),this.equipmentPosition(loot),rollRarity(this.contentRandom,loot.id.includes('cache')),loot.label);
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
    } else if(action.kind==='silence'){this.alarmTimer=0;this.notice('ALARME DESLIGADO','Os infectados ainda investigam o último ruído.');
    } else if(action.kind==='event'){
      if(this.worldEvent?.id===Number(action.target)&&!this.worldEvent.triggered){this.worldEvent.triggered=true;this.rewardCache(this.worldEvent,'outside');}
    } else if(action.kind==='facility'){
      const f=this.facilities.find(f=>f.id===action.target);if(!f||f.state!=='ready')return;
      f.state=f.kind==='generator'?'powered':'opened';
      if(f.kind==='generator'){this.startAlarm(f,20);this.notice('TRIAGEM ENERGIZADA','Estoque refrigerado liberado. O motor pode atrair infectados.');}
      else {this.rewardCache(f,f.area);if(f.kind==='trunk'){this.startAlarm(f,18);this.notice('ALARME DISPARADO','Recolha o equipamento ou segure a posição para desligar.');}}
    } else if (action.kind === 'base') {
      if (this.pay({ scrap: BALANCE.base.repairCost })) { this.baseHP = Math.min(BALANCE.base.hp, this.baseHP + BALANCE.base.repairAmount); this.events.push({ type: 'repair', position: BASE }); }
    } else {
      const b = this.barricades.find(b => b.id === action.target)!;
      if (action.kind === 'build' && b.hp <= 0 && obstacleDistance(this.player, b) >= .6 && !this.zombies.some(z => z.active && obstacleDistance(z, b) < .6) && this.pay({ wood: this.buildWood, scrap: BALANCE.barricade.scrap })) {
        if(this.perks.has('builder'))this.builderUsed=true;b.hp = BALANCE.barricade.hp; b.built = true; this.events.push({ type: 'build', position: b }); this.notice('BARRICADA ERGUIDA', 'Segure E para reparar · X para desmontar e liberar passagem.');
      } else if (action.kind === 'repair' && b.hp > 0 && b.hp < BALANCE.barricade.hp && this.pay({ wood: BALANCE.barricade.repairWood, scrap: this.repairScrap })) {
        this.stats.repairs++;b.hp = Math.min(BALANCE.barricade.hp, b.hp + BALANCE.barricade.repairAmount); this.events.push({ type: 'repair', position: b });
      } else if (action.kind === 'dismantle' && b.hp > 0) {
        this.storage.add('wood', Math.floor(BALANCE.barricade.wood * .5 * b.hp / BALANCE.barricade.hp)); b.hp = 0; b.built = false; this.events.push({ type: 'barricade-break', position: b });
      }
      this.zombies.forEach(z => { z.replan = 0; });
    }
  }
  damageBarricade(b: Barricade, amount: number): void {
    if (b.hp <= 0 || amount <= 0) return;
    b.hp = Math.max(0, b.hp - amount); b.flash = .18;
    this.events.push({ type: b.hp ? 'barricade-hit' : 'barricade-break', position: b });
    if (!b.hp) { this.zombies.forEach(z => { z.replan = 0; }); if (this.action?.target === b.id) this.action = null; this.notice('DEFESA ROMPIDA', `${b.label} · proteja a entrada do abrigo.`); }
  }
  private transition(event: string): void {
    if (event === 'dusk') { this.events.push({ type: 'warning' }); this.notice('ANOITECER SE APROXIMANDO', 'Último minuto. Volte ao abrigo com seus recursos.'); }
    if (event === 'preparation') { this.events.push({ type: 'warning' }); this.notice('PREPARE AS DEFESAS', '30 segundos. Recarregue e confira as barricadas.'); }
    if (event === 'countdown') this.events.push({ type: 'countdown' });
    if (event === 'night') { this.horde.start(this.day); this.zombies.forEach(z => { z.replan = 0; }); this.events.push({ type: 'night' }); this.notice(`NOITE ${this.day}`, 'Defenda o abrigo.'); }
    if (event === 'survived') this.notice('VOCÊ SOBREVIVEU', 'Por um instante, a cidade fica em silêncio.');
    if (event === 'dawn') { this.stats.nights++;this.pendingPerks=perkOffer(this.perks,this.contentRandom); this.events.push({ type: 'dawn' }); this.horde.active = false; this.storage.add('scrap', BALANCE.reward.scrap); this.storage.add('rare', BALANCE.reward.rare); this.notice(`AMANHECER — DIA ${this.day + 1}`, '+3 sucata · +1 reserva selada no abrigo'); }
    if (event === 'day') {
      const empty = this.loot.filter(l => l.searched && !itemKeys.some(k => l.contents[k]) && l.area !== 'base');
      // Refill only a subset; leftovers are never overwritten and the opening cache stays exhausted.
      for (let i = empty.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [empty[i], empty[j]] = [empty[j], empty[i]]; }
      empty.slice(0, Math.ceil(empty.length * BALANCE.reward.restock)).forEach(l => { l.searched = false; l.guaranteed = undefined; });
      this.spawnTimer = 2; this.notice('MAIS UM DIA', 'Alguns locais têm novos recursos. A próxima noite será mais forte.');
    }
  }
  update(dt: number, input: InputCommand): void {
    if (this.gameOver) return;
    this.stats.seconds += dt;
    const solid = this.solidDefenses;
    // Retain fractional cadence debt only while firing; long idle periods never bank shots.
    this.shotTimer = Math.max(input.fire?-dt:0, this.shotTimer - dt); this.recoil = Math.max(0, this.recoil - dt * 7);this.switchTimer=Math.max(0,this.switchTimer-dt);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    this.corpses.update(dt,this.player);
    if ((input.run && Math.hypot(input.moveX,input.moveZ)>.01) || input.heal || input.interact || input.dismantle) this.cancelReload();
    if(input.slot!==undefined)this.switchWeapon(input.slot);
    if (this.reloadTimer > 0) { const previous=1-this.reloadTimer/this.reloadDuration; const next=previous+dt/this.reloadDuration;
      for(const [at,type] of [[.22/1.35,'reload-out'],[.78/1.35,'reload-in'],[1.12/1.35,'reload-slide']] as const) if(previous<at && next>=at) this.events.push({type,weapon:this.equipped.type});
      this.reloadTimer = Math.max(0, this.reloadTimer - dt); if (!this.reloadTimer) {const shell=this.weapon.reloadStyle==='shell'; const amount = Math.min(shell?1:this.weapon.magazine-this.ammo, this.reserve);this.ammo+=amount;this.reserve-=amount;this.openingReady=true;this.events.push({type:'reload-done',weapon:this.equipped.type});if(shell&&this.ammo<this.weapon.magazine&&this.reserve)this.reload();} }
    if (input.reload) this.reload();
    const length = Math.hypot(input.moveX, input.moveZ); this.player.moving = length > .01;
    this.player.running = input.run && this.player.stamina > 1 && this.player.moving;
    const speed = (this.player.running ? BALANCE.player.sprint*(this.perks.has('runner')?1.1:1) : BALANCE.player.walk)*this.weapon.move;
    if (length) move(this.player, input.moveX / length * speed * dt, input.moveZ / length * speed * dt, .45, solid);
    this.player.stamina = Math.max(0, Math.min(100, this.player.stamina + (this.player.running ? -BALANCE.player.drain : BALANCE.player.recover) * dt));
    this.player.angle = Math.atan2(input.aimX - this.player.x, input.aimZ - this.player.z);
    this.anatomicalAim=input.aimY!==undefined; this.aimHeight=input.aimY??1.3; this.aimDistance=Math.max(.1,Math.hypot(input.aimX-this.player.x,input.aimZ-this.player.z));
    this.noiseTimer-=dt; if(this.player.running && this.noiseTimer<=0) { this.noise(this.player,BALANCE.noise.sprint); this.noiseTimer=.6; }
    if (input.fire&&(this.weapon.automatic||input.trigger||!this.fireHeld)) { this.action = null;this.shoot(); }
    this.fireHeld=input.fire;
    this.interact(input, dt);
    this.barricades.forEach(b => { b.flash = Math.max(0, b.flash - dt); });
    if (this.phase === 'night') this.horde.update(dt, this.day, () => !!this.spawn(undefined,nightEnemy(this.day,this.horde.spawned,this.horde.budget)));
    else if (this.phase === 'day') { this.spawnTimer -= dt; if (this.spawnTimer <= 0) { if (this.activeWalkers < Math.min(10, BALANCE.horde.dayCap + this.day - 1)) this.spawn(); this.spawnTimer = BALANCE.horde.dayInterval; } }
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
    this.updateWalkers(dt, solid);
    this.updateWorld(dt);
    if (this.player.hp <= 0 || this.baseHP <= 0) { this.gameOver = true; this.action = null; return; }
    for (const event of this.cycle.update(dt, this.horde.complete && this.activeWalkers === 0)) this.transition(event);
  }
  private updateWalkers(dt: number, solid: Barricade[]): void {
    // Spatial bins avoid all-pairs separation as the horde grows.
    const bins = new Map<string, Walker[]>(); const cell = 2;
    for (const z of this.zombies) if (z.active) { const key = `${Math.floor(z.x / cell)},${Math.floor(z.z / cell)}`; const bucket = bins.get(key) ?? []; bucket.push(z); bins.set(key, bucket); }
    for (const z of this.zombies) {
      if (!z.active) continue;
      const definition=ENEMIES[z.kind];
      z.reaction=Math.max(0,z.reaction-dt); z.slow=Math.max(0,z.slow-dt); z.hearing=Math.max(0,z.hearing-dt);
      z.flash = Math.max(0, z.flash - dt); z.attack -= dt; z.replan -= dt;z.spitCooldown-=dt;
      if(z.kind!=='walker'&&!this.seenEnemies.has(z.kind)&&distance(z,this.player)<18){this.seenEnemies.add(z.kind);this.notice(definition.name.toUpperCase(),definition.hint);this.events.push({type:'enemy-call',position:z,enemy:z.kind});}
      if(z.spitTarget){z.windup-=dt;z.angle=Math.atan2(z.spitTarget.x-z.x,z.spitTarget.z-z.z);
        if(z.windup<=0){const d=distance(z,z.spitTarget),dir={x:(z.spitTarget.x-z.x)/d,z:(z.spitTarget.z-z.z)/d};if(this.acids.length<ACID.capacity&&wallDistance(z,dir,d,solid)>=d-.05){this.acids.push({...z.spitTarget,id:this.nextAcidId++,from:{x:z.x,z:z.z},age:0,tick:ACID.flight});this.events.push({type:'spit',position:z,enemy:z.kind});}z.spitTarget=undefined;z.spitCooldown=ACID.cooldown;}
        continue;
      }
      const chasing = distance(z, this.player) < (this.phase === 'night' ? BALANCE.walker.chaseNight : BALANCE.walker.chaseDay);
      const target = chasing ? this.player : this.phase === 'night' ? BASE : z.hearing>0 ? z.heard : null;
      if (!target) { z.path = []; z.gait += dt * .8; continue; }
      let defense = solid.find(b => b.id === z.defense && b.hp > 0);
      if (z.replan <= 0) {
        const route = findPath(z, target); let previous: Vec2 = z; defense = undefined;
        // A barricade intersecting the static route is a purposeful target, not a failed path.
        for (const point of route.length ? route : [target]) {
          const d = distance(previous, point), steps = Math.ceil(d / .3);
          for (let i = 0; i <= steps && !defense; i++) { const t = steps ? i / steps : 0; defense = solid.find(b => b.hp > 0 && obstacleDistance({ x: previous.x + (point.x - previous.x) * t, z: previous.z + (point.z - previous.z) * t }, b) < .5); }
          if (defense) break; previous = point;
        }
        z.defense = defense?.id;
        const goal = defense ? { x: defense.w < 3 ? defense.x : Math.max(defense.x - defense.w / 2 + .8, Math.min(defense.x + defense.w / 2 - .8, z.x)), z: defense.z + (z.z >= defense.z ? 1 : -1) * (defense.d / 2 + .9) } : target;
        z.path = findPath(z, goal, solid.filter(b => b.hp > 0));
        z.replan = .7 + this.random() * .4;
      }
      // Never hit a target through a live barrier or a building.
      const td = distance(z, target), direct = { x: (target.x - z.x) / (td || 1), z: (target.z - z.z) / (td || 1) };
      const clearTarget = wallDistance(z, direct, td, solid.filter(b => b.hp > 0)) >= td - .05;
      if(z.kind==='spitter'&&chasing&&clearTarget&&td>2.7&&td<ACID.range&&z.spitCooldown<=0&&z.reaction<=0){z.spitTarget={x:this.player.x,z:this.player.z};z.windup=ACID.windup;this.events.push({type:'spit-ready',position:z,enemy:z.kind});continue;}
      const canHitPlayer = chasing && td < BALANCE.walker.playerRange && clearTarget;
      const canHitDefense = defense && defense.hp > 0 && obstacleDistance(z, defense) < 1.15;
      const canHitBase = this.phase === 'night' && !chasing && td < 1.9 && clearTarget;
      if (canHitPlayer || canHitDefense || canHitBase) {
        const at = canHitDefense && !canHitPlayer ? defense! : target; z.angle = Math.atan2(at.x - z.x, at.z - z.z);
        if(z.attack<=0&&!z.winding&&definition.windup){z.winding=true;z.windup=definition.windup;}
        if(z.winding)z.windup-=dt;
        if (z.attack <= 0&&(!z.winding||z.windup<=0)) {
          z.winding=false;z.attack = definition.interval;
          if (canHitPlayer)this.hurt(definition.damage);
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
      const speed = (definition.speed + (z.kind==='walker'?Math.min(this.day * BALANCE.walker.speedPerDay, BALANCE.walker.maxSpeedBonus):0) + Math.sin(z.gait * 1.7) * .16) * (z.slow>0?.55:1) * (z.reaction>0?.55:1);
      const norm = Math.hypot(dx, dz) || 1; move(z, dx / norm * speed * dt, dz / norm * speed * dt, definition.radius, solid.filter(b => b.hp > 0));
      const oldGait=z.gait;z.angle = Math.atan2(dx, dz); z.gait += dt * (z.kind==='runner'?8:z.kind==='tank'?2.4:4);
      if(z.kind==='tank'&&Math.floor(oldGait/Math.PI)!==Math.floor(z.gait/Math.PI)&&distance(z,this.player)<20)this.events.push({type:'heavy-step',position:z,enemy:z.kind});
    }
  }
}
