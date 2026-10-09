import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {Simulation} from '../src/game/simulation.ts';
import {serializeWorld,deserializeWorld,serializePlayer,deserializePlayer,safeSaveJSON} from '../src/services/save-codec.ts';
import {SaveService} from '../src/services/save-service.ts';
import {WorldService} from '../src/services/world-service.ts';
import {cloudConfig} from '../src/services/cloud-config.ts';
import {validUsername,validateRegistration} from '../src/services/auth-validation.ts';
import {placeChest} from '../src/game/chests.ts';
import {createWeapon} from '../src/game/weapons.ts';
import {CoopWorld} from '../src/network/coop-world.ts';
import {parseStart} from '../src/network/protocol.ts';
import {Autosave} from '../src/services/autosave.ts';
import {CloudError} from '../src/services/cloud-types.ts';
import {CoopAccountBridge} from '../src/services/coop-account.ts';
const user='10000000-0000-4000-8000-000000000001',worldId='20000000-0000-4000-8000-000000000002';
const world={id:worldId,owner_id:user,name:'Teste',seed:1977,difficulty:'normal' as const,current_day:1,game_time:8,schema_version:1,is_active:true,created_at:'2026-10-07T12:00:00Z',updated_at:'2026-10-07T12:00:00Z'};

test('world creation waits for the membership trigger before SELECT, using authenticated SDK requests',async()=>{
 const calls:string[]=[],rows=new Map<string,typeof world>();let membership=false;
 const client=createClient('https://example.supabase.co','test-public-key',{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{Authorization:'Bearer test-authenticated-token'},fetch:async(input,init)=>{
   const url=new URL(String(input)),headers=new Headers(init?.headers),method=init?.method??'GET';calls.push(`${method} ${url.pathname}`);
   assert.equal(headers.get('authorization'),'Bearer test-authenticated-token');
   const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
   if(url.pathname==='/auth/v1/user')return response({id:user,role:'authenticated'});
   assert.equal(url.pathname,'/rest/v1/worlds');
   if(method==='POST'){
    // Reproduce the real RLS rejection if the client reintroduces RETURNING.
    if(headers.get('prefer')?.includes('return=representation'))return response({code:'42501',message:'new row violates row-level security policy for table "worlds"'},403);
    const payload=JSON.parse(String(init?.body));assert.equal(payload.owner_id,user);assert.match(payload.id,/^[0-9a-f-]{36}$/);assert.equal(payload.name,'Minha expedição');
    rows.set(payload.id,{...world,...payload});membership=true;return new Response(null,{status:201});
   }
   assert.equal(method,'GET');assert.equal(membership,true);const id=url.searchParams.get('id')?.slice(3);assert.ok(id);assert.ok(rows.has(id));return response(rows.get(id));
  }},
 });
 const created=await new WorldService(client).create('  Minha expedição  ');
 assert.equal(created.owner_id,user);assert.equal(rows.size,1);assert.ok(rows.has(created.id));
 assert.deepEqual(calls,['GET /auth/v1/user','POST /rest/v1/worlds','GET /rest/v1/worlds']);
});

test('a rejected world INSERT stops creation without SELECT or client-side trigger writes',async()=>{
 let writes=0;const failure={code:'42501',message:'new row violates row-level security policy for table "worlds"'};
 const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},from(table:string){assert.equal(table,'worlds');return {insert:async()=>{writes++;return {error:failure};},select(){throw new Error('Must not read a rejected insert');}};}};
 await assert.rejects(()=>new WorldService(client as never).create('Teste'),/acesso/);assert.equal(writes,1);
});

