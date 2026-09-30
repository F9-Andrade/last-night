import {COOP,GameplayEvent} from './gameplay-protocol.ts';
/** Photon JSON transport closes the connection for messages above 50,000 bytes.
 * 6,000 UTF-16 units remain below that even with JSON escaping and SDK envelopes. */
export const FRAGMENT_EVENT=16,FRAGMENT_SIZE=6000;
export interface Fragment {id:number;code:number;index:number;total:number;text:string}
export function splitMessage(code:number,data:unknown,id:number):Fragment[]|null {
 const text=JSON.stringify(data);if(!text||text.length>COOP.maxPayload)return null;
 const total=Math.ceil(text.length/FRAGMENT_SIZE);return Array.from({length:total},(_,index)=>({id,code,index,total,text:text.slice(index*FRAGMENT_SIZE,(index+1)*FRAGMENT_SIZE)}));
}
export class MessageAssembler {
 private pending=new Map<string,{at:number;code:number;total:number;size:number;pieces:Map<number,string>}>();
 clear(){this.pending.clear();}
 get size(){return this.pending.size;}
 receive(actor:number,value:unknown,now:number):{code:number;data:unknown}|null {
  for(const [key,p] of this.pending)if(now-p.at>10000)this.pending.delete(key);
  if(!value||typeof value!=='object')return null;const f=value as Fragment;
  if(!Number.isSafeInteger(f.id)||f.id<1||!Object.values(GameplayEvent).includes(f.code as 10)||!Number.isInteger(f.total)||f.total<1||f.total>Math.ceil(COOP.maxPayload/FRAGMENT_SIZE)||!Number.isInteger(f.index)||f.index<0||f.index>=f.total||typeof f.text!=='string'||f.text.length>FRAGMENT_SIZE)return null;
  const key=`${actor}:${f.id}`;let p=this.pending.get(key);
  if(!p){if(this.pending.size>=8)return null;p={at:now,code:f.code,total:f.total,size:0,pieces:new Map()};this.pending.set(key,p);}
  if(p.total!==f.total||p.code!==f.code){this.pending.delete(key);return null;}
  const previous=p.pieces.get(f.index);if(previous!==undefined){if(previous!==f.text)this.pending.delete(key);return null;}
  p.size+=f.text.length;if(p.size>COOP.maxPayload){this.pending.delete(key);return null;}p.pieces.set(f.index,f.text);
  if(p.pieces.size!==p.total)return null;this.pending.delete(key);
  try{return {code:p.code,data:JSON.parse(Array.from({length:p.total},(_,i)=>p!.pieces.get(i)!).join(''))};}catch{return null;}
 }
}
