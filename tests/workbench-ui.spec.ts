import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const state=(p:Page)=>p.evaluate(()=>(window as any).__LAST_NIGHT__.state());
async function mouse(p:Page,button:'left'|'right'='left'){await p.mouse.down({button});await p.mouse.up({button});}
async function openBench(p:Page){
 await p.addInitScript(()=>{
  localStorage.setItem('last-night-settings',JSON.stringify({quality:'medium',master:0}));
  window.addEventListener('mousemove',e=>{if(document.pointerLockElement)e.stopImmediatePropagation();},true);
 });
 await p.goto('/?test');await expect(p.locator('#start')).toBeEnabled({timeout:90000});await p.locator('#start').click();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});
 await expect.poll(async()=>(await state(p)).camera.pointerLocked).toBe(true);
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('day',0);g.setPlayer(3.4,6.2);g.setLook(Math.PI,0);g.setInventory({wood:14,scrap:15,cloth:12,cord:3,hide:8,rare:2,bench:1});});
 await p.keyboard.press('Tab');await p.locator('#craft-tab').click();await p.locator('#place-bench').click();await expect.poll(async()=>(await state(p)).camera.pointerLocked).toBe(true);await mouse(p);
 await expect.poll(async()=>(await state(p)).crafting.tables.length).toBe(1);
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__,s=g.state(),t=s.crafting.tables[0];g.setLook(Math.atan2(t.x-s.player.x,t.z-s.player.z),Math.atan2(t.y+1.2-s.player.eyeY,Math.hypot(t.x-s.player.x,t.z-s.player.z)));});
 await p.keyboard.press('KeyE');await expect(p.locator('#workbench-screen')).toBeVisible();await p.locator('[data-recipe="axe"]').click();await expect(p.locator('#bench-recipe h3')).toHaveText('Machado');
}

