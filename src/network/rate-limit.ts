/** Allows delayed TCP batches while bounding sustained event abuse per actor. */
export class SnapshotBudget {
 private tokens=40;private last:number|null=null;
 take(now:number){
  if(this.last!==null)this.tokens=Math.min(40,this.tokens+Math.max(0,now-this.last)*.03);
  this.last=now;if(this.tokens<1)return false;this.tokens--;return true;
 }
}
