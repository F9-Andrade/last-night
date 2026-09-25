import {mkdirSync,writeFileSync} from 'node:fs';
import {CoopWorld} from '../src/network/coop-world.ts';
import {parseCheckpoint} from '../src/network/checkpoint.ts';
import {createPatch} from '../src/network/world-patch.ts';
import {CITY_SITES} from '../src/game/city.ts';
import {BALANCE} from '../src/game/config.ts';
import {collides} from '../src/game/world.ts';
const rows=[];
for(const players of [1,2,3,4])for(const requested of [10,25,50,100]){
 const w=new CoopWorld(1977,Array.from({length:players},(_,i)=>i+1));w.sim.zombies=[];w.sim.activatedSites=new Set(CITY_SITES.map(s=>s.id));
 for(const [i,a] of [...w.actors.values()].entries()){Object.assign(a.sim.player,{x:88+i*1.3,z:-30,hp:100,invulnerable:99});}
 for(let i=0;i<300&&w.sim.activeWalkers<requested;i++){const p={x:76+i%15*1.8,z:-45+Math.floor(i/15)*1.8};if(!collides(p,.6,w.sim.solidDefenses))w.sim.spawn(p,['walker','walker','runner','spitter','tank'][i%5] as any);if(w.sim.activeWalkers===BALANCE.walker.capacity)break;}
 const actual=w.sim.activeWalkers,times:number[]=[],sizes:number[]=[];let previous=w.checkpoint();const fullBytes=Buffer.byteLength(JSON.stringify(previous));
 for(let i=0;i<300;i++){const start=performance.now();w.step(1/60);times.push(performance.now()-start);if(i%30===29){const c=w.checkpoint();if(!parseCheckpoint(c))throw new Error(`Invalid checkpoint at ${players}/${actual}/${i}`);sizes.push(Buffer.byteLength(JSON.stringify(createPatch(previous,c))));previous=c;}}
 times.sort((a,b)=>a-b);rows.push({players,requestedInfected:requested,actualInfected:actual,simulationSeconds:5,stepMeanMs:times.reduce((a,b)=>a+b,0)/times.length,stepP95Ms:times[Math.floor(times.length*.95)],stepMaxMs:times.at(-1),checkpointBytes:fullBytes,meanPatchBytes:sizes.reduce((a,b)=>a+b,0)/sizes.length});
}
mkdirSync('docs/phase10b',{recursive:true});writeFileSync('docs/phase10b/stress-simulation.json',JSON.stringify({environment:{node:process.version,platform:process.platform,architecture:process.arch},scope:'CPU-only deterministic coordinator benchmark. No browser, GPU, Photon or network latency; bytes are UTF-8 JSON application payloads, not wire bandwidth. Existing living infected cap remains 40, so 50/100 requests are capped, not claimed as 50/100 runs.',rows},null,2));console.log(JSON.stringify(rows,null,2));
