import type {Simulation} from './simulation.ts';
import {usableBench} from './crafting.ts';
import {CHEST_LIMIT,CHEST_SLOTS,usableChest} from './chests.ts';
import {BASE,collides,distance,rayWorld,ceilingHeight} from './world.ts';
import {FPS} from './first-person.ts';
import {structureFloorHeight} from './construction.ts';

export type FurnitureKind='bench'|'chest';
export interface FurniturePose {x:number;z:number;y:number;angle:number}
export interface FurniturePlacement extends FurniturePose {valid:boolean;reason:string}
const dimensions={bench:{w:1.5,d:1.5,h:1.72},chest:{w:1.3,d:1.3,h:1.2}};
const finitePose=(p:FurniturePose)=>[p.x,p.z,p.y,p.angle].every(Number.isFinite)&&Math.abs(p.angle)<=Math.PI+1e-8;
const ignoredId=(kind:FurnitureKind,id?:number)=>`${kind==='bench'?'table':'chest'}-${id}`;

/** The host revalidates the destination; previews never mutate the original object. */
export function furnitureReason(s:Simulation,kind:FurnitureKind,p:FurniturePose,id?:number):string {
 if(!finitePose(p)||s.gameOver||s.player.hp<=0||s.action||s.reloadTimer)return 'Conclua a ação atual antes de posicionar.';
 if(distance(s.player,p)>4.6)return 'Aproxime-se do local de destino.';
 const ground=structureFloorHeight(s,p,s.groundY),size=dimensions[kind];
 if(Math.abs(p.y-ground)>.08||Math.abs(ground-s.groundY)>.35)return 'Escolha um piso acessível no seu andar.';
 const solids=s.solidDefenses.filter(b=>b.id!==ignoredId(kind,id));
 const body=solids.filter(b=>(b.bottom??0)<p.y+size.h-.05&&(b.bottom??0)+(b.h??4)>p.y+.08);
 if(collides(p,Math.max(size.w,size.d)/2+.05,body)||ceilingHeight(p)-p.y<size.h)return 'Há uma parede, teto ou objeto nesse espaço.';
 // Check all corners, so furniture cannot hang over a roof edge or straddle a stair.
 for(const dx of [-size.w/2,size.w/2])for(const dz of [-size.d/2,size.d/2])if(Math.abs(structureFloorHeight(s,{x:p.x+dx,z:p.z+dz},ground)-ground)>.12)return 'O móvel precisa de um piso plano sob toda a base.';
 if(p.y<1&&Math.abs(p.x-BASE.x)<1.4&&Math.abs(p.z-BASE.z)<1.9)return 'Deixe a cama e seu acesso livres.';
 if(Math.abs(s.groundY-p.y)<1.5&&distance(s.player,p)<1.25)return 'Afaste o móvel do seu corpo.';
 if(s.zombies.some(z=>z.active&&p.y<2&&distance(z,p)<1.25)||s.coopTargets.some(q=>Math.abs(q.eyeY-FPS.eyeHeight-p.y)<1.5&&distance(q,p)<1.25))return 'Há um sobrevivente ou infectado nesse espaço.';
 if(s.loot.some(l=>p.y<1&&distance(l,p)<1))return 'Deixe os suprimentos acessíveis.';
 const origin={x:s.player.x,y:s.player.eyeY,z:s.player.z},targetY=p.y+.65;
 const range=Math.hypot(p.x-origin.x,p.z-origin.z,targetY-origin.y);
 if(range>.01&&rayWorld(origin,{x:(p.x-origin.x)/range,y:(targetY-origin.y)/range,z:(p.z-origin.z)/range},range,solids)<range-.08)return 'Você precisa enxergar o local de destino.';
 return '';
}

export function furniturePlacement(s:Simulation,kind:FurnitureKind,rotation:number,id?:number):FurniturePlacement {
 const reach=Math.max(1.9,Math.min(4.5,s.player.pitch<-.05?(s.player.eyeY-s.groundY)/Math.tan(-s.player.pitch):2.8));
 const x=Math.round((s.player.x+Math.sin(s.player.angle)*reach)*4)/4,z=Math.round((s.player.z+Math.cos(s.player.angle)*reach)*4)/4;
 const p={x,z,y:structureFloorHeight(s,{x,z},s.groundY),angle:Math.atan2(Math.sin(rotation),Math.cos(rotation))};
 let reason=furnitureReason(s,kind,p,id);
 if(id!==undefined&&!(kind==='bench'?usableBench(s,id):usableChest(s,id)))reason='Fique a até 3 m do móvel original para movê-lo.';
 return {...p,valid:!reason,reason};
}

export function placeFurniture(s:Simulation,kind:FurnitureKind,p:FurniturePose):boolean {
 const reason=furnitureReason(s,kind,p);
 if(reason){s.notice('LOCAL INDISPONÍVEL',reason);return false;}
 if((kind==='bench'?s.crafting.tables.length>=12:s.crafting.chests.length>=CHEST_LIMIT)||!s.inventory.take(kind,1)){s.notice('NÃO FOI POSSÍVEL POSICIONAR','Confira o kit na mochila e o limite de móveis.');return false;}
 const id=s.crafting.next++;
 if(kind==='bench')s.crafting.tables.push({id,x:p.x,y:p.y,z:p.z,angle:p.angle,hp:200});
 else s.crafting.chests.push({id,x:p.x,y:p.y,z:p.z,angle:p.angle,revision:0,slots:Array.from({length:CHEST_SLOTS},()=>null)});
 s.crafting.revision++;s.notice(kind==='bench'?'MESA POSICIONADA':'BAÚ POSICIONADO','Mire e pressione E para abrir. Reposicione pelo menu do móvel.');return true;
}

/** Relocating a full chest preserves its identity, weapons and every stack atomically. */
export function relocateFurniture(s:Simulation,kind:FurnitureKind,id:number,revision:number,p:FurniturePose):boolean {
 const furniture=kind==='bench'?s.crafting.tables.find(v=>v.id===id):s.crafting.chests.find(v=>v.id===id);
 if(!furniture||!(kind==='bench'?usableBench(s,id):usableChest(s,id))||revision!==(kind==='bench'?s.crafting.revision:('revision' in furniture?furniture.revision:-1))){s.notice('MÓVEL ALTERADO','Aproxime-se e escolha Reposicionar novamente.');return false;}
 const reason=furnitureReason(s,kind,p,id);if(reason){s.notice('LOCAL INDISPONÍVEL',reason);return false;}
 Object.assign(furniture,{x:p.x,y:p.y,z:p.z,angle:p.angle});if('revision' in furniture)furniture.revision++;
 s.crafting.revision++;s.zombies.forEach(z=>z.replan=0);s.notice('MÓVEL REPOSICIONADO',kind==='chest'?'Todos os itens foram preservados.':'A condição da mesa foi preservada.');return true;
}
