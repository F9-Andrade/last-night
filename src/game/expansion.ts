/** Stable outer districts: existing Santa Luz coordinates and identifiers never move. */
export const EXPANDED_LIMIT=624;
const names=['VILA FERROVIÁRIA','BOSQUE DO SILÊNCIO','PARQUE INDUSTRIAL','JARDIM ESPERANÇA','PORTO SECO','CONJUNTO HORIZONTE','COLÔNIA OPERÁRIA','NOVA AURORA','CIDADE ALTA','ESTAÇÃO OESTE','DISTRITO DAS OLARIAS','VILA DOS PINHEIROS','PARQUE DAS ÁGUAS','SETOR MILITAR','VALE DO SOL','BAIRRO DA SERRA','PÁTIO LOGÍSTICO','JARDIM UNIÃO','VILA DO LAGO','SÃO BENTO','ALTO DAS ACÁCIAS','MORADA VELHA','COLINA NORTE','EXTREMO SUL'];
export const EXPANSION_DISTRICTS=[-468,-234,0,234,468].flatMap(z=>[-468,-234,0,234,468].filter(x=>x||z).map(x=>({x,z}))).map((p,i)=>({...p,id:`outer-${i}`,name:names[i],index:i}));
export const EXPANSION_ROADS=[-468,-234,234,468].flatMap(n=>[{x:n,z:0,w:8,d:EXPANDED_LIMIT*2},{x:0,z:n,w:EXPANDED_LIMIT*2,d:8}]);
// The axis districts join the original arterial roads through short cross streets.
EXPANSION_ROADS.push(...EXPANSION_DISTRICTS.filter(p=>!p.x).map(p=>({x:0,z:p.z,w:180,d:8})),...EXPANSION_DISTRICTS.filter(p=>!p.z).map(p=>({x:p.x,z:0,w:8,d:180})));
