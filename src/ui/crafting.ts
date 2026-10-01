import type {Simulation} from '../game/simulation';
import {MELEE,RECIPES,craftReason,available,usableBench} from '../game/crafting';
import type {MeleeId,Recipe} from '../game/crafting';
import {ITEMS,itemKeys} from '../game/inventory';
import {icon} from './icons';
import {itemArt} from './item-art';
import {recipeArt} from './recipe-art';
import './workbench.css';

const category=(r:Recipe)=>r.module||r.fortify||r.trap?'Defesas':r.weapon||r.melee?'Armas':r.armor||r.upgrade==='armor-repair'||r.upgrade==='pack'?'Equipamento':'Suprimentos';
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
const recipes=RECIPES.filter(r=>r.id!=='bench');
// Static recipe data and artwork are prepared once, not during the HUD's update loop.
const catalog=recipes.map(r=>({recipe:r,category:category(r),ingredients:itemKeys.filter(k=>r.cost[k]),search:normalize(`${r.name} ${r.hint} ${category(r)} ${itemKeys.filter(k=>r.cost[k]).map(k=>ITEMS[k].label).join(' ')}`)}));
const outcome=(r:Recipe)=>r.item?'Adicionado à mochila':r.weapon||r.melee?'Equipado ao fabricar':r.module||r.fortify?'Aplicado no abrigo':r.upgrade==='bench-repair'?'Repara a mesa próxima':r.upgrade==='repair'?'Recupera a cama':'Aplicado ao sobrevivente';
const shortReason=(reason:string)=>!reason?'Disponível':reason==='Materiais insuficientes.'?'Faltam materiais':reason.includes('já possui')?'No equipamento':reason.includes('já construído')?'Construído':reason.includes('máxima')?'Nível máximo':reason.includes('já reforçada')?'Melhoria concluída':reason.includes('Libere espaço')?'Mochila cheia':reason.includes('Nenhuma')?'Sem reparos':reason.includes('primeiro o módulo')?'Requer estrutura':reason.includes('abrigo')?'Requer abrigo':'Ver requisitos';
const searchMark='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg>';

