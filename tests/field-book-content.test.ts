import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BOOK_CATEGORIES, BOOK_ENTRIES, GUIDE_CHAPTERS } from '../src/ui/field-book-content.ts';
import { itemKeys } from '../src/game/inventory.ts';
import { foodKeys, isFood } from '../src/game/nutrition.ts';
import { WEAPONS } from '../src/game/weapons.ts';
import { ENEMIES } from '../src/game/enemies.ts';
import { MELEE } from '../src/game/crafting.ts';
import { STRUCTURE_DEFS } from '../src/game/construction.ts';
import { MERCHANT_PROFILES } from '../src/game/economy.ts';

test('field encyclopedia covers every current provision, enemy, weapon, tool, structure and merchant', () => {
  const entries = new Map(BOOK_ENTRIES.map(entry => [entry.id, entry]));
  assert.equal(entries.size, BOOK_ENTRIES.length, 'Book IDs must remain unique for links and bookmarks.');
  const required = [
    ...itemKeys.filter(id => !isFood(id)).map(id => `item-${id}`),
    ...foodKeys.map(id => `food-${id}`),
    ...Object.keys(ENEMIES).map(id => `infected-${id}`),
    ...Object.keys(WEAPONS).map(id => `weapon-${id}`),
    ...Object.keys(MELEE).map(id => `melee-${id}`),
    ...Object.keys(STRUCTURE_DEFS).map(id => `structure-${id}`),
    ...MERCHANT_PROFILES.map(npc => `npc-${npc.id}`),
    'item-coins', 'gear-leather', 'gear-reinforced', 'gear-pack',
  ];
  for (const id of required) assert.ok(entries.has(id), `Missing field record: ${id}`);
  for (const category of BOOK_CATEGORIES) assert.ok(BOOK_ENTRIES.some(entry => entry.category === category.id));
});

test('field book records contain readable copy and resolve only existing local artwork', () => {
  const categories = new Set(BOOK_CATEGORIES.map(category => category.id));
  for (const entry of BOOK_ENTRIES) {
    assert.ok(categories.has(entry.category), entry.id);
    const text = [entry.title, entry.kicker, entry.summary, ...entry.paragraphs, ...entry.facts.flatMap(fact => [fact.label, fact.value])];
    assert.ok(text.every(value => value.trim().length > 0), entry.id);
    assert.ok(text.every(value => !/<[^>]*>|undefined|NaN/.test(value)), entry.id);
    assert.ok(entry.paragraphs.length > 0 && entry.tags.length > 0, entry.id);
    if (entry.icon) {
      assert.ok(entry.icon.startsWith('/ui/items/'), entry.icon);
      assert.ok(existsSync(new URL(`../public${entry.icon}`, import.meta.url)), entry.icon);
    }
  }
  assert.equal(new Set(GUIDE_CHAPTERS.map(chapter => chapter.id)).size, GUIDE_CHAPTERS.length);
  for (const chapter of GUIDE_CHAPTERS) assert.ok(chapter.title && chapter.summary && chapter.paragraphs.length && chapter.checklist.length, chapter.id);
});
