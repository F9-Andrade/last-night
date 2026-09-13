import {test,expect} from '@playwright/test';

test('provided recordings decode, follow weapon events, cancel reloads and keep a single positional alarm',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__audio-check',route=>route.fulfill({contentType:'text/html',body:'<button id="start">Start audio</button>'}));
  await page.goto('/__audio-check');
  await page.evaluate(async()=>{
    const {Sound}=await import('/src/game/audio.ts');
    const {Simulation}=await import('/src/game/simulation.ts');
    const sound=new Sound(),sim=new Simulation();
    const starts:any[]=[];
    const original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args:any[]){starts.push({duration:this.buffer?.duration,rate:this.playbackRate.value,loop:this.loop,args});return original.apply(this,args as [number,number,number]);};
    const flush=()=>{for(const event of sim.events)sound.event(event,sim.player);sim.events.length=0;sound.sync(sim);};
    Object.assign(window,{audioCheck:{sound,sim,starts,flush}});
    document.getElementById('start')!.onclick=()=>sound.start();
  });
  await page.locator('#start').click();
  await page.waitForFunction(()=>(window as any).audioCheck.sound.metrics().samplesLoaded.length===6);
  const shot=await page.evaluate(()=>{
    const {sim,sound,flush,starts}=(window as any).audioCheck;
    sim.shoot();flush();return {metrics:sound.metrics(),last:starts.at(-1)};
  });
  expect(shot.metrics.samplesPlaying).toContain('shot');expect(shot.last.loop).toBe(false);expect(shot.last.duration).toBeGreaterThan(.4);
  const reload=await page.evaluate(()=>{
    const {sim,sound,flush,starts}=(window as any).audioCheck;
    sim.reload();flush();return {metrics:sound.metrics(),last:starts.at(-1),duration:sim.reloadDuration};
  });
  expect(reload.metrics.samplesPlaying).toContain('reload');expect(reload.last.duration/reload.last.rate).toBeCloseTo(reload.duration,3);
  await page.evaluate(()=>(window as any).audioCheck.sound.suspend());
  await page.waitForFunction(()=>(window as any).audioCheck.sound.metrics().state==='suspended');
  expect(await page.evaluate(()=>(window as any).audioCheck.sound.metrics().samplesPlaying)).toContain('reload');
  await page.locator('#start').click();
  await page.evaluate(()=>{const {sim,flush}=(window as any).audioCheck;sim.cancelReload();flush();});
  expect(await page.evaluate(()=>(window as any).audioCheck.sound.metrics().samplesPlaying)).not.toContain('reload');
  const empty=await page.evaluate(()=>{
    const {sim,flush,starts}=(window as any).audioCheck;sim.ammo=0;sim.reserve=0;sim.shotTimer=0;sim.shoot();flush();return starts.at(-1);
  });
  expect(empty.args[1]).toBeCloseTo(.375);expect(empty.args[2]).toBeCloseTo(.2);
  await page.evaluate(()=>{const {sim,flush}=(window as any).audioCheck;sim.startAlarm({...sim.player},18);flush();});
  const alarm=await page.evaluate(()=>{
    const {sim,sound,flush,starts}=(window as any).audioCheck;
    for(let i=0;i<20;i++){sound.event({type:'alarm',position:sim.player},sim.player);flush();}
    return {loops:starts.filter((v:any)=>v.loop&&v.duration>2),playing:sound.metrics().samplesPlaying};
  });
  expect(alarm.loops).toHaveLength(1);expect(alarm.playing.filter((id:string)=>id==='alarm')).toHaveLength(1);
  await page.evaluate(()=>{const {sim,flush}=(window as any).audioCheck;sim.alarmTimer=0;flush();});
  expect(await page.evaluate(()=>(window as any).audioCheck.sound.metrics().samplesPlaying)).not.toContain('alarm');
  await page.evaluate(()=>{const {sim,flush,sound}=(window as any).audioCheck;sim.startAlarm({...sim.player},18);flush();sound.reset();});
  expect(await page.evaluate(()=>(window as any).audioCheck.sound.metrics().samplesPlaying)).toEqual([]);
  const groans=await page.evaluate(()=>{
    const {sim,sound}=(window as any).audioCheck;
    sim.zombies=[];sim.player.x=88;sim.player.z=-30;sim.spawn({x:88,z:-25});
    for(let i=0;i<20;i++)sound.threats(10,sim);
    return sound.metrics().samplesPlaying;
  });
  expect(groans.filter((id:string)=>id==='zombie-call')).toHaveLength(1);
  await page.evaluate(()=>{const {sim,sound}=(window as any).audioCheck;sound.reset();sim.player.x=-88;sound.threats(10,sim);});
  expect(await page.evaluate(()=>(window as any).audioCheck.sound.metrics().samplesPlaying)).toEqual([]);
  const melee=await page.evaluate(()=>{
    const {sim,sound,flush}=(window as any).audioCheck;
    sim.zombies=[];sim.player.x=88;sim.player.z=-30;sim.setPhase('dusk');
    const zombie=sim.spawn({x:88,z:-29});zombie.attack=0;
    sim.update(.1,{moveX:0,moveZ:0,aimX:88,aimZ:-40,fire:false,run:false,reload:false,interact:false});
    const attacks=sim.events.filter((event:any)=>event.type==='enemy-attack');flush();
    return {attacks,hp:sim.player.hp,playing:sound.metrics().samplesPlaying};
  });
  expect(melee.attacks).toHaveLength(1);expect(melee.hp).toBeLessThan(100);expect(melee.playing).toContain('zombie-attack');
  const crowd=await page.evaluate(()=>{
    const {sim,sound}=(window as any).audioCheck;
    for(let i=0;i<40;i++)sound.event({type:'enemy-attack',position:sim.player,enemy:'walker'},sim.player);
    return sound.metrics().samplesPlaying;
  });
  expect(crowd.filter((id:string)=>id==='zombie-attack')).toHaveLength(2);
  await page.evaluate(()=>{const {sim,sound}=(window as any).audioCheck;sound.reset();sound.event({type:'enemy-attack',position:{x:-88,z:80},enemy:'walker'},sim.player);});
  expect(await page.evaluate(()=>(window as any).audioCheck.sound.metrics().samplesPlaying)).toEqual([]);
  expect(await page.evaluate(()=>(window as any).audioCheck.sound.metrics().peak)).toBeLessThanOrEqual(16);
  expect(errors).toEqual([]);
});

