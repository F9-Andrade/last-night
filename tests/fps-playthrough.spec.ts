import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidenceDir=process.env.FPS_EVIDENCE_DIR??'docs/fps';
// Ordinary run: no scenario hooks, teleports, health/ammo changes or clock acceleration.
// Relative DOM mouse events avoid CDP's paired cursor-warp events under headless Pointer Lock.
test('ordinary FPS exploration with real inventory, streets, shooting and return route',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1280,height:720});await page.addInitScript(()=>localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',shadows:false})));await page.goto('/');await page.locator('#start').press('Enter');
 expect(await page.evaluate(()=>('__LAST_NIGHT__' in window))).toBe(false);await page.waitForFunction(()=>!!document.pointerLockElement);
 await mkdir(evidenceDir,{recursive:true});const snapshots:any[]=[];
 const capture=async(name:string)=>{await page.screenshot({path:`${evidenceDir}/ordinary-${name}.png`,animations:'disabled'});snapshots.push({name,timer:await page.locator('#timer').innerText(),health:await page.locator('#health').innerText(),ammo:await page.locator('#ammo').innerText(),context:await page.locator('#interaction').innerText()});};
 const look=async(dx:number,dy:number)=>page.evaluate(({dx,dy})=>window.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,movementY:dy,bubbles:true})),{dx,dy});
 const walk=async(key:string,ms:number)=>{await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);};
 const shoot=async()=>{await page.evaluate(()=>document.querySelector('canvas')!.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true})));await page.waitForTimeout(250);await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true})));};
 await capture('start');await walk('d',500);await look(350,300);await page.waitForTimeout(500);await capture('supplies');
 if((await page.locator('#interaction').innerText()).includes('VASCULHAR')){await page.keyboard.press('e');await page.waitForTimeout(1200);}
 await page.keyboard.press('Tab');await expect(page.locator('#inventory-panel')).toBeVisible();await capture('inventory');await page.keyboard.press('Tab');
 await look((Math.PI-350*.002)/.002,-300); // Face south toward the central gate.
 await walk('d',450);await walk('w',2500);await capture('street');
 await look(-Math.PI/4/.002,0);await walk('w',2000);await shoot();await shoot();await expect(page.locator('#ammo')).toHaveText('10');await page.keyboard.press('r');await page.waitForTimeout(2000);await capture('combat');
 await page.keyboard.down('Shift');await walk('w',1800);await page.keyboard.up('Shift');await page.keyboard.down('c');await walk('s',1000);await page.keyboard.up('c');
 await page.keyboard.press('m');await expect(page.locator('#map-screen')).toBeVisible();await capture('map');await page.keyboard.press('m');await page.keyboard.press('f');
 await look(Math.PI/.002,0);await walk('w',3800);await look(Math.PI/4/.002,0);await walk('w',2500);await capture('return');
 await page.keyboard.press('Escape');await expect(page.locator('#pause-screen')).toBeVisible();expect(errors).toEqual([]);
 await writeFile(`${evidenceDir}/ordinary-session.json`,JSON.stringify({scenarioHooks:false,clockAcceleration:false,errors,snapshots},null,2));
});
