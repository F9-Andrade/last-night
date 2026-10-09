import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HostingService} from '../src/services/hosting-service.ts';
const world='20000000-0000-4000-8000-000000000002',owner='10000000-0000-4000-8000-000000000001',friend='10000000-0000-4000-8000-000000000003';
test('missing permission RPC disables delegation, while network/access errors never masquerade as grants',async()=>{
 let error:any={code:'PGRST202'},data:any=null;
 const service=new HostingService({rpc:()=>({abortSignal:async()=>({error,data}),then(resolve:any){return Promise.resolve({error,data}).then(resolve);}})} as never);
 assert.equal(await service.permissions(world),null);await assert.rejects(()=>service.set(world,friend,true),/habilitada/);
 error={code:'42501'};await assert.rejects(()=>service.permissions(world),/negado/);
 error=null;data=[{user_id:owner},{user_id:friend}];assert.deepEqual(await service.permissions(world),[owner,friend]);
 data=[{user_id:'forged'}];await assert.rejects(()=>service.permissions(world),/inválidas/);
});
test('persistent grants match an authenticated saved binding, never a name, another account, actor or room',async()=>{
 const binding={userId:friend,playerId:'peer-two',actor:2,token:'session-one'};let rows:any[]=[];
 const query={select(){return this;},eq(){return this;},in(){return this;},async abortSignal(){return {data:rows,error:null};}};
 const service=new HostingService({from:()=>query} as never),peers=[{actorNumber:2,playerId:'peer-two',displayName:'Owner'}] as never;
 for(const invalid of [null,'invalid',[],42,{...binding,token:'other-room'},{...binding,actor:3},{...binding,userId:owner},{...binding,playerId:'fake'}]){rows=[{user_id:friend,binding:invalid}];assert.deepEqual(await service.actors(world,'session-one',peers,[friend]),[]);}
 rows=[{user_id:friend,binding}];assert.deepEqual(await service.actors(world,'session-one',peers,[friend]),[2]);assert.deepEqual(await service.actors(world,'session-one',peers,[]),[]);
});
