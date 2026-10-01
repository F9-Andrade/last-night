import type {Simulation} from '../game/simulation';
import {FOODS} from '../game/nutrition';
import type {FoodId} from '../game/nutrition';
import {itemKeys} from '../game/inventory';
import {icon} from './icons';
import {itemArt} from './item-art';
import './nutrition.css';

const foods=Object.keys(FOODS) as FoodId[];
const foodSet=new Set<string>(foods);
const benefit=(value:number,label:string)=>value?`<span class="${value<0?'food-cost':''}">${value>0?'+':''}${value} ${label}</span>`:'';
/** Shared field supplies presentation; all consumption decisions stay in the simulation. */
export class NutritionHUD {
  onConsume: (item:FoodId)=>void=()=>{};
  private previousFood='';
  private cache=new Map<string,string>();
  private elements=new Map<string,HTMLElement>();
  constructor(private root:HTMLElement,private select:(item:typeof itemKeys[number])=>void){
    root.querySelector('.resource-strip')!.insertAdjacentHTML('beforebegin',`<section class="nutrition-meters" aria-label="Necessidades de sobrevivência">${(['hunger','thirst'] as const).map(k=>`<div id="nutrition-${k}" class="nutrition-meter" role="meter" aria-label="${k==='hunger'?'Saciedade':'Hidratação'}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">${icon(k)}<span>${k==='hunger'?'Saciedade':'Hidratação'}</span><b id="nutrition-${k}-value">100</b><i><em id="nutrition-${k}-bar"></em></i></div>`).join('')}<small id="nutrition-warning" hidden></small></section>`);
    root.querySelector('.game-ui')!.insertAdjacentHTML('beforeend','<section id="consumption-progress" hidden aria-label="Consumo em andamento"><div id="consumption-art"></div><div><strong id="consumption-label"></strong><span id="consumption-time"></span><i><b id="consumption-bar"></b></i></div></section>');
    root.querySelector('.inventory-items')!.insertAdjacentHTML('beforebegin',`<div class="supplies-filter" role="group" aria-label="Filtrar suprimentos"><button data-supplies="all" aria-pressed="true">Tudo</button><button data-supplies="food" aria-pressed="false">Alimentos <small id="food-count">0</small></button><button data-supplies="supplies" aria-pressed="false">Recursos</button></div>`);
    root.querySelector('.supplies-filter')!.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-supplies]');if(b)this.filter(b.dataset.supplies!);});
    for(const id of foods){const food=FOODS[id],detail=root.querySelector(`#detail-${id}`)!;
      detail.querySelector('.item-actions')!.insertAdjacentHTML('beforebegin',`<div class="food-benefits">${benefit(food.hunger,'saciedade')}${benefit(food.thirst,'hidratação')}<span>${food.duration.toLocaleString('pt-BR')} s</span></div>`);
      detail.querySelector('.item-actions')!.insertAdjacentHTML('afterbegin',`<button id="consume-${id}" class="consume-button">${icon(food.kind==='drink'?'thirst':'hunger')} ${food.kind==='drink'?'Beber':'Comer'}</button>`);
      root.querySelector(`#consume-${id}`)!.addEventListener('click',()=>this.onConsume(id));
    }
  }
  private el(id:string):HTMLElement{let el=this.elements.get(id);if(!el){el=this.root.querySelector<HTMLElement>(`#${id}`)!;this.elements.set(id,el);}return el;}
  private text(id:string,value:string):void{if(this.cache.get(id)===value)return;this.el(id).textContent=value;this.cache.set(id,value);}
  private filter(group:string):void{
    this.root.querySelectorAll<HTMLElement>('[data-supplies]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.supplies===group)));
    const visible=itemKeys.filter(id=>group==='all'||foodSet.has(id)===(group==='food'));
    for(const id of itemKeys)this.el(`select-${id}`).hidden=!visible.includes(id);
    const selected=this.root.querySelector<HTMLElement>('.item-slot.selected');
    if(selected?.hidden&&visible.length)this.select(visible[0]);
  }
  reset():void{this.filter('all');this.previousFood='';this.el('consumption-progress').hidden=true;}
  update(sim:Simulation):void{
    for(const key of ['hunger','thirst'] as const){const value=Math.max(0,Math.min(100,sim.nutrition[key])),meter=this.el(`nutrition-${key}`);
      this.text(`nutrition-${key}-value`,String(Math.ceil(value)));meter.setAttribute('aria-valuenow',String(Math.round(value)));meter.classList.toggle('low',value<=25);meter.classList.toggle('critical',value<=10);this.el(`nutrition-${key}-bar`).style.width=`${value.toFixed(1)}%`;
    }
    const hunger=sim.nutrition.hunger<=25,thirst=sim.nutrition.thirst<=25,warning=this.el('nutrition-warning');warning.hidden=!hunger&&!thirst;
    this.text('nutrition-warning',hunger&&thirst?'Com fome e sede · abra a mochila':thirst?'Com sede · procure uma bebida':'Com fome · procure alimento');
    const consumption=sim.consumption,progress=this.el('consumption-progress');progress.hidden=!consumption;this.root.classList.toggle('consuming',!!consumption);
    if(consumption){const food=FOODS[consumption.item];if(this.previousFood!==consumption.item){this.el('consumption-art').innerHTML=itemArt(consumption.item);this.previousFood=consumption.item;}
      this.text('consumption-label',`${food.kind==='drink'?'Bebendo':'Comendo'} · ${food.label}`);this.text('consumption-time',`${Math.max(0,consumption.duration-consumption.elapsed).toFixed(1).replace('.',',')} s`);this.el('consumption-bar').style.width=`${Math.min(100,consumption.elapsed/consumption.duration*100).toFixed(1)}%`;
    }
    if(this.root.classList.contains('inventory-open')){
      this.text('food-count',String(foods.reduce((total,id)=>total+sim.inventory.items[id],0)));
      for(const id of foods){const food=FOODS[id],button=this.el(`consume-${id}`) as HTMLButtonElement,full=(food.hunger<=0||sim.nutrition.hunger>=99.9)&&(food.thirst<=0||sim.nutrition.thirst>=99.9),busy=!!consumption||!!sim.action||sim.reloadTimer>0||sim.switchTimer>0;
        button.disabled=!sim.inventory.items[id]||full||busy||sim.gameOver;
        button.title=!sim.inventory.items[id]?'Encontre este alimento na cidade.':full?'Você já está satisfeito.':busy?'Termine a ação atual.':`Consumir 1 · ${food.duration.toLocaleString('pt-BR')} s`;
      }
    }
  }
}
