import { BALANCE } from './config.ts';
import { FOODS } from './nutrition.ts';
export const ITEMS = {
  chest: { label: 'Baú', weight: 2, step: 1, hint: '27 espaços. Posicione no chão e abra com o E para guardar itens.' },
  hide: { label: 'Pele recuperada', weight: .3, step: 1, hint: 'Couro bruto dos infectados. Trate na mesa para fabricar proteção.' },
  cloth: { label: 'Tecido', weight: .1, step: 1, hint: 'Retalhos aproveitáveis para bandagens, cordas e equipamento.' },
  cord: { label: 'Corda', weight: .2, step: 1, hint: 'Fibra trançada. Usada em ferramentas e construções.' },
  bench: { label: 'Mesa inteligente', weight: 3, step: 1, hint: 'Kit dobrável. Na aba Craft, posicione no chão para liberar receitas avançadas.' },
  ammo: { label: 'Munição leve', unit: 'cartuchos', weight: .025, step: 12, hint: 'Pistola, revólver e submetralhadora. R para recarregar.' },
  shells: { label: 'Cartuchos', unit: 'cartuchos', weight: .08, step: 6, hint: 'Reserva da escopeta. Recarga de um cartucho por vez.' },
  rifleAmmo: { label: 'Munição de rifle', unit: 'cartuchos', weight: .045, step: 12, hint: 'Rifle de assalto e de precisão.' },
  med: { label: 'Bandagem', unit: 'unidades', weight: 1, step: 1, hint: '+45 vida em 2,4 s. Mover, disparar ou sofrer dano interrompe.' },
  wood: { label: 'Madeira', unit: 'peças', weight: .5, step: 1, hint: 'Construir e reparar barricadas.' },
  scrap: { label: 'Sucata', unit: 'peças', weight: .25, step: 1, hint: 'Reforçar barricadas e reparar o abrigo.' },
  rare: { label: 'Reserva selada', unit: 'unidades', weight: 1, step: 1, hint: 'No abrigo: recuperação de emergência de 250 HP.' },
  ...Object.fromEntries(Object.entries(FOODS).map(([key, food]) => [key, { ...food, step: 1 }])) as { [K in keyof typeof FOODS]: typeof FOODS[K] & { step: number } },
} as const;
export type Item = keyof typeof ITEMS;
export type Stock = Record<Item, number>;
export const itemKeys = Object.keys(ITEMS) as Item[];
export const emptyStock = (): Stock => Object.fromEntries(itemKeys.map(key => [key, 0])) as Stock;
export class Inventory {
  items: Stock = emptyStock(); capacity: number;
  constructor(capacity = BALANCE.inventory.capacity) { this.capacity = capacity; }
  get weight(): number { return itemKeys.reduce((sum, k) => sum + this.items[k] * ITEMS[k].weight, 0); }
  add(item: Item, amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const accepted = Math.min(Math.floor(amount), Math.max(0, Math.floor((this.capacity - this.weight + 1e-8) / ITEMS[item].weight)));
    this.items[item] += accepted; return accepted;
  }
  take(item: Item, amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0 || this.items[item] < amount) return false;
    this.items[item] -= amount; return true;
  }
  transfer(to: Inventory, item: Item, amount: number): number {
    const moved = to.add(item, Math.min(this.items[item], amount)); this.take(item, moved); return moved;
  }
}
