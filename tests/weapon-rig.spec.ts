import {test,expect} from '@playwright/test';

// Exercise the actual presentation classes without loading Santa Luz or spending
// ammunition. This fixture has no renderer/game loop and needs no Photon room.
test.beforeEach(async({page})=>{
  await page.route('**/weapon-rig-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await page.goto('/weapon-rig-fixture');
  await page.evaluate(async()=>{
    const [{Viewmodel},{Simulation},{WEAPONS,createWeapon},{HAND_GRIP},{MELEE_VISUALS},THREE]=await Promise.all([
      import('/src/render/viewmodel.ts'),import('/src/game/simulation.ts'),import('/src/game/weapons.ts'),
      import('/src/render/hand-assets.ts'),import('/src/render/melee-assets.ts'),import('/node_modules/three/build/three.module.js'),
    ]);
    const camera=new THREE.PerspectiveCamera(75,16/9,.01,1000);
    // Nonidentity world transform catches accidental use of local attachment points.
    camera.position.set(19,2.3,-47);camera.rotation.set(.12,1.1,-.035);camera.updateMatrixWorld(true);
    const state=(sim:any)=>JSON.stringify({
      player:sim.player,stats:sim.stats,kills:sim.kills,baseHP:sim.baseHP,inventory:sim.inventory,loadout:sim.loadout,
      ammo:sim.ammo,reserve:sim.reserve,reloadTimer:sim.reloadTimer,reloadDuration:sim.reloadDuration,
      shotTimer:sim.shotTimer,switchTimer:sim.switchTimer,gear:sim.gear,nutrition:sim.nutrition,events:sim.events,
      cycle:sim.cycle,seed:sim.seed,weapon:sim.weapon,
    });
    const sample=(view:any,sim:any)=>{
      view.scene.updateMatrixWorld(true);
      let armError=0,gripError=0,muzzleError=0,ejectionError=0;
      for(let i=0;i<2;i++) {
        const wrist=view.hands[i],upper=view.upperArms[i],forearm=wrist.children[0];
        forearm.geometry.computeBoundingBox();upper.geometry.computeBoundingBox();
        const elbow=new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld);
        const forearmEnd=new THREE.Vector3(0,0,forearm.geometry.boundingBox.max.z).applyMatrix4(wrist.matrixWorld);
        const shoulder=view.shoulders[i].clone().applyMatrix4(view.rig.matrixWorld);
        const upperEnd=new THREE.Vector3(0,0,upper.geometry.boundingBox.max.z).applyMatrix4(upper.matrixWorld);
        armError=Math.max(armError,forearmEnd.distanceTo(elbow),upperEnd.distanceTo(shoulder));
      }
      if(!sim.meleeMode) {
        const visual=view.current;
        const expected=visual.grip.clone().applyMatrix4(visual.root.matrixWorld);
        gripError=HAND_GRIP.clone().applyMatrix4(view.gloves[0].root.matrixWorld).distanceTo(expected);
        const muzzle=new THREE.Vector3(),ejection=new THREE.Vector3();
        if(!view.getMuzzleWorldPosition(muzzle)||!view.getEjectionWorldPosition(ejection))throw new Error('Equipped firearm lost its attachment points');
        muzzleError=muzzle.distanceTo(visual.muzzle.clone().applyMatrix4(visual.root.matrixWorld));
        ejectionError=ejection.distanceTo(visual.ejection.clone().applyMatrix4(visual.root.matrixWorld));
      }else if(sim.meleeId!=='fists') {
        const mesh=view.meleeMeshes.get(sim.meleeId),anchors=MELEE_VISUALS[sim.meleeId];
        const expected=new THREE.Vector3(...anchors.grip).applyMatrix4(mesh.matrixWorld);
        gripError=HAND_GRIP.clone().applyMatrix4(view.gloves[0].root.matrixWorld).distanceTo(expected);
        if(anchors.supportGrip) {
          const support=new THREE.Vector3(...anchors.supportGrip).applyMatrix4(mesh.matrixWorld);
          gripError=Math.max(gripError,HAND_GRIP.clone().applyMatrix4(view.gloves[1].root.matrixWorld).distanceTo(support));
        }
      }
      let finite=true;view.scene.traverse((node:any)=>{finite&&=node.matrixWorld.elements.every(Number.isFinite);});
      return {armError,gripError,muzzleError,ejectionError,finite};
    };
    (window as any).__weaponRig={Viewmodel,Simulation,WEAPONS,createWeapon,THREE,camera,state,sample};
  });
});

