import {CITY_LIMIT} from '../game/city.ts';
import type {WeaponId} from '../game/weapons';
import type {LifeState} from './gameplay-protocol';
/** Shared version/build boundary. Gameplay messages live in gameplay-protocol.ts. */
export const NETWORK_PROTOCOL_VERSION=2;
export const NETWORK_BUILD='santa-luz-browser-lan-1';
export const NETWORK_SEND_RATE=20;
export const INTERPOLATION_DELAY=120;
export const MAX_PLAYERS=4;
export const LAN_CODE=/^L-[A-F0-9]{10}$/;
export const NetworkEventCode={PlayerSnapshot:1,GameStart:2} as const;
export type ConnectionState='disconnected'|'connecting'|'connected'|'joining'|'lobby'|'loading'|'playing'|'error';
export type RoomState='lobby'|'loading'|'playing';
export interface NetworkPlayerIdentity {actorNumber:number;playerId:string;displayName:string;isLocal:boolean;isHost:boolean;ready:boolean}
export interface StartData {seed:number;actors:number[];token:string}
export interface PlayerSnapshot {sequence:number;time:number;x:number;y:number;z:number;yaw:number;pitch:number;vx:number;vz:number;locomotion:0|1|2|3}
export interface RemotePlayerState {identity:NetworkPlayerIdentity;snapshot:PlayerSnapshot|null;gameplay?:{life:LifeState;hp:number;weapon:WeaponId;melee?:import('../game/crafting').MeleeId;reload:number;reloadDuration:number}}
// Region prefix makes a shared code route to the creator's region, even across continents.
export const REGIONS:Record<string,string>={A:'asia',B:'au',C:'cae',D:'cn',E:'eu',F:'hk',G:'in',H:'jp',J:'kr',K:'ru',M:'rue',N:'sa',P:'tr',Q:'uae',R:'us',S:'usw',T:'ussc',U:'usn',V:'za'};
export const CODE_ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function normalizeCode(value:string){return value.trim().toUpperCase();}
export function validCode(value:string){return /^[A-HJKMNP-Z2-9]{6}$/.test(value)&&!!REGIONS[value[0]];}
export function roomRegion(code:string){return validCode(code)?REGIONS[code[0]]:undefined;}
export function generateCode(region:string,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296){
 const prefix=Object.keys(REGIONS).find(k=>REGIONS[k]===region);if(!prefix)throw new Error('Região não suportada.');
 return prefix+Array.from({length:5},()=>CODE_ALPHABET[Math.min(CODE_ALPHABET.length-1,Math.floor(random()*CODE_ALPHABET.length))]).join('');
}
export function sanitizeName(name:unknown){return typeof name==='string'?Array.from(name.normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu,'').replace(/\s+/g,' ').trim()).slice(0,20).join(''):'';}
export function validName(name:string){return Array.from(name).length>=2&&Array.from(name).length<=20;}
export function canStart(players:NetworkPlayerIdentity[],actor:number){return players.length>=1&&players.length<=4&&players.some(p=>p.actorNumber===actor&&p.isHost)&&players.every(p=>p.isHost||p.ready);}
export const SPAWNS=[{x:-1,z:4},{x:3,z:4},{x:-1,z:7},{x:3,z:7}] as const;
export function spawnFor(actors:number[],actor:number){const i=[...actors].sort((a,b)=>a-b).indexOf(actor);if(i<0||i>3)throw new Error('Slot inválido.');return SPAWNS[i];}
const quant=(n:number,step:number)=>Math.round(n*step)/step;
export function encodeSnapshot(s:PlayerSnapshot):number[]{return [NETWORK_PROTOCOL_VERSION,s.sequence,s.time,quant(s.x,100),quant(s.y,100),quant(s.z,100),quant(s.yaw,1000),quant(s.pitch,1000),quant(s.vx,100),quant(s.vz,100),s.locomotion];}
export function parseSnapshot(data:unknown):PlayerSnapshot|null{
 if(!Array.isArray(data)||data.length!==11||data.some(n=>typeof n!=='number'||!Number.isFinite(n)))return null;
 const [v,sequence,time,x,y,z,yaw,pitch,vx,vz,locomotion]=data;
 if(v!==NETWORK_PROTOCOL_VERSION||!Number.isSafeInteger(sequence)||sequence<0||sequence>2147483647||time<0||time>1e13||Math.abs(x)>CITY_LIMIT+1||Math.abs(z)>CITY_LIMIT+1||y<-.5||y>12||Math.abs(yaw)>Math.PI+.01||Math.abs(pitch)>1.5||Math.abs(vx)>12||Math.abs(vz)>12||![0,1,2,3].includes(locomotion))return null;
 return {sequence,time,x,y,z,yaw,pitch,vx,vz,locomotion};
}
export function parseStart(data:unknown,members:number[]):StartData|null{
 if(!data||typeof data!=='object')return null;const d=data as Partial<StartData>;
 if(!Number.isInteger(d.seed)||d.seed!<0||d.seed!>4294967295||typeof d.token!=='string'||!/^[a-zA-Z0-9-]{8,40}$/.test(d.token)||!Array.isArray(d.actors)||d.actors.length<1||d.actors.length>4||d.actors.some(n=>!Number.isInteger(n)||n<1)||new Set(d.actors).size!==d.actors.length)return null;
 if([...d.actors].sort((a,b)=>a-b).join()!==[...members].sort((a,b)=>a-b).join())return null;
 return d as StartData;
}

/** randomUUID requires HTTPS; LAN HTTP still provides getRandomValues. */
export function sessionToken(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');}
