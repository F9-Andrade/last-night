import {NETWORK_BUILD} from './protocol';
/** Same-origin WebSocket transport; gameplay parsing remains in NetworkManager. */
export class LanTransport {
 actor=0;master=0;seed=0;private socket:WebSocket;private stopped=false;
 constructor(name:string,private receive:(message:any)=>void,private fail:(message:string)=>void){
  const url=new URL('/lan',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
  this.socket=new WebSocket(url);this.socket.onopen=()=>this.send({type:'hello',name,build:NETWORK_BUILD});
  this.socket.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='connected')this.actor=m.actor;if(m.type==='room'){this.master=m.master;this.seed=m.seed;}this.receive(m);}catch{this.fail('Resposta LAN inválida.');}};
  this.socket.onerror=()=>{if(!this.stopped)this.fail('Servidor LAN indisponível. Abra o endereço mostrado por npm run lan.');};
  this.socket.onclose=()=>{if(!this.stopped)this.fail('Conexão com o servidor LAN perdida.');};
 }
 send(message:unknown){if(this.socket.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));}
 event(code:number,data:unknown,target?:number){this.send({type:'event',code,data,target});}
 close(){this.stopped=true;this.socket.close();}
}
