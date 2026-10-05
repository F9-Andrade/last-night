import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const guns=['pistol','revolver','smg','shotgun','rifle','marksman'];
const tools=['fists','knife','hammer','axe','machete','club','spear'];
test('all weapon silhouettes, grips and presentation in the actual FPS',async({page:p})=>{
 const label=process.env.WEAPON_CAPTURE??'after',dir='docs/weapon-design',errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await mkdir(dir,{recursive:true});
 await p.addInitScript(()=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'high',master:0}));window.addEventListener('mousemove',e=>{if(document.pointerLockElement)e.stopImmediatePropagation();},true);});
 await p.goto('/?test');await expect(p.locator('#start')).toBeEnabled({timeout:90000});await p.locator('#start').click();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__,s=g.simulationFixture();g.clearWalkers();g.setPlayer(1,18);g.setLook(Math.PI,0);g.setPhase('day');s.spawnTimer=10000;s.player.invulnerable=10000;s.horde.complete=true;});
 const metrics=[];
 for(const id of [...guns,...tools]){
  await p.evaluate(async({id,gun})=>{const s=(window as any).__LAST_NIGHT__.simulationFixture();s.switchTimer=0;s.reloadTimer=0;s.player.ads=false;s.shotTimer=0;if(gun){const {createWeapon,WEAPONS}=await import('/src/game/weapons.ts');s.loadout[WEAPONS[id].slot]=createWeapon(id,122);s.activeSlot=WEAPONS[id].slot;}else{s.gear.owned=[...new Set([...s.gear.owned,id])];s.gear.melee=id;s.activeSlot=id==='fists'?3:2;}},{id,gun:guns.includes(id)});
  await p.waitForTimeout(380);await expect(p.locator('#menu')).toBeHidden();await p.screenshot({path:`${dir}/${label}-${id}.png`});
  const state=await p.evaluate(()=>(window as any).__LAST_NIGHT__.state());metrics.push({id,calls:state.calls,triangles:state.triangles,fps:state.fps});
 }
 await writeFile(`${dir}/${label}.json`,JSON.stringify({viewport:[1600,900],quality:'high',metrics,errors},null,2));expect(errors).toEqual([]);
});