test('all firearms keep wrists on their grips through ADS, recoil, reload and sprint',async({page},testInfo)=>{
  const results=await page.evaluate(()=>{
    const {Viewmodel,Simulation,WEAPONS,createWeapon,camera,state,sample}=(window as any).__weaponRig,results=[];
    for(const id of Object.keys(WEAPONS))for(const mode of ['idle','ads','recoil','reload','sprint'])for(const fps of [30,60,144]) {
      const sim=new Simulation(),view:any=new Viewmodel(),dt=1/fps;
      sim.loadout[WEAPONS[id].slot]=createWeapon(id,11);sim.activeSlot=WEAPONS[id].slot;sim.switchTimer=0;
      sim.player.ads=mode==='ads';sim.player.running=mode==='sprint';sim.player.moving=mode==='sprint';
      const result={id,mode,fps,armError:0,gripError:0,muzzleError:0,ejectionError:0,finite:true,unchanged:true};
      view.update(sim,camera,0,0,true);
      for(let step=0;step<=fps;step++) {
        if(mode==='reload'){sim.reloadDuration=WEAPONS[id].reload;sim.reloadTimer=sim.reloadDuration*(1-step/(fps+1));}
        const before=state(sim);
        if(mode==='recoil'&&step%Math.max(1,Math.round(fps*.3))===0)view.event({type:'shot',from:{x:0,z:0},to:{x:0,z:10},hit:false,weapon:id,primary:true});
        view.update(sim,camera,dt,step*dt,true);
        const measured=sample(view,sim);
        for(const key of ['armError','gripError','muzzleError','ejectionError'])result[key]=Math.max(result[key],measured[key]);
        result.finite&&=measured.finite;result.unchanged&&=before===state(sim);
      }
      results.push(result);
    }
    return results;
  });
  await testInfo.attach('firearm-rig-measurements',{body:JSON.stringify(results,null,2),contentType:'application/json'});
  expect(results.filter(r=>!r.finite||!r.unchanged||r.armError>2e-6||r.gripError>2e-6||r.muzzleError>2e-6||r.ejectionError>2e-6)).toEqual([]);
});

test('all tools and both punches keep connected arms and attached hands during movement and attacks',async({page},testInfo)=>{
  const results=await page.evaluate(()=>{
    const {Viewmodel,Simulation,camera,state,sample,THREE}=(window as any).__weaponRig,results=[];
    for(const id of ['fists','knife','hammer','axe','machete','club','spear'])for(const mode of ['idle','attack','sprint'])for(const fps of [30,60,144]) {
      const sim=new Simulation(),view:any=new Viewmodel(),dt=1/fps;
      sim.gear.owned.push(id);sim.gear.melee=id;sim.activeSlot=id==='fists'?3:2;sim.switchTimer=0;
      sim.player.moving=mode==='sprint';sim.player.running=mode==='sprint';
      const result={id,mode,fps,armError:0,gripError:0,finite:true,unchanged:true,gunHidden:true};
      view.update(sim,camera,0,0,true);
      for(let step=0;step<=fps*2;step++) {
        const before=state(sim);
        if(mode==='attack'&&(step===0||step===fps))view.event({type:id==='hammer'?'build':'melee',position:{x:0,z:0}});
        view.update(sim,camera,dt,step*dt,true);
        const measured=sample(view,sim);
        result.armError=Math.max(result.armError,measured.armError);result.gripError=Math.max(result.gripError,measured.gripError);
        result.finite&&=measured.finite;result.unchanged&&=before===state(sim);
        result.gunHidden&&=!view.getMuzzleWorldPosition(new THREE.Vector3())&&!view.getEjectionWorldPosition(new THREE.Vector3());
      }
      results.push(result);
    }
    return results;
  });
  await testInfo.attach('melee-rig-measurements',{body:JSON.stringify(results,null,2),contentType:'application/json'});
  expect(results.filter(r=>!r.finite||!r.unchanged||!r.gunHidden||r.armError>2e-6||r.gripError>2e-6)).toEqual([]);
});

