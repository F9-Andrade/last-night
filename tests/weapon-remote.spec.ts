import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
test('remote survivors retain detailed equipment grips and pickup finishes',async({page})=>{
 await page.setViewportSize({width:1100,height:1000});await page.goto('/?test');
 await expect(page.locator('#start')).toBeEnabled({timeout:90000});
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js'),{RemotePlayers}=await import('/src/render/remote-players.ts');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x393f3d);
  const camera=new THREE.PerspectiveCamera(35,1.1,.05,40);camera.position.set(3.4,2.4,4.4);camera.lookAt(0,1.12,.15);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1100,1000);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.id='remote-review';Object.assign(renderer.domElement.style,{position:'fixed',inset:'0',zIndex:'100000'});document.body.append(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xd8e4eb,0x55513d,2));const light=new THREE.DirectionalLight(0xffe4bf,3.2);light.position.set(2,5,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-3;light.shadow.camera.right=3;light.shadow.camera.top=3;light.shadow.camera.bottom=-3;light.shadow.normalBias=.015;scene.add(light);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0x4b4e43,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const remotes=new RemotePlayers(scene),state:any={identity:{actorNumber:2,displayName:'Sobrevivente',isLocal:false},snapshot:{x:0,y:0,z:0,yaw:0,pitch:0,vx:0,vz:0,locomotion:0},gameplay:{life:'alive',hp:100,weapon:'pistol',reload:0,reloadDuration:1}};
  (window as any).__REMOTE_REVIEW__={scene,camera,renderer,remotes,state};
 });
 await mkdir('docs/weapon-design',{recursive:true});
 for(const equipment of ['pistol','rifle','axe','spear','hammer','fists']){
  const result=await page.evaluate((equipment)=>{
   const {scene,camera,renderer,remotes,state}=(window as any).__REMOTE_REVIEW__;
   state.gameplay.weapon=equipment==='rifle'?'rifle':'pistol';state.gameplay.melee=['pistol','rifle'].includes(equipment)?undefined:equipment;
   remotes.update([state],0,1/60,camera);scene.updateMatrixWorld(true);renderer.render(scene,camera);
   const c=remotes.avatars.get(2).character;let meshes=0;c.root.traverse((o:any)=>{if(o.isMesh)meshes++;});return {meshes,scale:c.weapon.scale.x};
  },equipment);
  expect(result.meshes).toBeLessThan(30);expect(result.scale).toBeLessThan(1);
  await page.locator('#remote-review').screenshot({path:`docs/weapon-design/remotes-${equipment}.png`});
 }
});
