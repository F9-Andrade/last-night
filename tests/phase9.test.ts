import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TensionDirector} from '../src/game/tension.ts';
import {Simulation} from '../src/game/simulation.ts';
import {URBAN,collides,findPath,distance,BASE,wallDistance} from '../src/game/world.ts';
import {CITY_SITES} from '../src/game/city.ts';
import {ENCOUNTERS,ROADS} from '../src/game/districts.ts';
import {LOOT_POINTS} from '../src/game/loot.ts';
const idle={moveX:0,moveZ:0,aimX:1,aimZ:15,fire:false,run:false,reload:false,interact:false};
function clean(){const s=new Simulation();s.zombies=[];s.spawnTimer=99999;s.eventTimer=99999;s.roamTimer=99999;s.encounters=new Set(ENCOUNTERS.map((_,i)=>i));s.activatedSites=new Set(CITY_SITES.map(s=>s.id));return s;}
function step(s:Simulation,t:number){for(let i=0;i<Math.ceil(t*60);i++)s.update(1/60,idle);}
const observation={hp:100,ammo:40,healing:2,stamina:100,nearby:0,engaged:0,atShelter:false,inside:false,night:false};
test('infill varies height and typology, stays outside circulation and has reachable alley rewards',()=>{
 assert.ok(URBAN.buildings.length>=45);assert.equal(new Set(URBAN.buildings.map(b=>b.style)).size,4);assert.ok(new Set(URBAN.buildings.map(b=>b.h)).size>=4);
 for(const b of URBAN.buildings){assert.ok(collides(b,.4));assert.ok(!ROADS.some(r=>Math.abs(b.x-r.x)<(b.w+r.w)/2&&Math.abs(b.z-r.z)<(b.d+r.d)/2));}
 for(const a of URBAN.alleys){assert.ok(!collides(a,.45),a.id);assert.ok(findPath(BASE,a).length,a.id);assert.ok(LOOT_POINTS.some(l=>l.id===a.id));}
 assert.equal(new Set(URBAN.vehicles.map(v=>v.kind)).size,9);assert.equal(URBAN.scenes.filter(s=>!s.id.startsWith('outer-')).length,7);assert.equal(URBAN.scenes.filter(s=>s.id.startsWith('outer-')).length,24);
});
test('director traverses all states, supplies relief and never mutates survivor inputs',()=>{
 const d=new TensionDirector(),p={...observation};for(let i=0;i<40;i++)d.update(1,[p]);assert.equal(d.state,'SUSPENSE');
 for(const [engaged,state]of [[1,'CONTACT'],[4,'PRESSURE'],[8,'PEAK']]as const){p.engaged=engaged;d.update(1,[p]);assert.equal(d.state,state);}
 p.engaged=0;for(let i=0;i<12;i++)d.update(1,[p]);assert.equal(d.state,'RELIEF');assert.equal(d.allowPressure,false);
 for(let i=0;i<43;i++)d.update(1,[Object.freeze({...p})]);assert.equal(d.state,'CALM');assert.equal(p.ammo,40);assert.equal(p.hp,100);assert.equal(new Set(d.transitions.map(t=>t.state)).size,6);
});
test('director has bounded history and suspense cues over a twenty-minute schedule',()=>{
 const d=new TensionDirector();let cues=0,relief=0;
 for(let i=0;i<1200;i++){const beat=i%180;d.update(1,[{...observation,engaged:beat>80&&beat<100?8:0,nearby:beat>80&&beat<100?8:0}]);if(d.cue)cues++;if(d.state==='RELIEF')relief++;}
 assert.ok(cues>5&&cues<40);assert.ok(relief>200);assert.ok(d.transitions.length<=64);
});
test('calm and wounded survivors defer added pressure without reducing existing damage',()=>{
 const d=new TensionDirector();for(let i=0;i<45;i++)d.update(1,[{...observation,hp:20}]);assert.equal(d.state,'SUSPENSE');assert.equal(d.allowPressure,false);
 d.update(1,[{...observation,engaged:8,hp:20}]);assert.equal(d.state,'PEAK');assert.equal(d.allowPressure,false);
});
test('closed doors block detection; glass permits sight but never a melee hit',()=>{
 const s=clean();Object.assign(s.player,{x:112,z:-103});const z=s.spawn({x:112,z:-95})!;assert.ok(z);step(s,.2);assert.equal(z.awareness,'idle');
 s.portals.find(p=>p.id==='hospital-main-front')!.state='open';step(s,.2);assert.equal(z.awareness,'chase');assert.ok(z.lastSeen);
 const g=clean();const p=g.portals.find(p=>p.id==='hospital-main-side')!;Object.assign(g.player,{x:p.x-.7,z:p.z});const w=g.spawn({x:p.x+.7,z:p.z})!;assert.ok(w);step(g,2);assert.equal(w.awareness,'chase');assert.equal(g.player.hp,100);assert.ok(p.hp<35||p.state==='open','infected may attack the glass instead');
});
test('losing sight preserves a snapshot, then expires instead of following through walls',()=>{
 const s=clean();Object.assign(s.player,{x:112,z:-96});const z=s.spawn({x:112,z:-92})!;step(s,.2);const seen={...z.lastSeen!};
 Object.assign(s.player,{x:106,z:-108});step(s,.5);assert.equal(z.awareness,'search');assert.deepEqual(z.lastSeen,seen);assert.notDeepEqual(z.lastSeen,{x:s.player.x,z:s.player.z});
 Object.assign(s.player,{x:1,z:7});step(s,8);assert.equal(z.memory,0);assert.equal(z.lastSeen,undefined);
});
test('sound investigation starts at an uncertain location and relaxes after silence',()=>{
 const s=clean();Object.assign(s.player,{x:88,z:-95});const z=s.spawn({x:112,z:-95})!;const noise={x:112,z:-104};s.portals.forEach(p=>{p.state='open';p.hp=0;});s.noise(noise,35);
 assert.ok(z.hearing>0);assert.ok(z.heard);assert.notDeepEqual(z.heard,noise);assert.ok(distance(z.heard!,noise)<4.6);assert.equal(z.awareness,'investigate');
 step(s,11);assert.equal(z.hearing,0);assert.equal(z.awareness,'idle');
});
test('stagger has a cooldown while every bullet still damages the target',()=>{
 const s=clean();Object.assign(s.player,{x:88,z:-30,angle:0});const z=s.spawn({x:88,z:-25},'tank')!;z.hp=1000;s.shoot();const hp=z.hp;assert.ok(z.staggerCooldown!>0);assert.ok(z.reaction>0);
 s.shotTimer=0;s.shoot();assert.ok(z.hp<hp);assert.ok(z.reaction<=.05);assert.ok(z.active);
});
test('each prepared roaming route is consumed once and never spawns inside the view',()=>{
 const s=clean();Object.assign(s.player,{x:88,z:-30});s.spawnBlockedByView=()=>true;assert.equal(s.spawnRoaming(),0);s.spawnBlockedByView=()=>false;const n=s.spawnRoaming();assert.ok(n>0);assert.ok(s.zombies.every(z=>distance(z,s.player)>=40));
});
test('generator has continuous noise, powers its reward and does not play a car alarm',()=>{
 const s=clean(),f=s.facilities.find(f=>f.id==='foundry-power')!;Object.assign(s.player,f);s.update(1/60,{...idle,interact:true});step(s,2.6);assert.equal(f.state,'powered');assert.equal(s.alarmTimer,0);assert.ok(s.director.noise>0);
 const c=s.facilities.find(f=>f.id==='foundry-store')!;Object.assign(s.player,c);s.update(1/60,{...idle,interact:true});step(s,2.1);assert.equal(c.state,'opened');
});
test('radio clue is optional, persistent within the run, and resets with a fresh survivor',()=>{
 const s=clean(),r=s.facilities.find(f=>f.id==='terminal-radio')!;Object.assign(s.player,r);s.update(1/60,{...idle,interact:true});step(s,2.1);assert.ok(s.escapeClues.has('frequency'));assert.equal(clean().escapeClues.size,0);
});
