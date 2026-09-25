import type {Item} from '../game/inventory';
import {icon} from './icons';
/** Original artwork supplied by the player, reused by both game modes. */
const images:Partial<Record<Item,string>>={ammo:'ammo',rifleAmmo:'rifle-ammo',shells:'shells',med:'bandage',wood:'wood',scrap:'scrap'};
export function itemArt(item:Item):string {
 const image=images[item];return image?`<img class="item-art" src="/ui/items/${image}.png" alt="" draggable="false" width="256" height="256">`:icon(item);
}
