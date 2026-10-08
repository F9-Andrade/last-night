/** Exact column contract supplied by the owner: LAST NIGHT DATABASE V1. */
export type Difficulty='easy'|'normal'|'hard'|'nightmare';
export interface ProfileRow {id:string;username:string;display_name:string|null;avatar_url:string|null;created_at:string;updated_at:string}
export interface WorldRow {id:string;owner_id:string;name:string;seed:number;difficulty:Difficulty;current_day:number;game_time:number;schema_version:number;is_active:boolean;created_at:string;updated_at:string}
export interface MemberRow {world_id:string;user_id:string;role:'owner'|'member';joined_at:string;last_played_at:string|null}
export interface PlayerSaveRow {
 world_id:string;user_id:string;position:unknown;rotation:unknown;health:number;max_health:number;stamina:number;max_stamina:number;
 inventory:unknown;weapons:unknown;ammo:unknown;perks:unknown;stats:unknown;extra_data:unknown;updated_at:string;
}
export interface WorldStateRow {world_id:string;state:unknown;revision:number;updated_at:string}
export interface WorldInviteRow {id:string;world_id:string;created_by:string;invite_code:string;max_uses:number;uses:number;expires_at:string|null;created_at:string}
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export class CloudError extends Error {
 readonly kind:'network'|'access'|'conflict'|'invalid'|'missing'|'configuration';
 constructor(kind:CloudError['kind'],message:string){super(message);this.name='CloudError';this.kind=kind;}
}
export function cloudError(error:unknown):CloudError {
 if(error instanceof CloudError)return error;
 const e=error&&typeof error==='object'?error as {code?:string;status?:number;name?:string}:{};
 if(e.code==='42501'||e.code==='PGRST301'||e.code==='PGRST303'||e.status===401||e.status===403)return new CloudError('access','Sessão expirada ou acesso ao mundo negado. Entre novamente e confira sua participação.');
 if(e.code==='23505')return new CloudError('conflict','Esse registro já existe. Atualize a lista antes de tentar novamente.');
 if(e.code==='PGRST202')return new CloudError('configuration','O resgate de convites ainda não foi habilitado no banco. Peça ao dono para adicionar seu username.');
 if(e.code==='22023')return new CloudError('access','Convite inválido, expirado ou sem usos disponíveis.');
 return new CloudError('network','Não foi possível alcançar a nuvem. Seu progresso continua nesta partida; tente salvar novamente.');
}
