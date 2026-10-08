import type {NetworkManager} from '../network/manager';
import type {CoopSession} from '../network/coop-session';
import type {PlayerRecord} from '../network/coop-world';
import type {StartData} from '../network/protocol';
import {Simulation} from '../game/simulation.ts';
import {deserializePlayer,playerRecord} from './save-codec.ts';
import type {SaveService,AccountBinding} from './save-service';

/** Proof is a nonce written under player_saves' existing own-user RLS.
 * No Supabase credential is ever sent over either game transport. */
export class CoopAccountBridge {
 private stopped=false;private timer?:ReturnType<typeof setInterval>;private pending=new Set<number>();
 private admitted=new Map<number,string>();private accepted=false;private master:number;
 private proofs=new Map<number,string>();
 private resolve?:()=>void;private reject?:(error:Error)=>void;
 private deadline?:ReturnType<typeof setTimeout>;private lastHello=0;
 private network:NetworkManager;private session:CoopSession;private service:SaveService;private start:StartData;private binding:AccountBinding;private initial?:PlayerRecord;
 constructor(network:NetworkManager,session:CoopSession,service:SaveService,start:StartData,binding:AccountBinding,initial?:PlayerRecord){
  this.network=network;this.session=session;this.service=service;this.start=start;this.binding=binding;this.initial=initial;
  this.master=network.masterActor;
  network.onAccount=(data,actor)=>void this.receive(data,actor);
 }
 async connect():Promise<void>{
  this.session.gateAccounts();
  if(this.network.isHost){
   const record=this.initial?structuredClone(this.initial):playerRecord(this.session.local,this.network.localActor);record.actor=this.network.localActor;
   this.session.restoreAccount(this.network.localActor,record);this.session.acceptAccount();this.accepted=true;this.admitted.set(this.network.localActor,this.service.userId);
  }
  const ready=this.accepted?Promise.resolve():new Promise<void>((resolve,reject)=>{this.resolve=resolve;this.reject=reject;this.deadline=setTimeout(()=>reject(new Error('Não foi possível validar sua conta com o líder. Confira seu acesso ao mundo e tente novamente.')),45000);});
  this.timer=setInterval(()=>{
   if(this.stopped)return;
   this.reconcileMaster();
   if(!this.network.isHost&&Date.now()-this.lastHello>(this.accepted?10000:1000)){this.lastHello=Date.now();this.network.sendAccount({kind:'account',binding:this.binding},this.network.masterActor);}
  },500);
  return ready;
 }
 private reconcileMaster(){
  if(this.master===this.network.masterActor)return;
  this.master=this.network.masterActor;this.admitted.clear();this.proofs.clear();this.lastHello=0;
  // The promoted host already owns its live wallet/inventory. Reserve that
  // identity before any newcomer can restore the same account into another actor.
  if(this.network.isHost)this.admitted.set(this.network.localActor,this.service.userId);
 }
 private awaitingExistingAccounts(actor:number){
  const actors=this.session.owner?.actors;if(!actors)return true;
  if(actors.has(actor))return false;
  // Wait for restored, still-connected actors to prove their identities before
  // loading another wallet. Their live inventories remain playable meanwhile.
  return [...actors.keys()].some(other=>!this.admitted.has(other)&&this.network.players.some(p=>p.actorNumber===other));
 }
 private async receive(value:unknown,actor:number){
  if(this.stopped||!value||typeof value!=='object')return;this.reconcileMaster();const data=value as {kind?:string;binding?:AccountBinding;nonce?:string;message?:string};
  if(data.kind==='accepted'&&actor===this.network.masterActor&&data.nonce===this.binding.nonce){
   if(!this.session.localRecord)return;this.session.acceptAccount();this.accepted=true;clearTimeout(this.deadline);this.resolve?.();this.resolve=undefined;return;
  }
  if(data.kind==='refused'&&actor===this.network.masterActor&&data.nonce===this.binding.nonce&&!this.accepted){this.reject?.(new Error('Sua conta não pôde entrar neste mundo. Confira o convite e tente novamente.'));return;}
  if(data.kind!=='account'||!this.network.isHost||!data.binding||this.pending.has(actor))return;
  const binding=data.binding,peer=this.network.players.find(p=>p.actorNumber===actor);
  if(!peer||binding.actor!==actor||binding.playerId!==peer.playerId||binding.token!==this.start.token)return;
  if(this.awaitingExistingAccounts(actor))return;
  if(this.admitted.get(actor)===binding.userId&&this.proofs.get(actor)===binding.nonce){this.network.sendAccount({kind:'accepted',nonce:binding.nonce},actor);return;}
  const validatingMaster=this.master;this.pending.add(actor);
  try{
   const saved=await this.service.verifiedPlayer(binding);
   this.reconcileMaster();
   if(this.stopped||!this.network.isHost||this.master!==validatingMaster||!this.network.players.some(p=>p.actorNumber===actor&&p.playerId===binding.playerId)||this.awaitingExistingAccounts(actor))return;
   for(const [other,userId] of this.admitted)if(other!==actor&&userId===binding.userId&&this.network.players.some(p=>p.actorNumber===other))throw new Error('Conta já conectada.');
   // A migrated host already has live actors in its checkpoint. Never restore
   // old database state over those authoritative inventories or life states.
   if(!this.admitted.has(actor)&&!this.session.owner?.actors.has(actor)){
    const candidate=new Simulation(undefined,this.start.seed),record=deserializePlayer(saved,candidate);record.actor=actor;
    if(!this.session.restoreAccount(actor,record))return;
   }
   this.admitted.set(actor,binding.userId);this.proofs.set(actor,binding.nonce);
   this.network.sendAccount({kind:'accepted',nonce:binding.nonce},actor);
  }catch{if(!this.stopped)this.network.sendAccount({kind:'refused',nonce:binding.nonce},actor);}
  finally{this.pending.delete(actor);}
 }
 dispose(){this.stopped=true;clearInterval(this.timer);clearTimeout(this.deadline);this.network.onAccount=()=>{};this.reject?.(new Error('Conexão encerrada.'));this.reject=undefined;this.resolve=undefined;}
}
