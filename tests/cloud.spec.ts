import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const worldId='20000000-0000-4000-8000-000000000002',owner='10000000-0000-4000-8000-000000000001',member='10000000-0000-4000-8000-000000000003';
// Deliberately differs from the ?test fixture seed; cloud entry must use the saved seed.
const savedWorldSeed=4321;
const read=(p:Page)=>p.evaluate(()=>(window as any).__LAST_NIGHT__.state());
async function layout(p:Page){return p.evaluate(async()=>{
 const [{worldLayoutSummary},{CITY_SITES},{BUILDINGS}]=await Promise.all([import('/src/game/world-layout.ts'),import('/src/game/city.ts'),import('/src/game/world.ts')]);
 const sim=(window as any).__LAST_NIGHT__.simulationFixture(),summary=worldLayoutSummary();
 return {seed:summary.seed,version:summary.version,runSeed:sim.runSeed,simulationVersion:sim.layoutVersion,sites:CITY_SITES.map(s=>[s.id,s.x,s.z]),buildings:BUILDINGS.map(s=>[s.kind,s.x,s.z]),portals:sim.portals.map((p:any)=>[p.id,p.x,p.z]),merchants:sim.economy.merchants.map((m:any)=>[m.id,m.x,m.z])};
});}
async function expectSavedLayout(p:Page,version=1){const current=await layout(p);expect(current.runSeed).toBe(savedWorldSeed);expect(current.version).toBe(version);expect(current.simulationVersion).toBe(version);if(version===1)expect(current.seed).toBe(savedWorldSeed);return current;}
function backend(){
 let createdWorldId=worldId;
 const users=[{id:owner,email:'owner@example.test',username:'Owner_test'},{id:member,email:'member@example.test',username:'Member_test'}];
 let world:any=null,state:any=null;const saves=new Map<string,any>(),members=new Set([owner]),requests:{path:string;method:string;user:string}[]=[];let stamp=0,fail=false,inviteUses=0;const invites=new Map<string,any>();
 const timestamp=()=>new Date(Date.UTC(2026,9,7,12,0,stamp++)).toISOString();
 async function mount(context:BrowserContext,who:string){
  const user=users.find(u=>u.id===who)!;
  await context.addInitScript(()=>{localStorage.setItem('last-night-settings',JSON.stringify({quality:'low',shadows:false,master:0}));});
  await context.route('https://*.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method(),data=req.postDataJSON?.()??null;
   requests.push({path,method,user:who});
   const send=(body:any,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(fail&&path.startsWith('/rest/'))return send({message:'Simulated offline'},503);
   const authUser={id:user.id,email:user.email,aud:'authenticated',role:'authenticated',created_at:timestamp(),app_metadata:{provider:'email'},user_metadata:{username:user.username}};
   if(path==='/auth/v1/token')return send({access_token:`mock-access-${who}`,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,user:authUser});
   if(path==='/auth/v1/user')return send(authUser);
   if(path==='/auth/v1/logout')return route.fulfill({status:204});
   if(path==='/auth/v1/signup')return send({id:user.id,identities:[],email:user.email});
   if(path==='/auth/v1/recover')return send({});
   if(path==='/rest/v1/rpc/accept_world_invite'){
    const inv=invites.get(data.code);if(!inv)return send({code:'22023'},400);if(!members.has(who)){members.add(who);inviteUses++;}return send(createdWorldId);
   }
   if(path==='/rest/v1/profiles'){const id=url.searchParams.get('id');return send(id?.startsWith('eq.')?{...users.find(u=>u.id===id.slice(3)),display_name:null,avatar_url:null,created_at:timestamp(),updated_at:timestamp()}:users);}
   if(path==='/rest/v1/world_members')return send(method==='POST'?(members.add(data.user_id),[]):[...members].filter(id=>!url.searchParams.get('user_id')||url.searchParams.get('user_id')===`eq.${id}`).map(id=>({world_id:createdWorldId,user_id:id,role:id===owner?'owner':'member',joined_at:timestamp(),last_played_at:null})).reduce((v:any,row:any)=>url.searchParams.has('user_id')?row:[...v,row],[]));
   if(path==='/rest/v1/world_invites'){invites.set(data.invite_code,data);return send(null,201);}
   const single=req.headers().accept?.includes('vnd.pgrst.object');
   const result=(rows:any[])=>send(single?rows[0]??null:rows);
   if(path==='/rest/v1/worlds'){
    if(method==='POST'){
     // Real schema: SELECT requires the member created by an AFTER INSERT trigger.
     if(req.headers().prefer?.includes('return=representation'))return send({code:'42501',message:'new row violates row-level security policy for table "worlds"'},403);
     createdWorldId=data.id;world={...data,seed:savedWorldSeed,id:createdWorldId,current_day:1,game_time:8,is_active:true,created_at:timestamp(),updated_at:timestamp()};state={world_id:createdWorldId,state:{},revision:0,updated_at:timestamp()};return route.fulfill({status:201,body:''});
    }
    if(!members.has(who))return result([]);
    if(method==='PATCH'){if(who!==owner)return result([]);Object.assign(world,data,{updated_at:timestamp()});return result([{id:createdWorldId}]);}
    if(method==='DELETE'){world=null;state=null;saves.clear();return result([{id:createdWorldId}]);}
    return result(world&&(!url.searchParams.has('id')||url.searchParams.get('id')===`eq.${createdWorldId}`)?[world]:[]);
   }
   if(path==='/rest/v1/world_state'){
    if(!members.has(who))return result([]);if(method==='PATCH'){if(who!==owner||url.searchParams.get('revision')!==`eq.${state.revision}`)return result([]);Object.assign(state,data,{updated_at:timestamp()});return result([{revision:state.revision}]);}return result(state?[state]:[]);
   }
   if(path==='/rest/v1/player_saves'){
    if(!members.has(who))return result([]);const id=(url.searchParams.get('user_id')??`eq.${data?.user_id??who}`).slice(3),old=saves.get(id);
    if(method==='GET')return result(old?[old]:[]);
    if(data.user_id!==who)return send({code:'42501'},403);
    if(method==='POST'&&old)return send({code:'23505'},409);
    if(method==='PATCH'&&url.searchParams.get('updated_at')!==`eq.${old?.updated_at}`)return result([]);
    const row={...data,updated_at:timestamp()};saves.set(who,row);return result([{updated_at:row.updated_at}]);
   }
   return send({unexpected:path},404);
  });
 }
 return {mount,saves,requests,members,get state(){return state;},get world(){return world;},get uses(){return inviteUses;},fail(value:boolean){fail=value;},externalRevision(){state.revision++;}};
}
async function login(p:Page,who='owner'){
 await p.goto('/?test&cloud',{waitUntil:'domcontentloaded'});await expect(p.locator('#account-email')).toBeVisible({timeout:90000});await p.locator('#account-email').fill(`${who}@example.test`);await p.locator('#account-password').fill('fake-test-password');await p.getByRole('button',{name:'Entrar',exact:true}).click();await expect(p.locator('#account-title')).toHaveText('Meus mundos');
}
async function create(p:Page){
 await expect(p.locator('#account-panel').getByRole('button',{name:/Criar mundo/})).toHaveCount(0);
 await p.getByRole('button',{name:'Voltar',exact:true}).click();await p.locator('#start').click();await expect(p.locator('#account-title')).toHaveText('Nova expedição solo');await p.locator('#account-name').fill('Abrigo de teste');await p.getByRole('button',{name:'Criar mundo e jogar',exact:true}).click();await expect(p.locator('#account-panel')).toBeHidden();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});await expectSavedLayout(p);await pause(p);await p.locator('#pause-menu').click();await expect(p.locator('#menu')).toBeVisible();await p.locator('#worlds-open').click();await expect(p.getByRole('heading',{name:'Abrigo de teste'})).toBeVisible();
}
async function pause(p:Page){await p.evaluate(()=>{if(document.pointerLockElement)document.exitPointerLock();});if(!(await read(p)).paused){await p.locator('#pause').click();}await expect(p.locator('#pause-screen')).toBeVisible();}

