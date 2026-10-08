import {BASE_LOOT_POINTS} from './base-loot.ts';
import {URBAN} from './world.ts';
import type { Vec2 } from './world.ts';
import type { Item, Stock } from './inventory.ts';
import { emptyStock } from './inventory.ts';
import type { FoodId } from './nutrition.ts';
export type LootArea = 'base' | 'hospital' | 'police' | 'market' | 'house' | 'gas' | 'outside';
export interface LootPoint extends Vec2 { id: string; area: LootArea; label: string; searched: boolean; coins?:number; contents: Stock; lastFound: Item | null; guaranteed?: Partial<Stock>;site?:string;valuable?:boolean;restocked?:boolean }
export const LOOT_TABLES: Record<LootArea, { item: Item; weight: number; min: number; max: number }[]> = {
  base: [{ item: 'ammo', weight: 1, min: 24, max: 36 }],
  hospital: [{ item: 'med', weight: 8, min: 1, max: 2 }, { item: 'scrap', weight: 2, min: 2, max: 4 }, { item: 'ammo', weight: 1, min: 12, max: 18 }, { item: 'rare', weight: 1, min: 1, max: 1 }],
  police: [{ item: 'ammo', weight: 8, min: 12, max: 22 }, { item: 'scrap', weight: 4, min: 3, max: 5 }, { item: 'med', weight: 1, min: 1, max: 1 }, { item: 'rare', weight: 1, min: 1, max: 1 }],
  market: [{ item: 'wood', weight: 5, min: 4, max: 7 }, { item: 'scrap', weight: 4, min: 3, max: 5 }, { item: 'med', weight: 1, min: 1, max: 1 }, { item: 'ammo', weight: 2, min: 12, max: 24 }],
  house: [{ item: 'wood', weight: 4, min: 3, max: 6 }, { item: 'ammo', weight: 3, min: 8, max: 14 }, { item: 'med', weight: 2, min: 1, max: 1 }, { item: 'scrap', weight: 3, min: 2, max: 4 }, { item: 'rare', weight: 1, min: 1, max: 1 }],
  gas: [{ item: 'scrap', weight: 7, min: 4, max: 7 }, { item: 'wood', weight: 4, min: 4, max: 7 }, { item: 'rare', weight: 2, min: 1, max: 1 }, { item: 'ammo', weight: 1, min: 12, max: 24 }],
  outside: [{ item: 'wood', weight: 5, min: 3, max: 5 }, { item: 'scrap', weight: 4, min: 2, max: 4 }, { item: 'ammo', weight: 3, min: 8, max: 14 }, { item: 'med', weight: 1, min: 1, max: 1 }],
};
export const LOOT_POINTS=[...BASE_LOOT_POINTS,...URBAN.alleys.map(p=>({...p,area:'outside' as LootArea,label:'Mochila no beco',valuable:false}))];
const FOOD_CHANCE: Record<LootArea, number> = { base: 0, market: .88, house: .65, gas: .65, hospital: .35, police: .35, outside: .25 };
const FOOD_TABLE: { item: FoodId; weight: number }[] = [
  { item: 'cannedBeans', weight: 20 }, { item: 'cannedMeat', weight: 12 }, { item: 'cannedFish', weight: 14 }, { item: 'cannedFruit', weight: 10 },
  { item: 'water', weight: 24 }, { item: 'soda', weight: 13 }, { item: 'crackers', weight: 5 }, { item: 'ration', weight: 2 },
];
/** A private stream keeps added provisions from changing combat / equipment RNG. */
export function rollFood(area: LootArea, seed: number): Partial<Stock> {
  let state = (seed ^ 0x76e98a13) >>> 0;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  if (random() >= FOOD_CHANCE[area]) return {};
  let pick = random() * 100;
  const item = (FOOD_TABLE.find(row => (pick -= row.weight) < 0) ?? FOOD_TABLE[0]).item;
  return { [item]: 1 };
}
export function rollLoot(area: LootArea, random: () => number): Stock {
  const result = emptyStock(), table = LOOT_TABLES[area], total = table.reduce((sum, row) => sum + row.weight, 0);
  let foodSeed = 0;
  for (let i = 0; i < 2; i++) {
    const value = random(); if (i === 0) foodSeed = Math.floor(value * 4294967296);
    let roll = value * total;
    const row = table.find(entry => (roll -= entry.weight) < 0) ?? table[table.length - 1];
    result[row.item] += row.min + Math.floor(random() * (row.max - row.min + 1));
  }
  if(area!=='base'&&random()<.55)result.cloth+=1+Math.floor(random()*3);
  Object.assign(result, rollFood(area, foodSeed));
  return result;
}
export function createLoot(): LootPoint[] { return LOOT_POINTS.map(p => ({ ...p, searched: false, contents: emptyStock(), lastFound: null })); }
