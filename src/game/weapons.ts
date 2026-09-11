import { BALANCE } from './config.ts';
export type WeaponId = 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'rifle' | 'marksman';
export type AmmoType = 'ammo' | 'shells' | 'rifleAmmo';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type Affix = 'piercing' | 'heavy' | 'quick' | 'precise' | 'quiet';
export interface WeaponDefinition {
  name:string; slot:0|1; ammo:AmmoType; damage:number; cooldown:number; magazine:number; reload:number;
  range:number; spread:number; pellets:number; falloff:number; recoil:number; kick:number; noise:number;
  move:number; automatic:boolean; reloadStyle:'magazine'|'cylinder'|'shell'; flash:number; hint:string;
}
export const WEAPONS:Record<WeaponId,WeaponDefinition> = {
  pistol:{...BALANCE.pistol,name:'Pistola',slot:1,ammo:'ammo',pellets:1,falloff:26,recoil:1,kick:.16,noise:30,move:1,automatic:false,reloadStyle:'magazine',flash:1,hint:'Precisa e econômica. Sua reserva de confiança.'},
  revolver:{name:'Revólver',slot:1,ammo:'ammo',damage:72,cooldown:.68,magazine:6,reload:2.5,range:32,spread:.012,pellets:1,falloff:26,recoil:2,kick:.3,noise:38,move:.97,automatic:false,reloadStyle:'cylinder',flash:1.4,hint:'Seis disparos pesados. Faça cada um valer.'},
  smg:{name:'Submetralhadora',slot:0,ammo:'ammo',damage:18,cooldown:.085,magazine:30,reload:1.9,range:22,spread:.045,pellets:1,falloff:12,recoil:.7,kick:.09,noise:27,move:.96,automatic:true,reloadStyle:'magazine',flash:.75,hint:'Rajadas curtas seguram grupos. Consome muita munição.'},
  shotgun:{name:'Escopeta',slot:0,ammo:'shells',damage:14,cooldown:.88,magazine:6,reload:.65,range:16,spread:.23,pellets:8,falloff:5,recoil:2.6,kick:.75,noise:40,move:.9,automatic:false,reloadStyle:'shell',flash:2,hint:'Oito chumbos por cartucho. Recarrega um por vez.'},
  rifle:{name:'Rifle de assalto',slot:0,ammo:'rifleAmmo',damage:29,cooldown:.16,magazine:24,reload:2.2,range:36,spread:.027,pellets:1,falloff:25,recoil:1.1,kick:.2,noise:36,move:.93,automatic:true,reloadStyle:'magazine',flash:1.3,hint:'Versátil a média distância. Controle as rajadas.'},
  marksman:{name:'Rifle de precisão',slot:0,ammo:'rifleAmmo',damage:85,cooldown:.9,magazine:8,reload:2.7,range:46,spread:.008,pellets:1,falloff:38,recoil:1.8,kick:.35,noise:42,move:.86,automatic:false,reloadStyle:'magazine',flash:1.5,hint:'Alta precisão para interromper ameaças distantes.'},
};
export const RARITIES:Record<Rarity,{name:string;color:string;rank:number}>={
  common:{name:'Comum',color:'#b9c0ae',rank:0},uncommon:{name:'Incomum',color:'#9eb795',rank:1},rare:{name:'Raro',color:'#94b6c6',rank:2},epic:{name:'Épico',color:'#b7a1b5',rank:3},legendary:{name:'Lendário',color:'#d8ad70',rank:4},
};
export const AFFIXES:Record<Affix,{name:string;hint:string}>={
  piercing:{name:'Perfurante',hint:'Atravessa um inimigo com 55% do dano.'},heavy:{name:'Pesado',hint:'+8% dano e impacto; +20% recuo.'},quick:{name:'Rápido',hint:'Intervalo entre disparos 10% menor.'},precise:{name:'Preciso',hint:'Dispersão 18% menor; +10% dano na cabeça.'},quiet:{name:'Silenciado',hint:'Ruído reduzido à metade; alcance 10% menor.'},
};
export interface WeaponItem { uid:number; type:WeaponId; rarity:Rarity; magazine:number; damageBonus:number; reloadBonus:number; stability:number; capacityBonus:number; affix?:Affix }
export interface GroundWeapon { x:number;z:number;item:WeaponItem;source:string }
export function weaponStats(item:WeaponItem):WeaponDefinition {
  const d={...WEAPONS[item.type]};d.damage*=1+item.damageBonus;d.reload*=1-item.reloadBonus;d.spread*=1-item.stability;d.recoil*=1-item.stability;d.magazine+=item.capacityBonus;
  if(item.affix==='heavy'){d.damage*=1.08;d.kick*=1.4;d.recoil*=1.2;}
  if(item.affix==='quick')d.cooldown*=.9;
  if(item.affix==='precise')d.spread*=.82;
  if(item.affix==='quiet'){d.noise*=.5;d.range*=.9;}
  return d;
}
export function createWeapon(type:WeaponId,uid:number,rarity:Rarity='common',random:()=>number=()=>0):WeaponItem {
  const rank=RARITIES[rarity].rank;
  const item:WeaponItem={uid,type,rarity,magazine:0,damageBonus:rank?Math.round(random()*Math.min(.12,rank*.035)*100)/100:0,reloadBonus:rank?Math.round(random()*.03*rank*100)/100:0,stability:rank?Math.round(random()*.035*rank*100)/100:0,capacityBonus:rank>=3&&random()<.4?1:0};
  if(rank>=2){const affixes=Object.keys(AFFIXES) as Affix[];item.affix=affixes[Math.floor(random()*affixes.length)%affixes.length];}
  item.magazine=WEAPONS[type].magazine;return item;
}
export function rollRarity(random:()=>number,valuable=false):Rarity {
  const n=random();return n<(valuable?.025:.004)?'legendary':n<(valuable?.12:.035)?'epic':n<(valuable?.43:.16)?'rare':n<.72?'uncommon':'common';
}
export function rollWeapon(area:string,random:()=>number):WeaponId {
  const pools:Record<string,WeaponId[]>={police:['smg','rifle','shotgun','revolver','marksman'],house:['pistol','revolver','pistol','shotgun'],gas:['shotgun','shotgun','revolver','rifle'],hospital:['pistol','smg'],market:['pistol','revolver'],outside:['shotgun','pistol','smg']};
  const pool=pools[area]??pools.outside;return pool[Math.floor(random()*pool.length)%pool.length];
}