test('mock Supabase: signup confirmation, recovery, session refresh and logout preserve guest menu',async({browser})=>{
 const db=backend(),context=await browser.newContext({viewport:{width:1366,height:768}});await db.mount(context,owner);const p=await context.newPage();
 try{
  await p.goto('/?test&cloud');await expect(p.locator('#account-email')).toBeVisible({timeout:90000});await p.getByRole('button',{name:'Criar conta',exact:true}).click();await p.locator('#account-username').fill('Owner_test');await p.locator('#account-email').fill('owner@example.test');await p.locator('#account-password').fill('fake-test-password');await p.locator('#account-confirmation').fill('different-password');await p.getByRole('button',{name:'Criar conta',exact:true}).click();await expect(p.locator('.account-message')).toContainText('não coincidem');expect(db.requests.some(r=>r.path.endsWith('/signup'))).toBe(false);await expect(p.locator('#account-password')).toHaveValue('');
  await p.locator('#account-password').fill('fake-test-password');await p.locator('#account-confirmation').fill('fake-test-password');await p.getByRole('button',{name:'Criar conta',exact:true}).click();await expect(p.locator('.account-message')).toContainText('Confira seu e-mail');await p.getByRole('button',{name:'Esqueci minha senha'}).click();await p.locator('#account-email').fill('owner@example.test');await p.getByRole('button',{name:'Enviar link de recuperação'}).click();await expect(p.locator('.account-message')).toContainText('link de recuperação');
  await login(p);await p.getByRole('button',{name:'Voltar',exact:true}).click();await expect(p.locator('#account-open')).toContainText('Owner_test');await p.reload();await expect(p.locator('#start')).toBeEnabled({timeout:90000});await expect(p.locator('#account-open')).toContainText('Owner_test');await expect(p.locator('#account-panel')).toBeHidden();await p.locator('#account-open').click();await p.getByRole('button',{name:'Sair da conta'}).click();await expect(p.locator('#account-email')).toBeVisible();await p.getByRole('button',{name:'Jogar sem conta'}).click();await expect(p.locator('#start')).toBeVisible();await expect(p.locator('#coop-online')).toBeVisible();
  await mkdir('test-results/supabase',{recursive:true});await p.screenshot({path:'test-results/supabase/menu-preserved.png'});
 }finally{await context.close();}
});