test('game reload, car interaction and nearby zombie combat use the local recordings',async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width:960,height:600});
  await page.addInitScript(()=>localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',shadows:false})));
  await page.goto('/?test');await page.locator('#start').click();
  await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().audio.samplesLoaded.length===6);
  await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPhase('dusk');});
  await page.mouse.click(420,350);await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().ammo===11);
  await page.keyboard.press('r');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().audio.samplesPlaying.includes('reload'));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().audio.state==='suspended');
  await page.locator('#resume').click();await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().ammo===12);
  await page.waitForFunction(()=>!(window as any).__LAST_NIGHT__.state().audio.samplesPlaying.includes('reload'));
  await page.evaluate(async()=>{const {ALARMS}=await import('/src/game/districts.ts');(window as any).__LAST_NIGHT__.setPlayer(ALARMS[0].x,ALARMS[0].z);});
  await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().audio.samplesPlaying.includes('alarm'));
  await expect(page.locator('#interaction')).toContainText('DESLIGAR ALARME');
  await page.keyboard.press('e');await page.waitForFunction(()=>!(window as any).__LAST_NIGHT__.state().audio.samplesPlaying.includes('alarm'));
  await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.setPlayer(88,-30);g.spawn(88,-24);});
  await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().audio.samplesPlaying.includes('zombie-call'));
  await page.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.clearWalkers();g.spawn(88,-29);});
  await page.waitForFunction(()=>(window as any).__LAST_NIGHT__.state().audio.samplesPlaying.includes('zombie-attack'));
  expect(await page.evaluate(()=>(window as any).__LAST_NIGHT__.state().player.hp)).toBeLessThan(100);

});
