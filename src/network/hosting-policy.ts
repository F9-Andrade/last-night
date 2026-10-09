export interface HostingPermission {token:string;revision:number;allowed:number[]}
/** Room-local authority: only the original owner may authorize continuation. */
export class HostingPolicy {
 readonly owner:number;readonly token:string;
 private revision=0;private allowed=new Set<number>();
 constructor(owner:number,token:string){this.owner=owner;this.token=token;}
 replaceVerified(actors:readonly number[]){this.allowed=new Set(actors.filter(actor=>Number.isSafeInteger(actor)&&actor>0&&actor!==this.owner));}
 permits(actor:number){return actor===this.owner||this.allowed.has(actor);}
 change(sender:number,actor:number,allow:boolean):HostingPermission|null {
  if(sender!==this.owner||!Number.isSafeInteger(actor)||actor<1||actor===this.owner)return null;
  if(allow)this.allowed.add(actor);else this.allowed.delete(actor);
  this.revision++;return this.snapshot();
 }
 accept(sender:number,value:unknown):boolean {
  if(sender!==this.owner||!value||typeof value!=='object')return false;
  const p=value as Partial<HostingPermission>;
  if(p.token!==this.token||!Number.isSafeInteger(p.revision)||p.revision!<=this.revision||!Array.isArray(p.allowed)||p.allowed.length>3||p.allowed.some(a=>!Number.isSafeInteger(a)||a<1||a===this.owner)||new Set(p.allowed).size!==p.allowed.length)return false;
  this.revision=p.revision!;this.allowed=new Set(p.allowed);return true;
 }
 snapshot():HostingPermission{return {token:this.token,revision:this.revision,allowed:[...this.allowed].sort((a,b)=>a-b)};}
 decision(local:number,master:number,members:readonly number[]):'play'|'wait'|'close' {
  if(members.includes(this.owner))return master===this.owner?'play':'wait';
  if(!this.permits(local))return 'close';
  return this.permits(master)&&members.includes(master)?'play':'wait';
 }
}