export class CraftHUD {
 onCraft:(id:string)=>void=()=>{};onPlace:()=>void=()=>{};onReclaim:()=>void=()=>{};onMelee:(id:MeleeId)=>void=()=>{};onClose:()=>void=()=>{};
 private rendered=new Map<string,string>();private nodes=new Map<string,HTMLElement>();private cards=new Map<string,HTMLButtonElement>();private cardStatuses=new Map<string,HTMLElement>();
 private panel:HTMLElement;private station:HTMLElement;private recipe='cord';private detail='';private query='';private filter='Todas';private onlyAvailable=false;private sim?:Simulation;
 private stateKey='';private checkedAt=0;private reasons=new Map<string,string>();tableId:number|undefined;
 get open(){return this.tableId!==undefined;}
 constructor(private root:HTMLElement){
  this.panel=root.querySelector('#inventory-panel')!;
  this.panel.querySelector('.inventory-tabs')!.insertAdjacentHTML('beforeend','<button id="craft-tab">Craft</button>');
  this.panel.insertAdjacentHTML('beforeend','<div id="craft-details" hidden></div>');
  root.insertAdjacentHTML('beforeend',`<section id="workbench-screen" hidden role="dialog" aria-modal="true" aria-labelledby="workbench-title"><div class="workbench-window">
   <header class="workbench-header"><div class="bench-identity"><div class="bench-emblem">${icon('bench')}</div><div><span class="eyebrow">Santa Luz / Oficina de campo</span><h2 id="workbench-title">Mesa inteligente</h2></div></div><div class="bench-condition"><span>CONDIÇÃO DA MESA</span><strong id="bench-status"></strong><i><b id="bench-health"></b></i></div><button id="bench-close" aria-label="Fechar mesa">${icon('close')}<kbd>Esc</kbd></button></header>
   <div class="workbench-layout"><main class="bench-project"><div class="bench-detail-scroll"><div id="bench-recipe">
    <div class="bench-project-meta"><span id="recipe-family" class="eyebrow"></span><span id="recipe-status" role="status"></span></div><h3 id="recipe-title"></h3><p id="recipe-description"></p>
    <div class="recipe-assembly"><div class="bench-grid-wrap"><span class="bench-caption">01 / MATERIAIS</span><div id="recipe-grid" class="recipe-grid"></div></div><div class="recipe-arrow">${icon('arrow')}</div><div class="recipe-output"><span class="bench-caption">02 / RESULTADO</span><div id="recipe-preview"></div><span id="recipe-yield"></span></div></div>
    <div class="bench-material-heading"><h4>Materiais necessários</h4><span id="recipe-material-summary"></span></div><div id="bench-materials"></div>
   </div></div><div class="bench-action"><p id="bench-craft-note" aria-live="polite"></p><button id="bench-craft" class="craft-confirm" data-craft="cord"><span>${icon('bench')} Fabricar</span><span id="craft-quantity"></span>${icon('arrow')}</button><small id="recipe-destination"></small></div></main>
   <aside class="bench-catalog"><header><div><span class="eyebrow">Manual de sobrevivência</span><h3>Catálogo de receitas</h3></div><span id="catalog-count"></span></header><label class="bench-search" for="recipe-search">${searchMark}<input id="recipe-search" type="search" placeholder="Buscar item ou material…" aria-label="Buscar receita ou material" maxlength="60" autocomplete="off"><kbd>/</kbd></label>
    <div class="bench-filters"><label class="bench-category"><span>Categoria</span><select id="recipe-category" aria-label="Categoria">${['Todas','Suprimentos','Armas','Equipamento','Defesas'].map(c=>`<option>${c}</option>`).join('')}</select></label><label class="available-filter"><input id="recipe-available" type="checkbox"><span>Só disponíveis</span></label></div>
    <div id="recipe-catalog" aria-label="Receitas">${catalog.map(({recipe:r})=>`<button data-recipe="${r.id}" class="recipe-card" aria-pressed="false"><span class="catalog-art">${recipeArt(r)}</span><span class="catalog-name">${r.name}</span><small class="catalog-status"></small></button>`).join('')}</div>
    <div id="catalog-empty" hidden>${searchMark}<strong>Nenhuma receita encontrada</strong><p>Tente outro nome, material ou categoria.</p><button id="recipe-reset">Limpar filtros</button></div>
   </aside></div>
   <footer class="bench-footer"><div id="bench-tools"><span class="bench-caption">SEU EQUIPAMENTO <b id="bench-armor"></b></span><div class="craft-tools">${(Object.keys(MELEE) as MeleeId[]).map(id=>`<button data-melee="${id}" title="Equipar ${MELEE[id].name}">${icon(id==='fists'?'hand':id)}<span>${MELEE[id].name}</span></button>`).join('')}</div></div><div class="bench-packup"><button id="reclaim-bench">${icon('withdraw')} Recolher mesa <small>3 kg</small></button><span id="bench-reclaim-note"></span></div></footer><div class="bench-field-note"><span><i></i> O mundo continua. Fique atento ao redor.</span><span>Materiais da mochila <b>·</b> Alcance de 3 m</span></div>
  </div></section><div id="placement-help" hidden>POSICIONAR MESA · Ande e mire no chão<br><kbd>Esquerdo</kbd> confirmar · <kbd>Direito / Esc</kbd> cancelar</div><div id="bench-interact" hidden><kbd>Botão direito</kbd> Mesa inteligente</div>`);
  this.station=this.el('workbench-screen');
  for(const b of this.station.querySelectorAll<HTMLButtonElement>('[data-recipe]')){this.cards.set(b.dataset.recipe!,b);this.cardStatuses.set(b.dataset.recipe!,b.querySelector('.catalog-status')!);}
  this.station.addEventListener('keydown',e=>this.keydown(e));
  this.el('craft-tab').addEventListener('click',()=>{this.panel.classList.add('craft-tab');this.panel.classList.remove('equipment-tab');root.querySelectorAll('.inventory-tabs button').forEach(b=>b.classList.toggle('selected',b.id==='craft-tab'));this.el('equipment-details').hidden=true;this.el('craft-details').hidden=false;});
  root.addEventListener('click',e=>{
   const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-craft],[data-recipe],[data-melee],#place-bench,#reclaim-bench,#bench-close');if(!b||b.disabled)return;
   if(b.dataset.recipe){this.recipe=b.dataset.recipe;if(this.sim)this.updateStation(this.sim);}
   else if(b.dataset.craft){this.onCraft(b.dataset.craft);this.stateKey='';if(this.sim&&this.open)this.updateStation(this.sim);}
   else if(b.dataset.melee)this.onMelee(b.dataset.melee as MeleeId);
   else if(b.id==='reclaim-bench')this.onReclaim();else if(b.id==='bench-close')this.onClose();else this.onPlace();
  });
  this.el('recipe-search').addEventListener('input',e=>{this.query=normalize((e.target as HTMLInputElement).value);this.filterCatalog(true);});
  this.el('recipe-category').addEventListener('change',e=>{this.filter=(e.target as HTMLSelectElement).value;this.filterCatalog(true);});
  this.el('recipe-available').addEventListener('change',e=>{this.onlyAvailable=(e.target as HTMLInputElement).checked;this.filterCatalog(true);});
  this.el('recipe-reset').addEventListener('click',()=>{this.query='';this.filter='Todas';this.onlyAvailable=false;(this.el('recipe-search') as HTMLInputElement).value='';(this.el('recipe-category') as HTMLSelectElement).value='Todas';(this.el('recipe-available') as HTMLInputElement).checked=false;this.filterCatalog(true);this.el('recipe-search').focus();});
 }
 private el(id:string):HTMLElement {let node=this.nodes.get(id);if(!node){node=this.root.querySelector<HTMLElement>(`#${id}`)!;this.nodes.set(id,node);}return node;}
 private text(id:string,value:string){const el=this.el(id);if(el.textContent!==value)el.textContent=value;}
 private put(id:string,html:string){if(this.rendered.get(id)===html)return;const el=this.el(id);el.innerHTML=html;this.rendered.set(id,html);}
 show(id:number){this.tableId=id;this.station.hidden=false;this.root.classList.add('workbench-open');this.stateKey='';if(this.sim)this.update(this.sim);this.el('bench-close').focus({preventScroll:true});}
 close(){this.tableId=undefined;this.station.hidden=true;this.root.classList.remove('workbench-open');if(this.station.contains(document.activeElement))(document.activeElement as HTMLElement).blur();}
 private keydown(e:KeyboardEvent){
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.onClose();return;}
  // Preserve Tab-to-close from the game's controls, but never trigger gameplay hotkeys here.
  if(e.key==='Tab')return;
  e.stopPropagation();
  if(e.key==='/'&&!(e.target instanceof HTMLInputElement)){e.preventDefault();this.el('recipe-search').focus();return;}
  const card=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-recipe]');
  if(!card||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const visible=[...this.cards.values()].filter(b=>!b.hidden),index=visible.indexOf(card),columns=getComputedStyle(this.el('recipe-catalog')).gridTemplateColumns.split(' ').length;
  const next=e.key==='Home'?0:e.key==='End'?visible.length-1:index+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:e.key==='ArrowDown'?columns:-columns);
  const target=visible[Math.max(0,Math.min(visible.length-1,next))];target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest'});
 }
 private filterCatalog(resetScroll=false){
  const terms=this.query.split(/\s+/).filter(Boolean);let shown=0;
  for(const entry of catalog){const b=this.cards.get(entry.recipe.id)!,hide=(this.filter!=='Todas'&&entry.category!==this.filter)||(this.onlyAvailable&&!!this.reasons.get(entry.recipe.id))||!terms.every(term=>entry.search.includes(term));if(b.hidden!==hide)b.hidden=hide;if(!hide)shown++;}
  this.text('catalog-count',`${shown} / ${catalog.length}`);if(this.el('catalog-empty').hidden!==(shown>0))this.el('catalog-empty').hidden=shown>0;if(this.el('recipe-catalog').hidden!==(shown===0))this.el('recipe-catalog').hidden=shown===0;
  if(resetScroll)this.el('recipe-catalog').scrollTop=0;
 }
 private refreshReasons(s:Simulation){
  // Material/action changes refresh immediately. A short fallback also rechecks moving
  // blockers for construction without ray-testing every recipe ten times a second.
  const key=JSON.stringify([s.inventory.items,s.inventory.capacity,s.gear,s.packCrafted,s.action?.kind,!!s.reloadTimer,s.player.running,s.baseHP,s.crafting.revision,s.barricades.map(b=>[b.hp,b.tier]),s.groundWeapons.length]);
  const now=performance.now();if(key===this.stateKey&&now-this.checkedAt<400)return;this.stateKey=key;this.checkedAt=now;
  for(const r of recipes){const reason=craftReason(s,r),b=this.cards.get(r.id)!,status=this.cardStatuses.get(r.id)!;this.reasons.set(r.id,reason);b.classList.toggle('unavailable',!!reason);if(status.textContent!==shortReason(reason))status.textContent=shortReason(reason);const title=reason?`${r.name} · ${reason}`:r.name;if(b.title!==title)b.title=title;}
  this.filterCatalog();
 }
 private selectDetail(r:Recipe){
  if(this.detail===r.id)return;this.detail=r.id;
  const ingredients=catalog.find(c=>c.recipe.id===r.id)!.ingredients;
  this.text('recipe-family',`${category(r)} / PROJETO ${String(recipes.indexOf(r)+1).padStart(2,'0')}`);this.text('recipe-title',r.name);this.text('recipe-description',r.hint);
  this.put('recipe-preview',recipeArt(r));this.text('recipe-yield',`${r.amount??1} ${r.amount&&r.amount>1?'unidades':'unidade'}`);this.text('recipe-destination',outcome(r));this.text('craft-quantity',`×${r.amount??1}`);
  this.put('recipe-grid',Array.from({length:9},(_,i)=>{const k=ingredients[i];return `<div class="recipe-cell${k?'':' vacant'}" ${k?`data-ingredient="${k}" title="${ITEMS[k].label}"`:'aria-hidden="true"'}>${k?`${itemArt(k)}<strong>${r.cost[k]}</strong><span>${ITEMS[k].label}</span>`:'<i></i>'}</div>`;}).join(''));
  this.put('bench-materials',ingredients.map(k=>`<div class="bench-material" data-material="${k}">${itemArt(k)}<span>${ITEMS[k].label}</span><span class="material-missing"></span><b><span class="material-have"></span><small> / ${r.cost[k]}</small></b></div>`).join(''));
  const button=this.el('bench-craft') as HTMLButtonElement;button.dataset.craft=r.id;button.setAttribute('aria-label',`Fabricar ${r.name}`);
  for(const [id,b] of this.cards){const selected=id===r.id;b.classList.toggle('selected',selected);if(b.getAttribute('aria-pressed')!==String(selected))b.setAttribute('aria-pressed',String(selected));}
 }
 private updateStation(s:Simulation){
  const table=s.crafting.tables.find(t=>t.id===this.tableId);if(!table)return;
  this.text('bench-status',`${Math.ceil(table.hp)} / 200`);const hp=`${Math.max(0,Math.min(100,table.hp/2))}%`;if(this.el('bench-health').style.width!==hp)this.el('bench-health').style.width=hp;
  this.refreshReasons(s);const r=recipes.find(r=>r.id===this.recipe)??recipes[0];this.recipe=r.id;this.selectDetail(r);
  const ingredients=catalog.find(c=>c.recipe.id===r.id)!.ingredients;let complete=0;
  for(const k of ingredients){const have=available(s,k),need=r.cost[k]!,missing=Math.max(0,need-have),row=this.el('bench-materials').querySelector<HTMLElement>(`[data-material="${k}"]`)!;if(!missing)complete++;
   row.classList.toggle('missing',!!missing);const count=row.querySelector('.material-have')!;if(count.textContent!==String(have))count.textContent=String(have);const hint=row.querySelector('.material-missing')!,text=missing?`Faltam ${missing}`:'Pronto';if(hint.textContent!==text)hint.textContent=text;
   this.el('recipe-grid').querySelector(`[data-ingredient="${k}"]`)!.classList.toggle('missing',!!missing);
  }
  this.text('recipe-material-summary',`${complete} / ${ingredients.length} disponíveis`);
  const reason=this.reasons.get(r.id)??craftReason(s,r);this.text('recipe-status',shortReason(reason));this.el('recipe-status').classList.toggle('ready',!reason);this.text('bench-craft-note',reason||'Tudo pronto. Materiais preenchidos automaticamente.');
  const button=this.el('bench-craft') as HTMLButtonElement;if(button.disabled!==!!reason)button.disabled=!!reason;
  this.text('bench-armor',`Proteção ${Math.ceil(s.gear.armor)}`);
  for(const b of this.el('bench-tools').querySelectorAll<HTMLButtonElement>('[data-melee]')){const id=b.dataset.melee as MeleeId;const hidden=!s.gear.owned.includes(id);if(b.hidden!==hidden)b.hidden=hidden;const selected=s.meleeMode&&s.meleeId===id;b.classList.toggle('selected',selected);if(b.getAttribute('aria-pressed')!==String(selected))b.setAttribute('aria-pressed',String(selected));}
  const damaged=table.hp<200,heavy=s.inventory.weight+ITEMS.bench.weight>s.inventory.capacity+1e-8;
  const reclaim=this.el('reclaim-bench') as HTMLButtonElement;if(reclaim.disabled!==(damaged||heavy))reclaim.disabled=damaged||heavy;this.text('bench-reclaim-note',damaged?'Repare a mesa antes de recolher.':heavy?'Libere 3 kg na mochila.':'A mesa volta para sua mochila.');
 }
 update(s:Simulation){
  this.sim=s;
  if(this.open){if(!usableBench(s,this.tableId!)||s.gameOver||s.player.hp<=0){this.onClose();return;}this.updateStation(s);return;}
  if(!this.panel.classList.contains('craft-tab')||!this.panel.closest('.inventory-open'))return;
  const r=RECIPES[0],reason=craftReason(s,r);
  this.put('craft-details',`<div class="craft-status"><span class="eyebrow">Primeiro passo</span><h3>${icon('bench')} Mesa inteligente</h3><p>Fabrique sua mesa, posicione no chão e interaja com o botão direito para abrir o catálogo completo.</p></div><div class="craft-cost">${itemKeys.filter(k=>r.cost[k]).map(k=>`<span>${ITEMS[k].label}: ${available(s,k)} / ${r.cost[k]}</span>`).join('')}</div><button data-craft="bench" ${reason?'disabled':''}>${reason||'Fabricar mesa'}</button>${s.inventory.items.bench?`<button id="place-bench">Posicionar mesa (${s.inventory.items.bench})</button><p>Ande e mova a mira para escolher o local. Botão esquerdo confirma; direito cancela.</p>`:''}`);
 }
}