test('mock Supabase: login, world save/reload, offline retention and revision conflict',async({browser})=>{
 const db=backend(),context=await browser.newContext({viewport:{width:1280,height:800}});await db.mount(context,owner);const p=await context.newPage();const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await login(p);await create(p);await p.getByRole('button',{name:'Continuar',exact:true}).click();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});await expect(p.locator('#cloud-status')).toBeVisible();
  const originalLayout=await expectSavedLayout(p);
  await p.evaluate(()=>{const g=(window as any).__LAST_NIGHT__;g.setPlayer(1,12);});await pause(p);await p.locator('#cloud-save').click();await expect(p.locator('#cloud-status')).toContainText('Mundo e sobrevivente salvos');expect(db.state.revision).toBeGreaterThan(0);expect(db.saves.get(owner).position.z).toBe(12);
  await mkdir('test-results/supabase',{recursive:true});await p.screenshot({path:'test-results/supabase/saved-pause.png'});
  await p.locator('#pause-menu').click();await expect(p.locator('#menu')).toBeVisible();await p.locator('#worlds-open').click();await p.getByRole('button',{name:'Continuar',exact:true}).click();await expect(p.locator('#account-panel')).toBeHidden();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});await expect.poll(async()=>(await read(p)).player.z).toBe(12);
  expect(await expectSavedLayout(p)).toEqual(originalLayout);
  await pause(p);db.fail(true);await p.locator('#cloud-save').click();await expect(p.locator('#cloud-status')).toHaveAttribute('data-kind','error');await p.locator('#pause-menu').click();await expect(p.locator('#account-title')).toHaveText('Progresso ainda não salvo');expect((await read(p)).player.z).toBe(12);await p.screenshot({path:'test-results/supabase/offline-retained.png'});
  db.fail(false);await p.getByRole('button',{name:'Tentar salvar novamente'}).click();await expect(p.locator('#menu')).toBeVisible();await p.locator('#worlds-open').click();await p.getByRole('button',{name:'Continuar',exact:true}).click();await expect(p.locator('#account-panel')).toBeHidden();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});await pause(p);db.externalRevision();const revision=db.state.revision;await p.locator('#cloud-save').click();await expect(p.locator('#cloud-status')).toHaveAttribute('data-kind','conflict');expect(db.state.revision).toBe(revision);expect(errors).toEqual([]);
 }finally{await context.close();}
});

