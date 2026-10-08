import type {Simulation} from '../game/simulation';
import {ITEMS,itemKeys} from '../game/inventory';
import type {Item} from '../game/inventory';
import {MERCHANT_PROFILES,SELL_PRICES,SHOP_CATALOGS,merchantReachable,planTrade} from '../game/economy';
import type {EconomyWorld,Merchant,TradeContext,TradeRequest} from '../game/economy';
import {RARITIES} from '../game/weapons';
import {itemArt} from './item-art';
import {weaponIcon} from './variety';
import {icon} from './icons';
import './trade.css';

type TradeSimulation=Simulation & {economy:EconomyWorld;coins:number};
const money=new Intl.NumberFormat('pt-BR');
const coinMark='<svg class="trade-coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6" stroke-dasharray="2 2"/><path d="m10 8-2 4 2 4h5M9 12h5"/></svg>';
/** Static catalogue rows remain mounted while balances and quantities update. */
export class TradeHUD {
 id:string|undefined;onClose=()=>{};onTrade=(_request:TradeRequest)=>{};
 private screen:HTMLElement;private nodes=new Map<string,HTMLElement>();private cards=new Map<string,HTMLButtonElement>();
 private sim?:TradeSimulation;private mode:'buy'|'sell'='buy';private selected='';private amount=1;private listKey='';private stateKey='';private lastCheck=0;private pendingUntil=0;private pendingRevision=-1;
 constructor(private root:HTMLElement){
  root.insertAdjacentHTML('beforeend',`<section id="trade-screen" hidden role="dialog" aria-modal="true" aria-labelledby="trade-name"><div class="trade-window">
   <header class="trade-header"><div class="trade-identity"><span class="trade-emblem">${coinMark}</span><div><span class="eyebrow">Santa Luz / Rede de sobreviventes</span><h2 id="trade-name">Posto de troca</h2><span id="trade-title"></span></div></div><div class="trade-wallet"><span>SUA CARTEIRA</span><strong>${coinMark}<b id="trade-balance">0</b></strong><small>Moedas não pesam</small></div><button id="trade-close" aria-label="Fechar comércio">${icon('close')}<kbd>Esc</kbd></button></header>
   <div class="trade-layout"><aside class="trade-catalog"><div class="trade-tabs" role="tablist" aria-label="Tipo de negociação"><button id="trade-buy" role="tab" aria-selected="true">Comprar</button><button id="trade-sell" role="tab" aria-selected="false">Vender</button></div><div class="trade-catalog-label"><span id="trade-list-title">Estoque de campo</span><span id="trade-offer-count"></span></div><div id="trade-list" aria-label="Itens para negociar"></div><p id="trade-empty" hidden>Sua mochila está vazia. Recupere materiais nas ruas para negociar.</p><footer><span>CAIXA DO COMERCIANTE</span><strong>${coinMark}<b id="trade-budget">0</b></strong><small>Estoque e caixa renovam ao amanhecer.</small></footer></aside>
   <main class="trade-detail"><div class="trade-detail-scroll"><div class="trade-detail-meta"><span id="trade-category" class="eyebrow"></span><span id="trade-stock"></span></div><h3 id="trade-item-name"></h3><p id="trade-item-hint"></p><div id="trade-item-art"></div><div class="trade-item-facts"><div><span>VALOR UNITÁRIO</span><strong>${coinMark}<b id="trade-unit-price"></b></strong></div><div><span id="trade-unit-label">RECEBE POR COMPRA</span><strong id="trade-unit-quantity"></strong></div></div><p id="trade-destination"></p></div>
   <div class="trade-action"><div class="trade-total-row"><label for="trade-amount">Quantidade</label><div class="trade-amount"><button id="trade-minus" aria-label="Diminuir quantidade">−</button><input id="trade-amount" type="number" min="1" max="99" value="1" inputmode="numeric" aria-label="Quantidade a negociar"><button id="trade-plus" aria-label="Aumentar quantidade">+</button></div><strong>${coinMark}<span id="trade-total"></span></strong></div><p id="trade-reason" role="status" aria-live="polite"></p><button id="trade-confirm"><span id="trade-action-label">Comprar</span>${icon('arrow')}</button><small id="trade-pack-weight"></small></div></main></div>
   <footer class="trade-footer"><span id="trade-quote"></span><span><i></i> O mundo continua. Fique atento.</span></footer>
  </div></section>`);
  this.screen=this.el('trade-screen');this.el('trade-close').addEventListener('click',()=>this.onClose());
  this.el('trade-buy').addEventListener('click',()=>this.setMode('buy'));this.el('trade-sell').addEventListener('click',()=>this.setMode('sell'));
  this.el('trade-list').addEventListener('click',e=>{const row=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-trade-row]');if(row){this.selected=row.dataset.tradeRow!;this.amount=1;this.syncAmount();this.stateKey='';if(this.sim)this.render(this.sim);}});
  this.el('trade-minus').addEventListener('click',()=>this.setAmount(this.amount-1));this.el('trade-plus').addEventListener('click',()=>this.setAmount(this.amount+1));
  this.el('trade-amount').addEventListener('input',e=>{const value=Number((e.target as HTMLInputElement).value);this.amount=Math.max(1,Math.min(99,Number.isFinite(value)?Math.floor(value):1));this.stateKey='';if(this.sim)this.render(this.sim);});
  this.el('trade-amount').addEventListener('blur',()=>this.syncAmount());
  this.el('trade-confirm').addEventListener('click',()=>this.submit());
  this.screen.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.onClose();return;}e.stopPropagation();if(e.key==='Tab')this.keepFocus(e);});
 }
 get opened(){return this.id!==undefined;}
 get open(){return this.opened;}
 private el(id:string){let node=this.nodes.get(id);if(!node){node=this.root.querySelector<HTMLElement>(`#${id}`)!;this.nodes.set(id,node);}return node;}
 private text(id:string,value:string){const node=this.el(id);if(node.textContent!==value)node.textContent=value;}
 private setAmount(value:number){this.amount=Math.max(1,Math.min(99,value));this.syncAmount();this.stateKey='';if(this.sim)this.render(this.sim);}
 private syncAmount(){(this.el('trade-amount') as HTMLInputElement).value=String(this.amount);}
 private setMode(mode:'buy'|'sell'){if(this.mode===mode)return;this.mode=mode;this.selected='';this.amount=1;this.syncAmount();this.stateKey='';if(this.sim)this.render(this.sim);}
 show(id:string){this.id=id;this.mode='buy';this.selected='';this.amount=1;this.syncAmount();this.listKey='';this.stateKey='';this.pendingUntil=0;this.screen.hidden=false;this.root.classList.add('trade-open');if(this.sim)this.update(this.sim);this.el('trade-close').focus({preventScroll:true});}
 close(){this.id=undefined;this.screen.hidden=true;this.pendingUntil=0;this.root.classList.remove('trade-open');if(this.screen.contains(document.activeElement))(document.activeElement as HTMLElement).blur();}
 private keepFocus(e:KeyboardEvent){const nodes=[...this.screen.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')].filter(el=>!el.hidden&&el.getClientRects().length),index=nodes.indexOf(document.activeElement as HTMLElement);if(e.shiftKey&&index<=0){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&index===nodes.length-1){e.preventDefault();nodes[0]?.focus();}}
 private context(s:TradeSimulation):TradeContext{return {seed:s.runSeed,coins:s.coins,items:s.inventory.items,capacity:s.inventory.capacity,player:s.player,busy:!!s.action||!!s.reloadTimer||s.player.running||s.gameOver,groundWeaponCount:s.groundWeapons.length,nextWeaponId:s.nextWeaponId,obstacles:s.solidDefenses};}
 private request(m:Merchant):TradeRequest{return this.mode==='buy'?{merchant:m.id,revision:m.revision,mode:'buy',offer:this.selected,amount:this.amount}:{merchant:m.id,revision:m.revision,mode:'sell',item:this.selected as Item,amount:this.amount};}
 private submit(){const s=this.sim,m=s?.economy.merchants.find(v=>v.id===this.id);if(!s||!m||this.pendingUntil>performance.now())return;const request=this.request(m),result=planTrade(s.economy,this.context(s),request);if(!result.ok){this.text('trade-reason',result.reason);return;}this.pendingUntil=performance.now()+1800;this.pendingRevision=m.revision;this.onTrade(request);this.stateKey='';this.render(s);}
 private buildList(m:Merchant){
  const key=`${m.id}:${this.mode}`;if(key===this.listKey)return;this.listKey=key;this.cards.clear();
  const rows=this.mode==='buy'?SHOP_CATALOGS[m.kind].map(o=>({id:o.id,name:o.name,art:o.item?itemArt(o.item):weaponIcon(o.weapon!),price:o.price})):itemKeys.map(item=>({id:item,name:ITEMS[item].label,art:itemArt(item),price:SELL_PRICES[item]}));
  this.el('trade-list').innerHTML=rows.map(o=>`<button data-trade-row="${o.id}" class="trade-row" aria-pressed="false"><span class="trade-row-art">${o.art}</span><span class="trade-row-name">${o.name}<small></small></span><strong>${coinMark}${o.price}</strong></button>`).join('');
  for(const row of this.el('trade-list').querySelectorAll<HTMLButtonElement>('[data-trade-row]'))this.cards.set(row.dataset.tradeRow!,row);
  if(!this.selected||!this.cards.has(this.selected))this.selected=rows[0]?.id??'';
  this.el('trade-buy').setAttribute('aria-selected',String(this.mode==='buy'));this.el('trade-sell').setAttribute('aria-selected',String(this.mode==='sell'));
  this.text('trade-list-title',this.mode==='buy'?'Estoque de campo':'Sua mochila');
 }
 private render(s:TradeSimulation){
  const m=s.economy.merchants.find(v=>v.id===this.id);if(!m)return;this.buildList(m);
  if(this.pendingUntil&&m.revision!==this.pendingRevision)this.pendingUntil=0;
  const pending=this.pendingUntil>performance.now(),key=JSON.stringify([m.revision,m.coins,m.stock,s.coins,s.inventory.items,s.inventory.capacity,s.player.hp,!!s.action,!!s.reloadTimer,s.player.running,s.groundWeapons.length,s.nextWeaponId,this.selected,this.mode,this.amount,pending]);
  const now=performance.now();if(key===this.stateKey&&now-this.lastCheck<250)return;this.stateKey=key;this.lastCheck=now;
  this.text('trade-name',m.name);this.text('trade-title',m.title);this.text('trade-balance',money.format(s.coins));this.text('trade-budget',money.format(m.coins));this.text('trade-quote',MERCHANT_PROFILES.find(p=>p.id===m.id)?.hint??'');
  let visible=0;for(const [id,row] of this.cards){const count=this.mode==='buy'?m.stock[id]??0:s.inventory.items[id as Item];row.hidden=this.mode==='sell'&&count===0;if(!row.hidden)visible++;const selected=id===this.selected;row.classList.toggle('selected',selected);row.classList.toggle('out-of-stock',count===0);row.setAttribute('aria-pressed',String(selected));const label=row.querySelector('small')!,text=this.mode==='buy'?`${count} em estoque`:`${count} na mochila`;if(label.textContent!==text)label.textContent=text;}
  if(this.mode==='sell'&&this.cards.get(this.selected)?.hidden){const first=[...this.cards.entries()].find(([,row])=>!row.hidden);if(first)this.selected=first[0];}
  this.el('trade-empty').hidden=visible>0;this.text('trade-offer-count',`${visible} itens`);
  const offer=this.mode==='buy'?SHOP_CATALOGS[m.kind].find(o=>o.id===this.selected):undefined,item=this.mode==='sell'?this.selected as Item:offer?.item;
  const name=offer?.name??(item?ITEMS[item].label:''),hint=offer?.hint??(item?ITEMS[item].hint:''),price=offer?.price??(item?SELL_PRICES[item]:0),amount=offer?.amount??1,art=offer?.weapon?weaponIcon(offer.weapon):item?itemArt(item):'';
  this.text('trade-item-name',name);this.text('trade-item-hint',hint);this.text('trade-category',offer?.rarity?`${RARITIES[offer.rarity].name} / Arma modificada`:this.mode==='buy'?'Suprimentos / Oferta local':'Materiais recuperados / Venda');
  this.text('trade-stock',this.mode==='buy'?`${m.stock[this.selected]??0} disponíveis`:`${item?s.inventory.items[item]:0} na mochila`);
  const hero=this.el('trade-item-art');if(hero.dataset.item!==`${this.mode}:${this.selected}`){hero.dataset.item=`${this.mode}:${this.selected}`;hero.innerHTML=art;}
  this.text('trade-unit-price',String(price));this.text('trade-unit-label',this.mode==='buy'?'RECEBE POR COMPRA':'VENDE POR UNIDADE');this.text('trade-unit-quantity',`${amount} ${amount===1?'unidade':'unidades'}`);this.text('trade-total',money.format(price*this.amount));
  this.text('trade-destination',this.mode==='sell'?'Itens saem da mochila. Moedas entram na carteira.':offer?.weapon?'Entrega no chão junto a você. Recolha com E; sua arma atual é preservada.':`Direto para a mochila · ${(item?ITEMS[item].weight*amount:0).toLocaleString('pt-BR',{maximumFractionDigits:3})} kg por compra`);
  const result=planTrade(s.economy,this.context(s),this.request(m));this.text('trade-reason',pending?'Negociando…':!visible?'Não há itens disponíveis para esta negociação.':result.ok?'Pronto para negociar.':result.reason);
  this.el('trade-reason').classList.toggle('trade-error',!result.ok&&!pending);
  const confirm=this.el('trade-confirm') as HTMLButtonElement;confirm.disabled=pending||!result.ok||!visible;this.text('trade-action-label',pending?'Aguarde…':this.mode==='buy'?'Comprar suprimentos':'Vender por moedas');
  this.text('trade-pack-weight',`Mochila ${s.inventory.weight.toFixed(1)} / ${s.inventory.capacity} kg · Carteira sem peso`);
  (this.el('trade-minus') as HTMLButtonElement).disabled=this.amount<=1;(this.el('trade-plus') as HTMLButtonElement).disabled=this.amount>=99;
 }
 update(s:TradeSimulation){this.sim=s;if(!this.opened)return;const m=s.economy.merchants.find(v=>v.id===this.id);if(!m||s.gameOver||s.player.hp<=0||s.pendingPerks.length||!merchantReachable(m,s.player,s.solidDefenses)){this.onClose();return;}this.render(s);}
}
