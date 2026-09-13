import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test('final city facades, local night lighting, map and forty mixed enemies retain budgets',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?test');await page.locator('#start').click();await page.addStyleTag({content:'#debug-stats{display:none}'});const metrics:any[]=[];
 for(const [id,x,z,phase,mixed]of [['base',1,7,'day',false],['center',16,17,'day',false],['hospital-front',112,-94,'day',false],['hospital-night',112,-105,'night',false],['industry-night',113,94,'night',false],['quarantine-night',114,146,'night',false],['mixed-40',1,7,'dusk',true]]as const){
  await page.evaluate(({x,z,phase,mixed})=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPlayer(x,z);g.setHealth(100);g.setBase(1000);g.setPhase(phase,phase==='night'?25:0);if(phase!=='night')g.finishSpawning();if(mixed)for(let i=0;i<40;i++)g.spawn(-7+i%10*1.6,13+Math.floor(i/10)*1.5,['screamer','tank','spitter','runner'][i]??'walker');},{x,z,phase,mixed});
  await page.waitForFunction(()=>{const g=(window as any).__LAST_NIGHT__,s=g.state(),p=g.project(s.player.x,s.player.z);return Math.abs(p.x-innerWidth/2)<60&&Math.abs(p.y-innerHeight/2)<60;},null,{timeout:30000});
  // Night with a completed wave can enter dawn: keep the fixture phase anchored for the screenshot.
  if(phase==='night')await page.evaluate(()=>(window as any).__LAST_NIGHT__.setPhase('night',25));
  await page.waitForTimeout(1500);const s=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state());expect(s.calls).toBeLessThan(600);expect(s.triangles).toBeLessThan(400000);expect(s.render.geometryMB).toBeLessThan(25);expect(s.zombies.length).toBeLessThanOrEqual(40);expect(s.audio.peak).toBeLessThanOrEqual(16);
  metrics.push({id,phase:s.phase,fps:s.fps,calls:s.calls,triangles:s.triangles,active:s.zombies.length,dormant:s.dormant,...s.render,audio:s.audio});await page.screenshot({path:`docs/city/final-${id}.png`,animations:'disabled'});
 }
 await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('dusk');});await page.locator('#map-toggle').click();await expect(page.locator('#map-screen')).toBeVisible();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#map-screen')!).opacity==='1');await page.screenshot({path:'docs/city/map-final.png',animations:'disabled'});
 expect(await page.locator('#full-map').evaluate((c:any)=>c.getContext('2d').getImageData(450,450,1,1).data[3])).toBe(255);
 await writeFile('docs/city/performance-final.json',JSON.stringify({renderer:'Chromium SwiftShader software, high quality, 1440×900',metrics,errors},null,2));expect(errors).toEqual([]);
});
