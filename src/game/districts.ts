/** Authored expansion: the original district remains inside the central 78 m square. */
export const REGIONS = [
  {x:1,z:2,name:'ABRIGO 07',icon:'07'}, {x:-25,z:-6,name:'MERCADO',icon:'M'},
  {x:30,z:-30,name:'HOSPITAL SANTA LUZ',icon:'+'},{x:30,z:29,name:'DELEGACIA',icon:'P'},
  {x:-27,z:26,name:'ÚLTIMA PARADA',icon:'G'},{x:60,z:57,name:'ZONA INDUSTRIAL',icon:'I'},
  {x:-59,z:-57,name:'JARDINS DO NORTE',icon:'R'},{x:-60,z:3,name:'GALERIA SANTA LUZ',icon:'C'},
  {x:0,z:59,name:'PRAÇA DA EVACUAÇÃO',icon:'E'},{x:5,z:-59,name:'VILA DAS ACÁCIAS',icon:'R'},
  {x:61,z:-58,name:'TRIAGEM EXTERNA',icon:'+'},{x:-59,z:58,name:'PÁTIO DE MANUTENÇÃO',icon:'S'},
];
export const OUTER_HOUSES = [
  [-65,-66,0xb08c75],[-44,-65,0x809d91],[-64,-43,0xb5a07c],[-43,-43,0x9f9a80],
  [-21,-61,0x91a292],[2,-65,0xb08b71],[24,-62,0xa9a583],[-23,-43,0xb2a27d],[2,-45,0x829d97],
  [-65,-22,0x9aaf9a],[-62,0,0xb29373],[-62,24,0x7f9e98],
  [-64,44,0xb09576],[-43,63,0x839b96],[-20,64,0xb19b81],
  [63,-22,0x9eb0a0],[64,1,0x939d88],[63,25,0xab977c],
];
export const WAREHOUSES = [{x:61,z:60,w:23,d:15,h:7},{x:62,z:40,w:22,d:10,h:5.5},{x:-62,z:64,w:19,d:10,h:4}];
export const OUTER_CARS = [
  {x:40,z:-24,angle:1.3,color:0xc3c4ad},{x:44,z:-20,angle:.7,color:0xb8b8a3},
  {x:40,z:28,angle:0,color:0x586e77},{x:44,z:31,angle:1.1,color:0x5a7278},
  {x:-49,z:-54,angle:0,color:0xa48b75},{x:-49,z:-58,angle:.1,color:0x8a9d94},{x:-48,z:-62,angle:-.3,color:0xb4a184},
  {x:-54,z:9,angle:1.5,color:0xb18b6c},{x:56,z:52,angle:1.6,color:0x8b9f9b},
  {x:16,z:48,angle:-.4,color:0xa3987d},{x:57,z:-58,angle:.15,color:0xc9c7b0},
  {x:-59,z:54,angle:1.5,color:0xa39379},
];
export const ENCOUNTERS = [
  {x:38,z:-14,count:3},{x:39,z:20,count:3},{x:-36,z:23,count:2},
  {x:-56,z:-56,count:2},{x:-36,z:-47,count:2},{x:9,z:-57,count:2},
  {x:-54,z:-6,count:2},{x:-53,z:29,count:2},{x:-51,z:58,count:2},
  {x:8,z:57,count:2},{x:54,z:32,count:3},{x:47,z:65,count:3},{x:60,z:-49,count:3},{x:55,z:6,count:2},
];
export const ALARMS=[{x:-54,z:9},{x:40,z:28},{x:-49,z:-58}];
export const ROADS = [{x:-12,z:0,w:9,d:156},{x:15,z:0,w:7,d:156},{x:0,z:13,w:156,d:8},{x:0,z:-16,w:156,d:5},{x:-49,z:0,w:7,d:156},{x:49,z:0,w:7,d:156},{x:0,z:-50,w:156,d:7},{x:0,z:49,w:156,d:7}];

/** Large solid props share authored footprints with the visual placement. */
export const CARGO_OBSTACLES = [53,57,61].map(x=>({x,z:49,w:2.7,d:6})).concat([-66,-62,-58].map(x=>({x,z:54,w:2.7,d:6})));
export const PLAZA_MONUMENT = {x:0,z:59,w:5,d:5};
