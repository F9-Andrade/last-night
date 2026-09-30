import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createLanServer} from '../scripts/lan-server.mjs';
import {NETWORK_BUILD} from '../src/network/protocol.ts';

test('LAN rooms, readiness, relay identity, loading barrier and host migration',async()=>{
 const lan=createLanServer({port:0,host:'127.0.0.1'}),address=await lan.listen(),url=`http://127.0.0.1:${address.port}`,clients=[];
 async function client(){const ws=new WebSocket(url.replace('http','ws')+'/lan',{origin:url});const queue=[];ws.on('message',data=>queue.push(JSON.parse(data.toString())));await once(ws,'open');const send=m=>ws.send(JSON.stringify(m));const take=async(type,predicate=()=>true)=>{for(let i=0;i<100;i++){const n=queue.findIndex(v=>v.type===type&&predicate(v));if(n>=0)return queue.splice(n,1)[0];await new Promise(r=>setTimeout(r,10));}throw new Error('Missing '+type);};const c={ws,send,take,queue};clients.push(c);send({type:'hello',build:NETWORK_BUILD,name:'Sobrevivente'});c.actor=(await take('connected')).actor;return c;}
 try{
  const a=await client(),b=await client();a.send({type:'create'});const first=await a.take('room');b.send({type:'join',code:first.code});await b.take('room');await a.take('room',m=>m.players.length===2);
  b.send({type:'start'});await new Promise(r=>setTimeout(r,30));assert.equal(b.queue.some(m=>m.type==='start'),false);
  b.send({type:'ready'});await a.take('room',m=>m.players.every(p=>p.actorNumber===a.actor||p.ready));a.send({type:'start'});const startA=await a.take('start'),startB=await b.take('start');assert.deepEqual(startA.data,startB.data);
  a.send({type:'loaded',token:startA.data.token});await new Promise(r=>setTimeout(r,30));assert.equal(a.queue.some(m=>m.type==='playing'),false);b.send({type:'loaded',token:startB.data.token});await a.take('playing');await b.take('playing');
  b.send({type:'event',code:10,data:{marker:'action'},target:a.actor,actor:999});const action=await a.take('event');assert.equal(action.actor,b.actor);assert.deepEqual(action.data,{marker:'action'});
  a.send({type:'event',code:11,data:{large:'x'.repeat(137000)}});assert.equal((await b.take('event')).data.large.length,137000);
  const c=await client();c.send({type:'join',code:first.code});assert.match((await c.take('error')).message,/iniciada/);
  a.ws.close();const migrated=await b.take('room',m=>m.master===b.actor);assert.equal(migrated.phase,'playing');assert.equal(migrated.players.length,1);
  assert.equal((await fetch(url+'/lan-health').then(r=>r.json())).build,NETWORK_BUILD);
 }finally{for(const c of clients)c.ws.terminate();await lan.close();}
});
test('LAN rejects incompatible builds and cross-origin WebSocket upgrades',async()=>{
 const lan=createLanServer({port:0,host:'127.0.0.1'}),{port}=await lan.listen(),url=`http://127.0.0.1:${port}`;
 try{const ws=new WebSocket(url.replace('http','ws')+'/lan',{origin:url});await once(ws,'open');const message=once(ws,'message');ws.send(JSON.stringify({type:'hello',build:'old',name:'Player'}));assert.equal(JSON.parse(String((await message)[0])).type,'error');ws.terminate();
 const rejected=new WebSocket(url.replace('http','ws')+'/lan',{origin:'https://elsewhere.invalid'});await once(rejected,'error');assert.notEqual(rejected.readyState,WebSocket.OPEN);rejected.terminate();
 }finally{await lan.close();}
});
test('LAN limits rooms to four survivors and frees slots on disconnect',async()=>{
 const lan=createLanServer({port:0,host:'127.0.0.1'}),{port}=await lan.listen(),origin=`http://127.0.0.1:${port}`,clients=[];
 async function make(){const ws=new WebSocket(origin.replace('http','ws')+'/lan',{origin});const queue=[];ws.on('message',data=>queue.push(JSON.parse(data.toString())));await once(ws,'open');const take=async(type)=>{for(let i=0;i<100;i++){const index=queue.findIndex(m=>m.type===type);if(index>=0)return queue.splice(index,1)[0];await new Promise(r=>setTimeout(r,10));}throw new Error(type);};const send=m=>ws.send(JSON.stringify(m));clients.push(ws);send({type:'hello',build:NETWORK_BUILD,name:'Sobrevivente'});await take('connected');return {ws,send,take};}
 try{const a=await make();a.send({type:'create'});const {code}=await a.take('room');for(let i=0;i<3;i++){const c=await make();c.send({type:'join',code});await c.take('room');}const extra=await make();extra.send({type:'join',code});assert.match((await extra.take('error')).message,/cheia/);clients[1].close();await once(clients[1],'close');extra.send({type:'join',code});assert.equal((await extra.take('room')).players.length,4);}finally{for(const c of clients)c.terminate();await lan.close();}
});
