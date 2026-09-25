import type { NetworkManager } from '../network/manager';
import { normalizeCode, validName, sanitizeName } from '../network/protocol';
import './coop.css';

/** DOM presentation only: Photon and room transitions belong to NetworkManager. */
export class CoopUI {
 readonly panel=document.createElement('section');
 readonly team=document.createElement('aside');
 private opened=false;
 private unsubscribe:()=>void;
 private copyTimer?:ReturnType<typeof setTimeout>;
 constructor(private network:NetworkManager,root:HTMLElement,private cue:()=>void){
  this.panel.id='coop-panel';this.panel.hidden=true;this.panel.setAttribute('aria-label','Coop online');
  this.panel.innerHTML=`<div class="coop-card"><header><span class="eyebrow">LAST NIGHT / COOP ONLINE</span><button id="coop-close" aria-label="Voltar ao menu">Voltar</button></header><h2>Não vá sozinho.</h2><p class="coop-intro">Reúna até quatro sobreviventes numa sala privada.</p><p id="coop-status" role="status" aria-live="polite"></p>
  <div id="coop-connect"><label for="coop-name">Seu nome</label><input id="coop-name" autocomplete="nickname" maxlength="40" placeholder="Sobrevivente"><div class="coop-actions"><button id="coop-create" class="primary">Criar sala</button><span>ou entre pelo convite</span><form id="coop-join-form"><label for="coop-code-input">Código da sala</label><div class="coop-code-row"><input id="coop-code-input" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="EX: N7PK4X"><button id="coop-join" type="submit">Entrar</button></div></form><button id="coop-retry">Conectar novamente</button></div></div>
  <div id="coop-lobby" hidden><div class="coop-room"><div><small>CÓDIGO DO CONVITE</small><strong id="coop-room-code"></strong></div><div><button id="coop-copy">Copiar código</button><button id="coop-invite">Copiar link</button></div></div><p id="coop-copy-status" role="status"></p><ol id="coop-players"></ol><p id="coop-ready-hint"></p><button id="coop-ready" class="primary">Estou pronto</button><button id="coop-start" class="primary">Iniciar partida</button><button id="coop-leave">Sair da sala</button></div>
  <footer>Sobrevivência em grupo · até quatro jogadores<br><span>Combate e suprimentos compartilhados. Proteja seus companheiros.</span></footer></div>`;
  this.team.id='coop-team';this.team.hidden=true;root.append(this.panel,this.team);
  let name='Sobrevivente';try{name=localStorage.getItem('last-night-player-name')||name;}catch{/* Storage is optional. */}
  this.field('coop-name').value=name;
  this.el('coop-close').onclick=()=>this.close();this.el('coop-leave').onclick=()=>{network.leave();void network.connect(this.name());this.cue();};
  this.el('coop-create').onclick=()=>{if(this.commitName())network.create();this.cue();};
  this.el('coop-join-form').onsubmit=e=>{e.preventDefault();if(this.commitName())network.join(this.field('coop-code-input').value);this.cue();};
  this.el('coop-retry').onclick=()=>{void network.connect(this.name());this.cue();};
  this.el('coop-ready').onclick=()=>{network.ready();this.cue();};this.el('coop-start').onclick=()=>{network.start();this.cue();};
  this.el('coop-copy').onclick=()=>void this.copy(false);this.el('coop-invite').onclick=()=>void this.copy(true);
  this.field('coop-code-input').onblur=()=>{this.field('coop-code-input').value=normalizeCode(this.field('coop-code-input').value);};
  this.field('coop-name').onblur=()=>this.commitName();
  this.unsubscribe=network.subscribe(()=>this.render());
 }
 private el(id:string){return this.panel.querySelector<HTMLElement>(`#${id}`)!;}
 private field(id:string){return this.el(id) as HTMLInputElement;}
 private name(){return sanitizeName(this.field('coop-name').value);}
 private commitName(){const name=this.name();this.field('coop-name').value=name;this.network.setName(name);if(validName(name))return true;this.el('coop-status').textContent='Use um nome de 2 a 20 caracteres.';this.field('coop-name').focus();return false;}
 open(code=''){this.opened=true;this.field('coop-code-input').value=normalizeCode(code);this.panel.hidden=false;this.cue();void this.network.connect(this.name());this.field('coop-name').focus();}
 close(){this.opened=false;this.network.leave();this.panel.hidden=true;this.cue();document.getElementById('coop-online')?.focus();}
 showError(){this.opened=true;this.render();}
 private async copy(invite:boolean){
  const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',this.network.code);
  try{await navigator.clipboard.writeText(invite?url.href:this.network.code);this.el('coop-copy-status').textContent=invite?'Link copiado.':'Código copiado.';this.cue();}catch{this.el('coop-copy-status').textContent='Selecione o código acima e copie para compartilhar.';}
  clearTimeout(this.copyTimer);this.copyTimer=setTimeout(()=>this.el('coop-copy-status').textContent='',3500);
 }
 private render(){
  const n=this.network,inRoom=n.state==='lobby'||n.state==='loading',busy=n.state==='connecting'||n.state==='joining'||n.state==='loading';
  if(n.state==='playing')this.opened=false;
  document.getElementById('menu')!.inert=this.opened;
  this.panel.hidden=!this.opened||n.state==='playing';this.el('coop-connect').hidden=inRoom;this.el('coop-lobby').hidden=!inRoom;
  this.el('coop-status').textContent=n.message||(n.state==='connected'?'Conectado. Crie uma sala ou use um convite.':'');
  this.el('coop-status').classList.toggle('coop-error',n.state==='error');
  for(const id of ['coop-create','coop-join'])(this.el(id) as HTMLButtonElement).disabled=n.state!=='connected';
  this.field('coop-name').disabled=busy;this.field('coop-code-input').disabled=busy;this.el('coop-retry').hidden=n.state!=='error'&&n.state!=='disconnected';
  this.el('coop-room-code').textContent=n.code;
  const rows=n.players.map(p=>{const row=document.createElement('li');const name=document.createElement('strong'),status=document.createElement('span');name.textContent=`${p.displayName}${p.isLocal?' (você)':''}`;status.textContent=p.isHost?'Líder da sala':p.ready?'Pronto':'Aguardando';row.classList.toggle('ready',p.ready||p.isHost);row.append(name,status);return row;});
  while(rows.length<4){const row=document.createElement('li');row.className='vacant';row.textContent='Aguardando sobrevivente…';rows.push(row);}this.el('coop-players').replaceChildren(...rows);
  this.el('coop-ready').hidden=n.isHost;this.el('coop-start').hidden=!n.isHost;(this.el('coop-start') as HTMLButtonElement).disabled=!n.canStart;(this.el('coop-ready') as HTMLButtonElement).disabled=busy;
  const ready=n.players.find(p=>p.isLocal)?.ready;this.el('coop-ready').textContent=ready?'Cancelar pronto':'Estou pronto';this.el('coop-ready').setAttribute('aria-pressed',String(!!ready));
  this.el('coop-ready-hint').textContent=n.state==='loading'?'Carregando a mesma cidade para todos…':n.isHost?(n.canStart?'Tudo pronto. Você pode iniciar.':'Espere os outros sobreviventes ficarem prontos.'):'Marque pronto e aguarde o líder iniciar.';
  this.team.hidden=!n.inSession;
  const title=document.createElement('strong');title.textContent=`COOP · ${n.players.length}/4 · ${n.code}`;const names=document.createElement('span');names.textContent=n.players.map(p=>`${p.isHost?'★ ':''}${p.displayName}`).join(' · ');const hint=document.createElement('small');hint.textContent='Permaneçam juntos. Ninguém fica para trás.';this.team.replaceChildren(title,names,hint);
  if(import.meta.env.DEV&&import.meta.env.VITE_NETWORK_DEBUG==='true'){const debug=document.createElement('small');debug.textContent=`${n.region} · RTT ${Math.round(n.metrics.ping)} ms · TX ${n.metrics.sendRate.toFixed(1)}/s · RX ${n.metrics.receiveRate.toFixed(1)}/s`;this.team.append(debug);}
 }
 dispose(){this.unsubscribe();clearTimeout(this.copyTimer);this.panel.remove();this.team.remove();}
}
