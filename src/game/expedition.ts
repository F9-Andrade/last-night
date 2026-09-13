import type { Vec2 } from './world.ts';
import type { EnemyKind } from './enemies.ts';
export interface Facility extends Vec2 { id:string;name:string;kind:'generator'|'cache'|'trunk';state:'ready'|'powered'|'opened';requires?:string;area:string }
export const FACILITIES:Omit<Facility,'state'>[]=[
  {id:'hospital-power',name:'Gerador da triagem',x:38,z:-33,kind:'generator',area:'hospital'},
  {id:'hospital-store',name:'Estoque refrigerado',x:25,z:-26,kind:'cache',requires:'hospital-power',area:'hospital'},
  {id:'police-vault',name:'Armário de apreensões',x:27,z:24,kind:'cache',area:'police'},
  {id:'industrial-vault',name:'Reserva da oficina',x:70,z:69,kind:'cache',area:'gas'},
  {id:'car-trunk',name:'Porta-malas travado',x:-51,z:10,kind:'trunk',area:'house'},
];
export interface WorldEvent extends Vec2 {id:number;kind:'cache'|'alarm'|'roaming';name:string;life:number;triggered:boolean;flavor?:'survivor'|'medical'|'military'|'house'}
export const CACHE_STORIES=[
 {x:-92,z:-67,flavor:'survivor' as const,name:'Mochila de um sobrevivente',area:'house'},
 {x:132,z:-95,flavor:'medical' as const,name:'Entrega médica interrompida',area:'hospital'},
 {x:92,z:112,flavor:'military' as const,name:'Carga militar esquecida',area:'police'},
 {x:-115,z:24,flavor:'house' as const,name:'Sinal na casa barricada',area:'house'},
];
export const EVENT_POINTS=[{x:-35,z:16},{x:34,z:-13},{x:20,z:46},{x:-36,z:-48},...CACHE_STORIES];
export function encounterKinds(index:number,count:number,day:number,health:number,random:()=>number):EnemyKind[]{
  const kinds:EnemyKind[]=Array.from({length:count},()=> 'walker');
  // Hospital/police patrols first; valuable outer industry can host a heavy threat later.
  if(day>=2&&health>35&&random()<.65)kinds[count-1]='runner';
  if(day>=3&&(index===10||index===12))kinds[count-1]='spitter';
  if(day>=4&&index===11)kinds[count-1]='tank';
  return kinds;
}
