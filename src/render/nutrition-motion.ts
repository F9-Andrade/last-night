/** Pure, bounded animation curves. Frame-rate independent and never affect aiming rays. */
export function smoothStage(progress:number,start:number,end:number):number {
 const t=Math.max(0,Math.min(1,(progress-start)/(end-start)));return t*t*(3-2*t);
}
export interface ConsumptionMotion {show:number;open:number;lift:number;scoop:number;bite:number;settle:number;}
export function consumptionMotion(progress:number,drink:boolean,packet:boolean,out:ConsumptionMotion):ConsumptionMotion {
 const p=Math.max(0,Math.min(1,progress));
 out.show=smoothStage(p,0,.13)*(1-smoothStage(p,.87,1));
 out.open=smoothStage(p,.16,.32);
 out.lift=drink?smoothStage(p,.34,.51)*(1-smoothStage(p,.75,.87)):packet?smoothStage(p,.39,.55)*(1-smoothStage(p,.70,.85)):0;
 out.scoop=!drink&&!packet?smoothStage(p,.33,.44)*(1-smoothStage(p,.47,.57)):0;
 out.bite=!drink&&!packet?smoothStage(p,.49,.61)*(1-smoothStage(p,.73,.85)):0;
 out.settle=smoothStage(p,.79,.96);return out;
}
