import type {Simulation} from '../game/simulation';
import {usableChest} from '../game/chests';
import type {ChestMove,ChestSource,ChestStack} from '../game/chests';
import {ITEMS,itemKeys} from '../game/inventory';
import {WEAPONS} from '../game/weapons';
import {itemArt} from './item-art';
import {weaponIcon} from './variety';
import './chests.css';
const art=(v:ChestStack|null)=>v?('item' in v?itemArt(v.item):weaponIcon(v.weapon.type)):'';
const label=(v:ChestStack|null)=>v?('item' in v?ITEMS[v.item].label:WEAPONS[v.weapon.type].name):'Espaço vazio';
const count=(v:ChestStack|null)=>v?('item' in v?v.amount:1):0;
export class ChestHUD {
 id:number|undefined;private screen:HTMLElement;private sim?:Simulation;private cache='';
 private selection?:{source:ChestSource;amount:number;revision:number};
 onClose=()=>{};onMove=(_m:ChestMove)=>{};onReclaim=(_id:number)=>{};onRelocate=(_id:number)=>{};
 constructor(private root:HTMLElement){
  root.insertAdjacentHTML('beforeend',`<section id="chest-screen" hidden role="dialog" aria-label="Baú"><div class="chest-window"><header><div><span class="eyebrow">Armazenamento compartilhado</span><h2>BAÚ</h2></div><button id="chest-close">Fechar · Esc</button></header><p>27 espaços · até 64 itens por pilha · armas ocupam um espaço</p><div id="chest-grid" class="chest-grid"></div><h3>Mochila <small id="chest-weight"></small></h3><div id="chest-bag" class="chest-grid"></div><p id="chest-selection" aria-live="polite"></p><footer>Clique: selecionar e colocar · Direito: metade / colocar 1<br>Shift + clique: transferir pilha · Arraste entre os espaços<br>O mundo continua. Afaste-se para fechar o baú.</footer><div class="chest-furniture-actions"><button id="chest-relocate">Reposicionar baú <small>preserva todos os itens</small></button><button id="chest-reclaim">Recolher baú vazio · 2 kg</button></div></div></section>`);
  this.screen=root.querySelector('#chest-screen')!;root.querySelector('#chest-close')!.addEventListener('click',()=>this.onClose());root.querySelector('#chest-reclaim')!.addEventListener('click',()=>{if(this.id!==undefined)this.onReclaim(this.id);});
  root.querySelector('#chest-relocate')!.addEventListener('click',()=>{if(this.id!==undefined)this.onRelocate(this.id);});
  this.screen.addEventListener('click',e=>this.click(e));this.screen.addEventListener('contextmenu',e=>{e.preventDefault();this.click(e,true);});
  this.screen.addEventListener('dragstart',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-chest-slot],[data-bag-item],[data-bag-weapon]');if(!b)return;this.pick(b,false);e.dataTransfer?.setData('text/plain','last-night-chest');});
  this.screen.addEventListener('dragover',e=>e.preventDefault());this.screen.addEventListener('drop',e=>{e.preventDefault();this.click(e);});
 }
 get open(){return this.id!==undefined;}
 show(id:number){this.id=id;this.selection=undefined;this.cache='';this.screen.hidden=false;this.root.classList.add('chest-open');}
 close(){this.id=undefined;this.selection=undefined;this.screen.hidden=true;this.root.classList.remove('chest-open');}
 private pick(b:HTMLElement,half:boolean){
  const s=this.sim,c=s?.crafting.chests.find(c=>c.id===this.id);if(!s||!c)return;
  let source:ChestSource,amount:number;
  if(b.dataset.chestSlot!==undefined){source={slot:Number(b.dataset.chestSlot)};amount=count(c.slots[source.slot]);}
  else if(b.dataset.bagItem){source={bag:b.dataset.bagItem as keyof typeof ITEMS};amount=Math.min(64,s.inventory.items[source.bag]);}
  else {source={weapon:Number(b.dataset.bagWeapon) as 0|1};amount=s.loadout[source.weapon]?1:0;}
  if(amount)this.selection={source,amount:half?Math.ceil(amount/2):amount,revision:c.revision};this.cache='';
 }
 private click(e:MouseEvent,one=false){
  const target=e.target as HTMLElement,b=target.closest<HTMLElement>('[data-chest-slot],[data-bag-item],[data-bag-weapon]'),c=this.sim?.crafting.chests.find(c=>c.id===this.id);if(!c)return;
  if(e.shiftKey&&b){this.pick(b,false);if(this.selection)this.send('slot' in this.selection.source?'bag':'auto',this.selection.amount);return;}
  if(!this.selection){if(b)this.pick(b,one);return;}
  if(this.selection.revision!==c.revision){this.selection=undefined;return;}
  if(b?.dataset.chestSlot!==undefined){const i=Number(b.dataset.chestSlot);if('slot' in this.selection.source&&i===this.selection.source.slot){this.selection=undefined;this.cache='';return;}this.send(i,one?1:this.selection.amount);}
  else if(target.closest('#chest-bag'))this.send('bag',one?1:this.selection.amount);
 }
 private send(target:ChestMove['target'],amount:number){if(!this.selection||this.id===undefined)return;this.onMove({chest:this.id,revision:this.selection.revision,source:this.selection.source,target,amount});this.selection=undefined;this.cache='';}
 update(s:Simulation){this.sim=s;if(this.id===undefined)return;if(!usableChest(s,this.id)||s.pendingPerks.length){this.onClose();return;}const c=s.crafting.chests.find(c=>c.id===this.id)!;
  if(this.selection&&this.selection.revision!==c.revision)this.selection=undefined;
  const key=JSON.stringify([c.slots,c.revision,s.inventory.items,s.loadout,this.selection]);if(key===this.cache)return;this.cache=key;
  const button=(v:ChestStack|null,attrs:string,selected=false)=>`<button class="chest-slot ${selected?'selected':''}" ${attrs} draggable="${!!v}" title="${label(v)}" aria-label="${label(v)}${v?' · '+count(v):''}">${art(v)}${v?`<strong>${count(v)}</strong><span>${label(v)}</span>`:''}</button>`;
  this.root.querySelector('#chest-grid')!.innerHTML=c.slots.map((v,i)=>button(v,`data-chest-slot="${i}"`,!!this.selection&&'slot' in this.selection.source&&this.selection.source.slot===i)).join('');
  const bag=itemKeys.filter(k=>s.inventory.items[k]).map(k=>button({item:k,amount:s.inventory.items[k]},`data-bag-item="${k}"`,!!this.selection&&'bag' in this.selection.source&&this.selection.source.bag===k));
  for(const i of [0,1] as const)if(s.loadout[i])bag.push(button({weapon:s.loadout[i]!},`data-bag-weapon="${i}"`,!!this.selection&&'weapon' in this.selection.source&&this.selection.source.weapon===i));
  this.root.querySelector('#chest-bag')!.innerHTML=bag.join('')+Array.from({length:Math.max(1,18-bag.length)},()=>button(null,'data-bag-empty')).join('');
  this.root.querySelector('#chest-weight')!.textContent=`${s.inventory.weight.toFixed(1)} / ${s.inventory.capacity} kg`;
  this.root.querySelector('#chest-selection')!.textContent=this.selection?`${this.selection.amount} selecionado(s). Clique no destino. Esc fecha sem perder itens.`:'Selecione uma pilha ou use Shift + clique para transferir.';
  (this.root.querySelector('#chest-reclaim') as HTMLButtonElement).disabled=c.slots.some(Boolean)||s.inventory.weight+ITEMS.chest.weight>s.inventory.capacity;
 }
}
