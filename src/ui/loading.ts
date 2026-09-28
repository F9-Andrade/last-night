/** One opaque loading surface shared by boot, solo and Photon sessions. */
export class LoadingScreen {
  private screen=document.getElementById('loading-screen')!;
  private status=document.getElementById('loading-status')!;
  private progress=document.getElementById('loading-progress') as HTMLProgressElement;
  show(message='Preparando Santa Luz…'):void {
    this.screen.hidden=false;this.screen.setAttribute('aria-busy','true');
    document.getElementById('app')!.inert=true;
    this.update(message,0);
  }
  update(message:string,completed:number):void {this.status.textContent=message;this.progress.value=completed;}
  hide():void {this.screen.hidden=true;this.screen.setAttribute('aria-busy','false');document.getElementById('app')!.inert=false;}
}

// Two callbacks let the browser paint the loading surface before expensive work.
export const paintLoading=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
