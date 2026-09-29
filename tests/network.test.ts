import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCode,validCode,normalizeCode,roomRegion,sanitizeName,validName,parseSnapshot,encodeSnapshot,parseStart,spawnFor,canStart,REGIONS} from '../src/network/protocol.ts';
import type {PlayerSnapshot,NetworkPlayerIdentity} from '../src/network/protocol.ts';
import {InterpolationBuffer} from '../src/network/interpolation.ts';
const sample=(sequence=0,time=0,x=0):PlayerSnapshot=>({sequence,time,x,y:0,z:0,yaw:0,pitch:0,vx:4,vz:0,locomotion:1});
const player=(actorNumber:number,isHost=false,ready=false):NetworkPlayerIdentity=>({actorNumber,isHost,ready,isLocal:isHost,playerId:String(actorNumber),displayName:'Player'});
test('room codes route every supported region and exclude ambiguous characters',()=>{for(const region of Object.values(REGIONS)){for(let i=0;i<50;i++){const code=generateCode(region);assert.equal(code.length,6);assert.ok(validCode(code));assert.equal(roomRegion(code),region);assert.ok(!/[ILO01]/.test(code));}}assert.equal(normalizeCode('  n7pk4x  '),'N7PK4X');for(const bad of ['','ABC','N00000','IIIIII','ZZZZZZ','NABCDE<script>','n7pk4x'])assert.equal(validCode(bad),false);});
test('names strip markup/control characters, preserve accents, bound Unicode length',()=>{assert.equal(sanitizeName('  João   da Luz!\n'),'João da Luz');assert.equal(sanitizeName('<script>alert(1)</script>'),'scriptalert1script');assert.equal(sanitizeName(null),'');assert.equal(sanitizeName('a'.repeat(40)).length,20);assert.equal(validName('A'),false);assert.equal(validName('Ana'),true);});
test('host readiness and stable distinct spawns',()=>{assert.ok(canStart([player(1,true)],1));assert.ok(!canStart([player(1,true),player(2)],1));assert.ok(canStart([player(1,true),player(2,false,true)],1));assert.ok(!canStart([player(1,true),player(2,false,true)],2));assert.ok(!canStart([],1));const actors=[4,7,2,9];assert.equal(new Set(actors.map(a=>JSON.stringify(spawnFor(actors,a)))).size,4);assert.deepEqual(spawnFor(actors,2),spawnFor([...actors].reverse(),2));assert.throws(()=>spawnFor(actors,1));});
test('snapshot quantization and hostile payload rejection',()=>{const s=sample();s.x=1.2345;assert.equal(parseSnapshot(encodeSnapshot(s))?.x,1.23);for(const bad of [null,{},'payload',[],new Array(10000).fill(1),[1,0,0,0,0,0,0,0,0,0,0,'x']])assert.equal(parseSnapshot(bad),null);for(const [index,value] of [[0,99],[1,-1],[1,.5],[2,NaN],[3,158],[4,13],[5,-158],[6,4],[7,2],[8,13],[10,4]]){const data=encodeSnapshot(s);data[index]=value;assert.equal(parseSnapshot(data),null);}});
test('start requires bounded token, seed and exact unique membership',()=>{const good={seed:123,actors:[1,3],token:'abcdefgh'};assert.deepEqual(parseStart(good,[3,1]),good);for(const bad of [{...good,actors:[1,1]},{...good,actors:[1,2]},{...good,actors:[]},{...good,seed:-1},{...good,seed:2**32},{...good,token:'x'.repeat(100)},null])assert.equal(parseStart(bad,[1,3]),null);});
test('interpolation rejects duplicates/backwards clocks and bounds memory and extrapolation',()=>{const b=new InterpolationBuffer();assert.equal(b.sample(0),null);assert.ok(b.push(sample(0,0),100));assert.ok(!b.push(sample(0,1),101));assert.ok(b.push(sample(1,50,.2),150));assert.ok(!b.push(sample(2,49),151));assert.ok(Math.abs(b.sample(245)!.x-.1)<.001);assert.ok(b.sample(10000)!.x<=.61);assert.equal(b.sample(10000)!.locomotion,0);for(let i=2;i<200;i++)b.push(sample(i,i*50,i*.2),i*50+100);assert.ok(b.size<=32);b.clear();assert.equal(b.size,0);assert.ok(b.push(sample(0,0),0));});
test('rotation crosses ±pi by the shortest arc and teleports reset history',()=>{const b=new InterpolationBuffer();b.push({...sample(0,0),yaw:Math.PI-.1},0);b.push({...sample(1,50,.2),yaw:-Math.PI+.1},50);assert.ok(Math.abs(Math.abs(b.sample(145)!.yaw)-Math.PI)<.01);b.push(sample(2,100,30),100);assert.equal(b.size,1);assert.equal(b.sample(120)!.x,30);});
test('50–200ms simulated delay with jitter keeps movement bounded and monotonic',()=>{for(const latency of [50,100,150,200]){const b=new InterpolationBuffer();let seq=0,previous=-Infinity;for(let now=0;now<5000;now+=10){if(now%50===0){const sent=now-latency;if(sent>=0){const jitter=[0,12,-9,20,-5][seq%5];b.push(sample(seq++,sent,sent*.004),now+jitter);}}const s=b.sample(now);if(s){assert.ok(Number.isFinite(s.x));assert.ok(s.x>=previous-.03);assert.ok(s.x<=Math.max(0,now-latency)*.004+.41);previous=s.x;}}assert.ok(b.size<=32);}});

