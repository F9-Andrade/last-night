import {GUIDE_CHAPTERS, BOOK_ENTRIES, BOOK_CATEGORIES} from './field-book-content';
import type {BookKind, BookCategory, BookEntry, GuideChapter} from './field-book-content';
import {RECIPES} from '../game/crafting';
import {recipeArt} from './recipe-art';
import {icon} from './icons';
import type {Icon} from './icons';
import './field-books.css';

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const number=(n:number)=>String(n).padStart(2,'0');
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text=''):HTMLElementTagNameMap[K]=>{
 const el=document.createElement(tag);el.className=className;el.textContent=text;return el;
};
const chevron=(back=false)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${back?'m14 5-7 7 7 7M7 12h14':'m10 5 7 7-7 7M17 12H3'}"/></svg>`;
const cityArt=`<svg viewBox="0 0 360 138" fill="none" aria-hidden="true"><path fill="#c4b38b" d="M0 0h360v138H0z"/><path fill="#b2996f" d="M0 97h43V73h25V48h40v44h49V58h23V37h31v55h31V63h42v23h31V69h45v69H0z"/><circle cx="248" cy="34" r="24" fill="#d9c49a"/><path fill="#595849" d="M0 115h28V85l30-18 36 19v29h22V76l43-18 39 18v39h49V81l32-17 36 17v34h45v23H0z"/><path fill="#393d35" d="M137 138V96h27v42m102 0V99h21v39M0 122h360v16H0z"/><path stroke="#d0b58b" stroke-width="3" d="M42 90h12v12H42zM68 90h12v12H68zM127 83h12v10h-12zm44 0h13v10h-13zM252 89h10v11h-10zm40 0h10v11h-10z"/><path fill="#626047" d="M12 75h9v52h-9zM5 44h23v31H5zM0 54h34v13H0zm317 15h10v62h-10zm-10-44h32v44h-32zm-8 16h47v22h-47z"/><path stroke="#66614c" stroke-width="3" d="M219 114V42h18M106 114V46H92"/><path stroke="#c6b48e" opacity=".6" d="M12 131h109m97 0h124m-180 0h26"/></svg>`;

