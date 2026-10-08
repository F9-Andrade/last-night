import {configureWorld} from '../game/world-layout';
import {getSupabaseClient} from './supabase-client';
import {AuthService} from './auth-service';
import {WorldService} from './world-service';
import {SaveService} from './save-service';
import {Autosave} from './autosave';
import {deserializePlayer,deserializeWorld,serializePlayer,serializeWorld,savedLayoutVersion} from './save-codec';
import {getRecovery} from './save-recovery';
import {CoopAccountBridge} from './coop-account';
import {AccountUI} from '../ui/account';
import {Simulation} from '../game/simulation';
import type {ProfileRow,WorldRow} from './cloud-types';
import type {PlayerRecord} from '../network/coop-world';
import type {NetworkManager} from '../network/manager';
import type {CoopSession} from '../network/coop-session';
import type {StartData} from '../network/protocol';
import type {SaveSource} from './autosave';

export interface CloudRun {sim:Simulation;service:SaveService;world:WorldRow;userId:string;record?:PlayerRecord}
interface Hooks {
 launch:(run:CloudRun)=>Promise<void>;lobby:()=>void;exit:()=>void;
 source:()=>Omit<SaveSource,'canSaveWorld'>;running:()=>boolean;pause:()=>void;
 name:(name?:string)=>void;authority:()=>boolean;
}
export class CloudController {
 readonly ui:AccountUI;private auth?:AuthService;private worlds?:WorldService;private profile?:ProfileRow;
 private active?:CloudRun;private autosave?:Autosave;private bridge?:CoopAccountBridge;private pending?:WorldRow;
 private accountId?:string;private entering=false;private lastDirty=0;private exiting?:Promise<boolean>;private configError='';
 private authWork=Promise.resolve();private acceptingInvite=false;
 constructor(root:HTMLElement,private network:NetworkManager,private hooks:Hooks){
  this.ui=new AccountUI(root);this.ui.onClose=()=>this.ui.close();this.ui.onAccount=()=>{hooks.pause();this.account();};this.ui.onWorlds=()=>{hooks.pause();void this.ui.busy(()=>this.list());};this.ui.onSave=()=>void this.save();
  try{const client=getSupabaseClient();if(client){const url=new URL(location.href);url.search='';url.hash='';this.auth=new AuthService(client,url.href);this.worlds=new WorldService(client);}}
  catch(error){this.configError=error instanceof Error?error.message:'Configuração de nuvem inválida.';}
  this.auth?.subscribe(state=>{
   if(!state.ready)return;
   this.authWork=this.authWork.then(async()=>{
    if(state.user?.id!==this.accountId){
     const previous=this.accountId;this.accountId=state.user?.id;this.profile=undefined;
     if(previous&&this.active){this.autosave?.stop();this.hooks.pause();this.ui.saveStatus('Conta desconectada · progresso mantido nesta partida. Entre novamente para salvar.','error');}
     if(!state.user){this.ui.identity();hooks.name();}
     else try{this.profile=await this.worlds!.profile();if(this.accountId!==this.profile.id){this.profile=undefined;return;}this.ui.identity(this.profile.username);hooks.name(this.profile.username);}catch(error){this.ui.feedback(error instanceof Error?error.message:'Perfil indisponível.',true);}
    }
    if(state.user?.id===this.active?.userId)this.autosave?.resume();
    if(state.recovering){this.password();return;}
    if(state.user&&new URL(location.href).searchParams.has('worldInvite')&&!this.acceptingInvite){this.acceptingInvite=true;try{const code=new URL(location.href).searchParams.get('worldInvite')!;await this.worlds!.accept(code);const url=new URL(location.href);url.searchParams.delete('worldInvite');history.replaceState(null,'',url);await this.list();this.ui.feedback('Convite aceito. Use o código Photon/LAN do líder para entrar na partida.');}catch(error){this.ui.show('Convite do mundo');this.ui.feedback(error instanceof Error?error.message:'Convite indisponível.',true);}finally{this.acceptingInvite=false;}}
   }).catch(()=>this.ui.feedback('Não foi possível atualizar sua conta. Tente novamente.',true));
  });
  window.addEventListener('beforeunload',e=>{if(this.active&&this.hooks.running()){this.autosave?.mark(false);void this.autosave?.flush();e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.active){this.autosave?.mark(false);void this.autosave?.flush();}});
 }
 async initialize(){await this.auth?.initialize();await this.authWork;const test=new URLSearchParams(location.search);if(this.auth&&!this.auth.current.user&&(!import.meta.env.DEV||!test.has('test')||test.has('cloud')))this.account();}
 private requireAccount(){if(!this.auth?.current.user){this.account();return false;}return true;}
 account(mode:'login'|'register'|'recovery'='login'){
  this.ui.show(this.auth?.current.user?'Seu sobrevivente':mode==='register'?'Mais uma chance.':mode==='recovery'?'Recuperar acesso':'Sobreviva. Volte amanhã.');
  if(!this.auth){this.ui.note(this.configError||'A nuvem não está configurada nesta versão. O jogo continua disponível sem conta.');this.ui.button('Jogar sem conta',()=>this.ui.close(),true);return;}
  const auth=this.auth;
  if(auth.current.user){this.ui.note(this.profile?`Conectado como ${this.profile.username}`:'Conta conectada · perfil aguardando conexão');if(!this.profile)this.ui.button('Tentar carregar perfil novamente',()=>void this.ui.busy(async()=>{this.profile=await this.worlds!.profile();this.ui.identity(this.profile.username);this.hooks.name(this.profile.username);this.account();}));this.ui.button('Meus mundos',()=>void this.ui.busy(()=>this.list()),true);if(this.active)this.ui.button('Salvar agora',()=>void this.save());this.ui.button('Sair da conta',()=>void this.ui.busy(async()=>{if(!await this.end())return;await auth.logout();this.account();}));return;}
  const email={key:'email',label:'E-mail',type:'email',max:254,autocomplete:'email'},password={key:'password',label:'Senha',type:'password',autocomplete:mode==='register'?'new-password':'current-password'};
  if(mode==='login'){
   this.ui.form([email,password],'Entrar',async v=>{await auth.login(v.email,v.password);await auth.initialize();await this.authWork;await this.list();});
   this.ui.button('Criar conta',()=>this.account('register'));this.ui.button('Esqueci minha senha',()=>this.account('recovery'));
  }else if(mode==='register')this.ui.form([{key:'username',label:'Username · letras, números e _',max:24,autocomplete:'username'},email,password,{key:'confirmation',label:'Confirmar senha',type:'password',autocomplete:'new-password'}],'Criar conta',async v=>{const result=await auth.register({username:v.username,email:v.email,password:v.password,confirmation:v.confirmation});if(result==='signed-in'){await this.list();}else{this.account();this.ui.feedback('Confira seu e-mail para confirmar o cadastro. Se já tiver uma conta, entre ou recupere sua senha.');}});
  else this.ui.form([email],'Enviar link de recuperação',async v=>{await auth.requestRecovery(v.email);this.ui.feedback('Se houver uma conta para este e-mail, você receberá um link de recuperação.');});
  if(mode!=='login')this.ui.button('Já tenho uma conta',()=>this.account());this.ui.button('Jogar sem conta',()=>this.ui.close());
 }
 private password(){this.ui.show('Nova senha');this.ui.form([{key:'password',label:'Nova senha',type:'password',autocomplete:'new-password'},{key:'confirmation',label:'Confirmar senha',type:'password',autocomplete:'new-password'}],'Salvar nova senha',async v=>{await this.auth!.updatePassword(v.password,v.confirmation);this.account();this.ui.feedback('Senha atualizada.');});}
 async list(){
  if(!this.requireAccount())return;const worlds=await this.worlds!.list();this.ui.show('Meus mundos');
  if(this.active){this.ui.note(`Expedição em andamento: ${this.active.world.name}. Salve e volte ao menu antes de abrir outro mundo.`);this.ui.button('Salvar e voltar ao menu',()=>void this.ui.busy(async()=>{if(await this.end())await this.list();}),true);this.ui.button('Exportar cópia de segurança',()=>this.export());return;}
  this.ui.worldList(worlds,this.auth!.current.user!.id,(w,coop)=>void this.ui.busy(()=>this.open(w,coop)),w=>void this.ui.busy(()=>this.details(w)));
  this.ui.note('Para começar outra história, use Jogar solo ou Criar sala no coop. Ao sair da partida, seu progresso é salvo aqui automaticamente.');this.ui.button('Resgatar convite',()=>this.inviteForm());
 }
 beginSolo(temporary:()=>Promise<void>){if(!this.auth?.current.user){void temporary();return;}this.create('solo');}
 beginCoop(createRoom:()=>void){if(this.pending||!this.auth?.current.user){createRoom();return;}this.create('coop',createRoom);}
 private create(mode:'solo'|'coop',createRoom?:()=>void){
  this.ui.show(mode==='solo'?'Nova expedição solo':'Novo mundo cooperativo');
  this.ui.note('Dê um nome à sua história. O progresso será salvo automaticamente ao sair e ficará disponível em Meus mundos.');
  this.ui.note('Dificuldade: Normal · equilíbrio atual do LAST NIGHT.');
  this.ui.form([{key:'name',label:'Nome do mundo',max:40}],mode==='solo'?'Criar mundo e jogar':'Criar mundo e sala',async v=>{
   if(mode==='coop'&&this.network.state!=='connected')throw new Error('A conexão do coop mudou. Volte ao lobby e conecte novamente.');
   const world=await this.worlds!.create(v.name);
   if(mode==='coop'){this.pending=world;this.network.persistentWorld={id:world.id,seed:world.seed,layoutVersion:1};this.ui.close();createRoom?.();}
   else await this.launch(await this.prepare(world.id),false);
  });
 }

