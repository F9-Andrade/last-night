/** Fixed, deterministic city infill. Planning is done once, never while playing.
 * Every solid has the same footprint in navigation, raycasts and presentation.
 */
export interface UrbanRect {x:number;z:number;w:number;d:number;h?:number}
export interface UrbanBuilding extends UrbanRect {id:string;h:number;floors:number;style:'house'|'shop'|'apartment'|'workshop';color:number;damage:number;name:string;front:1|-1}
export type VehicleKind='sedan'|'hatch'|'suv'|'pickup'|'van'|'truck'|'bus'|'ambulance'|'police';
export interface UrbanVehicle extends UrbanRect {id:string;h:number;kind:VehicleKind;angle:number;color:number;wreck:boolean;open:boolean}
export interface StreetScene {id:string;x:number;z:number;kind:'evacuation'|'triage'|'checkpoint'|'delivery'|'escape'|'crash';story:string}
export interface UrbanPlan {buildings:UrbanBuilding[];vehicles:UrbanVehicle[];scenes:StreetScene[];obstacles:UrbanRect[];alleys:{x:number;z:number;id:string}[]}
const overlap=(a:UrbanRect,b:UrbanRect,margin=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+margin&&Math.abs(a.z-b.z)<(a.d+b.d)/2+margin;
export function planUrban(existing:UrbanRect[],roads:UrbanRect[],protectedPoints:{x:number;z:number}[],sites:UrbanRect[]):UrbanPlan {
 const buildings:UrbanBuilding[]=[],vehicles:UrbanVehicle[]=[],alleys:UrbanPlan['alleys']=[];
 const reserved=[...existing,...sites.map(s=>({...s,w:s.w+6,d:s.d+10})),...protectedPoints.map(p=>({...p,w:5,d:5})),{x:0,z:59,w:28,d:26}];
 const palette=[0xab8c75,0x8fa597,0xbab18a,0x849496,0xa77e64,0xc0b39a];
 const names=['MERCEARIA LUZ','OFICINA DO NINO','BAR SÃO MIGUEL','FARMÁCIA POPULAR','PAPELARIA AURORA','LANCHONETE 24H','DEPÓSITO CENTRAL','ARMAZÉM LIMA'];
 let seed=9031;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const offset of [0,5])for(let z=-130+offset;z<=134;z+=10)for(let x=-130+offset;x<=134;x+=10){
  if(Math.abs(x)<39&&Math.abs(z)<40)continue;
  const r=random(),w=6+Math.floor(random()*4),d=6+Math.floor(random()*4);
  const lot={x:x+(random()-.5)*1.5,z:z+(random()-.5)*1.5,w,d};
  if(roads.some(road=>overlap(lot,road,1.8))||reserved.some(o=>overlap(lot,o,1.25))||buildings.some(o=>overlap(lot,o,2.5)))continue;
  const industrial=x>75&&z>30,commercial=Math.abs(x)<85&&z>-40&&z<90;
  const style=industrial?'workshop':commercial&&r<.55?'shop':r>.74?'apartment':'house';
  const floors=style==='apartment'?2+Math.floor(random()*3):style==='house'&&r>.48?2:1;
  const h=style==='workshop'?5.5:floors*2.9+.3;
  const index=buildings.length,front:1|-1=roads.filter(v=>v.w>v.d).sort((a,b)=>Math.abs(a.z-lot.z)-Math.abs(b.z-lot.z))[0].z<lot.z?-1:1;
  buildings.push({...lot,id:`urban-${index}`,style,floors,h,color:palette[index%palette.length],damage:index%5,name:names[index%names.length],front});
  if(index%5===0){const a={id:`alley-${index}`,x:lot.x+w/2+1.45,z:lot.z,w:1.2,d:1.2};if(!reserved.some(o=>overlap(a,o,.6))){alleys.push(a);reserved.push(a);}}
 }
 const scenes:StreetScene[]=[
  {id:'failed-evacuation',x:-88,z:-105,kind:'evacuation',story:'Fila de fuga interrompida; malas e um ônibus sem passageiros.'},
  {id:'hospital-triage',x:133,z:-112,kind:'triage',story:'A ambulância chegou. As macas ficaram do lado de fora.'},
  {id:'last-checkpoint',x:142,z:127,kind:'checkpoint',story:'A faixa de evacuação termina em sacos de areia.'},
  {id:'factory-delivery',x:88,z:61,kind:'delivery',story:'A carga nunca entrou na fundição.'},
  {id:'police-crash',x:101,z:36,kind:'crash',story:'Viatura contra o poste, fita e cartuchos vazios.'},
  {id:'family-escape',x:-88,z:18,kind:'escape',story:'Porta aberta, malas e sangue na direção das casas.'},
  {id:'southern-bus',x:41,z:88,kind:'evacuation',story:'O terminal ficou sem destino.'},
 ];
 const kinds:VehicleKind[]=['sedan','hatch','suv','pickup','van','truck','bus','ambulance','police'];
 const addCar=(x:number,z:number,kind:VehicleKind,angle:number,wreck=false,open=false)=>{
  const length=kind==='bus'?9:kind==='truck'?7.2:kind==='ambulance'||kind==='van'?5.2:4;
  const width=kind==='bus'||kind==='truck'?2.5:1.9,h=kind==='bus'||kind==='truck'?3:kind==='van'||kind==='ambulance'?2.5:1.65;
  const car={x,z,w:Math.abs(Math.cos(angle))*width+Math.abs(Math.sin(angle))*length,d:Math.abs(Math.cos(angle))*length+Math.abs(Math.sin(angle))*width,h};
  if(reserved.some(o=>overlap(car,o,.8))||buildings.some(o=>overlap(car,o,1))||vehicles.some(o=>overlap(car,o,1)))return;
  vehicles.push({...car,id:`vehicle-${vehicles.length}`,kind,angle,color:palette[vehicles.length%palette.length],wreck,open});
 };
 for(const s of scenes){
  addCar(s.x-1,s.z,s.kind==='triage'?'ambulance':s.kind==='checkpoint'?'truck':s.kind==='delivery'?'truck':s.kind==='crash'?'police':'sedan',s.kind==='crash'?.45:.04,s.kind==='crash',s.kind==='escape');
  if(s.kind==='evacuation'){addCar(s.x+1,s.z-9,'bus',.12,true);addCar(s.x-1,s.z+7,'hatch',-.1,false,true);}
 }
 // Parked cars at authored spacing leave a continuous lane and intersections clear.
 for(const road of roads)for(let n=-126;n<140;n+=29){
  const horizontal=road.w>road.d,x=horizontal?n:road.x+road.w/2-1.4,z=horizontal?road.z+road.d/2-1.4:n;
  if(Math.abs(x)<35&&Math.abs(z)<40||roads.some(r=>r!==road&&overlap({x,z,w:8,d:8},r,3)))continue;
  addCar(x,z,kinds[(vehicles.length+3)%kinds.length],horizontal?Math.PI/2:0,vehicles.length%11===0,vehicles.length%13===0);
 }
 return {buildings,vehicles,scenes,alleys,obstacles:[...buildings,...vehicles]};
}
