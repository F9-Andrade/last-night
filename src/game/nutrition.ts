/** Sealed provisions remain the dependable food supply in Santa Luz. No food heals wounds. */
export const FOODS = {
  cannedBeans: { label: 'Feijão enlatado', weight: .4, hint: 'Lata amassada, lacre intacto. Uma refeição simples e confiável.', hunger: 26, thirst: 6, duration: 3.2, kind: 'eat', color: '#c77d3d' },
  cannedMeat: { label: 'Carne em conserva', weight: .33, hint: 'Carne salgada de uma antiga reserva. Sustenta, mas aumenta a sede.', hunger: 34, thirst: -4, duration: 3.1, kind: 'eat', color: '#a94f3f' },
  cannedFish: { label: 'Sardinha enlatada', weight: .28, hint: 'Pequena lata de sardinha em óleo. Nutritiva e bastante salgada.', hunger: 26, thirst: -6, duration: 2.9, kind: 'eat', color: '#668b93' },
  cannedFruit: { label: 'Frutas em conserva', weight: .42, hint: 'Pêssegos em calda. Recuperam energia e ajudam a hidratar.', hunger: 18, thirst: 16, duration: 2.8, kind: 'eat', color: '#c6a14b' },
  crackers: { label: 'Biscoitos de emergência', weight: .16, hint: 'Pacote ressecado, ainda selado. Leve, rápido e difícil de engolir sem água.', hunger: 16, thirst: -5, duration: 2.3, kind: 'eat', color: '#b49b6e' },
  ration: { label: 'Ração de campanha', weight: .32, hint: 'Refeição de longa duração do antigo bloqueio. Rara, concentrada e seca.', hunger: 42, thirst: -8, duration: 3.4, kind: 'eat', color: '#7e8760' },
  water: { label: 'Água engarrafada', weight: .55, hint: 'Garrafa lacrada de água potável. Valiosa nas longas expedições.', hunger: 0, thirst: 42, duration: 2.4, kind: 'drink', color: '#8aa8ad' },
  soda: { label: 'Refrigerante', weight: .36, hint: 'Lata esquecida nas prateleiras. Hidrata menos que água, com um pouco de energia.', hunger: 6, thirst: 26, duration: 2.2, kind: 'drink', color: '#ae5a36' },
} as const;
export type FoodId = keyof typeof FOODS;
export const foodKeys = Object.keys(FOODS) as FoodId[];
export function isFood(value: unknown): value is FoodId { return typeof value === 'string' && Object.hasOwn(FOODS, value); }
export interface Nutrition { hunger: number; thirst: number; starvationTimer: number }
export interface Consumption { item: FoodId; elapsed: number; duration: number }
export const createNutrition = (): Nutrition => ({ hunger: 100, thirst: 100, starvationTimer: 0 });
export const NUTRITION = { hungerDrain: .045, thirstDrain: .06, sprintHunger: 1.45, sprintThirst: 1.7, criticalInterval: 5 } as const;
const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
/** Normal hydration leaves the original stamina rules entirely unchanged. */
export function nutritionRecovery(state: Nutrition): number {
  return 1 - .18 * (1 - Math.min(25, clamp(state.hunger)) / 25) - .24 * (1 - Math.min(25, clamp(state.thirst)) / 25);
}
/** Returns raw deprivation damage; callers retain ownership of solo death / coop downing. */
export function advanceNutrition(state: Nutrition, dt: number, running: boolean): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  state.hunger = clamp(state.hunger - NUTRITION.hungerDrain * dt * (running ? NUTRITION.sprintHunger : 1));
  state.thirst = clamp(state.thirst - NUTRITION.thirstDrain * dt * (running ? NUTRITION.sprintThirst : 1));
  if (state.hunger > 0 && state.thirst > 0) { state.starvationTimer = 0; return 0; }
  state.starvationTimer = Math.max(0, Number.isFinite(state.starvationTimer) ? state.starvationTimer : 0) + dt;
  const ticks = Math.floor((state.starvationTimer + 1e-8) / NUTRITION.criticalInterval);
  state.starvationTimer = Math.max(0, state.starvationTimer - ticks * NUTRITION.criticalInterval);
  return ticks * ((state.hunger <= 0 ? 1 : 0) + (state.thirst <= 0 ? 2 : 0));
}
export function applyFood(state: Nutrition, item: FoodId): void {
  state.hunger = clamp(state.hunger + FOODS[item].hunger);
  state.thirst = clamp(state.thirst + FOODS[item].thirst);
  if (state.hunger > 0 && state.thirst > 0) state.starvationTimer = 0;
}
