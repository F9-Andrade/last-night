import { BALANCE } from './config.ts';

export interface StaminaState { stamina:number; exhausted:boolean; staminaDelay:number; running:boolean }
/** Hysteresis keeps held Shift from retriggering sprint on each recovered fraction. */
export function updateStamina(state:StaminaState,dt:number,wantsSprint:boolean):void {
  const tuning=BALANCE.player;
  if(state.stamina<=0)state.exhausted=true;
  else if(state.exhausted&&state.stamina>=tuning.sprintRecovery)state.exhausted=false;
  state.running=wantsSprint&&!state.exhausted;
  if(state.running){
    state.stamina=Math.max(0,state.stamina-tuning.drain*dt);
    state.staminaDelay=tuning.recoveryDelay;
    if(state.stamina===0){state.exhausted=true;state.running=false;}
  }else{
    const recovering=Math.max(0,dt-state.staminaDelay);
    state.staminaDelay=Math.max(0,state.staminaDelay-dt);
    state.stamina=Math.min(tuning.stamina,state.stamina+recovering*tuning.recover);
    if(state.exhausted&&state.stamina>=tuning.sprintRecovery)state.exhausted=false;
  }
}
