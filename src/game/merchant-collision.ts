import type {Merchant} from './economy.ts';
import type {Barricade} from './defenses.ts';

interface LocalBox {id:string;x:number;z:number;w:number;d:number;h:number;bottom?:number}

/** Physical footprints match the role-specific posts in render/merchants.ts.
 * Posts are rotated by cardinal quarter turns during seeded world generation. */
export function merchantObstacles(merchant:Merchant):Barricade[] {
 const boxes:LocalBox[]=[
  {id:'npc',x:0,z:0,w:.64,d:.64,h:2.04},
  {id:'table',x:0,z:-1.45,w:2.6,d:.9,h:1.1},
  {id:'crate-a',x:-.6,z:-2.3,w:.8,d:.6,h:.7},
  {id:'crate-b',x:.6,z:-2.3,w:.8,d:.6,h:.7},
 ];
 for(const x of [-1.85,1.85])for(const z of [-2.45,.45])boxes.push({id:`pole-${x}-${z}`,x,z,w:.1,d:.1,h:2.8});
 if(merchant.kind==='supplies'){
  boxes.push({id:'crates-side',x:2.4,z:-1.8,w:.8,d:.8,h:1.3},{id:'water-case',x:-2.3,z:-1.75,w:.6,d:.7,h:1.2});
 }else if(merchant.kind==='medic'){
  boxes.push({id:'medical-case',x:-2.1,z:-1.95,w:.8,d:.7,h:.9},{id:'stretcher',x:2.4,z:-1.45,w:.8,d:2.3,h:.5,bottom:.3});
 }else if(merchant.kind==='gunsmith'){
  boxes.push({id:'weapons-rack',x:0,z:-2.15,w:2.4,d:.1,h:1.2,bottom:1.1},{id:'ammo-case',x:2.4,z:-1.65,w:.8,d:1.3,h:.8},{id:'drum',x:-2.25,z:-1.9,w:.7,d:.8,h:1.2});
 }else{
  boxes.push({id:'timber',x:2.45,z:-1.6,w:.9,d:1.6,h:.7},{id:'stock-metal',x:-2.35,z:-2.35,w:.7,d:.3,h:1.3},{id:'salvage-crate',x:-2.35,z:-1.1,w:.9,d:.8,h:.8},{id:'parts-case',x:2.3,z:-.25,w:.6,d:.7,h:.4});
 }
 const sine=Math.sin(merchant.angle),cosine=Math.cos(merchant.angle);
 return boxes.map(b=>({
  id:`merchant-${merchant.id}-${b.id}`,label:b.id==='npc'?merchant.name:'Posto de troca',
  x:merchant.x+b.x*cosine+b.z*sine,z:merchant.z-b.x*sine+b.z*cosine,
  w:Math.abs(cosine)*b.w+Math.abs(sine)*b.d,d:Math.abs(sine)*b.w+Math.abs(cosine)*b.d,
  h:b.h,bottom:merchant.y+(b.bottom??0),hp:1e6,built:true,flash:0,
 }));
}
