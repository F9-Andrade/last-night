import type {Simulation} from '../game/simulation.ts';
import type {WorldCheckpoint,PlayerRecord} from '../network/coop-world.ts';
import {serializePlayer,serializeWorld} from './save-codec.ts';
import {CloudError,cloudError} from './cloud-types.ts';
import {SaveService} from './save-service.ts';
import type {AccountBinding} from './save-service.ts';
import {putRecovery,clearRecovery} from './save-recovery.ts';

export interface SaveSource {player:Simulation;world:Simulation;checkpoint?:WorldCheckpoint;confirmed?:PlayerRecord;canSaveWorld:boolean}
export type SaveStatus={kind:'idle'|'dirty'|'saving'|'saved'|'error'|'conflict';message:string;at?:number};
/** Fixed interval + coalesced important events; never invoked by a render frame. */
export class Autosave {
 status:SaveStatus={kind:'dirty',message:'Progresso ainda não salvo'};binding?:AccountBinding;
 private interval:ReturnType<typeof setInterval>;private debounce?:ReturnType<typeof setTimeout>;private inflight?:Promise<boolean>;private generation=0;private savedGeneration=-1;private stopped=false;private conflicted=false;
 readonly service:SaveService;private source:()=>SaveSource;private changed:(status:SaveStatus)=>void;
 constructor(service:SaveService,source:()=>SaveSource,changed:(status:SaveStatus)=>void){this.service=service;this.source=source;this.changed=changed;
  this.interval=setInterval(()=>{this.mark(false);void this.flush();},45000);
 }
 get unsaved(){return this.generation!==this.savedGeneration||!!this.inflight;}
 private statusTo(status:SaveStatus){this.status=status;this.changed(status);}
 mark(important=true){if(this.stopped)return;this.generation++;if(this.status.kind==='saved')this.statusTo({kind:'dirty',message:'Progresso em andamento'});if(important&&!this.debounce&&!this.conflicted)this.debounce=setTimeout(()=>{this.debounce=undefined;void this.flush();},8000);}
 flush():Promise<boolean>{
  if(this.conflicted)return Promise.resolve(false);if(this.inflight)return this.inflight.then(ok=>ok&&this.generation!==this.savedGeneration?this.flush():ok);
  if(this.generation===this.savedGeneration)return Promise.resolve(true);
  const version=this.generation;clearTimeout(this.debounce);this.debounce=undefined;
  this.inflight=this.save(version).finally(()=>{this.inflight=undefined;});return this.inflight;
 }
 private async save(version:number):Promise<boolean>{
  this.statusTo({kind:'saving',message:'Salvando…'});
  try{
   const source=this.source(),player=serializePlayer(source.player,this.service.world.id,this.service.userId,source.confirmed);
   if(this.binding)(player.extra_data as Record<string,unknown>).accountBinding=this.binding;
   const world=source.canSaveWorld?serializeWorld(source.world,source.checkpoint):null;
   const key=`${this.service.userId}:${this.service.world.id}`;
   try{await putRecovery({key,userId:this.service.userId,worldId:this.service.world.id,createdAt:new Date().toISOString(),player,world,revision:this.service.revision,playerStamp:this.service.playerStamp});}catch{/* A disabled/full local store must not prevent cloud saving. */}
   await this.service.player(player);if(world)await this.service.shared(world);
   this.savedGeneration=version;
   try{await clearRecovery(key);}catch{/* Successful cloud requests are authoritative. */}
   this.statusTo({kind:'saved',message:world?'Mundo e sobrevivente salvos':'Sobrevivente salvo · mundo depende do dono',at:Date.now()});return true;
  }catch(error){const e=error instanceof CloudError?error:cloudError(error);this.conflicted=e.kind==='conflict';this.statusTo({kind:this.conflicted?'conflict':'error',message:e.message});return false;}
 }
 resume(){if(!this.stopped)return;this.stopped=false;this.interval=setInterval(()=>{this.mark(false);void this.flush();},45000);}
 stop(){this.stopped=true;clearInterval(this.interval);clearTimeout(this.debounce);}
}
