import type { Simulation } from './simulation.ts';
import type { Item } from './inventory.ts';
import { itemKeys } from './inventory.ts';
import { FPS, lookDirection } from './first-person.ts';
import { BASE, collides, floorHeight, rayBox, rayWorld } from './world.ts';
import type { Obstacle, Vec2 } from './world.ts';
import type { Barricade } from './defenses.ts';
import { obstacleDistance } from './defenses.ts';

export const BUILD_PLOT={minX:-5,maxX:7,minZ:-8,maxZ:10} as const;
export const BUILD_GROUND=.22, MODULE_SIZE=3, LEVEL_HEIGHT=3, MAX_LEVEL=2, MAX_STRUCTURES=192;
export type StructureKind='wall'|'window'|'door'|'floor'|'roof'|'stairs'|'spikes'|'snare'|'wire';
export type StructureOperation='fortify'|'repair'|'toggle'|'dismantle';
export interface StructureRequest {kind:StructureKind;x:number;z:number;level:number;rotation:0|1|2|3}
export interface Structure extends StructureRequest {id:number;hp:number;tier:0|1|2;open:boolean;revision:number}
export interface StructurePlacement extends StructureRequest {valid:boolean;reason:string}
type Cost=Partial<Record<Item,number>>;
export const STRUCTURE_DEFS:Record<StructureKind,{name:string;cost:Cost;maxHP:number;hint:string}>={
 wall:{name:'Parede de madeira',cost:{wood:6,scrap:2},maxHP:300,hint:'Parede de 3 metros. Encaixa nas bordas da malha do terreno.'},
 window:{name:'Parede com janela',cost:{wood:5,scrap:3},maxHP:260,hint:'Janela aberta para observar e disparar, com peitoril de madeira.'},
 door:{name:'Parede com porta',cost:{wood:6,scrap:4},maxHP:280,hint:'Passagem articulada. E abre ou fecha; G gerencia a estrutura.'},
 floor:{name:'Piso estrutural',cost:{wood:5,scrap:2},maxHP:320,hint:'Módulo de 3 × 3 m. Andares superiores precisam de paredes ou apoio conectado.'},
 roof:{name:'Teto estrutural',cost:{wood:6,scrap:3},maxHP:320,hint:'Fecha o andar e serve de piso para o próximo. Precisa de apoio.'},
 stairs:{name:'Escada de madeira',cost:{wood:9,scrap:4,cord:1},maxHP:350,hint:'Quinze degraus para subir um andar. Reserve a abertura acima.'},
 spikes:{name:'Armadilha de estacas',cost:{wood:8,scrap:4},maxHP:200,hint:'24 de dano por segundo. Perde durabilidade ao atingir infectados.'},
 snare:{name:'Laço de contenção',cost:{wood:3,cord:4,scrap:3},maxHP:200,hint:'Retarda infectados e causa 8 de dano por segundo.'},
 wire:{name:'Cerca de arame',cost:{wood:4,scrap:12,cloth:2},maxHP:200,hint:'Bloqueia passagem e fere infectados. Pode ser posicionada em qualquer borda.'},
};
export const structureBaseY=(p:Pick<StructureRequest,'level'>)=>BUILD_GROUND+p.level*LEVEL_HEIGHT;
export const structureSurfaceY=(p:Pick<StructureRequest,'level'|'kind'>)=>structureBaseY(p)+(p.kind==='roof'?LEVEL_HEIGHT:0);
export const structureCost=(kind:StructureKind):Cost=>STRUCTURE_DEFS[kind].cost;
export const structureMaxHP=(p:Pick<Structure,'kind'|'tier'>)=>Math.round(STRUCTURE_DEFS[p.kind].maxHP*(p.tier===2?3:p.tier===1?1.8:1));
export const structureFortifyCost=(p:Pick<Structure,'tier'>):Cost=>p.tier===0?{wood:3,cloth:4,cord:1}:{scrap:8,cloth:2,cord:1};
export const structureRepairCost=(p:Pick<Structure,'tier'>):Cost=>p.tier===2?{wood:1,scrap:3}:p.tier===1?{wood:2,cloth:2,scrap:1}:{wood:2,scrap:1};
export const isStructureEdge=(kind:StructureKind)=>kind==='wall'||kind==='window'||kind==='door'||kind==='wire';
const isTrap=(p:Pick<Structure,'kind'>)=>p.kind==='spikes'||p.kind==='snare'||p.kind==='wire';
const same=(a:number,b:number)=>Math.abs(a-b)<.001;
const grid=(v:number,origin:number,offset=0)=>same((v-origin-offset)/MODULE_SIZE,Math.round((v-origin-offset)/MODULE_SIZE));
const cellCenter=(v:number,origin:number)=>origin+MODULE_SIZE*(Math.round((v-origin-MODULE_SIZE/2)/MODULE_SIZE)+.5);
const edge=(v:number,origin:number)=>origin+MODULE_SIZE*Math.round((v-origin)/MODULE_SIZE);

