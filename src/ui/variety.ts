import type { Simulation } from '../game/simulation';
import { WEAPONS, RARITIES, AFFIXES, weaponStats } from '../game/weapons';
import type { WeaponId, WeaponItem } from '../game/weapons';
import { PERKS } from '../game/perks';
import type { PerkId } from '../game/perks';
import { icon, emblem } from './icons';

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
export class VarietyHUD {
  private cache=new Map<string,string>();
  private lastOffer=''; equipment=false;
  onSlot:(slot:0|1)=>void=()=>{};onPerk:(id:PerkId)=>void=()=>{};
  constructor(private root:HTMLElement){
    root.insertAdjacentHTML('beforeend',`<section id="perk-screen" class="perk-screen" hidden aria-label="Escolha um perk"><div class="perk-paper"><header>${emblem}<span class="eyebrow">Registro de sobrevivência / amanhecer</span><h2>Você aprendeu a resistir.</h2><p>Escolha uma vantagem para esta expedição.</p></header><div id="perk-options" class="perk-options"></div><footer>Uma escolha. Mais uma noite. <span>Vantagens duram até o fim da expedição.</span></footer></div></section><section id="weapon-compare" class="weapon-compare" hidden aria-label="Comparação de equipamento"></section>`);
    const inventory=root.querySelector('#inventory-panel')!;
    inventory.querySelector('.capacity')!.insertAdjacentHTML('beforebegin','<nav class="inventory-tabs"><button id="supplies-tab" class="selected">Suprimentos</button><button id="equipment-tab">Armas e vantagens</button></nav><div id="equipment-details" hidden></div>');
    root.querySelector('#equipment-tab')!.addEventListener('click',()=>this.tab(true));root.querySelector('#supplies-tab')!.addEventListener('click',()=>this.tab(false));
    root.querySelector('#perk-options')!.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-perk]');if(b)this.onPerk(b.dataset.perk as PerkId);});
    for(const slot of [0,1] as const)root.querySelector(`#slot-${slot+1}`)!.addEventListener('click',()=>this.onSlot(slot));
    root.querySelector('#equipment-details')!.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-slot]');if(b)this.onSlot(Number(b.dataset.slot) as 0|1);});
    const name=root.querySelector('.weapon-name')!;name.id='weapon-name';name.nextElementSibling!.id='weapon-caliber';root.querySelector('.weapon-icon')!.id='weapon-icon';
  }
  private html(id:string,value:string):void {if(this.cache.get(id)===value)return;this.root.querySelector(`#${id}`)!.innerHTML=value;this.cache.set(id,value);}
  tab(equipment:boolean):void{this.equipment=equipment;this.root.querySelector('#inventory-panel')!.classList.toggle('equipment-tab',equipment);(this.root.querySelector('#equipment-details') as HTMLElement).hidden=!equipment;this.root.querySelector('#equipment-tab')!.classList.toggle('selected',equipment);this.root.querySelector('#supplies-tab')!.classList.toggle('selected',!equipment);}
  reset():void{this.tab(false);this.lastOffer='';(this.root.querySelector('#perk-screen') as HTMLElement).hidden=true;this.root.classList.remove('choosing-perk');}
  update(sim:Simulation):void {
    const item=sim.equipped,s=sim.weapon,r=RARITIES[item.rarity];
    this.html('weapon-name',s.name);this.html('weapon-icon',weaponIcon(item.type));this.html('weapon-caliber',`${s.ammo==='ammo'?'Munição leve':s.ammo==='shells'?'Cartuchos':'Munição de rifle'} · ${s.automatic?'automática':'tiro a tiro'}`);
    (this.root.querySelector('.weapon-panel') as HTMLElement).style.setProperty('--rarity',r.color);
    this.html('cartridges',Array.from({length:s.magazine},(_,i)=>`<i${i>=sim.ammo?' class="spent"':''}></i>`).join(''));
    for(const slot of [0,1] as const){const gun=sim.loadout[slot],b=this.root.querySelector<HTMLButtonElement>(`#slot-${slot+1}`)!;b.disabled=!gun;b.classList.toggle('selected',slot===sim.activeSlot);b.setAttribute('aria-label',gun?`${slot+1} · ${WEAPONS[gun.type].name}`:`${slot+1} · Arma longa vazia`);b.title=b.getAttribute('aria-label')!;this.html(`slot-${slot+1}`,`<kbd>${slot+1}</kbd>${gun?weaponIcon(gun.type):'<span>—</span>'}`);}
    const choosing=sim.pendingPerks.length>0&&!sim.gameOver&&this.root.classList.contains('playing');
    (this.root.querySelector('#perk-screen') as HTMLElement).hidden=!choosing;this.root.classList.toggle('choosing-perk',choosing);
    if(choosing&&this.lastOffer!==sim.pendingPerks.join(',')){this.lastOffer=sim.pendingPerks.join(',');this.html('perk-options',sim.pendingPerks.map((id,i)=>`<button class="perk-option" data-perk="${id}"><span class="perk-number">0${i+1}</span>${icon(PERKS[id].icon)}<strong>${PERKS[id].name}</strong><p>${PERKS[id].hint}</p><span class="perk-choose">Levar comigo ${icon('arrow')}</span></button>`).join(''));}
    const ground=sim.nearbyWeapon,compare=this.root.querySelector<HTMLElement>('#weapon-compare')!;
    compare.hidden=!ground||!!sim.action||choosing||this.root.classList.contains('paused')||this.root.classList.contains('inventory-open')||this.root.classList.contains('map-open');
    if(ground&&!compare.hidden){const next=ground.item,n=weaponStats(next),old=sim.loadout[n.slot],o=old?weaponStats(old):null,rarity=RARITIES[next.rarity];compare.style.setProperty('--rarity',rarity.color);
      const delta=(a:number,b:number,inverse=false)=>{const d=a-b;return `<b class="${(inverse?-d:d)>0?'better':d===0?'same':'worse'}">${d>0?'+':''}${number(d)}</b>`;};
      const precision=(s:typeof n)=>number(s.spread*180/Math.PI);
      const cadence=(s:typeof n)=>number(1/s.cooldown);
      const reload=(s:typeof n)=>number(s.reload*(s.reloadStyle==='shell'?s.magazine:1));
      this.html('weapon-compare',`<span class="eyebrow">${rarity.name} · ${next.affix?AFFIXES[next.affix].name:'Sem modificador'}</span><header>${weaponIcon(next.type)}<h3>${n.name}</h3></header><p>${detail(next)}</p>${old&&o?`<div class="comparison-deltas"><span>Dano ${delta(n.damage*n.pellets,o.damage*o.pellets)}</span><span>Cadência ${delta(1/n.cooldown,1/o.cooldown)} / s</span><span>Precisão <b class="${n.spread<o.spread?'better':n.spread>o.spread?'worse':'same'}">${precision(n)}°</b></span><span>Pente ${delta(n.magazine,o.magazine)}</span></div><small>Substitui ${WEAPONS[old.type].name}. A arma atual fica no chão.</small>`:`<div class="comparison-deltas"><span>Cadência <b>${cadence(n)} / s</b></span><span>Precisão <b>${precision(n)}°</b></span></div><small>Slot de arma longa livre.</small>`}<p>Recarga completa: ${reload(n)} s · alcance eficaz: ${number(Math.min(n.falloff,n.range))} m</p>${next.affix?`<p class="affix-hint">${AFFIXES[next.affix].hint}</p>`:''}<footer><kbd>E</kbd> Equipar no slot ${n.slot+1}</footer>`);
    }
    if(this.equipment&&this.root.classList.contains('inventory-open'))this.html('equipment-details',`${sim.loadout.map((gun,slot)=>`<button class="equipment-row ${slot===sim.activeSlot?'selected':''}" data-slot="${slot}" ${gun?'':'disabled'}><kbd>${slot+1}</kbd>${gun?weaponIcon(gun.type):icon('gun')}<div><strong>${gun?WEAPONS[gun.type].name:'Arma longa vazia'}</strong><small>${gun?`${RARITIES[gun.rarity].name}${gun.affix?' · '+AFFIXES[gun.affix].name:''}`:'Encontre equipamento na cidade.'}</small>${gun?`<p>${detail(gun)}</p><small>${gun.magazine} carregadas</small>`:''}</div></button>`).join('')}<h3 class="perks-label">O que você aprendeu</h3><div class="owned-perks">${sim.perks.size?[...sim.perks].map(id=>`<p>${icon(PERKS[id].icon)}<span><b>${PERKS[id].name}</b><small>${PERKS[id].hint}</small></span></p>`).join(''):'<p>Sobreviva à noite para escolher sua primeira vantagem.</p>'}</div>`);
  }
}
