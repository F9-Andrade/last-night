import {Simulation} from '../game/simulation.ts';
import {Inventory,itemKeys} from '../game/inventory.ts';
import {PERKS} from '../game/perks.ts';
import {ENEMIES} from '../game/enemies.ts';
import {CITY_LIMIT} from '../game/city.ts';
import {RARITIES} from '../game/weapons.ts';
import {restoreSurvival} from '../network/coop-world.ts';
import type {PlayerRecord,WorldCheckpoint} from '../network/coop-world.ts';
import {parseCheckpoint,validSavedPlayer,validSavedEnemy} from '../network/checkpoint.ts';
import {CloudError} from './cloud-types.ts';
import type {PlayerSaveRow} from './cloud-types.ts';

export const SAVE_VERSION=1;
type Obj=Record<string,unknown>;
const object=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown,min=-1e9,max=1e9):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const numberList=(v:unknown)=>Array.isArray(v)&&v.length<=10000&&v.every(n=>finite(n,0)&&Number.isInteger(n));
const stringList=(v:unknown)=>Array.isArray(v)&&v.length<=10000&&v.every(s=>typeof s==='string'&&s.length<=128);
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
function invalid():never{throw new CloudError('invalid','Save inválido ou incompatível. Nenhum progresso foi substituído.');}
/** Validate size, depth and dangerous keys before copying database JSON. */
export function safeSaveJSON(value:unknown):boolean {
 let nodes=0;const walk=(v:unknown,depth:number):boolean=>{
  if(++nodes>180000||depth>24)return false;
  if(v===null||typeof v==='boolean')return true;
  if(typeof v==='number')return Number.isFinite(v);
  if(typeof v==='string')return v.length<=4096;
  if(Array.isArray(v))return v.length<=15000&&v.every(x=>walk(x,depth+1));
  if(!object(v))return false;
  return Object.entries(v).every(([key,val])=>!['__proto__','constructor','prototype'].includes(key)&&walk(val,depth+1));
 };return walk(value,0)&&JSON.stringify(value).length<=2000000;
}
export function playerRecord(s:Simulation,actor=1):PlayerRecord {
 return copy({actor,coins:s.coins,life:s.player.hp>0?'alive':'dead',bleed:0,lastSeq:0,shotSeq:0,lastFire:-100,player:s.player,
  perks:[...s.perks],builderUsed:s.builderUsed,openingReady:s.openingReady,nutrition:s.nutrition,consumption:s.consumption,
  inventory:s.inventory.items,storage:s.storage.items,loadout:s.loadout,activeSlot:s.activeSlot,gear:s.gear,packCrafted:s.packCrafted,capacity:s.inventory.capacity,
  reloadTimer:s.reloadTimer,reloadDuration:s.reloadDuration,shotTimer:s.shotTimer,switchTimer:s.switchTimer,action:null,weaponStorage:s.weaponStorage,reviveTarget:0,reviveProgress:0});
}
export function applyPlayerRecord(s:Simulation,p:PlayerRecord):void {
 if(!safeSaveJSON(p)||!validSavedPlayer(p))invalid();const r=copy(p);
 Object.assign(s.player,r.player,{moving:false,running:false,ads:false});
 s.perks=new Set(r.perks);s.builderUsed=r.builderUsed;s.openingReady=r.openingReady;s.nutrition=r.nutrition;s.consumption=r.consumption;
 s.coins=r.coins??0;s.inventory=new Inventory(r.capacity);s.inventory.items=r.inventory;s.storage=new Inventory(Infinity);s.storage.items=r.storage;
 s.loadout=r.loadout;s.activeSlot=r.activeSlot;s.gear=r.gear;s.packCrafted=r.packCrafted;s.weaponStorage=r.weaponStorage;
 s.reloadTimer=r.reloadTimer;s.reloadDuration=r.reloadDuration;s.shotTimer=r.shotTimer;s.switchTimer=r.switchTimer;s.action=null;s.events=[];
}
export interface PlayerPayload extends Omit<PlayerSaveRow,'updated_at'> {}
export function serializePlayer(s:Simulation,worldId:string,userId:string,confirmed?:PlayerRecord):PlayerPayload {
 const record=confirmed?copy(confirmed):playerRecord(s);record.player.x=s.player.x;record.player.z=s.player.z;record.player.angle=s.player.angle;record.player.pitch=s.player.pitch;record.player.eyeY=s.player.eyeY;record.player.stamina=s.player.stamina;
 const value:PlayerPayload={world_id:worldId,user_id:userId,position:{x:record.player.x,y:record.player.eyeY,z:record.player.z},rotation:{x:record.player.pitch,y:record.player.angle,z:0},health:record.player.hp,max_health:s.maxHP,stamina:record.player.stamina,max_stamina:100,
  inventory:record.inventory,weapons:record.loadout,ammo:{ammo:record.inventory.ammo,shells:record.inventory.shells,rifleAmmo:record.inventory.rifleAmmo},perks:record.perks,stats:s.stats,
  extra_data:{schema_version:SAVE_VERSION,record,kills:s.kills,pendingPerks:s.pendingPerks,discoveredSites:[...s.discoveredSites],discoveredWeapons:[...s.discoveredWeapons],seenEnemies:[...s.seenEnemies],gameOver:s.gameOver}};
 if(!safeSaveJSON(value)||!validSavedPlayer(record))invalid();return copy(value);
}
export function deserializePlayer(value:PlayerSaveRow|PlayerPayload,s:Simulation):PlayerRecord {
 if(!safeSaveJSON(value)||!object(value.extra_data))invalid();const extra=value.extra_data;
 if(extra.schema_version!==undefined&&extra.schema_version!==SAVE_VERSION)invalid();
 let record:PlayerRecord;
 if(extra.record!==undefined){if(!validSavedPlayer(extra.record))invalid();record=copy(extra.record);}
 else {
  // Original DATABASE V1 default rows and older column-only saves have safe
  // defaults. Unknown future versions fail closed instead of overwriting them.
  record=playerRecord(s);
  const pos=value.position,rot=value.rotation;if(!object(pos)||!object(rot)||!finite(pos.x,-CITY_LIMIT,CITY_LIMIT)||!finite(pos.z,-CITY_LIMIT,CITY_LIMIT)||!finite(pos.y,-.5,14)||!finite(rot.x,-1.5,1.5)||!finite(rot.y,-Math.PI-.01,Math.PI+.01))invalid();
  Object.assign(record.player,{x:pos.x,z:pos.z,eyeY:pos.y||s.player.eyeY,angle:rot.y,pitch:rot.x,hp:value.health,stamina:value.stamina});
  if(object(value.inventory)){for(const key of itemKeys){const n=value.inventory[key]??0;if(!finite(n,0,10000)||!Number.isInteger(n))invalid();record.inventory[key]=n;}}
  else if(!Array.isArray(value.inventory)||value.inventory.length)invalid();
  if(!Array.isArray(value.weapons)||value.weapons.length!==0&&value.weapons.length!==2)invalid();if(value.weapons.length===2)record.loadout=copy(value.weapons) as PlayerRecord['loadout'];
  if(!Array.isArray(value.perks)||!value.perks.every(p=>typeof p==='string'&&Object.hasOwn(PERKS,p)))invalid();record.perks=value.perks;record.life=record.player.hp>0?'alive':'dead';
 }
 // Both representations are checked; never let invalid independent columns pass.
 if(!finite(value.health,0,115)||!finite(value.stamina,0,100)||!finite(value.max_health,1,115)||!finite(value.max_stamina,1,100)||!validSavedPlayer(record))invalid();
 if(extra.pendingPerks!==undefined&&(!Array.isArray(extra.pendingPerks)||extra.pendingPerks.length>12||!extra.pendingPerks.every(p=>typeof p==='string'&&Object.hasOwn(PERKS,p))))invalid();
 if(extra.discoveredSites!==undefined&&!stringList(extra.discoveredSites)||extra.discoveredWeapons!==undefined&&!numberList(extra.discoveredWeapons)||extra.seenEnemies!==undefined&&(!stringList(extra.seenEnemies)||!(extra.seenEnemies as string[]).every(k=>Object.hasOwn(ENEMIES,k))))invalid();
 if(extra.kills!==undefined&&!finite(extra.kills,0)||extra.gameOver!==undefined&&typeof extra.gameOver!=='boolean')invalid();
 if(!object(value.stats))invalid();const stats={...s.stats};for(const key of Object.keys(stats) as (keyof typeof stats)[]){const n=value.stats[key];if(n===undefined)continue;if(key==='bestRarity'){if(typeof n!=='string'||!Object.hasOwn(RARITIES,n))invalid();stats[key]=n as typeof stats.bestRarity;}else{if(!finite(n,0))invalid();stats[key]=n;}}
 applyPlayerRecord(s,record);s.stats=stats;s.kills=(extra.kills as number|undefined)??0;s.pendingPerks=copy(extra.pendingPerks??[]) as Simulation['pendingPerks'];
 s.discoveredSites=new Set((extra.discoveredSites??[]) as string[]);s.discoveredWeapons=new Set((extra.discoveredWeapons??[0]) as number[]);s.seenEnemies=new Set((extra.seenEnemies??[]) as Simulation['seenEnemies'] extends Set<infer T>?T[]:never);
 s.gameOver=extra.gameOver===true||record.life==='dead';return record;
}