test('workbench catalog keeps controls stable, filters recipes and crafts through the existing gameplay',async({page:p})=>{
 const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await openBench(p);
 await mkdir('docs/workbench-ui',{recursive:true});
 if(process.env.LAST_NIGHT_WORKBENCH_BASELINE==='1'){
  await p.screenshot({path:'docs/workbench-ui/before-1366x768.png'});return;
 }
 const checkpoints:any[]=[];
 // Capture the same composition as the baseline before changing recipes or stock.
 for(const viewport of [{width:1366,height:768},{width:1920,height:1080},{width:960,height:640}]){
  await p.setViewportSize(viewport);
  const dialog=p.locator('.workbench-window'),box=await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width+1);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height+1);
  for(const id of ['bench-close','recipe-search','recipe-category','recipe-available'])await expect(p.locator(`#${id}`)).toBeInViewport();
  await p.locator('.bench-detail-scroll').evaluate(el=>{el.scrollTop=0;});
  const details=(await p.locator('.bench-detail-scroll').boundingBox())!,materials=[];
  await expect(p.locator('#bench-materials [data-material]')).toHaveCount(3);
  for(const material of await p.locator('#bench-materials [data-material]').all()){
   const bounds=(await material.boundingBox())!;await expect(material).toBeInViewport();
   expect(bounds.y).toBeGreaterThanOrEqual(details.y-1);expect(bounds.y+bounds.height).toBeLessThanOrEqual(details.y+details.height+1);
   expect(bounds.x).toBeGreaterThanOrEqual(details.x-1);expect(bounds.x+bounds.width).toBeLessThanOrEqual(details.x+details.width+1);
   materials.push({item:await material.getAttribute('data-material'),bounds});
  }
  await expect(p.locator('[data-craft="axe"]')).toBeInViewport();
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await p.screenshot({path:`docs/workbench-ui/after-${viewport.width}x${viewport.height}.png`});
  checkpoints.push({viewport,dialog:box,details,materials});
 }
 await p.setViewportSize({width:1366,height:768});
 // Observe actual element churn instead of inferring performance from frame rate.
 const mutationMetrics=await p.evaluate(async()=>{
  const scope=document.querySelector('#workbench-screen')!,g=(window as any).__LAST_NIGHT__;
  const sample=async(changeStock:boolean)=>{
   const metrics={durationMs:600,records:0,createdElements:0,removedElements:0,createdTextNodes:0,removedTextNodes:0};
   const observer=new MutationObserver(records=>{for(const record of records){metrics.records++;for(const node of record.addedNodes){if(node.nodeType===Node.ELEMENT_NODE)metrics.createdElements++;else if(node.nodeType===Node.TEXT_NODE)metrics.createdTextNodes++;}for(const node of record.removedNodes){if(node.nodeType===Node.ELEMENT_NODE)metrics.removedElements++;else if(node.nodeType===Node.TEXT_NODE)metrics.removedTextNodes++;}}});
   observer.observe(scope,{childList:true,subtree:true});if(changeStock)g.setInventory({wood:15});
   await new Promise(resolve=>setTimeout(resolve,metrics.durationMs));observer.disconnect();return metrics;
  };
  await new Promise(resolve=>setTimeout(resolve,350));const idle=await sample(false),stockChanged=await sample(true);g.setInventory({wood:14});return {idle,stockChanged};
 });
 expect(mutationMetrics.idle.createdElements).toBe(0);expect(mutationMetrics.idle.removedElements).toBe(0);expect(mutationMetrics.idle.createdTextNodes).toBe(0);expect(mutationMetrics.idle.removedTextNodes).toBe(0);
 expect(mutationMetrics.stockChanged.createdElements).toBe(0);expect(mutationMetrics.stockChanged.removedElements).toBe(0);expect(mutationMetrics.stockChanged.createdTextNodes).toBeGreaterThan(0);
 // Normalization accepts both accented and unaccented Portuguese searches.
 await p.locator('#recipe-search').fill('facao');await expect(p.locator('#recipe-catalog [data-recipe]:visible')).toHaveCount(1);await expect(p.locator('[data-recipe="machete"]')).toBeVisible();
 await p.locator('#recipe-search').fill('facão');await expect(p.locator('#recipe-catalog [data-recipe]:visible')).toHaveCount(1);
 await p.locator('#recipe-search').fill('municao');await expect(p.locator('[data-recipe="shells"]')).toBeVisible();await expect(p.locator('[data-recipe="rifleAmmo"]')).toBeVisible();
 await p.locator('#recipe-search').fill('');await p.locator('#recipe-category').selectOption('Armas');
 await expect(p.locator('[data-recipe="axe"]')).toBeVisible();await expect(p.locator('[data-recipe="cord"]')).not.toBeVisible();
 await p.locator('#recipe-category').selectOption('Todas');await p.locator('#recipe-available').check();
 await expect(p.locator('#recipe-catalog .unavailable:visible')).toHaveCount(0);await expect(p.locator('[data-recipe="axe"]')).toBeVisible();
 await expect(p.locator('[data-recipe="bench-repair"]')).not.toBeVisible();await p.locator('#recipe-available').uncheck();
 // Typing controls must not leak gameplay shortcuts or lose their caret to HUD refreshes.
 const light=(await state(p)).flashlight;
 await p.locator('#recipe-search').pressSequentially('mf');expect((await state(p)).mapOpen).toBe(false);expect((await state(p)).flashlight).toBe(light);
 await p.locator('#recipe-search').fill('tecido');
 await p.locator('#recipe-search').evaluate(el=>{(el as HTMLInputElement).setSelectionRange(2,4);(window as any).__benchSearch=el;});
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setInventory({cloth:11});});await p.waitForTimeout(350);
 expect(await p.locator('#recipe-search').evaluate(el=>({same:el===(window as any).__benchSearch,focus:document.activeElement===el,start:(el as HTMLInputElement).selectionStart,end:(el as HTMLInputElement).selectionEnd}))).toEqual({same:true,focus:true,start:2,end:4});
 await p.locator('#recipe-search').fill('');
 // Availability changes during mousedown must not detach the target before mouseup.
 const target=p.locator('[data-recipe="axe"]');await target.scrollIntoViewIfNeeded();
 await target.evaluate(el=>{(window as any).__benchRecipe=el;});
 const clickBox=(await target.boundingBox())!;await p.mouse.move(clickBox.x+clickBox.width/2,clickBox.y+clickBox.height/2);await p.mouse.down();
 await p.evaluate(()=>{(window as any).__LAST_NIGHT__.setInventory({wood:0});});await p.waitForTimeout(200);
 await p.evaluate(()=>{(window as any).__LAST_NIGHT__.setInventory({wood:14});});await p.waitForTimeout(250);
 expect(await target.evaluate(el=>el===(window as any).__benchRecipe)).toBe(true);await p.mouse.up();await expect(p.locator('#bench-recipe h3')).toHaveText('Machado');
 for(const [id,label]of [['knife','Faca de sucata'],['spear','Lança'],['leather','Colete de couro'],['axe','Machado']]){
  await p.locator(`[data-recipe="${id}"]`).click({delay:140});await expect(p.locator('#bench-recipe h3')).toHaveText(label);
 }
 // Independent catalog scroll remains stable as materials and detail numbers update.
 await p.locator('#recipe-catalog').evaluate(el=>{el.scrollTop=el.scrollHeight;});const scrollBefore=await p.locator('#recipe-catalog').evaluate(el=>el.scrollTop);
 await p.evaluate(()=>{(window as any).__LAST_NIGHT__.setInventory({scrap:16});});await p.waitForTimeout(350);
 expect(await p.locator('#recipe-catalog').evaluate(el=>el.scrollTop)).toBe(scrollBefore);
 // The active craft action retains focus and identity while live stock changes.
 const action=p.locator('[data-craft="axe"]');await action.focus();await action.evaluate(el=>{(window as any).__benchAction=el;});
 await p.evaluate(()=>{(window as any).__LAST_NIGHT__.setInventory({scrap:15});});await p.waitForTimeout(350);
 expect(await action.evaluate(el=>({same:el===(window as any).__benchAction,focus:document.activeElement===el}))).toEqual({same:true,focus:true});
 const before=await state(p);await action.click({delay:350});await expect.poll(async()=>(await state(p)).gear.melee).toBe('axe');
 const after=await state(p);expect(after.inventory.wood).toBe(before.inventory.wood-4);expect(after.inventory.scrap).toBe(before.inventory.scrap-7);expect(after.inventory.cord).toBe(before.inventory.cord-1);
 await expect(p.locator('[data-craft="axe"]')).toBeDisabled();expect(after.gear.owned.filter((id:string)=>id==='axe')).toHaveLength(1);
 // Reopen and reclaim remain reachable; the recipe browser does not capture gameplay forever.
 await p.locator('#bench-close').click();await expect(p.locator('#workbench-screen')).toBeHidden();
 if(!(await state(p)).camera.pointerLocked)await p.locator('#capture-mouse').click();await p.keyboard.press('KeyE');await expect(p.locator('#workbench-screen')).toBeVisible();
 // Decimal item weights must use the inventory's capacity tolerance when reclaiming.
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setInventory({...Object.fromEntries(Object.keys(g.state().inventory).map(k=>[k,0])),hide:2,ammo:2,shells:4,med:1,wood:17,cannedBeans:1,cannedFish:4,crackers:4,ration:1,water:1});});
 await expect(p.locator('#reclaim-bench')).toBeDisabled();
 await p.evaluate(()=>{(window as any).__LAST_NIGHT__.setInventory({wood:16});});
 expect((await state(p)).weight+3).toBeGreaterThan(16); // 16.000000000000004, mathematically 16 kg.
 await expect(p.locator('#reclaim-bench')).toBeEnabled();
 await p.locator('#reclaim-bench').click();await expect.poll(async()=>(await state(p)).crafting.tables.length).toBe(0);await expect(p.locator('#workbench-screen')).toBeHidden();expect((await state(p)).inventory.bench).toBe(1);
 expect(errors).toEqual([]);
 await writeFile('docs/workbench-ui/validation.json',JSON.stringify({errors,checkpoints,mutationMetrics,checks:['all three ingredients visible without scrolling at all viewports','zero element churn during idle and stock updates','accent-insensitive search','category and available filters','repeated and slow recipe clicks','live stock updates preserve nodes, focus, caret and scroll','craft cost charged once','close, reopen and reclaim'],crafted:{recipe:'axe',wood:before.inventory.wood-after.inventory.wood,scrap:before.inventory.scrap-after.inventory.scrap,cord:before.inventory.cord-after.inventory.cord}},null,2));
});