test('mock Supabase: invite RPC and two accounts over real Photon preserve personal saves',async({browser})=>{
 const db=backend(),aContext=await browser.newContext({viewport:{width:960,height:640}}),bContext=await browser.newContext({viewport:{width:960,height:640}});await db.mount(aContext,owner);await db.mount(bContext,member);const a=await aContext.newPage(),b=await bContext.newPage();const errors:string[]=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
 try{
  await login(a);await create(a);await a.getByRole('button',{name:'Detalhes',exact:true}).click();await a.getByRole('button',{name:'Gerar convite',exact:false}).click();const link=await a.locator('.account-body p').filter({hasText:'worldInvite='}).innerText();
  await login(b,'member');await b.getByRole('button',{name:'Resgatar convite'}).click();await b.locator('#account-code').fill(link);await b.getByRole('button',{name:'Aceitar convite',exact:true}).click();await expect(b.getByRole('heading',{name:'Abrigo de teste'})).toBeVisible();expect(db.uses).toBe(1);
  await a.getByRole('button',{name:'Voltar aos mundos'}).click();await a.getByRole('button',{name:'Hospedar coop'}).click();await expect(a.locator('#coop-create')).toBeEnabled({timeout:60000});await a.locator('#coop-create').click();await expect(a.locator('#coop-lobby')).toBeVisible();const code=await a.locator('#coop-room-code').innerText();
  await b.getByRole('button',{name:'Voltar',exact:true}).click();await b.locator('#coop-online').click();await expect(b.locator('#coop-join')).toBeEnabled({timeout:60000});await b.locator('#coop-code-input').fill(code);await b.locator('#coop-join').click();await expect(b.locator('#coop-lobby')).toBeVisible();await b.locator('#coop-ready').click();await expect(a.locator('#coop-start')).toBeEnabled();await a.locator('#coop-start').click();
  for(const p of [a,b])await expect.poll(async()=>(await read(p)).network.state,{timeout:90000}).toBe('playing');
  for(const p of [a,b])await expect.poll(async()=>(await read(p)).coop?.players?.length).toBe(2);
  expect(await expectSavedLayout(a)).toEqual(await expectSavedLayout(b));
  const bActor=(await read(b)).coop.actor;await a.evaluate(actor=>{const w=(window as any).__LAST_NIGHT__.coopFixture();w.sim.zombies=[];w.actors.get(actor).sim.inventory.items.scrap=9;w.actors.get(actor).sim.player.hp=82;},bActor);
  await expect.poll(async()=>(await read(b)).inventory.scrap).toBe(9);await pause(b);await b.locator('#cloud-save').click();await expect(b.locator('#cloud-status')).toContainText('Sobrevivente salvo');await pause(a);await a.locator('#cloud-save').click();await expect(a.locator('#cloud-status')).toContainText('Mundo e sobrevivente salvos');expect(db.saves.get(member).inventory.scrap).toBe(9);expect(db.saves.get(member).health).toBe(82);expect(db.saves.get(owner).inventory.scrap).not.toBe(9);expect(db.state.state.checkpoint.players).toEqual([]);expect(db.requests.some(r=>r.path.endsWith('rpc/accept_world_invite'))).toBe(true);expect(errors).toEqual([]);
  await a.screenshot({path:'test-results/supabase/coop-owner.png'});await b.screenshot({path:'test-results/supabase/coop-member.png'});
 }finally{await aContext.close();await bContext.close();}
});

test('mock Supabase: a legacy world keeps its original parcels when reopened and saved',async({browser})=>{
 const db=backend(),context=await browser.newContext({viewport:{width:1280,height:800}});await db.mount(context,owner);const p=await context.newPage();
 try{
  await login(p);const original=await layout(p);await create(p);
  // An authentic previous-format snapshot has no layoutVersion. Its doors and
  // containers retain the original authored coordinates, with the same run seed.
  db.state.state=await p.evaluate(async seed=>{
   const [{configureWorld},{Simulation},{serializeWorld}]=await Promise.all([import('/src/game/world-layout.ts'),import('/src/game/simulation.ts'),import('/src/services/save-codec.ts')]);
   configureWorld(seed,0);const value=serializeWorld(new Simulation(undefined,seed));delete value.checkpoint.survival.layoutVersion;return value;
  },savedWorldSeed);
  await p.getByRole('button',{name:'Continuar',exact:true}).click();await expect(p.locator('#account-panel')).toBeHidden();await expect(p.locator('#loading-screen')).toBeHidden({timeout:90000});
  const restored=await expectSavedLayout(p,0);expect(restored.sites).toEqual(original.sites);expect(restored.buildings).toEqual(original.buildings);expect(restored.portals).toEqual(original.portals);
  await pause(p);await p.locator('#pause-menu').click();await expect(p.locator('#menu')).toBeVisible();expect(db.state.state.checkpoint.survival.layoutVersion).toBe(0);expect(db.state.state.runSeed).toBe(savedWorldSeed);
 }finally{await context.close();}
});

