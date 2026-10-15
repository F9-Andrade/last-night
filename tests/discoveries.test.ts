import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation.ts';
import {scanDiscoveries,DISCOVERY_IDS,validDiscoveryIds} from '../src/game/discoveries.ts';
import {BOOK_ENTRIES} from '../src/ui/field-book-content.ts';
import {createWeapon} from '../src/game/weapons.ts';

function expedition(){const s=new Simulation();s.zombies=[];s.dormantZombies=[];scanDiscoveries(s,false);return s;}
function encounter(s:Simulation){
 const npc=s.economy.merchants[0],x=npc.x+Math.sin(npc.angle)*2.4,z=npc.z+Math.cos(npc.angle)*2.4;
 Object.assign(s.player,{x,z,eyeY:npc.y+1.65,angle:Math.atan2(npc.x-x,npc.z-z),pitch:-.08});return npc;
}
test('discovery IDs cover the complete encyclopedia and reject unknown, oversized or duplicate saves',()=>{
 assert.deepEqual(new Set(DISCOVERY_IDS),new Set(BOOK_ENTRIES.map(entry=>entry.id)));
 assert.equal(validDiscoveryIds([...DISCOVERY_IDS]),true);
 for(const value of [null,{},['invented'],['item-wood','item-wood'],[1]])assert.equal(validDiscoveryIds(value),false);
});
test('owning resources, provisions, tools, weapons and equipment discovers each only once',()=>{
 const s=expedition();assert.equal(s.discoveries.has('weapon-pistol'),true);assert.equal(s.discoveries.has('melee-fists'),true);
 assert.equal(s.discoveries.has('food-water'),false);s.inventory.add('water',1);s.gear.owned.push('axe');s.loadout[0]=createWeapon('rifle',8);s.gear.armorTier=2;s.packCrafted=true;s.coins=1;
 const found=scanDiscoveries(s,false);
 for(const id of ['food-water','melee-axe','weapon-rifle','gear-leather','gear-reinforced','gear-pack','item-coins'])assert.ok(found.includes(id),id);
 assert.deepEqual(scanDiscoveries(s,false),[]);s.inventory.take('water',1);scanDiscoveries(s,false);s.inventory.add('water',1);assert.deepEqual(scanDiscoveries(s,false),[]);
});
test('shared stock, shop catalogs and remote survivors never grant personal knowledge',()=>{
 const a=expedition(),b=expedition();a.storage.add('water',1);a.weaponStorage.push(createWeapon('marksman',9));b.inventory.add('water',1);
 scanDiscoveries(a,false);scanDiscoveries(b,false);assert.equal(a.discoveries.has('food-water'),false);assert.equal(a.discoveries.has('weapon-marksman'),false);assert.equal(b.discoveries.has('food-water'),true);
 assert.equal([...a.discoveries].some(id=>id.startsWith('npc-')),false);
});
test('NPC discovery requires local sight, distance and an unobstructed view; it survives leaving',()=>{
 const s=expedition(),npc=encounter(s),id=`npc-${npc.id}`;
 const yaw=s.player.angle;s.player.angle+=Math.PI;scanDiscoveries(s);assert.equal(s.discoveries.has(id),false);
 s.player.angle=yaw;const x=s.player.x,z=s.player.z;s.player.x+=50;scanDiscoveries(s);assert.equal(s.discoveries.has(id),false);Object.assign(s.player,{x,z});
 s.barricades.push({id:'discovery-blocker',label:'Parede',x:(x+npc.x)/2,z:(z+npc.z)/2,w:2,d:2,h:5,bottom:npc.y,hp:100,built:true,flash:0});
 scanDiscoveries(s);assert.equal(s.discoveries.has(id),false);
 s.barricades.pop();assert.ok(scanDiscoveries(s).includes(id));s.player.x+=50;assert.equal(s.discoveries.has(id),true);assert.equal(scanDiscoveries(s).includes(id),false);
});
test('only observed infected and structures unlock records, not the whole replicated world',()=>{
 const s=expedition(),npc=encounter(s);s.economy={...s.economy,merchants:[]};
 s.spawn({x:npc.x,z:npc.z},'runner');s.spawn({x:npc.x+100,z:npc.z+100},'tank');
 scanDiscoveries(s);assert.equal(s.discoveries.has('infected-runner'),true);assert.equal(s.discoveries.has('infected-tank'),false);
 s.crafting.structures.push({id:7,kind:'wall',x:npc.x,z:npc.z,level:0,rotation:0,hp:300,tier:0,open:false,revision:0});
 assert.ok(scanDiscoveries(s).includes('structure-wall'));assert.equal(s.discoveries.has('structure-roof'),false);
});
