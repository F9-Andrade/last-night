import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation.ts';
import {CITY_SITES,CITY_PORTALS,CITY_LOOT,CITY_LIMIT,activeCityChunks} from '../src/game/city.ts';
import {cityEncounter,SCREAM} from '../src/game/city-director.ts';
import {collides,findPath,distance,BASE,wallDistance} from '../src/game/world.ts';
import {BALANCE} from '../src/game/config.ts';
import {ENCOUNTERS} from '../src/game/districts.ts';
import {CACHE_STORIES} from '../src/game/expedition.ts';
import {createWeapon} from '../src/game/weapons.ts';
const idle={moveX:0,moveZ:0,aimX:1,aimZ:15,fire:false,run:false,reload:false,interact:false};
function clean(city=false){const s=new Simulation();s.zombies=[];s.spawnTimer=99999;s.eventTimer=99999;s.roamTimer=99999;s.encounters=new Set(ENCOUNTERS.map((_,i)=>i));if(!city)s.activatedSites=new Set(CITY_SITES.map(s=>s.id));return s;}
function step(s:Simulation,t:number,input=idle){for(let i=0;i<Math.ceil(t*60);i++)s.update(1/60,input);}
function use(s:Simulation,key:'interact'|'dismantle'='interact'){s.update(1/60,{...idle,[key]:true});step(s,5.2);}
test('city has 4x useful area, distinct sites, two entrances and reachable loot in every room',()=>{
 assert.equal((CITY_LIMIT/78)**2,4);assert.equal(CITY_SITES.length,18);assert.equal(CITY_PORTALS.length,36);assert.equal(CITY_LOOT.length,54);
 for(const site of CITY_SITES){const entry={x:site.x,z:site.z+site.d/2+2};assert.ok(findPath(BASE,entry).length,site.id);assert.ok(site.props.length>=3);for(const loot of CITY_LOOT.filter(l=>l.site===site.id)){assert.equal(collides(loot,.45),false,loot.id);assert.ok(findPath(entry,loot).length,loot.id);}}
 assert.ok(distance(BASE,CITY_SITES[1])>150);assert.ok(activeCityChunks(1,7).length<CITY_SITES.length/2);
});
test('closed portals stop travel and bullets; real action opens, boards, breaks and retry resets',()=>{
 const s=clean(),p=s.portals.find(p=>p.id==='hospital-main-front')!;Object.assign(s.player,{x:p.x,z:p.z+1.5});assert.ok(collides(p,.45,s.solidDefenses));assert.ok(wallDistance(s.player,{x:0,z:-1},4,s.solidDefenses)<2);
 use(s);assert.equal(p.state,'open');assert.ok(!collides(p,.45,s.solidDefenses));s.inventory.items.wood=4;use(s,'dismantle');assert.equal(p.state,'barred');assert.equal(s.inventory.items.wood,2);s.damageBarricade(p,180);assert.equal(p.state,'open');assert.equal(clean().portals.find(a=>a.id===p.id)!.state,'closed');
});
test('window breaks on unobstructed shot, never behind a nearer victim; wooden boards resist a bullet',()=>{
 const s=clean(),p=s.portals.find(p=>p.id==='hospital-main-side')!;Object.assign(s.player,{x:p.x+6,z:p.z});s.player.angle=-Math.PI/2;const z=s.spawn({x:p.x+3,z:p.z})!;s.shoot();assert.equal(p.state,'closed');z.active=false;s.shotTimer=0;s.shoot();assert.equal(p.state,'open');p.state='barred';p.hp=180;s.shotTimer=0;s.shoot();assert.equal(p.state,'barred');
});
test('Screamer telegraphs, calls existing actors once, respects cooldown and cannot chain spawn',()=>{
 const s=clean(),screamer=s.spawn({x:1,z:15},'screamer')!,heard=s.spawn({x:36,z:15})!;step(s,.05);assert.ok(screamer.screamTimer);assert.equal(heard.hearing,0);const n=s.nextId;step(s,SCREAM.windup+.1);assert.equal(s.events.filter(e=>e.type==='scream').length,1);assert.ok(heard.hearing>0);assert.equal(s.nextId,n);step(s,3);assert.equal(s.events.filter(e=>e.type==='scream').length,1);
});
test('Screamer is interrupted by a torso hit and cannot see through the shelter',()=>{
 const s=clean(),z=s.spawn({x:1,z:14},'screamer')!;step(s,.05);assert.ok(z.screamTimer);s.player.angle=0;s.shoot();assert.equal(z.screamTimer,0);assert.ok(z.screamCooldown!>0);step(s,1.5);assert.equal(s.events.filter(e=>e.type==='scream').length,0);
 const blocked=clean();blocked.spawn({x:1,z:-12},'screamer');step(blocked,.1);assert.equal(blocked.events.filter(e=>e.type==='scream-ready').length,0);
});
test('local encounters activate outside view once; visited rooms never roll delayed guards',()=>{
 const s=clean(true);s.player.x=80;s.player.z=-112;s.spawnBlockedByView=p=>distance(p,s.player)<20;step(s,.6);assert.ok(s.activatedSites.has('hospital-main'));assert.ok(s.zombies.some(z=>z.kind==='screamer'));for(const z of s.zombies)assert.ok(distance(z,s.player)>19);const count=s.nextId;s.zombies=[];step(s,1);assert.equal(s.nextId,count);
 const visited=clean(true);visited.player.x=112;visited.player.z=-108;visited.spawnBlockedByView=()=>true;step(visited,.6);assert.ok(visited.discoveredSites.has('hospital-main'));visited.spawnBlockedByView=()=>false;visited.player.x=80;step(visited,.6);assert.ok(visited.activatedSites.has('hospital-main'));assert.ok(!visited.zombies.some(z=>Math.abs(z.x-112)<15&&Math.abs(z.z+112)<13));
});
test('dormant actors retain damage and IDs, restore into dead slots and respect shared body cap',()=>{
 const s=clean();const z=s.spawn({x:1,z:16})!;z.hp=37;Object.assign(s.player,{x:140,z:0});step(s,.6);assert.ok(s.dormantZombies.some(a=>a.id===z.id));s.zombies=Array.from({length:40},(_,i)=>({...z,id:100+i,active:false}));Object.assign(s.player,{x:1,z:7});step(s,.6);assert.equal(s.zombies.length,40);assert.equal(s.zombies.find(a=>a.id===z.id)!.hp,37);assert.equal(s.dormantZombies.length,0);
});
test('roaming packs have ten mobile walkers and cannot appear inside camera or houses',()=>{
 const s=clean();Object.assign(s.player,{x:88,z:-30});s.spawnBlockedByView=p=>distance(p,s.player)<24;assert.equal(s.spawnRoaming(),10);const starts=s.zombies.map(z=>({...z}));step(s,2);assert.ok(s.zombies.every(z=>z.patrol));assert.ok(s.zombies.some((z,i)=>distance(z,starts[i])>1));const blocked=clean();blocked.spawnBlockedByView=()=>true;assert.equal(blocked.spawnRoaming(),0);
});
test('quarantine is optional, stronger than residential, with bounded special composition',()=>{
 const q=cityEncounter(CITY_SITES.find(s=>s.kind==='quarantine')!,5,100),home=cityEncounter(CITY_SITES.find(s=>s.kind==='house')!,1,100);assert.ok(q.length>home.length);for(const kind of ['tank','screamer','spitter','runner'])assert.ok(q.includes(kind as any));assert.ok(q.length<=12);assert.ok(q.filter(k=>k==='walker').length>=q.length/2-1);assert.ok(BALANCE.horde.first===22&&BALANCE.horde.maximum===76);
});
test('stash preserves weapon IDs, affixes and loaded rounds without duplicate pickup or remote access',()=>{
 const s=clean();s.loadout[0]=createWeapon('rifle',5,'rare');s.loadout[0].magazine=7;s.activeSlot=0;assert.ok(s.storeWeapon(0));assert.equal(s.ammo,12);assert.equal(s.weaponStorage[0].magazine,7);assert.equal(s.storeWeapon(1),false);assert.ok(s.retrieveWeapon(5));assert.equal(s.ammo,7);assert.equal(s.weaponStorage.length,0);Object.assign(s.player,{x:88,z:0});assert.equal(s.storeWeapon(0),false);assert.equal(clean().weaponStorage.length,0);
});
test('microevent anchors are navigable; no reward duplication or reset of visited house',()=>{
 for(const p of CACHE_STORIES){assert.equal(collides(p,.45),false,p.name);assert.ok(findPath(BASE,p).length,p.name);}const s=clean(),p=CACHE_STORIES[0];s.worldEvent={...p,id:1,kind:'cache',life:100,triggered:false};Object.assign(s.player,p);use(s);assert.ok(s.worldEvent.triggered);const next=s.nextWeaponId;use(s);assert.equal(s.nextWeaponId,next);
});
test('dawn ignores distant town guards but still requires clearing siege actors',()=>{
 const s=clean();s.setPhase('night');s.horde.spawned=s.horde.budget;const city=s.spawn({x:112,z:-109})!;assert.equal(city.siege,false);step(s,3.2);assert.equal(s.phase,'dawn');const other=clean();other.setPhase('night');other.horde.spawned=other.horde.budget;other.spawn({x:1,z:20});step(other,3.2);assert.equal(other.phase,'night');
});

test('wide open portals cannot close or consume boarding wood while an actor overlaps the edge',()=>{
 const s=clean(),p=s.portals.find(p=>p.id==='hospital-main-front')!;p.state='open';p.hp=0;Object.assign(s.player,{x:p.x+1.2,z:p.z});s.inventory.items.wood=4;use(s);assert.equal(p.state,'open');use(s,'dismantle');assert.equal(p.state,'open');assert.equal(s.inventory.items.wood,4);
});
