import { ITEMS, itemKeys } from './inventory.ts';
import type { Item, Stock } from './inventory.ts';
import { createWeapon } from './weapons.ts';
import type { Affix, GroundWeapon, Rarity, WeaponId } from './weapons.ts';
import { BASE, BUILDINGS, TREE_TRUNKS, URBAN, WORLD_LIMIT, collides, distance, floorHeight, rayWorld, surfaceAt } from './world.ts';
import type { Obstacle, Vec2 } from './world.ts';
import { CITY_SITES } from './city.ts';
import { ROADS } from './districts.ts';
import { BASE_LOOT_POINTS } from './base-loot.ts';
import { EVENT_POINTS, FACILITIES } from './expedition.ts';

/** Currency lives beside the inventory, never inside its weighted item stock. */
export const MAX_COINS = 9_999_999;
export const TRADE_RANGE = 3.4;
export type MerchantKind = 'supplies' | 'medic' | 'gunsmith' | 'salvage';
export interface ShopOffer { id:string; name:string; hint:string; price:number; stock:number; item?:Item; amount?:number; weapon?:WeaponId; rarity?:Rarity; affix?:Affix }
export const SHOP_CATALOGS:Record<MerchantKind,readonly ShopOffer[]> = {
 supplies: [
  {id:'water',name:'Água lacrada',hint:'Uma garrafa de água potável.',price:16,stock:5,item:'water',amount:1},
  {id:'beans',name:'Feijão enlatado',hint:'Lacre intacto. Uma refeição confiável.',price:14,stock:4,item:'cannedBeans',amount:1},
  {id:'ration',name:'Ração de campanha',hint:'Provisão concentrada para expedições.',price:28,stock:2,item:'ration',amount:1},
  {id:'light-ammo',name:'12 munições leves',hint:'Pistola, revólver e submetralhadora.',price:24,stock:5,item:'ammo',amount:12},
  {id:'bandage',name:'Bandagem',hint:'Tratamento de campo. Aplicar exige tempo.',price:24,stock:3,item:'med',amount:1},
 ],
 medic: [
  {id:'bandage',name:'Bandagem esterilizada',hint:'Uma bandagem pronta para uso.',price:22,stock:6,item:'med',amount:1},
  {id:'cloth',name:'Tecido recuperado',hint:'Quatro retalhos para manutenção e primeiros socorros.',price:18,stock:4,item:'cloth',amount:4},
  {id:'water',name:'Água lacrada',hint:'Uma garrafa de água potável.',price:18,stock:4,item:'water',amount:1},
  {id:'fruit',name:'Frutas em conserva',hint:'Energia e hidratação.',price:18,stock:3,item:'cannedFruit',amount:1},
 ],
 gunsmith: [
  {id:'quiet-pistol',name:'Pistola · Vigia',hint:'Rara · silenciada. Entregue descarregada no chão, junto a você.',price:240,stock:1,weapon:'pistol',rarity:'rare',affix:'quiet'},
  {id:'heavy-shotgun',name:'Escopeta · Última linha',hint:'Rara · impacto pesado. Entregue descarregada junto a você.',price:360,stock:1,weapon:'shotgun',rarity:'rare',affix:'heavy'},
  {id:'precise-rifle',name:'Rifle · Sentinela',hint:'Épico · preciso. Entregue descarregado junto a você.',price:540,stock:1,weapon:'rifle',rarity:'epic',affix:'precise'},
  {id:'light-ammo',name:'12 munições leves',hint:'Pistola, revólver e submetralhadora.',price:26,stock:6,item:'ammo',amount:12},
  {id:'shells',name:'6 cartuchos',hint:'Munição de escopeta.',price:30,stock:5,item:'shells',amount:6},
  {id:'rifle-ammo',name:'12 munições de rifle',hint:'Rifle de assalto e precisão.',price:42,stock:5,item:'rifleAmmo',amount:12},
 ],
 salvage: [
  {id:'wood',name:'Tábuas reaproveitadas',hint:'Quatro peças de madeira para construção.',price:18,stock:5,item:'wood',amount:4},
  {id:'scrap',name:'Sucata selecionada',hint:'Quatro peças de metal para reparos.',price:24,stock:5,item:'scrap',amount:4},
  {id:'cord',name:'Corda',hint:'Fibra trançada para ferramentas e estruturas.',price:12,stock:4,item:'cord',amount:1},
  {id:'hide',name:'Pele tratável',hint:'Duas peles para equipamentos de proteção.',price:22,stock:4,item:'hide',amount:2},
  {id:'sealed',name:'Reserva selada',hint:'Material raro para fabricação e emergências.',price:48,stock:2,item:'rare',amount:1},
  {id:'chest',name:'Kit de baú',hint:'Posicione no chão para guardar seus suprimentos.',price:56,stock:2,item:'chest',amount:1},
 ],
};
/** Buying then reselling, even after using the existing recipes, cannot mint currency. */
export const SELL_PRICES:Record<Item,number> = {
 chest:6,bench:8,hide:3,cloth:2,cord:3,ammo:1,shells:2,rifleAmmo:2,med:5,wood:1,scrap:2,rare:9,
 cannedBeans:4,cannedMeat:5,cannedFish:4,cannedFruit:4,crackers:3,ration:7,water:5,soda:3,
};
export const MERCHANT_PROFILES:readonly {id:string;kind:MerchantKind;name:string;title:string;hint:string;budget:number}[] = [
 {id:'trader-rute',kind:'supplies',name:'Rute',title:'Provisões da estrada',hint:'Lacrado ainda tem valor.',budget:200},
 {id:'trader-mara',kind:'medic',name:'Dra. Mara',title:'Posto de campo',hint:'Cuide dos vivos. Traga o que puder aproveitar.',budget:180},
 {id:'trader-serrano',kind:'gunsmith',name:'Serrano',title:'Oficina de armamentos',hint:'Cada peça foi recuperada e testada.',budget:360},
 {id:'trader-bento',kind:'salvage',name:'Bento',title:'Pátio de troca',hint:'Nada disso é lixo enquanto alguém precisar.',budget:240},
 {id:'trader-lia',kind:'supplies',name:'Lia',title:'Caravana de suprimentos',hint:'A próxima estrada pode estar fechada.',budget:200},
 {id:'trader-caio',kind:'salvage',name:'Caio',title:'Depósito recuperado',hint:'Material bom mantém uma casa de pé.',budget:240},
];
export interface Merchant extends Vec2 { id:string;kind:MerchantKind;name:string;title:string;y:number;angle:number;revision:number;coins:number;stock:Record<string,number> }
export interface EconomyWorld { version:1;day:number;merchants:Merchant[] }
export type TradeRequest = {merchant:string;revision:number;amount:number} & ({mode:'buy';offer:string}|{mode:'sell';item:Item});
export interface TradeContext {
 seed:number;coins:number;items:Stock;capacity:number;player:Vec2 & {hp:number;eyeY:number};
 busy:boolean;groundWeaponCount:number;nextWeaponId:number;obstacles?:Obstacle[];
}
export type TradeResult = {ok:false;reason:string}|{ok:true;world:EconomyWorld;coins:number;items:Stock;nextWeaponId:number;weapon?:GroundWeapon;message:string};

