import {CITY_LOOT} from './city.ts';
import type { Vec2 } from './world.ts';
import type { Item, Stock } from './inventory.ts';
import { emptyStock } from './inventory.ts';
export type LootArea = 'base' | 'hospital' | 'police' | 'market' | 'house' | 'gas' | 'outside';
export interface LootPoint extends Vec2 { id: string; area: LootArea; label: string; searched: boolean; contents: Stock; lastFound: Item | null; guaranteed?: Partial<Stock>;site?:string;valuable?:boolean;restocked?:boolean }
export const LOOT_TABLES: Record<LootArea, { item: Item; weight: number; min: number; max: number }[]> = {
  base: [{ item: 'ammo', weight: 1, min: 24, max: 36 }],
  hospital: [{ item: 'med', weight: 8, min: 1, max: 2 }, { item: 'scrap', weight: 2, min: 2, max: 4 }, { item: 'ammo', weight: 1, min: 12, max: 18 }, { item: 'rare', weight: 1, min: 1, max: 1 }],
  police: [{ item: 'ammo', weight: 8, min: 12, max: 22 }, { item: 'scrap', weight: 4, min: 3, max: 5 }, { item: 'med', weight: 1, min: 1, max: 1 }, { item: 'rare', weight: 1, min: 1, max: 1 }],
  market: [{ item: 'wood', weight: 5, min: 4, max: 7 }, { item: 'scrap', weight: 4, min: 3, max: 5 }, { item: 'med', weight: 1, min: 1, max: 1 }, { item: 'ammo', weight: 2, min: 12, max: 24 }],
  house: [{ item: 'wood', weight: 4, min: 3, max: 6 }, { item: 'ammo', weight: 3, min: 8, max: 14 }, { item: 'med', weight: 2, min: 1, max: 1 }, { item: 'scrap', weight: 3, min: 2, max: 4 }, { item: 'rare', weight: 1, min: 1, max: 1 }],
  gas: [{ item: 'scrap', weight: 7, min: 4, max: 7 }, { item: 'wood', weight: 4, min: 4, max: 7 }, { item: 'rare', weight: 2, min: 1, max: 1 }, { item: 'ammo', weight: 1, min: 12, max: 24 }],
  outside: [{ item: 'wood', weight: 5, min: 3, max: 5 }, { item: 'scrap', weight: 4, min: 2, max: 4 }, { item: 'ammo', weight: 3, min: 8, max: 14 }, { item: 'med', weight: 1, min: 1, max: 1 }],
};
export const LOOT_POINTS: (Vec2 & { id: string; area: LootArea; label: string; guaranteed?: Partial<Stock>;site?:string;valuable?:boolean;restocked?:boolean })[] = [
  { id: 'base-ammo', x: -2, z: 3, area: 'base', label: 'Reserva do pátio', guaranteed: { ammo: 36 } },
  { id: 'base-wood', x: 4.8, z: 5, area: 'outside', label: 'Tábuas recuperadas', guaranteed: { wood: 6, scrap: 2 } },
  { id: 'market-crate', x: -22, z: .5, area: 'market', label: 'Caixa de entregas', guaranteed: { wood: 5 } },
  { id: 'market-locker', x: -29, z: 1.5, area: 'market', label: 'Armário do mercado' },
  { id: 'hospital-case', x: 23, z: -17, area: 'hospital', label: 'Caixa médica', guaranteed: { med: 2 } },
  { id: 'hospital-locker', x: 29, z: -17, area: 'hospital', label: 'Armário de emergência' },
  { id: 'police-locker', x: 23, z: 19, area: 'police', label: 'Locker de munição', guaranteed: { ammo: 24 } },
  { id: 'police-case', x: 29, z: 33, area: 'police', label: 'Equipamento de patrulha' },
  { id: 'gas-tools', x: -28, z: 24, area: 'gas', label: 'Caixa de ferramentas', guaranteed: { scrap: 4 } },
  { id: 'gas-crate', x: -20, z: 33, area: 'gas', label: 'Material de manutenção' },
  { id: 'house-north', x: 3, z: -20.5, area: 'house', label: 'Baú abandonado' },
  { id: 'house-west', x: -27, z: -21, area: 'house', label: 'Baú da varanda' },
  { id: 'house-east', x: 29, z: 3, area: 'house', label: 'Baú abandonado' },
  { id: 'house-south', x: 4, z: 35, area: 'house', label: 'Caixa do quintal' },
  { id: 'street-materials', x: -7, z: 5, area: 'outside', label: 'Material recuperável', guaranteed: { wood: 4, scrap: 2 } },
];
LOOT_POINTS.push(
  {id:'market-shelves',x:-25,z:-8,area:'market',label:'Suprimentos das prateleiras',guaranteed:{med:1,wood:4}},
  {id:'hospital-drawer',x:25,z:-21,area:'hospital',label:'Gaveta da recepção',guaranteed:{med:1}},
  {id:'police-desk',x:25,z:28,area:'police',label:'Mesa de apreensões',guaranteed:{shells:4,rifleAmmo:12}},
  {id:'industrial-pallet',x:56,z:69,area:'gas',label:'Carga de construção',guaranteed:{wood:10,scrap:8}},
  {id:'industrial-locker',x:71,z:50,area:'gas',label:'Armário emperrado · barulhento',guaranteed:{scrap:8}},
  {id:'industrial-cache',x:72,z:72,area:'gas',label:'Reserva escondida',guaranteed:{rare:1,ammo:36}},
  {id:'triage-case',x:64,z:-60,area:'hospital',label:'Reserva da triagem',guaranteed:{med:3}},
  {id:'triage-cache',x:69,z:-69,area:'hospital',label:'Maleta selada',guaranteed:{rare:1}},
  {id:'checkpoint-locker',x:39,z:36,area:'police',label:'Locker reforçado · barulhento',guaranteed:{ammo:36}},
  {id:'hospital-ambulance',x:43,z:-28,area:'hospital',label:'Kit da ambulância',guaranteed:{med:2}},
  {id:'north-house',x:-64,z:-60,area:'house',label:'Baú do jardim'},
  {id:'north-garage',x:-43,z:-59,area:'gas',label:'Ferramentas da garagem',guaranteed:{wood:5}},
  {id:'acacia-house',x:3,z:-59,area:'house',label:'Baú das Acácias'},
  {id:'acacia-east',x:24,z:-56,area:'house',label:'Armário da varanda'},
  {id:'gallery-pharmacy',x:-63,z:-16,area:'hospital',label:'Entrega da farmácia',guaranteed:{med:2}},
  {id:'gallery-store',x:-63,z:6,area:'market',label:'Porta de serviço · barulhenta',guaranteed:{wood:6}},
  {id:'gallery-south',x:-63,z:30,area:'market',label:'Caixa de mantimentos'},
  {id:'maintenance',x:-62,z:71,area:'gas',label:'Material da oficina',guaranteed:{scrap:7,wood:6}},
  {id:'plaza-camp',x:5,z:64,area:'outside',label:'Suprimentos da evacuação',guaranteed:{med:1,ammo:24}},
  {id:'plaza-cache',x:-6,z:72,area:'outside',label:'Baú sob as raízes',guaranteed:{rare:1}},
  {id:'east-house',x:63,z:7,area:'house',label:'Caixa do quintal'},
  {id:'east-south',x:63,z:31,area:'house',label:'Baú de viagem'},
  {id:'west-yard',x:-64,z:-37,area:'house',label:'Depósito do quintal'},
);
LOOT_POINTS.push(...CITY_LOOT.map(p=>({...p,area:p.area as LootArea,guaranteed:p.area==='hospital'&&p.id.endsWith('entry')?{med:2}:undefined})));
export function rollLoot(area: LootArea, random: () => number): Stock {
  const result = emptyStock(), table = LOOT_TABLES[area], total = table.reduce((sum, row) => sum + row.weight, 0);
  for (let i = 0; i < 2; i++) {
    let roll = random() * total;
    const row = table.find(entry => (roll -= entry.weight) < 0) ?? table[table.length - 1];
    result[row.item] += row.min + Math.floor(random() * (row.max - row.min + 1));
  }
  return result;
}
export function createLoot(): LootPoint[] { return LOOT_POINTS.map(p => ({ ...p, searched: false, contents: emptyStock(), lastFound: null })); }
