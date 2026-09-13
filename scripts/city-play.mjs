// Manual browser-control harness: normal URL, keyboard/pointer input and visible HUD only.
import {chromium} from '@playwright/test';
import {createInterface} from 'node:readline';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:600}});const log=[];const started=Date.now();let shot=0;
page.on('pageerror',e=>log.push({error:e.message}));await page.goto('http://127.0.0.1:5173/');await page.locator('#start').click();await page.keyboard.press('Escape');await page.locator('#quality').click();await page.locator('#resume').click();
const snapshot=async(label)=>{const path=`docs/city/walk-${String(shot++).padStart(2,'0')}.png`;await page.screenshot({path,animations:'disabled'});if(!await page.locator('#game-over').isVisible()&&!await page.locator('#map-screen').isVisible())await page.keyboard.press('Escape');const visible=await page.locator('#app').innerText();log.push({wallSeconds:Math.round((Date.now()-started)/1000),label,path,visible});writeFileSync('docs/city/ordinary-walk.json',JSON.stringify(log,null,2));console.log(JSON.stringify({label,path,visible}));};
await snapshot('Início: sair do pátio e seguir pela avenida leste');
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
 try{const c=JSON.parse(line);if(await page.locator('#pause-screen').isVisible())await page.locator('#resume').click();if(c.exit){await snapshot('Fim da exploração manual');await browser.close();break;}if(c.retry)await page.locator('#retry').click();if(c.keys){for(const k of c.keys)await page.keyboard.down(k);await page.waitForTimeout(c.ms??1000);for(const k of c.keys)await page.keyboard.up(k);}if(c.tap)await page.keyboard.press(c.tap);if(c.click){for(let i=0;i<(c.count??1);i++){await page.mouse.click(...c.click);await page.waitForTimeout(c.gap??260);}}if(c.wait)await page.waitForTimeout(c.wait);await snapshot(c.label??'Observação');}catch(e){console.log(String(e));}
}
