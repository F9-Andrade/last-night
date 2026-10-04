import type { InputCommand } from './simulation';
import { MouseLook, relativeMovement, lookDirection } from './first-person';
export class Input {
  onPrimary:()=>boolean=()=>false; onSecondary:()=>boolean=()=>false; onCancel:()=>boolean=()=>false;
  onBuildSlot:(slot:number)=>boolean=()=>false;onBuildWheel:(delta:number)=>boolean=()=>false;onHammer:()=>boolean=()=>false;
  onInteract:()=>boolean=()=>false;onManage:()=>boolean=()=>false;onRotate:()=>boolean=()=>false;onLevel:(delta:number)=>boolean=()=>false;
  look=new MouseLook(); keys=new Set<string>(); mouse={x:innerWidth/2,y:innerHeight/2}; fire=false; ads=false;
  enabled=false; blocked=true; loading=false; private shotRequested=false;private reload=false;private interact=false;private heal=false;private dismantle=false;private slot?:0|1|2|3;
  private expectedUnlock=false; private lockPending=false;private captureAfterUnlock=false;private wasCaptured=false;
  get captured():boolean{return document.pointerLockElement===this.canvas;}
  constructor(private canvas:HTMLCanvasElement,pause:()=>void,inventory:()=>void,private lostLock:()=>void){
    window.addEventListener('keydown',e=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;
      if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyR','KeyE','Escape','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','KeyB','PageUp','PageDown','Tab','KeyH','KeyX','KeyC','ControlLeft','Space'].includes(e.code))e.preventDefault();
      if(e.code==='Escape'&&!e.repeat){if(this.onCancel())return;this.release();pause();return;}
      if(!this.enabled)return;
      if(e.code==='Tab'&&!e.repeat){inventory();return;}
      if(this.blocked||!this.captured)return;
      if((e.code==='KeyB'||e.code==='Digit0')&&!e.repeat&&this.onHammer()){e.preventDefault();return;}
      if(/^Digit[1-9]$/.test(e.code)&&this.onBuildSlot(Number(e.code.slice(-1))-1)){e.preventDefault();return;}
      if(e.code==='KeyE'&&!e.repeat&&this.onInteract()){e.preventDefault();return;}
      if(e.code==='KeyG'&&!e.repeat&&this.onManage()){e.preventDefault();return;}
      if(e.code==='KeyR'&&!e.repeat&&this.onRotate()){e.preventDefault();return;}
      if((e.code==='PageUp'||e.code==='PageDown')&&this.onLevel(e.code==='PageUp'?1:-1)){e.preventDefault();return;}
      if(e.code==='KeyH'&&!e.repeat)this.heal=true;
      if(e.code==='KeyX'&&!e.repeat)this.dismantle=true;
      if(e.code==='KeyR'&&!e.repeat)this.reload=true;
      if(e.code==='KeyE'&&!e.repeat)this.interact=true;
      if(e.code==='Digit1')this.slot=0;if(e.code==='Digit2')this.slot=1;if(e.code==='Digit3')this.slot=2;if(e.code==='Digit4')this.slot=3;
      // The most recently pressed intent wins; holding both never flips states every tick.
      if(e.code.startsWith('Shift')&&!e.repeat)this.ads=false;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('mousemove',e=>{if(this.captured&&!this.lockPending&&this.enabled&&!this.blocked)this.look.move(e.movementX,e.movementY);});
    // Mouse events report every button transition; pointerdown only reports the first
    // pressed button. Listening to pointerdown alone drops LMB while RMB is held.
    const down=(e:MouseEvent)=>{if(!this.enabled||this.blocked)return;if(!this.captured){this.capture();return;}if(e.button===0&&!this.onPrimary()){this.fire=true;this.shotRequested=true;}if(e.button===2&&!this.onSecondary())this.ads=true;};
    const up=(e:MouseEvent)=>{if(e.button===0)this.fire=false;if(e.button===2)this.ads=false;};
    canvas.addEventListener('mousedown',down);window.addEventListener('mouseup',up);
    // Keep synthetic pointer events available to the existing test harness, without
    // handling a native mouse press twice.
    canvas.addEventListener('pointerdown',e=>{if(!e.isTrusted)down(e);});
    window.addEventListener('pointerup',e=>{if(!e.isTrusted)up(e);});
    canvas.addEventListener('wheel',e=>{if(this.captured&&!this.blocked){e.preventDefault();if(!this.onBuildWheel(e.deltaY>0?1:-1)&&!this.onLevel(e.deltaY<0?1:-1))this.slot=e.deltaY>0?1:0;}},{passive:false});
    window.addEventListener('blur',()=>this.clear());canvas.addEventListener('contextmenu',e=>e.preventDefault());
    document.addEventListener('pointerlockchange',()=>{
      this.lockPending=false;const locked=this.captured,changed=locked!==this.wasCaptured;this.wasCaptured=locked;
      if(!changed&&!this.expectedUnlock)return;
      document.querySelector('#app')?.classList.toggle('mouse-captured',locked);
      if(locked){if(!this.enabled||this.blocked&&!this.loading)this.release();return;}
      const expected=this.expectedUnlock;this.expectedUnlock=false;this.clear();
      if(this.captureAfterUnlock&&this.enabled&&!this.blocked){this.captureAfterUnlock=false;this.capture();}
      else if(!expected&&this.enabled&&!this.blocked)this.lostLock();
    });
    document.addEventListener('pointerlockerror',()=>{this.lockPending=false;document.querySelector('#app')?.classList.remove('mouse-captured');});
  }
  capture():void {if(!this.enabled||this.blocked&&!this.loading)return;if(this.expectedUnlock){this.captureAfterUnlock=true;return;}if(this.captured||this.lockPending)return;this.lockPending=true;try{const request=this.canvas.requestPointerLock();if(request)void request.catch(()=>{this.lockPending=false;});}catch{this.lockPending=false;}}
  release():void {this.clear();this.captureAfterUnlock=false;if(this.captured&&!this.expectedUnlock){this.expectedUnlock=true;document.exitPointerLock();}}
  clear():void {this.keys.clear();this.fire=false;this.ads=false;this.shotRequested=false;this.reload=false;this.interact=false;this.heal=false;this.dismantle=false;this.slot=undefined;}
  requestHeal():void {this.heal=true;}
  command():InputCommand {
    const inactive=!this.enabled||this.blocked||!this.captured;
    const movement=relativeMovement(this.look.yaw,Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')),Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS')));
    const dir=lookDirection(this.look.yaw,this.look.pitch);
    const cmd:InputCommand={moveX:inactive?0:movement.x,moveZ:inactive?0:movement.z,aimX:dir.x,aimZ:dir.z,yaw:this.look.yaw,pitch:this.look.pitch,
      fire:!inactive&&(this.fire||this.shotRequested),trigger:!inactive&&this.shotRequested,ads:!inactive&&this.ads,crouch:!inactive&&(this.keys.has('KeyC')||this.keys.has('ControlLeft')),
      run:!inactive&&!this.ads&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')),reload:!inactive&&this.reload,interact:!inactive&&this.interact,heldInteract:!inactive&&this.keys.has('KeyE'),heal:this.heal,dismantle:!inactive&&this.dismantle,slot:inactive?undefined:this.slot};
    this.shotRequested=false;this.reload=false;this.interact=false;this.heal=false;this.dismantle=false;this.slot=undefined;return cmd;
  }
}