test('hidden presentation cannot leave a floating muzzle light or expose firearm attachment positions',async({page})=>{
  const result=await page.evaluate(()=>{
    const {Viewmodel,Simulation,THREE,camera,state}=(window as any).__weaponRig,sim=new Simulation(),view:any=new Viewmodel();
    const before=state(sim);view.update(sim,camera,1/60,0,true);
    view.event({type:'shot',from:{x:0,z:0},to:{x:0,z:10},hit:false,weapon:'pistol'});
    view.update(sim,camera,1/60,1/60,true);
    const lit=view.flashLight.intensity>0;
    view.update(sim,camera,1/60,2/60,false);
    return {lit,unchanged:state(sim)===before,light:view.flashLight.intensity,visible:view.anchor.visible,
      muzzle:view.getMuzzleWorldPosition(new THREE.Vector3()),ejection:view.getEjectionWorldPosition(new THREE.Vector3())};
  });
  expect(result).toEqual({lit:true,unchanged:true,light:0,visible:false,muzzle:false,ejection:false});
});

test('axe cutting edge leads away from the survivor in first person and remote swings',async({page})=>{
  const result=await page.evaluate(async()=>{
    const {Viewmodel,Simulation,THREE,camera,sample}=(window as any).__weaponRig;
    const [{RemotePlayers},{MELEE_VISUALS},{HAND_GRIP}]=await Promise.all([
      import('/src/render/remote-players.ts'),import('/src/render/melee-assets.ts'),import('/src/render/hand-assets.ts'),
    ]);
    const sim=new Simulation(),view:any=new Viewmodel(),forward=new THREE.Vector3();
    sim.gear.owned.push('axe');sim.gear.melee='axe';sim.activeSlot=2;
    view.update(sim,camera,0,0,true);view.event({type:'melee',position:sim.player});camera.getWorldDirection(forward);
    let fpsFacing=1,remoteFacing=1,gripError=0,armError=0;
    for(let frame=0;frame<90;frame++){
      view.update(sim,camera,1/60,frame/60,true);view.scene.updateMatrixWorld(true);
      const mesh=view.meleeMeshes.get('axe');
      fpsFacing=Math.min(fpsFacing,new THREE.Vector3(...MELEE_VISUALS.axe.edge).transformDirection(mesh.matrixWorld).dot(forward));
      const measured=sample(view,sim);gripError=Math.max(gripError,measured.gripError);armError=Math.max(armError,measured.armError);
    }
    const scene=new THREE.Scene(),remotes:any=new RemotePlayers(scene);
    const state:any={identity:{actorNumber:2,displayName:'Sobrevivente',isLocal:false},snapshot:{x:0,y:0,z:0,yaw:0,pitch:0,vx:0,vz:0,locomotion:0},gameplay:{life:'alive',hp:100,weapon:'pistol',reload:0,reloadDuration:1,melee:'axe'}};
    for(const yaw of [0,1.7])for(const pitch of [-.6,0,.6]){
      state.snapshot.yaw=yaw;state.snapshot.pitch=pitch;remotes.update([state],0,0,camera);remotes.shot(2);
      for(let frame=0;frame<75;frame++){
        remotes.update([state],frame/60,1/60,camera);scene.updateMatrixWorld(true);
        const avatar=remotes.avatars.get(2),c=avatar.character;c.root.getWorldDirection(forward);
        remoteFacing=Math.min(remoteFacing,new THREE.Vector3(...MELEE_VISUALS.axe.edge).transformDirection(avatar.melee.matrixWorld).dot(forward));
        const palm=HAND_GRIP.clone().applyMatrix4(c.survivorArms[0].hand.root.matrixWorld),haft=new THREE.Vector3(...MELEE_VISUALS.axe.grip).applyMatrix4(avatar.melee.matrixWorld);
        gripError=Math.max(gripError,palm.distanceTo(haft));
      }
    }
    remotes.clear();return {fpsFacing,remoteFacing,gripError,armError};
  });
  expect(result.fpsFacing).toBeGreaterThan(.1);expect(result.remoteFacing).toBeGreaterThan(.1);
  expect(result.gripError).toBeLessThan(2e-6);expect(result.armError).toBeLessThan(2e-6);
});
