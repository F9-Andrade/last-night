import type {Simulation} from '../game/simulation';
import {STRUCTURE_DEFS,structureMaxHP,structureFortifyCost,structureRepairCost,structureActionReason,focusedStructure} from '../game/construction';
import type {Structure,StructureKind,StructurePlacement} from '../game/construction';
import {ITEMS,itemKeys} from '../game/inventory';
import type {Item} from '../game/inventory';
import {recipeArt} from './recipe-art';
import {icon} from './icons';
import './construction.css';

export const BUILD_SLOTS:readonly StructureKind[]=['wall','window','door','floor','roof','stairs','spikes','snare','wire'];
const constructionItems=itemKeys.filter(k=>BUILD_SLOTS.some(kind=>STRUCTURE_DEFS[kind].cost[k])||structureFortifyCost({tier:0})[k]||structureFortifyCost({tier:1})[k]||structureRepairCost({tier:0})[k]||structureRepairCost({tier:1})[k]||structureRepairCost({tier:2})[k]);
const slotLabels=['Parede','Janela','Porta','Piso','Teto','Escada','Estacas','Laço','Arame'];
export const floorLabel=(level:number)=>level===0?'Térreo':`${level}º andar`;
export type StructureOperation='fortify'|'repair'|'toggle'|'dismantle';
const tierLabels=['Madeira estrutural','Trama reforçada','Blindagem de sucata'];
const art=(kind:StructureKind)=>recipeArt({id:`build-${kind}`,name:STRUCTURE_DEFS[kind].name,hint:'',cost:STRUCTURE_DEFS[kind].cost,construction:kind});