test('save roundtrip preserves real gameplay, classes, chest slots, night, trees and progression',()=>{
 const s=new Simulation();Object.assign(s.player,{hp:74,x:1,z:12,angle:0});s.inventory.items.chest=1;assert.ok(placeChest(s));s.crafting.chests[0].slots[0]={item:'wood',amount:37};
 s.inventory.items.scrap=13;s.gear.armor=42;s.gear.armorTier=1;s.loadout[0]=createWeapon('rifle',91,'rare');s.loadout[0].magazine=4;s.activeSlot=0;s.perks.add('runner');s.reloadTimer=.4;s.cycle.seek('night',14);s.cycle.day=3;s.horde.start(3);s.horde.spawned=4;s.baseHP=752;s.stats.seconds=532;s.discoveredSites.add('church');s.activatedSites.add('church');s.crafting.trees[0].hp=0;s.crafting.trees[0].ready=200;s.nutrition.hunger=44;
 const w=serializeWorld(s),p=serializePlayer(s,worldId,user),r=new Simulation();deserializeWorld(w,r);deserializePlayer(p,r);
 assert.deepEqual(r.inventory.items,s.inventory.items);assert.deepEqual(r.loadout,s.loadout);assert.deepEqual(r.gear,s.gear);assert.deepEqual(r.crafting,s.crafting);assert.deepEqual(r.nutrition,s.nutrition);assert.equal(r.phase,'night');assert.equal(r.day,3);assert.deepEqual(r.horde,s.horde);assert.equal(r.baseHP,752);assert.equal(r.player.hp,74);assert.deepEqual(r.perks,s.perks);assert.deepEqual(r.discoveredSites,s.discoveredSites);assert.deepEqual(r.activatedSites,s.activatedSites);
 assert.equal(typeof r.inventory.add,'function');assert.equal(typeof r.cycle.update,'function');assert.equal(typeof r.director.update,'function');r.inventory.items.scrap++;assert.equal(p.inventory.scrap,13);assert.equal(s.inventory.items.scrap,13);
});
test('corrupt or future world/player saves reject before changing live objects',()=>{
 const s=new Simulation(),w=serializeWorld(s),p=serializePlayer(s,worldId,user),before=JSON.stringify(s.player);
 for(const invalid of [{...w,schema_version:99},{...w,runSeed:5},{...w,extra:{...w.extra,dormant:[{}]}},{...w,checkpoint:{...w.checkpoint,loot:[{}]}}])assert.throws(()=>deserializeWorld(invalid,s));
 for(const invalid of [{...p,health:NaN},{...p,extra_data:{schema_version:99}},{...p,extra_data:{...p.extra_data,record:{}}}])assert.throws(()=>deserializePlayer(invalid,s));assert.equal(JSON.stringify(s.player),before);
 assert.equal(safeSaveJSON(JSON.parse('{"__proto__":{"polluted":true}}')),false);assert.equal(safeSaveJSON({a:Infinity}),false);assert.equal(safeSaveJSON({a:'x'.repeat(4097)}),false);
});
test('shared payload excludes all players, tokens and account identities',()=>{
 const w=new CoopWorld(1977,[1,2]);w.actors.get(2)!.sim.inventory.items.scrap=18;const c=w.checkpoint(),payload=serializeWorld(w.sim,c);assert.deepEqual(payload.checkpoint.players,[]);assert.equal(c.players.length,2);const r=new Simulation();deserializeWorld(payload,r);assert.deepEqual(r.loot,JSON.parse(JSON.stringify(w.sim.loot)));assert.equal(r.runSeed,w.sim.runSeed);
});
test('cloud configuration rejects privileged keys and unsafe URLs; auth validation matches schema',()=>{
 assert.equal(cloudConfig('',''),null);assert.throws(()=>cloudConfig('https://example.supabase.co','sb_secret_123'));assert.throws(()=>cloudConfig('http://example.supabase.co','sb_publishable_123'));assert.ok(cloudConfig('https://example.supabase.co','sb_publishable_123'));
 assert.equal(validUsername('survivor_01'),true);assert.equal(validUsername('a%b'),false);assert.equal(validUsername('ab'),false);assert.throws(()=>validateRegistration({username:'valid',email:'x@y.com',password:'abcdefgh',confirmation:'abcdxxxx'}));
});
test('accept invite uses only the approved authenticated RPC, including legacy codes',async()=>{
 const calls:unknown[]=[];const fake={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {data:worldId,error:null};},from:()=>{throw Error('No direct membership or invite writes');}};
 assert.equal(await new WorldService(fake as never).accept(' legacy_invite '),worldId);assert.deepEqual(calls,[['accept_world_invite',{code:'legacy_invite'}]]);
});
test('optional persistent world metadata validates without changing old room protocol',()=>{
 const old={seed:1977,actors:[1,2],token:'12345678'};assert.deepEqual(parseStart(old,[1,2]),old);assert.ok(parseStart({...old,worldId},[1,2]));assert.equal(parseStart({...old,worldId:'not-a-world'},[1,2]),null);
});

