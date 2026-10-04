import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('same visual preset, repeatable CPU/GPU and frame-time measurements',async({page:p})=>{
 const label=process.env.PROFILE_LABEL??'after',dir='docs/performance-pass',errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await mkdir(dir,{recursive:true});
 await p.addInitScript(()=>{
  localStorage.setItem('last-night-settings',JSON.stringify({quality:'high',master:0}));
  const probe={active:false,cpu:[] as number[],interval:[] as number[],gpu:[] as number[],last:0,pending:[] as WebGLQuery[]};(window as any).__perf=probe;
  const raf=window.requestAnimationFrame;let gl:WebGL2RenderingContext|null=null,ext:any;
  window.requestAnimationFrame=function(callback){return raf.call(window,time=>{
   if(callback.name!=='frame'||!probe.active){callback(time);return;}
   if(!gl){gl=document.querySelector<HTMLCanvasElement>('#game')?.getContext('webgl2')??null;ext=gl?.getExtension('EXT_disjoint_timer_query_webgl2');}
   if(gl&&ext){while(probe.pending.length&&gl.getQueryParameter(probe.pending[0],gl.QUERY_RESULT_AVAILABLE)){const q=probe.pending.shift()!;if(!gl.getParameter(ext.GPU_DISJOINT_EXT))probe.gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}}
   const query=gl&&ext?gl.createQuery():null;if(query)gl!.beginQuery(ext.TIME_ELAPSED_EXT,query);
   const start=performance.now();callback(time);probe.cpu.push(performance.now()-start);if(probe.last)probe.interval.push(time-probe.last);probe.last=time;
   if(query){gl!.endQuery(ext.TIME_ELAPSED_EXT);probe.pending.push(query);}
  });};
 });
 await p.goto('/?test');await expect(p.locator('#start')).toBeEnabled({timeout:90000});await p.locator('#start').click();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});
 const cdp=await p.context().newCDPSession(p);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');const rows=[];
 for(const scene of [{name:'shelter',x:1,z:18,yaw:Math.PI,night:false,structures:false},{name:'expanded-city',x:468,z:447,yaw:0,night:false,structures:false},{name:'night',x:1,z:18,yaw:Math.PI,night:true,structures:false},{name:'built-shelter',x:1,z:18,yaw:Math.PI,night:false,structures:true}]){
  await p.evaluate(async v=>{const g=(window as any).__LAST_NIGHT__,s=g.simulationFixture();g.clearWalkers();g.setPhase(v.night?'night':'day');g.setPlayer(v.x,v.z);g.setLook(v.yaw,0);s.spawnTimer=10000;s.horde.complete=true;s.player.invulnerable=10000;s.crafting.structures=[];s.crafting.revision++;
   if(v.structures){const m=await import('/src/game/construction.ts');for(let level=0;level<3;level++)for(let x=0;x<4;x++)for(let z=0;z<6;z++){const q={id:s.crafting.next++,kind:(z%2?'window':'wall') as any,x:-3.5+x*3,z:-8+z*3,level,rotation:0,tier:0,hp:300,revision:0,open:false};s.crafting.structures.push(q);}s.crafting.revision++;}
  },scene);
  await p.waitForTimeout(1600);
  await p.evaluate(()=>{const x=(window as any).__perf;x.cpu=[];x.gpu=[];x.interval=[];x.last=0;x.active=true;});
  await p.waitForFunction(()=>(window as any).__perf.cpu.length>=180,{},{timeout:60000});
  const measurements=await p.evaluate(()=>{const x=(window as any).__perf;x.active=false;const summarize=(a:number[])=>{const sorted=[...a].sort((a,b)=>a-b);return {samples:a.length,mean:a.reduce((v,n)=>v+n,0)/a.length,p50:sorted[Math.floor(a.length*.5)],p95:sorted[Math.floor(a.length*.95)]};};return {cpuMs:summarize(x.cpu),frameMs:summarize(x.interval),gpuMs:x.gpu.length?summarize(x.gpu):null};});
  const state=await p.evaluate(()=>(window as any).__LAST_NIGHT__.state());rows.push({scene:scene.name,...measurements,averageFps:1000/measurements.frameMs.mean,calls:state.calls,triangles:state.triangles,render:state.render,structures:state.crafting.structures.length});await p.screenshot({path:`${dir}/${label}-${scene.name}.png`});
 }
 const {profile}=await cdp.send('Profiler.stop');await writeFile(`test-results/performance-${label}.cpuprofile`,JSON.stringify(profile));
 const gpu=await p.evaluate(()=>{const gl=document.querySelector<HTMLCanvasElement>('#game')!.getContext('webgl2')!,e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),devicePixelRatio};});
 await writeFile(`${dir}/${label}.json`,JSON.stringify({viewport:[1920,1080],quality:'high',...gpu,rows,errors},null,2));expect(errors).toEqual([]);
});