/** Small field inspector: stable action buttons, updated values, no inventory rebuild per frame. */
export class ConstructionHUD {
 onSelect=(_kind:StructureKind)=>{};onHolster=()=>{};
 id:number|undefined;onClose=()=>{};onAction=(_p:Structure,_operation:StructureOperation)=>{};
 private screen:HTMLElement;private panel:HTMLElement;private selection?:Structure;private key='';
 private preview:HTMLElement;private previewKey='';private previewKind?:StructureKind;private toolbar:HTMLElement;private toolbarKey='';
 private nodes=new Map<string,HTMLElement>();private htmlCache=new Map<string,string>();
 private slots:{kind:StructureKind;button:HTMLButtonElement;count:HTMLElement;ingredients:Item[]}[]=[];
 private tiers:HTMLElement[]=[];
 constructor(private root:HTMLElement){
  root.insertAdjacentHTML('beforeend',`<section id="construction-screen" hidden role="dialog" aria-labelledby="construction-title"><div class="construction-window">
   <header><div><span class="eyebrow">Abrigo / Estrutura instalada</span><h2 id="construction-title"></h2></div><button id="construction-close" aria-label="Fechar estrutura">${icon('close')}<kbd>Esc</kbd></button></header>
   <div class="construction-identity"><div id="construction-art"></div><div><span id="construction-level"></span><strong id="construction-tier"></strong><small id="construction-hp"></small><i class="structure-health"><b id="construction-health"></b></i></div></div>
   <div class="construction-tiers">${tierLabels.map((label,i)=>`<span data-tier="${i}"><b>0${i+1}</b>${label}</span>`).join('')}</div>
   <section class="structure-upgrade"><span class="eyebrow">Próxima fortificação</span><h3 id="construction-next"></h3><p id="construction-fortify-note"></p><div id="construction-materials"></div><button id="construction-fortify">Fortificar estrutura ${icon('arrow')}</button></section>
   <div class="structure-secondary"><button id="construction-repair">Reparar <small id="construction-repair-cost"></small></button><button id="construction-toggle">Abrir porta</button></div><p id="construction-repair-note"></p>
   <details class="structure-remove"><summary>Desmontar peça</summary><p>A remoção exige que não haja peças ou móveis apoiados nela.</p><button id="construction-dismantle">Confirmar desmontagem</button><small id="construction-remove-note"></small></details>
   <footer>Fortifique no local. O mundo continua enquanto você trabalha.</footer>
  </div></section><aside id="build-preview-hud" hidden aria-live="polite"><header><span class="eyebrow">Projeto de abrigo</span><span id="build-level"></span></header><div class="build-preview-title"><div id="build-art"></div><div><h3 id="build-name"></h3><p id="build-dimensions"></p></div></div><div id="build-cost"></div><p id="build-status"></p><footer><span><kbd>R</kbd> Girar</span><span><kbd>PgUp/Dn</kbd> Andar</span><span><kbd>Esc</kbd> Sair</span></footer></aside><nav id="build-hotbar" hidden aria-label="Peças de construção"><header><span>${icon('hammer')} Martelo de construção</span><small><kbd>1–9</kbd> / roda · Selecionar</small><button id="hammer-holster" aria-label="Guardar martelo"><kbd>B</kbd> Guardar</button></header><div class="build-slots">${BUILD_SLOTS.map((kind,i)=>`<button data-build-kind="${kind}" aria-label="${i+1}: ${STRUCTURE_DEFS[kind].name}" aria-pressed="false"><kbd>${i+1}</kbd><span class="build-slot-art">${art(kind)}</span><b>${slotLabels[i]}</b><small class="build-slot-count" aria-label="Quantidade disponível">0</small></button>`).join('')}</div></nav>`);
  this.screen=this.el('construction-screen');this.panel=this.screen.querySelector('.construction-window')!;this.preview=this.el('build-preview-hud');this.toolbar=this.el('build-hotbar');
  this.el('hammer-holster').onclick=()=>this.onHolster();
  for(const button of this.toolbar.querySelectorAll<HTMLButtonElement>('[data-build-kind]')){const kind=button.dataset.buildKind as StructureKind,ingredients=itemKeys.filter(k=>STRUCTURE_DEFS[kind].cost[k]);button.onclick=()=>this.onSelect(kind);button.title=`${STRUCTURE_DEFS[kind].name} · ${ingredients.map(k=>`${STRUCTURE_DEFS[kind].cost[k]} ${ITEMS[k].label.toLowerCase()}`).join(' + ')}`;this.slots.push({kind,button,count:button.querySelector('.build-slot-count')!,ingredients});}
  this.tiers=Array.from(this.panel.querySelectorAll<HTMLElement>('[data-tier]'));
  this.el('construction-close').onclick=()=>this.onClose();
  for(const operation of ['fortify','repair','toggle','dismantle'] as const)this.el(`construction-${operation}`).onclick=()=>{if(this.selection)this.onAction(this.selection,operation);};
  this.screen.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Tab'||e.code==='KeyE'){e.preventDefault();e.stopPropagation();this.onClose();}else e.stopPropagation();});
 }
 private el(id:string){let node=this.nodes.get(id);if(!node){node=this.root.querySelector<HTMLElement>(`#${id}`)!;this.nodes.set(id,node);}return node;}
 private html(id:string,value:string){if(this.htmlCache.get(id)===value)return;this.el(id).innerHTML=value;this.htmlCache.set(id,value);}
 private text(id:string,text:string){const el=this.el(id);if(el.textContent!==text)el.textContent=text;}
 get open(){return this.id!==undefined;}
 show(p:Structure){this.id=p.id;this.selection=p;this.key='';this.screen.hidden=false;this.root.classList.add('construction-open');this.el('construction-close').focus({preventScroll:true});}
 close(){this.id=undefined;this.selection=undefined;this.screen.hidden=true;this.root.classList.remove('construction-open');if(this.panel.contains(document.activeElement))(document.activeElement as HTMLElement).blur();}
 private costs(s:Simulation,cost:Partial<Record<Item,number>>){return itemKeys.filter(k=>cost[k]).map(k=>`<span class="${s.inventory.items[k]<(cost[k]??0)?'missing':''}">${ITEMS[k].label}<b>${s.inventory.items[k]} <small>/ ${cost[k]}</small></b></span>`).join('');}
 update(s:Simulation,p?:StructurePlacement,hidden=false,focused?:Structure|null){
  const hide=!p||hidden;if(this.preview.hidden!==hide)this.preview.hidden=hide;if(this.toolbar.hidden!==hide)this.toolbar.hidden=hide;this.root.classList.toggle('building-active',!!p&&!hidden);
  const stockKey=(p&&!hidden||this.id!==undefined)?constructionItems.map(k=>s.inventory.items[k]).join(','):'';
  if(p&&!hidden){
   const toolbarKey=`${p.kind}:${stockKey}`;
   if(toolbarKey!==this.toolbarKey){this.toolbarKey=toolbarKey;for(const {kind,button,count,ingredients} of this.slots){
    let available=Infinity;for(const k of ingredients)available=Math.min(available,Math.floor(s.inventory.items[k]/STRUCTURE_DEFS[kind].cost[k]!));
    const selected=String(kind===p.kind);if(button.getAttribute('aria-pressed')!==selected)button.setAttribute('aria-pressed',selected);button.classList.toggle('unaffordable',available===0);
    const value=String(available);if(count.textContent!==value)count.textContent=value;
   }}
  }
  if(p&&!hidden){const key=`${p.kind}:${p.level}:${p.valid}:${p.reason}:${stockKey}`;if(key!==this.previewKey){this.previewKey=key;const def=STRUCTURE_DEFS[p.kind];if(this.previewKind!==p.kind){this.previewKind=p.kind;this.el('build-art').innerHTML=art(p.kind);}this.text('build-name',def.name);this.text('build-level',floorLabel(p.level));this.text('build-dimensions',['wall','window','door'].includes(p.kind)?'3 m de largura · 3 m de altura':p.kind==='stairs'?'3 × 3 m · sobe um andar':'Módulo de 3 × 3 m');this.html('build-cost',this.costs(s,def.cost));this.text('build-status',p.valid?'Encaixe livre · clique para construir':p.reason);this.preview.classList.toggle('invalid',!p.valid);}}
  if(this.id===undefined)return;
  const selected=s.crafting.structures.find(v=>v.id===this.id);if(!selected||s.gameOver||s.player.hp<=0||(focused===undefined?focusedStructure(s):focused)?.id!==selected.id){this.onClose();return;}
  this.selection=selected;const key=`${selected.id}:${selected.kind}:${selected.level}:${selected.rotation}:${selected.hp}:${selected.tier}:${selected.open}:${selected.revision}:${stockKey}:${!!s.action}:${!!s.reloadTimer}`;if(key===this.key)return;this.key=key;
  const maximum=structureMaxHP(selected),cost=structureFortifyCost(selected),repair=structureRepairCost(selected);
  this.text('construction-title',STRUCTURE_DEFS[selected.kind].name);this.html('construction-art',art(selected.kind));this.text('construction-level',floorLabel(selected.level));this.text('construction-tier',tierLabels[selected.tier]);this.text('construction-hp',`${Math.ceil(selected.hp)} / ${maximum} resistência`);this.el('construction-health').style.width=`${Math.max(0,selected.hp/maximum*100)}%`;
  for(const node of this.tiers)node.classList.toggle('active',Number(node.dataset.tier)<=selected.tier);
  this.text('construction-next',selected.tier<2?tierLabels[selected.tier+1]:'Fortificação máxima');this.html('construction-materials',selected.tier<2?this.costs(s,cost):'');
  this.text('construction-repair-cost',itemKeys.filter(k=>repair[k]).map(k=>`${repair[k]} ${ITEMS[k].label.toLowerCase()}`).join(' · '));
  for(const operation of ['fortify','repair','toggle','dismantle'] as const){const reason=structureActionReason(s,selected,operation);const button=this.el(`construction-${operation}`) as HTMLButtonElement;button.disabled=!!reason;button.title=reason;if(operation==='fortify')this.text('construction-fortify-note',reason||'Reforça a peça com os materiais da sua mochila.');if(operation==='repair')this.text('construction-repair-note',reason);if(operation==='dismantle')this.text('construction-remove-note',reason);}
  this.el('construction-toggle').hidden=selected.kind!=='door';this.text('construction-toggle',selected.open?'Fechar porta':'Abrir porta');
 }
}
