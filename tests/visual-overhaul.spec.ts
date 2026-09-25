import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const stage=process.env.VISUAL_STAGE??'after';
const quality=process.env.VISUAL_QUALITY??'high';
const folder=`docs/phase11/${stage}-${quality}`;
const read=(page:Page)=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
const scenes=[
 {name:'A-residential',x:-12,z:27,yaw:Math.PI,pitch:-.045,phase:'day'},
 {name:'B-avenue',x:88,z:-30,yaw:Math.PI,pitch:-.045,phase:'day'},
 {name:'C-interior',x:112,z:-105,yaw:Math.PI,pitch:0,phase:'day'},
 {name:'D-shelter',x:1,z:7,yaw:Math.PI,pitch:-.025,phase:'day'},
 {name:'E-night',x:-12,z:27,yaw:Math.PI,pitch:-.045,phase:'night'},
 {name:'F-inventory',x:-12,z:27,yaw:Math.PI,pitch:-.045,phase:'day',inventory:true},
 {name:'G-combat',x:88,z:-30,yaw:Math.PI,pitch:0,phase:'day',combat:true},
] as const;
test('repeatable seven-scene visual and performance survey',async({page})=>{
 await mkdir(folder,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewportSize({width:1600,height:900});await page.addInitScript(quality=>localStorage.setItem('last-night-settings',JSON.stringify({quality,shadows:quality!=='low',master:0})),quality);
 await page.goto('/?test',{waitUntil:'domcontentloaded'});await page.locator('#start').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.addStyleTag({content:'#debug-stats,#notice,#loot-feed,#tutorial{display:none!important}'});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');const cpu=async()=>(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='TaskDuration')!.value;
 const renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas')!.getContext('webgl2')!,e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 const rows=[];
 for(const scene of scenes.filter(s=>!process.env.VISUAL_SCENES||process.env.VISUAL_SCENES.split(',').some(n=>s.name.startsWith(n)))){
  if((await read(page)).inventoryOpen)await page.keyboard.press('Tab');
  await page.evaluate(s=>{const g=(window as any).__LAST_NIGHT__;clearInterval((window as any).__visualFreeze);const reset=()=>{g.clearWalkers();g.setPhase(s.phase,0);g.setHealth(100);g.setBase(1000);g.finishSpawning();};reset();g.setPlayer(s.x,s.z);g.setLook(s.yaw,s.pitch);g.setInventory({ammo:79,wood:6,scrap:5,med:1});(window as any).__visualFreeze=setInterval(()=>{g.setPhase(s.phase,0);g.finishSpawning();g.setHealth(100);g.setBase(1000);if(!('combat'in s))g.clearWalkers();},1000);if('combat'in s){g.spawn(88,-36);g.spawn(90,-40,'runner');g.spawn(86,-42);}},scene);
  if('inventory'in scene)await page.keyboard.press('Tab');
  await page.waitForTimeout(1800);const start=performance.now(),before=await cpu();const samples=[];for(let i=0;i<5;i++){await page.waitForTimeout(400);const s=await read(page);samples.push({fps:s.fps,calls:s.calls,triangles:s.triangles,render:s.render});}const seconds=(performance.now()-start)/1000;
  rows.push({scene,samples,rendererCpuMsPerSecond:((await cpu())-before)*1000/seconds});await page.screenshot({animations:'disabled',path:`${folder}/${scene.name}.png`});console.log(stage,quality,scene.name,samples.at(-1));
 }
 await writeFile(`${folder}/metrics.json`,JSON.stringify({stage,quality,renderer,viewport:{width:1600,height:900},dpr:1,measurement:'5 live samples after 1.8 seconds settling; CDP TaskDuration is renderer CPU, excludes GPU',rows,errors},null,2));expect(errors).toEqual([]);
});
