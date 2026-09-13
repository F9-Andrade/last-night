import test from 'node:test';
import assert from 'node:assert/strict';
import {updateStamina} from '../src/game/stamina.ts';
import {BALANCE} from '../src/game/config.ts';
import {Simulation} from '../src/game/simulation.ts';
const idle={moveX:0,moveZ:0,aimX:75,aimZ:0,run:false,fire:false,reload:false,interact:false};
const fresh=()=>({stamina:100,exhausted:false,staminaDelay:0,running:false});
for(const hz of [30,60,144])test(`held sprint uses stable exhaustion/recovery at ${hz} Hz`,()=>{
 const s=fresh();let flips=0,last=false;const transitions:number[]=[];
 for(let i=0;i<hz*20;i++){const before={...s};updateStamina(s,1/hz,true);assert.ok(s.stamina>=0&&s.stamina<=100);assert.ok(!(s.exhausted&&s.running));if(s.running!==last){flips++;transitions.push(i/hz);last=s.running;if(s.running&&i>0)assert.ok(before.stamina>=25);}if(before.exhausted&&before.stamina<25)assert.equal(s.running,false);}
 assert.ok(flips<14,`unexpected oscillation: ${flips}`);for(let i=2;i<transitions.length;i++)assert.ok(transitions[i]-transitions[i-1]>1);
});
test('regeneration delay is smooth; release/repress cannot bypass exhaustion',()=>{
 const s=fresh();updateStamina(s,1,true);const after=s.stamina;updateStamina(s,.5,false);assert.equal(s.stamina,after);updateStamina(s,.5,false);assert.equal(s.stamina,after+.25*BALANCE.player.recover);
 Object.assign(s,{stamina:0,exhausted:true,staminaDelay:0});updateStamina(s,.1,false);updateStamina(s,.1,true);assert.equal(s.running,false);s.stamina=25;updateStamina(s,1/60,true);assert.equal(s.running,true);
});
test('exhausted movement keeps normal speed and normalized diagonal control',()=>{
 const setup=()=>{const s=new Simulation();s.zombies=[];s.setPhase('dusk');Object.assign(s.player,{x:75,z:40,stamina:0,exhausted:true,staminaDelay:.75});return s;};const a=setup(),b=setup();a.update(.1,{...idle,moveZ:-1,run:true});b.update(.1,{...idle,moveX:-1,moveZ:-1,run:true});assert.ok(Math.abs(Math.hypot(a.player.x-75,a.player.z-40)-BALANCE.player.walk*.1)<1e-8);assert.ok(Math.abs(Math.hypot(b.player.x-75,b.player.z-40)-BALANCE.player.walk*.1)<1e-8);
});
test('exhausted held Shift permits walking reload and firing without resource duplication',()=>{
 const s=new Simulation();s.zombies=[];s.setPhase('dusk');Object.assign(s.player,{x:75,z:40,stamina:0,exhausted:true,staminaDelay:.75});s.ammo=5;const total=s.ammo+s.reserve;
 for(let i=0;i<90;i++)s.update(1/60,{...idle,moveZ:-1,run:true,reload:i===0});assert.equal(s.ammo,12);assert.equal(s.ammo+s.reserve,total);assert.equal(s.player.running,false);
 s.update(1/60,{...idle,moveZ:-1,run:true,fire:true});assert.equal(s.ammo,11);assert.equal(s.player.running,false);
});
test('death freezes exhaustion and a new run resets every stamina state',()=>{
 const s=new Simulation();s.player.stamina=0;s.player.exhausted=true;s.player.hp=0;s.update(1/60,idle);const before={...s.player};s.update(1,idle);assert.deepEqual(s.player,before);const again=new Simulation();assert.equal(again.player.exhausted,false);assert.equal(again.player.stamina,100);assert.equal(again.player.staminaDelay,0);
});
