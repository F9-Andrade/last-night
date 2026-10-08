/** Separate local backup; existing settings/name/local saves are never touched. */
export interface RecoveryEntry {key:string;userId:string;worldId:string;createdAt:string;player:unknown;world:unknown;revision:number;playerStamp:string|null}
let database:Promise<IDBDatabase>|undefined;
function db():Promise<IDBDatabase>{return database??=new Promise((resolve,reject)=>{
 const open=indexedDB.open('last-night-cloud-recovery',1);
 open.onupgradeneeded=()=>open.result.createObjectStore('pending',{keyPath:'key'});
 open.onblocked=()=>{database=undefined;reject(new Error('Armazenamento local ocupado.'));};
 open.onsuccess=()=>resolve(open.result);open.onerror=()=>{database=undefined;reject(open.error);};
});}
export async function putRecovery(entry:RecoveryEntry):Promise<void>{const d=await db();await new Promise<void>((resolve,reject)=>{const t=d.transaction('pending','readwrite');t.objectStore('pending').put(entry);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
export async function getRecovery(userId:string,worldId:string):Promise<RecoveryEntry|undefined>{const d=await db();return new Promise((resolve,reject)=>{const request=d.transaction('pending').objectStore('pending').get(`${userId}:${worldId}`);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function clearRecovery(key:string):Promise<void>{const d=await db();await new Promise<void>((resolve,reject)=>{const t=d.transaction('pending','readwrite');t.objectStore('pending').delete(key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}
