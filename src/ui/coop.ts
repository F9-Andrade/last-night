import type { NetworkManager } from '../network/manager';
import { normalizeCode, validName, sanitizeName } from '../network/protocol';
import './coop.css';

/** DOM presentation only: transport and room transitions belong to NetworkManager. */
export class CoopUI {
 readonly panel=document.createElement('section');
 readonly team=document.createElement('aside');
 onCreateLocal:()=>void=()=>{};
 onCreateRoom:(create:()=>void)=>void=create=>create();
 private opened=false;
 private unsubscribe:()=>void;
 private copyTimer?:ReturnType<typeof setTimeout>;
 private pauseRoom=document.createElement('section');
 private pauseSummary=document.createElement('strong');
 private pausePlayers=document.createElement('p');
 private pauseInvitation=document.createElement('div');
 private pauseCode=document.createElement('input');
 private pauseCopyStatus=document.createElement('p');
 private pauseDebug=document.createElement('small');
 constructor(private network:NetworkManager,root:HTMLElement,private cue:()=>void){
  this.panel.id='coop-panel';this.panel.hidden=true;this.panel.setAttribute('aria-label','Coop online');
  this.panel.innerHTML=`<div class="coop-card"><header><span class="eyebrow">LAST NIGHT / COOP ONLINE</span><button id="coop-close" aria-label="Voltar ao menu">Voltar</button></header><h2>Não vá sozinho.</h2><p class="coop-intro">Reúna até quatro sobreviventes numa sala privada.</p><label for="coop-transport">Conexão</label><select id="coop-transport"><option value="photon">Photon · Online</option><option value="lan">LAN · Rede local</option></select><div id="coop-lan-help" hidden><p>Todos na mesma rede. Crie sua expedição e use <strong>Esc → Abrir para LAN</strong> para convidar os amigos. Eles entram neste site com o código.</p><small>WebRTC direto · sem Photon. Internet para encontrar a sala. O Wi-Fi deve permitir conexão entre dispositivos.</small></div><p id="coop-status" role="status" aria-live="polite"></p>
  <div id="coop-connect"><label for="coop-name">Seu nome</label><input id="coop-name" autocomplete="nickname" maxlength="40" placeholder="Sobrevivente"><div class="coop-actions"><button id="coop-create" class="primary">Criar sala</button><span>ou entre pelo convite</span><form id="coop-join-form"><label for="coop-code-input">Código da sala</label><div class="coop-code-row"><input id="coop-code-input" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="EX: N7PK4X"><button id="coop-join" type="submit">Entrar</button></div></form><button id="coop-retry">Conectar novamente</button></div></div>
  <div id="coop-lobby" hidden><div class="coop-room"><div><small>CÓDIGO DO CONVITE</small><strong id="coop-room-code"></strong></div><div><button id="coop-copy">Copiar código</button><button id="coop-invite">Copiar link</button></div></div><p id="coop-copy-status" role="status"></p><ol id="coop-players"></ol><p id="coop-ready-hint"></p><button id="coop-ready" class="primary">Estou pronto</button><button id="coop-start" class="primary">Iniciar partida</button><button id="coop-leave">Sair da sala</button></div>
  <footer>Sobrevivência em grupo · até quatro jogadores<br><span>Combate e suprimentos compartilhados. Proteja seus companheiros.</span></footer></div>`;
  this.team.id='coop-team';this.team.hidden=true;root.append(this.panel,this.team);this.mountPauseRoom(root);
  let name='Sobrevivente';try{name=localStorage.getItem('last-night-player-name')||name;}catch{/* Storage is optional. */}
  this.field('coop-name').value=name;
  const transport=this.el('coop-transport') as HTMLSelectElement;
  if(new URLSearchParams(location.search).get('coop')==='lan'){network.mode='lan';transport.value='lan';}
  transport.onchange=()=>{network.leave();network.mode=transport.value==='lan'?'lan':'photon';void network.connect(this.name());};
  this.el('coop-close').onclick=()=>this.close();this.el('coop-leave').onclick=()=>{network.leave();void network.connect(this.name());this.cue();};
  this.el('coop-create').onclick=()=>{if(!this.commitName())return;this.onCreateRoom(()=>{if(network.mode==='lan'&&new URLSearchParams(location.search).get('lan')!=='server'){this.close();this.onCreateLocal();}else network.create();this.cue();});};
  this.el('coop-join-form').onsubmit=e=>{e.preventDefault();if(this.commitName())network.join(this.field('coop-code-input').value);this.cue();};
  this.el('coop-retry').onclick=()=>{void network.connect(this.name());this.cue();};
  this.el('coop-ready').onclick=()=>{network.ready();this.cue();};this.el('coop-start').onclick=()=>{network.start();this.cue();};
  this.el('coop-copy').onclick=()=>void this.copy(false);this.el('coop-invite').onclick=()=>void this.copy(true);
  this.field('coop-code-input').onblur=()=>{this.field('coop-code-input').value=normalizeCode(this.field('coop-code-input').value);};
  this.field('coop-name').onblur=()=>this.commitName();
  this.unsubscribe=network.subscribe(()=>this.render());
 }
 private mountPauseRoom(root:HTMLElement){
  const card=root.querySelector('#pause-screen .pause-card');if(!card)return;
  this.pauseRoom.id='pause-coop-room';this.pauseRoom.hidden=true;this.pauseRoom.setAttribute('aria-label','Sala cooperativa');
  this.pauseSummary.id='pause-coop-summary';this.pausePlayers.id='pause-coop-players';this.pauseInvitation.id='pause-coop-invitation';
  const label=document.createElement('label');label.htmlFor='pause-coop-code';label.textContent='Código da sala · Photon online';
  this.pauseCode.id='pause-coop-code';this.pauseCode.readOnly=true;this.pauseCode.setAttribute('aria-label','Código da sala Photon');
  this.pauseCode.onclick=()=>this.pauseCode.select();
  const actions=document.createElement('div'),copy=document.createElement('button'),invite=document.createElement('button');
  actions.className='pause-coop-actions';copy.id='pause-coop-copy';invite.id='pause-coop-invite';copy.type=invite.type='button';
  copy.textContent='Copiar código';invite.textContent='Copiar link';copy.onclick=()=>void this.copy(false,true);invite.onclick=()=>void this.copy(true,true);
  this.pauseCopyStatus.id='pause-coop-copy-status';this.pauseCopyStatus.setAttribute('role','status');
  this.pauseDebug.id='pause-coop-debug';this.pauseDebug.hidden=true;
  actions.append(copy,invite);this.pauseInvitation.append(label,this.pauseCode,actions,this.pauseCopyStatus);
  this.pauseRoom.append(this.pauseSummary,this.pausePlayers,this.pauseInvitation,this.pauseDebug);
  card.insertBefore(this.pauseRoom,card.querySelector('#pause-lan-info'));
 }
 private el(id:string){return this.panel.querySelector<HTMLElement>(`#${id}`)!;}
 private field(id:string){return this.el(id) as HTMLInputElement;}
 private name(){return sanitizeName(this.field('coop-name').value);}
 private commitName(){const name=this.name();this.field('coop-name').value=name;this.network.setName(name);if(validName(name))return true;this.el('coop-status').textContent='Use um nome de 2 a 20 caracteres.';this.field('coop-name').focus();return false;}
 setAccountName(name:string){this.field('coop-name').value=sanitizeName(name);this.field('coop-name').readOnly=true;this.network.setName(name);}
 clearAccountName(){this.field('coop-name').readOnly=false;}
 open(code=''){this.opened=true;this.field('coop-code-input').value=normalizeCode(code);this.panel.hidden=false;this.cue();void this.network.connect(this.name());this.field('coop-name').focus();}
 close(){this.opened=false;this.network.leave();this.panel.hidden=true;this.cue();document.getElementById('coop-online')?.focus();}
 showError(){this.opened=true;this.render();}
 private async copy(invite:boolean,fromPause=false){
  const status=fromPause?this.pauseCopyStatus:this.el('coop-copy-status');
  const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',this.network.code);if(this.network.mode==='lan'){url.searchParams.set('coop','lan');if(new URLSearchParams(location.search).get('lan')==='server')url.searchParams.set('lan','server');}
  try{await navigator.clipboard.writeText(invite?url.href:this.network.code);status.textContent=invite?'Link copiado.':'Código copiado.';this.cue();}catch{
   if(fromPause){this.pauseCode.focus();this.pauseCode.select();}
   status.textContent=fromPause?'Copie o código selecionado para compartilhar.':'Selecione o código acima e copie para compartilhar.';
  }
  clearTimeout(this.copyTimer);this.copyTimer=setTimeout(()=>{this.el('coop-copy-status').textContent='';this.pauseCopyStatus.textContent='';},3500);
 }
 private render(){
  const n=this.network,inRoom=n.state==='lobby'||n.state==='loading',busy=n.state==='connecting'||n.state==='joining'||n.state==='loading';
  if(n.state==='playing')this.opened=false;
  this.el('coop-create').textContent=n.mode==='lan'&&new URLSearchParams(location.search).get('lan')!=='server'?'Criar expedição LAN':'Criar sala';
  this.field('coop-code-input').placeholder=n.mode==='lan'?'EX: L-A1B2C3D4E5':'EX: N7PK4X';
  this.el('coop-lan-help').hidden=n.mode!=='lan'||inRoom;(this.el('coop-transport') as HTMLSelectElement).disabled=inRoom;
  document.getElementById('menu')!.inert=this.opened||document.getElementById('account-panel')?.hidden===false;
  this.panel.hidden=!this.opened||n.state==='playing';this.el('coop-connect').hidden=inRoom;this.el('coop-lobby').hidden=!inRoom;
  this.el('coop-status').textContent=n.message||(n.state==='connected'?'Conectado. Crie uma sala ou use um convite.':'');
  this.el('coop-status').classList.toggle('coop-error',n.state==='error');
  for(const id of ['coop-create','coop-join'])(this.el(id) as HTMLButtonElement).disabled=n.state!=='connected';
  this.field('coop-name').disabled=busy;this.field('coop-code-input').disabled=busy;this.el('coop-retry').hidden=n.state!=='error'&&n.state!=='disconnected';
  this.el('coop-room-code').textContent=n.code;
  const rows=n.players.map(p=>{const row=document.createElement('li');const name=document.createElement('strong'),status=document.createElement('span');name.textContent=`${sanitizeName(p.displayName)||'Sobrevivente'}${p.isLocal?' (você)':''}`;status.textContent=p.isHost?'Líder da sala':p.ready?'Pronto':'Aguardando';row.classList.toggle('ready',p.ready||p.isHost);row.append(name,status);return row;});
  while(rows.length<4){const row=document.createElement('li');row.className='vacant';row.textContent='Aguardando sobrevivente…';rows.push(row);}this.el('coop-players').replaceChildren(...rows);
  this.el('coop-ready').hidden=n.isHost;this.el('coop-start').hidden=!n.isHost;(this.el('coop-start') as HTMLButtonElement).disabled=!n.canStart;(this.el('coop-ready') as HTMLButtonElement).disabled=busy;
  const ready=n.players.find(p=>p.isLocal)?.ready;this.el('coop-ready').textContent=ready?'Cancelar pronto':'Estou pronto';this.el('coop-ready').setAttribute('aria-pressed',String(!!ready));
  this.el('coop-ready-hint').textContent=n.state==='loading'?'Carregando a mesma cidade para todos…':n.isHost?(n.canStart?'Tudo pronto. Você pode iniciar.':'Espere os outros sobreviventes ficarem prontos.'):'Marque pronto e aguarde o líder iniciar.';
  const names=n.players.map(p=>`${p.isHost?'★ ':''}${sanitizeName(p.displayName)||'Sobrevivente'}`).join(' · ');
  // Retain this compatibility marker without putting room metadata over the world.
  this.team.hidden=true;this.team.textContent=`${n.mode==='lan'?'LAN':'COOP'} · ${n.players.length}/4 · ${n.code}\n${names}`;
  this.pauseRoom.hidden=!n.inSession;
  this.pauseSummary.textContent=`${n.mode==='lan'?'LAN · Rede local':'Photon · Online'} · ${n.players.length}/4 sobreviventes`;
  this.pausePlayers.textContent=names;
  // LAN invitations keep their existing pause controls and status messages.
  this.pauseInvitation.hidden=n.mode==='lan';this.pauseCode.value=n.code;
  if(import.meta.env.DEV&&import.meta.env.VITE_NETWORK_DEBUG==='true'){this.pauseDebug.hidden=false;this.pauseDebug.textContent=`${n.region} · RTT ${Math.round(n.metrics.ping)} ms · TX ${n.metrics.sendRate.toFixed(1)}/s · RX ${n.metrics.receiveRate.toFixed(1)}/s`;}
 }
 dispose(){this.unsubscribe();clearTimeout(this.copyTimer);this.panel.remove();this.team.remove();this.pauseRoom.remove();}
}
