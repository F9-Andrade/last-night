import type {SupabaseClient} from '@supabase/supabase-js';
import {CloudError,cloudError,uuid} from './cloud-types.ts';
import type {NetworkPlayerIdentity} from '../network/protocol.ts';

/** These RPCs are additive; missing migration means no delegated hosting. */
export class HostingService {
 private client:SupabaseClient;
 constructor(client:SupabaseClient){this.client=client;}
 async permissions(worldId:string):Promise<string[]|null>{
  const {data,error}=await this.client.rpc('get_world_host_permissions',{p_world_id:worldId}).abortSignal(AbortSignal.timeout(8000));
  if(error?.code==='PGRST202')return null;
  if(error)throw cloudError(error);
  if(!Array.isArray(data)||!data.every(row=>uuid(row.user_id)))throw new CloudError('invalid','Permissões do mundo inválidas.');
  return data.map(row=>row.user_id);
 }
 async set(worldId:string,userId:string,allowed:boolean){
  const {error}=await this.client.rpc('set_world_host_permission',{p_world_id:worldId,p_user_id:userId,p_allowed:allowed});
  if(error?.code==='PGRST202')throw new CloudError('configuration','A permissão para continuar e salvar ainda precisa ser habilitada no banco.');
  if(error)throw cloudError(error);
 }
 async actors(worldId:string,token:string,players:readonly NetworkPlayerIdentity[],allowed:readonly string[]):Promise<number[]>{
  if(!allowed.length)return [];
  const {data,error}=await this.client.from('player_saves').select('user_id,binding:extra_data->accountBinding').eq('world_id',worldId).in('user_id',[...allowed]).abortSignal(AbortSignal.timeout(8000));
  if(error)throw cloudError(error);
  // Each account writes only its own row under existing RLS. Match the room,
  // transport identity and actor; display names and network claims are not proof.
  return players.filter(peer=>(data??[]).some(row=>{
   const b=row.binding;
   if(!b||typeof b!=='object'||Array.isArray(b))return false;
   return allowed.includes(row.user_id)&&b?.userId===row.user_id&&b.token===token&&b.actor===peer.actorNumber&&b.playerId===peer.playerId;
  })).map(peer=>peer.actorNumber);
 }
}
