import {LanTransport} from './lan';
import {MessageAssembler,splitMessage,FRAGMENT_EVENT,FRAGMENT_SIZE} from './fragments';
import {GameplayEvent,COOP} from './gameplay-protocol';
import {SnapshotBudget} from './rate-limit';
import type PhotonAPI from 'photon-realtime';
import type {Client,Actor,Peer} from 'photon-realtime';
import {sessionToken,canStart,generateCode,normalizeCode,validCode,roomRegion,sanitizeName,validName,parseSnapshot,parseStart,encodeSnapshot,REGIONS,MAX_PLAYERS,NETWORK_BUILD,NETWORK_PROTOCOL_VERSION,NETWORK_SEND_RATE,NetworkEventCode} from './protocol.ts';
import type {ConnectionState,NetworkPlayerIdentity,StartData,PlayerSnapshot,RemotePlayerState} from './protocol.ts';
import {InterpolationBuffer} from './interpolation.ts';
const APP_VERSION=`${NETWORK_BUILD}-p${NETWORK_PROTOCOL_VERSION}`;
export class NetworkManager {
 mode:'photon'|'lan'='photon';private lan?:LanTransport;
 state:ConnectionState='disconnected';message='';region='';code='';players:NetworkPlayerIdentity[]=[];
 readonly remotes=new Map<number,InterpolationBuffer>();
 metrics={sent:0,received:0,rejected:0,sendRate:0,receiveRate:0,payloadBytes:0,averagePayloadBytes:0,ping:0};
 readonly poses=new Map<number,PlayerSnapshot>();
 onGameplay:(code:number,data:unknown,actor:number)=>void=()=>{};onTick:(dt:number)=>void=()=>{};
 private assembler=new MessageAssembler();private messageId=0;
 gameplayMetrics={sent:0,received:0,bytes:0,rejected:0};
 get masterActor(){return this.lan?.master??this.client?.myRoomMasterActorNr()??0;}
 sendGameplay(code:number,data:unknown,target?:number){
  if(!this.inSession||!Object.values(GameplayEvent).includes(code as 10))return;
  const text=JSON.stringify(data);if(text.length>COOP.maxPayload){this.gameplayMetrics.rejected++;return;}
  if(text.length>FRAGMENT_SIZE){const pieces=splitMessage(code,data,++this.messageId);if(!pieces){this.gameplayMetrics.rejected++;return;}for(const p of pieces)this.sendEvent(FRAGMENT_EVENT,p,target);}
  else this.sendEvent(code,data,target);
  this.gameplayMetrics.sent++;this.gameplayMetrics.bytes+=text.length;
 }

 private sendEvent(code:number,data:unknown,target?:number){
  if(this.lan){this.lan.event(code,data,target);return;}
  if(this.client&&this.sdk)this.client.raiseEvent(code,data,target?{targetActors:[target]}:{receivers:this.sdk.LoadBalancing.Constants.ReceiverGroup.Others});
 }
 private connectLan(){
  const generation=this.generation;this.region='LAN';this.setState('connecting','Conectando ao servidor da rede local…');this.deadline('Servidor LAN não respondeu. Abra o endereço do computador que hospeda a partida.');
  this.lan=new LanTransport(this.name,m=>{
   if(generation!==this.generation)return;
   if(m.type==='connected'){this.clearDeadline();this.setState('connected','LAN conectada. Crie uma sala ou use o código.');}
   else if(m.type==='room'){
    this.code=m.code;this.players=m.players.map((p:NetworkPlayerIdentity)=>({...p,isLocal:p.actorNumber===this.localActor,isHost:p.actorNumber===this.masterActor}));
    this.syncRemotes();
    if(this.state==='joining'||this.state==='connected'){this.clearDeadline();this.setState('lobby','Você entrou na sala LAN.');this.startTicker();}else this.emit();
   }else if(m.type==='start'){const data=parseStart(m.data,this.players.map(p=>p.actorNumber));if(data&&data.seed===this.lan?.seed)void this.begin(data);}
   else if(m.type==='playing')this.enterPlaying();
   else if(m.type==='event')this.receive(m.code,m.data,m.actor);
   else if(m.type==='error'){if(this.inSession||m.fatal)this.fail(m.message);else{this.clearDeadline();this.setState('connected',m.message);}}
  },message=>{if(generation===this.generation)this.fail(message);});
 }
 private syncRemotes(){
  for(const actor of this.remotes.keys())if(!this.players.some(p=>p.actorNumber===actor&&!p.isLocal)){this.remotes.delete(actor);this.poses.delete(actor);this.receiveBudgets.delete(actor);}
  for(const p of this.players)if(!p.isLocal&&!this.remotes.has(p.actorNumber))this.remotes.set(p.actorNumber,new InterpolationBuffer());
 }