test('receive budget accepts delayed batches and rejects sustained flooding',async()=>{const {SnapshotBudget}=await import('../src/network/rate-limit.ts');const b=new SnapshotBudget();for(let i=0;i<40;i++)assert.ok(b.take(100));assert.ok(!b.take(100));assert.ok(b.take(150));assert.ok(!b.take(150));for(let i=1;i<=50;i++)assert.ok(b.take(150+i*50));});
test('foundation keeps movement and excludes unsynchronized gameplay',async()=>{const {Simulation}=await import('../src/game/simulation.ts');const {collides}=await import('../src/game/world.ts');const sim=new Simulation(undefined,123);sim.foundationMode=true;sim.firstPerson=true;sim.zombies=[];sim.dormantZombies=[];const ammo=sim.ammo,cycle=sim.cycle.elapsed;for(const p of [1,2,3,4])assert.equal(collides(spawnFor([1,2,3,4],p),.4),false);for(let i=0;i<120;i++)sim.update(1/60,{moveX:0,moveZ:.3,aimX:0,aimZ:1,fire:true,trigger:true,run:false,reload:true,interact:true,heal:true});assert.equal(sim.ammo,ammo);assert.equal(sim.cycle.elapsed,cycle);assert.equal(sim.zombies.length,0);assert.equal(sim.action,null);assert.notEqual(sim.player.z,7);});

// Render-cadence regressions: sparse infected packets must not freeze between updates.
import {EnemyInterpolation,EnemyClock} from '../src/network/enemy-interpolation.ts';
const enemyPose=(time:number)=>({x:time/1000,z:0,angle:0,gait:time/250});
for(const interval of [100,300,500])test(`infected presentation stays continuous at 60 Hz with ${interval} ms packets`,()=>{
 const buffer=new EnemyInterpolation(),out=enemyPose(0);let next=0,previous=0,stalls=0,samples=0;
 for(let now=0;now<8000;now+=1000/60){
  if(now>=next){buffer.push(next,enemyPose(next));next+=interval;}
  buffer.sample(now,out);
  if(now>3000){samples++;if(out.x-previous<.001)stalls++;assert.ok(out.x-previous<.04);}
  previous=out.x;
 }
 assert.equal(stalls,0,`${stalls}/${samples} frozen frames`);assert.ok(buffer.size<=24);
});
test('infected interpolation rejects stale packets, handles angle wrap and bounds outage drift',()=>{
 const b=new EnemyInterpolation(),out=enemyPose(0);
 b.push(0,{...enemyPose(0),angle:Math.PI-.1});b.push(100,{...enemyPose(100),angle:-Math.PI+.1});
 assert.equal(b.push(90,enemyPose(5000)),false);b.sample(200,out);
 assert.ok(Math.abs(Math.abs(out.angle)-Math.PI)<.11);
 b.sample(5000,out);assert.ok(out.x<=.2);assert.ok(out.gait<=.8);
 b.push(5100,{...enemyPose(0),x:20});b.sample(5100,out);assert.equal(out.x,20);assert.equal(b.size,1);
 b.clear();assert.equal(b.sample(6000,out),false);
});
test('infected clock correction is independent of entity count and clears on migration',()=>{
 const a=new EnemyClock(),b=new EnemyClock();a.observe(100,1000);b.observe(100,1000);
 a.observe(200,1108);for(let i=0;i<100;i++)b.observe(200,1108);
 assert.equal(a.time(1200),b.time(1200));b.observe(100,5000);assert.equal(a.time(1200),b.time(1200));
 b.clear();b.observe(50,5000);assert.equal(b.time(5000),50);
});
test('infected buffer handles jitter and near/far transitions without reversing playback',()=>{
 const b=new EnemyInterpolation(),out=enemyPose(0);let next=0,previous=-1;
 for(let now=0;now<12000;now+=1000/60){
  if(now>=next){b.push(next,enemyPose(next));next+=(now<3000||now>7000?100:500)+(Math.floor(now)%3)*15;}
  b.sample(now,out);assert.ok(out.x>=previous-1e-8);assert.ok(out.x<=now/1000+.11);previous=out.x;
 }
});