 private inviteForm(){this.ui.show('Convite de um sobrevivente');this.ui.note('Este convite concede acesso ao mundo salvo. O código da sala Photon/LAN continua sendo usado no lobby.');this.ui.form([{key:'code',label:'Código ou link do convite',max:1024}],'Aceitar convite',async v=>{let code=v.code.trim();try{code=new URL(code).searchParams.get('worldInvite')??code;}catch{/* Raw token. */}await this.worlds!.accept(code);await this.list();this.ui.feedback('Você agora faz parte deste mundo.');});}
 private async details(world:WorldRow){
  const members=await this.worlds!.members(world.id);this.ui.show(world.name);this.ui.note(members.map(m=>`${m.username}${m.role==='owner'?' · proprietário':''}`).join(' / '));
  if(world.owner_id===this.auth!.current.user!.id){
   this.ui.button('Gerar convite · 24 horas / 3 usos',()=>void this.ui.busy(async()=>{const code=await this.worlds!.invite(world),url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('worldInvite',code);const p=this.ui.note(url.href);p.style.overflowWrap='anywhere';this.ui.button('Copiar convite',()=>void this.ui.busy(async()=>{await navigator.clipboard.writeText(url.href);this.ui.feedback('Convite copiado.');}));}));
   this.ui.form([{key:'username',label:'Conceder acesso por username',max:24}],'Adicionar membro',async v=>{await this.worlds!.addMember(world,v.username);await this.details(world);this.ui.feedback('Membro adicionado.');});
   this.ui.button('Excluir mundo…',()=>{this.ui.show('Excluir este mundo?');this.ui.note(`Esta ação apaga o mundo ${world.name} e seus saves. Digite o nome exato para confirmar.`);this.ui.form([{key:'name',label:'Nome do mundo',max:40}],'Excluir permanentemente',async v=>{if(v.name!==world.name)throw new Error('O nome não corresponde.');await this.worlds!.remove(world);await this.list();});this.ui.button('Cancelar',()=>void this.ui.busy(()=>this.list()));});
  }
  this.ui.button('Voltar aos mundos',()=>void this.ui.busy(()=>this.list()));
 }
 private async prepare(id:string):Promise<CloudRun>{
  if(!this.auth?.current.user)throw new Error('Entre na sua conta e aceite o convite do mundo antes de entrar nesta sala.');
  const loaded=await this.worlds!.load(id);configureWorld(loaded.world.seed,savedLayoutVersion(loaded.state.state));const sim=new Simulation(undefined,loaded.world.seed);deserializeWorld(loaded.state.state,sim);const record=loaded.player?deserializePlayer(loaded.player,sim):undefined;
  const service=new SaveService(getSupabaseClient()!,loaded.world,loaded.userId,loaded.state.revision,loaded.player?.updated_at??null);
  return {sim,record,service,world:loaded.world,userId:loaded.userId};
 }
 private async open(world:WorldRow,coop:boolean){
  if(this.entering||this.active)return;this.entering=true;
  try{
   const run=await this.prepare(world.id);
   const backup=await getRecovery(run.userId,world.id).catch(()=>undefined);
   if(backup){this.ui.show('Progresso local pendente');this.ui.note('Há uma cópia de uma tentativa de save que não terminou. Ela não será aplicada automaticamente sobre a nuvem.');this.ui.button('Baixar cópia local',()=>this.ui.download(`last-night-${world.id}-recovery.json`,backup));if(backup.revision===run.service.revision&&backup.playerStamp===run.service.playerStamp){this.ui.button('Recuperar progresso local em solo',()=>void this.ui.busy(async()=>{configureWorld(world.seed,backup.world?savedLayoutVersion(backup.world):run.sim.layoutVersion);const candidate=new Simulation(undefined,world.seed);if(backup.world)deserializeWorld(backup.world,candidate);else deserializeWorld(serializeWorld(run.sim),candidate);const record=deserializePlayer(backup.player as Parameters<typeof deserializePlayer>[0],candidate);const ids=backup.player as {world_id:string;user_id:string};if(ids.world_id!==run.world.id||ids.user_id!==run.userId)throw new Error('A cópia pertence a outra conta ou mundo.');await this.launch({...run,sim:candidate,record},false);}));}this.ui.button('Continuar com o save da nuvem',()=>void this.ui.busy(()=>this.launch(run,coop)),true);this.ui.button('Voltar',()=>void this.ui.busy(()=>this.list()));return;}
   await this.launch(run,coop);
  }finally{this.entering=false;}
 }
 private async launch(run:CloudRun,coop:boolean){
  if(coop){if(run.world.owner_id!==run.userId)throw new Error('O proprietário deve hospedar este mundo.');this.pending=run.world;this.network.persistentWorld={id:run.world.id,seed:run.world.seed,layoutVersion:run.sim.layoutVersion};this.ui.close();this.hooks.lobby();}
  else {this.pending=undefined;this.network.persistentWorld=undefined;this.ui.close();try{await this.hooks.launch(run);}catch(error){this.ui.show('Carregamento interrompido');this.ui.feedback('Não foi possível preparar a partida. O save da nuvem foi preservado.',true);this.ui.button('Voltar ao menu',()=>{this.detach();this.hooks.exit();this.ui.close();});throw error;}}
 }
 async networkRun(data:StartData):Promise<CloudRun|undefined>{
  if(!data.worldId)return undefined;
  let run:CloudRun;try{run=await this.prepare(data.worldId);}catch(error){this.ui.show('Acesso ao mundo');this.ui.feedback(error instanceof Error?error.message:'Não foi possível carregar o mundo.',true);this.ui.button('Conta e convites',()=>this.account());throw error;}if(run.world.seed!==data.seed)throw new Error('A seed da sala não corresponde ao mundo salvo.');if(this.network.isHost&&run.world.owner_id!==run.userId)throw new Error('Somente o proprietário pode iniciar este mundo salvo.');return run;
 }
 async attach(run:CloudRun,session?:CoopSession,data?:StartData){
  this.detach();this.active=run;this.pending=undefined;
  if(session&&data){
   const peer=this.network.players.find(p=>p.isLocal);if(!peer)throw new Error('Identidade de sessão ausente.');
   const binding={userId:run.userId,playerId:peer.playerId,actor:peer.actorNumber,token:data.token,nonce:Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('')};
   const payload=serializePlayer(run.sim,run.world.id,run.userId,run.record);(payload.extra_data as Record<string,unknown>).accountBinding=binding;await run.service.player(payload);
   this.bridge=new CoopAccountBridge(this.network,session,run.service,data,binding,run.record);await this.bridge.connect();
   this.startAutosave(run);this.autosave!.binding=binding;
  }else this.startAutosave(run);
  this.network.persistentWorld={id:run.world.id,seed:run.world.seed,layoutVersion:run.sim.layoutVersion};
 }
 private startAutosave(run:CloudRun){this.autosave=new Autosave(run.service,()=>{const source=this.hooks.source();return {...source,canSaveWorld:run.userId===run.world.owner_id&&this.hooks.authority()};},status=>this.ui.saveStatus(status.message,status.kind));this.ui.saveStatus('Progresso em andamento','dirty');}
 touch(important=false){if(!this.active)return;const now=performance.now();if(important||now-this.lastDirty>5000){this.lastDirty=now;this.autosave?.mark(important);}}
 async save(){if(!this.autosave)return true;this.autosave.mark(false);return this.autosave.flush();}
 async end():Promise<boolean>{
  if(this.exiting)return this.exiting;
  return this.exiting=(async()=>{if(!await this.save()){this.hooks.pause();this.ui.show('Progresso ainda não salvo');this.ui.note(this.autosave?.status.message??'A nuvem está indisponível.');this.ui.button('Tentar salvar novamente',()=>void this.ui.busy(async()=>{if(await this.end())this.ui.close();}),true);this.ui.button('Exportar cópia de segurança',()=>this.export());this.ui.button('Voltar à partida',()=>this.ui.close());this.ui.button('Conta',()=>this.account());this.ui.button('Encerrar sem enviar à nuvem…',()=>{this.ui.show('Encerrar com save pendente?');this.ui.note('O progresso não foi confirmado na nuvem. Exporte uma cópia antes de encerrar. A tentativa de save também mantém uma cópia local quando o navegador permite.');this.ui.button('Exportar cópia de segurança',()=>this.export());this.ui.button('Confirmar encerramento',()=>{this.detach();this.hooks.exit();this.ui.close();});this.ui.button('Cancelar',()=>this.ui.close());});return false;}this.detach();this.hooks.exit();return true;})().finally(()=>{this.exiting=undefined;});
 }
 detach(){this.autosave?.stop();this.autosave=undefined;this.bridge?.dispose();this.bridge=undefined;this.active=undefined;this.ui.saveStatus('','idle',false);}
 ephemeral(){this.pending=undefined;this.network.persistentWorld=undefined;}
 get selected(){return this.pending;}
 get current(){return this.active;}
 export(){if(!this.active)return;const s=this.hooks.source();this.ui.download(`last-night-${this.active.world.id}-recovery.json`,{worldId:this.active.world.id,userId:this.active.userId,revision:this.active.service.revision,playerStamp:this.active.service.playerStamp,player:serializePlayer(s.player,this.active.world.id,this.active.userId,s.confirmed),world:serializeWorld(s.world,s.checkpoint)});}
}
