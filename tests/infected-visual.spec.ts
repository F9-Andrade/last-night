import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.INFECTED_EVIDENCE_DIR??'test-results/infected';
test('five infected models share bounded geometry and keep their articulated parts',async({page})=>{
 await page.setViewportSize({width:1600,height:900});
 await page.route('**/infected-gallery',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#191d1e"></body></html>'}));
 await page.goto('/infected-gallery');
 const metrics=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Character}=await import('/src/render/models.ts');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1600,900);renderer.setPixelRatio(1);renderer.toneMapping=T.AgXToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0x191d1e);
  const camera=new T.PerspectiveCamera(35,1600/900,.1,100);camera.position.set(0,3.2,13.5);camera.lookAt(0,1.2,0);
  scene.add(new T.HemisphereLight(0xc6d4dd,0x39352e,1.25));const sun=new T.DirectionalLight(0xffd4a4,3.8);sun.position.set(-5,8,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:8,bottom:-8});sun.shadow.normalBias=.02;scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0x3e4140,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const result=[];
  for(const [i,kind] of ['walker','runner','tank','spitter','screamer'].entries()){
   const c=new Character(true,i%3);c.setKind(kind);c.animate(1.8,false,false,0);c.root.position.set((i-2)*2.25,.1,0);c.root.rotation.y=-.12;scene.add(c.root);
   let triangles=0,meshes=0;c.root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??0)/3;meshes++;}});result.push({kind,triangles,meshes});
  }
  await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
  (window as any).__infectedGallery={renderer,scene,camera};
  const info=renderer.getContext().getExtension('WEBGL_debug_renderer_info');
  return {models:result,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,gpu:info?renderer.getContext().getParameter(info.UNMASKED_RENDERER_WEBGL):'unknown'};
 });
 await mkdir(output,{recursive:true});await page.screenshot({path:`${output}/lineup.png`});await writeFile(`${output}/geometry.json`,JSON.stringify(metrics,null,2));
 await page.evaluate(()=>{const {renderer,scene,camera}=(window as any).__infectedGallery;camera.position.set(-3.4,2.1,3.1);camera.lookAt(-4.5,1.25,0);renderer.render(scene,camera);});
 await page.screenshot({path:`${output}/walker-close.png`});
 const falling=await page.evaluate(async()=>{
  const {renderer,scene,camera}=(window as any).__infectedGallery;
  for(const object of [...scene.children])if(object.name.startsWith('voxel-'))scene.remove(object);
  const {CorpseView}=await import('/src/render/corpses.ts');
  const view=new CorpseView(scene),bodies=['walker','runner','tank','spitter','screamer'].map((kind,i)=>({id:i+10,x:(i-2)*2.25,z:0,kind,variant:i%3,age:0,angle:0,fall:0,wounds:[{zone:'HEAD',side:1,y:1.8}]}));
  camera.position.set(0,5,12);camera.lookAt(0,.6,0);(window as any).__ragdollGallery={view,bodies};
  view.update(bodies);renderer.render(scene,camera);return renderer.info.render.calls;
 });
 for(const age of [.25,.6,1.2,2.4]){
  await page.evaluate(age=>{const {view,bodies}=(window as any).__ragdollGallery,{renderer,scene,camera}=(window as any).__infectedGallery;for(const b of bodies)b.age=age;view.update(bodies);renderer.render(scene,camera);},age);
  await page.screenshot({path:`${output}/death-${age}.png`});
 }
 const sleeping=await page.evaluate(()=>{const {renderer,scene,camera}=(window as any).__infectedGallery;const {view,bodies}=(window as any).__ragdollGallery;view.update(bodies);renderer.render(scene,camera);return renderer.info.render.calls;});
 expect(sleeping).toBeLessThan(falling);
 await writeFile(`${output}/ragdoll.json`,JSON.stringify({fallingCalls:falling,sleepingCalls:sleeping},null,2));
 const stress=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{CorpseView}=await import('/src/render/corpses.ts');
  const scene=new T.Scene(),view=new CorpseView(scene),bodies=Array.from({length:80},(_,i)=>({id:100+i,x:88+(i%10)*.5,z:-30-Math.floor(i/10)*.5,kind:['walker','runner','tank','spitter','screamer'][i%5],variant:i%3,age:0,angle:i*.2,fall:i*.4,wounds:[]}));
  for(const kind of ['walker','runner','tank','spitter','screamer'])view.prepareKind(kind);
  const times:number[]=[];
  for(let frame=0;frame<=145;frame++){for(const b of bodies)b.age=frame/60;const start=performance.now();view.update(bodies);times.push(performance.now()-start);}
  const count=scene.children.length;
  view.update([]);for(const b of bodies){b.id+=100;b.age=3;}view.update(bodies);
  if(scene.children.length!==count)throw new Error('Corpse slots were not recycled');
  for(let i=0;i<20;i++)view.update(bodies); // Drain the four-per-frame merge budget before measuring sleeping bodies.
  const start=performance.now();for(let i=0;i<120;i++)view.update(bodies);const sleepingMs=(performance.now()-start)/120;
  const initialMs=times[0],settleMs=times[144];times.sort((a,b)=>a-b);return {bodies:80,initialMs,settleMs,activeP95Ms:times[Math.floor(times.length*.95)],peakMs:times.at(-1),sleepingMeanMs:sleepingMs,slotsReused:true};
 });
 await writeFile(`${output}/ragdoll-stress.json`,JSON.stringify(stress,null,2));
 expect(metrics.models.every(m=>m.meshes===7&&m.triangles<10000)).toBe(true);
});
