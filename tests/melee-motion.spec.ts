import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
test('first-person punch guard, alternating strikes and firearm return',async({page:p})=>{
 const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewportSize({width:1600,height:900});await p.addInitScript(()=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'medium',master:0}));window.addEventListener('mousemove',e=>{if(document.pointerLockElement)e.stopImmediatePropagation();},true);});await p.goto('/?test');await expect(p.locator('#start')).toBeEnabled({timeout:90000});await p.locator('#start').click();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});
 await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('day');g.setPlayer(1,18);g.setLook(Math.PI,0);});await p.keyboard.press('4');await expect.poll(()=>p.evaluate(()=>(window as any).__LAST_NIGHT__.state().activeSlot)).toBe(3);await p.waitForTimeout(400);
 await mkdir('test-results/melee',{recursive:true});await p.screenshot({path:'test-results/melee/guard.png'});
 for(const side of ['left','right']){await p.mouse.down();await p.mouse.up();await p.waitForTimeout(110);await p.screenshot({path:`test-results/melee/${side}-strike.png`});await expect.poll(()=>p.evaluate(()=>(window as any).__LAST_NIGHT__.state().shotTimer)).toBe(0);}
 await p.waitForTimeout(100);await p.screenshot({path:'test-results/melee/recovered.png'});await p.keyboard.press('2');await p.waitForTimeout(400);await p.mouse.down({button:'right'});await p.mouse.down();await p.mouse.up();await p.mouse.up({button:'right'});await expect(p.locator('#ammo')).toHaveText('11');expect(errors).toEqual([]);
 // Sample the actual render rig for all melee tools. Check the sleeve/forearm join
 // and fixed shoulder, rather than only the math helper.
 const gaps=await p.evaluate(async()=>{
  const {Viewmodel}=await import('/src/render/viewmodel.ts'),{Simulation}=await import('/src/game/simulation.ts'),THREE=await import('/node_modules/three/build/three.module.js');
  const sim=new Simulation(),rig:any=new Viewmodel(),camera=new THREE.PerspectiveCamera();sim.activeSlot=2;const result:number[]=[];
  for(const id of ['fists','club','knife','axe','spear','machete']){sim.gear.melee=id;rig.event({type:'melee',position:sim.player});for(let frame=0;frame<60;frame++){rig.update(sim,camera,1/60,0,true);rig.scene.updateMatrixWorld(true);for(const [i,hand] of [rig.right,rig.left].entries()){const end=new THREE.Vector3(0,0,.425).applyMatrix4(hand.matrixWorld),elbow=new THREE.Vector3().setFromMatrixPosition(rig.upperArms[i].matrixWorld);result.push(end.distanceTo(elbow));}}}
  return result;
 });expect(Math.max(...gaps)).toBeLessThan(.00001);
});
test('remote melee stays anchored at shoulders and restores firearm pose',async({page:p})=>{
 await p.goto('/?test');await expect(p.locator('#start')).toBeEnabled({timeout:90000});
 const result=await p.evaluate(async()=>{
  const {RemotePlayers}=await import('/src/render/remote-players.ts'),THREE=await import('/node_modules/three/build/three.module.js');
  const remotes:any=new RemotePlayers(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
  const state:any={identity:{actorNumber:2,displayName:'Teste',isLocal:false},snapshot:{x:0,y:0,z:0,yaw:0,pitch:.7,vx:0,vz:0,locomotion:0},gameplay:{life:'alive',hp:100,weapon:'pistol',melee:'fists',reload:0,reloadDuration:1}};
  let error=0,attached=true;
  for(const id of ['fists','club','knife','axe','spear','machete']){
   state.gameplay.melee=id;remotes.update([state],0,0,camera);remotes.shot(2);
   for(let f=0;f<60;f++){
    remotes.update([state],f/60,1/60,camera);const avatar=remotes.avatars.get(2),c=avatar.character;c.root.updateMatrixWorld(true);
    for(const arm of [c.leftArm,c.rightArm]){const actual=arm.getWorldPosition(new THREE.Vector3()),expected=arm.position.clone().applyMatrix4(c.body.matrixWorld);error=Math.max(error,actual.distanceTo(expected));}
    if(id!=='fists')attached=attached&&avatar.melee.parent===c.rightArm;
   }
  }
  state.gameplay.melee=undefined;remotes.update([state],0,1/60,camera);const c=remotes.avatars.get(2).character;
  c.root.updateMatrixWorld(true);
  const palm=new THREE.Vector3(0,-.018,-.065).applyMatrix4(c.survivorArms[1].hand.root.matrixWorld);
  const contact=c.heldVisual.supportGrip.clone().applyMatrix4(c.weapon.matrixWorld);
  const restored=c.weapon.visible&&palm.distanceTo(contact)<.00001;remotes.clear();return {error,attached,restored};
 });expect(result.error).toBeLessThan(.00001);expect(result.attached).toBe(true);expect(result.restored).toBe(true);
});
