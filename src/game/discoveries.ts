import type {Simulation} from './simulation.ts';
import {itemKeys} from './inventory.ts';
import {isFood} from './nutrition.ts';
import {WEAPONS} from './weapons.ts';
import {MELEE} from './crafting.ts';
import {ENEMIES} from './enemies.ts';
import {MERCHANT_PROFILES} from './economy.ts';
import {STRUCTURE_DEFS,structureBaseY} from './construction.ts';
import {floorHeight,rayWorld} from './world.ts';
import {lookDirection} from './first-person.ts';

/** Personal field knowledge. It never belongs to a shared world checkpoint. */
export const DISCOVERY_IDS=[
 ...itemKeys.map(id=>`${isFood(id)?'food':'item'}-${id}`),'item-coins',
 ...['leather','reinforced','pack'].map(id=>`gear-${id}`),
 ...Object.keys(STRUCTURE_DEFS).map(id=>`structure-${id}`),
 ...Object.keys(ENEMIES).map(id=>`infected-${id}`),
 ...Object.keys(WEAPONS).map(id=>`weapon-${id}`),
 ...Object.keys(MELEE).map(id=>`melee-${id}`),
 ...MERCHANT_PROFILES.map(npc=>`npc-${npc.id}`),
] as const;
const allowed=new Set<string>(DISCOVERY_IDS);
export function validDiscoveryIds(value:unknown):value is string[]{
 return Array.isArray(value)&&value.length<=allowed.size&&value.every(id=>typeof id==='string'&&allowed.has(id))&&new Set(value).size===value.length;
}

/** Called at a bounded cadence by the local client, after authoritative coop reconciliation.
 * Catalogs, shop stock, recipes, shared storage and remote inventories never count as finds.
 * Passing observe=false imports only owned equipment (e.g. the starter kit or an old save).
 */
export function scanDiscoveries(s:Simulation,observe=true):string[]{
 const found:string[]=[],learn=(id:string)=>{if(allowed.has(id)&&!s.discoveries.has(id)){s.discoveries.add(id);found.push(id);}};
 if(s.gameOver||s.player.hp<=0)return found;
 for(const item of itemKeys)if(s.inventory.items[item]>0)learn(`${isFood(item)?'food':'item'}-${item}`);
 for(const weapon of s.loadout)if(weapon)learn(`weapon-${weapon.type}`);
 for(const melee of s.gear.owned)learn(`melee-${melee}`);
 if(s.gear.armorTier>=1)learn('gear-leather');if(s.gear.armorTier>=2)learn('gear-reinforced');
 if(s.packCrafted)learn('gear-pack');if(s.coins>0)learn('item-coins');
 if(!observe)return found;
 const origin={x:s.player.x,y:s.player.eyeY,z:s.player.z},look=lookDirection(s.player.angle,s.player.pitch);
 let rays=0;let obstacles:Simulation['solidDefenses']|undefined;
 const visible=(target:{x:number;z:number},y:number,range:number,exclude?:string)=>{
  const dx=target.x-origin.x,dy=y-origin.y,dz=target.z-origin.z,d=Math.hypot(dx,dy,dz);
  if(d>range||d<.05||(dx*look.x+dy*look.y+dz*look.z)/d<.66||rays>=12)return false;
  rays++;obstacles??=s.solidDefenses;
  const blockers=exclude?obstacles.filter(b=>!b.id.startsWith(exclude)):obstacles;
  return rayWorld(origin,{x:dx/d,y:dy/d,z:dz/d},d,blockers)>=d-.15;
 };
 for(const npc of s.economy.merchants){const id=`npc-${npc.id}`;if(!s.discoveries.has(id)&&visible(npc,npc.y+1.35,16,`merchant-${npc.id}-npc`))learn(id);}
 for(const enemy of s.zombies){const id=`infected-${enemy.kind}`;if(enemy.active&&enemy.hp>0&&!s.discoveries.has(id)&&visible(enemy,floorHeight(enemy)+1.25,20))learn(id);}
 for(const body of s.corpses.bodies){const id=`infected-${body.kind??'walker'}`;if(!s.discoveries.has(id)&&visible(body,floorHeight(body)+.35,12))learn(id);}
 for(const table of s.crafting.tables)if(!s.discoveries.has('item-bench')&&table.hp>0&&visible(table,table.y+.9,8,`table-${table.id}`))learn('item-bench');
 for(const chest of s.crafting.chests)if(!s.discoveries.has('item-chest')&&visible(chest,chest.y+.5,8,`chest-${chest.id}`))learn('item-chest');
 for(const piece of s.crafting.structures){
  const id=`structure-${piece.kind}`;
  const y=structureBaseY(piece)+(piece.kind==='roof'?3:piece.kind==='floor'||piece.kind==='snare'?.12:piece.kind==='spikes'?.7:1.4);
  if(piece.hp>0&&!s.discoveries.has(id)&&visible(piece,y,8,`structure-${piece.id}-`))learn(id);
 }
 return found;
}
