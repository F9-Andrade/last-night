// Isolated PostgreSQL/WASM only. Never connects to a server or reads credentials.
// node scripts/test-hosting-migration.mjs <pglite dist/index.js> <reference-schema.sql>
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [modulePath,schemaPath]=process.argv.slice(2);
if(!modulePath||!schemaPath)throw new Error('Supply the local PGlite module and reference schema file.');
const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
const owner='10000000-0000-4000-8000-000000000001',friend='10000000-0000-4000-8000-000000000002',stranger='10000000-0000-4000-8000-000000000003',world='20000000-0000-4000-8000-000000000001';
const identity=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id??'',role]);await db.exec(`set role ${role}`);};
const denied=async(fn,code='42501')=>assert.rejects(fn,e=>e.code===code);
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
 grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid(),auth.role() to authenticated,anon;`);
 // gen_random_uuid is built into modern PostgreSQL; the reference's extension
 // installation is unnecessary in this ephemeral WASM runtime.
 const schema=(await readFile(schemaPath,'utf8')).replace('create extension if not exists pgcrypto;','');
 await db.exec(schema);
 await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated');
 const before=(await db.query('select schemaname,tablename,policyname,cmd,qual,with_check from pg_policies order by schemaname,tablename,policyname')).rows;
 await db.exec(await readFile(new URL('../docs/supabase/002-world-host-permissions.proposed.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query('select schemaname,tablename,policyname,cmd,qual,with_check from pg_policies order by schemaname,tablename,policyname')).rows,before);
 for(const [id,username] of [[owner,'Owner_test'],[friend,'Friend_test'],[stranger,'Stranger_test']])await db.query('insert into auth.users values($1,$2)',[id,{username}]);
 await identity(owner);await db.query('insert into public.worlds(id,owner_id,name,seed) values($1,$2,$3,1977)',[world,owner,'Test']);await db.query("insert into public.world_members(world_id,user_id,role) values($1,$2,'member')",[world,friend]);
 const grants=async()=> (await db.query('select * from public.get_world_host_permissions($1)',[world])).rows.map(r=>r.user_id).sort();
 assert.deepEqual(await grants(),[owner]);
 await denied(()=>db.query('insert into public.world_host_permissions values($1,$2,now())',[world,friend]));
 const grant=allowed=>db.query('select public.set_world_host_permission($1,$2,$3)',[world,friend,allowed]);
 await grant(true);await grant(true);assert.deepEqual(await grants(),[owner,friend].sort());
 const payload=seq=>({format:'last-night',schema_version:1,runSeed:1977,extra:{},checkpoint:{v:2,revision:seq,survival:{day:3,elapsed:18},players:[]}});
 const save=async(revision,seq,token='session-one')=>(await db.query('select public.save_hosted_world($1,$2,$3,$4) as revision',[world,revision,payload(seq),token])).rows[0].revision;
 assert.equal(await save(0,10),1);
 await identity(friend);await denied(()=>grant(true));assert.deepEqual(await grants(),[owner,friend].sort());
 // Even authorized friends cannot use direct world_state writes (RLS unchanged).
 assert.equal((await db.query('update public.world_state set revision=500 where world_id=$1 returning revision',[world])).rows.length,0);
 assert.equal(await save(0,11),2,'new host saves newer checkpoint of same session despite old base revision');
 assert.equal(await save(0,11),2,'identical retry is idempotent');
 await denied(()=>save(0,10),'40001');await denied(()=>save(2,10),'40001');await denied(()=>save(0,12,'another-session'),'40001');await denied(()=>save(0,12,null),'40001');
 assert.equal((await db.query('select current_day,game_time from public.worlds where id=$1',[world])).rows[0].current_day,3);
 await identity(null);await denied(grants);await denied(()=>save(2,12));
 await identity(stranger);await denied(grants);await denied(()=>save(2,12));await denied(()=>grant(true));
 await identity(null,'anon');await denied(grants);await denied(()=>save(2,12));
 // A failure in the summary update must roll back the state/revision too.
 await db.exec(`reset role;create function public.test_summary_failure() returns trigger language plpgsql as $$begin raise exception 'test failure';end;$$;
 create trigger test_fail_summary before update on public.worlds for each row execute function public.test_summary_failure();`);
 await identity(friend);await denied(()=>save(2,12),'P0001');
 assert.equal((await db.query('select revision from public.world_state where world_id=$1',[world])).rows[0].revision,2);
 await db.exec('reset role;drop trigger test_fail_summary on public.worlds;drop function public.test_summary_failure()');
 await identity(owner);await grant(false);await identity(friend);await denied(()=>save(2,12));
 await identity(owner);await grant(true);await db.query('delete from public.world_members where world_id=$1 and user_id=$2',[world,friend]);assert.deepEqual(await grants(),[owner]);
 await identity(friend);await denied(()=>save(2,12));
 await db.exec('reset role');assert.equal((await db.query('select revision from public.world_state where world_id=$1',[world])).rows[0].revision,2);
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.world_host_permissions'::regclass")).rows[0].relrowsecurity,true);
 console.log('PASS: unchanged policies, owner-only idempotent grants, no direct writes/anon/nonmember access, atomic save, session CAS, stale checkpoint rejection, revocation, membership cascade.');
}finally{await db.close();}