// Small stateful PostgREST fake to exercise actual CAS service behavior; this is
// not evidence of production RLS. Live RLS requires two confirmed test accounts.
function store(){let revision=0,stamp:string|null=null;let next=0;const queries:any[]=[];
 const client={auth:{getSession:async()=>({data:{session:{user:{id:user}}},error:null})},from(table:string){const q:any={table,filters:[],operation:'',payload:null,insert(p:any){this.operation='insert';this.payload=p;return this;},update(p:any){this.operation='update';this.payload=p;return this;},eq(k:string,v:any){this.filters.push([k,v]);return this;},select(){return this;},async maybeSingle(){queries.push(this);if(table==='player_saves'){if(this.operation==='insert'&&stamp!==null)return {data:null,error:{code:'23505'}};if(this.operation==='update'&&!this.filters.some(([k,v]:any)=>k==='updated_at'&&v===stamp))return {data:null,error:null};stamp=`stamp-${++next}`;return {data:{updated_at:stamp},error:null};}if(!this.filters.some(([k,v]:any)=>k==='revision'&&v===revision))return {data:null,error:null};revision=this.payload.revision;return {data:{revision},error:null};},then(resolve:any){resolve({data:[{id:worldId}],error:null});}};return q;}};return {client,queries,get revision(){return revision;}};
}
test('concurrent sessions cannot overwrite world revisions or player stamps',async()=>{
 const db=store(),a=new SaveService(db.client as never,world,user,0,null),b=new SaveService(db.client as never,world,user,0,null),s=new Simulation();
 await a.player(serializePlayer(s,worldId,user));await assert.rejects(()=>b.player(serializePlayer(s,worldId,user)),/Outra sessão/);
 const c=new SaveService(db.client as never,world,user,0,a.playerStamp);await a.player(serializePlayer(s,worldId,user));await assert.rejects(()=>c.player(serializePlayer(s,worldId,user)),/mudou/);
 await a.shared(serializeWorld(s));await assert.rejects(()=>b.shared(serializeWorld(s)),/mudou/);assert.equal(db.revision,1);assert.equal(a.revision,1);
 const member=new SaveService(db.client as never,world,'30000000-0000-4000-8000-000000000003',1,null);await assert.rejects(()=>member.shared(serializeWorld(s)));assert.equal(db.revision,1);
});
test('autosave coalesces concurrent saves and keeps dirty changes arriving in flight',async()=>{
 let count=0,release:()=>void=()=>{};const gate=new Promise<void>(r=>release=r),s=new Simulation(),statuses:string[]=[];
 const service={world,userId:user,revision:0,playerStamp:null,async player(){count++;if(count===1)await gate;},async shared(){}};
 const a=new Autosave(service as never,()=>({player:s,world:s,canSaveWorld:true}),status=>statuses.push(status.kind));
 try{const first=a.flush(),second=a.flush();await new Promise(r=>setTimeout(r,0));assert.equal(count,1);a.mark(false);release();assert.equal(await first,true);assert.equal(await second,true);assert.equal(count,2);assert.equal(a.unsaved,false);assert.equal(statuses.at(-1),'saved');}finally{a.stop();}
});
test('autosave retains errors for retry but never retries a version conflict blindly',async()=>{
 let fail=true,count=0;const s=new Simulation(),service={world,userId:user,revision:0,playerStamp:null,async player(){count++;if(fail)throw new Error('offline');},async shared(){}};
 const a=new Autosave(service as never,()=>({player:s,world:s,canSaveWorld:false}),()=>{});
 try{assert.equal(await a.flush(),false);assert.equal(a.status.kind,'error');assert.equal(a.unsaved,true);fail=false;assert.equal(await a.flush(),true);assert.equal(count,2);service.player=async()=>{count++;throw new CloudError('conflict','Revisão mudou');};a.mark(false);assert.equal(await a.flush(),false);assert.equal(a.status.kind,'conflict');const calls=count;assert.equal(await a.flush(),false);assert.equal(count,calls);}finally{a.stop();}
});
test('world event optional properties and enemy state survive JSON storage',()=>{
 const s=new Simulation();s.zombies=[];s.dormantZombies=[];s.spawn({x:30,z:30},'spitter');s.worldEvent={id:1,kind:'alarm',name:'Alarme',x:50,z:50,life:80,triggered:false,flavor:undefined};
 const z=s.spawn({x:50,z:50},'runner');s.dormantZombies.push({...z,heard:undefined});s.zombies=s.zombies.filter(enemy=>enemy.id!==z.id);
 const payload=serializeWorld(s),restored=new Simulation();deserializeWorld(payload,restored);assert.equal(restored.worldEvent?.kind,'alarm');assert.equal(restored.zombies[0].kind,'spitter');assert.equal(restored.dormantZombies[0].kind,'runner');
});

