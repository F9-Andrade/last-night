import type {Simulation} from '../game/simulation';
import {MELEE,RECIPES,craftReason,available,usableBench} from '../game/crafting';
import type {MeleeId,Recipe} from '../game/crafting';
import {ITEMS,itemKeys} from '../game/inventory';
import {icon} from './icons';
import {itemArt} from './item-art';
const category=(r:Recipe)=>r.module||r.fortify||r.trap?'Defesas':r.weapon||r.melee?'Armas':r.armor||r.upgrade==='armor-repair'||r.upgrade==='pack'?'Equipamento':'Suprimentos';
const mark=(r:Recipe)=>r.item?itemArt(r.item):icon(r.melee==='fists'?'hand':r.melee??(r.trap?'danger':r.module||r.fortify?'shelter':r.weapon?'gun':r.armor||r.upgrade==='armor-repair'?'armor':r.upgrade==='bench-repair'?'bench':'bag'));
export class CraftHUD {
 onCraft:(id:string)=>void=()=>{};onPlace:()=>void=()=>{};onReclaim:()=>void=()=>{};onMelee:(id:MeleeId)=>void=()=>{};onClose:()=>void=()=>{};
 private rendered=new Map<string,string>();private previous='';private panel:HTMLElement;private station:HTMLElement;private recipe='cord';private query='';private filter='Todas';private onlyAvailable=false;tableId:number|undefined;
 get open(){return this.tableId!==undefined;}
 constructor(private root:HTMLElement){
  this.panel=root.querySelector('#inventory-panel')!;
  this.panel.querySelector('.inventory-tabs')!.insertAdjacentHTML('beforeend','<button id="craft-tab">Craft</button>');
  this.panel.insertAdjacentHTML('beforeend','<div id="craft-details" hidden></div>');
  root.insertAdjacentHTML('beforeend',`<section id="workbench-screen" hidden role="dialog" aria-label="Mesa inteligente"><div class="workbench-window"><header><div><span class="eyebrow">Oficina de sobrevivência</span><h2>${icon('bench')} MESA INTELIGENTE</h2><p id="bench-status"></p></div><button id="bench-close" aria-label="Fechar mesa">Fechar · Esc</button></header><div class="workbench-layout"><main><div id="bench-recipe"></div><div id="bench-tools"></div><button id="reclaim-bench">Recolher mesa intacta · 3 kg</button><small>O mundo continua. Mantenha-se a até 3 m da mesa.</small></main><aside><label for="recipe-search">Catálogo de receitas</label><input id="recipe-search" type="search" placeholder="Buscar item ou material…" maxlength="60"><select id="recipe-category" aria-label="Categoria">${['Todas','Suprimentos','Armas','Equipamento','Defesas'].map(c=>`<option>${c}</option>`).join('')}</select><label class="available-filter"><input id="recipe-available" type="checkbox"> Apenas disponíveis</label><div id="recipe-catalog"></div></aside></div></div></section><div id="placement-help" hidden>POSICIONAR MESA · Ande e mire no chão<br><kbd>Esquerdo</kbd> confirmar · <kbd>Direito / Esc</kbd> cancelar</div><div id="bench-interact" hidden><kbd>Botão direito</kbd> Mesa inteligente</div>`);
  this.station=root.querySelector('#workbench-screen')!;
  this.station.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.onClose();}});
  root.querySelector('#craft-tab')!.addEventListener('click',()=>{this.panel.classList.add('craft-tab');this.panel.classList.remove('equipment-tab');root.querySelectorAll('.inventory-tabs button').forEach(b=>b.classList.toggle('selected',b.id==='craft-tab'));(root.querySelector('#equipment-details') as HTMLElement).hidden=true;(root.querySelector('#craft-details') as HTMLElement).hidden=false;});
  root.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-craft],[data-recipe],[data-melee],#place-bench,#reclaim-bench,#bench-close');if(!b||b.disabled)return;if(b.dataset.recipe){this.recipe=b.dataset.recipe;this.previous='';}else if(b.dataset.craft)this.onCraft(b.dataset.craft);else if(b.dataset.melee)this.onMelee(b.dataset.melee as MeleeId);else if(b.id==='reclaim-bench')this.onReclaim();else if(b.id==='bench-close')this.onClose();else this.onPlace();});
  root.querySelector('#recipe-search')!.addEventListener('input',e=>{this.query=(e.target as HTMLInputElement).value.toLocaleLowerCase('pt-BR');this.previous='';});
  root.querySelector('#recipe-category')!.addEventListener('change',e=>{this.filter=(e.target as HTMLSelectElement).value;this.previous='';});
  root.querySelector('#recipe-available')!.addEventListener('change',e=>{this.onlyAvailable=(e.target as HTMLInputElement).checked;this.previous='';});
 }
 show(id:number){this.tableId=id;this.station.hidden=false;this.root.classList.add('workbench-open');this.previous='';}
 close(){this.tableId=undefined;this.station.hidden=true;this.root.classList.remove('workbench-open');this.previous='';}
 private put(id:string,html:string){const el=this.root.querySelector(`#${id}`)!;if(this.rendered.get(id)===html)return;const scroll=el.scrollTop;el.innerHTML=html;el.scrollTop=scroll;this.rendered.set(id,html);}
 update(s:Simulation){
  if(this.open){
   if(!usableBench(s,this.tableId!)||s.gameOver||s.player.hp<=0){this.onClose();return;}
   const table=s.crafting.tables.find(t=>t.id===this.tableId)!;
   this.put('bench-status',`${Math.ceil(table.hp)} / 200 HP · Materiais da mochila`);
   const recipes=RECIPES.filter(r=>r.id!=='bench'),r=recipes.find(r=>r.id===this.recipe)??recipes[0];
   const ingredients=itemKeys.filter(k=>r.cost[k]);const reason=craftReason(s,r);
   this.put('bench-recipe',`<span class="eyebrow">${category(r)}</span><h3>${r.name}</h3><p>${r.hint}</p><div class="recipe-assembly"><div class="recipe-grid">${Array.from({length:9},(_,i)=>{const k=ingredients[i];return `<div class="recipe-cell ${k&&available(s,k)<r.cost[k]!? 'missing':''}">${k?`${itemArt(k)}<strong>${r.cost[k]}</strong><small>${ITEMS[k].label}</small>`:''}</div>`;}).join('')}</div><span class="recipe-arrow">→</span><div class="recipe-output">${mark(r)}<strong>${r.amount??1}</strong></div></div><p class="craft-help">Selecione uma receita no catálogo. Os materiais são preenchidos automaticamente.</p><div class="craft-cost">${ingredients.map(k=>`<span class="${available(s,k)<r.cost[k]!? 'missing':''}">${ITEMS[k].label}: ${available(s,k)} / ${r.cost[k]}</span>`).join('')}</div><button class="craft-confirm" data-craft="${r.id}" ${reason?'disabled':''}>${reason||'Fabricar '+r.name}</button>`);
   this.put('bench-tools',`<span class="eyebrow">Ferramentas · proteção ${Math.ceil(s.gear.armor)}</span><div class="craft-tools">${s.gear.owned.map(id=>`<button data-melee="${id}" class="${s.meleeMode&&s.meleeId===id?'selected':''}">${MELEE[id].name}</button>`).join('')}</div>`);
   (this.root.querySelector('#reclaim-bench') as HTMLButtonElement).disabled=table.hp<200;
   const shown=recipes.filter(r=>(this.filter==='Todas'||category(r)===this.filter)&&(!this.onlyAvailable||!craftReason(s,r))&&`${r.name} ${r.hint} ${itemKeys.filter(k=>r.cost[k]).map(k=>ITEMS[k].label).join(' ')}`.toLocaleLowerCase('pt-BR').includes(this.query));
   this.put('recipe-catalog',shown.map(r=>`<button data-recipe="${r.id}" class="${r.id===this.recipe?'selected ':''}${craftReason(s,r)?'unavailable':''}" title="${r.name}">${mark(r)}<span>${r.name}</span><small>${craftReason(s,r)?'Ver requisitos':'Disponível'}</small></button>`).join('')||'<p>Nenhuma receita encontrada.</p>');
   return;
  }
  if(!this.panel.classList.contains('craft-tab')||!this.panel.closest('.inventory-open'))return;
  const r=RECIPES[0],reason=craftReason(s,r);
  const html=`<div class="craft-status"><span class="eyebrow">Primeiro passo</span><h3>${icon('bench')} Mesa inteligente</h3><p>Fabrique sua mesa, posicione no chão e interaja com o botão direito para abrir o catálogo completo.</p></div><div class="craft-cost">${itemKeys.filter(k=>r.cost[k]).map(k=>`<span>${ITEMS[k].label}: ${available(s,k)} / ${r.cost[k]}</span>`).join('')}</div><button data-craft="bench" ${reason?'disabled':''}>${reason||'Fabricar mesa'}</button>${s.inventory.items.bench?`<button id="place-bench">Posicionar mesa (${s.inventory.items.bench})</button><p>Ande e mova a mira para escolher o local. Botão esquerdo confirma; direito cancela.</p>`:''}`;
  if(html!==this.previous){this.put('craft-details',html);this.previous=html;}
 }
}
