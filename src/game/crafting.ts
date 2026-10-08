import {moneyDrop} from './economy.ts';
import type {Chest} from './chests.ts';
import {bodyHit} from './combat.ts';
import {LOOT_POINTS} from './loot.ts';
import type {WeaponId} from './weapons.ts';
import type {Simulation, Walker} from './simulation.ts';
import {ITEMS, itemKeys, emptyStock} from './inventory.ts';
import type {Item} from './inventory.ts';
import {BASE, TREE_TRUNKS, collides, distance, floorHeight, rayWorld} from './world.ts';
import {lookDirection} from './first-person.ts';
import type {Vec2} from './world.ts';
import {defenseMaxHP,obstacleDistance} from './defenses.ts';
import type {Structure,StructureKind} from './construction.ts';
const renewableLoot=new Set(LOOT_POINTS.filter(l=>l.area!=='base'&&l.id!=='base-wood').map(l=>l.id));
export const MELEE = {
 fists: {name:'Punhos',damage:14,reach:1.85,cooldown:.58,stamina:8,wood:12},
 club: {name:'Porrete',damage:28,reach:2.1,cooldown:.8,stamina:13,wood:17},
 knife: {name:'Faca de sucata',damage:24,reach:1.85,cooldown:.42,stamina:9,wood:10},
 axe: {name:'Machado',damage:43,reach:2.2,cooldown:.95,stamina:17,wood:42},
 spear: {name:'Lança',damage:32,reach:3,cooldown:.85,stamina:14,wood:12},
 machete: {name:'Facão',damage:39,reach:2.2,cooldown:.64,stamina:14,wood:25},
 hammer: {name:'Martelo de construção',damage:0,reach:2.1,cooldown:.75,stamina:0,wood:0},
} as const;
export type MeleeId=keyof typeof MELEE;
export interface CraftGear {melee:MeleeId;owned:MeleeId[];armor:number;armorTier:0|1|2}
export interface TreeState {id:number;x:number;z:number;hp:number;ready:number}
export interface CraftWorld {revision:number;clock:number;next:number;structures:Structure[];chests:Chest[];tables:{id:number;x:number;z:number;y:number;angle:number;hp:number}[];trees:TreeState[];refills:Record<string,number>}
export const createCraftWorld=():CraftWorld=>({revision:0,clock:0,next:1,structures:[],chests:[],tables:[],trees:TREE_TRUNKS.map((t,id)=>({id,x:t.x,z:t.z,hp:100,ready:0})),refills:{}});
export interface Recipe {id:string;name:string;hint:string;bench?:boolean;cost:Partial<Record<Item,number>>;construction?:StructureKind;item?:Item;amount?:number;melee?:MeleeId;armor?:1|2;module?:string;fortify?:string;trap?:string;weapon?:WeaponId;upgrade?:'pack'|'repair'|'armor-repair'|'bench-repair'}
export const RECIPES:Recipe[]=[
 {id:'bench',name:'Mesa inteligente',hint:'Kit de 3 kg. Posicione no chão para trabalhar.',cost:{wood:6,scrap:3},item:'bench'},
 {id:'hammer',name:'Martelo de construção',hint:'Equipe para construir no terreno do abrigo. Escolha paredes, portas, pisos e escadas nos slots.',bench:true,cost:{wood:3,scrap:5,cloth:1},melee:'hammer'},
 {id:'chest',name:'Baú de madeira',hint:'27 espaços. Posicione no chão; E para abrir.',bench:true,cost:{wood:8,scrap:2},item:'chest'},
 {id:'bench-repair',name:'Manutenção da mesa',hint:'Recupera 80 HP da mesa mais próxima. Requer sucata e madeira.',bench:true,cost:{wood:2,scrap:3},upgrade:'bench-repair'},
 {id:'cord',name:'Corda',hint:'Trance 3 retalhos de tecido.',cost:{cloth:3},item:'cord'},
 {id:'club',name:'Porrete',hint:'28 dano · lento · baixo custo.',cost:{wood:3,cloth:1},melee:'club'},
 {id:'bandage',name:'Bandagem',hint:'45 HP. Aplicação interrompida ao mover.',cost:{cloth:4},item:'med'},
 {id:'knife',name:'Faca de sucata',hint:'24 dano · rápida · alcance curto.',bench:true,cost:{scrap:5,cloth:2},melee:'knife'},
 {id:'axe',name:'Machado',hint:'43 dano · corta árvores em 3 golpes.',bench:true,cost:{wood:4,scrap:7,cord:1},melee:'axe'},
 {id:'spear',name:'Lança',hint:'32 dano · alcance de 3 m · gasta fôlego.',bench:true,cost:{wood:5,scrap:4,cord:2},melee:'spear'},
 {id:'machete',name:'Facão',hint:'39 dano · bom equilíbrio de velocidade e força.',bench:true,cost:{scrap:12,hide:3,cord:1},melee:'machete'},
 {id:'leather',name:'Colete de couro',hint:'Absorve 20% do dano. Durabilidade: 80.',bench:true,cost:{hide:8,cord:2,cloth:3},armor:1},
 {id:'reinforced',name:'Couro reforçado',hint:'Absorve 32% do dano. Durabilidade: 140.',bench:true,cost:{hide:14,scrap:10,cord:3},armor:2},
 {id:'armor-repair',name:'Remendar armadura',hint:'Recupera até 45 de durabilidade.',bench:true,cost:{hide:3,cloth:2},upgrade:'armor-repair'},
 {id:'pack',name:'Reforço da mochila',hint:'+4 kg de capacidade. Uma vez por sobrevivente.',bench:true,cost:{hide:6,cloth:6,cord:2},upgrade:'pack'},
 {id:'ammo',name:'12 munições leves',hint:'Recuperação de cartuchos usando reserva selada.',bench:true,cost:{scrap:4,rare:1},item:'ammo',amount:12},
 {id:'shells',name:'6 cartuchos',hint:'Munição de escopeta.',bench:true,cost:{scrap:5,rare:1},item:'shells',amount:6},
 {id:'rifleAmmo',name:'12 munições de rifle',hint:'Munição de alta pressão.',bench:true,cost:{scrap:7,rare:2},item:'rifleAmmo',amount:12},
 {id:'pistol',name:'Pistola artesanal',hint:'Arma leve comum. Fabricada descarregada.',bench:true,cost:{scrap:12,wood:4,rare:2},weapon:'pistol'},
 {id:'shotgun',name:'Escopeta artesanal',hint:'Arma pesada comum. Fabricada descarregada.',bench:true,cost:{scrap:20,wood:6,rare:3},weapon:'shotgun'},
 {id:'rifle',name:'Rifle artesanal',hint:'Arma pesada comum. Fabricado descarregado.',bench:true,cost:{scrap:28,wood:8,rare:5},weapon:'rifle'},
 {id:'repair',name:'Reparar cama',hint:'No abrigo: recupera 120 HP da base.',cost:{scrap:4},upgrade:'repair'},
];
export function benchNearby(s:Simulation):boolean{return s.crafting.tables.some(t=>distance(t,s.player)<=3&&clear(s,t));}
/** Aimed workstation interaction, blocked by opaque walls and other tables. */
export function focusedBench(s:Simulation):number|undefined {
 const dir=lookDirection(s.player.angle,s.player.pitch),p=s.player;
 return s.crafting.tables.filter(t=>distance(t,p)<=3&&Math.abs(t.y-s.groundY)<.7).sort((a,b)=>distance(a,p)-distance(b,p)).find(t=>{
  const along=(t.x-p.x)*dir.x+(t.z-p.z)*dir.z;
  if(along<=0||Math.abs((t.x-p.x)*dir.z-(t.z-p.z)*dir.x)>.9)return false;
  const y=p.eyeY+dir.y*along;if(y<t.y-.2||y>t.y+1.9)return false;
  return rayWorld({x:p.x,y:p.eyeY,z:p.z},dir,along,s.solidDefenses.filter(b=>b.id!==`table-${t.id}`))>=along-.8;
 })?.id;
}
export function usableBench(s:Simulation,id:number):boolean {const t=s.crafting.tables.find(t=>t.id===id);return !!t&&distance(t,s.player)<=3&&clear(s,t);}
function clear(s:Simulation,p:Vec2&{y?:number}):boolean {
 if(p.y!==undefined&&Math.abs(p.y-s.groundY)>.7)return false;
 const origin={x:s.player.x,y:s.player.eyeY,z:s.player.z},targetY=p.y===undefined?origin.y:p.y+.95,dx=p.x-origin.x,dz=p.z-origin.z,dy=targetY-origin.y,d=Math.hypot(dx,dy,dz);
 return d<.1||rayWorld(origin,{x:dx/d,y:dy/d,z:dz/d},d,s.solidDefenses.filter(b=>!b.id.startsWith('table-')||b.x!==p.x||b.z!==p.z))>=d-.1;
}
export function available(s:Simulation,k:Item){return s.inventory.items[k];}
export function craftReason(s:Simulation,r:Recipe):string {
 if(s.gameOver||s.player.hp<=0||s.action||s.reloadTimer||s.player.running)return 'Aguarde terminar a ação.';
 if(r.id!=='bench'&&!benchNearby(s))return 'Aproxime-se da mesa (3 m).';
 if(r.upgrade==='bench-repair'&&!s.crafting.tables.some(t=>t.hp<200&&distance(t,s.player)<=3&&clear(s,t)))return 'Nenhuma mesa danificada ao alcance.';
 if(r.fortify){const b=s.barricades.find(b=>b.id===r.fortify);if(!s.atBase||!b?.hp)return 'Construa primeiro o módulo no abrigo.';if((b.tier??0)>=2)return 'Fortificação máxima.';if(b.hp<defenseMaxHP(b))return 'Repare o módulo antes de fortificar.';}
 if(r.weapon&&s.groundWeapons.length>=48)return 'Recolha as armas próximas antes de fabricar.';
 if(r.melee&&s.gear.owned.includes(r.melee))return 'Você já possui esta ferramenta.';
 if(r.armor&&s.gear.armorTier>=r.armor&&s.gear.armor>0)return 'Use a receita de reparo da armadura.';
 if(r.upgrade==='pack'&&s.packCrafted)return 'Mochila já reforçada.';
 if(r.upgrade==='armor-repair'&&(!s.gear.armorTier||s.gear.armor>=(s.gear.armorTier===2?140:80)))return 'Nenhuma armadura para reparar.';
 if(r.upgrade==='repair'&&(!s.atBase||s.baseHP>=1000))return 'A cama precisa estar danificada e próxima.';
 if(r.module){const b=s.barricades.find(b=>b.id===r.module);if(!s.atBase)return 'Construa a partir do abrigo.';if(!b||b.hp>0)return 'Módulo já construído.';if(obstacleDistance(s.player,b)<.6||s.zombies.some(z=>z.active&&obstacleDistance(z,b)<.7)||s.coopTargets.some(p=>obstacleDistance(p,b)<.6)||[...s.crafting.tables,...s.crafting.chests].some(t=>obstacleDistance(t,b)<1))return 'Afaste os sobreviventes e infectados do módulo.';}
 if(itemKeys.some(k=>available(s,k)<(r.cost[k]??0)))return 'Materiais insuficientes.';
 if(r.item){const weight=s.inventory.weight-itemKeys.reduce((a,k)=>a+Math.min(s.inventory.items[k],r.cost[k]??0)*ITEMS[k].weight,0)+ITEMS[r.item].weight*(r.amount??1);if(weight>s.inventory.capacity+.0001)return 'Libere espaço na mochila.';}
 return '';
}
export function craft(s:Simulation,id:string):boolean {
 const r=RECIPES.find(r=>r.id===id);if(!r)return false;const reason=craftReason(s,r);if(reason){s.notice('CRAFT INDISPONÍVEL',reason);return false;}
 if(r.construction){s.notice('POSICIONE A ESTRUTURA','Escolha um encaixe livre no terreno do abrigo.');return false;}
 for(const k of itemKeys){const cost=r.cost[k]??0,take=Math.min(s.inventory.items[k],cost);s.inventory.take(k,take);}
 if(r.weapon){const g=s.dropWeapon(r.weapon,s.player,'common','Fabricada na mesa');if(g){g.item.magazine=0;s.equipGround(g.item.uid);}}
 if(r.item)s.inventory.add(r.item,r.amount??1);
 if(r.melee){s.gear.owned.push(r.melee);s.gear.melee=r.melee;s.activeSlot=2;s.cancelReload();}
 if(r.armor){s.gear.armorTier=r.armor;s.gear.armor=r.armor===2?140:80;}
 if(r.module){const b=s.barricades.find(b=>b.id===r.module)!;b.tier=0;b.hp=defenseMaxHP(b);b.built=true;b.open=false;for(const z of s.zombies)z.replan=0;}
 if(r.fortify){const b=s.barricades.find(b=>b.id===r.fortify)!;b.tier=(b.tier??0)+1;b.hp=defenseMaxHP(b);}
 if(r.upgrade==='bench-repair'){const t=s.crafting.tables.filter(t=>t.hp<200&&distance(t,s.player)<=3&&clear(s,t)).sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0];t.hp=Math.min(200,t.hp+80);s.crafting.revision++;}
 if(r.upgrade==='pack'){s.packCrafted=true;s.inventory.capacity+=4;}
 if(r.upgrade==='repair')s.baseHP=Math.min(1000,s.baseHP+120);
 if(r.upgrade==='armor-repair')s.gear.armor=Math.min(s.gear.armorTier===2?140:80,s.gear.armor+45);
 s.events.push({type:'build',position:{...s.player}});s.notice('FABRICADO',r.name);return true;
}
export function placement(s:Simulation){const reach=Math.max(1.9,Math.min(4.5,s.player.pitch<-.05?(s.player.eyeY-floorHeight(s.player))/Math.tan(-s.player.pitch):1.9));const p={x:s.player.x+Math.sin(s.player.angle)*reach,z:s.player.z+Math.cos(s.player.angle)*reach};const y=floorHeight(p);const occupied=collides(p,.9,s.solidDefenses)||distance(p,BASE)<2||[...s.crafting.tables,...s.crafting.chests].some(t=>distance(t,p)<2)||s.loot.some(l=>distance(l,p)<1.25)||s.zombies.some(z=>z.active&&distance(z,p)<1.2)||s.coopTargets.some(q=>distance(q,p)<1.1)||Math.abs(y-floorHeight(s.player))>.3||!clear(s,p);return {...p,y,angle:s.player.angle,valid:!occupied};}
export function placeBench(s:Simulation):boolean {const p=placement(s);if(s.gameOver||s.player.hp<=0||s.action||!p.valid||s.crafting.tables.length>=12||!s.inventory.take('bench',1)){s.notice('NÃO FOI POSSÍVEL POSICIONAR','Use um chão livre à sua frente. Máximo de 12 mesas.');return false;}s.crafting.tables.push({id:s.crafting.next++,x:p.x,z:p.z,y:p.y,angle:p.angle,hp:200});s.crafting.revision++;s.notice('MESA POSICIONADA','Mire na mesa e pressione E para trabalhar.');return true;}
export function absorb(s:Simulation,damage:number){const blocked=Math.min(s.gear.armor,damage*(s.gear.armorTier===2?.32:.2));s.gear.armor=Math.max(0,s.gear.armor-blocked);return damage-blocked;}
export function infectedLoot(s:Simulation,z:Walker){const id=`infected-${z.id}`;if(s.loot.some(l=>l.id===id))return;
 // Bags outlive the cosmetic ragdoll; evict the oldest only when the bounded pool fills.
 const bags=s.loot.filter(l=>l.id.startsWith('infected-'));if(bags.length>=80){const oldest=bags[0];s.loot.splice(s.loot.indexOf(oldest),1);}
 s.loot.push({id,x:z.x,z:z.z,area:'outside',label:'Restos do infectado',coins:moneyDrop(s.runSeed,id,z.kind==='walker'?'infected':'special'),searched:true,lastFound:null,contents:{...emptyStock(),hide:1+(z.kind==='tank'?1:0),cloth:z.id%3===0?1:0,scrap:z.id%2===0?1:0,ammo:z.id%5===0?3:0}});
}
export function harvest(s:Simulation):boolean {
 if(s.meleeId==='hammer')return false;
 const stats=MELEE[s.meleeId],dir=lookDirection(s.player.angle,s.player.pitch),origin={x:s.player.x,y:s.player.eyeY,z:s.player.z};
 const t=s.crafting.trees.filter(t=>t.hp>0&&distance(t,s.player)<=stats.reach+.4).sort((a,b)=>distance(a,s.player)-distance(b,s.player)).find(t=>{const dx=t.x-s.player.x,dz=t.z-s.player.z,along=dx*dir.x+dz*dir.z;return along>0&&Math.abs(dx*dir.z-dz*dir.x)<.65&&origin.y+dir.y*along<4&&origin.y+dir.y*along>floorHeight(t)&&rayWorld(origin,dir,Math.max(0,along-.5),s.solidDefenses)>=along-.55;});
 if(!t)return false;const horizontal={x:Math.sin(s.player.angle),z:Math.cos(s.player.angle)};if(s.zombies.some(z=>z.active&&bodyHit(s.player,horizontal,Math.tan(s.player.pitch),z,Math.max(0,distance(s.player,t)-.3),s.player.eyeY)))return false;t.hp=Math.max(0,t.hp-stats.wood);s.events.push({type:'barricade-hit',position:t});if(!t.hp){s.crafting.revision++;t.ready=s.crafting.clock+240+s.contentRandom()*240;const wood=4+Math.floor(s.contentRandom()*3);const accepted=s.inventory.add('wood',wood);if(accepted<wood)s.loot.push({id:`timber-${t.id}-${s.crafting.next++}`,x:t.x,z:t.z,area:'outside',label:'Madeira cortada',searched:true,lastFound:null,contents:{...emptyStock(),wood:wood-accepted}});s.notice('ÁRVORE CORTADA',`${wood} madeiras. O que não coube ficou no chão.`);}return true;
}
export function updateCraftWorld(s:Simulation,dt:number,players:Vec2[]=[s.player]){
 const w=s.crafting;w.clock+=dt;
 const timber=s.loot.filter(l=>l.id.startsWith('timber-'));for(const l of timber.slice(0,Math.max(0,timber.length-80)))s.loot.splice(s.loot.indexOf(l),1);
 for(const t of w.trees)if(!t.hp&&w.clock>=t.ready&&players.every(p=>distance(p,t)>12)&&!s.zombies.some(z=>z.active&&distance(z,t)<1.5)&&![...s.crafting.tables,...s.crafting.chests].some(p=>distance(p,t)<2)){t.hp=100;t.ready=0;w.revision++;}
 for(const l of s.loot){if(!renewableLoot.has(l.id))continue;if(l.searched&&!(l.coins??0)&&!itemKeys.some(k=>l.contents[k])){if(w.refills[l.id]===undefined&&Object.keys(w.refills).length<64)w.refills[l.id]=w.clock+360+s.contentRandom()*300;if(w.clock>=w.refills[l.id]&&players.every(p=>distance(p,l)>18)){l.searched=false;l.guaranteed=undefined;l.restocked=true;delete w.refills[l.id];}}}
}

export function reclaimBench(s:Simulation,id?:number):boolean{if(s.gameOver||s.action||s.player.hp<=0)return false;const t=s.crafting.tables.find(t=>(id===undefined||t.id===id)&&distance(t,s.player)<=3&&clear(s,t));if(!t)return false;if(t.hp<200){s.notice('MESA DANIFICADA','Não é possível recolher uma mesa danificada.');return false;}if(!s.inventory.add('bench',1)){s.notice('MOCHILA CHEIA','Libere 3 kg para recolher a mesa.');return false;}s.crafting.tables.splice(s.crafting.tables.indexOf(t),1);s.crafting.revision++;return true;}