for(const elapsed of [0,500])test(`host migration rejects duplicate local account ${elapsed?'after the timer':'before the first timer tick'}`,async(t)=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout']});
 const s=new Simulation();s.coins=137;s.inventory.items.scrap=19;
 const token='12345678',binding={userId:user,playerId:'survivor-2',actor:2,token,nonce:'a'.repeat(48)};
 const sent:{actor:number;data:{kind:string;nonce:string}}[]=[],restored:number[]=[];
 const network={localActor:2,masterActor:1,isHost:false,players:[{actorNumber:1,playerId:'survivor-1'},{actorNumber:2,playerId:'survivor-2'}],onAccount:(_data:unknown,_actor:number)=>{},sendAccount(data:any,actor:number){sent.push({actor,data});}};
 const session={local:s,localRecord:{actor:2},owner:{actors:new Map([[2,{sim:s}]])},gateAccounts(){},acceptAccount(){},restoreAccount(actor:number){restored.push(actor);return true;}};
 const service={userId:user,async verifiedPlayer(){return serializePlayer(s,worldId,user);}};
 const bridge=new CoopAccountBridge(network as never,session as never,service as never,{seed:s.runSeed,actors:[1,2],token},binding);
 try{
  const ready=bridge.connect();network.onAccount({kind:'accepted',nonce:binding.nonce},1);await ready;
  network.masterActor=2;network.isHost=true;network.players=[network.players[1],{actorNumber:3,playerId:'survivor-3'}];
  if(elapsed)t.mock.timers.tick(elapsed);
  network.onAccount({kind:'account',binding:{...binding,actor:3,playerId:'survivor-3',nonce:'b'.repeat(48)}},3);
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(sent,[{actor:3,data:{kind:'refused',nonce:'b'.repeat(48)}}]);
  assert.deepEqual(restored,[],'duplicate login cannot restore a second inventory or wallet');
  assert.equal(s.coins,137);assert.equal(s.inventory.items.scrap,19);
 }finally{bridge.dispose();}
});

