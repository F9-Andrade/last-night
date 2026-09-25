import type {CoopSession} from '../network/coop-session';
import {COOP} from '../network/gameplay-protocol';
export class CoopGameplayHUD {
 private group=document.createElement('div');private prompt=document.createElement('div');private timer=0;
 constructor(root:HTMLElement){this.group.id='coop-health';this.prompt.id='coop-revive';this.group.hidden=true;this.prompt.hidden=true;root.append(this.group,this.prompt);}
 update(session?:CoopSession){
  this.group.hidden=!session;if(!session){this.prompt.hidden=true;return;}
  const now=performance.now();if(now-this.timer<100)return;this.timer=now;
  const rows=session.network.players.map(p=>{const state=session.checkpoint?.players.find(a=>a.actor===p.actorNumber);return `${p.displayName} · ${state?.life==='downed'?`CAÍDO ${Math.ceil(state.bleed)}s`:state?.life==='dead'?'MORTO':`${Math.ceil(state?.player.hp??100)} HP`}`;});
  if(import.meta.env.DEV&&import.meta.env.VITE_NETWORK_DEBUG==='true'){const d=session.debug();rows.push(`${d.infected} infectados · ${d.entities} entidades · rev ${d.revision} · ${d.hash} · ${Math.round(d.snapshotAge??0)}ms`);}
  this.group.textContent=rows.join('\n');const target=session.reviveTarget(),local=session.localRecord;let text='';
  if(session.error)text=session.error;else if(!session.ready)text='Recebendo estado da cidade…';else if(local?.life==='downed')text=`Você caiu · aguarde ajuda · ${Math.ceil(local.bleed)}s`;else if(local?.life==='dead')text='Você morreu · acompanhe o grupo até o fim da expedição.';else if(target){const name=session.network.players.find(p=>p.actorNumber===target.actor)?.displayName??'companheiro';text=local?.reviveTarget?`Revivendo ${name} · ${Math.min(100,Math.round(local.reviveProgress/COOP.reviveTime*100))}%`:`SEGURE E — REVIVER ${name}`;}
  this.prompt.textContent=text;this.prompt.hidden=!text||!!session.checkpoint?.wipe;
 }
}
