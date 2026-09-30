import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('repeatable rendering profile and workshop stable click targets',async({page:p})=>{
 await p.setViewportSize({width:1600,height:900});await p.addInitScript(()=>localStorage.setItem('last-night-settings',JSON.stringify({quality:'high',master:0})));await p.goto('/?test');await expect(p.locator('#start')).toBeEnabled({timeout:90000});await p.locator('#start').click();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});
 const cdp=await p.context().newCDPSession(p);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');const rows=[];
 for(const point of [{name:'base',x:1,z:18,yaw:Math.PI},{name:'district',x:468,z:447,yaw:0}]){
 await p.evaluate(v=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('day');g.setPlayer(v.x,v.z);g.setLook(v.yaw,0);},point);await p.waitForTimeout(1500);
 const frame=await p.evaluate(()=>new Promise(resolve=>{const samples:number[]=[];let last=performance.now();function tick(now:number){samples.push(now-last);last=now;if(samples.length<180)requestAnimationFrame(tick);else{samples.sort((a,b)=>a-b);resolve({mean:samples.reduce((a,b)=>a+b,0)/samples.length,p95:samples[Math.floor(samples.length*.95)]});}}requestAnimationFrame(tick);}));const state=await p.evaluate(()=>(window as any).__LAST_NIGHT__.state());rows.push({...point,frame,calls:state.calls,triangles:state.triangles,render:state.render});
 await mkdir('docs/optimization-lan',{recursive:true});await p.screenshot({path:`docs/optimization-lan/${process.env.PROFILE_LABEL??'after'}-${point.name}.png`});
 }
 const {profile}=await cdp.send('Profiler.stop');await writeFile(`docs/optimization-lan/${process.env.PROFILE_LABEL??'after'}.json`,JSON.stringify({viewport:{width:1600,height:900},quality:'high',rows},null,2));await writeFile(`/tmp/last-night-${process.env.PROFILE_LABEL??'after'}.cpuprofile`,JSON.stringify(profile));
});