async function migratingAccounts(t:any){
 t.mock.timers.enable({apis:['setInterval','setTimeout']});
 const s=new Simulation(),other='30000000-0000-4000-8000-000000000003',newUser='40000000-0000-4000-8000-000000000004';
 s.coins=137;s.inventory.items.scrap=19;
 const token='12345678',binding={userId:user,playerId:'survivor-2',actor:2,token,nonce:'a'.repeat(48)};
 const sent:{actor:number;data:{kind:string;nonce:string}}[]=[],restored:number[]=[],verified:number[]=[];
 const actors=new Map([[2,{sim:s}],[3,{sim:new Simulation()}]]);actors.get(3)!.sim.coins=72;
 const network={localActor:2,masterActor:1,isHost:false,players:[1,2,3].map(actorNumber=>({actorNumber,playerId:`survivor-${actorNumber}`})),onAccount:(_data:unknown,_actor:number)=>{},sendAccount(data:any,actor:number){sent.push({actor,data});}};
 const session={local:s,localRecord:{actor:2},owner:undefined as {actors:typeof actors}|undefined,gateAccounts(){},acceptAccount(){},restoreAccount(actor:number){restored.push(actor);actors.set(actor,{sim:new Simulation()});return true;}};
 const service={userId:user,async verifiedPlayer(proof:any){verified.push(proof.actor);return serializePlayer(s,worldId,proof.userId);}};
 const bridge=new CoopAccountBridge(network as never,session as never,service as never,{seed:s.runSeed,actors:[1,2,3],token},binding);
 const ready=bridge.connect();network.onAccount({kind:'accepted',nonce:binding.nonce},1);await ready;
 network.masterActor=2;network.isHost=true;network.players=[2,3,4].map(actorNumber=>({actorNumber,playerId:`survivor-${actorNumber}`}));
 const prove=async(actor:number,userId:string)=>{network.onAccount({kind:'account',binding:{userId,actor,playerId:`survivor-${actor}`,token,nonce:String(actor).repeat(48)}},actor);await Promise.resolve();await Promise.resolve();};
 return {s,other,newUser,sent,restored,verified,actors,network,session,service,bridge,prove};
}
test('migrated host defers newcomers until restored guests prove accounts without restoring their wallets',async(t)=>{
 const f=await migratingAccounts(t);
 try{
  await f.prove(4,f.other);assert.deepEqual(f.verified,[],'owner must exist before any account is admitted');
  f.session.owner={actors:f.actors};await f.prove(4,f.other);assert.deepEqual(f.sent,[],'new client retries silently while a restored guest is unverified');
  assert.deepEqual(f.verified,[]);
  await f.prove(3,f.other);assert.equal(f.sent.at(-1)?.data.kind,'accepted');assert.deepEqual(f.restored,[]);assert.equal(f.actors.get(3)!.sim.coins,72);
  await f.prove(4,f.other);assert.equal(f.sent.at(-1)?.data.kind,'refused');assert.deepEqual(f.restored,[]);
  await f.prove(4,f.newUser);assert.equal(f.sent.at(-1)?.data.kind,'accepted');assert.deepEqual(f.restored,[4]);assert.equal(f.s.coins,137);
 }finally{f.bridge.dispose();}
});
test('a departed unverified actor no longer blocks a new account after migration',async(t)=>{
 const f=await migratingAccounts(t);
 try{
  f.session.owner={actors:f.actors};await f.prove(4,f.newUser);assert.deepEqual(f.sent,[]);
  f.network.players=f.network.players.filter(p=>p.actorNumber!==3);
  await f.prove(4,f.newUser);assert.equal(f.sent.at(-1)?.data.kind,'accepted');assert.deepEqual(f.restored,[4]);
 }finally{f.bridge.dispose();}
});
test('account verification rechecks restored identities and leadership after awaiting Supabase',async(t)=>{
 const f=await migratingAccounts(t);
 try{
  f.session.owner={actors:f.actors};await f.prove(3,f.other);f.sent.length=0;
  let release:()=>void=()=>{};const query=new Promise<void>(resolve=>release=resolve);
  f.service.verifiedPlayer=async proof=>{await query;return serializePlayer(f.s,worldId,proof.userId);};
  const pending=f.prove(4,f.newUser);f.network.masterActor=3;f.network.isHost=false;release();await pending;await Promise.resolve();
  assert.deepEqual(f.sent,[]);assert.deepEqual(f.restored,[],'former host cannot restore wallets after a delayed proof');
 }finally{f.bridge.dispose();}
});

test('delegated shared saves use authenticated RPC and never bypass conflicts with a blind retry',async()=>{
 const delegate='30000000-0000-4000-8000-000000000003',calls:any[]=[],payload=serializeWorld(new Simulation());let error:any=null;
 const client={auth:{getSession:async()=>({data:{session:{user:{id:delegate}}}})},async rpc(name:string,args:any){calls.push({name,args});return {data:error?null:7,error};},from(){throw new Error('No direct delegate writes allowed');}};
 const service=new SaveService(client as never,world,delegate,2,null);service.hostingEnabled=true;service.sessionToken='12345678';
 await service.shared(payload);assert.equal(service.revision,7);assert.equal(calls[0].name,'save_hosted_world');assert.equal(calls[0].args.p_expected_revision,2);assert.equal(calls[0].args.p_session_token,'12345678');assert.equal(calls[0].args.p_world_id,worldId);
 error={code:'40001'};await assert.rejects(()=>service.shared(payload),e=>e instanceof CloudError&&e.kind==='conflict');assert.equal(service.revision,7);assert.equal(calls.length,2);
 error={code:'42501'};await assert.rejects(()=>service.shared(payload),e=>e instanceof CloudError&&e.kind==='access');assert.equal(service.revision,7);
});

test('without hosting migration, delegated saves remain denied and owner writes remain compatible',async()=>{
 const delegate='30000000-0000-4000-8000-000000000003';const client={auth:{getSession:async()=>({data:{session:{user:{id:delegate}}}})},from(){throw new Error('Unauthorized write');}};
 const service=new SaveService(client as never,world,delegate,0,null);await assert.rejects(()=>service.shared(serializeWorld(new Simulation())),e=>e instanceof CloudError&&e.kind==='access');
});
