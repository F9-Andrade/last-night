/** Deterministic CPU-only benchmark; run with node --experimental-strip-types.
 * 80 infected deliberately exceeds the live cap and is a synthetic stress case.
 * Construction fixtures exercise collision load, not the placement UI.
 * No renderer, timers, balance, or production limits are changed.
 */
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {Simulation} from '../src/game/simulation.ts';
import {CoopWorld} from '../src/network/coop-world.ts';
import {collides,rayWorld} from '../src/game/world.ts';
import {STRUCTURE_DEFS} from '../src/game/construction.ts';
const command={moveX:0,moveZ:0,aimX:1,aimZ:20,fire:false,run:false,reload:false,interact:false};
function prepare(s,count,pieces){
 s.firstPerson=true;s.zombies=[];s.spawnTimer=1e9;s.cityTimer=-1e9;s.roamTimer=1e9;s.outsideTimer=1e9;s.eventTimer=1e9;
 Object.assign(s.player,{x:1,z:13,invulnerable:1e9});
 for(let i=0;i<1800&&s.zombies.length<Math.min(40,count);i++){
  const angle=i*.71,radius=4+i%27,p={x:1+Math.sin(angle)*radius,z:13+Math.cos(angle)*radius};
  if(!collides(p,.65,s.solidDefenses))s.spawn(p,['walker','runner','spitter','screamer'][i%4]);
 }
 if(count===80)for(const z of s.zombies.slice())s.zombies.push({...structuredClone(z),id:s.nextId++,x:z.x+.05});
 const layouts=[];
 for(let level=0;level<3;level++)for(let x=-3.5;x<7;x+=3)for(let z=-6.5;z<10;z+=3)for(const kind of ['floor','wall','window'])layouts.push({kind,x,z,level,rotation:kind==='window'?1:0});
 s.crafting.structures=layouts.slice(0,pieces).map((p,i)=>({...p,id:i+1,hp:STRUCTURE_DEFS[p.kind].maxHP,tier:0,open:false,revision:0}));s.crafting.revision++;
}
const results=[];
for(const [mode,count,pieces,players] of [['solo',0,0,1],['solo',40,0,1],['solo',40,72,1],['solo',80,192,1],['coop',40,72,2],['coop',40,72,4],['coop',80,192,4]]){
 const world=mode==='coop'?new CoopWorld(1977,Array.from({length:players},(_,i)=>i+1)):null,s=world?.sim??new Simulation();prepare(s,count,pieces);
 if(world){world.cityClock=1e9;let i=0;for(const a of world.actors.values())Object.assign(a.sim.player,{x:1+i++,z:13,invulnerable:1e9});}
 const times=[];
 for(let i=0;i<420;i++){
  const start=performance.now();if(world)world.step(1/60);else s.update(1/60,command);times.push(performance.now()-start);
  s.events=[];if(world)world.effects=[];
 }
 const sorted=times.slice(60).sort((a,b)=>a-b),final=world?world.checkpoint():{player:s.player,zombies:s.zombies,seed:s.seed,baseHP:s.baseHP,crafting:s.crafting,phase:s.phase};
 results.push({mode,count,pieces,players,actualInfected:s.zombies.length,avgMs:sorted.reduce((a,b)=>a+b,0)/sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],hash:createHash('sha256').update(JSON.stringify(final)).digest('hex')});
}
const s=new Simulation(),extra=s.solidDefenses;let aggregate=0;const start=performance.now();
for(let i=0;i<10000;i++){const a=i*.031;aggregate+=rayWorld({x:1,y:1.94,z:7},{x:Math.sin(a),y:-.05,z:Math.cos(a)},6,extra);}
results.push({mode:'10000-interaction-rays',ms:performance.now()-start,aggregate});
console.log(JSON.stringify({node:process.version,steps:420,warmupSteps:60,dt:1/60,results},null,2));
