import {Peer} from 'peerjs';
import type {DataConnection} from 'peerjs';
import {NETWORK_BUILD,sanitizeName,validName,sessionToken,LAN_CODE} from './protocol';

const PREFIX=`last-night-${NETWORK_BUILD}-`;
type Member={actorNumber:number;playerId:string;displayName:string;ready:boolean};
type Link={connection:DataConnection;timer:ReturnType<typeof setTimeout>;at:number;count:number;bytes:number};
const code=()=>`L-${Array.from(crypto.getRandomValues(new Uint8Array(5)),v=>v.toString(16).padStart(2,'0')).join('').toUpperCase()}`;
const validMembers=(v:unknown):v is Member[]=>Array.isArray(v)&&v.length>0&&v.length<=4&&v.every(p=>p&&Number.isSafeInteger(p.actorNumber)&&p.actorNumber>0&&typeof p.playerId==='string'&&p.playerId.startsWith(PREFIX)&&LAN_CODE.test(p.playerId.slice(PREFIX.length))&&typeof p.displayName==='string'&&sanitizeName(p.displayName)===p.displayName&&validName(p.displayName)&&typeof p.ready==='boolean')&&new Set(v.map(p=>p.actorNumber)).size===v.length&&new Set(v.map(p=>p.playerId)).size===v.length;
/** PeerServer only discovers peers. All room control and gameplay use local ICE data channels. */
export class BrowserLanTransport {
 actor=0;master=0;seed=0;ping=0;
 private peer:Peer;private stopped=false;private members:Member[]=[];private links=new Map<string,Link>();
 private token='';private roomCode='';private joining='';private nextActor=2;private loaded=false;
 private heartbeat:ReturnType<typeof setInterval>;private reconnect?:ReturnType<typeof setTimeout>;
 constructor(private name:string,private receive:(message:any)=>void,private fail:(message:string)=>void){
  const options={debug:0 as const,config:{iceServers:[]}};
  this.peer=new Peer(PREFIX+code(),options);
  this.peer.on('open',()=>{if(this.stopped)return;clearTimeout(this.reconnect);if(!this.members.length)this.receive({type:'connected'});else this.receive({type:'notice',message:'Sinalização LAN reconectada. Convites disponíveis.'});});
  this.peer.on('connection',c=>this.attach(c));
  this.peer.on('disconnected',()=>{if(this.stopped)return;this.receive({type:'notice',message:'Sinalização LAN desconectada. A partida local continua; tentando reconectar convites…'});this.reconnect=setTimeout(()=>{if(!this.stopped&&!this.peer.destroyed)this.peer.reconnect();},3000);});
  this.peer.on('error',e=>{
   if(this.stopped)return;
   if(this.members.length){this.receive({type:'notice',message:'Não foi possível conectar um participante pela rede local. Confira se todos estão na mesma rede e sem isolamento Wi-Fi.'});return;}
   this.fail(e.type==='peer-unavailable'?'Sala LAN não encontrada. Confira o código e mantenha o anfitrião no jogo.':'Não foi possível conectar a LAN. Verifique a internet para encontrar a sala e permita a conexão entre dispositivos na rede local.');
  });
  this.heartbeat=setInterval(()=>{if(this.stopped)return;for(const link of this.links.values())if(link.connection.open)this.write(link.connection,{type:'ping',at:performance.now()});},3000);
 }
 private write(c:DataConnection,m:unknown){
  if(!c.open||this.stopped)return;
  // Drop obsolete motion under pressure; never grow an unbounded reliable gameplay queue.
  const size=c.dataChannel?.bufferedAmount??0;
  if(size>512000&&(m as {code?:number}).code===1)return;
  if(size>4000000){c.close();return;}
  try{c.send(m);}catch{c.close();}
 }
 private attach(c:DataConnection){
  if(this.stopped||this.links.has(c.peer)||this.links.size>=6){c.close();return;}
  const link:Link={connection:c,timer:setTimeout(()=>{if(!this.members.some(m=>m.playerId===c.peer)||!c.open)c.close();},30000),at:performance.now(),count:0,bytes:0};this.links.set(c.peer,link);
  c.on('open',()=>{
   if(c.peer===this.joining)this.write(c,{type:'hello',build:NETWORK_BUILD,name:this.name});
   else if(this.members.some(m=>m.playerId===c.peer))this.write(c,{type:'mesh'});
  });
  c.on('data',data=>{
   if(this.stopped||!data||typeof data!=='object')return;
   const now=performance.now();if(now-link.at>1000){link.at=now;link.count=0;link.bytes=0;}
   let length=0;try{length=JSON.stringify(data).length;}catch{return;}
   link.bytes+=length;if(length>18000||++link.count>300||link.bytes>4000000){c.close();return;}
   this.message(c,data as Record<string,any>);
  });
  c.on('close',()=>this.closed(c));c.on('error',()=>c.close());
 }
 private connectPeer(id:string){if(this.links.has(id)||id===this.peer.id)return;this.attach(this.peer.connect(id,{reliable:true,serialization:'json'}));}
 private message(c:DataConnection,m:Record<string,any>){
  const member=this.members.find(p=>p.playerId===c.peer);
  if(m.type==='hello'){
   if(this.actor!==this.master||!this.token||member)return;
   if(m.build!==NETWORK_BUILD||!validName(sanitizeName(m.name))||!c.peer.startsWith(PREFIX)||!LAN_CODE.test(c.peer.slice(PREFIX.length))){this.write(c,{type:'error',message:'Versão ou nome incompatível. Atualize os dois jogos.'});return;}
   if(this.members.length>=4){this.write(c,{type:'error',message:'Sala LAN cheia. O limite é quatro jogadores.'});return;}
   const p:Member={actorNumber:this.nextActor++,playerId:c.peer,displayName:sanitizeName(m.name),ready:false};this.members.push(p);clearTimeout(this.links.get(c.peer)?.timer);this.publishRoom();return;
  }
  if(m.type==='error'&&c.peer===this.joining&&!this.actor){this.fail(typeof m.message==='string'?m.message:'Falha ao entrar na LAN.');return;}
  if(m.type==='room'){
   const host=this.members.find(p=>p.actorNumber===this.master)?.playerId;
   if(c.peer!==(host||this.joining)||!validMembers(m.players)||!Number.isInteger(m.seed)||m.seed<0||m.seed>4294967295||typeof m.token!=='string'||! /^[a-zA-Z0-9-]{8,40}$/.test(m.token))return;
   const own=m.players.find(p=>p.playerId===this.peer.id);if(!own)return;
   const leader=m.players.reduce((a,b)=>a.actorNumber<b.actorNumber?a:b);if(leader.playerId!==c.peer)return;
   const first=!this.actor;this.actor=own.actorNumber;this.master=leader.actorNumber;this.seed=m.seed;this.token=m.token;this.members=m.players;this.nextActor=Math.max(this.nextActor,Number.isSafeInteger(m.nextActor)&&m.nextActor>0?m.nextActor:1,...this.members.map(p=>p.actorNumber+1));this.roomCode=leader.playerId.slice(PREFIX.length);
   clearTimeout(this.links.get(c.peer)?.timer);this.emitRoom();
   for(const p of this.members)if(p.actorNumber<this.actor)this.connectPeer(p.playerId);
   if(first)this.receive({type:'start',data:{seed:this.seed,actors:this.members.map(p=>p.actorNumber),token:this.token}});
   return;
  }
  if(!member)return;
  clearTimeout(this.links.get(c.peer)?.timer);
  if(m.type==='mesh')return;
  if(m.type==='ping'){this.write(c,{type:'pong',at:m.at});return;}
  if(m.type==='pong'){if(member.actorNumber===this.master&&Number.isFinite(m.at))this.ping=Math.max(0,performance.now()-m.at);return;}
  if(m.type==='leave'){this.drop(member.playerId);return;}
  if(m.type==='loaded'&&this.actor===this.master){member.ready=true;this.publishRoom();return;}
  if(m.type==='event'&&[1,10,11,12,13,14,15,16].includes(m.code))this.receive({type:'event',code:m.code,data:m.data,actor:member.actorNumber});
 }
 private emitRoom(){this.receive({type:'room',code:this.roomCode,seed:this.seed,master:this.master,players:this.members});}
 private publishRoom(){this.emitRoom();const packet={type:'room',players:this.members,seed:this.seed,token:this.token,nextActor:this.nextActor};for(const p of this.members){const c=this.links.get(p.playerId)?.connection;if(c)this.write(c,packet);}}
 private drop(id:string){
  const member=this.members.find(p=>p.playerId===id);if(!member)return;
  this.members=this.members.filter(p=>p.playerId!==id);const link=this.links.get(id);if(link){clearTimeout(link.timer);this.links.delete(id);link.connection.close();}
  if(!this.members.length)return;
  const host=this.members.reduce((a,b)=>a.actorNumber<b.actorNumber?a:b);this.master=host.actorNumber;this.roomCode=host.playerId.slice(PREFIX.length);
  if(this.actor===this.master)this.publishRoom();else this.emitRoom();
 }
 private closed(c:DataConnection){const link=this.links.get(c.peer);if(!link||link.connection!==c)return;clearTimeout(link.timer);this.links.delete(c.peer);if(this.stopped)return;
  if(!this.actor&&c.peer===this.joining){this.fail('Não foi possível estabelecer a conexão local. Confirme a mesma rede e verifique o isolamento de dispositivos no Wi-Fi.');return;}
  this.drop(c.peer);
 }
 host(seed:number){
  if(this.stopped||this.actor)return;this.actor=1;this.master=1;this.seed=seed;this.token=sessionToken();this.roomCode=this.peer.id.slice(PREFIX.length);this.members=[{actorNumber:1,playerId:this.peer.id,displayName:this.name,ready:true}];this.publishRoom();
  this.receive({type:'start',data:{seed,actors:[1],token:this.token}});
 }
 send(m:any){
  if(m.type==='name'){this.name=sanitizeName(m.name);return;}
  if(m.type==='join'&&!this.actor){this.joining=PREFIX+m.code;this.connectPeer(this.joining);return;}
  if(m.type==='loaded'&&!this.loaded){this.loaded=true;const own=this.members.find(p=>p.actorNumber===this.actor);if(own)own.ready=true;this.receive({type:'playing'});const host=this.members.find(p=>p.actorNumber===this.master);const c=host&&this.links.get(host.playerId)?.connection;if(c)this.write(c,{type:'loaded'});}
 }
 event(code:number,data:unknown,target?:number){for(const p of this.members){if(target&&p.actorNumber!==target)continue;const c=this.links.get(p.playerId)?.connection;if(c)this.write(c,{type:'event',code,data});}}
 close(){if(this.stopped)return;for(const link of this.links.values())this.write(link.connection,{type:'leave'});this.stopped=true;clearInterval(this.heartbeat);clearTimeout(this.reconnect);for(const link of this.links.values()){clearTimeout(link.timer);link.connection.close();}this.links.clear();this.peer.destroy();}
}
