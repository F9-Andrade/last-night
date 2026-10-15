import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation.ts';
import {BOOK_ENTRIES} from '../src/ui/field-book-content.ts';
import {CloudError} from '../src/services/cloud-types.ts';
import {deserializePlayer,playerRecord,serializePlayer,serializeWorld} from '../src/services/save-codec.ts';

const worldId='20000000-0000-4000-8000-000000000002';
const userId='10000000-0000-4000-8000-000000000001';
const known=['item-wood','food-water','weapon-pistol','infected-walker','npc-trader-rute'];

test('personal discoveries survive player save roundtrip without entering the shared world payload',()=>{
 const source=new Simulation();source.discoveries=new Set(known);source.player.hp=73;
 const saved=serializePlayer(source,worldId,userId),restored=new Simulation();
 deserializePlayer(saved,restored);
 assert.deepEqual([...restored.discoveries],known);assert.equal(restored.player.hp,73);
 assert.deepEqual(saved.extra_data.discoveries,known);
 restored.discoveries.add('item-scrap');assert.equal(source.discoveries.has('item-scrap'),false);
 assert.equal(JSON.stringify(serializeWorld(source)).includes('"discoveries"'),false,'knowledge remains per survivor, not shared with every visitor');
});

test('legacy saves without discoveries restore an empty set instead of leaking the previous survivor knowledge',()=>{
 const saved=serializePlayer(new Simulation(),worldId,userId);delete saved.extra_data.discoveries;
 const restored=new Simulation();restored.discoveries=new Set(known);
 deserializePlayer(saved,restored);assert.deepEqual([...restored.discoveries],[]);
});

test('invalid or oversized discovery data fails before modifying live player state',()=>{
 const source=new Simulation();source.discoveries=new Set(known);source.player.hp=72;
 const valid=serializePlayer(source,worldId,userId);
 for(const discoveries of [null,{},'item-wood',[17],['unknown-entry'],['item-wood'.repeat(100)],Array.from({length:BOOK_ENTRIES.length+1},()=> 'item-wood')]){
  const restored=new Simulation();restored.player.hp=61;restored.discoveries=new Set(['item-scrap']);
  assert.throws(()=>deserializePlayer({...valid,extra_data:{...valid.extra_data,discoveries}},restored),error=>error instanceof CloudError&&error.kind==='invalid');
  assert.equal(restored.player.hp,61);assert.deepEqual([...restored.discoveries],['item-scrap']);
 }
 source.discoveries.add('unknown-entry');assert.throws(()=>serializePlayer(source,worldId,userId),error=>error instanceof CloudError&&error.kind==='invalid');
});

test('authoritative coop inventory confirmation never replaces the local survivor discoveries',()=>{
 const local=new Simulation(),host=new Simulation();local.discoveries.add('item-wood');host.discoveries.add('npc-trader-rute');
 host.inventory.items.scrap=8;const confirmed=playerRecord(host,2);
 const saved=serializePlayer(local,worldId,userId,confirmed),restored=new Simulation();
 deserializePlayer(saved,restored);
 assert.deepEqual([...restored.discoveries],['item-wood']);assert.equal(restored.inventory.items.scrap,8);
 assert.deepEqual([...host.discoveries],['npc-trader-rute']);
});