function hash(seed:number,text:string):number {let result=seed>>>0;for(let i=0;i<text.length;i++){result^=text.charCodeAt(i);result=Math.imul(result,16777619);}return result>>>0;}
function stream(seed:number):()=>number {let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
export function validCoins(value:unknown):value is number {return Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=MAX_COINS;}
/** Call once when generating the loot container; its remaining coins must be saved and replicated. */
export function moneyDrop(seed:number,sourceId:string,kind:'infected'|'special'|'container'):number {
 const random=stream(hash(seed^0xb68f231d,`${kind}:${sourceId}`));
 if(kind==='container')return random()<.38?5+Math.floor(random()*21):0;
 if(random()<.28)return 0;
 return kind==='special'?8+Math.floor(random()*15):2+Math.floor(random()*7);
}
/** A full backpack has no bearing on collecting money. At the cap, the remainder stays in the loot. */
export function collectCoins(wallet:number,remaining:number):{coins:number;remaining:number;taken:number} {
 if(!validCoins(wallet)||!validCoins(remaining))return {coins:wallet,remaining,taken:0};
 const taken=Math.min(remaining,MAX_COINS-wallet);return {coins:wallet+taken,remaining:remaining-taken,taken};
}

/** Check the whole camp clearance, not only the NPC's feet; never occupy existing interiors or the buildable shelter. */
export function safeMerchantSite(p:Vec2):boolean {
 if(distance(p,BASE)<36||Math.abs(p.x)>WORLD_LIMIT-10||Math.abs(p.z)>WORLD_LIMIT-10||collides(p,5.2,TREE_TRUNKS)||surfaceAt(p)==='asphalt')return false;
 if([...BUILDINGS,...CITY_SITES,...URBAN.buildings].some(b=>Math.abs(p.x-b.x)<b.w/2+6&&Math.abs(p.z-b.z)<b.d/2+6))return false;
 if([...BASE_LOOT_POINTS,...FACILITIES,...EVENT_POINTS].some(v=>distance(v,p)<7))return false;
 return [-4,0,4].every(x=>[-4,0,4].every(z=>Math.abs(floorHeight({x:p.x+x,z:p.z+z})-floorHeight(p))<.1));
}
function chooseSite(random:()=>number,placed:Merchant[],near:boolean):Vec2 {
 // Sample sidewalks beside real roads; the first supplier stays within a short expedition of the shelter.
 for(let attempt=0;attempt<4000;attempt++){
  const road=ROADS[Math.floor(random()*ROADS.length)],horizontal=road.w>road.d,side=random()<.5?-1:1;
  const along=(random()-.5)*(horizontal?road.w:road.d),offset=(horizontal?road.d:road.w)/2+7+random()*6;
  const p={x:Math.round((road.x+(horizontal?along:side*offset))*2)/2,z:Math.round((road.z+(horizontal?side*offset:along))*2)/2};
  if(near&&distance(p,BASE)>105||placed.some(v=>distance(v,p)<55))continue;
  if(safeMerchantSite(p))return p;
 }
 // A bounded deterministic fallback keeps generation independent of any gameplay RNG.
 for(let radius=44;radius<WORLD_LIMIT-12;radius+=10)for(let step=0;step<72;step++){
  const angle=step*Math.PI/36,p={x:Math.round(Math.sin(angle)*radius),z:Math.round(Math.cos(angle)*radius)};
  if(!placed.some(v=>distance(v,p)<55)&&safeMerchantSite(p))return p;
 }
 throw new Error('Nenhum terreno livre para o posto de troca.');
}
export function createEconomy(seed:number):EconomyWorld {
 const random=stream(seed^0x25b46c71),merchants:Merchant[]=[];
 for(const profile of MERCHANT_PROFILES){const p=chooseSite(random,merchants,merchants.length===0);merchants.push({id:profile.id,kind:profile.kind,name:profile.name,title:profile.title,...p,y:floorHeight(p),angle:Math.floor(random()*4)*Math.PI/2,revision:0,coins:profile.budget,stock:Object.fromEntries(SHOP_CATALOGS[profile.kind].map(o=>[o.id,o.stock]))});}
 return {version:1,day:1,merchants};
}
/** Dawn replenishes a bounded catalogue once. Reopening the menu never refreshes stock or funds. */
export function refreshEconomy(world:EconomyWorld,day:number):EconomyWorld {
 if(!Number.isInteger(day)||day<=world.day||day>1_000_000)return world;
 return {...world,day,merchants:world.merchants.map(m=>({...m,revision:m.revision+1,coins:Math.max(m.coins,MERCHANT_PROFILES.find(p=>p.id===m.id)?.budget??180),stock:Object.fromEntries(SHOP_CATALOGS[m.kind].map(o=>[o.id,o.stock]))}))};
}
export function merchantReachable(merchant:Merchant,player:TradeContext['player'],obstacles:Obstacle[]=[]):boolean {
 if(!Number.isFinite(player.x)||!Number.isFinite(player.z)||!Number.isFinite(player.eyeY)||distance(merchant,player)>TRADE_RANGE||Math.abs(player.eyeY-(merchant.y+1.65))>1.4)return false;
 const dx=merchant.x-player.x,dz=merchant.z-player.z,dy=merchant.y+1.35-player.eyeY,len=Math.hypot(dx,dy,dz);
 const clear=obstacles.filter(o=>!('id' in o)||o.id!==`merchant-${merchant.id}-npc`);
 return len<.1||rayWorld({x:player.x,y:player.eyeY,z:player.z},{x:dx/len,y:dy/len,z:dz/len},len,clear)>=len-.35;
}
export function validTradeRequest(value:unknown):value is TradeRequest {
 if(!value||typeof value!=='object')return false;const r=value as Record<string,unknown>;
 return typeof r.merchant==='string'&&MERCHANT_PROFILES.some(p=>p.id===r.merchant)&&Number.isSafeInteger(r.revision)&&Number(r.revision)>=0&&Number(r.revision)<Number.MAX_SAFE_INTEGER&&Number.isInteger(r.amount)&&Number(r.amount)>=1&&Number(r.amount)<=99&&(r.mode==='buy'?typeof r.offer==='string'&&r.offer.length<=40:r.mode==='sell'&&typeof r.item==='string'&&Object.hasOwn(ITEMS,r.item));
}
/** Produce a complete transaction first. The caller commits all returned fields together on the solo/coop authority. */
export function planTrade(world:EconomyWorld,context:TradeContext,request:TradeRequest):TradeResult {
 const fail=(reason:string):TradeResult=>({ok:false,reason});
 if(!validTradeRequest(request)||!validCoins(context.coins))return fail('Transação inválida.');
 const merchant=world.merchants.find(m=>m.id===request.merchant);
 if(!merchant||merchant.revision!==request.revision)return fail('O estoque mudou. Escolha o item novamente.');
 if(context.player.hp<=0||context.busy)return fail('Termine a ação antes de negociar.');
 if(!merchantReachable(merchant,context.player,context.obstacles))return fail('Aproxime-se do comerciante.');
 if(!itemKeys.every(k=>Number.isInteger(context.items[k])&&context.items[k]>=0)||!Number.isFinite(context.capacity)||context.capacity<=0)return fail('Inventário inválido.');
 const items={...context.items},stock={...merchant.stock};let coins=context.coins,merchantCoins=merchant.coins,nextWeaponId=context.nextWeaponId,weapon:GroundWeapon|undefined,message='';
 if(request.mode==='buy'){
  const offer=SHOP_CATALOGS[merchant.kind].find(o=>o.id===request.offer);
  if(!offer||(stock[offer.id]??0)<request.amount)return fail('Esse item está esgotado.');
  const cost=offer.price*request.amount;
  if(coins<cost)return fail('Moedas insuficientes.');
  if(merchantCoins+cost>MAX_COINS)return fail('O comerciante não pode receber mais moedas agora.');
  if(offer.item){
   const amount=(offer.amount??1)*request.amount,weight=itemKeys.reduce((sum,k)=>sum+items[k]*ITEMS[k].weight,0);
   if(weight+amount*ITEMS[offer.item].weight>context.capacity+1e-8)return fail('Mochila sem espaço. Nenhuma moeda foi gasta.');
   items[offer.item]+=amount;
  }else if(offer.weapon){
   if(request.amount!==1||!Number.isSafeInteger(nextWeaponId)||nextWeaponId<1||nextWeaponId>=Number.MAX_SAFE_INTEGER)return fail('Compre uma arma por vez.');
   if(context.groundWeaponCount>=48)return fail('Recolha as armas no chão antes de comprar outra.');
   const item=createWeapon(offer.weapon,nextWeaponId++,offer.rarity??'rare',stream(hash(context.seed,`${merchant.id}:${offer.id}:${context.nextWeaponId}`)));
   item.affix=offer.affix;item.magazine=0;
   weapon={x:context.player.x,z:context.player.z,item,source:`${merchant.name} · ${offer.name}`};
  }else return fail('Oferta indisponível.');
  coins-=cost;merchantCoins+=cost;stock[offer.id]-=request.amount;message=`${offer.name} · −${cost} moedas${weapon?' · recolha a arma no chão':''}`;
 }else{
  const amount=request.amount,payment=SELL_PRICES[request.item]*amount;
  if(items[request.item]<amount)return fail('Você não possui essa quantidade.');
  if(merchantCoins<payment)return fail('O comerciante está sem moedas. O caixa renova ao amanhecer.');
  if(coins+payment>MAX_COINS)return fail('Sua carteira está cheia.');
  items[request.item]-=amount;coins+=payment;merchantCoins-=payment;message=`${amount} × ${ITEMS[request.item].label} · +${payment} moedas`;
 }
 const updated={...merchant,stock,coins:merchantCoins,revision:merchant.revision+1};
 return {ok:true,world:{...world,merchants:world.merchants.map(m=>m.id===merchant.id?updated:m)},coins,items,nextWeaponId,weapon,message};
}
export function validEconomyWorld(value:unknown):value is EconomyWorld {
 if(!value||typeof value!=='object')return false;const w=value as EconomyWorld;
 if(w.version!==1||!Number.isInteger(w.day)||w.day<1||w.day>1_000_000||!Array.isArray(w.merchants)||w.merchants.length!==MERCHANT_PROFILES.length)return false;
 return MERCHANT_PROFILES.every(p=>{const matches=w.merchants.filter(m=>m?.id===p.id);if(matches.length!==1)return false;const m=matches[0];
  return m.kind===p.kind&&m.name===p.name&&m.title===p.title&&Number.isFinite(m.x)&&Math.abs(m.x)<=WORLD_LIMIT-10&&Number.isFinite(m.z)&&Math.abs(m.z)<=WORLD_LIMIT-10&&Number.isFinite(m.y)&&m.y>=0&&m.y<=10&&Number.isFinite(m.angle)&&Math.abs(m.angle)<=Math.PI*2&&Number.isSafeInteger(m.revision)&&m.revision>=0&&m.revision<Number.MAX_SAFE_INTEGER&&validCoins(m.coins)&&!!m.stock&&typeof m.stock==='object'&&Object.keys(m.stock).length===SHOP_CATALOGS[m.kind].length&&SHOP_CATALOGS[m.kind].every(o=>Number.isInteger(m.stock[o.id])&&m.stock[o.id]>=0&&m.stock[o.id]<=o.stock);
 });
}