test('mock Supabase: persistent solo opens real WebRTC LAN and keeps saves after host migration',async({browser})=>{
 const db=backend();db.members.add(member);const contexts=await Promise.all([browser.newContext({viewport:{width:960,height:640}}),browser.newContext({viewport:{width:960,height:640}})]);
 await db.mount(contexts[0],owner);await db.mount(contexts[1],member);const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));const errors:string[]=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
 try{
  await login(a);await create(a);await a.getByRole('button',{name:'Continuar',exact:true}).click();await expect(a.locator('#account-panel')).toBeHidden();await expect(a.locator('#loading-screen')).toBeHidden({timeout:90000});await pause(a);
  const originalLayout=await expectSavedLayout(a);
  await a.locator('#pause-lan').click();await expect.poll(async()=>(await read(a)).network.state,{timeout:60000}).toBe('playing');const code=await a.locator('#pause-lan-code').inputValue();
  await login(b,'member');await b.getByRole('button',{name:'Voltar',exact:true}).click();await b.locator('#coop-online').click();await b.locator('#coop-transport').selectOption('lan');await expect(b.locator('#coop-join')).toBeEnabled({timeout:60000});await b.locator('#coop-code-input').fill(code);await b.locator('#coop-join').click();await expect.poll(async()=>(await read(b)).network.state,{timeout:90000}).toBe('playing');await expect.poll(async()=>(await read(a)).coop.players.length).toBe(2);
  expect(await expectSavedLayout(a)).toEqual(originalLayout);expect(await expectSavedLayout(b)).toEqual(originalLayout);
  const actor=(await read(b)).coop.actor;await a.evaluate(actor=>{const w=(window as any).__LAST_NIGHT__.coopFixture();w.sim.zombies=[];w.sim.baseHP=733;w.actors.get(actor).sim.inventory.items.scrap=11;},actor);await expect.poll(async()=>(await read(b)).inventory.scrap).toBe(11);
  await a.locator('#pause-menu').click();await expect(a.locator('#menu')).toBeVisible();await expect.poll(async()=>(await read(b)).coop.migrations).toBe(1);expect((await read(b)).baseHP).toBe(733);const revision=db.state.revision;await pause(b);await b.locator('#cloud-save').click();await expect(b.locator('#cloud-status')).toContainText('Sobrevivente salvo');expect(db.state.revision).toBe(revision);expect(db.saves.get(member).inventory.scrap).toBe(11);expect(errors).toEqual([]);await b.screenshot({path:'test-results/supabase/lan-migration.png'});
  expect(await expectSavedLayout(b)).toEqual(originalLayout);
 }finally{for(const c of contexts)await c.close();}
});

test('mock Supabase: new Photon world is created from Create room and autosaved on exit',async({browser})=>{
 const db=backend(),context=await browser.newContext({viewport:{width:1280,height:800}});await db.mount(context,owner);const p=await context.newPage();
 try{
  await login(p);await expect(p.locator('#account-panel').getByRole('button',{name:/Criar mundo/})).toHaveCount(0);await p.getByRole('button',{name:'Voltar',exact:true}).click();await p.locator('#coop-online').click();await expect(p.locator('#coop-create')).toBeEnabled({timeout:60000});await p.locator('#coop-create').click();await expect(p.locator('#account-title')).toHaveText('Novo mundo cooperativo');expect(db.world).toBe(null);
  await p.locator('#account-name').fill('Primeira noite coop');await p.getByRole('button',{name:'Criar mundo e sala'}).click();await expect(p.locator('#coop-lobby')).toBeVisible();expect(db.world.name).toBe('Primeira noite coop');await p.locator('#coop-start').click();await expect.poll(async()=>(await read(p)).network.state,{timeout:90000}).toBe('playing');await pause(p);await p.locator('#pause-menu').click();await expect(p.locator('#menu')).toBeVisible();expect(db.state.revision).toBeGreaterThan(0);expect(db.saves.has(owner)).toBe(true);await p.locator('#worlds-open').click();await expect(p.getByRole('heading',{name:'Primeira noite coop'})).toBeVisible();await expect(p.locator('#account-panel').getByRole('button',{name:/Criar mundo/})).toHaveCount(0);
  await p.screenshot({path:'test-results/supabase/worlds-after-coop-exit.png'});
 }finally{await context.close();}
});
