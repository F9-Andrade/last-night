import type {Item} from '../game/inventory';
import {icon} from './icons';
/** Original artwork supplied by the player, reused by both game modes. */
const images:Partial<Record<Item,string>>={ammo:'ammo',rifleAmmo:'rifle-ammo',shells:'shells',med:'bandage',wood:'wood',scrap:'scrap'};
const foodArt=new Set<string>(['cannedBeans','cannedMeat','cannedFish','cannedFruit','crackers','ration','water','soda']);
export function itemArt(item:Item):string {
 if(foodArt.has(item))return `<img class="item-art food-art" src="/ui/items/food-${item}.svg" alt="" draggable="false" width="128" height="128">`;
 const image=images[item];return image?`<img class="item-art" src="/ui/items/${image}.png" alt="" draggable="false" width="256" height="256">`:icon(item);
}
