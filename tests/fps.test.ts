import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FPS,MouseLook,lookDirection,relativeMovement} from '../src/game/first-person.ts';
import {Simulation} from '../src/game/simulation.ts';
import type {InputCommand} from '../src/game/simulation.ts';
import {rayBox,rayWorld,collides,move,floorHeight} from '../src/game/world.ts';
import {interactionFocus} from '../src/game/interaction.ts';
import {createWeapon,WEAPONS} from '../src/game/weapons.ts';
import type {WeaponId} from '../src/game/weapons.ts';
import {sanitizeSettings} from '../src/game/settings.ts';
const input:InputCommand={moveX:0,moveZ:0,aimX:0,aimZ:0,yaw:Math.PI,pitch:0,fire:false,run:false,reload:false,interact:false};
function sim(){const s=new Simulation();s.zombies=[];s.spawnTimer=999;s.player.x=88;s.player.z=-30;s.firstPerson=true;s.player.angle=Math.PI;s.player.eyeY=FPS.eyeHeight+floorHeight(s.player);return s;}
function step(s:Simulation,t:number,cmd:Partial<InputCommand>={}){for(let i=0;i<Math.ceil(t*60);i++)s.update(1/60,{...input,...cmd});}

test('mouse look turns freely and clamps pitch without a delayed camera',()=>{const l=new MouseLook();l.move(100,-100);assert.ok(l.yaw<Math.PI&&l.pitch>0);l.move(0,-100000);assert.equal(l.pitch,FPS.pitchLimit);l.move(0,200000);assert.equal(l.pitch,-FPS.pitchLimit);for(let i=0;i<100;i++)l.move(100,0);assert.ok(Number.isFinite(l.yaw));});
test('WASD is relative to look and never faster diagonally',()=>{for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){const d=lookDirection(yaw,0),m=relativeMovement(yaw,0,1);assert.ok(Math.abs(m.x-d.x)<1e-8&&Math.abs(m.z-d.z)<1e-8);assert.ok(Math.hypot(...Object.values(relativeMovement(yaw,1,1)))<=1);}assert.ok(relativeMovement(Math.PI,1,0).x>0);});
test('3D rays pass above low furniture but stop at walls, ceilings and floors',()=>{const origin={x:88,y:1.74,z:-30},dir={x:0,y:0,z:-1};assert.equal(rayBox(origin,dir,{x:88,z:-32,w:2,d:1,h:1},10),Infinity);assert.equal(rayBox(origin,dir,{x:88,z:-32,w:2,d:1,h:3},10),1.5);assert.ok(rayWorld(origin,{x:0,y:-1,z:0},10)<2);assert.ok(rayWorld({x:112,y:1.8,z:-112},{x:0,y:1,z:0},20)<5);});
test('movement sweeps large displacements and slides without tunneling',()=>{const p={x:88,z:-30};move(p,4,4,.4,[{x:89,z:-28,w:.1,d:10}]);assert.ok(p.x<88.56&&p.z>-27);assert.equal(collides(p,.4,[{x:89,z:-28,w:.1,d:10}]),false);});
test('crouch lowers eyes, slows movement and prevents standing beneath a tent',()=>{const s=sim();step(s,.5,{crouch:true,moveZ:-1});assert.ok(s.player.crouched&&s.player.eyeY<1.2);assert.ok(s.player.z>-31.3);s.player.x=106;s.player.z=125;step(s,.2);assert.ok(s.player.crouched);s.player.x=114;s.player.z=134;step(s,.3);assert.equal(s.player.crouched,false);});
test('ADS cancels sprint; sprint blocks shooting and reload',()=>{const s=sim();step(s,.05,{ads:true,moveZ:-1});assert.ok(s.player.ads&&!s.player.running);const ammo=s.ammo;step(s,.2,{run:true,moveZ:-1,fire:true});assert.ok(s.player.running&&!s.player.ads);assert.equal(s.ammo,ammo);});
test('held sprint remains exhausted without frame-by-frame oscillation in FPS',()=>{const s=sim();let changes=0,last=false;for(let i=0;i<600;i++){s.update(1/60,{...input,moveZ:-1,run:true});if(s.player.running!==last)changes++;last=s.player.running;}assert.ok(changes<10);assert.ok(s.player.z<-45);});
for(const id of Object.keys(WEAPONS) as WeaponId[])test(`${id}: FPS head ray, ammo, recoil, reload and empty event`,()=>{const s=sim(),gun=createWeapon(id,100);s.loadout[WEAPONS[id].slot]=gun;s.activeSlot=WEAPONS[id].slot;s.ammo=WEAPONS[id].magazine;s.reserve=60;s.player.ads=true;s.player.pitch=Math.atan2(1.94-s.player.eyeY,5);const z=s.spawn({x:88,z:-35})!;s.shoot();assert.ok(z.hp<90,`${id} must hit camera target`);assert.ok(s.events.some(e=>e.type==='shot'&&e.hit&&e.zone==='HEAD'));assert.ok(s.player.aimKick>0);assert.equal(s.ammo,WEAPONS[id].magazine-1);s.reload();assert.ok(s.reloadTimer);step(s,WEAPONS[id].reload+.1);assert.equal(s.ammo,WEAPONS[id].magazine);s.ammo=0;s.reserve=0;s.shotTimer=0;s.events=[];s.shoot();assert.ok(s.events.some(e=>e.type==='empty'));});
test('FPS shotgun produces eight pellets and can interrupt a shell reload',()=>{const s=sim();s.loadout[0]=createWeapon('shotgun',1);s.activeSlot=0;s.ammo=1;s.reserve=10;s.reload();s.shoot();assert.equal(s.reloadTimer,0);assert.equal(s.events.filter(e=>e.type==='shot').length,8);assert.equal(s.ammo,0);});
test('camera target cannot be shot through an obstructed muzzle',()=>{const s=sim();s.player.x=112;s.player.z=-97.9;s.player.angle=Math.PI;s.player.eyeY=1.94;const z=s.spawn({x:112,z:-103})!;s.shoot();assert.equal(z.hp,90);assert.ok(s.events.some(e=>e.type==='shot'&&!e.hit));});
test('look interaction selects one reachable object and rejects behind/far objects',()=>{const s=sim();const loot=s.loot.find(l=>l.id==='base-ammo')??s.loot[0];s.player.x=loot.x;s.player.z=loot.z+2;s.player.eyeY=1.94;s.player.pitch=Math.atan2(.7-1.94,2);s.player.angle=Math.PI;s.focus=interactionFocus(s);assert.equal(s.focus?.kind,'loot');assert.equal(s.nearbyLoot?.id,loot.id);s.player.angle=0;s.focus=interactionFocus(s);assert.notEqual(s.focus?.id,loot.id);s.player.z=loot.z+10;s.player.angle=Math.PI;s.focus=interactionFocus(s);assert.notEqual(s.focus?.id,loot.id);});
test('closed door occludes loot; interacting opens a real route',()=>{const s=sim();s.player.x=112;s.player.z=-97;s.player.angle=Math.PI;s.player.pitch=0;s.player.eyeY=1.94;s.focus=interactionFocus(s);assert.equal(s.focus?.id,'hospital-main-front');step(s,.05,{interact:true});step(s,.8);assert.equal(s.portals.find(p=>p.id==='hospital-main-front')!.state,'open');});
test('settings migrate old saves and bound new accessibility values',()=>{const s=sanitizeSettings({fov:200,headBob:-2,sensitivity:0,ambient:120});assert.equal(s.fov,105);assert.equal(s.headBob,0);assert.equal(s.sensitivity,.25);assert.equal(s.ambient,100);assert.equal(sanitizeSettings({}).fov,FPS.fov);});
test('settings retain every quality preset across saved settings and reject invalid values',()=>{
 for(const quality of ['low','medium','high','ultra']){
  const saved=JSON.parse(JSON.stringify({...sanitizeSettings({}),quality,shadows:false}));
  assert.equal(sanitizeSettings(saved).quality,quality);
  assert.equal(sanitizeSettings(saved).shadows,false);
 }
 for(const quality of [undefined,null,'cinematic',3,{},['ultra']])assert.equal(sanitizeSettings({quality}).quality,'high');
 assert.equal(sanitizeSettings(null).quality,'high');
});

