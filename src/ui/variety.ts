import {CraftHUD} from './crafting';
import {MELEE,RECIPES} from '../game/crafting';
import type {MeleeId} from '../game/crafting';
import type { Simulation } from '../game/simulation';
import { WEAPONS, RARITIES, AFFIXES, weaponStats } from '../game/weapons';
import type { WeaponId, WeaponItem } from '../game/weapons';
import { PERKS } from '../game/perks';
import type { PerkId } from '../game/perks';
import { icon, emblem } from './icons';
import {recipeArt} from './recipe-art';

const silhouettes:Record<WeaponId,string>={
  pistol:'M8 17h52v11H34l-4 20H16l5-20H8z M40 28v9h-8',
  revolver:'M9 18h56v8H39l-5 5-7 19H14l7-23H9z M28 15h16v15H28z M46 20h19',
  smg:'M8 17h48v12H31v22H21V29H8z M56 20h13v6H56 M10 17V9h12v8 M37 29v10h11V29',
  shotgun:'M3 24h57v7H29l-8 8H7l4-8H3z M28 19h45v6H28 M40 26h17v10H40 M19 30l-3 9',
  rifle:'M2 22h53v10H33l-2 18H21l4-18-8 8H3z M55 23h20v4H55 M33 16h17v6H33 M42 28h14v7H42',
  marksman:'M2 24h52v9H33l-5 13H16l4-13H2z M53 24h25v5H53 M31 15h23v7H31 M36 22v4 M8 33l-6 8',
};
export const weaponIcon=(type:WeaponId):string=>`<svg class="weapon-silhouette" viewBox="0 0 80 60" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="bevel" aria-hidden="true"><path d="${silhouettes[type]}"/></svg>`;
const number=(n:number)=>Number(n.toFixed(1)).toLocaleString('pt-BR');
const detail=(item:WeaponItem)=>{const s=weaponStats(item);return `${number(s.damage)}${s.pellets>1?' × '+s.pellets:''} dano · ${s.magazine} cargas · ${number(s.reload)} s${s.reloadStyle==='shell'?' / cartucho':''}`;};
const toolArt=(id:MeleeId)=>{const recipe=RECIPES.find(r=>r.melee===id);return recipe?recipeArt(recipe):icon('hand');};
export class VarietyHUD {
  craft:CraftHUD;
  private cache=new Map<string,string>();
  private nodes=new Map<string,HTMLElement>();
  private cartridges:HTMLElement[]=[];private magazine=-1;private shownAmmo=-1;private weaponKey='';private equipmentKey='';
  private weaponPanel:HTMLElement;
  private lastOffer=''; equipment=false;
  onStore:(slot:0|1)=>void=()=>{};onRetrieve:(uid:number)=>void=()=>{};onSlot:(slot:0|1|2|3)=>void=()=>{};onMelee:(id:MeleeId)=>void=()=>{};onPerk:(id:PerkId)=>void=()=>{};
  constructor(private root:HTMLElement){
    root.insertAdjacentHTML('beforeend',`<section id="perk-screen" class="perk-screen" hidden aria-label="Escolha um perk"><div class="perk-paper"><header>${emblem}<span class="eyebrow">Registro de sobrevivência / amanhecer</span><h2>Você aprendeu a resistir.</h2><p>Escolha uma vantagem para esta expedição.</p></header><div id="perk-options" class="perk-options"></div><footer>Uma escolha. Mais uma noite. <span>Vantagens duram até o fim da expedição.</span></footer></div></section><section id="weapon-compare" class="weapon-compare" hidden aria-label="Comparação de equipamento"></section>`);
    const inventory=root.querySelector('#inventory-panel')!;
    inventory.querySelector('.capacity')!.insertAdjacentHTML('beforebegin','<nav class="inventory-tabs"><button id="supplies-tab" class="selected">Suprimentos</button><button id="equipment-tab">Armas e vantagens</button></nav><div id="equipment-details" hidden></div>');
    root.querySelector('#equipment-tab')!.addEventListener('click',()=>this.tab(true));root.querySelector('#supplies-tab')!.addEventListener('click',()=>this.tab(false));
    root.querySelector('#perk-options')!.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-perk]');if(b)this.onPerk(b.dataset.perk as PerkId);});
    for(const slot of [0,1] as const)root.querySelector(`#slot-${slot+1}`)!.addEventListener('click',()=>this.onSlot(slot));
    root.querySelector('#equipment-details')!.addEventListener('click',e=>{const target=e.target as HTMLElement;const store=target.closest<HTMLButtonElement>('[data-store]'),retrieve=target.closest<HTMLButtonElement>('[data-retrieve]'),tool=target.closest<HTMLButtonElement>('[data-equipment-melee]'),b=target.closest<HTMLButtonElement>('[data-slot]');if(store)this.onStore(Number(store.dataset.store) as 0|1);else if(retrieve)this.onRetrieve(Number(retrieve.dataset.retrieve));else if(tool&&!tool.disabled)this.onMelee(tool.dataset.equipmentMelee as MeleeId);else if(b)this.onSlot(Number(b.dataset.slot) as 0|1|2|3);});
    root.querySelector('#slot-2')!.insertAdjacentHTML('afterend','<button id="slot-3" title="3 · Arma branca"><kbd>3</kbd>Branca</button><button id="slot-4" title="4 · Punhos"><kbd>4</kbd>Punhos</button>');
    root.querySelector('#slot-3')!.addEventListener('click',()=>this.onSlot(2));root.querySelector('#slot-4')!.addEventListener('click',()=>this.onSlot(3));this.craft=new CraftHUD(root);
    this.weaponPanel=root.querySelector<HTMLElement>('.weapon-panel')!;
    const name=root.querySelector('.weapon-name')!;name.id='weapon-name';name.nextElementSibling!.id='weapon-caliber';root.querySelector('.weapon-icon')!.id='weapon-icon';
  }
  private el(id:string):HTMLElement {let node=this.nodes.get(id);if(!node){node=this.root.querySelector<HTMLElement>(`#${id}`)!;this.nodes.set(id,node);}return node;}
  private html(id:string,value:string):void {if(this.cache.get(id)===value)return;this.el(id).innerHTML=value;this.cache.set(id,value);}
  private showCartridges(capacity:number,ammo:number):void {
    if(capacity!==this.magazine){const holder=this.el('cartridges'),fragment=document.createDocumentFragment();this.cartridges=[];for(let i=0;i<capacity;i++){const cartridge=document.createElement('i');fragment.append(cartridge);this.cartridges.push(cartridge);}holder.replaceChildren(fragment);this.magazine=capacity;this.shownAmmo=-1;}
    if(ammo===this.shownAmmo)return;this.shownAmmo=ammo;for(let i=0;i<this.cartridges.length;i++)this.cartridges[i].classList.toggle('spent',i>=ammo);
  }
  tab(equipment:boolean):void{this.el('inventory-panel').classList.remove('craft-tab');const craft=this.root.querySelector<HTMLElement>('#craft-details');if(craft)craft.hidden=true;this.root.querySelector('#craft-tab')?.classList.remove('selected');this.equipment=equipment;this.el('inventory-panel').classList.toggle('equipment-tab',equipment);this.el('equipment-details').hidden=!equipment;this.el('equipment-tab').classList.toggle('selected',equipment);this.el('supplies-tab').classList.toggle('selected',!equipment);}
  reset():void{this.tab(false);this.lastOffer='';this.el('perk-screen').hidden=true;this.root.classList.remove('choosing-perk');}
  update(sim:Simulation):void {
    this.craft.update(sim);this.root.classList.toggle('melee-mode',sim.meleeMode);for(const slot of [2,3] as const)this.el(`slot-${slot+1}`).classList.toggle('selected',sim.activeSlot===slot);
    const item=sim.equipped,s=sim.weapon,r=RARITIES[item.rarity];
    const weaponKey=sim.meleeMode?`tool:${sim.meleeId}`:`gun:${item.type}`;if(weaponKey!==this.weaponKey){this.weaponKey=weaponKey;this.html('weapon-name',sim.meleeMode?MELEE[sim.meleeId].name:s.name);this.html('weapon-icon',sim.meleeMode?icon(sim.meleeId==='fists'?'hand':sim.meleeId):weaponIcon(item.type));this.html('weapon-caliber',sim.meleeMode?(sim.meleeId==='hammer'?'Construção livre · peças encaixáveis':`${MELEE[sim.meleeId].damage} dano · alcance ${number(MELEE[sim.meleeId].reach)} m`):`${s.ammo==='ammo'?'Munição leve':s.ammo==='shells'?'Cartuchos':'Munição de rifle'} · ${s.automatic?'automática':'tiro a tiro'}`);}
    if(this.weaponPanel.style.getPropertyValue('--rarity')!==r.color)this.weaponPanel.style.setProperty('--rarity',r.color);
    this.showCartridges(s.magazine,sim.ammo);
    for(const slot of [0,1] as const){const gun=sim.loadout[slot],b=this.el(`slot-${slot+1}`) as HTMLButtonElement;if(b.disabled!==!gun)b.disabled=!gun;b.classList.toggle('selected',slot===sim.activeSlot);const label=gun?`${slot+1} · ${WEAPONS[gun.type].name}`:`${slot+1} · Arma longa vazia`;if(b.getAttribute('aria-label')!==label)b.setAttribute('aria-label',label);if(b.title!==label)b.title=label;this.html(`slot-${slot+1}`,`<kbd>${slot+1}</kbd>${gun?weaponIcon(gun.type):'<span>—</span>'}`);}
    const choosing=sim.pendingPerks.length>0&&!sim.gameOver&&this.root.classList.contains('playing');
    if(this.el('perk-screen').hidden!==!choosing)this.el('perk-screen').hidden=!choosing;this.root.classList.toggle('choosing-perk',choosing);
    if(choosing&&this.lastOffer!==sim.pendingPerks.join(',')){this.lastOffer=sim.pendingPerks.join(',');this.html('perk-options',sim.pendingPerks.map((id,i)=>`<button class="perk-option" data-perk="${id}"><span class="perk-number">0${i+1}</span>${icon(PERKS[id].icon)}<strong>${PERKS[id].name}</strong><p>${PERKS[id].hint}</p><span class="perk-choose">Levar comigo ${icon('arrow')}</span></button>`).join(''));}
    const ground=sim.nearbyWeapon,compare=this.el('weapon-compare');
    const compareHidden=!ground||!!sim.action||choosing||this.root.classList.contains('paused')||this.root.classList.contains('inventory-open')||this.root.classList.contains('map-open');if(compare.hidden!==compareHidden)compare.hidden=compareHidden;
    if(ground&&!compare.hidden){const next=ground.item,n=weaponStats(next),old=sim.loadout[n.slot],o=old?weaponStats(old):null,rarity=RARITIES[next.rarity];if(compare.style.getPropertyValue('--rarity')!==rarity.color)compare.style.setProperty('--rarity',rarity.color);
      this.html('weapon-compare',`<span class="eyebrow">${rarity.name}${next.affix?' · '+AFFIXES[next.affix].name:''}</span><header>${weaponIcon(next.type)}<h3>${n.name}</h3></header><small>${old&&o?'Substitui '+WEAPONS[old.type].name:'Slot de arma longa livre'}</small><footer><kbd>E</kbd> Pegar · slot ${n.slot+1}</footer>`);
    }
    if(this.equipment&&!this.el('inventory-panel').classList.contains('craft-tab')&&this.root.classList.contains('inventory-open')){
      const equipmentKey=`${sim.activeSlot}:${sim.meleeId}:${Math.ceil(sim.gear.armor)}:${sim.gear.owned.join(',')}:${[...sim.perks].join(',')}:${sim.loadout.map(g=>g?`${g.uid},${g.type},${g.rarity},${g.affix},${g.magazine}`:'empty').join(';')}`;
      if(equipmentKey===this.equipmentKey)return;this.equipmentKey=equipmentKey;this.html('equipment-details',`${sim.loadout.map((gun,slot)=>`<button class="equipment-row ${slot===sim.activeSlot?'selected':''}" data-slot="${slot}" ${gun?'':'disabled'}><kbd>${slot+1}</kbd>${gun?weaponIcon(gun.type):icon('gun')}<div><strong>${gun?WEAPONS[gun.type].name:'Arma longa vazia'}</strong><small>${gun?`${RARITIES[gun.rarity].name}${gun.affix?' · '+AFFIXES[gun.affix].name:''}`:'Encontre equipamento na cidade.'}</small>${gun?`<p>${detail(gun)}</p><small>${gun.magazine} carregadas</small>`:''}</div></button>`).join('')}
      <section class="equipment-tools" aria-labelledby="equipment-tools-title"><header><h3 id="equipment-tools-title">Ferramentas e corpo a corpo</h3><span>Equipar</span></header><div class="owned-tools">${[...sim.gear.owned].sort((a,b)=>a==='hammer'?-1:b==='hammer'?1:0).map(id=>{const selected=sim.meleeMode&&sim.meleeId===id;return `<button class="owned-tool${id==='hammer'?' owned-tool--builder':''}${selected?' selected':''}" data-equipment-melee="${id}" aria-label="Equipar ${MELEE[id].name}" aria-pressed="${selected}"><span class="owned-tool-art">${toolArt(id)}</span><span class="owned-tool-name"><strong>${MELEE[id].name}</strong><small>${id==='hammer'?'Erga paredes, portas e andares':id==='fists'?'Sem arma':`${MELEE[id].damage} dano · ${number(MELEE[id].reach)} m`}</small></span><span class="owned-tool-state">${selected?'Na mão':id==='hammer'?'Construir':'Equipar'}</span></button>`;}).join('')}</div>${!sim.gear.owned.includes('hammer')?'<p class="equipment-tools-note">Fabrique um martelo na mesa inteligente para construir seu abrigo.</p>':'<p class="equipment-tools-note">Martelo na mão: escolha uma peça na barra de construção. Equipe outra arma para voltar ao combate.</p>'}</section>
      <p class="equipment-armor">${icon('armor')} Armadura <strong>${Math.ceil(sim.gear.armor)}</strong><span>durabilidade</span></p><p class="equipment-storage-note">Guarde suas armas em um baú fabricado e colocado no chão.</p><h3 class="perks-label">O que você aprendeu</h3><div class="owned-perks">${sim.perks.size?[...sim.perks].map(id=>`<p>${icon(PERKS[id].icon)}<span><b>${PERKS[id].name}</b><small>${PERKS[id].hint}</small></span></p>`).join(''):'<p>Sobreviva à noite para escolher sua primeira vantagem.</p>'}</div>`);
    }
  }
}
