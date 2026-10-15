import {BOOK_ENTRIES} from './field-book-content';
import './discovery-toast.css';
const records=new Map(BOOK_ENTRIES.map(entry=>[entry.id,entry]));
/** A separate, bounded queue keeps discoveries from replacing combat/night warnings. */
export class DiscoveryToast {
 private el:HTMLElement;private title:HTMLElement;private detail:HTMLElement;
 private pending:string[]=[];private announced=new Set<string>();private remaining=0;private sequence=0;
 constructor(root:HTMLElement){
  this.el=document.createElement('aside');this.el.id='discovery-toast';this.el.hidden=true;this.el.setAttribute('role','status');this.el.setAttribute('aria-live','polite');
  this.el.innerHTML='<span class="discovery-medal" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="m15 28-4 15 13-7 13 7-4-15"/><path d="m24 3 6 4 7 1 1 7 4 6-4 6-1 7-7 1-6 4-6-4-7-1-1-7-4-6 4-6 1-7 7-1z"/><path d="m17 21 5 5 10-11"/></svg></span><div><small>CONQUISTA DESBLOQUEADA</small><strong id="discovery-toast-title"></strong><p id="discovery-toast-detail"></p><span><kbd>L</kbd> Registrado na enciclopédia</span></div><i aria-hidden="true"></i>';
  root.append(this.el);this.title=this.el.querySelector('#discovery-toast-title')!;this.detail=this.el.querySelector('#discovery-toast-detail')!;
 }
 reset(){this.pending=[];this.announced.clear();this.remaining=0;this.sequence=0;this.el.hidden=true;delete this.el.dataset.entry;this.el.dataset.sequence='0';}
 enqueue(ids:readonly string[]){for(const id of ids)if(records.has(id)&&!this.announced.has(id)){this.announced.add(id);this.pending.push(id);}}
 update(dt:number,visible:boolean){
  if(!visible){this.el.hidden=true;return;}
  this.remaining=Math.max(0,this.remaining-dt);
  if(this.remaining===0){
   const id=this.pending.shift();if(!id){this.el.hidden=true;return;}
   const entry=records.get(id)!;this.title.textContent=entry.title;
   this.detail.textContent=entry.category==='npcs'?'Sobrevivente encontrado · localização marcada no mapa.':entry.category==='infected'?'Ameaça identificada · informações reveladas.':'Nova descoberta · informações reveladas.';
   this.el.dataset.entry=id;this.el.dataset.sequence=String(++this.sequence);this.remaining=4.2;
  }
  this.el.hidden=false;this.el.style.setProperty('--discovery-time',String(this.remaining/4.2));
 }
}