/** Schema shared with checkpoint validation: no world mutation and no trust in client coordinates. */
export function validStructureRequest(value:unknown):value is StructureRequest {
 if(!value||typeof value!=='object')return false;
 const p=value as StructureRequest;
 if(!Object.hasOwn(STRUCTURE_DEFS,p.kind)||!Number.isFinite(p.x)||!Number.isFinite(p.z)||!Number.isInteger(p.level)||p.level<0||p.level>MAX_LEVEL||!Number.isInteger(p.rotation)||p.rotation<0||p.rotation>3)return false;
 const alongX=isStructureEdge(p.kind)&&p.rotation%2===0,alongZ=isStructureEdge(p.kind)&&p.rotation%2===1;
 const rx=alongZ?0:1.5,rz=alongX?0:1.5;
 return grid(p.x,BUILD_PLOT.minX,rx)&&grid(p.z,BUILD_PLOT.minZ,rz)&&p.x-rx>=BUILD_PLOT.minX-.001&&p.x+rx<=BUILD_PLOT.maxX+.001&&p.z-rz>=BUILD_PLOT.minZ-.001&&p.z+rz<=BUILD_PLOT.maxZ+.001;
}
function localBox(p:StructureRequest,x:number,z:number,w:number,d:number,bottom:number,h:number):Obstacle {
 const a=p.rotation*Math.PI/2,s=Math.sin(a),c=Math.cos(a);
 return {x:p.x+x*c+z*s,z:p.z-x*s+z*c,w:p.rotation%2?d:w,d:p.rotation%2?w:d,bottom:structureBaseY(p)+bottom,h};
}
/** Exact height volumes: bullets pass through window openings and open doorways. */
export function structureBoxes(p:Structure):Barricade[] {
 if(p.hp<=0)return [];
 const boxes:Obstacle[]=[];
 const add=(x:number,z:number,w:number,d:number,bottom:number,h:number)=>boxes.push(localBox(p,x,z,w,d,bottom,h));
 if(p.kind==='wall')add(0,0,3,.22,0,3);
 else if(p.kind==='window'){
  add(0,0,3,.22,0,1.12);add(0,0,3,.22,2.32,.68);
  add(-1.09,0,.82,.22,1.12,1.2);add(1.09,0,.82,.22,1.12,1.2);
 }else if(p.kind==='door'){
  add(-1.035,0,.93,.22,0,2.2);add(1.035,0,.93,.22,0,2.2);add(0,0,3,.22,2.2,.8);
  if(p.open)add(-.57,-.57,.16,1.14,0,2.2);else add(0,0,1.14,.16,0,2.2);
 }else if(p.kind==='floor'||p.kind==='roof')add(0,0,3,3,p.kind==='roof'?2.82:-.18,.18);
 else if(p.kind==='stairs')for(let i=0;i<15;i++)add(0,-1.4+i*.2,2.8,.2,0,(i+1)*.2);
 else if(p.kind==='wire')add(0,0,3,.24,0,1.35);
 else if(p.kind==='spikes')add(0,0,2.5,2.5,0,.5);
 return boxes.map((b,i)=>({...b,id:`structure-${p.id}-${i}`,label:STRUCTURE_DEFS[p.kind].name,hp:p.hp,built:true,flash:0,tier:p.tier,trap:isTrap(p)?p.kind as 'spikes'|'snare'|'wire':undefined}));
}
function footprint(p:StructureRequest):Obstacle {return {...p,w:isStructureEdge(p.kind)?p.rotation%2?.22:3:3,d:isStructureEdge(p.kind)?p.rotation%2?3:.22:3};}
function tileAt(p:Vec2,t:StructureRequest,margin=0){return Math.abs(p.x-t.x)<=1.5+margin&&Math.abs(p.z-t.z)<=1.5+margin;}
const surfaceLevel=(p:StructureRequest)=>p.level+(p.kind==='roof'?1:0);
function supports(p:StructureRequest,pieces:StructureRequest[]):boolean {
 if(p.level===0&&p.kind!=='roof')return true;
 const surface=p.kind==='floor'||p.kind==='roof',level=surface?surfaceLevel(p):p.level;
 if(!surface)return pieces.some(q=>(q.kind==='floor'||q.kind==='roof')&&surfaceLevel(q)===level&&tileAt(p,q,.01)||isStructureEdge(p.kind)&&!isTrap(q as Structure)&&isStructureEdge(q.kind)&&q.level===level-1&&same(p.x,q.x)&&same(p.z,q.z)&&p.rotation%2===q.rotation%2);
 return pieces.some(q=>{
  if((q.kind==='wall'||q.kind==='window'||q.kind==='door')&&q.level===level-1){
   return q.rotation%2===0?same(q.x,p.x)&&same(Math.abs(q.z-p.z),1.5):same(q.z,p.z)&&same(Math.abs(q.x-p.x),1.5);
  }
  if((q.kind==='floor'||q.kind==='roof')&&surfaceLevel(q)===level)return same(Math.abs(q.x-p.x)+Math.abs(q.z-p.z),3)&&(same(q.x,p.x)||same(q.z,p.z));
  if(q.kind==='stairs'&&q.level===level-1){const a=q.rotation*Math.PI/2;return same(p.x,q.x+Math.sin(a)*3)&&same(p.z,q.z+Math.cos(a)*3);}
  return false;
 });
}
/** Returns only pieces with a path to the ground; cycles cannot support a floating floor. */
function supportedPieces(pieces:Structure[]):Structure[] {
 const accepted:Structure[]=[];let rest=pieces.filter(p=>p.hp>0),changed=true;
 while(changed&&rest.length){changed=false;const pending:Structure[]=[];for(const p of rest){if(supports(p,accepted)){accepted.push(p);changed=true;}else pending.push(p);}rest=pending;}
 return accepted;
}
function duplicates(p:StructureRequest,q:StructureRequest):boolean {
 if(isStructureEdge(p.kind)&&isStructureEdge(q.kind))return p.level===q.level&&same(p.x,q.x)&&same(p.z,q.z)&&p.rotation%2===q.rotation%2;
 if((p.kind==='roof'||p.kind==='floor')&&(q.kind==='roof'||q.kind==='floor'))return surfaceLevel(p)===surfaceLevel(q)&&same(p.x,q.x)&&same(p.z,q.z);
 return p.kind===q.kind&&p.level===q.level&&same(p.x,q.x)&&same(p.z,q.z);
}
function stairHeightAt(p:Vec2,q:StructureRequest):number|undefined {
 const a=q.rotation*Math.PI/2,dx=p.x-q.x,dz=p.z-q.z,across=dx*Math.cos(a)-dz*Math.sin(a),along=dx*Math.sin(a)+dz*Math.cos(a);
 return Math.abs(across)<=1.4&&along>=-1.5&&along<=1.5?structureBaseY(q)+Math.min(15,Math.max(1,Math.floor((along+1.5)/.2)+1))*.2:undefined;
}
function materials(s:Simulation,cost:Cost){return itemKeys.every(k=>s.inventory.items[k]>=(cost[k]??0));}
function pay(s:Simulation,cost:Cost){for(const k of itemKeys)if(cost[k])s.inventory.take(k,cost[k]!);}
function bodyBlocked(p:Vec2,ground:number,boxes:Obstacle[],radius=.48){return boxes.some(b=>(b.bottom??0)+b.h!>ground+.28&&(b.bottom??0)<ground+FPS.bodyHeight&&obstacleDistance(p,b)<radius);}
function clearTo(s:Simulation,p:Vec2,y:number,ignoreId?:number){
 const o={x:s.player.x,y:s.player.eyeY,z:s.player.z},dx=p.x-o.x,dz=p.z-o.z,dy=y-o.y,len=Math.hypot(dx,dy,dz);
 if(len<.01)return true;
 return rayWorld(o,{x:dx/len,y:dy/len,z:dz/len},len,s.solidDefenses.filter(b=>!b.id.startsWith(`structure-${ignoreId}-`)))>=len-.3;
}
export function structurePlacementReason(s:Simulation,p:StructureRequest):string {
 if(!validStructureRequest(p))return 'Construa na malha do terreno do abrigo.';
 if(s.gameOver||s.player.hp<=0||s.action||s.reloadTimer||s.player.running)return 'Aguarde terminar a ação.';
 if(!s.buildingHammerEquipped)return 'Equipe o martelo de construção fabricado na mesa.';
 const alive=s.crafting.structures.filter(q=>q.hp>0);
 if(alive.length>=MAX_STRUCTURES)return 'Limite de 192 peças atingido.';
 if(obstacleDistance(s.player,footprint(p))>5)return 'Aproxime-se do local (5 m).';
 if(Math.abs(structureBaseY(p)-s.groundY)>3.35)return 'Alcance esse andar pela escada primeiro.';
 if(alive.some(q=>duplicates(p,q)))return 'Já existe uma peça nesse encaixe.';
 if(!supports(p,alive))return 'Falta apoio: construa paredes, piso ou uma escada conectada.';
 if(p.kind==='stairs'&&alive.some(q=>(q.kind==='roof'||q.kind==='floor')&&surfaceLevel(q)===p.level+1&&same(q.x,p.x)&&same(q.z,p.z))||
  (p.kind==='floor'||p.kind==='roof')&&alive.some(q=>q.kind==='stairs'&&q.level+1===surfaceLevel(p)&&same(q.x,p.x)&&same(q.z,p.z)))return 'Reserve a abertura acima da escada.';
 const candidate:Structure={...p,id:-1,hp:1,tier:0,open:false,revision:0},boxes=structureBoxes(candidate);
 const volume=boxes.filter(b=>b.h!>.2);
 if(volume.some(b=>[-.48,0,.48].some(dx=>[-.48,0,.48].some(dz=>collides({x:b.x+b.w*dx,z:b.z+b.d*dz},.015)))))return 'A peça encosta em uma construção da cidade.';
 if(volume.some(b=>obstacleDistance(BASE,b)<.8&&b.bottom!<1.2))return 'Deixe espaço para a cama do abrigo.';
 if(bodyBlocked(s.player,s.groundY,volume)||s.coopTargets.some(q=>bodyBlocked(q,q.eyeY-(q.crouched?FPS.crouchEye:FPS.eyeHeight),volume))||s.zombies.some(z=>z.active&&bodyBlocked(z,floorHeight(z),volume,.65)))return 'Afaste sobreviventes e infectados do encaixe.';
 if([...s.crafting.tables,...s.crafting.chests].some(t=>volume.some(b=>obstacleDistance(t,b)<.8&&b.bottom!<t.y+1.2&&b.bottom!+b.h!>t.y+.05)))return 'Reposicione o baú ou a mesa que ocupa esse espaço.';
 const targetY=p.kind==='roof'?structureSurfaceY(p)-.05:p.kind==='floor'?structureSurfaceY(p)+.08:Math.min(structureBaseY(p)+1.6,s.player.eyeY);
 if(!clearTo(s,p,targetY))return 'Não é possível construir através de uma parede.';
 if(!materials(s,structureCost(p.kind)))return 'Materiais insuficientes.';
 return '';
}
export function structurePlacement(s:Simulation,kind:StructureKind,rotation=0,level=0):StructurePlacement {
 const r=((Math.round(rotation)%4+4)%4) as 0|1|2|3,l=Math.max(0,Math.min(MAX_LEVEL,Math.round(level))),dir=lookDirection(s.player.angle,s.player.pitch);
 const surface=BUILD_GROUND+l*LEVEL_HEIGHT;
 const reach=Math.max(1.8,Math.min(5,dir.y<-.05?(s.player.eyeY-surface)/-dir.y:3.7));
 const raw={x:s.player.x+dir.x*reach,z:s.player.z+dir.z*reach};
 const p:StructureRequest={kind,rotation:r,level:l,x:isStructureEdge(kind)&&r%2===1?edge(raw.x,BUILD_PLOT.minX):cellCenter(raw.x,BUILD_PLOT.minX),z:isStructureEdge(kind)&&r%2===0?edge(raw.z,BUILD_PLOT.minZ):cellCenter(raw.z,BUILD_PLOT.minZ)};
 const reason=structurePlacementReason(s,p);return {...p,valid:!reason,reason};
}
export function placeStructure(s:Simulation,p:StructureRequest):boolean {
 const reason=structurePlacementReason(s,p);if(reason){s.notice('NÃO FOI POSSÍVEL CONSTRUIR',reason);return false;}
 pay(s,structureCost(p.kind));const piece:Structure={kind:p.kind,x:p.x,z:p.z,level:p.level,rotation:p.rotation,id:s.crafting.next++,tier:0,hp:STRUCTURE_DEFS[p.kind].maxHP,open:false,revision:0};
 s.crafting.structures.push(piece);s.crafting.revision++;s.zombies.forEach(z=>z.replan=0);s.events.push({type:'build',position:piece,y:structureBaseY(piece)+1});s.notice('ESTRUTURA CONSTRUÍDA',`${STRUCTURE_DEFS[p.kind].name} · G para fortificar ou reparar.`);return true;
}
export function focusedStructure(s:Simulation):Structure|undefined {
 const o={x:s.player.x,y:s.player.eyeY,z:s.player.z},dir=lookDirection(s.player.angle,s.player.pitch),all=s.solidDefenses;let nearest=3.5,result:Structure|undefined;
 for(const p of s.crafting.structures){
  // The whole doorway remains interactable while its leaf is swung open.
  const boxes=p.kind==='door'?structureBoxes({...p,open:false}):structureBoxes(p);
  if(p.kind==='snare')boxes.push({...footprint(p),id:`structure-${p.id}-0`,label:'Laço',hp:p.hp,built:true,flash:0,bottom:structureBaseY(p),h:.25});
  for(const b of boxes){const d=rayBox(o,dir,b,nearest);if(d<nearest&&rayWorld(o,dir,d,all.filter(q=>!q.id.startsWith(`structure-${p.id}-`)))>=d-.1){nearest=d;result=p;}}
 }
 return result;
}
export function structureActionReason(s:Simulation,p:Structure,operation:StructureOperation):string {
 if(s.gameOver||s.player.hp<=0||s.action||s.reloadTimer||s.player.running)return 'Aguarde terminar a ação.';
 if(p.hp<=0||!s.crafting.structures.includes(p))return 'Estrutura não encontrada.';
 if(obstacleDistance(s.player,footprint(p))>3.5||Math.abs(structureBaseY(p)-s.groundY)>3.35)return 'Aproxime-se da estrutura.';
 if(!clearTo(s,p,Math.min(s.player.eyeY,structureBaseY(p)+1.5),p.id))return 'A estrutura está atrás de uma parede.';
 if(operation==='fortify'){
  if(p.tier>=2)return 'Fortificação máxima.';
  if(p.hp<structureMaxHP(p)-.01)return 'Repare a estrutura antes de fortificar.';
  if(!materials(s,structureFortifyCost(p)))return 'Materiais insuficientes.';
 }else if(operation==='repair'){
  if(p.hp>=structureMaxHP(p))return 'Estrutura intacta.';
  if(!materials(s,structureRepairCost(p)))return 'Materiais insuficientes.';
 }else if(operation==='toggle'){
  if(p.kind!=='door')return 'Esta estrutura não possui porta.';
  const boxes=structureBoxes({...p,open:!p.open});
  if(bodyBlocked(s.player,s.groundY,boxes)||s.coopTargets.some(q=>bodyBlocked(q,q.eyeY-(q.crouched?FPS.crouchEye:FPS.eyeHeight),boxes))||s.zombies.some(z=>z.active&&bodyBlocked(z,floorHeight(z),boxes,.65)))return 'A passagem está ocupada.';
 }else if(operation==='dismantle'){
  const rest=s.crafting.structures.filter(q=>q!==p&&q.hp>0);
  if(supportedPieces(rest).length!==rest.length)return 'Esta peça sustenta outras estruturas. Desmonte de cima para baixo.';
  if((p.kind==='floor'||p.kind==='roof')&&[...s.crafting.tables,...s.crafting.chests].some(t=>tileAt(t,p)&&same(t.y,structureSurfaceY(p))))return 'Reposicione os móveis apoiados nesta peça.';
 }
 return '';
}
export function manageStructure(s:Simulation,id:number,revision:number,operation:StructureOperation):boolean {
 const p=s.crafting.structures.find(p=>p.id===id);if(!p||p.revision!==revision)return false;
 const reason=structureActionReason(s,p,operation);if(reason){s.notice('ESTRUTURA',reason);return false;}
 if(operation==='fortify'){pay(s,structureFortifyCost(p));p.tier=(p.tier+1) as 1|2;p.hp=structureMaxHP(p);}
 else if(operation==='repair'){pay(s,structureRepairCost(p));p.hp=Math.min(structureMaxHP(p),p.hp+structureMaxHP(p)*.4);}
 else if(operation==='toggle'){p.open=!p.open;s.events.push({type:'door',position:p,y:structureBaseY(p)+1});}
 else {s.crafting.structures.splice(s.crafting.structures.indexOf(p),1);for(const k of itemKeys){const n=Math.floor((structureCost(p.kind)[k]??0)*.5*p.hp/structureMaxHP(p));if(n)s.grantItems(k,n,p);}s.events.push({type:'barricade-break',position:p,y:structureBaseY(p)+1});}
 p.revision++;s.crafting.revision++;s.zombies.forEach(z=>z.replan=0);if(operation==='fortify'||operation==='repair')s.events.push({type:'repair',position:p,y:structureBaseY(p)+1});return true;
}
export function damageStructure(s:Simulation,id:number,amount:number):boolean {
 const p=s.crafting.structures.find(p=>p.id===id);if(!p||amount<=0)return false;
 p.hp=Math.max(0,p.hp-amount);p.revision++;s.crafting.revision++;s.events.push({type:p.hp?'barricade-hit':'barricade-break',position:p,y:structureBaseY(p)+1});
 if(!p.hp){
  s.crafting.structures=supportedPieces(s.crafting.structures);s.zombies.forEach(z=>z.replan=0);
  for(const t of [...s.crafting.tables,...s.crafting.chests]){const y=structureFloorHeight(s,t,t.y);if(t.y!==y){t.y=y;if('revision' in t)t.revision++;}}
 }
 return true;
}
/** A stepped surface can only be entered from a reachable height, never from its high side. */
export function structureFloorHeight(s:Simulation,p:Vec2,previousHeight=floorHeight(p)):number {
 let best=floorHeight(p);if(p.x>=BUILD_PLOT.minX&&p.x<=BUILD_PLOT.maxX&&p.z>=BUILD_PLOT.minZ&&p.z<=BUILD_PLOT.maxZ)best=BUILD_GROUND;
 for(const q of s.crafting.structures){
  if(q.hp<=0)continue;
  if((q.kind==='floor'||q.kind==='roof')&&tileAt(p,q,.015)){const y=structureSurfaceY(q);if(y<=previousHeight+.3)best=Math.max(best,y);}
  if(q.kind==='stairs'){
   const y=stairHeightAt(p,q);if(y!==undefined&&y<=previousHeight+.65)best=Math.max(best,y);
  }
 }
 return best;
}
/** Movement ignores upper-storey walls; stair treads supply ground instead of a 2D blockade. */
export function structureMovementBoxes(s:Simulation,p:Vec2,ground:number,height:number,solids:readonly Barricade[]=s.solidDefenses):Barricade[] {
 return solids.filter(b=>{
  if(Math.abs(p.x-b.x)>b.w/2+FPS.radius+.15||Math.abs(p.z-b.z)>b.d/2+FPS.radius+.15)return false;
  const id=/^structure-(\d+)-/.exec(b.id);if(id){const piece=s.crafting.structures.find(q=>q.id===Number(id[1]));if(piece?.kind==='stairs')return (stairHeightAt(p,piece)??ground)>ground+.3;
   if(piece?.kind==='spikes'||piece?.kind==='snare')return false;}
  return (b.bottom??0)+(b.h??3)>ground+.28&&(b.bottom??0)<ground+height-.03;
 });
}