for(const kind of ['walker','runner','tank','spitter','screamer'] as const)test(`${kind}: FPS anatomical wounds, head reaction and corpse retain enemy identity`,async()=>{
 const {ENEMIES}=await import('../src/game/enemies.ts');const s=sim(),shape=ENEMIES[kind],z=s.spawn({x:88,z:-34},kind)!;
 s.player.pitch=Math.atan2(1.22*shape.scaleY-s.player.eyeY,4);s.shoot();assert.ok(z.wounds.length>0&&z.hp<shape.hp);
 for(let i=0;i<6&&z.active;i++){s.shotTimer=0;s.player.aimKick=0;s.player.angle=Math.atan2(z.x-s.player.x,z.z-s.player.z);s.player.pitch=Math.atan2(shape.headY-s.player.eyeY,Math.hypot(z.x-s.player.x,z.z-s.player.z));s.shoot();}
 assert.equal(z.active,false);assert.ok(s.stats.headshots>0);assert.equal(s.corpses.bodies.at(-1)?.kind,kind);assert.ok(s.corpses.bodies.at(-1)?.wounds.some(w=>w.zone==='HEAD'));
});

test('low shelter blocks standing entry but allows crouched passage and blocks upward shots',()=>{
 const standing={x:106,z:132};move(standing,0,-8,FPS.radius,[],FPS.bodyHeight);assert.ok(standing.z>=127.9);
 const crouched={x:106,z:132};move(crouched,0,-6,FPS.radius,[],FPS.crouchEye+.15);assert.ok(crouched.z<127);
 assert.ok(rayWorld({x:106,y:1.3,z:125},{x:0,y:1,z:0},10)<.6);
});

test('FPS gaze ignores empty anchors but repairs and dismantles existing legacy shelter defenses',()=>{
 const s=sim();s.player.x=1;s.player.z=7.2;s.player.eyeY=1.94;s.inventory.items.wood=12;s.inventory.items.scrap=8;
 const pitch=Math.atan2(.2-1.94,1.8);step(s,.1,{yaw:0,pitch});assert.notEqual(s.focus?.id,'gate');step(s,.02,{yaw:0,pitch,interact:true});step(s,1.4,{yaw:0,pitch});
 const gate=s.barricades.find(b=>b.id==='gate')!;assert.equal(gate.hp,0);assert.equal(s.inventory.items.wood,12);gate.hp=300;gate.built=true;
 s.damageBarricade(gate,100);step(s,.02,{yaw:0,pitch:-.4,interact:true,heldInteract:true});step(s,2.2,{yaw:0,pitch:-.4,heldInteract:true});assert.equal(gate.hp,290);
 step(s,.02,{yaw:0,pitch:-.4,dismantle:true});step(s,2,{yaw:0,pitch:-.4});assert.equal(gate.hp,0);
});
