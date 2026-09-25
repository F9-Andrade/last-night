import {COOP,boundedJSON} from './gameplay-protocol.ts';
import type {WorldCheckpoint} from './coop-world.ts';
import {WEAPONS,RARITIES,AFFIXES} from '../game/weapons.ts';
import {ENEMIES} from '../game/enemies.ts';
import {itemKeys} from '../game/inventory.ts';
import {CITY_PORTALS} from '../game/city.ts';
import {FACILITIES} from '../game/expedition.ts';
import {LOOT_POINTS} from '../game/loot.ts';
type Obj=Record<string,unknown>;
const obj=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const num=(v:unknown,min=-1e9,max=1e9):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const int=(v:unknown,min=0,max=2147483647)=>num(v,min,max)&&Number.isInteger(v);
const str=(v:unknown,max=128)=>typeof v==='string'&&v.length<=max&&!/[<>]/.test(v);
const pos=(v:unknown):v is Obj=>obj(v)&&num(v.x,-157,157)&&num(v.z,-157,157);
const array=(v:unknown,max:number,check:(x:unknown)=>boolean):v is unknown[]=>Array.isArray(v)&&v.length<=max&&v.every(check);
const stock=(v:unknown)=>obj(v)&&itemKeys.every(k=>int(v[k],0,10000));
const weapon=(v:unknown)=>obj(v)&&int(v.uid)&&typeof v.type==='string'&&Object.hasOwn(WEAPONS,v.type)&&typeof v.rarity==='string'&&Object.hasOwn(RARITIES,v.rarity)&&int(v.magazine,0,100)&&num(v.damageBonus,0,.2)&&num(v.reloadBonus,0,.2)&&num(v.stability,0,.2)&&int(v.capacityBonus,0,10)&&(v.affix===undefined||typeof v.affix==='string'&&Object.hasOwn(AFFIXES,v.affix));
const wounds=(v:unknown)=>array(v,8,w=>obj(w)&&['HEAD','TORSO','ARMS','LEGS'].includes(String(w.zone))&&num(w.side,-1,1)&&num(w.y,-2,8));
const pointOptional=(v:unknown)=>v===undefined||pos(v);
const enemy=(v:unknown)=>pos(v)&&int(v.id)&&typeof v.kind==='string'&&Object.hasOwn(ENEMIES,v.kind)&&num(v.hp,.001,1000)&&v.active===true&&num(v.angle,-100,100)&&wounds(v.wounds)&&['TORSO','HEAD','ARMS','LEGS'].includes(String(v.zone))&&['attack','flash','gait','replan','reaction','side','slow','hearing','windup','spitCooldown'].every(k=>num(v[k],-1e9,1e9))&&typeof v.winding==='boolean'&&pointOptional(v.spitTarget)&&pointOptional(v.lastSeen)&&pointOptional(v.heard)&&pointOptional(v.patrol);
const action=(v:unknown)=>v===null||obj(v)&&['search','portal','heal','facility'].includes(String(v.kind))&&str(v.target)&&pos(v.origin)&&num(v.elapsed,0,60)&&num(v.duration,0,60);
const player=(v:unknown)=>obj(v)&&int(v.actor,1)&&['alive','downed','dead'].includes(String(v.life))&&num(v.bleed,0,60)&&int(v.lastSeq)&&int(v.shotSeq)&&num(v.lastFire,-100,1e9)&&pos(v.player)&&num(v.player.hp,0,115)&&num(v.player.eyeY,-.5,14)&&num(v.player.angle,-Math.PI-.01,Math.PI+.01)&&num(v.player.pitch,-1.5,1.5)&&['stamina','staminaDelay','invulnerable','aimKick','bloom'].every(k=>num((v.player as Obj)[k],0,100))&&['running','moving','crouched','ads','exhausted'].every(k=>typeof (v.player as Obj)[k]==='boolean')&&stock(v.inventory)&&stock(v.storage)&&array(v.loadout,2,w=>w===null||weapon(w))&&v.loadout.length===2&&(v.activeSlot===0||v.activeSlot===1)&&!!v.loadout[v.activeSlot]&&['reloadTimer','reloadDuration','switchTimer','shotTimer','reviveProgress'].every(k=>num(v[k],-.1,60))&&int(v.reviveTarget)&&action(v.action)&&array(v.weaponStorage,48,weapon);
const loot=(v:unknown)=>pos(v)&&str(v.id,80)&&str(v.label)&&['base','hospital','police','market','house','gas','outside'].includes(String(v.area))&&typeof v.searched==='boolean'&&stock(v.contents)&&(v.lastFound===null||itemKeys.includes(v.lastFound as typeof itemKeys[number]));
const unique=(rows:unknown[],key:string)=>new Set(rows.map(v=>(v as Obj)[key])).size===rows.length;
export function parseCheckpoint(value:unknown):WorldCheckpoint|null {
 if(!boundedJSON(value)||!obj(value)||JSON.stringify(value).length>COOP.maxPayload)return null;const c=value;
 if(c.v!==2||!int(c.revision,1)||!num(c.time,0)||!int(c.seed,0,4294967295)||!int(c.contentSeed,0,4294967295)||!int(c.nextId)||!int(c.nextWeaponId)||!int(c.nextAcidId)||typeof c.wipe!=='boolean')return null;
 if(!array(c.players,4,player)||!c.players.length||!unique(c.players,'actor')||!array(c.infected,COOP.maxEntities,enemy)||!unique(c.infected,'id'))return null;
 if(!array(c.loot,700,loot)||!unique(c.loot,'id')||!LOOT_POINTS.every((p,i)=>(c.loot as Obj[])[i]?.id===p.id))return null;
 if(!array(c.portals,CITY_PORTALS.length,p=>obj(p)&&CITY_PORTALS.some(d=>d.id===p.id)&&['open','closed','barred'].includes(String(p.state))&&num(p.hp,0,1000))||c.portals.length!==CITY_PORTALS.length||!unique(c.portals,'id'))return null;
 if(!array(c.facilities,FACILITIES.length,f=>obj(f)&&FACILITIES.some(v=>v.id===f.id)&&['ready','powered','opened'].includes(String(f.state)))||c.facilities.length!==FACILITIES.length||!unique(c.facilities,'id'))return null;
 if(!array(c.ground,48,g=>pos(g)&&weapon(g.item)&&str(g.source)))return null;
 if(!array(c.corpses,100,b=>pos(b)&&int(b.id)&&num(b.age,0,1000)&&num(b.angle)&&num(b.fall)&&int(b.variant,0,4)&&wounds(b.wounds)&&(b.kind===undefined||Object.hasOwn(ENEMIES,String(b.kind)))))return null;
 if(!array(c.acids,8,a=>pos(a)&&int(a.id)&&pos(a.from)&&num(a.age,0,10)&&num(a.tick,-10,10))||!array(c.activated,100,id=>str(id,80)))return null;
 const checkpoint=c as unknown as WorldCheckpoint;
 if(checkpoint.infected.some(z=>z.id>=checkpoint.nextId)||checkpoint.players.some(p=>p.life==='alive'&&p.player.hp<=0||p.life!=='alive'&&p.player.hp!==0))return null;
 return checkpoint;
}
export function stateHash(c:WorldCheckpoint){const text=JSON.stringify([c.revision,c.players.map(p=>[p.actor,p.player.hp,p.life,p.inventory,p.loadout]),c.infected.map(z=>[z.id,z.hp]),c.loot.map(l=>[l.id,l.searched,l.contents]),c.portals,c.facilities,c.wipe]);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16);}