/** Small original voxel field sketches. These are static illustrations, never 3D previews. */
function portrait(entry:BookEntry):string {
 const seed=[...entry.id].reduce((sum,char)=>sum+char.charCodeAt(0),0),infected=entry.category==='infected';
 const coat=infected?['#68654b','#5b6462','#6a4b42'][seed%3]:['#66715b','#8a6c47','#6b7170'][seed%3];
 const skin=infected?'#8e9270':'#bb9470',shadow=infected?'#646747':'#8b6950';
 const heavy=/brute|tank|jugger|armored/.test(entry.id),crawl=/crawler/.test(entry.id),spread=heavy?7:0;
 return `<svg class="field-portrait" viewBox="0 0 180 168" aria-hidden="true"><path d="M14 144h152M27 154h126M90 7v8M17 80h8m130 0h8" stroke="#74654b" opacity=".3"/><ellipse cx="91" cy="145" rx="47" ry="8" fill="#403d32" opacity=".15"/><g transform="translate(${crawl?18:0} ${crawl?35:0}) rotate(${crawl?-16:0} 90 80)"><path d="M${67-spread} 64h${47+spread*2}v58H${67-spread}z" fill="${coat}"/><path d="M${67-spread} 64l-12 8-8 48 13 4 13-45m${41+spread} -15 12 8 9 47-12 5-13-46" fill="${coat}"/><path d="M69 119h18v28H64zm24 0h18l9 28H98z" fill="#41453d"/><path d="M64 143h23v9H59v-5m39-4h22l5 9H98z" fill="#2d322e"/><path d="M48 111h12v18H47zm75-1h12v19h-12z" fill="${skin}"/><path d="M75 28h29v32H75z" fill="${skin}"/><path d="M99 28h9v30h-9zM80 59h18v11H80z" fill="${shadow}"/><path d="M72 25h33v9H72zm0 8h6v12h-6z" fill="${infected?'#444c3c':'#44493e'}"/><path d="M79 43h6v5h-6zm14 0h7v5h-7z" fill="#2e332a"/><path d="M${infected?78:84} 52h${infected?18:9}v4h-${infected?18:9}z" fill="${infected?'#783f33':'#765745'}"/><path d="M89 70v43M68 80h17m10 0h16M69 115h39" stroke="#c2b091" stroke-width="2" opacity=".6"/><path d="M72 87h12v14H72zm24 0h11v14H96z" fill="#333b32" opacity=".45"/>${infected?'<path d="M99 63h9v12h-9zm-22 41h10v13H77zM97 32h4v15h-4z" fill="#864537"/>':'<path d="M69 25h42v6H69zM73 17h29v10H73z" fill="#666f58"/><path d="M74 67l31 45" stroke="#443e32" stroke-width="7"/><path d="M101 105h15v19h-15z" fill="#8c724e"/>'}</g><path d="m129 31 18-7m-15 99 17 7" stroke="#8c5d40" opacity=".55"/></svg>`;
}
function artwork(entry:BookEntry):HTMLElement {
 const frame=node('div','field-specimen');
 if(entry.icon){const img=node('img');img.src=entry.icon;img.alt='';img.draggable=false;frame.append(img);}
 else if(entry.category==='infected'||entry.category==='npcs')frame.innerHTML=portrait(entry);
 else {
  const id=entry.id.replace(/^(weapon|melee|structure|gear|item)-/,'');
  const recipe=RECIPES.find(r=>r.id===id||r.weapon===id||r.melee===id||r.construction===id);
  if(recipe)frame.innerHTML=recipeArt(recipe);
  else if(id==='coins')frame.innerHTML='<svg class="field-portrait" viewBox="0 0 180 168" aria-hidden="true"><g fill="#af8d4c" stroke="#6d5b36" stroke-width="3"><path d="m40 93 12-12h64l12 12v28l-12 12H52l-12-12z"/><path d="m57 55 12-12h64l12 12v28l-12 12H69L57 83z"/></g><g fill="none" stroke="#e0c284" stroke-width="3"><path d="M43 105h82M43 116h82M61 68h80M61 79h80m-64-22 23-9 22 9-23 10z"/></g></svg>';
  else {const marks:Record<string,Icon>={fists:'hand',hide:'hide',cloth:'cloth',rare:'rare'};frame.innerHTML=icon(marks[id]??(entry.category==='weapons'?'gun':'bag'));}
 }
 return frame;
}
const searchIndex=new Map(BOOK_ENTRIES.map(entry=>[entry.id,normalize([entry.title,entry.kicker,entry.summary,...entry.tags,...entry.facts.map(f=>`${f.label} ${f.value}`)].join(' '))]));
const categoryName=(category:BookCategory)=>BOOK_CATEGORIES.find(item=>item.id===category)!.label;
const discoveryHints:Record<BookCategory,string>={
 items:'Explore, recolha materiais e construa. Cada nova descoberta preenche uma ficha deste arquivo.',
 infected:'Observe os infectados que encontrar em Santa Luz. Sobreviva ao encontro para continuar sua jornada.',
 food:'Encontre alimentos e bebidas durante suas expedições. Os suprimentos que você conseguir serão registrados aqui.',
 weapons:'Consiga novas armas e ferramentas para conhecer seus detalhes. Explore, fabrique ou negocie.',
 npcs:'Procure sobreviventes pela cidade e aproxime-se deles. Depois do encontro, seu contato ficará registrado no livro e no mapa.',
};
/** Unknown records only use category silhouettes: hidden titles and art never enter the DOM. */
function unknownArtwork(category:BookCategory):HTMLElement {
 const shape:Record<BookCategory,string>={
  items:'M46 53h88v70H46zM56 43h68v10H56zM63 65h12v46H63zm42 0h12v46h-12z',
  infected:'M76 23h29v29H76zM66 57h49v58H66zM54 60h12v61H48zM115 60h12l8 59h-13zM70 112h17v37H66zm25 0h16l9 37h-19z',
  food:'M62 40h57v92H62zM69 31h43v9H69zM68 132h46v6H68z',
  weapons:'M30 46h113v21H89v12H72l-8 51H38l9-60H30zM143 51h10v12h-10z',
  npcs:'M70 23h39v8h9v8H61v-8h9zM75 39h28v24H75zM61 69h57v45H61zM48 73h13v49H45zm70 0h13l6 49h-16zM68 114h20v35H64zm27 0h20l8 35h-23z',
 };
 const frame=node('div','field-specimen field-specimen-unknown');frame.setAttribute('aria-hidden','true');
 frame.innerHTML=`<svg viewBox="0 0 180 168" class="field-unknown-silhouette"><path d="${shape[category]}" fill="#090a08"/></svg>`;
 frame.append(node('span','field-unknown-question','?'));return frame;
}

