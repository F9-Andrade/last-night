import type {SupabaseClient} from '@supabase/supabase-js';
import {CloudError,cloudError,uuid} from './cloud-types.ts';
import type {WorldRow,PlayerSaveRow} from './cloud-types.ts';
import type {PlayerPayload,WorldPayload} from './save-codec.ts';
import {safeSaveJSON,validateWorldPayload} from './save-codec.ts';

export interface AccountBinding {userId:string;playerId:string;actor:number;token:string;nonce:string}
export class SaveService {
 revision:number;playerStamp:string|null;
 private client:SupabaseClient;readonly world:WorldRow;readonly userId:string;
 constructor(client:SupabaseClient,world:WorldRow,userId:string,revision:number,playerStamp:string|null){this.client=client;this.world=world;this.userId=userId;this.revision=revision;this.playerStamp=playerStamp;}
 private async identity(){const {data,error}=await this.client.auth.getSession();if(error||data.session?.user.id!==this.userId)throw new CloudError('access','A conta desta expedição não está conectada. Entre novamente antes de salvar.');}
 async player(payload:PlayerPayload):Promise<void>{
  await this.identity();if(payload.user_id!==this.userId||payload.world_id!==this.world.id||!safeSaveJSON(payload))throw new CloudError('invalid','Identidade do save inválida.');
  const query=this.playerStamp===null?this.client.from('player_saves').insert(payload):this.client.from('player_saves').update(payload).eq('world_id',this.world.id).eq('user_id',this.userId).eq('updated_at',this.playerStamp);
  const {data,error}=await query.select('updated_at').maybeSingle();
  if(error){if(error.code==='23505')throw new CloudError('conflict','Outra sessão já criou este save. Reabra o mundo antes de salvar.');throw cloudError(error);}
  if(!data)throw new CloudError('conflict','Seu save mudou em outra sessão ou seu acesso foi removido. O progresso local foi preservado.');
  this.playerStamp=data.updated_at;
 }
 async shared(payload:WorldPayload):Promise<void>{
  await this.identity();if(this.userId!==this.world.owner_id)throw new CloudError('access','Somente o dono pode salvar o mundo compartilhado.');validateWorldPayload(payload);
  const {data,error}=await this.client.from('world_state').update({state:payload,revision:this.revision+1}).eq('world_id',this.world.id).eq('revision',this.revision).select('revision').maybeSingle();
  if(error)throw cloudError(error);if(!data)throw new CloudError('conflict','O mundo mudou em outra sessão ou seu acesso foi removido. Nenhum estado remoto foi sobrescrito.');
  this.revision=data.revision;
  const survival=payload.checkpoint.survival;
  const updated=await this.client.from('worlds').update({current_day:survival.day,game_time:survival.elapsed}).eq('id',this.world.id).eq('owner_id',this.userId).select('id');
  if(updated.error)throw cloudError(updated.error);if(updated.data?.length!==1)throw new CloudError('access','O resumo do mundo não pôde ser atualizado.');
 }
 async verifiedPlayer(binding:AccountBinding):Promise<PlayerSaveRow>{
  if(!Number.isSafeInteger(binding.actor)||binding.actor<1||!uuid(binding.userId)||typeof binding.nonce!=='string'||!/^[a-f0-9]{48}$/.test(binding.nonce)||typeof binding.playerId!=='string'||binding.playerId.length>160||typeof binding.token!=='string'||binding.token.length>40)throw new CloudError('invalid','Identidade cooperativa inválida.');
  const {data,error}=await this.client.from('player_saves').select('*').eq('world_id',this.world.id).eq('user_id',binding.userId).maybeSingle();if(error)throw cloudError(error);
  const stored=data?.extra_data?.accountBinding;
  if(!stored||stored.actor!==binding.actor||stored.userId!==binding.userId||stored.playerId!==binding.playerId||stored.token!==binding.token||stored.nonce!==binding.nonce)throw new CloudError('access','A conta não comprovou esta conexão de jogo.');
  const membership=await this.client.from('world_members').select('user_id').eq('world_id',this.world.id).eq('user_id',binding.userId).maybeSingle();
  if(membership.error)throw cloudError(membership.error);if(!membership.data)throw new CloudError('access','Esta conta não é membro deste mundo.');
  return data as PlayerSaveRow;
 }
}
