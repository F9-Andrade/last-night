import {createPatch,applyPatch} from './world-patch.ts';
import {Simulation} from '../game/simulation.ts';
import type {InputCommand} from '../game/simulation.ts';
import {floorHeight,distance} from '../game/world.ts';
import type {Item} from '../game/inventory.ts';
import {WEAPONS} from '../game/weapons.ts';
import {NetworkManager} from './manager';
import {CoopWorld} from './coop-world.ts';
import type {WorldCheckpoint,SessionEffect} from './coop-world.ts';
import {parseCheckpoint,stateHash} from './checkpoint.ts';
import {COOP,GameplayEvent,parseAction,poseOf,shotSeed,boundedJSON} from './gameplay-protocol.ts';
import type {ActionRequest} from './gameplay-protocol.ts';
import {entityId} from './entities.ts';
import type {StartData,RemotePlayerState} from './protocol.ts';
import {SnapshotBudget} from './rate-limit.ts';
type RequestDetails=ActionRequest extends infer T?T extends ActionRequest?Omit<T,'seq'|'pose'>:never:never;
interface EnemyFrame {time:number;x:number;z:number;angle:number;gait:number}
export class CoopSession {
 owner?:CoopWorld;checkpoint?:WorldCheckpoint;effects:SessionEffect[]=[];error='';lastSnapshotAt=0;
 private published?:WorldCheckpoint;private lastRecovery=-10000;
 private sequence=0;private reconciliationSeq=0;private shot=0;private master=0;private clock=0;private stateClock=0;private motionClock=0;private holdClock=0;private held=false;private dirty=true;private offset:number|null=null;
 private motionFrames=new Map<number,EnemyFrame[]>();private motionLast=new Map<number,number>();private lastMotionSent=new Map<number,number>();private budgets=new Map<number,SnapshotBudget>();private pending:ActionRequest[]=[];
 readonly confirmed:SessionEffect[]=[];
 readonly metrics={dropped:0,checkpoints:0,motionBatches:0,hash:'',snapshotBytes:0,migrations:0};
 constructor(readonly network:NetworkManager,readonly local:Simulation,private start:StartData){
  local.foundationMode=false;local.coopMode='replica';local.zombies=[];local.dormantZombies=[];
  local.onBeforeShot=()=>{const seed=shotSeed(network.localActor,++this.shot);local.seed=seed;this.enqueue({kind:'fire',shot:this.shot,weapon:local.equipped.type,seed,ads:local.player.ads,bloom:local.player.bloom,kick:local.player.aimKick});};
  network.onGameplay=(code,data,actor)=>this.receive(code,data,actor);network.onTick=dt=>this.tick(dt);
  this.master=network.masterActor;if(network.isHost)this.owner=new CoopWorld(start.seed,start.actors);
 }
 get localRecord(){return this.checkpoint?.players.find(p=>p.actor===this.network.localActor);}
 get incapacitated(){return !!this.localRecord&&this.localRecord.life!=='alive';}
 get ready(){return !!this.checkpoint&&!this.error;}
 private enqueue(details:RequestDetails){const pose=poseOf(this.local.player,floorHeight(this.local.player),performance.now());const request={...details,seq:++this.sequence,pose} as ActionRequest;if(details.kind!=='hold')this.reconciliationSeq=request.seq;this.pending.push(request);}
 action(details:RequestDetails){if(!this.incapacitated&&this.ready)this.enqueue(details);}
 inventory(operation:'deposit'|'withdraw'|'discard',item:Item){this.action({kind:'inventory',operation,item});}
 beforeStep(dt:number,input:InputCommand):InputCommand {
  this.holdClock+=dt;
  if(this.error||!this.ready||this.incapacitated)return {...input,moveX:0,moveZ:0,fire:false,trigger:false,reload:false,interact:false,heldInteract:false,heal:false,run:false,slot:undefined};
  if(input.reload)this.enqueue({kind:'reload'});if(input.slot!==undefined)this.enqueue({kind:'switch',slot:input.slot});if(input.heal)this.enqueue({kind:'heal'});
  const target=this.reviveTarget();const held=!!input.heldInteract;
  if(held!==this.held||this.holdClock>=.1){this.held=held;this.holdClock=0;this.enqueue({kind:'hold',target:target?.actor??0,held});}
  if(input.interact&&!target){const f=this.local.focus;if(f&&['loot','portal','weapon','facility'].includes(f.kind))this.enqueue({kind:'interact',target:entityId(f.kind==='loot'||f.kind==='facility'?'container':f.kind==='portal'?'door':'weapon',f.id)});}
  return {...input,interact:false,heldInteract:false,heal:false,dismantle:false};
 }
 afterStep(){for(const request of this.pending.splice(0)){if(this.owner){this.owner.setPose(this.network.localActor,request.pose);this.owner.request(this.network.localActor,request);if(request.kind!=='hold')this.dirty=true;}else this.network.sendGameplay(GameplayEvent.ActionRequest,request,this.network.masterActor);}}
 reviveTarget(){return this.checkpoint?.players.find(p=>p.actor!==this.network.localActor&&p.life==='downed'&&distance(p.player,this.local.player)<=COOP.reviveRange);}
 private tick(dt:number){
  if(this.network.state!=='playing')return;
  if(this.master!==this.network.masterActor){this.master=this.network.masterActor;this.owner=undefined;this.published=undefined;this.motionLast.clear();this.lastMotionSent.clear();this.budgets.clear();this.metrics.migrations++;
   if(!this.checkpoint){this.error='A sessão não possui um estado recuperável. Volte ao menu e crie outra sala.';return;}
   if(this.network.isHost){this.owner=CoopWorld.restore(this.start.seed,this.checkpoint,this.network.players.map(p=>p.actorNumber));this.dirty=true;this.stateClock=COOP.checkpointInterval;}
  }
  if(!this.owner)return;
  this.owner.setMembers(this.network.players.map(p=>p.actorNumber));
  for(const [actor,pose] of this.network.poses)this.owner.setPose(actor,pose);
  this.clock+=dt;let steps=0;while(this.clock>=1/60&&steps++<15){this.owner.step(1/60);this.clock-=1/60;}
  this.stateClock+=dt;this.motionClock+=dt;
  const effects=this.owner.effects.splice(0);
  if(effects.some(e=>['death','hurt','pickup','healed','door','glass','switch'].includes(e.event.type)))this.dirty=true;
  if(this.dirty||this.stateClock>=COOP.checkpointInterval){this.publish();this.dirty=false;this.stateClock=0;}
  if(effects.length){for(let i=0;i<effects.length;i+=80){const batch=effects.slice(i,i+80);this.acceptEffects(batch);this.network.sendGameplay(GameplayEvent.Effects,batch);}}
  if(this.motionClock>=.1){this.motionClock=0;const rows:number[][]=[];for(const z of this.owner.sim.zombies){if(!z.active)continue;const near=Math.min(...[...this.owner.actors.values()].map(a=>distance(z,a.sim.player)));const rate=near<COOP.nearDistance?COOP.nearRate:near<COOP.midDistance?COOP.midRate:COOP.farRate;
    if(this.owner.time-(this.lastMotionSent.get(z.id)??-10)<1/rate-.01)continue;this.lastMotionSent.set(z.id,this.owner.time);rows.push([z.id,z.x,z.z,z.angle,z.gait,z.attack,z.flash,z.reaction,z.windup,z.winding?1:0,z.screamTimer??0]);}
   const data={time:this.owner.time,rows};this.motion(data);this.network.sendGameplay(GameplayEvent.InfectedMotion,data);
  }
 }
 private publish(){if(!this.owner)return;const c=this.owner.checkpoint();this.metrics.snapshotBytes=JSON.stringify(c).length;const previous=this.published;this.apply(c);this.network.sendGameplay(previous?GameplayEvent.WorldPatch:GameplayEvent.WorldCheckpoint,previous?createPatch(previous,c):c);this.published=c;}
 private receive(code:number,data:unknown,actor:number){
  if(code===GameplayEvent.RecoveryRequest){if(this.owner&&performance.now()-this.lastRecovery>1000){this.lastRecovery=performance.now();this.network.sendGameplay(GameplayEvent.WorldCheckpoint,this.checkpoint,actor);}return;}
  if(code===GameplayEvent.ActionRequest){if(!this.owner||!this.network.isHost)return;let b=this.budgets.get(actor);if(!b){b=new SnapshotBudget();this.budgets.set(actor,b);}const r=b.take(performance.now())?parseAction(data):null;if(!r){this.metrics.dropped++;return;}this.owner.request(actor,r);if(r.kind!=='hold')this.dirty=true;return;}
  if(actor!==this.network.masterActor){this.metrics.dropped++;return;}
  if(code===GameplayEvent.WorldPatch){const c=this.checkpoint?applyPatch(this.checkpoint,data):null;if(c)this.apply(c);else {this.metrics.dropped++;if(performance.now()-this.lastRecovery>1000){this.lastRecovery=performance.now();this.network.sendGameplay(GameplayEvent.RecoveryRequest,{},this.network.masterActor);}}}
  if(code===GameplayEvent.WorldCheckpoint){const c=parseCheckpoint(data);if(!c||c.revision<=(this.checkpoint?.revision??0)){this.metrics.dropped++;return;}this.apply(c);}
  if(code===GameplayEvent.InfectedMotion)this.motion(data);
  if(code===GameplayEvent.Effects){if(!Array.isArray(data)||data.length>80||!boundedJSON(data,6000)){this.metrics.dropped++;return;}const allowed=['shot','hit','death','hurt','pickup','healed','heal','search','reload','reload-out','reload-in','reload-slide','reload-done','empty','switch','rare-pickup','door','glass','spit','spit-ready','scream','scream-ready','enemy-call','enemy-attack','heavy-step','notice','barricade-hit','barricade-break'];
   const effects=data.filter((v):v is SessionEffect=>{if(!v||typeof v!=='object'||!Number.isInteger(v.actor)||!Number.isInteger(v.shot)||!v.event||!allowed.includes(v.event.type))return false;const e=v.event;if(e.type==='notice')return typeof e.text==='string'&&typeof e.sub==='string';if(e.weapon!==undefined&&!Object.hasOwn(WEAPONS,e.weapon))return false;const pos=(p:unknown)=>!!p&&typeof p==='object'&&Number.isFinite((p as {x:number}).x)&&Number.isFinite((p as {z:number}).z);if(e.type==='shot')return pos(e.from)&&pos(e.to)&&Number.isFinite(e.y)&&typeof e.hit==='boolean';if(['hit','death','door','glass','spit','spit-ready','scream','scream-ready','enemy-call','enemy-attack','heavy-step'].includes(e.type))return pos(e.position);return true;});this.acceptEffects(effects);
  }
 }
 private acceptEffects(effects:SessionEffect[]){this.confirmed.push(...effects);if(this.confirmed.length>128)this.confirmed.splice(0,this.confirmed.length-128);for(const e of effects){if(e.actor===this.network.localActor&&['shot','reload','reload-out','reload-in','reload-slide','reload-done','empty','switch'].includes(e.event.type))continue;this.effects.push(e);}if(this.effects.length>240)this.effects.splice(0,this.effects.length-240);}
 private apply(c:WorldCheckpoint){
  this.checkpoint=c;this.lastSnapshotAt=performance.now();this.metrics.checkpoints++;this.metrics.hash=stateHash(c);
  const sim=this.local;sim.loot=structuredClone(c.loot);sim.groundWeapons=structuredClone(c.ground);sim.corpses.bodies=structuredClone(c.corpses);sim.acids=structuredClone(c.acids);
  for(const f of c.facilities){const local=sim.facilities.find(v=>v.id===f.id);if(local)local.state=f.state;}
  for(const p of c.portals){const door=sim.portals.find(d=>d.id===p.id);if(door)Object.assign(door,p);}
  const old=new Map(sim.zombies.map(z=>[z.id,z]));sim.zombies=c.infected.map(z=>{const previous=old.get(z.id);return {...structuredClone(z),x:previous?.x??z.x,z:previous?.z??z.z,angle:previous?.angle??z.angle,path:z.awareness==='idle'?[]:[{x:z.x,z:z.z}]};});
  for(const id of this.motionFrames.keys())if(!sim.zombies.some(z=>z.id===id))this.motionFrames.delete(id);
  // Checkpoints also establish poses for newly spawned entities and recovery.
  for(const z of c.infected)this.pushFrame(z.id,c.time,z.x,z.z,z.angle,z.gait);
  const local=this.localRecord;if(local){sim.player.hp=local.player.hp;sim.player.invulnerable=local.player.invulnerable;sim.action=structuredClone(local.action);
   if(local.lastSeq>=this.reconciliationSeq){sim.inventory.items={...local.inventory};sim.storage.items={...local.storage};sim.loadout=structuredClone(local.loadout);sim.activeSlot=local.activeSlot;sim.reloadTimer=local.reloadTimer;sim.reloadDuration=local.reloadDuration;sim.switchTimer=local.switchTimer;sim.weaponStorage=structuredClone(local.weaponStorage);}
   if(local.life!=='alive'){sim.player.eyeY=floorHeight(sim.player)+.6;sim.player.moving=false;sim.player.running=false;sim.action=null;sim.cancelReload();}
  }sim.gameOver=c.wipe;
 }
 private pushFrame(id:number,time:number,x:number,z:number,angle:number,gait:number){
  if(time<=(this.motionLast.get(id)??-1))return;this.motionLast.set(id,time);const now=performance.now();this.offset=this.offset===null?now-time*1000:this.offset+Math.max(-2,Math.min(2,now-time*1000-this.offset))*.1;
  let frames=this.motionFrames.get(id)??[];const last=frames.at(-1);if(last&&Math.hypot(last.x-x,last.z-z)>8)frames=[];frames.push({time:time*1000+this.offset,x,z,angle,gait});if(frames.length>24)frames.shift();this.motionFrames.set(id,frames);
 }
 private motion(data:unknown){if(!data||typeof data!=='object')return;const d=data as {time:number;rows:number[][]};if(!Number.isFinite(d.time)||!Array.isArray(d.rows)||d.rows.length>COOP.maxEntities)return;
  for(const row of d.rows){if(!Array.isArray(row)||row.length!==11||row.some(n=>!Number.isFinite(n))||!Number.isInteger(row[0])||Math.abs(row[1])>157||Math.abs(row[2])>157)continue;const [id,x,z,angle,gait,attack,flash,reaction,windup,winding,screamTimer]=row;const enemy=this.local.zombies.find(z=>z.id===id);if(!enemy)continue;this.pushFrame(id,d.time,x,z,angle,gait);Object.assign(enemy,{attack,flash,reaction,windup,winding:!!winding,screamTimer});}this.metrics.motionBatches++;
 }
 render(now=performance.now()){
  const age=this.lastSnapshotAt?Math.min(.6,(now-this.lastSnapshotAt)/1000):0;
  for(const a of this.local.acids){const base=this.checkpoint?.acids.find(v=>v.id===a.id);if(base)a.age=base.age+age;}
  for(const c of this.local.corpses.bodies){const base=this.checkpoint?.corpses.find(v=>v.id===c.id);if(base)c.age=base.age+age;}
  for(const z of this.local.zombies){const frames=this.motionFrames.get(z.id);if(!frames?.length)continue;const target=now-COOP.enemyDelay;while(frames.length>2&&frames[1].time<target)frames.shift();const a=frames[0],b=frames[1]??a,t=Math.max(0,Math.min(1,(target-a.time)/Math.max(1,b.time-a.time)));z.x=a.x+(b.x-a.x)*t;z.z=a.z+(b.z-a.z)*t;z.angle=a.angle+Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle))*t;z.gait=a.gait+(b.gait-a.gait)*t;}
  if(this.incapacitated)this.local.player.eyeY=floorHeight(this.local.player)+.6;
 }
 decorate(states:RemotePlayerState[]){return states.map(s=>{const p=this.checkpoint?.players.find(p=>p.actor===s.identity.actorNumber);return {...s,gameplay:p?{life:p.life,hp:p.player.hp,weapon:p.loadout[p.activeSlot]!.type,reload:p.reloadTimer,reloadDuration:p.reloadDuration}:undefined};});}
 dispose(){this.network.onGameplay=()=>{};this.network.onTick=()=>{};this.local.onBeforeShot=undefined;this.effects=[];this.pending=[];this.owner=undefined;this.motionFrames.clear();}
 debug(){return {...this.metrics,gameplay:{...this.network.gameplayMetrics},confirmed:this.confirmed,actor:this.network.localActor,master:this.master,snapshotAge:this.lastSnapshotAt?performance.now()-this.lastSnapshotAt:null,entities:this.owner?.registry.size??(this.checkpoint?this.checkpoint.infected.length+this.checkpoint.loot.length+this.checkpoint.portals.length:0),infected:this.checkpoint?.infected.length??0,revision:this.checkpoint?.revision??0,players:this.checkpoint?.players,error:this.error};}
}