 onStart:(data:StartData)=>void|Promise<void>=()=>{};onEnded:()=>void=()=>{};
 private locallyLoaded=false;
 private listeners=new Set<()=>void>();private sdk?:typeof PhotonAPI;private client?:Client;private generation=0;private timeout?:ReturnType<typeof setTimeout>;private ticker?:ReturnType<typeof setInterval>;
 private probes=new Set<()=>void>();private regionRequest=false;private intent?:{kind:'create'|'join';code?:string;retries:number};private name='';private sequence=0;private lastSample?:PlayerSnapshot;private startedToken='';private lastMetric=0;private sentMark=0;private receivedMark=0;private receiveBudgets=new Map<number,SnapshotBudget>();private sendTime=0;
 get localActor(){return this.lan?.actor??this.client?.myActor().actorNr??0;}
 get isHost(){return this.players.some(p=>p.isLocal&&p.isHost);}
 get inSession(){return this.state==='loading'||this.state==='playing';}
 get canStart(){return this.state==='lobby'&&canStart(this.players,this.localActor);}
 subscribe(callback:()=>void){this.listeners.add(callback);callback();return ()=>this.listeners.delete(callback);}
 private emit(){for(const callback of this.listeners)callback();}
 private setState(state:ConnectionState,message=''){this.state=state;this.message=message;this.emit();}
 private deadline(message:string,ms=25000){clearTimeout(this.timeout);this.timeout=setTimeout(()=>this.fail(message),ms);}
 private clearDeadline(){clearTimeout(this.timeout);this.timeout=undefined;}
 private clearTransport(){
  this.assembler.clear();this.messageId=0;this.generation++;this.locallyLoaded=false;this.clearDeadline();clearInterval(this.ticker);this.ticker=undefined;for(const cancel of [...this.probes])cancel();this.probes.clear();
  this.lan?.close();this.lan=undefined;const c=this.client;this.client=undefined;c?.disconnect();this.players=[];this.remotes.clear();this.poses.clear();this.receiveBudgets.clear();this.lastSample=undefined;this.startedToken='';this.sequence=0;this.intent=undefined;this.code='';this.regionRequest=false;this.sendTime=0;
 }
 private fail(message:string){const wasGame=this.inSession;this.clearTransport();this.setState('error',message);if(wasGame)this.onEnded();console.warn('[Network]',message);}
 leave(){const wasGame=this.inSession;this.clearTransport();this.setState('disconnected');if(wasGame)this.onEnded();}
 dispose(){this.leave();this.listeners.clear();this.onStart=()=>{};this.onEnded=()=>{};}
 async connect(name:string,region?:string,pending?:{kind:'join';code:string;retries:number}){
  this.clearTransport();this.name=sanitizeName(name);this.intent=pending;this.region=region??'';
  if(this.mode==='lan'){this.connectLan();return;}
  const appId=import.meta.env.VITE_PHOTON_APP_ID?.trim();
  if(!appId||! /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(appId)){this.setState('error','Coop indisponível: configure VITE_PHOTON_APP_ID. Você pode jogar solo.');return;}
  const generation=this.generation;this.setState('connecting','Conectando à rede…');this.deadline('A conexão demorou demais. Tente novamente.',45000);
  try{
   const {default:sdk}=await import('photon-realtime');if(generation!==this.generation)return;this.sdk=sdk;
   // Official SDK extension point: CommonJS distribution defaults to Node's ws.
   sdk.PhotonPeer.setWebSocketImpl(WebSocket);
   const c=new sdk.LoadBalancing.LoadBalancingClient(sdk.ConnectionProtocol.Wss,appId,APP_VERSION);this.client=c;c.setLogLevel(import.meta.env.DEV&&import.meta.env.VITE_NETWORK_DEBUG==='true'?3:1);c.setUserId(sessionToken());
   this.applyName();const current=()=>this.client===c&&this.generation===generation;
   c.onStateChange=state=>{if(!current())return;const S=sdk.LoadBalancing.LoadBalancingClient.State;
    if(import.meta.env.DEV&&import.meta.env.VITE_NETWORK_DEBUG==='true')console.info('[Network]',sdk.LoadBalancing.LoadBalancingClient.StateToName(state));
    if(state===S.ConnectedToNameServer&&!this.regionRequest){this.regionRequest=true;if(region)c.connectToRegionMaster(region);else c.getRegions();}
    if(state===S.JoinedLobby){this.clearDeadline();this.setState('connected','Conectado');if(this.intent?.kind==='join')this.joinHere(this.intent.code!);}
    if(state===S.Disconnected)this.fail('Conexão perdida. Volte ao coop para conectar novamente.');
   };
   c.onError=(code,message)=>{if(!current())return;console.warn('[Network] SDK error',code);this.fail(/32757|CCU|UserLimit/i.test(message)?'A rede atingiu o limite de jogadores simultâneos. Tente mais tarde.':'Não foi possível conectar ao Photon. Verifique sua conexão e tente novamente.');};
   c.onGetRegionsResult=(error,_message,regions)=>{if(!current())return;if(error){this.fail('Não foi possível consultar as regiões.');return;}void this.selectRegion(sdk,regions,appId,generation).then(best=>{if(current()&&best){this.region=best;c.connectToRegionMaster(best);}});};
   c.onOperationResponse=(error,_message,operation)=>{if(!current()||!error)return;
    if(error===32766&&this.intent?.kind==='create'&&this.intent.retries++<5){this.createHere();return;}
    if([227,226,225].includes(operation)){
     this.clearDeadline();this.intent=undefined;this.code='';this.setState('connected',({32766:'Não foi possível reservar um código. Tente novamente.',32765:'Sala cheia. O limite é quatro jogadores.',32764:'Partida já iniciada. A sala está fechada.',32758:'Sala não encontrada. Confira o código.'} as Record<number,string>)[error]??'Erro do servidor ao entrar na sala. Tente novamente.');
    }else this.fail(error===32757?'A rede atingiu o limite de jogadores simultâneos. Tente mais tarde.':'Erro do servidor. Tente conectar novamente.');
   };
   c.onJoinRoom=()=>{if(!current())return;this.clearDeadline();this.intent=undefined;this.code=c.myRoom().name;
    if(c.myRoom().getCustomProperty('protocol')!==NETWORK_PROTOCOL_VERSION||c.myRoom().getCustomProperty('build')!==NETWORK_BUILD){this.fail('Esta sala usa outra versão do jogo. Atualize os dois clientes.');return;}
    if(c.myRoom().getCustomProperty('gameState')!=='lobby'){this.fail('Partida já iniciada.');return;}
    this.refreshPlayers();this.setState('lobby','Você entrou na sala.');this.startTicker();console.info('[Network] Joined room',this.code);
   };
   c.onActorJoin=()=>{if(current()){this.refreshPlayers();this.message='Um sobrevivente entrou.';this.emit();}};
   c.onActorLeave=(_actor,cleanup)=>{if(current()&&!cleanup){this.refreshPlayers();this.message='Um sobrevivente saiu.';this.emit();}};
   c.onActorPropertiesChange=()=>{if(current())this.refreshPlayers();};
   c.onMyRoomPropertiesChange=()=>{if(current()){if(this.state==='lobby'&&c.myRoom().getCustomProperty('gameState')==='loading')this.deadline('O início da partida foi interrompido. Crie outra sala.');this.refreshPlayers();if(this.state==='loading'&&c.myRoom().getCustomProperty('gameState')==='playing')this.enterPlaying();}};
   c.onEvent=(code,data,actor)=>{if(current())this.receive(code,data,actor);};
   c.connectToNameServer();
  }catch(error){if(generation===this.generation){console.warn('[Network] SDK initialization failed',error);this.fail('Não foi possível carregar o coop. O modo solo continua disponível.');}}
 }
 private async selectRegion(sdk:typeof PhotonAPI,regions:Record<string,string>,appId:string,generation:number){
  const supported=Object.entries(regions).filter(([r])=>Object.values(REGIONS).includes(r));let best='',bestMs=Infinity;
  // Probe using PhotonPeer itself, not an alternative networking transport.
  for(let i=0;i<supported.length;i+=4){if(this.generation!==generation)return '';
   const results=await Promise.all(supported.slice(i,i+4).map(async([region,address])=>({region,ms:await this.probe(sdk,address,appId)})));
   for(const r of results)if(r.ms<bestMs){best=r.region;bestMs=r.ms;}
  }
  if(!best&&this.generation===generation)this.fail('Nenhuma região respondeu. Verifique sua conexão.');return best;
 }
 private probe(sdk:typeof PhotonAPI,address:string,appId:string):Promise<number>{return new Promise(resolve=>{
  let peer:Peer|undefined;let done=false;const begin=performance.now();let timer:ReturnType<typeof setTimeout>;
  const finish=(ms=Infinity)=>{if(done)return;done=true;clearTimeout(timer);this.probes.delete(cancel);peer?.disconnect();peer?.Destroy();resolve(ms);};const cancel=()=>finish();this.probes.add(cancel);timer=setTimeout(cancel,2200);
  try{peer=new sdk.PhotonPeer(sdk.ConnectionProtocol.Wss,address,'','RegionProbe');peer.setLogLevel(0);peer.addPeerStatusListener(sdk.PhotonPeer.StatusCodes.connect,()=>finish(performance.now()-begin));for(const event of ['error','connectFailed','connectClosed'])peer.addPeerStatusListener(sdk.PhotonPeer.StatusCodes[event],cancel);peer.connect(appId);}catch{finish();}
 });}
 setName(value:string){this.name=sanitizeName(value);try{localStorage.setItem('last-night-player-name',this.name);}catch{/* Optional storage. */}if(this.lan)this.lan.send({type:'name',name:this.name});else this.applyName();}
 private applyName(){const actor=this.client?.myActor();if(!actor)return;actor.setName(this.name);actor.setCustomProperties({displayName:this.name,ready:false,playerId:this.client!.getUserId?.()??''});}
 create(){if(this.state!=='connected')return;if(this.lan){this.setState('joining','Criando sala LAN…');this.deadline('O servidor LAN não respondeu.');this.lan.send({type:'create'});return;}if(!this.client)return;if(!validName(this.name)){this.setState('connected','Use um nome de 2 a 20 caracteres.');return;}this.intent={kind:'create',retries:0};this.setState('joining','Criando sala…');this.deadline('Não foi possível criar a sala a tempo.');this.createHere();}
 private createHere(){this.code=generateCode(this.region);this.client!.createRoom(this.code,{maxPlayers:MAX_PLAYERS,isVisible:false,isOpen:true,playerTTL:0,roomTTL:0,customGameProperties:{protocol:NETWORK_PROTOCOL_VERSION,build:NETWORK_BUILD,gameState:'lobby',seed:crypto.getRandomValues(new Uint32Array(1))[0]}});}
 join(value:string){if(this.state!=='connected')return;if(this.lan){if(!/^L[0-9A-F]{5}$/i.test(value.trim())){this.setState('connected','Código LAN inválido. Use o código mostrado pelo líder.');return;}this.setState('joining','Entrando na sala LAN…');this.deadline('O servidor LAN não respondeu.');this.lan.send({type:'join',code:value.trim().toUpperCase()});return;}const code=normalizeCode(value);if(!validCode(code)){this.setState('connected','Código inválido. Use os seis caracteres do convite.');return;}if(!validName(this.name)){this.setState('connected','Use um nome de 2 a 20 caracteres.');return;}const target=roomRegion(code)!;
  if(target!==this.region){void this.connect(this.name,target,{kind:'join',code,retries:0});return;}this.joinHere(code);
 }
 private joinHere(code:string){this.intent={kind:'join',code,retries:0};this.setState('joining','Entrando na sala…');this.deadline('A entrada na sala demorou demais.');this.client!.joinRoom(code,{createIfNotExists:false});}
 private identity(a:Actor):NetworkPlayerIdentity{
  const displayName=sanitizeName(a.getCustomProperty('displayName'));return {actorNumber:a.actorNr,playerId:typeof a.getCustomProperty('playerId')==='string'?String(a.getCustomProperty('playerId')).slice(0,64):`actor-${a.actorNr}`,displayName:validName(displayName)?displayName:`Sobrevivente ${a.actorNr}`,isLocal:a.actorNr===this.localActor,isHost:a.actorNr===this.client?.myRoomMasterActorNr(),ready:a.getCustomProperty('ready')===true};
 }
 private refreshPlayers(){const c=this.client;if(!c?.isJoinedToRoom())return;this.players=Object.values(c.myRoomActors()).map(a=>this.identity(a)).sort((a,b)=>a.actorNumber-b.actorNumber);
  if(this.players.length>MAX_PLAYERS){this.fail('Esta sala excedeu o limite de jogadores.');return;}
  this.syncRemotes();
  if(this.state==='loading'&&this.isHost&&this.players.every(p=>c.myRoomActors()[p.actorNumber]?.getCustomProperty('loaded')===this.startedToken)){c.myRoom().setCustomProperty('gameState','playing');this.enterPlaying();}
  this.emit();
 }
 ready(){if(this.state!=='lobby'||this.isHost)return;if(this.lan){this.lan.send({type:'ready'});return;}const a=this.client!.myActor();a.setCustomProperty('ready',a.getCustomProperty('ready')!==true);this.refreshPlayers();}
 start(){if(!this.canStart)return;if(this.lan){this.lan.send({type:'start'});return;}const c=this.client!,data:StartData={seed:c.myRoom().getCustomProperty('seed') as number,actors:this.players.map(p=>p.actorNumber),token:sessionToken()};
  c.myRoom().setIsOpen(false);c.myRoom().setCustomProperties({gameState:'loading',token:data.token});
  c.raiseEvent(NetworkEventCode.GameStart,data,{receivers:this.sdk!.LoadBalancing.Constants.ReceiverGroup.Others});this.begin(data);
 }
 private async begin(data:StartData){if(this.startedToken)return;this.startedToken=data.token;this.locallyLoaded=false;const generation=this.generation,client=this.client!;
  this.setState('loading','Preparando a partida…');this.deadline('Um jogador não concluiu o carregamento. Crie uma nova sala.',90000);
  try{
   await this.onStart(data);
   if(generation!==this.generation||client!==this.client||this.state!=='loading')return;
   this.locallyLoaded=true;if(this.lan){this.lan.send({type:'loaded',token:data.token});return;}client.myActor().setCustomProperty('loaded',data.token);this.refreshPlayers();
   if(client.myRoom().getCustomProperty('gameState')==='playing')this.enterPlaying();
  }catch(error){if(generation!==this.generation)return;console.error('[Network] Loading failed',error);this.fail('Não foi possível carregar esta partida.');}
 }
 private enterPlaying(){if(!this.locallyLoaded||this.state!=='loading')return;this.clearDeadline();this.setState('playing');console.info('[Network] Playing',this.code);}
 private receive(code:number,data:unknown,actor:number){
  if(!Number.isInteger(actor)||actor===this.localActor||!this.players.some(p=>p.actorNumber===actor))return;
  if(code===NetworkEventCode.GameStart){if(this.state!=='lobby'||actor!==this.masterActor)return;const start=parseStart(data,this.players.map(p=>p.actorNumber));if(start&&start.seed===(this.lan?.seed??this.client?.myRoom().getCustomProperty('seed')))this.begin(start);return;}
  if(this.inSession&&code===FRAGMENT_EVENT){
   if(!this.players.some(p=>p.actorNumber===actor))return;
   const message=this.assembler.receive(actor,data,performance.now());if(message){this.gameplayMetrics.received++;this.onGameplay(message.code,message.data,actor);}return;
  }
  if(this.inSession&&Object.values(GameplayEvent).includes(code as 10)){this.gameplayMetrics.received++;this.onGameplay(code,data,actor);return;}
  if(code!==NetworkEventCode.PlayerSnapshot||!this.inSession)return;const now=performance.now();
  let budget=this.receiveBudgets.get(actor);if(!budget){budget=new SnapshotBudget();this.receiveBudgets.set(actor,budget);}if(!budget.take(now)){this.metrics.rejected++;return;}
  const snapshot=parseSnapshot(data);if(!snapshot||!this.remotes.get(actor)?.push(snapshot,now)){this.metrics.rejected++;return;}
  this.poses.set(actor,snapshot);this.metrics.received++;
 }
 updateLocal(sample:Omit<PlayerSnapshot,'sequence'|'time'>){if(this.inSession){this.lastSample={...sample,sequence:0,time:0};this.poses.set(this.localActor,this.lastSample);}}
 remoteStates(now=performance.now()):RemotePlayerState[]{return this.players.filter(p=>!p.isLocal).map(identity=>({identity,snapshot:this.remotes.get(identity.actorNumber)?.sample(now)??null}));}
 private startTicker(){clearInterval(this.ticker);this.metrics={sent:0,received:0,rejected:0,sendRate:0,receiveRate:0,payloadBytes:0,averagePayloadBytes:0,ping:0};this.lastMetric=performance.now();this.sentMark=0;this.receivedMark=0;
  let previousTick=performance.now();
  this.ticker=setInterval(()=>{const now=performance.now();const tickDt=Math.min(.25,(now-previousTick)/1000);previousTick=now;this.onTick(tickDt);if(this.inSession&&this.lastSample&&now-this.sendTime>=1000/NETWORK_SEND_RATE-1){this.sendTime=now;const payload=encodeSnapshot({...this.lastSample,sequence:this.sequence++,time:Math.round(now)});this.sendEvent(NetworkEventCode.PlayerSnapshot,payload);this.metrics.sent++;this.metrics.payloadBytes+=JSON.stringify(payload).length;}
   const dt=(now-this.lastMetric)/1000;if(dt>=1){this.metrics.sendRate=(this.metrics.sent-this.sentMark)/dt;this.metrics.receiveRate=(this.metrics.received-this.receivedMark)/dt;this.metrics.averagePayloadBytes=this.metrics.sent?this.metrics.payloadBytes/this.metrics.sent:0;this.metrics.ping=this.client?.getRtt()??0;this.client?.updateRtt();this.lastMetric=now;this.sentMark=this.metrics.sent;this.receivedMark=this.metrics.received;this.emit();}
  },1000/NETWORK_SEND_RATE);
 }
}
