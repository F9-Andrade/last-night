import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation.ts';
import {WEAPONS,createWeapon,weaponStats,RARITIES,rollRarity} from '../src/game/weapons.ts';
import type {WeaponId} from '../src/game/weapons.ts';
import {ENEMIES,ACID,nightEnemy} from '../src/game/enemies.ts';
import type {EnemyKind} from '../src/game/enemies.ts';
import {PERKS,perkOffer} from '../src/game/perks.ts';
import {FACILITIES,EVENT_POINTS} from '../src/game/expedition.ts';
import {ENCOUNTERS} from '../src/game/districts.ts';
import {bodyHit} from '../src/game/combat.ts';
import {collides,findPath,move,BUILDINGS} from '../src/game/world.ts';
import {hasInterior,ROOM_PROPS} from '../src/game/interiors.ts';
const idle={moveX:0,moveZ:0,aimX:1,aimZ:15,fire:false,run:false,reload:false,interact:false};
function clean(seed=1977){const s=new Simulation(undefined,seed);s.zombies=[];s.spawnTimer=99999;s.encounters=new Set(ENCOUNTERS.map((_,i)=>i));s.eventTimer=99999;return s;}
function step(s:Simulation,seconds:number,input=idle){for(let i=0;i<Math.round(seconds*60);i++)s.update(1/60,input);}
function equip(s:Simulation,id:WeaponId){const item=createWeapon(id,99);s.loadout[WEAPONS[id].slot]=item;s.activeSlot=WEAPONS[id].slot;s.inventory.items[WEAPONS[id].ammo]=100;return item;}
for(const id of Object.keys(WEAPONS) as WeaponId[]){
  test(`${id}: cadence, empty reload, reserve isolation and interrupt conserve rounds`,()=>{
    const s=clean();equip(s,id);s.inventory.items.med=1;const before={...s.inventory.items},capacity=s.ammo;s.shoot();assert.equal(s.ammo,capacity-1);assert.equal(s.events.filter(e=>e.type==='shot').length,WEAPONS[id].pellets);s.shoot();assert.equal(s.ammo,capacity-1);
    s.reload();step(s,.15);s.cancelReload();assert.equal(s.ammo,capacity-1);assert.deepEqual(s.inventory.items,before);
    s.ammo=0;s.shotTimer=0;s.shoot();assert.ok(s.reloadTimer>0);step(s,WEAPONS[id].reload*(WEAPONS[id].reloadStyle==='shell'?capacity+1:1)+.2);assert.equal(s.ammo,capacity);assert.equal(s.reserve,100-capacity);
    for(const k of ['ammo','shells','rifleAmmo'] as const)if(k!==WEAPONS[id].ammo)assert.equal(s.inventory.items[k],before[k]);
  });
  test(`${id}: head, legs, noise, wounds and corpse integration`,()=>{
    const s=clean();equip(s,id);const target=s.spawn({x:1,z:12})!;s.anatomicalAim=true;s.aimDistance=5;s.aimHeight=.48;s.player.angle=Math.atan2(.23,5);s.shoot();assert.equal(target.zone,'LEGS');assert.ok(target.slow>0);assert.ok(target.hearing>0);assert.ok(target.wounds.length>0);
    target.hp=1;s.shotTimer=0;s.aimHeight=1.9;s.player.angle=0;s.shoot();assert.equal(target.active,false);assert.equal(s.kills,1);assert.equal(s.stats.headshots,1);assert.equal(s.corpses.bodies.length,1);
  });
}
test('automatic cadence remains stable at 30, 60 and 144 simulation steps per second',()=>{
  for(const id of ['smg','rifle'] as const){const counts=[30,60,144].map(hz=>{const s=clean();equip(s,id);for(let i=0;i<hz*1.8;i++)s.update(1/hz,{...idle,fire:true});return s.events.filter(e=>e.type==='shot').length;});assert.ok(Math.max(...counts)-Math.min(...counts)<=1,`${id} ${counts}`);assert.ok(counts[0]>10);}
});
test('semi automatic weapons require a new trigger and cannot accidentally auto-fire',()=>{const s=clean();step(s,1,{...idle,fire:true});assert.equal(s.ammo,11);s.update(1/60,idle);s.update(1/60,{...idle,fire:true});assert.equal(s.ammo,10);});
test('shotgun aggregates pellets before death, damages several actors and falls off with distance',()=>{
  const fire=(distance:number)=>{const s=clean();equip(s,'shotgun');const z=s.spawn({x:1,z:7+distance})!;z.hp=1000;s.player.angle=0;s.shoot();return 1000-z.hp;};assert.ok(fire(3)>fire(12)*2);
  const s=clean();equip(s,'shotgun');s.player.angle=0;const z=s.spawn({x:1,z:10})!;s.shoot();assert.equal(z.active,false);assert.equal(s.kills,1);assert.equal(s.corpses.bodies.length,1);
  const spread=clean();equip(spread,'shotgun');spread.player.angle=0;const a=spread.spawn({x:.45,z:13})!,b=spread.spawn({x:1.55,z:13})!;spread.shoot();assert.ok(a.hp<90&&b.hp<90);
});
test('shell reload transfers exactly one at completion, then can be interrupted to fire',()=>{const s=clean();equip(s,'shotgun');s.ammo=0;s.reload();step(s,.64);assert.equal(s.ammo,0);step(s,.04);assert.equal(s.ammo,1);assert.equal(s.reserve,99);s.shoot();assert.equal(s.ammo,0);assert.equal(s.reserve,99);assert.equal(s.reloadTimer,0);});
test('two slots and repeated swaps preserve unique identities and every loaded round',()=>{const s=clean();const g=s.dropWeapon('shotgun',s.player,'rare')!;assert.equal(s.equipGround(g.item.uid),true);assert.equal(s.loadout.filter(Boolean).length,2);s.switchTimer=0;s.ammo=3;s.reload();s.switchWeapon(1);assert.equal(s.reloadTimer,0);assert.equal(s.ammo,12);assert.equal(s.loadout[0]!.magazine,3);s.switchTimer=0;
  const rifle=s.dropWeapon('rifle',s.player,'epic')!;const total=()=>[...s.loadout.filter(Boolean).map(g=>g!.magazine),...s.groundWeapons.map(g=>g.item.magazine)].reduce((a,b)=>a+b,0),rounds=total();
  for(let i=0;i<12;i++){s.switchTimer=0;assert.ok(s.equipGround(s.groundWeapons[0].item.uid));assert.equal(total(),rounds);const ids=[...s.loadout.filter(Boolean).map(g=>g!.uid),...s.groundWeapons.map(g=>g.item.uid)];assert.equal(new Set(ids).size,ids.length);}assert.equal(s.stats.weapons,2);assert.equal(s.stats.bestRarity,'epic');assert.ok(rifle.item.uid>g.item.uid);
});
test('rarities remain modest and derived modifiers never stack on repeated reads',()=>{for(const rarity of Object.keys(RARITIES) as (keyof typeof RARITIES)[]){const item=createWeapon('pistol',1,rarity,()=>.99);const original=JSON.stringify(item),first=weaponStats(item);for(let i=0;i<100;i++)assert.deepEqual(weaponStats(item),first);assert.equal(JSON.stringify(item),original);assert.ok(first.damage<34*1.25);assert.ok(first.magazine<=13);}assert.equal(rollRarity(()=>0),'legendary');assert.equal(rollRarity(()=>.9),'common');});
test('piercing is limited to two bodies and never penetrates a building wall',()=>{const s=clean();const item=equip(s,'marksman');item.affix='piercing';s.player.angle=0;const a=s.spawn({x:1,z:13})!,b=s.spawn({x:1,z:15})!,c=s.spawn({x:1,z:17})!;s.shoot();assert.ok(a.hp<90&&b.hp<90);assert.equal(c.hp,90);
  const w=clean();equip(w,'marksman').affix='piercing';w.player.angle=Math.PI;const behind=w.spawn({x:1,z:-12})!;w.shoot();assert.equal(behind.hp,90);
});
test('one generated weapon per searched locker, with leftovers retained and no reroll',()=>{const s=clean();const l=s.loot.find(l=>l.id==='police-locker')!;Object.assign(s.player,{x:l.x,z:l.z});s.update(1/60,{...idle,interact:true});step(s,2.5);assert.equal(s.groundWeapons.length,1);const uid=s.groundWeapons[0].item.uid;s.equipGround(uid);s.switchTimer=0;s.update(1/60,{...idle,interact:true});step(s,1);assert.equal(s.nextWeaponId,2);assert.equal([...s.loadout.filter(Boolean),...s.groundWeapons.map(g=>g.item)].filter(g=>g!.uid===uid).length,1);});
test('perk offers are unique; choice is single-use and fresh runs reset all bonuses',()=>{const s=clean();s.pendingPerks=perkOffer(s.perks,s.contentRandom);assert.equal(new Set(s.pendingPerks).size,3);const id=s.pendingPerks[0];assert.ok(s.choosePerk(id));assert.equal(s.choosePerk(id),false);assert.equal(s.perks.size,1);const next=perkOffer(s.perks,s.contentRandom);assert.ok(!next.includes(id));const r=clean();assert.equal(r.perks.size,0);assert.equal(r.pendingPerks.length,0);assert.equal(r.inventory.capacity,18);assert.equal(Object.keys(PERKS).length,12);});
test('behavioral perks reward headshots, the last round, reload timing and bandages',()=>{const s=clean();s.perks=new Set(['cold','last','opening','medic']);const z=s.spawn({x:1,z:12})!;z.hp=500;s.player.angle=0;s.player.stamina=10;s.ammo=1;s.anatomicalAim=true;s.aimHeight=1.9;s.aimDistance=5;s.openingReady=true;s.shoot();assert.equal(s.player.stamina,18);assert.equal(z.hp,500-102*1.2);assert.ok(z.reaction>.5);assert.equal(s.openingReady,false);s.zombies=[];s.player.hp=40;s.update(1/60,{...idle,heal:true});step(s,2.5);assert.equal(s.player.stamina,100);assert.equal(s.player.hp,85);});
test('health, capacity and economical build perks apply once and charge correct resources',()=>{const s=clean();s.pendingPerks=['tough'];s.choosePerk('tough');assert.equal(s.maxHP,115);assert.equal(s.player.hp,115);s.pendingPerks=['pack'];s.choosePerk('pack');assert.equal(s.inventory.capacity,21);assert.equal(s.choosePerk('pack'),false);s.perks.add('builder');s.perks.add('engineer');assert.equal(s.buildWood,4);assert.equal(s.repairScrap,0);s.builderUsed=true;assert.equal(s.buildWood,6);});
for(const kind of Object.keys(ENEMIES) as EnemyKind[])test(`${kind}: anatomical head, bounded health and own corpse kind`,()=>{const s=clean();const z=s.spawn({x:1,z:13},kind)!;z.angle=0;const d=ENEMIES[kind];assert.equal(z.hp,d.hp);const hit=bodyHit({x:.93,z:7},{x:0,z:1},(d.headY-1.3)/6,z,20);assert.equal(hit?.zone,'HEAD');z.hp=1;s.anatomicalAim=true;s.aimHeight=d.headY;s.aimDistance=6;s.player.angle=0;s.shoot();assert.equal(z.active,false);assert.equal(s.corpses.bodies[0].kind,kind);assert.equal(s.stats.specials,kind==='walker'?0:1);});
test('runner gains ground faster; tank telegraphs and deals stronger structure damage',()=>{const progress=(kind:EnemyKind)=>{const s=clean(),z=s.spawn({x:1,z:16},kind)!;step(s,1);return 16-z.z;};assert.ok(progress('runner')>progress('walker')*2);
 const strike=(kind:EnemyKind)=>{const s=clean(),b=s.barricades.find(b=>b.id==='gate')!;b.hp=300;s.player.x=1;s.player.z=5;const z=s.spawn({x:1,z:10},kind)!;z.attack=0;z.replan=99;z.defense=b.id;step(s,.1);if(kind==='tank')assert.equal(b.hp,300);step(s,.7);return 300-b.hp;};assert.ok(strike('tank')>strike('walker')*2);
});
test('spitter telegraphs, can be interrupted and acid gives time to escape before damage',()=>{const s=clean();const z=s.spawn({x:1,z:14},'spitter')!;z.spitCooldown=0;step(s,.04);assert.ok(z.spitTarget);assert.equal(s.acids.length,0);s.player.angle=0;s.shoot();assert.equal(z.spitTarget,undefined);assert.equal(s.acids.length,0);
 z.hp=78;z.reaction=0;z.spitCooldown=0;s.shotTimer=0;step(s,.04);step(s,1.1);assert.equal(s.acids.length,1);assert.equal(s.player.hp,100);s.player.x=5;step(s,1);assert.equal(s.player.hp,100);const acid=s.acids[0];z.active=false;s.player.x=acid.x;s.player.z=acid.z;step(s,.7);assert.ok(s.player.hp<100);step(s,5);assert.equal(s.acids.length,0);
});
test('spitter does not fire through walls; acid and living actors stay bounded',()=>{const s=clean();const z=s.spawn({x:1,z:-12},'spitter')!;s.player.z=2;z.spitCooldown=0;step(s,2);assert.equal(s.acids.length,0);for(let i=0;i<100;i++)s.spawn({x:-7+(i%10)*1.5,z:13+Math.floor(i/10)*1.4},'spitter');assert.ok(s.activeWalkers<=40);step(s,3);assert.ok(s.acids.length<=ACID.capacity);});
test('night compositions introduce specials progressively and preserve a Walker majority',()=>{for(let day=1;day<=6;day++){const wave=Array.from({length:30},(_,i)=>nightEnemy(day,i,30));assert.ok(wave.filter(k=>k==='walker').length>=26);assert.equal(wave.includes('tank'),day>=4);assert.equal(wave.includes('spitter'),day>=3);assert.equal(wave.includes('runner'),day>=2);}});
test('all facilities, temporary event anchors and furnished interiors remain reachable',()=>{for(const p of [...FACILITIES,...EVENT_POINTS]){assert.equal(collides(p,.65),false,JSON.stringify(p));assert.ok(findPath({x:1,z:7},p).length>0);}
 for(const b of BUILDINGS.filter(hasInterior)){const player={x:b.x,z:b.z+b.d/2+2};for(let i=0;i<200;i++)move(player,0,-.05);assert.ok(player.z<b.z+b.d/2-2,b.kind);for(const p of ROOM_PROPS[b.kind])assert.ok(collides({x:b.x+p.x,z:b.z+p.z}));}
});
test('generator gates the medical cache, makes noise and persists until a fresh run',()=>{const s=clean(),cache=s.facilities.find(f=>f.id==='hospital-store')!,gen=s.facilities[0];Object.assign(s.player,cache);s.update(1/60,{...idle,interact:true});assert.equal(s.action,null);Object.assign(s.player,gen);s.update(1/60,{...idle,interact:true});step(s,3);assert.equal(gen.state,'powered');assert.ok(s.alarmTimer>0);Object.assign(s.player,cache);s.update(1/60,{...idle,interact:true});step(s,2.1);assert.equal(cache.state,'opened');assert.ok(s.inventory.items.med>=4);assert.equal(clean().facilities[0].state,'ready');});
test('trunk alarm can be disabled with a timed action; event lifecycle ends without retry duplication',()=>{const s=clean(),trunk=s.facilities.find(f=>f.kind==='trunk')!;Object.assign(s.player,trunk);s.update(1/60,{...idle,interact:true});step(s,2.2);assert.equal(trunk.state,'opened');assert.ok(s.alarmTimer>0);s.update(1/60,{...idle,interact:true});step(s,1.5);assert.equal(s.alarmTimer,0);
 const e=clean();e.eventTimer=0;step(e,.1);assert.ok(e.worldEvent);assert.equal(e.nextEventId,1);step(e,105);assert.equal(e.worldEvent,undefined);const r=clean();assert.equal(r.worldEvent,undefined);assert.equal(r.nextEventId,0);
});
test('seeded runs vary optional caches and equipment without removing opening supplies',()=>{const a=clean(1),b=clean(2),same=clean(1);assert.deepEqual(a.loot,same.loot);assert.notDeepEqual(a.loot.map(l=>l.searched),b.loot.map(l=>l.searched));for(const s of [a,b]){assert.equal(s.ammo,12);assert.equal(s.reserve,72);assert.equal(s.inventory.items.med,1);assert.equal(s.loot[0].searched,false);assert.ok(s.loot.find(l=>l.id==='hospital-case')!.guaranteed!.med!>=2);}});
