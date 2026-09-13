/** Authored outer Santa Luz. Data shared by collision, encounters, loot and voxel chunks. */
export const CITY_LIMIT=156;
export type SiteKind='hospital'|'school'|'motel'|'market'|'industry'|'fire'|'cemetery'|'quarantine'|'gas'|'police'|'house';
export interface Footprint {x:number;z:number;w:number;d:number}
export interface CityProp extends Footprint {kind:'bed'|'desk'|'shelf'|'bench'|'grave'|'crate'}
export interface CitySite extends Footprint {id:string;name:string;kind:SiteKind;h:number;color:number;risk:number;story:string;props:CityProp[];partitions:Footprint[]}
const plan=(kind:SiteKind,w:number,d:number):{props:CityProp[];partitions:Footprint[]}=>{
 const props:CityProp[]=[],partitions:Footprint[]=[];
 if(kind==='cemetery'){for(const x of [-9,-5,5,9])for(const z of [-7,-2,3,8])props.push({x,z,w:1.4,d:2.6,kind:'grave'});return {props,partitions};}
 if(kind==='motel'||kind==='hospital'||kind==='school'){
  for(const side of [-1,1])for(const z of [-d*.3,0,d*.3]){props.push({x:side*w*.32,z,w:kind==='school'?3:1.6,d:kind==='school'?1.2:3,kind:kind==='school'?'desk':'bed'});if(z!==0)partitions.push({x:side*w*.31,z:z+d*.12,w:w*.35,d:.35});}
  for(const side of [-1,1])for(const z of [-d*.39,0,d*.39])partitions.push({x:side*3.5,z,w:.35,d:Math.max(1.4,d*.14)});
 }else if(kind==='market'||kind==='industry'){
  for(const x of [-w*.3,0,w*.3])for(const z of [-d*.24,d*.24])props.push({x,z,w:1.3,d:d*.27,kind:kind==='market'?'shelf':'crate'});
 }else if(kind==='quarantine'){
  for(const x of [-w*.3,w*.3])for(const z of [-d*.22,d*.22])props.push({x,z,w:3,d:3,kind:'crate'});
  props.push({x:0,z:-d*.3,w:1.6,d:3,kind:'bed'});
 }else{
  props.push({x:-w*.3,z:-d*.22,w:2.6,d:1.2,kind:'desk'},{x:w*.3,z:d*.2,w:1,d:3,kind:'shelf'},{x:-w*.3,z:d*.25,w:kind==='house'?1.5:3,d:kind==='house'?3:1,kind:kind==='house'?'bed':'bench'});
  if(kind==='police')for(const x of [-w*.3,w*.3])partitions.push({x,z:0,w:w*.3,d:.3});
 }
 return {props,partitions};
};
const site=(id:string,name:string,kind:SiteKind,x:number,z:number,w:number,d:number,risk:number,story:string):CitySite=>({id,name,kind,x,z,w,d,h:kind==='house'?3.6:kind==='industry'?6.5:kind==='hospital'?6:4.7,color:kind==='hospital'?0xb8c2ad:kind==='quarantine'?0x6d8070:kind==='school'?0xc1ad83:kind==='police'?0x7e9695:kind==='motel'?0xac8870:0x8c9c84,risk,story,...plan(kind,w,d)});
export const CITY_SITES:CitySite[]=[
 site('school','ESCOLA MUNICIPAL AURORA','school',-112,-112,26,22,3,'A fila da merenda parou. O ginásio virou abrigo.'),
 site('hospital-main','HOSPITAL SANTA LUZ · ALA NORTE','hospital',112,-112,30,26,5,'Triagem, enfermaria e ala isolada. A energia de emergência ainda funciona.'),
 site('motel','MOTEL BEIRA ESTRADA','motel',-113,-24,26,22,3,'Portas numeradas. Uma barricada foi montada por dentro.'),
 site('hypermarket','HIPERMERCADO UNIÃO','market',-113,65,30,24,4,'Carrinhos abandonados e a última carga na doca.'),
 site('foundry','FUNDIÇÃO SANTA LUZ','industry',113,78,28,22,5,'A sirene da fábrica parou. Os containers ainda estão cheios.'),
 site('firehouse','BOMBEIROS · ESTAÇÃO 04','fire',16,116,26,20,3,'Mangueiras secas, equipamentos e mapa de evacuação.'),
 site('cemetery','CEMITÉRIO SÃO MIGUEL','cemetery',-56,119,30,26,4,'Sepulturas recentes atravessam as alamedas.'),
 site('quarantine','QUARENTENA · SETOR ZERO','quarantine',114,129,32,24,7,'O último checkpoint. Cercas, tendas e ordens que ninguém cumpriu.'),
 site('highway','POSTO DA RODOVIA','gas',-114,126,24,18,3,'Um caminhão bloqueia a saída. A oficina tem outra entrada.'),
 site('precinct','DEPÓSITO DA GUARDA','police',113,16,24,22,5,'Celas vazias, apreensões e a garagem da última patrulha.'),
 ...[[-113,-67],[-65,-112],[17,-115],[62,-115],[-114,22],[63,122],[-64,79],[113,-62]].map(([x,z],i)=>site(`home-${i}`,`CASA ${i+1} · ${i<4?'JARDINS':'VILA NOVA'}`,'house',x,z,12,11,2,'Uma mesa posta. Malas junto à saída.')),
];
export interface Portal extends Footprint {id:string;site:string;kind:'door'|'window';initial:'open'|'closed'|'barred';hp:number;state:'open'|'closed'|'barred';heavy:boolean}
export const CITY_PORTALS:Portal[]=CITY_SITES.flatMap(s=>[
 {id:`${s.id}-front`,site:s.id,x:s.x,z:s.z+s.d/2,w:3.2,d:.35,kind:'door' as const,initial:(s.kind==='quarantine'||s.kind==='motel'?'barred':s.kind==='cemetery'?'open':'closed') as Portal['state'],state:(s.kind==='quarantine'||s.kind==='motel'?'barred':s.kind==='cemetery'?'open':'closed') as Portal['state'],hp:120,heavy:s.risk>=5},
 {id:`${s.id}-side`,site:s.id,x:s.x+s.w/2,z:s.z,w:.35,d:2.8,kind:'window' as const,initial:(s.kind==='industry'||s.kind==='cemetery'?'open':'closed') as Portal['state'],state:(s.kind==='industry'||s.kind==='cemetery'?'open':'closed') as Portal['state'],hp:35,heavy:false},
]);
export function siteObstacles(s:CitySite):Footprint[]{
 const front=(s.w-3.2)/2,side=(s.d-2.8)/2;
 return [{x:s.x-s.w/2,z:s.z,w:.35,d:s.d},{x:s.x,z:s.z-s.d/2,w:s.w,d:.35},
 ...[-1,1].map(sign=>({x:s.x+sign*(1.6+front/2),z:s.z+s.d/2,w:front,d:.35})),
 ...[-1,1].map(sign=>({x:s.x+s.w/2,z:s.z+sign*(1.4+side/2),w:.35,d:side})),
 ...(s.kind!=='house'?[{x:s.x-s.w/2+3,z:s.z+s.d/2+5.8,w:4.6,d:2}]:[]),
 ...(s.kind==='industry'?[{x:s.x-s.w/2+3,z:s.z-s.d/2-2,w:2,d:2}]:s.kind==='gas'?[-5,5].map(x=>({x:s.x+x,z:s.z+s.d/2+5,w:1,d:1})):s.kind==='hospital'?[6,8,10].map(x=>({x:s.x+x,z:s.z-s.d/2+2,w:1.4,d:3})):[]),
 ...s.props.map(p=>({...p,x:s.x+p.x,z:s.z+p.z})),...s.partitions.map(p=>({...p,x:s.x+p.x,z:s.z+p.z}))];
}
export const CITY_ROADS=[...[-142,-88,88,142].map(x=>({x,z:0,w:7,d:CITY_LIMIT*2})),...[-142,-88,88,147].map(z=>({x:0,z,w:CITY_LIMIT*2,d:7}))];
export const CITY_LOOT=CITY_SITES.flatMap(s=>[
 {id:`${s.id}-entry`,x:s.x-2,z:s.z+s.d*.25,area:(s.kind==='hospital'?'hospital':s.kind==='police'||s.kind==='quarantine'?'police':s.kind==='industry'||s.kind==='gas'?'gas':s.kind==='house'||s.kind==='motel'?'house':'market'),label:s.kind==='hospital'?'Carrinho de curativos':s.kind==='police'?'Locker da patrulha':'Suprimentos abandonados',site:s.id,valuable:false},
 {id:`${s.id}-deep`,x:s.x+2,z:s.z-s.d*.28,area:(s.kind==='hospital'?'hospital':s.kind==='police'||s.kind==='quarantine'?'police':s.kind==='industry'?'gas':'house'),label:s.risk>=5?'Reserva da área isolada':'Armário do fundo',site:s.id,valuable:s.risk>=4},
 {id:`${s.id}-yard`,x:s.x+s.w/2+3,z:s.z+s.d/2-2,area:'outside',label:'Mochila junto à saída',site:s.id,valuable:false},
]);
export const activeCityChunks=(x:number,z:number)=>CITY_SITES.filter(s=>Math.hypot(s.x-x,s.z-z)<72+Math.max(s.w,s.d)/2);
