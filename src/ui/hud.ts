import { REGIONS } from '../game/districts';
import type { Simulation } from '../game/simulation';
import { BALANCE } from '../game/config';
import { ITEMS, itemKeys } from '../game/inventory';
import type { Item,Stock } from '../game/inventory';
import { BASE } from '../game/world';
import { icon } from './icons';
import { layout } from './layout';
import { VarietyHUD } from './variety';
import { RARITIES } from '../game/weapons';
import { FieldMap,regionIcons } from './map';
const clock=(seconds:number):string=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const natural=(text:string):string=>text.charAt(0).toUpperCase()+text.slice(1).toLocaleLowerCase('pt-BR');
export class HUD {
  inventoryOpen=false; mapOpen=false; settingsOpen=false; captions=true; mutations=0; updates=0;
  root:HTMLDivElement;canvas:HTMLCanvasElement; variety:VarietyHUD;
  private els=new Map<string,HTMLElement>();private htmlCache=new Map<string,string>();private styleCache=new Map<string,string>();
  private noticeTimer=0;private hitTimer=0;private hurtTimer=0;private tick=0;private mapTick=0;private phase='';private objectiveTime=0;private tutorialTime=0;
  private previous?:Stock;private previousAmmo=12;private lootNotices:{item:Item;amount:number;until:number}[]=[];private age=0;private fieldMap=new FieldMap();
  private closeTimer?:ReturnType<typeof setTimeout>;private seen=new Set<string>();
  constructor(){this.root=document.querySelector('#app')!;this.root.innerHTML=layout();this.canvas=this.root.querySelector('#game')!;this.variety=new VarietyHUD(this.root);
    for(const k of itemKeys)this.el(`select-${k}`).onclick=()=>this.selectItem(k);
    this.el('map-legend').innerHTML=[0,1,2,3,4,5,12,18,19].map(i=>`<p>${icon(regionIcons[i])}<span>${natural(REGIONS[i].name)}</span></p>`).join('');
  }
  el(id:string):HTMLElement {let el=this.els.get(id);if(!el){el=document.getElementById(id)!;if(!el)throw new Error(`Missing HUD element: ${id}`);this.els.set(id,el);}return el;}
  text(id:string,value:string):void {const el=this.el(id);if(el.textContent!==value){el.textContent=value;this.mutations++;}}
  html(id:string,value:string):void {if(this.htmlCache.get(id)!==value){this.el(id).innerHTML=value;this.htmlCache.set(id,value);this.mutations++;}}
  private style(id:string,property:string,value:string):void {const key=id+property;if(this.styleCache.get(key)!==value){this.el(id).style.setProperty(property,value);this.styleCache.set(key,value);this.mutations++;}}
  selectItem(k:Item):void {for(const item of itemKeys){const selected=k===item;this.el(`detail-${item}`).hidden=!selected;this.el(`select-${item}`).classList.toggle('selected',selected);this.el(`select-${item}`).setAttribute('aria-pressed',String(selected));}this.el(`select-${k}`).dispatchEvent(new CustomEvent('item-select',{bubbles:true}));}
  reset():void {this.variety.reset();this.previous=undefined;this.phase='';this.age=0;this.lootNotices=[];this.tutorialTime=0;this.fieldMap.reset();this.seen.clear();this.inventory(false);this.map(false);this.el('loot-feed').innerHTML='';this.htmlCache.delete('loot-feed');}
  showMenu(show:boolean):void {this.el('menu').hidden=!show;this.root.classList.toggle('playing',!show);if(show){this.inventory(false);this.map(false);this.noticeTimer=0;}}
  paused(value:boolean):void {this.el('pause-screen').hidden=!value;this.root.classList.toggle('paused',value);}
  inventory(show:boolean):void {clearTimeout(this.closeTimer);this.inventoryOpen=show;this.root.classList.toggle('inventory-open',show);this.el('inventory-panel').classList.toggle('closing',!show);if(show){this.map(false);this.el('inventory-panel').hidden=false;}else this.closeTimer=setTimeout(()=>{if(!this.inventoryOpen)this.el('inventory-panel').hidden=true;},100);}
  map(show:boolean):void {this.mapOpen=show;if(show)this.inventory(false);this.el('map-screen').hidden=!show;this.root.classList.toggle('map-open',show);this.mapTick=.5;}
  notice(title:string,sub:string):void {
    // Item receipts live beside the resource HUD, not in the middle of combat.
    if(/\+\d/.test(title)||/MOCHILA CHEIA/.test(title)){if(/CHEIA/.test(title)){this.html('tutorial',`${icon('bag')} Mochila cheia. <kbd>Tab</kbd> Organizar`);this.tutorialTime=4;}return;}
    this.text('notice-title',natural(title).replace(/walkers/gi,'errantes'));this.text('notice-sub',sub.replace(/Walkers/g,'errantes').replace(/TAB/g,'Tab'));this.noticeTimer=/NOITE|AMANHECER|SOBREVIVEU/.test(title)?4:2.4;
  }
  hit(head=false):void {this.hitTimer=head?.24:.14;this.el('crosshair').classList.toggle('headshot',head);}
  hurt():void{this.hurtTimer=.45;this.el('health').animate([{transform:'translateX(-3px)'},{transform:'translateX(0)'}],{duration:180});}
  end(sim:Simulation):void {this.tick=.1;this.el('game-over').hidden=false;this.root.classList.add('paused');this.text('end-title',sim.baseHP<=0?'O ABRIGO CAIU':'Sua última noite.');this.text('end-reason',sim.baseHP<=0?'Sem um lugar para voltar, a expedição termina aqui.':'A cidade fica para trás. Você pode tentar de novo.');this.text('end-days',String(sim.day).padStart(2,'0'));this.text('end-kills',String(sim.kills).padStart(2,'0'));this.text('end-time',clock(sim.stats.seconds));this.html('end-details',`<span>${sim.stats.headshots} tiros na cabeça</span><span>${sim.stats.loot} itens coletados</span><span>${sim.stats.nights} noites sobrevividas</span><span>${Math.round(sim.stats.damage)} de dano sofrido</span><span>${sim.stats.specials} especiais eliminados</span><span>${sim.stats.weapons} armas encontradas · ${RARITIES[sim.stats.bestRarity].name}</span><span>${sim.stats.repairs} reparos de barricada</span>`);}
  update(sim:Simulation,dt:number,mouse:{x:number;y:number},project?:(x:number,z:number,y?:number)=>{x:number;y:number},aimTarget=false):void {
    this.age+=dt;this.noticeTimer-=dt;this.hitTimer-=dt;this.hurtTimer-=dt;this.objectiveTime-=dt;this.tutorialTime-=dt;
    this.el('notice').classList.toggle('visible',this.noticeTimer>0&&this.root.classList.contains('playing'));
    this.style('crosshair','transform',`translate(${Math.round(mouse.x)}px,${Math.round(mouse.y)}px)`);this.style('crosshair','--bloom',`${(sim.recoil*5+(sim.player.moving?2:0)+(sim.player.running?3:0)).toFixed(1)}px`);
    this.el('crosshair').classList.toggle('hit',this.hitTimer>0);this.el('crosshair').classList.toggle('on-target',aimTarget);this.style('damage-vignette','opacity',String(Math.max(0,this.hurtTimer).toFixed(2)));
    this.tick+=dt;this.mapTick+=dt;if(this.tick<.1&&this.updates)return;this.tick=0;this.updates++;this.variety.update(sim);
    this.text('health',String(Math.ceil(sim.player.hp)));this.style('health-bar','width',`${(sim.player.hp/sim.maxHP*100).toFixed(0)}%`);this.text('health-state',sim.player.hp<30?'Precisa de cuidados':sim.player.hp<70?'Ferido':'Sem ferimentos');this.root.classList.toggle('low-health',sim.player.hp<30);
    this.style('stamina-bar','width',`${sim.player.stamina.toFixed(0)}%`);this.el('stamina').classList.toggle('relevant',sim.player.running||sim.player.stamina<96);
    this.el('stamina').classList.toggle('exhausted',sim.player.exhausted);this.text('stamina-label',sim.player.exhausted?'Exausto':'Fôlego');
    this.style('base-bar','width',`${(sim.baseHP/BALANCE.base.hp*100).toFixed(1)}%`);this.text('base-hp',String(Math.ceil(sim.baseHP)));this.root.classList.toggle('base-hurt',sim.baseHP<BALANCE.base.hp*.4);
    this.text('ammo',String(sim.ammo).padStart(2,'0'));this.text('reserve',String(sim.reserve));this.el('ammo').classList.toggle('low-ammo',sim.ammo<=3);this.root.classList.toggle('reloading',sim.reloadTimer>0);
    if(sim.ammo!==this.previousAmmo){this.el('ammo').animate([{opacity:.45,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:140});this.previousAmmo=sim.ammo;}
    Array.from(this.el('cartridges').children).forEach((c,i)=>c.classList.toggle('spent',i>=sim.ammo));
    this.style('reload-bar','width',sim.reloadTimer?`${((1-sim.reloadTimer/sim.reloadDuration)*100).toFixed(0)}%`:'0%');this.html('reload-label',sim.switchTimer?'TROCANDO…':sim.reloadTimer?(sim.weapon.reloadStyle==='shell'?'CARREGANDO CARTUCHO…':'RECARREGANDO…'):sim.ammo?'<kbd>R</kbd> Recarregar':'<kbd>R</kbd> Pente vazio');
    const titles={day:'Luz do dia',dusk:'Anoitecer',preparation:'Preparação',night:'Horda noturna',dawn:'Amanhecer'};
    this.text('day',`DIA ${String(sim.day+(sim.phase==='dawn'?1:0)).padStart(2,'0')}`);this.text('phase',titles[sim.phase].toUpperCase());this.html('phase-icon',icon(sim.phase==='night'?'night':'sun'));
    const seconds=Math.max(0,Math.ceil(sim.phase==='dawn'?sim.cycle.durations.dawn-sim.cycle.elapsed:sim.untilNight));this.text('timer-label',sim.phase==='night'?'Resista':sim.phase==='dawn'?'Novo dia em':'Anoitecer em');this.text('timer',sim.phase==='night'?'':clock(seconds));
    this.el('cycle').classList.toggle('is-night',sim.phase==='night');this.el('cycle').classList.toggle('urgent',sim.phase!=='night'&&sim.phase!=='dawn'&&seconds<=60);
    const progress=sim.phase==='night'?1-sim.threat/Math.max(1,sim.horde.budget+5):1-sim.untilNight/sim.cycle.daylight;this.style('cycle-line','stroke-dasharray',`${Math.max(0,progress)*100} 100`);
    if(this.phase!==`${sim.day}${sim.phase}`){this.phase=`${sim.day}${sim.phase}`;this.objectiveTime=12;}
    this.text('objective-title',sim.phase==='dawn'?'Você sobreviveu.':sim.phase==='night'?'Proteja seu abrigo':sim.phase==='day'?'Antes que escureça':'Hora de voltar');const returnDistance=Math.round(Math.hypot(sim.player.x-1,sim.player.z-3));this.text('objective-sub',returnDistance>55?`Abrigo a ${returnDistance} m · reserve ~${Math.ceil(returnDistance/4.6*1.3)} s para voltar.`:sim.phase==='dawn'?'A recompensa está no depósito.':sim.phase==='night'?'Cuide das três entradas.':sim.phase==='day'?'Encontre suprimentos na cidade.':'Prepare as defesas e a munição.');this.el('objective').classList.toggle('quiet',this.objectiveTime<=0);
    const loot=sim.nearbyLoot,defense=sim.nearbyDefense,action=sim.action;
    const names={portal:'FORÇANDO ENTRADA',board:'BARRICANDO ENTRADA',search:'Vasculhando',heal:'Aplicando bandagem',build:'Construindo',repair:'Reparando',dismantle:'Desmontando',base:'Reparando abrigo',facility:'Abrindo acesso',silence:'Desligando alarme',event:'Recolhendo reserva'};
    let prompt=action?`${names[action.kind].toUpperCase()}<span>${Math.round(action.elapsed/action.duration*100)}%</span><i class="action-track"><b style="width:${Math.round(action.elapsed/action.duration*100)}%"></b></i>`:loot?`<kbd>E</kbd><div>${(loot.searched?'RECOLHER RESTANTE':'VASCULHAR')}<small>${loot.label}</small></div>`:defense?defense.hp>=BALANCE.barricade.hp?`${icon('shelter')}<div>DEFESA INTACTA<small>300 HP · <kbd>X</kbd> DESMONTAR</small></div>`:defense.hp>0?`<kbd>E</kbd><div>SEGURE PARA REPARAR<small>${Math.ceil(defense.hp)} / 300 · 1 madeira + ${sim.repairScrap} sucata</small></div>`:`<kbd>E</kbd><div>CONSTRUIR BARRICADA<small>${sim.buildWood} madeira + ${BALANCE.barricade.scrap} sucata</small></div>`:sim.atBase&&Math.hypot(sim.player.x-BASE.x,sim.player.z-BASE.z)<2.7?`<kbd>${sim.baseHP<BALANCE.base.hp?'E':'Tab'}</kbd><div>${sim.baseHP<BALANCE.base.hp?'REPARAR ABRIGO':'DEPÓSITO DO ABRIGO'}<small>${sim.baseHP<BALANCE.base.hp?'4 sucata · +120 HP':'Guarde recursos para a próxima noite.'}</small></div>`:'';
    if(!action&&sim.nearbyPortal){const p=sim.nearbyPortal;prompt=`<kbd>E</kbd><div>${p.state==='open'?(p.kind==='window'?'JANELA QUEBRADA':'FECHAR PORTA'):p.kind==='window'?'QUEBRAR VIDRO':p.state==='barred'?'FORÇAR BARRICADA':'ABRIR PORTA'}<small>${p.state==='open'?'X · Barricar com 2 madeiras':p.state==='barred'?'Barulho alto · procure outra entrada':p.kind==='window'?'Vidro faz barulho. Abre uma rota de fuga.':'Entrada transitável após abrir.'}</small></div>`;}
    if(!action){if(sim.nearbyAlarm)prompt='<kbd>E</kbd><div>DESLIGAR ALARME<small>Leva 1,4 s. O ruído atrai infectados.</small></div>';else if(sim.nearbyPortal){}else if(sim.nearbyWeapon)prompt='';else if(sim.nearbyFacility)prompt=`<kbd>E</kbd><div>${sim.nearbyFacility.kind==='generator'?'ATIVAR GERADOR':'ABRIR RESERVA'}<small>${sim.nearbyFacility.name}</small></div>`;else if(sim.nearbyEvent)prompt='<kbd>E</kbd><div>RECOLHER SUPRIMENTOS<small>Reserva abandonada</small></div>';}
    if(this.inventoryOpen||this.mapOpen||sim.pendingPerks.length)prompt='';this.html('interaction',prompt);this.el('interaction').classList.toggle('visible',!!prompt);
    if(project&&prompt){const at=sim.nearbyPortal??sim.nearbyFacility??sim.nearbyEvent??loot??defense??sim.player;const p=project(at.x,at.z,1.4);this.style('interaction','left',`${Math.max(180,Math.min(innerWidth-180,p.x))}px`);this.style('interaction','top',`${Math.max(150,Math.min(innerHeight-200,p.y-60))}px`);}
    this.root.classList.toggle('at-base',sim.atBase);this.root.classList.toggle('night-active',sim.phase==='night');
    for(const k of ['wood','scrap','med'] as const)this.text(`resource-${k}`,String(sim.inventory.items[k]));
    this.el('threat').hidden=sim.phase!=='night';this.text('threat-label',sim.cycle.silence>0?'Silêncio.':'Pressão da horda');this.style('horde-bar','width',`${Math.min(100,sim.threat/Math.max(1,sim.horde.budget)*100)}%`);
    if(this.previous){for(const k of itemKeys){const amount=sim.inventory.items[k]-this.previous[k];if(amount&&(k!=='ammo'||amount>0||this.inventoryOpen)){const old=this.lootNotices.find(n=>n.item===k&&this.age<n.until);if(old){old.amount+=amount;old.until=this.age+3;}else this.lootNotices.push({item:k,amount,until:this.age+3});}}}this.previous={...sim.inventory.items};this.lootNotices=this.lootNotices.filter(n=>n.until>this.age&&n.amount).slice(-4);this.html('loot-feed',this.lootNotices.map(n=>`<div class="loot-receipt ${n.amount<0?'spent':''}">${icon(n.item)}<b>${n.amount>0?'+':''}${n.amount}</b><span>${ITEMS[n.item].label}</span></div>`).join(''));
    if(this.inventoryOpen){this.text('capacity-label',`${sim.inventory.weight.toFixed(1)} / ${sim.inventory.capacity} kg`);this.style('capacity-bar','width',`${sim.inventory.weight/sim.inventory.capacity*100}%`);this.el('inventory-panel').classList.toggle('full',sim.inventory.weight>sim.inventory.capacity*.9);this.text('inventory-context',sim.atBase?'Depósito ao alcance.':'Depósito disponível no abrigo.');for(const k of itemKeys){this.text(`item-${k}`,String(sim.inventory.items[k]));this.text(`stored-${k}`,`${sim.storage.items[k]} no depósito`);(this.el(`discard-${k}`) as HTMLButtonElement).disabled=!sim.inventory.items[k]||!!action;(this.el(`deposit-${k}`) as HTMLButtonElement).disabled=!sim.atBase||!sim.inventory.items[k]||!!action;(this.el(`withdraw-${k}`) as HTMLButtonElement).disabled=!sim.atBase||!sim.storage.items[k]||sim.inventory.weight+ITEMS[k].weight>sim.inventory.capacity||!!action;this.el(`select-${k}`).classList.toggle('empty',!sim.inventory.items[k]);}(this.el('use-med') as HTMLButtonElement).disabled=!sim.inventory.items.med||sim.player.hp>=sim.maxHP||!!action;(this.el('use-rare') as HTMLButtonElement).disabled=!sim.atBase||!sim.resource('rare')||sim.baseHP>=BALANCE.base.hp||!!action;}
    const hint=!this.seen.has('move')&&this.age<8?'<kbd>W A S D</kbd> Mova-se. O abrigo é seu ponto de retorno.':sim.player.hp<70&&sim.inventory.items.med&&!this.seen.has('heal')?'<kbd>H</kbd> Uma bandagem pode ajudar.':'';
    if(sim.player.moving&&this.age>3)this.seen.add('move');if(sim.action?.kind==='heal')this.seen.add('heal');if(this.tutorialTime<=0)this.html('tutorial',hint);
    const region=REGIONS.reduce((a,b)=>Math.hypot(a.x-sim.player.x,a.z-sim.player.z)<Math.hypot(b.x-sim.player.x,b.z-sim.player.z)?a:b);this.text('region-name',natural(region.name));
    if(this.mapTick>=.5){this.mapTick=0;this.fieldMap.draw(this.el('minimap') as HTMLCanvasElement,sim);if(this.mapOpen)this.fieldMap.draw(this.el('full-map') as HTMLCanvasElement,sim,true);}
    const offscreen=project&&sim.zombies.some(z=>{if(!z.active||Math.hypot(z.x-sim.player.x,z.z-sim.player.z)>5)return false;const p=project(z.x,z.z);return p.x<0||p.x>innerWidth||p.y<0||p.y>innerHeight;});this.el('danger-edge').hidden=!offscreen||!this.captions;
  }
}
