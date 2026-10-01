import type {CoopSession} from '../network/coop-session';
import {COOP} from '../network/gameplay-protocol';
import {sanitizeName} from '../network/protocol';
import './coop-hud.css';

interface PlayerHealthRow {
 element:HTMLDivElement;name:HTMLElement;hp:HTMLElement;track:HTMLDivElement;fill:HTMLElement;state:HTMLElement;
}
const text=(element:HTMLElement,value:string)=>{if(element.textContent!==value)element.textContent=value;};
const attribute=(element:HTMLElement,name:string,value:string)=>{if(element.getAttribute(name)!==value)element.setAttribute(name,value);};

export class CoopGameplayHUD {
 private group=document.createElement('div');
 private prompt=document.createElement('div');
 private debug=document.createElement('small');
 private rows=new Map<number,PlayerHealthRow>();
 private timer=-Infinity;
 constructor(root:HTMLElement){
  this.group.id='coop-health';this.group.setAttribute('role','list');this.group.setAttribute('aria-label','Sobreviventes');
  this.prompt.id='coop-revive';this.prompt.setAttribute('role','status');
  this.debug.className='coop-health-debug';this.debug.hidden=true;this.group.append(this.debug);
  this.group.hidden=true;this.prompt.hidden=true;root.append(this.group,this.prompt);
 }
 private createRow(actor:number){
  const element=document.createElement('div'),name=document.createElement('strong'),hp=document.createElement('span');
  const track=document.createElement('div'),fill=document.createElement('i'),state=document.createElement('small');
  element.className='coop-player-health';element.dataset.actor=String(actor);element.setAttribute('role','listitem');
  name.className='coop-player-name';hp.className='coop-player-hp';state.className='coop-player-state';state.hidden=true;
  track.className='coop-player-health-track';track.setAttribute('role','meter');track.setAttribute('aria-valuemin','0');
  fill.className='coop-player-health-fill';fill.setAttribute('aria-hidden','true');track.append(fill);element.append(name,hp,track,state);
  const row={element,name,hp,track,fill,state};this.rows.set(actor,row);return row;
 }
 update(session?:CoopSession){
  this.group.hidden=!session;
  if(!session){this.prompt.hidden=true;this.timer=-Infinity;for(const row of this.rows.values())row.element.remove();this.rows.clear();return;}
  const now=performance.now();if(now-this.timer<100)return;this.timer=now;
  const members=session.network.players,records=session.checkpoint?.players??[];
  const actors=new Set(members.map(p=>p.actorNumber));
  for(const [actor,row] of this.rows)if(!actors.has(actor)){row.element.remove();this.rows.delete(actor);}
  members.forEach((player,index)=>{
   const row=this.rows.get(player.actorNumber)??this.createRow(player.actorNumber);
   // Membership changes may move a row; ordinary state updates keep every node in place.
   if(this.group.children[index]!==row.element)this.group.insertBefore(row.element,this.group.children[index]??this.debug);
   const state=records.find(p=>p.actor===player.actorNumber),life=state?.life??'alive';
   const name=sanitizeName(player.displayName)||'Sobrevivente',maximum=state?.perks.includes('tough')?115:100;
   const hp=Math.max(0,Math.min(maximum,state?.player.hp??100)),fraction=String(hp/maximum);
   const rescuers=records.filter(p=>p.life==='alive'&&p.reviveTarget===player.actorNumber);
   const progress=Math.max(0,...rescuers.map(p=>p.reviveProgress));
   let status='';
   if(life==='dead')status='Morto';
   else if(life==='downed')status=progress>0?`Reanimando · ${Math.ceil(Math.max(0,COOP.reviveTime-progress))}s`:`Caído · ${Math.ceil(state?.bleed??0)}s`;
   else if(state?.reviveTarget)status=`Revivendo · ${Math.ceil(Math.max(0,COOP.reviveTime-state.reviveProgress))}s`;
   text(row.name,name);text(row.hp,`${Math.ceil(hp)} HP`);text(row.state,status);
   if(row.state.hidden!==!status)row.state.hidden=!status;
   attribute(row.element,'data-life',life);attribute(row.element,'data-local',String(player.isLocal));
   attribute(row.track,'aria-label',`Vida de ${name}`);attribute(row.track,'aria-valuemax',String(maximum));attribute(row.track,'aria-valuenow',String(hp));
   attribute(row.track,'aria-valuetext',`${Math.ceil(hp)} de ${maximum} HP${status?` · ${status}`:''}`);
   if(row.fill.style.getPropertyValue('--health')!==fraction)row.fill.style.setProperty('--health',fraction);
  });
  if(import.meta.env.DEV&&import.meta.env.VITE_NETWORK_DEBUG==='true'){
   const d=session.debug();this.debug.hidden=false;text(this.debug,`${d.infected} infectados · ${d.entities} entidades · rev ${d.revision} · ${d.hash} · ${Math.round(d.snapshotAge??0)}ms`);
  }
  const target=session.reviveTarget(),local=session.localRecord;let message='';
  if(session.error)message=session.error;
  else if(!session.ready)message='Recebendo estado da cidade…';
  else if(local?.life==='downed')message=`Você caiu · aguarde ajuda · ${Math.ceil(local.bleed)}s`;
  else if(local?.life==='dead')message='Você morreu · acompanhe o grupo até o fim da expedição.';
  else if(target){
   const name=sanitizeName(session.network.players.find(p=>p.actorNumber===target.actor)?.displayName)||'companheiro';
   message=local?.reviveTarget?`Revivendo ${name} · ${Math.min(100,Math.round(local.reviveProgress/COOP.reviveTime*100))}%`:`SEGURE E — REVIVER ${name}`;
  }
  text(this.prompt,message);this.prompt.hidden=!message||!!session.checkpoint?.wipe;
 }
}
