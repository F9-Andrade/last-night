import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';
import {randomBytes,randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {NETWORK_BUILD,sanitizeName,validName} from '../src/network/protocol.ts';

/** LAN lobby/relay only. Existing CoopWorld stays authoritative on the elected host. */
export function createLanServer({root=resolve('dist'),port=8787,host='0.0.0.0'}={}){
 const rooms=new Map(),clients=new Set();let nextActor=1;
 const send=(c,value)=>{if(c.ws.readyState===WebSocket.OPEN){if(c.ws.bufferedAmount>4_000_000)c.ws.close(1013,'Slow client');else c.ws.send(JSON.stringify(value));}};
 const members=r=>{for(const c of r.members)send(c,{type:'room',code:r.code,seed:r.seed,master:r.members[0].actor,phase:r.phase,players:r.members.map(v=>({actorNumber:v.actor,playerId:v.id,displayName:v.name,ready:v.ready}))});};
 const error=(c,message)=>send(c,{type:'error',message});
 function leave(c){const r=c.room;if(!r)return;c.room=null;r.members=r.members.filter(v=>v!==c);if(!r.members.length){rooms.delete(r.code);return;}members(r);playing(r);}
 function playing(r){if(r.phase==='loading'&&r.members.every(c=>c.loaded===r.token)){r.phase='playing';for(const c of r.members)send(c,{type:'playing'});}}
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/lan-health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({lan:true,build:NETWORK_BUILD}));return;}
  try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}const info=await stat(path);if(!info.isFile())throw new Error('not file');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2'};res.setHeader('Content-Type',types[extname(path)]??'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.end(await readFile(path));}catch{res.writeHead(404);res.end('Jogo não encontrado. Execute npm run build antes de npm run lan.');}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:250000,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  // No cross-site relay access: open the game served by this LAN host.
  let origin;try{origin=new URL(req.headers.origin);}catch{socket.destroy();return;}
  if(req.url!=='/lan'||origin.host!==req.headers.host||clients.size>=128){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
 });
 wss.on('connection',ws=>{
  const c={ws,actor:nextActor++,id:randomUUID(),name:'',room:null,ready:false,loaded:'',hello:false,alive:true,window:Date.now(),count:0,bytes:0};clients.add(c);
  ws.on('pong',()=>c.alive=true);ws.on('error',()=>{});ws.on('close',()=>{leave(c);clients.delete(c);});
  ws.on('message',raw=>{try{
   const now=Date.now();if(now-c.window>1000){c.window=now;c.count=0;c.bytes=0;}if(++c.count>240||(c.bytes+=raw.length)>4_000_000){ws.close(1008,'Rate limit');return;}
   const m=JSON.parse(raw.toString());if(!m||typeof m!=='object')return;
   if(m.type==='hello'){if(c.hello)return;if(m.build!==NETWORK_BUILD){send(c,{type:'error',fatal:true,message:'Versões diferentes. Atualize o jogo no computador que hospeda a LAN.'});return;}c.name=sanitizeName(m.name);c.hello=true;send(c,{type:'connected',actor:c.actor});return;}
   if(!c.hello)return;
   if(m.type==='name'){c.name=sanitizeName(m.name);c.ready=false;if(c.room)members(c.room);return;}
   if(m.type==='create'||m.type==='join'){
    if(c.room)return;if(!validName(c.name)){error(c,'Use um nome de 2 a 20 caracteres.');return;}
    let r;if(m.type==='create'){if(rooms.size>=64){error(c,'Servidor LAN cheio.');return;}let code;do{code='L'+randomBytes(4).toString('hex').slice(0,5).toUpperCase();}while(rooms.has(code));r={code,seed:randomBytes(4).readUInt32LE(),members:[],phase:'lobby',token:''};rooms.set(code,r);}else r=rooms.get(String(m.code).toUpperCase());
    if(!r){error(c,'Sala LAN não encontrada. Confira o código e o endereço.');return;}if(r.phase!=='lobby'||r.members.length>=4){error(c,'Sala cheia ou partida já iniciada.');return;}c.room=r;c.ready=false;r.members.push(c);members(r);return;
   }
   const r=c.room;if(!r)return;
   if(m.type==='ready'&&r.phase==='lobby'){if(c!==r.members[0])c.ready=!c.ready;members(r);return;}
   if(m.type==='start'&&c===r.members[0]&&r.phase==='lobby'&&r.members.every(v=>v===c||v.ready)){r.phase='loading';r.token=randomUUID();members(r);for(const v of r.members)send(v,{type:'start',data:{seed:r.seed,actors:r.members.map(p=>p.actor),token:r.token}});return;}
   if(m.type==='loaded'&&r.phase==='loading'&&m.token===r.token){c.loaded=m.token;playing(r);return;}
   if(m.type==='event'&&r.phase!=='lobby'&&Number.isInteger(m.code)&&[1,10,11,12,13,14,15,16].includes(m.code)){
    if(m.target!==undefined&&(!Number.isInteger(m.target)||!r.members.some(v=>v.actor===m.target)))return;
    for(const v of r.members)if(v!==c&&(m.target===undefined||v.actor===m.target))send(v,{type:'event',code:m.code,data:m.data,actor:c.actor});
   }
  }catch{/* Malformed payload is discarded, never executed. */}});
 });
 const heartbeat=setInterval(()=>{for(const c of clients){if(!c.alive||!c.hello&&Date.now()-c.window>30000){c.ws.terminate();continue;}c.alive=false;c.ws.ping();}},15000);heartbeat.unref();
 return {server,rooms,listen:()=>new Promise(resolve=>server.listen(port,host,()=>resolve(server.address()))),close:()=>new Promise(resolve=>{clearInterval(heartbeat);for(const c of clients)c.ws.terminate();wss.close();server.close(resolve);})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const lan=createLanServer({port:Number(process.env.LAN_PORT)||8787});await lan.listen();console.log('LAST NIGHT LAN — mantenha este terminal aberto.');for(const entries of Object.values(networkInterfaces()))for(const n of entries??[])if(n.family==='IPv4')console.log(`Abra em cada computador: http://${n.address}:${Number(process.env.LAN_PORT)||8787}/?coop=lan`);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void lan.close().then(()=>process.exit(0));});
}