const sets=['encounters','alarms','vehicleAlarms','escapeClues','equipmentRolled','activatedSites','usedRoaming'] as const;
const timers=['alarmTimer','noiseTimer','generatorPulse','cityTimer','roamTimer','outsideTimer','eventTimer','nextEventId','spawnTimer'] as const;
export interface WorldPayload {format:'last-night';schema_version:1;runSeed:number;checkpoint:WorldCheckpoint;extra:Obj}
export function serializeWorld(s:Simulation,checkpoint?:WorldCheckpoint):WorldPayload {
 const c:WorldCheckpoint=checkpoint?copy(checkpoint):copy({v:2,revision:1,time:s.stats.seconds,seed:s.seed,contentSeed:s.contentSeed,nextId:s.nextId,nextWeaponId:s.nextWeaponId,nextAcidId:s.nextAcidId,wipe:s.gameOver,
  survival:{layoutVersion:s.layoutVersion,economy:s.economy,crafting:s.crafting,barricades:s.barricades,baseHP:s.baseHP,phase:s.phase,elapsed:s.cycle.elapsed,day:s.day,silence:s.cycle.silence,horde:{active:s.horde.active,spawned:s.horde.spawned,budget:s.horde.budget,wave:s.horde.wave,timer:s.horde.timer}},
  players:[],infected:s.zombies.filter(z=>z.active).map(({path:_path,...z})=>z),loot:s.loot,portals:s.portals.map(p=>({id:p.id,state:p.state,hp:p.hp})),facilities:s.facilities.map(f=>({id:f.id,state:f.state})),ground:s.groundWeapons,corpses:s.corpses.bodies.map(c=>({id:c.id,x:c.x,z:c.z,angle:c.angle,fall:c.fall,variant:c.variant,age:c.age,wounds:c.wounds,kind:c.kind})),acids:s.acids,activated:[...s.activatedSites]});
 c.players=[];const extra:Obj={director:copy(s.director),dormant:copy(s.dormantZombies.filter(z=>z.active).map(({path:_path,...z})=>z)),worldEvent:copy(s.worldEvent??null),alarmPosition:copy(s.alarmPosition??null)};
 for(const key of sets)extra[key]=[...(Reflect.get(s,key) as Set<unknown>)];for(const key of timers)extra[key]=s[key];
 const value:WorldPayload={format:'last-night',schema_version:SAVE_VERSION,runSeed:s.runSeed,checkpoint:c,extra};validateWorldPayload(value);return copy(value);
}
export function validateWorldPayload(value:unknown):WorldPayload {
 if(!safeSaveJSON(value)||!object(value)||value.format!=='last-night'||value.schema_version!==SAVE_VERSION||!finite(value.runSeed,0,4294967295)||!Number.isInteger(value.runSeed)||!object(value.extra)||!parseCheckpoint(value.checkpoint,true))invalid();
 const e=value.extra;
 for(const key of sets)if(e[key]!==undefined&&!(key==='encounters'||key==='alarms'||key==='usedRoaming'?numberList(e[key]):stringList(e[key])))invalid();
 for(const key of timers)if(e[key]!==undefined&&!finite(e[key],-100,1e9))invalid();
 if(e.dormant!==undefined&&(!Array.isArray(e.dormant)||e.dormant.length>1000||!e.dormant.every(validSavedEnemy)))invalid();
 if(e.worldEvent!==undefined&&e.worldEvent!==null){const ev=e.worldEvent;if(!object(ev)||!finite(ev.x,-CITY_LIMIT,CITY_LIMIT)||!finite(ev.z,-CITY_LIMIT,CITY_LIMIT)||!finite(ev.id,0)||!finite(ev.life,-1,10000)||!['cache','alarm','roaming'].includes(String(ev.kind))||typeof ev.name!=='string'||typeof ev.triggered!=='boolean'||ev.flavor!==undefined&&!['survivor','medical','military','house'].includes(String(ev.flavor)))invalid();}
 if(e.alarmPosition!==undefined&&e.alarmPosition!==null&&(!object(e.alarmPosition)||!finite(e.alarmPosition.x,-CITY_LIMIT,CITY_LIMIT)||!finite(e.alarmPosition.z,-CITY_LIMIT,CITY_LIMIT)))invalid();
 if(e.director!==undefined){const d=e.director;if(!object(d)||!['CALM','SUSPENSE','CONTACT','PRESSURE','PEAK','RELIEF'].includes(String(d.state))||!['elapsed','time','quiet','noise','clock','cueClock'].every(k=>d[k]===undefined||finite(d[k],0))||typeof d.allowPressure!=='boolean'||typeof d.cue!=='boolean'||!Array.isArray(d.transitions)||d.transitions.length>64||!d.transitions.every(t=>object(t)&&finite(t.time,0)&&['CALM','SUSPENSE','CONTACT','PRESSURE','PEAK','RELIEF'].includes(String(t.state))))invalid();}
 return value as unknown as WorldPayload;
}
/** Read only layout metadata before preparing collision arrays; full validation follows. */
export function savedLayoutVersion(value:unknown):0|1 {
 if(!safeSaveJSON(value)||!object(value))invalid();
 if(Object.keys(value).length===0)return 1;
 if(value.format!=='last-night'||value.schema_version!==SAVE_VERSION||!object(value.checkpoint)||!object(value.checkpoint.survival))invalid();
 const version=value.checkpoint.survival.layoutVersion;
 if(version!==undefined&&version!==0&&version!==1)invalid();
 return version??0;
}
export function deserializeWorld(value:unknown,s:Simulation):void {
 if(object(value)&&Object.keys(value).length===0)return;const v=validateWorldPayload(value);if(v.runSeed!==s.runSeed)invalid();const c=copy(v.checkpoint),e=copy(v.extra);
 restoreSurvival(s,c.survival);Object.assign(s,{seed:c.seed,contentSeed:c.contentSeed,nextId:c.nextId,nextWeaponId:c.nextWeaponId,nextAcidId:c.nextAcidId});
 s.zombies=c.infected.map(z=>({...z,path:[],replan:0}));s.loot=c.loot;s.groundWeapons=c.ground;s.corpses.bodies=c.corpses;s.acids=c.acids;s.activatedSites=new Set(c.activated);
 for(const p of c.portals)Object.assign(s.portals.find(d=>d.id===p.id)!,p);for(const f of c.facilities)s.facilities.find(d=>d.id===f.id)!.state=f.state;
 for(const key of sets)if(e[key]!==undefined)Reflect.set(s,key,new Set(e[key] as unknown[]));for(const key of timers)if(e[key]!==undefined)s[key]=e[key] as number;
 s.dormantZombies=((e.dormant??[]) as WorldCheckpoint['infected']).map(z=>({...z,path:[],replan:0}));s.worldEvent=(e.worldEvent??undefined) as Simulation['worldEvent'];s.alarmPosition=(e.alarmPosition??undefined) as Simulation['alarmPosition'];
 if(object(e.director))for(const key of Object.keys(s.director))if(Object.hasOwn(e.director,key))Reflect.set(s.director,key,e.director[key]);
 s.stats.seconds=c.time;s.gameOver=c.wipe;s.events=[];s.focus=null;s.action=null;
}
