import type {SupabaseClient} from '@supabase/supabase-js';
import {CloudError,cloudError,uuid} from './cloud-types.ts';
import type {ProfileRow,WorldRow,WorldStateRow,PlayerSaveRow,MemberRow} from './cloud-types.ts';
import {validUsername} from './auth-validation.ts';

export class WorldService {
 private client:SupabaseClient;
 constructor(client:SupabaseClient){this.client=client;}
 private async user(){const {data,error}=await this.client.auth.getUser();if(error||!data.user)throw new CloudError('access','Entre na sua conta para acessar os mundos.');return data.user.id;}
 async profile():Promise<ProfileRow>{const id=await this.user();const {data,error}=await this.client.from('profiles').select('*').eq('id',id).single();if(error)throw cloudError(error);if(!data||!validUsername(data.username))throw new CloudError('invalid','Perfil incompleto. Não foi possível carregar seu nome.');return data as ProfileRow;}
 async list():Promise<WorldRow[]>{
  await this.user();const {data,error}=await this.client.from('worlds').select('*').eq('is_active',true).order('updated_at',{ascending:false}).limit(100);
  if(error)throw cloudError(error);return (data??[]).map(validateWorld);
 }
 async create(name:string):Promise<WorldRow>{
  const owner_id=await this.user();name=name.trim();if(!name||name.length>40)throw new CloudError('invalid','Dê ao mundo um nome de 1 a 40 caracteres.');
  const id=crypto.randomUUID(),seed=crypto.getRandomValues(new Uint32Array(1))[0];
  // SELECT RLS requires membership, created by the AFTER INSERT trigger. Asking
  // for RETURNING here checks visibility before that membership is available.
  // Keep the insert minimal, then read the exact ID after its transaction commits.
  const inserted=await this.client.from('worlds').insert({id,owner_id,name,seed,difficulty:'normal',schema_version:1});
  if(inserted.error)throw cloudError(inserted.error);
  const {data,error}=await this.client.from('worlds').select('*').eq('id',id).single();
  if(error)throw cloudError(error);return validateWorld(data);
 }
 async load(id:string):Promise<{world:WorldRow;state:WorldStateRow;player:PlayerSaveRow|null;userId:string}>{
  if(!uuid(id))throw new CloudError('invalid','Identificador de mundo inválido.');const userId=await this.user();
  const [w,s,p]=await Promise.all([
   this.client.from('worlds').select('*').eq('id',id).eq('is_active',true).maybeSingle(),
   this.client.from('world_state').select('*').eq('world_id',id).maybeSingle(),
   this.client.from('player_saves').select('*').eq('world_id',id).eq('user_id',userId).maybeSingle(),
  ]);
  for(const r of [w,s,p])if(r.error)throw cloudError(r.error);
  if(!w.data||!s.data)throw new CloudError('missing','Mundo não encontrado ou sem permissão de acesso.');
  if(!Number.isSafeInteger(s.data.revision)||s.data.revision<0)throw new CloudError('invalid','A revisão do mundo é inválida.');
  return {world:validateWorld(w.data),state:s.data as WorldStateRow,player:p.data as PlayerSaveRow|null,userId};
 }
 async remove(world:WorldRow):Promise<void>{
  const id=await this.user();if(id!==world.owner_id)throw new CloudError('access','Somente o dono pode excluir este mundo.');
  const {data,error}=await this.client.from('worlds').delete().eq('id',world.id).eq('owner_id',id).select('id');if(error)throw cloudError(error);if(data?.length!==1)throw new CloudError('missing','O mundo não está mais disponível.');
 }
 async members(worldId:string):Promise<(MemberRow&{username:string})[]>{
  await this.user();const {data,error}=await this.client.from('world_members').select('*').eq('world_id',worldId);if(error)throw cloudError(error);
  const members=(data??[]) as MemberRow[];if(!members.length)return [];
  const profiles=await this.client.from('profiles').select('id,username').in('id',members.map(m=>m.user_id));if(profiles.error)throw cloudError(profiles.error);
  return members.map(m=>({...m,username:profiles.data?.find(p=>p.id===m.user_id)?.username??'Sobrevivente'}));
 }
 async addMember(world:WorldRow,username:string):Promise<void>{
  const owner=await this.user();if(owner!==world.owner_id)throw new CloudError('access','Somente o dono pode convidar jogadores.');
  username=username.trim();if(!validUsername(username))throw new CloudError('invalid','Informe um username válido.');
  // Equality after lowercasing is implemented by ilike; escape the only wildcard
  // allowed by username validation so underscores never match other accounts.
  const profile=await this.client.from('profiles').select('id,username').ilike('username',username.replace(/_/g,'\\_')).maybeSingle();
  if(profile.error)throw cloudError(profile.error);if(!profile.data)throw new CloudError('missing','Sobrevivente não encontrado. Confira o username.');
  const {error}=await this.client.from('world_members').insert({world_id:world.id,user_id:profile.data.id,role:'member'});if(error)throw cloudError(error);
 }
 async invite(world:WorldRow):Promise<string>{
  const owner=await this.user();if(owner!==world.owner_id)throw new CloudError('access','Somente o dono pode criar convites.');
  const token=Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');
  const {error}=await this.client.from('world_invites').insert({world_id:world.id,created_by:owner,invite_code:token,max_uses:3,expires_at:new Date(Date.now()+86400000).toISOString()});if(error)throw cloudError(error);return token;
 }
 async accept(token:string):Promise<string>{
  await this.user();token=token.trim();if(!token||token.length>256)throw new CloudError('invalid','Convite inválido.');
  const {data,error}=await this.client.rpc('accept_world_invite',{code:token});if(error)throw cloudError(error);if(!uuid(data))throw new CloudError('invalid','Resposta de convite inválida.');return data;
 }
}
function validateWorld(v:unknown):WorldRow {
 const w=v as WorldRow;if(!w||!uuid(w.id)||!uuid(w.owner_id)||typeof w.name!=='string'||!w.name.trim()||w.name.length>40||!Number.isInteger(w.seed)||w.seed<0||w.seed>4294967295||!['easy','normal','hard','nightmare'].includes(w.difficulty)||!Number.isInteger(w.current_day)||w.current_day<1||!Number.isFinite(w.game_time)||w.schema_version!==1)throw new CloudError('invalid','Este mundo tem dados inválidos ou foi criado em uma versão ainda não suportada.');return w;
}
