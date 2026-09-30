import type {WorldCheckpoint} from './coop-world.ts';
import {parseCheckpoint} from './checkpoint.ts';
import {boundedJSON} from './gameplay-protocol.ts';
type Row={id:string|number};
interface Changes<T> {upsert:T[];remove:(string|number)[]}
export interface WorldPatch {
 survival:Omit<WorldCheckpoint['survival'],'crafting'>&{crafting:Omit<WorldCheckpoint['survival']['crafting'],'trees'|'chests'>;chests:Changes<WorldCheckpoint['survival']['crafting']['chests'][number]>;trees:Changes<WorldCheckpoint['survival']['crafting']['trees'][number]>};
 base:number;revision:number;time:number;seed:number;contentSeed:number;nextId:number;nextWeaponId:number;nextAcidId:number;wipe:boolean;
 players:WorldCheckpoint['players'];infected:Changes<WorldCheckpoint['infected'][number]>;loot:Changes<WorldCheckpoint['loot'][number]>;portals:Changes<WorldCheckpoint['portals'][number]>;
 facilities?:WorldCheckpoint['facilities'];ground?:WorldCheckpoint['ground'];corpses?:WorldCheckpoint['corpses'];acids?:WorldCheckpoint['acids'];activated?:string[];
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function changes<T extends Row>(a:T[],b:T[]):Changes<T>{const old=new Map(a.map(v=>[v.id,v]));const ids=new Set(b.map(v=>v.id));return {upsert:b.filter(v=>!same(old.get(v.id),v)),remove:a.filter(v=>!ids.has(v.id)).map(v=>v.id)};}
export function createPatch(a:WorldCheckpoint,b:WorldCheckpoint):WorldPatch {
 const {trees,chests,...crafting}=b.survival.crafting;
 return {survival:{...b.survival,crafting,chests:changes(a.survival.crafting.chests,chests),trees:changes(a.survival.crafting.trees,trees)},base:a.revision,revision:b.revision,time:b.time,seed:b.seed,contentSeed:b.contentSeed,nextId:b.nextId,nextWeaponId:b.nextWeaponId,nextAcidId:b.nextAcidId,wipe:b.wipe,players:b.players,infected:changes(a.infected,b.infected),loot:changes(a.loot,b.loot),portals:changes(a.portals,b.portals),...(!same(a.facilities,b.facilities)?{facilities:b.facilities}:{}),...(!same(a.ground,b.ground)?{ground:b.ground}:{}),...(!same(a.corpses,b.corpses)?{corpses:b.corpses}:{}),...(!same(a.acids,b.acids)?{acids:b.acids}:{}),...(!same(a.activated,b.activated)?{activated:b.activated}:{})};
}
function merge<T extends Row>(rows:T[],change:Changes<T>):T[]|null {
 if(!change||!Array.isArray(change.upsert)||!Array.isArray(change.remove)||change.upsert.some(v=>!v||typeof v!=='object'||!('id' in v))||new Set(change.upsert.map(v=>v.id)).size!==change.upsert.length)return null;
 const replacements=new Map(change.upsert.map(v=>[v.id,v])),removed=new Set(change.remove),existing=new Set(rows.map(v=>v.id));return [...rows.filter(v=>!removed.has(v.id)).map(v=>replacements.get(v.id)??v),...change.upsert.filter(v=>!existing.has(v.id)&&!removed.has(v.id))];
}
export function applyPatch(base:WorldCheckpoint,unknown:unknown):WorldCheckpoint|null{
 if(!boundedJSON(unknown)||!unknown||typeof unknown!=='object')return null;const p=unknown as WorldPatch;if(p.base!==base.revision||p.revision<=p.base)return null;
 const infected=merge(base.infected,p.infected),loot=merge(base.loot,p.loot),portals=merge(base.portals,p.portals);if(!infected||!loot||!portals)return null;
 const trees=merge(base.survival.crafting.trees,p.survival?.trees);if(!trees)return null;
 const chests=merge(base.survival.crafting.chests,p.survival?.chests);if(!chests)return null;
 const {trees:treeChanges,chests:chestChanges,...survival}=p.survival;
 return parseCheckpoint({survival:{...survival,crafting:{...base.survival.crafting,...survival.crafting,trees,chests}},v:2,revision:p.revision,time:p.time,seed:p.seed,contentSeed:p.contentSeed,nextId:p.nextId,nextWeaponId:p.nextWeaponId,nextAcidId:p.nextAcidId,wipe:p.wipe,players:p.players,infected,loot,portals,facilities:p.facilities??base.facilities,ground:p.ground??base.ground,corpses:p.corpses??base.corpses,acids:p.acids??base.acids,activated:p.activated??base.activated});
}
