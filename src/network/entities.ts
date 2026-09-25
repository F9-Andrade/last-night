export type EntityKind='infected'|'container'|'weapon'|'door'|'player';
export type NetworkEntityId=`${EntityKind}:${string}`;
export function entityId(kind:EntityKind,id:string|number):NetworkEntityId {
 const value=String(id);if(!/^[a-zA-Z0-9_-]{1,80}$/.test(value))throw new Error('Invalid entity identity');return `${kind}:${value}`;
}
export function validEntityId(value:unknown):value is NetworkEntityId{return typeof value==='string'&&/^(infected|container|weapon|door|player):[a-zA-Z0-9_-]{1,80}$/.test(value);}
export class NetworkEntityRegistry<T> {
 private entries=new Map<NetworkEntityId,T>();
 get size(){return this.entries.size;}
 register(id:NetworkEntityId,entity:T){if(this.entries.has(id))throw new Error(`Duplicate entity ${id}`);this.entries.set(id,entity);}
 get(id:NetworkEntityId){return this.entries.get(id);}
 remove(id:NetworkEntityId){return this.entries.delete(id);}
 clear(){this.entries.clear();}
}
