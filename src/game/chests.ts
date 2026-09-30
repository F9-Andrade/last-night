import type {Simulation} from './simulation.ts';
import {itemKeys} from './inventory.ts';
import type {Item} from './inventory.ts';
import {WEAPONS} from './weapons.ts';
import type {WeaponItem} from './weapons.ts';
import {distance,rayWorld} from './world.ts';
import {lookDirection} from './first-person.ts';
import {placement} from './crafting.ts';
export const CHEST_SLOTS=27, CHEST_STACK=64, CHEST_LIMIT=24;
export type ChestStack={item:Item;amount:number}|{weapon:WeaponItem};
export interface Chest {id:number;x:number;y:number;z:number;angle:number;revision:number;slots:(ChestStack|null)[]}
export type ChestSource={bag:Item}|{slot:number}|{weapon:0|1};
export interface ChestMove {chest:number;revision:number;source:ChestSource;target:number|'bag'|'auto';amount:number}
export function validChestMove(v:unknown):v is ChestMove {
 if(!v||typeof v!=='object')return false;const d=v as ChestMove,s=d.source;const index=(n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<CHEST_SLOTS;
 return Number.isSafeInteger(d.chest)&&d.chest>0&&Number.isSafeInteger(d.revision)&&d.revision>=0&&Number.isInteger(d.amount)&&d.amount>0&&d.amount<=64&&(d.target==='bag'||d.target==='auto'||index(d.target))&&!!s&&typeof s==='object'&&Object.keys(s).length===1&&('bag' in s?itemKeys.includes(s.bag):'weapon' in s?s.weapon===0||s.weapon===1:'slot' in s&&index(s.slot));
}
export function usableChest(s:Simulation,id:number):boolean {
 const c=s.crafting.chests.find(c=>c.id===id);if(!c||s.gameOver||s.player.hp<=0||distance(c,s.player)>3)return false;
 const d=distance(c,s.player),origin={x:s.player.x,y:s.player.eyeY,z:s.player.z},dy=c.y+.65-origin.y;
 return d<.01||rayWorld(origin,{x:(c.x-origin.x)/d,y:dy/d,z:(c.z-origin.z)/d},d,s.solidDefenses.filter(b=>b.id!==`chest-${id}`))>=d-.05;
}
export function focusedChest(s:Simulation):number|undefined {
 const dir=lookDirection(s.player.angle,s.player.pitch),p=s.player;
 return s.crafting.chests.filter(c=>usableChest(s,c.id)).sort((a,b)=>distance(a,p)-distance(b,p)).find(c=>{const along=(c.x-p.x)*dir.x+(c.z-p.z)*dir.z,y=p.eyeY+dir.y*along;return along>0&&Math.abs((c.x-p.x)*dir.z-(c.z-p.z)*dir.x)<.8&&y>=c.y-.15&&y<=c.y+1.2;})?.id;
}
export function placeChest(s:Simulation):boolean {
 const p=placement(s);if(s.gameOver||s.player.hp<=0||s.action||!p.valid||s.crafting.chests.length>=CHEST_LIMIT||!s.inventory.take('chest',1)){s.notice('LOCAL INDISPONÍVEL','Escolha um chão livre. Limite de 24 baús.');return false;}
 s.crafting.chests.push({id:s.crafting.next++,x:p.x,y:p.y,z:p.z,angle:p.angle,revision:0,slots:Array.from({length:CHEST_SLOTS},()=>null)});s.crafting.revision++;s.notice('BAÚ POSICIONADO','Mire no baú e use o botão direito para abrir.');return true;
}
/** Atomic coordinator transaction. Stale selections never act on a replacement stack. */
export function moveChest(s:Simulation,m:ChestMove):boolean {
 if(!validChestMove(m)||!usableChest(s,m.chest)||s.action||s.reloadTimer)return false;
 const c=s.crafting.chests.find(c=>c.id===m.chest)!;if(c.revision!==m.revision)return false;
 const from=m.source,entry:ChestStack|null='slot' in from?c.slots[from.slot]:'bag' in from?(s.inventory.items[from.bag]?{item:from.bag,amount:s.inventory.items[from.bag]}:null):s.loadout[from.weapon]?{weapon:s.loadout[from.weapon]!}:null;
 if(!entry)return false;
 let amount='item' in entry?Math.min(m.amount,entry.amount):1;
 if(m.target==='bag'){
  if(!('slot' in from))return false;
  if('item' in entry){amount=s.inventory.add(entry.item,amount);if(!amount)return false;entry.amount-=amount;if(!entry.amount)c.slots[from.slot]=null;}
  else {const slot=WEAPONS[entry.weapon.type].slot,old=s.loadout[slot];s.loadout[slot]=entry.weapon;c.slots[from.slot]=old?{weapon:old}:null;s.activeSlot=slot;s.cancelReload();s.switchTimer=.32;}
 }else{
  const targets=m.target==='auto'?[...c.slots.keys()].filter(i=>'item' in entry&&c.slots[i]&&'item' in c.slots[i]!&&(c.slots[i] as {item:Item}).item===entry.item).concat([...c.slots.keys()].filter(i=>!c.slots[i])):[m.target];
  let left=amount;
  for(const i of targets){if('slot' in from&&i===from.slot)continue;const dest=c.slots[i];
   if(!dest){const n='item' in entry?Math.min(left,CHEST_STACK):1;c.slots[i]='item' in entry?{item:entry.item,amount:n}:{weapon:entry.weapon};left-=n;}
   else if('item' in entry&&'item' in dest&&entry.item===dest.item){const n=Math.min(left,CHEST_STACK-dest.amount);dest.amount+=n;left-=n;}
   else if('slot' in from&&m.target!=='auto'&&amount===('item' in entry?entry.amount:1)){c.slots[from.slot]=dest;c.slots[i]=entry;c.revision++;return true;}
   if(!left)break;
  }
  const moved=amount-left;if(!moved)return false;
  if('slot' in from){if('item' in entry){entry.amount-=moved;if(!entry.amount)c.slots[from.slot]=null;}else c.slots[from.slot]=null;}
  else if('bag' in from)s.inventory.take(from.bag,moved);
  else {s.loadout[from.weapon]=null;if(s.activeSlot===from.weapon)s.activeSlot=s.loadout[from.weapon===0?1:0]?from.weapon===0?1:0:3;s.cancelReload();s.switchTimer=.32;}
 }
 c.revision++;return true;
}
export function reclaimChest(s:Simulation,id:number):boolean {
 const c=s.crafting.chests.find(c=>c.id===id);if(!c||!usableChest(s,id)||s.action||c.slots.some(Boolean)||!s.inventory.add('chest',1))return false;
 s.crafting.chests.splice(s.crafting.chests.indexOf(c),1);s.crafting.revision++;return true;
}