export class FieldBooks {
 onClose:()=>void=()=>{};
 onTurn:()=>void=()=>{};
 kind:BookKind='guide';
 private panel:HTMLElement;
 private index:HTMLElement;
 private page:HTMLElement;
 private search:HTMLInputElement;
 private categories:HTMLElement;
 private previous:HTMLButtonElement;
 private next:HTMLButtonElement;
 private selections:Record<BookKind,string>={guide:GUIDE_CHAPTERS[0]?.id??'',encyclopedia:BOOK_ENTRIES[0]?.id??''};
 private category:BookCategory|'all'='all';
 private query='';
 private turnTimer?:number;
 private savedFocus:HTMLElement|null=null;
 private worldPaused=false;
 private discoveries=new Set<string>();
 get opened(){return !this.panel.hidden;}
 constructor(private readonly root:HTMLElement){
  this.panel=node('section');this.panel.id='field-books';this.panel.hidden=true;
  this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-modal','true');this.panel.setAttribute('aria-labelledby','field-book-title');
  this.panel.innerHTML=`<div class="field-book-workspace"><header class="field-book-toolbar"><div class="field-book-library"><span class="field-library-label">LAST NIGHT <i>/</i> BIBLIOTECA DE CAMPO</span><div class="field-book-switch"><button data-book-kind="guide"><kbd>K</kbd> Guia do sobrevivente</button><button data-book-kind="encyclopedia"><kbd>L</kbd> Enciclopédia</button></div></div><button id="field-book-close" aria-label="Fechar livro">${icon('close')}<span>Fechar <kbd>Esc</kbd></span></button></header>
   <div class="field-book-binding"><div class="field-book-thread" aria-hidden="true"></div><div class="field-book-spread">
    <aside class="field-book-leaf field-book-left"><div class="field-page-running"><span>EDIÇÃO DE SOBREVIVÊNCIA</span><b>SANTA LUZ</b></div><div class="field-book-title-block"><span id="field-book-volume"></span><h2 id="field-book-title"></h2><p id="field-book-subtitle"></p></div><div class="field-book-city" aria-hidden="true">${cityArt}</div><label class="field-book-search-label" for="field-book-search">${icon('search')}<input id="field-book-search" type="search" maxlength="80" placeholder="Nome, material ou característica…" autocomplete="off" spellcheck="false" aria-label="Pesquisar na enciclopédia"></label><div id="field-book-categories" aria-label="Categorias da enciclopédia"></div><button id="field-book-index-toggle" aria-expanded="false">Consultar índice <span>+</span></button><div class="field-book-index-heading"><span id="field-book-index-label">ÍNDICE</span><span id="field-book-index-count"></span></div><nav id="field-book-index" aria-label="Índice do livro"></nav><div class="field-book-left-note"><span>Se encontrou estas páginas,<br>ainda há uma história para escrever.</span><b>— Um sobrevivente</b></div><footer class="field-page-footer"><span>ARQUIVO DE CAMPO</span><span>LAST NIGHT</span></footer></aside>
    <article class="field-book-leaf field-book-right"><div class="field-page-running"><span id="field-book-running-title"></span><b id="field-book-entry-number"></b></div><div id="field-book-page" tabindex="-1"></div><footer class="field-page-footer"><span>CONHECIMENTO É SOBREVIVÊNCIA</span><span id="field-book-page-number"></span></footer><i class="field-page-corner" aria-hidden="true"></i></article>
   </div><div class="field-book-ribbon" aria-hidden="true"></div></div>
   <footer class="field-book-controls"><span class="field-book-world-note"><i></i> A cidade continua. Leia em segurança.</span><div class="field-book-pager"><button id="field-book-prev" aria-label="Página anterior">${chevron(true)}<span>Anterior</span></button><span id="field-book-page-status" role="status" aria-live="polite"></span><button id="field-book-next" aria-label="Próxima página"><span>Próxima</span>${chevron()}</button></div><span class="field-book-key-hint"><kbd>←</kbd><kbd>→</kbd> virar página</span></footer>
  </div>`;
  const progress=node('section','field-discovery-progress');progress.id='field-book-discoveries';
  progress.innerHTML='<div><span>SEU ARQUIVO DE CAMPO</span><strong id="field-book-discovery-count"></strong></div><progress id="field-book-discovery-meter" aria-label="Registros descobertos"></progress>';
  this.panel.querySelector('.field-book-title-block')!.after(progress);
  root.append(this.panel);
  this.index=this.el('field-book-index');this.page=this.el('field-book-page');this.search=this.el('field-book-search') as HTMLInputElement;this.categories=this.el('field-book-categories');
  this.previous=this.el('field-book-prev') as HTMLButtonElement;this.next=this.el('field-book-next') as HTMLButtonElement;
  this.el('field-book-close').addEventListener('click',()=>this.requestClose());
  this.previous.addEventListener('click',()=>this.turn(-1));this.next.addEventListener('click',()=>this.turn(1));
  this.panel.querySelectorAll<HTMLButtonElement>('[data-book-kind]').forEach(button=>button.addEventListener('click',()=>this.show(button.dataset.bookKind as BookKind)));
  for(const category of [{id:'all',label:'Tudo'},...BOOK_CATEGORIES]){
   const button=node('button','',category.label);button.dataset.bookCategory=category.id;button.addEventListener('click',()=>{this.category=category.id as BookCategory|'all';this.render();});this.categories.append(button);
  }
  this.search.addEventListener('input',()=>{this.query=normalize(this.search.value).trim();this.selections.encyclopedia='';this.render();});
  this.el('field-book-index-toggle').addEventListener('click',()=>{const expanded=this.panel.classList.toggle('index-expanded');this.el('field-book-index-toggle').setAttribute('aria-expanded',String(expanded));});
  this.panel.addEventListener('keydown',event=>this.keydown(event));
  // Inputs are handled outside the simulation, including key release and mouse buttons.
  this.panel.addEventListener('keyup',event=>event.stopPropagation());
  this.panel.addEventListener('pointerdown',event=>event.stopPropagation());
  this.panel.addEventListener('contextmenu',event=>event.preventDefault());
 }
 private el(id:string){return this.panel.querySelector<HTMLElement>(`#${id}`)!;}
 private text(id:string,value:string){this.el(id).textContent=value;}
 setDiscoveries(ids:ReadonlySet<string>){
  const next=new Set(BOOK_ENTRIES.filter(entry=>ids.has(entry.id)).map(entry=>entry.id));
  if(next.size===this.discoveries.size&&[...next].every(id=>this.discoveries.has(id)))return;
  this.discoveries=next;
  if(!this.opened||this.kind!=='encyclopedia')return;
  const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const focusedEntry=focused?.closest<HTMLButtonElement>('[data-book-entry]')?.dataset.bookEntry;
  const pageScroll=this.page.scrollTop,indexScroll=this.index.scrollTop;
  this.render();
  if(focusedEntry){
   const replacement=[...this.index.querySelectorAll<HTMLButtonElement>('[data-book-entry]')].find(button=>button.dataset.bookEntry===focusedEntry);
   (replacement??this.search).focus({preventScroll:true});
  }else if(focused&&!focused.isConnected)this.page.focus({preventScroll:true});
  this.page.scrollTop=pageScroll;this.index.scrollTop=indexScroll;
 }
 private entries():Array<BookEntry|GuideChapter>{
  if(this.kind==='guide')return GUIDE_CHAPTERS;
  const terms=this.query.split(/\s+/).filter(Boolean);
  const entries=BOOK_ENTRIES.filter(entry=>(this.category==='all'||entry.category===this.category)&&(!terms.length||this.discoveries.has(entry.id)&&terms.every(term=>searchIndex.get(entry.id)!.includes(term))));
  if(terms.length){
   const rank=(entry:BookEntry)=>{const title=normalize(entry.title);return title===this.query?3:title.startsWith(this.query)?2:terms.every(term=>title.includes(term))?1:0;};
   entries.sort((a,b)=>rank(b)-rank(a));
  }
  return entries;
 }
 show(kind:BookKind,worldPaused=this.worldPaused){
  const wasOpen=this.opened;if(!wasOpen)this.savedFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  this.worldPaused=worldPaused;this.root.classList.add('field-books-open');
  this.panel.querySelector('.field-book-world-note')!.innerHTML=`<i></i> ${worldPaused?'Pausa mantida. Consulte seu livro.':'A cidade continua. Leia em segurança.'}`;
  this.kind=kind;this.panel.hidden=false;this.panel.classList.remove('index-expanded');this.el('field-book-index-toggle').setAttribute('aria-expanded','false');
  this.render();if(!wasOpen)this.el('field-book-close').focus({preventScroll:true});
 }
 toggle(kind:BookKind){if(this.opened&&this.kind===kind)this.close();else this.show(kind);}
 close(){
  this.root.classList.remove('field-books-open');
  if(!this.opened)return;this.panel.hidden=true;clearTimeout(this.turnTimer);this.panel.classList.remove('turn-forward','turn-back');
  if(this.panel.contains(document.activeElement)){(document.activeElement as HTMLElement).blur();if(this.savedFocus?.isConnected)this.savedFocus.focus({preventScroll:true});}
 }
 reset(){this.close();this.discoveries.clear();this.selections={guide:GUIDE_CHAPTERS[0]?.id??'',encyclopedia:BOOK_ENTRIES[0]?.id??''};this.category='all';this.query='';this.search.value='';}
 private requestClose(){this.close();this.onClose();}
 private turn(direction:number){
  const entries=this.entries(),position=entries.findIndex(entry=>entry.id===this.selections[this.kind]),next=position+direction;
  if(next<0||next>=entries.length)return;this.select(entries[next].id,direction);
 }
 private select(id:string,direction=1){
  if(this.selections[this.kind]===id)return;
  const indexFocused=this.index.contains(document.activeElement);
  this.selections[this.kind]=id;this.render();this.panel.classList.remove('index-expanded');this.el('field-book-index-toggle').setAttribute('aria-expanded','false');
  if(indexFocused){const current=this.index.querySelector<HTMLButtonElement>('[aria-current="true"]')!;if(current.getClientRects().length)current.focus({preventScroll:true});else this.el('field-book-index-toggle').focus({preventScroll:true});}
  this.panel.classList.remove('turn-forward','turn-back');void this.page.offsetWidth;this.panel.classList.add(direction<0?'turn-back':'turn-forward');
  clearTimeout(this.turnTimer);this.turnTimer=window.setTimeout(()=>this.panel.classList.remove('turn-forward','turn-back'),340);this.onTurn();
 }
 private render(){
  const guide=this.kind==='guide',entries=this.entries();let position=entries.findIndex(entry=>entry.id===this.selections[this.kind]);
  if(position<0&&entries.length){position=0;this.selections[this.kind]=entries[0].id;}
  this.panel.dataset.kind=this.kind;this.panel.dataset.page=String(Math.max(0,position));
  this.text('field-book-volume',guide?'VOLUME I · MANUAL DE CAMPO':'VOLUME II · ARQUIVO DE SANTA LUZ');
  this.text('field-book-title',guide?'Guia do\nsobrevivente':'Enciclopédia');
  this.text('field-book-subtitle',guide?'Encontre o que resta. Proteja seu lugar no mundo.':'O que você encontra ganha um lugar nestas páginas.');
  this.text('field-book-index-label',guide?'ROTEIRO DE SOBREVIVÊNCIA':'ÍNDICE DE DESCOBERTAS');
  this.text('field-book-index-count',guide?`${entries.length} capítulos`:`${entries.filter(entry=>this.discoveries.has(entry.id)).length} / ${entries.length} descobertos`);
  this.el('field-book-discoveries').hidden=guide;
  this.text('field-book-discovery-count',`${number(this.discoveries.size)} / ${number(BOOK_ENTRIES.length)}`);
  const meter=this.el('field-book-discovery-meter') as HTMLProgressElement;meter.max=BOOK_ENTRIES.length;meter.value=this.discoveries.size;
  meter.setAttribute('aria-valuetext',`${this.discoveries.size} de ${BOOK_ENTRIES.length} registros descobertos`);
  this.text('field-book-running-title',guide?'GUIA DO SOBREVIVENTE':'ENCICLOPÉDIA / SANTA LUZ');
  this.panel.querySelectorAll<HTMLButtonElement>('[data-book-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.bookKind===this.kind)));
  this.categories.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.bookCategory===this.category)));
  this.index.replaceChildren();
  entries.forEach((entry,i)=>{
   const discovered=guide||this.discoveries.has(entry.id);
   const button=node('button','field-book-index-entry');button.dataset.bookEntry=entry.id;button.dataset.discovered=String(discovered);button.setAttribute('aria-current',String(i===position));
   if(!discovered)button.setAttribute('aria-label',`Registro não descoberto, página ${i+2}`);
   button.append(node('span','field-index-number',number(i+1)),node('span','field-index-name',discovered?entry.title:'???'),node('span','field-index-dots'),node('span','field-index-page',number(i+2)));
   button.addEventListener('click',()=>this.select(entry.id,i<position?-1:1));this.index.append(button);
  });
  this.page.replaceChildren();const entry=entries[position];
  this.page.dataset.discovered=String(!!entry&&(guide||this.discoveries.has(entry.id)));
  if(entry){
   this.text('field-book-entry-number',`${guide?'CAPÍTULO':'FICHA'} ${number(position+1)}`);
   if(!guide&&!this.discoveries.has(entry.id))this.renderUnknown(entry as BookEntry);
   else{
   const title=node('h3','field-entry-title',entry.title);title.id='field-book-entry-title';
   this.page.append(node('span','field-entry-kicker',entry.kicker),title,node('p','field-entry-summary',entry.summary));
   if(!guide){
    const record=entry as BookEntry,specimen=node('figure','field-entry-figure');specimen.append(artwork(record));
    const caption=node('figcaption');caption.append(node('span','',record.category==='infected'?'OBSERVAÇÃO DE CAMPO':record.category==='npcs'?'CONTATO LOCAL':'CATÁLOGO DE CAMPO'),node('span','',`SL / ${number(BOOK_ENTRIES.indexOf(record)+1)}`));specimen.append(caption);this.page.append(specimen);
    const achievement=node('div','field-entry-achievement');
    achievement.innerHTML='<svg viewBox="0 0 30 36" aria-hidden="true"><path d="m7 19-3 14 9-4 4 6 3-16" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m15 2 4 2 5 1 1 5 2 4-3 4-1 5-5 1-3 2-4-3-5-1-1-5-2-3 3-5 1-4 5-1z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10 13 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    achievement.append(node('span','','Conquista • registro descoberto'));this.page.append(achievement);
    if(record.facts.length){const facts=node('dl','field-entry-facts');for(const fact of record.facts)facts.append(node('dt','',fact.label),node('dd','',fact.value));this.page.append(facts);}
   }
   const prose=node('div','field-entry-prose');entry.paragraphs.forEach(paragraph=>prose.append(node('p','',paragraph)));this.page.append(prose);
   if(guide){
    const chapter=entry as GuideChapter;if(chapter.checklist.length){const checklist=node('section','field-entry-checklist');checklist.append(node('h4','','LEMBRETES DE CAMPO'));const list=node('ul');chapter.checklist.forEach(item=>list.append(node('li','',item)));checklist.append(list);this.page.append(checklist);}
    this.page.append(node('p','field-entry-signature','Sobreviva hoje. Prepare o amanhã.'));
   }
   }
  }else{
   this.text('field-book-entry-number','SEM REGISTROS');const empty=node('div','field-book-empty');empty.append(node('span','field-empty-mark','?'),node('h3','','Nenhum registro encontrado'),node('p','','A busca consulta apenas suas descobertas. Explore Santa Luz ou consulte outra categoria.'));
   const reset=node('button','','Limpar busca e filtros');reset.addEventListener('click',()=>{this.query='';this.category='all';this.search.value='';this.render();this.search.focus();});empty.append(reset);this.page.append(empty);
  }
  this.page.scrollTop=0;this.text('field-book-page-number',entry?number(position+2):'—');
  this.text('field-book-page-status',entries.length?`${number(position+1)} / ${number(entries.length)}`:'00 / 00');
  this.previous.disabled=position<=0;this.next.disabled=position<0||position>=entries.length-1;
  this.index.querySelector('[aria-current="true"]')?.scrollIntoView({block:'nearest'});
 }
 private renderUnknown(entry:BookEntry){
  const title=node('h3','field-entry-title field-entry-title-unknown','???');title.id='field-book-entry-title';
  this.page.append(node('span','field-entry-kicker',`${categoryName(entry.category)} · Registro não descoberto`),title,node('p','field-entry-summary','Estas páginas ainda guardam um mistério.'));
  const figure=node('figure','field-entry-figure field-entry-figure-unknown');figure.append(unknownArtwork(entry.category));
  const caption=node('figcaption');caption.append(node('span','','AGUARDANDO DESCOBERTA'),node('span','',`SL / ${number(BOOK_ENTRIES.indexOf(entry)+1)}`));figure.append(caption);this.page.append(figure);
  const note=node('div','field-entry-unknown-note');note.append(node('h4','','ENCONTRE PARA REVELAR'),node('p','',discoveryHints[entry.category]),node('small','','Ao descobrir, você recebe uma conquista e revela este registro.'));
  this.page.append(note);
 }
 private keydown(event:KeyboardEvent){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.requestClose();return;}
  if(event.key==='Tab'){
   event.stopPropagation();const focusable=[...this.panel.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length>0);
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}else if(!this.panel.contains(document.activeElement)){event.preventDefault();first?.focus();}return;
  }
  if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement){event.stopPropagation();return;}
  if(['k','l','o'].includes(event.key.toLowerCase()))return;
  event.stopPropagation();
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();this.turn(event.key==='ArrowRight'?1:-1);}
  else if(event.key==='/'&&this.kind==='encyclopedia'){event.preventDefault();this.search.focus();}
 }
}
