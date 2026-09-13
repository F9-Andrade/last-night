/** Reproducible pressure benchmark, not a substitute for a human survival playtest. */
import {writeFileSync} from 'node:fs';
import {Simulation} from '../src/game/simulation.ts';
import {CITY_SITES} from '../src/game/city.ts';
import {ENCOUNTERS} from '../src/game/districts.ts';
import {createWeapon,WEAPONS} from '../src/game/weapons.ts';
import type {WeaponId,Rarity} from '../src/game/weapons.ts';
import {distance,wallDistance} from '../src/game/world.ts';
const results=[];
for(const day of [1,3,5])for(const [weapon,rarity]of [['pistol','common'],['smg','common'],['smg','rare'],['rifle','common']]as [WeaponId,Rarity][]){
 const s=new Simulation();s.zombies=[];s.activatedSites=new Set(CITY_SITES.map(s=>s.id));s.encounters=new Set(ENCOUNTERS.map((_,i)=>i));s.eventTimer=9999;s.roamTimer=9999;s.cycle.day=day;s.inventory.items.med=2;s.inventory.items.wood=6;s.inventory.items.scrap=3;
 const gun=createWeapon(weapon,99,rarity,()=>.5);s.loadout[WEAPONS[weapon].slot]=gun;s.activeSlot=WEAPONS[weapon].slot;s.reserve=120;for(const b of s.barricades){b.hp=300;b.built=true;}s.setPhase('night');
 let ticks=0;for(;ticks<240*60&&!s.gameOver&&s.phase==='night';ticks++){
  const target=s.zombies.filter(z=>z.active).map(z=>({z,d:distance(z,s.player)})).filter(({z,d})=>d<s.weapon.range&&wallDistance(s.player,{x:(z.x-s.player.x)/d,z:(z.z-s.player.z)/d},d)>=d-.05).sort((a,b)=>a.d-b.d)[0];
  const danger=s.zombies.filter(z=>z.active).sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0],flee=danger&&distance(danger,s.player)<4;
  const dx=flee?s.player.x-danger.x:0,dz=flee?s.player.z-danger.z:0;
  s.update(1/60,{moveX:dx,moveZ:dz,aimX:target?.z.x??1,aimZ:target?.z.z??20,aimY:1.3,fire:!!target&&!s.action,trigger:!!target,run:!!flee,reload:!s.ammo,interact:false,heal:s.player.hp<50&&!!s.inventory.items.med&&!flee});s.events=[];
 }
 results.push({day,weapon,rarity,result:s.gameOver?'defeat':s.phase==='night'?'time-limit':'dawn',seconds:Math.round(ticks/60),hp:s.player.hp,baseHP:s.baseHP,kills:s.kills,spawned:s.horde.spawned,budget:s.horde.budget,reserve:s.reserve,magazine:s.ammo,remaining:s.activeWalkers});
}
writeFileSync('docs/city/balance.json',JSON.stringify({method:'Controlled torso-aim policy; 120 reserve, 2 bandages, three built defenses. No repairs. Resource fixtures; not ordinary play.',results},null,2));console.table(results);
