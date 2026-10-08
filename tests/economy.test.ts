import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEconomy,planTrade,refreshEconomy,moneyDrop,collectCoins,validCoins,validTradeRequest,validEconomyWorld,safeMerchantSite,SHOP_CATALOGS,SELL_PRICES,MAX_COINS,merchantReachable} from '../src/game/economy.ts';
import type {TradeContext,TradeRequest} from '../src/game/economy.ts';
import {emptyStock,Inventory,ITEMS} from '../src/game/inventory.ts';
import {RECIPES} from '../src/game/crafting.ts';
import {distance,BASE} from '../src/game/world.ts';
import {merchantObstacles} from '../src/game/merchant-collision.ts';

const setup=(index=0)=>{const world=createEconomy(1977),m=world.merchants[index];const context:TradeContext={seed:1977,coins:1000,items:emptyStock(),capacity:16,player:{x:m.x,z:m.z-2,hp:100,eyeY:m.y+1.65},busy:false,groundWeaponCount:0,nextWeaponId:80};return {world,m,context};};
const buy=(merchant:string,revision=0,offer='water',amount=1):TradeRequest=>({merchant,revision,mode:'buy',offer,amount});

test('merchant camps are seeded, independent, clear of geometry and preserve shelter space',()=>{
 const first=createEconomy(1977),again=createEconomy(1977);assert.deepEqual(first,again);assert.notDeepEqual(first,createEconomy(1978));assert.ok(validEconomyWorld(first));
 first.merchants[0].stock.water=0;assert.equal(again.merchants[0].stock.water,5);
 for(let seed=0;seed<32;seed++){const w=createEconomy(seed);assert.equal(w.merchants.length,6);assert.ok(distance(w.merchants[0],BASE)<=105);for(const m of w.merchants){assert.ok(safeMerchantSite(m));assert.ok(distance(m,BASE)>=36);assert.ok(w.merchants.filter(a=>a!==m).every(a=>distance(m,a)>=55));}}
});
test('money drops are deterministic, independent of weighted inventory and collectible only once',()=>{
 const inventory=new Inventory(16);inventory.add('med',16);assert.equal(inventory.weight,16);
 let lootCoins=moneyDrop(1977,'infected-81','infected'),wallet=0;assert.equal(lootCoins,moneyDrop(1977,'infected-81','infected'));
 const taken=collectCoins(wallet,lootCoins);wallet=taken.coins;lootCoins=taken.remaining;assert.equal(collectCoins(wallet,lootCoins).taken,0);assert.equal(inventory.weight,16);
 assert.deepEqual(collectCoins(MAX_COINS-2,10),{coins:MAX_COINS,remaining:8,taken:2});assert.equal(collectCoins(0,-5).taken,0);
 const normal=Array.from({length:200},(_,i)=>moneyDrop(55,`infected-${i}`,'infected'));assert.ok(normal.some(n=>n===0)&&normal.some(n=>n>0));assert.ok(normal.every(n=>n>=0&&n<=8));
 const containers=Array.from({length:200},(_,i)=>moneyDrop(55,`box-${i}`,'container'));assert.ok(containers.some(n=>n===0)&&containers.some(n=>n>0));
});
test('purchase plans are pure, spend exactly once and concurrent stale stock requests fail',()=>{
 const {world,m,context}=setup(),before=structuredClone({world,context}),request=buy(m.id),result=planTrade(world,context,request);assert.ok(result.ok);if(!result.ok)return;
 assert.equal(result.coins,984);assert.equal(result.items.water,1);assert.equal(result.world.merchants[0].stock.water,4);assert.equal(result.world.merchants[0].revision,1);assert.equal(result.world.merchants[0].coins,m.coins+16);assert.deepEqual({world,context},before);
 assert.equal(planTrade(result.world,{...context,coins:result.coins,items:result.items},request).ok,false);
});
test('a full backpack rejects complete item purchases without currency or stock loss',()=>{
 const {world,m,context}=setup();context.items.med=16;const before=structuredClone({world,context});assert.equal(planTrade(world,context,buy(m.id)).ok,false);assert.deepEqual({world,context},before);
 context.items.med=15;assert.equal(planTrade(world,context,buy(m.id,0,'water',2)).ok,false);assert.equal(planTrade(world,context,buy(m.id,0,'water',1)).ok,true);
 context.coins=0;assert.equal(planTrade(world,context,buy(m.id)).ok,false);
});
test('sales pay exact existing inventory quantities, respect the merchant purse and never profit from buybacks or recipes',()=>{
 const {world,m,context}=setup();context.items.scrap=12;const result=planTrade(world,context,{merchant:m.id,revision:0,mode:'sell',item:'scrap',amount:4});assert.ok(result.ok);if(!result.ok)return;
 assert.equal(result.items.scrap,8);assert.equal(result.coins,1008);assert.equal(result.world.merchants[0].coins,192);
 world.merchants[0].coins=1;assert.equal(planTrade(world,context,{merchant:m.id,revision:0,mode:'sell',item:'scrap',amount:4}).ok,false);
 for(const catalog of Object.values(SHOP_CATALOGS))for(const offer of catalog)if(offer.item)assert.ok(SELL_PRICES[offer.item]*(offer.amount??1)<offer.price);
 for(const recipe of RECIPES)if(recipe.item){const cost=Object.entries(recipe.cost).reduce((sum,[item,count])=>sum+SELL_PRICES[item as keyof typeof ITEMS]*count!,0);assert.ok(SELL_PRICES[recipe.item]*(recipe.amount??1)<=cost,recipe.id);}
});
test('modified firearms use existing weapon IDs, rarity and affixes without equipping or gifting ammunition',()=>{
 const {world,m,context}=setup(2),result=planTrade(world,context,buy(m.id,0,'quiet-pistol'));assert.ok(result.ok);if(!result.ok)return;
 assert.equal(result.weapon?.item.type,'pistol');assert.equal(result.weapon?.item.rarity,'rare');assert.equal(result.weapon?.item.affix,'quiet');assert.equal(result.weapon?.item.uid,80);assert.equal(result.weapon?.item.magazine,0);assert.equal(result.nextWeaponId,81);assert.deepEqual(result.items,context.items);assert.equal(result.coins,760);
 context.groundWeaponCount=48;assert.equal(planTrade(world,context,buy(m.id,0,'quiet-pistol')).ok,false);assert.equal(context.nextWeaponId,80);assert.equal(world.merchants[2].stock['quiet-pistol'],1);
});
test('a trade requires a living idle player within reach and clear line of sight',()=>{
 const {world,m,context}=setup();assert.ok(merchantReachable(m,context.player));context.player.z=m.z-10;assert.equal(planTrade(world,context,buy(m.id)).ok,false);
 context.player.z=m.z-2;context.obstacles=[{x:m.x,z:m.z-1,w:3,d:.3,h:3}];assert.equal(planTrade(world,context,buy(m.id)).ok,false);context.obstacles=[];
 context.busy=true;assert.equal(planTrade(world,context,buy(m.id)).ok,false);context.busy=false;context.player.hp=0;assert.equal(planTrade(world,context,buy(m.id)).ok,false);
});
test('the NPC body blocks walking without blocking its own interaction, while actual stall geometry still blocks',()=>{
 const {world}=setup();for(const m of world.merchants){
  const obstacles=merchantObstacles(m),sine=Math.sin(m.angle),cosine=Math.cos(m.angle);
  const front={x:m.x+sine*2.4,z:m.z+cosine*2.4,hp:100,eyeY:m.y+1.65};assert.ok(merchantReachable(m,front,obstacles));
  obstacles.push({id:'test-wall',x:m.x+sine*1.2,z:m.z+cosine*1.2,w:3,d:3,h:3,hp:1,built:true,flash:0,label:'Wall'});assert.equal(merchantReachable(m,front,obstacles),false);
 }
});
test('restocking is once per dawn, bounded and leaves locations and old state untouched',()=>{
 const {world}=setup();world.merchants[0].stock.water=0;world.merchants[0].coins=0;const before=structuredClone(world),next=refreshEconomy(world,2);assert.equal(next.day,2);assert.equal(next.merchants[0].stock.water,5);assert.equal(next.merchants[0].coins,200);assert.equal(next.merchants[0].revision,1);assert.equal(next.merchants[0].x,world.merchants[0].x);assert.deepEqual(world,before);assert.equal(refreshEconomy(next,2),next);assert.equal(refreshEconomy(next,1),next);
});
test('forged transactions and corrupted economy state fail closed',()=>{
 const {world,m}=setup();assert.ok(validTradeRequest(buy(m.id)));for(const bad of [{...buy(m.id),amount:0},{...buy(m.id),amount:NaN},{...buy(m.id),revision:-1},{...buy(m.id),merchant:'constructor'},{merchant:m.id,revision:0,amount:1,mode:'sell',item:'__proto__'}])assert.equal(validTradeRequest(bad),false);
 for(const value of [NaN,Infinity,-1,1.5,MAX_COINS+1,'10'])assert.equal(validCoins(value),false);
 const duplicate=structuredClone(world);duplicate.merchants[1]=duplicate.merchants[0];assert.equal(validEconomyWorld(duplicate),false);
 const corrupt=structuredClone(world);corrupt.merchants[0].stock.water=9999;assert.equal(validEconomyWorld(corrupt),false);
});
