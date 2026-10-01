import {moveChest,placeChest,reclaimChest} from '../game/chests.ts';
import {craft,placeBench,reclaimBench,absorb,infectedLoot} from '../game/crafting.ts';
import {Simulation} from '../game/simulation.ts';
import type {InputCommand,GameEvent,Walker} from '../game/simulation.ts';
import {Inventory,itemKeys} from '../game/inventory.ts';
import {distance,floorHeight,wallDistance,collides} from '../game/world.ts';
import {interactionFocus} from '../game/interaction.ts';
import {CITY_SITES} from '../game/city.ts';
import {cityEncounter} from '../game/city-director.ts';
import type {WeaponItem} from '../game/weapons.ts';
import {entityId,NetworkEntityRegistry} from './entities.ts';
import {COOP,shotSeed} from './gameplay-protocol.ts';
import type {ActionRequest,LifeState} from './gameplay-protocol.ts';
import {spawnFor} from './protocol.ts';
import type {PlayerSnapshot} from './protocol.ts';
const idle:InputCommand={moveX:0,moveZ:0,aimX:0,aimZ:1,fire:false,run:false,reload:false,interact:false};
export interface ActorRecord {actor:number;sim:Simulation;life:LifeState;bleed:number;lastSeq:number;shotSeq:number;lastFire:number;holdAt:number;reviveTarget:number;reviveProgress:number;intent?:string;intentAt:number;lastDamage:number;worldHeld?:boolean}
export interface SessionEffect {actor:number;shot:number;event:GameEvent}
export interface PlayerRecord {
 actor:number;life:LifeState;bleed:number;lastSeq:number;shotSeq:number;lastFire:number;player:Simulation['player'];
 perks:import('../game/perks.ts').PerkId[];builderUsed:boolean;openingReady:boolean;
 inventory:Inventory['items'];storage:Inventory['items'];loadout:[WeaponItem|null,WeaponItem|null];activeSlot:0|1|2|3;gear:Simulation['gear'];packCrafted:boolean;capacity:number;
 reloadTimer:number;reloadDuration:number;shotTimer:number;switchTimer:number;action:Simulation['action'];weaponStorage:WeaponItem[];reviveTarget:number;reviveProgress:number;
}
export interface WorldCheckpoint {
 survival:{crafting:Simulation['crafting'];barricades:Simulation['barricades'];baseHP:number;phase:Simulation['phase'];elapsed:number;day:number;silence:number;horde:{active:boolean;spawned:number;budget:number;wave:number;timer:number}};
 v:2;revision:number;time:number;seed:number;contentSeed:number;nextId:number;nextWeaponId:number;nextAcidId:number;wipe:boolean;
 players:PlayerRecord[];infected:Omit<Walker,'path'>[];loot:Simulation['loot'];portals:{id:string;state:Simulation['portals'][number]['state'];hp:number}[];
 facilities:{id:string;state:Simulation['facilities'][number]['state']}[];ground:Simulation['groundWeapons'];corpses:Simulation['corpses']['bodies'];acids:Simulation['acids'];activated:string[];
}
/** Prototype coordinator running in the MasterClient browser, NOT a trusted server. */
export class CoopWorld {
 readonly sim:Simulation;readonly actors=new Map<number,ActorRecord>();readonly registry=new NetworkEntityRegistry<object>();
 time=0;revision=0;wipe=false;effects:SessionEffect[]=[];private drops=new Set<number>();private cityClock=0;
 constructor(seed:number,members:number[],source?:Simulation){
  this.sim=source?source.cloneForCoop():new Simulation(undefined,seed);this.sim.coopMode='actor';this.sim.firstPerson=true;this.sim.onCoopDamage=(player,damage,origin)=>{const actor=[...this.actors.values()].find(a=>a.sim.player===player);if(actor)this.damage(actor.actor,damage,origin);};
  for(const actor of members)this.addActor(actor,members,source);
  if(source){this.time=source.stats.seconds;for(const z of source.zombies)if(!z.active)this.drops.add(z.id);}
  this.refreshRegistry();
 }
 private addActor(actor:number,members:number[],source?:Simulation){
  const s=source?source.cloneForCoop():new Simulation(undefined,this.sim.runSeed);s.coopMode='actor';s.firstPerson=true;
  if(!source){s.loadout[1]!.uid=actor*1000000;Object.assign(s.player,spawnFor(members,actor));s.player.eyeY=floorHeight(s.player)+1.72;}
  s.zombies=[];
  this.actors.set(actor,{actor,sim:s,life:'alive',bleed:0,lastSeq:0,shotSeq:0,lastFire:-100,holdAt:-100,reviveTarget:0,reviveProgress:0,intentAt:-100,lastDamage:-100});this.bind(s);
 }
 static fromSolo(source:Simulation,actor:number){return new CoopWorld(source.runSeed,[actor],source);}
 private bind(s:Simulation){s.crafting=this.sim.crafting;s.baseHP=this.sim.baseHP;s.cycle=this.sim.cycle;s.horde=this.sim.horde;s.coopTargets=[...this.actors.values()].filter(a=>a.life!=='dead').map(a=>a.sim.player);s.zombies=this.sim.zombies;s.loot=this.sim.loot;s.facilities=this.sim.facilities;s.portals=this.sim.portals;s.barricades=this.sim.barricades;s.groundWeapons=this.sim.groundWeapons;s.corpses=this.sim.corpses;s.acids=this.sim.acids;s.nextWeaponId=this.sim.nextWeaponId;s.contentSeed=this.sim.contentSeed;}
 private compact(event:GameEvent):GameEvent{return 'position' in event&&event.position?{...event,position:{x:event.position.x,z:event.position.z}}:event;}
 private collect(a:ActorRecord){this.sim.baseHP=a.sim.baseHP;this.sim.nextWeaponId=a.sim.nextWeaponId;this.sim.contentSeed=a.sim.contentSeed;for(const event of a.sim.events)this.effects.push({actor:a.actor,shot:a.shotSeq,event:this.compact(event)});a.sim.events=[];}
 setMembers(members:number[]){let changed=false;for(const actor of this.actors.keys())if(!members.includes(actor)){this.actors.delete(actor);changed=true;}for(const actor of members)if(!this.actors.has(actor)){this.addActor(actor,members);changed=true;}if(changed)this.refreshRegistry();return changed;}
 setPose(actor:number,pose:PlayerSnapshot){const a=this.actors.get(actor);if(!a||a.life!=='alive')return;Object.assign(a.sim.player,{x:pose.x,z:pose.z,angle:pose.yaw,pitch:pose.pitch,crouched:pose.locomotion===3,running:pose.locomotion===2,moving:pose.locomotion!==0});a.sim.player.eyeY=floorHeight(a.sim.player)+(a.sim.player.crouched?1.08:1.72);}
 request(actor:number,r:ActionRequest):boolean {
  const a=this.actors.get(actor);if(!a||r.seq<=a.lastSeq||this.wipe)return false;a.lastSeq=r.seq;
  if(a.life!=='alive')return false;const s=a.sim;
  // Presence remains client-owned, but actions cannot originate far from its latest position.
  if(distance(s.player,r.pose)>2.5)return false;this.setPose(actor,r.pose);this.bind(s);s.focus=interactionFocus(s);
  if(r.kind==='fire'){
   if(r.shot<=a.shotSeq)return false;a.shotSeq=r.shot;
   if(s.equipped.type!==r.weapon||r.seed!==shotSeed(actor,r.shot)||s.player.running||s.shotTimer>1e-8||s.switchTimer>0||(!s.meleeMode&&s.ammo<=0)||s.reloadTimer>0&&s.weapon.reloadStyle!=='shell'||this.time-a.lastFire<s.weapon.cooldown*.85)return false;
   a.reviveTarget=0;a.reviveProgress=0;s.player.ads=r.ads;s.player.bloom=r.bloom;s.player.aimKick=r.kick;s.seed=r.seed;const timer=s.shotTimer;s.shoot();if(s.shotTimer===timer)return false;a.lastFire=this.time;this.sim.noise(s.player,s.weapon.noise);this.collect(a);this.makeDrops();return true;
  }
  if(r.kind==='chest-move')return moveChest(s,r.move);
  if(r.kind==='reclaim-chest')return reclaimChest(s,r.chest);
  if(r.kind==='place-chest'){const ok=placeChest(s);this.collect(a);return ok;}
  if(r.kind==='craft'){const ok=craft(s,r.recipe);this.collect(a);return ok;}
  if(r.kind==='reclaim-bench'){const ok=reclaimBench(s,r.table);this.collect(a);return ok;}
  if(r.kind==='place-bench'){const ok=placeBench(s);this.collect(a);return ok;}
  if(r.kind==='melee-equip'){if(!s.gear.owned.includes(r.melee))return false;s.gear.melee=r.melee;s.switchWeapon(2);this.collect(a);return true;}
  if(r.kind==='dismantle'){s.update(0,{...idle,dismantle:true});this.collect(a);return true;}
  if(r.kind==='reload'){if(s.player.running)return false;s.reload();this.collect(a);return true;}
  if(r.kind==='switch'){s.switchWeapon(r.slot);this.collect(a);return true;}
  if(r.kind==='cancel'){s.action=null;s.cancelReload();a.reviveTarget=0;a.intent=undefined;return true;}
  if(r.kind==='hold'){a.worldHeld=r.held&&!r.target;a.holdAt=this.time;if(!r.held||a.reviveTarget!==r.target)a.reviveProgress=0;a.reviveTarget=r.held?r.target:0;return true;}
  if(r.kind==='inventory'){s.manage(r.operation,r.item);return true;}
  if(r.kind==='store'){return s.storeWeapon(r.slot);}
  if(r.kind==='retrieve'){return s.retrieveWeapon(r.uid);}
  if(r.kind==='heal'){s.update(0,{...idle,heal:true});this.collect(a);return true;}
  if(r.kind!=='interact'||this.time-a.intentAt<.15)return false;
  const f=s.focus;if(!f||!['portal','loot','weapon','facility','defense','base'].includes(f.kind))return false;
  if(f.kind==='defense'||f.kind==='base'){if(r.target!==entityId('container',f.id))return false;s.update(0,{...idle,interact:true});this.collect(a);return true;}
  const id=entityId(f.kind==='portal'?'door':f.kind==='loot'||f.kind==='facility'?'container':'weapon',f.id);
  if(id!==r.target||!this.registry.get(id))return false;
  a.intent=id;a.intentAt=this.time;
  // Sequential requests + shared object references make pickups atomic on this coordinator.
  s.update(0,{...idle,interact:true});this.collect(a);this.refreshRegistry();return true;
 }
 damage(actor:number,amount:number,source?:{x:number;z:number}){
  const a=this.actors.get(actor);if(!a||a.life!=='alive'||!Number.isFinite(amount)||amount<=0||a.sim.player.invulnerable>0)return;
  a.sim.player.hp=Math.max(0,a.sim.player.hp-absorb(a.sim,amount));a.sim.player.invulnerable=.55;a.sim.action=null;a.sim.cancelReload();a.reviveProgress=0;a.reviveTarget=0;a.lastDamage=this.time;
  this.effects.push({actor,shot:0,event:{type:'hurt',position:source}});
  if(!a.sim.player.hp){a.life='downed';a.bleed=COOP.bleedout;this.effects.push({actor,shot:0,event:{type:'notice',text:'Sobrevivente incapacitado',sub:'Aproxime-se e segure E para reviver.'}});}
 }
 private makeDrops(){for(const z of this.sim.zombies)if(!z.active&&!this.drops.has(z.id)){this.drops.add(z.id);infectedLoot(this.sim,z);}}
 step(dt:number){
  if(this.wipe)return;this.time+=dt;
  for(const a of this.actors.values()){
   this.bind(a.sim);
   if(a.life==='alive'){
    // Shared containers may be emptied while another survivor is searching them.
    if(a.sim.action?.kind==='search'){const l=this.sim.loot.find(l=>l.id===a.sim.action!.target);if(!l||l.searched&&!itemKeys.some(k=>l.contents[k])){a.sim.action=null;this.effects.push({actor:a.actor,shot:0,event:{type:'notice',text:'Já recolhido',sub:'Outro sobrevivente pegou esses itens.'}});}}
    if(a.sim.action?.kind==='facility'){const f=this.sim.facilities.find(f=>f.id===a.sim.action!.target);if(f?.state!=='ready'){a.sim.action=null;this.effects.push({actor:a.actor,shot:0,event:{type:'notice',text:'Já aberto',sub:'Outro sobrevivente abriu este container.'}});}}
    if(a.sim.action?.kind==='portal'){const door=this.sim.portals.find(p=>p.id===a.sim.action!.target);if(door?.state==='open')a.sim.action=null;}
    // Authoritative survivor timers run once; movement is supplied by validated presence.
    a.sim.update(dt,{...idle,heldInteract:!!a.worldHeld&&this.time-a.holdAt<COOP.holdTimeout,run:a.sim.player.running,crouch:a.sim.player.crouched,ads:a.sim.player.ads});this.collect(a);
   }else if(a.life==='downed'){a.bleed=Math.max(0,a.bleed-dt);if(!a.bleed)a.life='dead';}
   const target=this.actors.get(a.reviveTarget);
   const reachable=target&&distance(a.sim.player,target.sim.player)<=COOP.reviveRange&&this.clearLine(a.sim.player,target.sim.player);
   if(a.life!=='alive'||!target||target.life!=='downed'||!reachable||this.time-a.holdAt>COOP.holdTimeout){a.reviveTarget=0;a.reviveProgress=0;}
   else {a.reviveProgress+=dt;if(a.reviveProgress>=COOP.reviveTime){target.life='alive';target.bleed=0;target.sim.player.hp=COOP.reviveHP;target.sim.player.invulnerable=2;a.reviveProgress=0;a.reviveTarget=0;this.effects.push({actor:target.actor,shot:0,event:{type:'healed'}});}}
  }
  const alive=[...this.actors.values()].filter(a=>a.life==='alive');
  if(!alive.length||this.sim.baseHP<=0){this.wipe=true;return;}
  this.sim.updateCoopWorld(dt,alive.map(a=>a.sim.player));for(const event of this.sim.events)this.effects.push({actor:0,shot:0,event:this.compact(event)});this.sim.events=[];
  this.cityClock-=dt;if(this.cityClock<=0){this.cityClock=1;this.spawnCity(alive);}
  this.makeDrops();this.sim.loot=this.sim.loot.filter(l=>!l.id.startsWith('infected-')||itemKeys.some(k=>l.contents[k]));this.refreshRegistry();
 }
 private clearLine(a:{x:number;z:number},b:{x:number;z:number}){const d=distance(a,b);return d<.01||wallDistance(a,{x:(b.x-a.x)/d,z:(b.z-a.z)/d},d,this.sim.solidDefenses)>=d-.1;}
 private spawnCity(alive:ActorRecord[]){for(const site of CITY_SITES){if(this.sim.activatedSites.has(site.id)||!alive.some(a=>distance(a.sim.player,site)<45)||this.sim.activeWalkers>28)continue;
  const kinds=cityEncounter(site,1,100);const candidates=[];for(const z of [-.3,0,.3])for(const x of [-2,2])candidates.push({x:site.x+x,z:site.z+site.d*z});
  const positions=candidates.filter(p=>!collides(p,.7,this.sim.solidDefenses)&&alive.every(a=>distance(p,a.sim.player)>14));if(positions.length<kinds.length)continue;
  kinds.forEach((kind,i)=>this.sim.spawn(positions[i],kind));this.sim.activatedSites.add(site.id);
 }}
 refreshRegistry(){this.registry.clear();for(const z of this.sim.zombies)if(z.active)this.registry.register(entityId('infected',z.id),z);for(const l of this.sim.loot)this.registry.register(entityId('container',l.id),l);for(const f of this.sim.facilities)this.registry.register(entityId('container',f.id),f);for(const d of this.sim.portals)this.registry.register(entityId('door',d.id),d);for(const g of this.sim.groundWeapons)this.registry.register(entityId('weapon',g.item.uid),g);for(const a of this.actors.values())this.registry.register(entityId('player',a.actor),a);}
 checkpoint():WorldCheckpoint {
  const s=this.sim;const players:PlayerRecord[]=[...this.actors.values()].map(a=>({actor:a.actor,perks:[...a.sim.perks],builderUsed:a.sim.builderUsed,openingReady:a.sim.openingReady,life:a.life,bleed:a.bleed,lastSeq:a.lastSeq,shotSeq:a.shotSeq,lastFire:a.lastFire,player:a.sim.player,inventory:a.sim.inventory.items,storage:a.sim.storage.items,loadout:a.sim.loadout,activeSlot:a.sim.activeSlot,gear:a.sim.gear,packCrafted:a.sim.packCrafted,capacity:a.sim.inventory.capacity,reloadTimer:a.sim.reloadTimer,reloadDuration:a.sim.reloadDuration,shotTimer:a.sim.shotTimer,switchTimer:a.sim.switchTimer,action:a.sim.action,weaponStorage:a.sim.weaponStorage,reviveTarget:a.reviveTarget,reviveProgress:a.reviveProgress}));
  const infected=s.zombies.filter(z=>z.active).map(({path:_path,...z})=>z);
  const corpses=s.corpses.bodies.map(c=>({id:c.id,x:c.x,z:c.z,angle:c.angle,fall:c.fall,variant:c.variant,age:c.age,wounds:c.wounds,kind:c.kind}));
  return JSON.parse(JSON.stringify({survival:{crafting:s.crafting,barricades:s.barricades,baseHP:s.baseHP,phase:s.phase,elapsed:s.cycle.elapsed,day:s.day,silence:s.cycle.silence,horde:{active:s.horde.active,spawned:s.horde.spawned,budget:s.horde.budget,wave:s.horde.wave,timer:s.horde.timer}},v:2,revision:++this.revision,time:this.time,seed:s.seed,contentSeed:s.contentSeed,nextId:s.nextId,nextWeaponId:s.nextWeaponId,nextAcidId:s.nextAcidId,wipe:this.wipe,players,infected,loot:s.loot,facilities:s.facilities.map(f=>({id:f.id,state:f.state})),portals:s.portals.map(p=>({id:p.id,state:p.state,hp:p.hp})),ground:s.groundWeapons,corpses,acids:s.acids,activated:[...s.activatedSites]})) as WorldCheckpoint;
 }
 static restore(seed:number,c:WorldCheckpoint,members:number[]){
  const world=new CoopWorld(seed,c.players.map(p=>p.actor));world.time=c.time;world.revision=c.revision;world.wipe=c.wipe;const s=world.sim;
  Object.assign(s,{seed:c.seed,contentSeed:c.contentSeed,nextId:c.nextId,nextWeaponId:c.nextWeaponId,nextAcidId:c.nextAcidId});s.zombies=c.infected.map(z=>({...structuredClone(z),path:[],replan:0}));s.loot=structuredClone(c.loot);s.groundWeapons=structuredClone(c.ground);s.corpses.bodies=structuredClone(c.corpses);s.acids=structuredClone(c.acids);s.activatedSites=new Set(c.activated);
  restoreSurvival(s,c.survival);
  for(const f of c.facilities){const local=s.facilities.find(v=>v.id===f.id);if(local)local.state=f.state;}
  for(const p of c.portals){const door=s.portals.find(d=>d.id===p.id);if(door)Object.assign(door,p);}
  for(const p of c.players){const a=world.actors.get(p.actor)!;Object.assign(a,{life:p.life,bleed:p.bleed,lastSeq:p.lastSeq,shotSeq:p.shotSeq,lastFire:p.lastFire});Object.assign(a.sim.player,p.player);a.sim.perks=new Set(p.perks);a.sim.builderUsed=p.builderUsed;a.sim.openingReady=p.openingReady;a.sim.inventory.items={...p.inventory};a.sim.storage.items={...p.storage};a.sim.loadout=structuredClone(p.loadout);a.sim.activeSlot=p.activeSlot;a.sim.gear=structuredClone(p.gear);a.sim.packCrafted=p.packCrafted;a.sim.inventory.capacity=p.capacity;a.sim.reloadTimer=p.reloadTimer;a.sim.reloadDuration=p.reloadDuration;a.sim.shotTimer=p.shotTimer;a.sim.switchTimer=p.switchTimer;a.sim.weaponStorage=structuredClone(p.weaponStorage);a.sim.action=null;world.bind(a.sim);}
  world.setMembers(members);world.refreshRegistry();return world;
 }
}

export function restoreSurvival(s:Simulation,v:WorldCheckpoint['survival']){s.crafting=structuredClone(v.crafting);s.barricades=structuredClone(v.barricades);s.baseHP=v.baseHP;s.cycle.seek(v.phase,v.elapsed);s.cycle.day=v.day;s.cycle.silence=v.silence;s.horde.start(v.day);Object.assign(s.horde,v.horde);}
