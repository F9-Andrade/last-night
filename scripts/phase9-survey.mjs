import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const stage=process.argv[2]??'before';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}});await page.emulateMedia({reducedMotion:'reduce'});page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',shadows:false})));
await page.goto('http://127.0.0.1:5173/?test');await page.locator('#start').press('Enter');await page.waitForFunction(()=>!!window.__LAST_NIGHT__);
let areas=[['shelter',1,7,Math.PI],['residential',-88,-67,-Math.PI/2],['center',-49,-30,-Math.PI/2],['hospital',112,-94,Math.PI],['industry',88,70,Math.PI/2],['quarantine',114,144,Math.PI],['north-avenue',-40,-88,Math.PI/2],['south-avenue',0,88,Math.PI/2]];
if(stage==='streets'){
 const roads=await page.evaluate(async()=>{const {ROADS}=await import('/src/game/districts.ts');return ROADS;});
 areas=roads.flatMap((r,i)=>[-105,0,105].map(n=>[String(i).padStart(2,'0')+'-'+n,r.w>r.d?n:r.x,r.w>r.d?r.z:n,r.w>r.d?Math.PI/2:Math.PI]));
}
const evidence=[];
for(const [name,x,z,yaw] of areas){
 await page.evaluate(({x,z,yaw})=>{const g=window.__LAST_NIGHT__;g.clearWalkers();g.setHealth(1000);g.setBase(10000);g.setPhase('day');g.setPlayer(x,z);g.setLook(yaw,0);},{x,z,yaw});await page.waitForTimeout(stage==='streets'?500:2000);
 const samples=[];for(let i=0;i<(stage==='streets'?1:3);i++){await page.waitForTimeout(stage==='streets'?250:1000);samples.push(await page.evaluate(()=>{const s=window.__LAST_NIGHT__.state();return {fps:s.fps,frameMs:s.fps?1000/s.fps:null,calls:s.calls,triangles:s.triangles,entities:s.zombies.length,ai:s.zombies.length,dormant:s.dormant,audio:s.audio,render:s.render};}));}
 await page.screenshot({animations:'disabled',path:`docs/phase9/${stage}-${name}.png`});evidence.push({name,x,z,yaw,samples});
}
await writeFile(`docs/phase9/${stage}.json`,JSON.stringify({stage,renderer:'Chromium SwiftShader software',quality:'low',viewport:'1280x720',evidence,errors},null,2));await browser.close();
