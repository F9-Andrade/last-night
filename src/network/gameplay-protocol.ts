import {WEAPONS} from '../game/weapons.ts';
import type {WeaponId} from '../game/weapons.ts';
import type {Item} from '../game/inventory.ts';
import {itemKeys} from '../game/inventory.ts';
import {parseSnapshot,encodeSnapshot} from './protocol.ts';
import type {PlayerSnapshot} from './protocol.ts';
import {validEntityId} from './entities.ts';
import type {NetworkEntityId} from './entities.ts';
export const COOP={bleedout:45,reviveTime:4,reviveHP:40,reviveRange:2.6,holdTimeout:.4,checkpointInterval:.5,nearRate:10,midRate:4,farRate:1,nearDistance:30,midDistance:70,enemyDelay:150,maxEntities:100,maxPayload:220000} as const;
export const GameplayEvent={ActionRequest:10,WorldCheckpoint:11,InfectedMotion:12,Effects:13,WorldPatch:14,RecoveryRequest:15} as const;
export type LifeState='alive'|'downed'|'dead';
interface RequestBase {seq:number;pose:PlayerSnapshot}
export type ActionRequest=RequestBase&(
 {kind:'fire';shot:number;weapon:WeaponId;seed:number;ads:boolean;bloom:number;kick:number}|
 {kind:'reload'|'heal'|'cancel'}|{kind:'switch';slot:0|1}|
 {kind:'interact';target:NetworkEntityId}|{kind:'hold';target:number;held:boolean}|
 {kind:'inventory';item:Item;operation:'deposit'|'withdraw'|'discard'}|
 {kind:'store';slot:0|1}|{kind:'retrieve';uid:number});
const integer=(n:unknown,min=0,max=2147483647):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
export function parseAction(value:unknown):ActionRequest|null {
 if(!boundedJSON(value,200)||!value||typeof value!=='object'||Array.isArray(value))return null;const d=value as Record<string,unknown>;
 if(!integer(d.seq,1)||!d.pose||typeof d.pose!=='object')return null;
 const raw=d.pose as PlayerSnapshot;const p=parseSnapshot([2,raw.sequence,raw.time,raw.x,raw.y,raw.z,raw.yaw,raw.pitch,raw.vx,raw.vz,raw.locomotion]);if(!p)return null;
 const base={seq:d.seq,pose:p};switch(d.kind){
 case 'fire':if(!integer(d.shot,1)||!integer(d.seed,0,4294967295)||typeof d.weapon!=='string'||!Object.hasOwn(WEAPONS,d.weapon)||typeof d.ads!=='boolean'||typeof d.bloom!=='number'||!Number.isFinite(d.bloom)||d.bloom<0||d.bloom>.1||typeof d.kick!=='number'||!Number.isFinite(d.kick)||d.kick<0||d.kick>.13)return null;return {...base,kind:'fire',shot:d.shot,seed:d.seed,weapon:d.weapon as WeaponId,ads:d.ads,bloom:d.bloom,kick:d.kick};
 case 'reload':case 'heal':case 'cancel':return {...base,kind:d.kind};
 case 'switch':case 'store':return d.slot===0||d.slot===1?{...base,kind:d.kind,slot:d.slot}:null;
 case 'retrieve':return integer(d.uid)?{...base,kind:'retrieve',uid:d.uid}:null;
 case 'interact':return validEntityId(d.target)?{...base,kind:'interact',target:d.target}:null;
 case 'hold':return integer(d.target,0)&&typeof d.held==='boolean'?{...base,kind:'hold',target:d.target,held:d.held}:null;
 case 'inventory':return itemKeys.includes(d.item as Item)&&['deposit','withdraw','discard'].includes(String(d.operation))?{...base,kind:'inventory',item:d.item as Item,operation:d.operation as 'deposit'|'withdraw'|'discard'}:null;
 default:return null;
 }
}
export function shotSeed(actor:number,shot:number){return (Math.imul(actor,2654435761)^Math.imul(shot,2246822519))>>>0;}
export function poseOf(p:{x:number;z:number;angle:number;pitch:number;crouched:boolean;running:boolean;moving:boolean},y:number,time:number):PlayerSnapshot{return {sequence:0,time:Math.round(time),x:p.x,y,z:p.z,yaw:p.angle,pitch:p.pitch,vx:0,vz:0,locomotion:p.crouched?3:p.running?2:p.moving?1:0};}
/** Reject deep, huge, non-JSON or non-finite data before schema processing. */
export function boundedJSON(value:unknown,maxNodes=40000):boolean {
 let nodes=0;const visit=(v:unknown,depth:number):boolean=>{if(++nodes>maxNodes||depth>12)return false;if(v===null||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v)&&Math.abs(v)<=1e13;if(typeof v==='string')return v.length<=256;if(Array.isArray(v))return v.length<=2048&&v.every(x=>visit(x,depth+1));if(typeof v==='object'&&v){const entries=Object.entries(v);return entries.length<=80&&entries.every(([k,x])=>!['__proto__','prototype','constructor'].includes(k)&&visit(x,depth+1));}return false;};return visit(value,0);
}
export function normalizedPose(p:PlayerSnapshot){return parseSnapshot(encodeSnapshot(p));}
