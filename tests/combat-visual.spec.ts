import { test, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
test('localized browser hits, falling bodies, 10/20/40 corpse budgets and smooth cleanup',async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await mkdir('docs/combat',{recursive:true});await page.goto('/?test');await page.locator('#start').click();
  await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.spawn(1,15);});
  await page.waitForTimeout(1500);
  const head=await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__,z=g.state().zombies[0];return g.project(z.x-.07,z.z,1.9);});
  await page.mouse.click(head.x,head.y);
  await expect.poll(()=>page.evaluate(()=>(window as any).__LAST_NIGHT__.state().kills)).toBe(1);
  await page.screenshot({path:'docs/combat/headshot.png'});
  const metrics:any[]=[];
  for(const count of [10,20,40]) {
    await page.evaluate(n=>(window as any).__LAST_NIGHT__.combatStress(n),count);
    await page.waitForFunction(n=>(window as any).__LAST_NIGHT__.state().corpses.length===n,count);
    await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().corpses.every((c:any)=>c.age>1));
    const s=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
    expect(s.corpses).toHaveLength(count);expect(s.calls).toBeLessThan(450);expect(s.triangles).toBeLessThan(400000);expect(s.render.geometryMB).toBeLessThan(25);
    expect(s.audio.peak).toBeLessThanOrEqual(16);metrics.push({count,audio:s.audio,fps:s.fps,calls:s.calls,triangles:s.triangles,...s.render});
    await page.screenshot({path:`docs/combat/corpses-${count}.png`});
  }
  await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPhase('night',10);g.finishSpawning();for(let i=0;i<40;i++)g.spawn(-7+i%10*1.6,13+Math.floor(i/10)*1.4);});
  await page.waitForTimeout(1000);let s=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state());
  expect(s.zombies).toHaveLength(40);expect(s.corpses).toHaveLength(40);metrics.push({walkers:40,corpses:40,calls:s.calls,triangles:s.triangles,...s.render});
  await page.screenshot({path:'docs/combat/night-40-walkers-40-corpses.png'});
  await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('dusk',0);g.setSpeed(12);});
  await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().corpses.length===0,{},{timeout:45000});
  s=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state());metrics.push({cleanup:true,calls:s.calls,...s.render});
  await writeFile('docs/combat/performance.json',JSON.stringify(metrics,null,2));expect(errors).toEqual([]);
});
test('expanded district visual tour and actual walking between outer loot destinations',async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?test');await page.locator('#start').click();
  for(const [name,x,z] of [['hospital',38,-16],['police',38,35],['industry',53,70],['residential',-58,-56],['gallery',-55,7],['plaza',4,69],['triage',65,-54],['maintenance',-55,72]] as const){
    await page.evaluate(([x,z])=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPlayer(x,z);g.setPhase('day',0);},[x,z]);
    await page.waitForTimeout(1800);await page.screenshot({path:`docs/combat/${name}.png`});
    const before=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state().player);
    await page.keyboard.down('a');try{await page.waitForFunction(p=>{const s=(window as any).__LAST_NIGHT__.state();return Math.hypot(s.player.x-p.x,s.player.z-p.z)>.1;},before,{timeout:10000});}finally{await page.keyboard.up('a');}
    const after=await page.evaluate(()=>(window as any).__LAST_NIGHT__.state().player);
    expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThan(.05);
  }
  expect(errors).toEqual([]);
});
test('close visual inspection of voxel wounds, magazine stages and directional falls',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1500,height:1000});await page.goto('/tests/fixtures/combat-gallery.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.screenshot({path:'docs/combat/rig-inspection.png'});expect(errors).toEqual([]);
});
