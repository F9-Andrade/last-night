import type {AuthChangeEvent,Session,SupabaseClient,User} from '@supabase/supabase-js';
import {authError,validateEmail,validatePassword,validateRegistration} from './auth-validation.ts';
import type {Registration} from './auth-validation.ts';

export interface AccountState {user:User|null;ready:boolean;recovering:boolean;error:string}
type Listener=(state:Readonly<AccountState>)=>void;

/** Auth owns passwords and its persisted session; the game never stores either. */
export class AuthService {
 private state:AccountState={user:null,ready:false,recovering:false,error:''};
 private listeners=new Set<Listener>();private unsubscribe:()=>void;
 private timer?:ReturnType<typeof setTimeout>;private initialization?:Promise<void>;private disposed=false;
 constructor(private client:SupabaseClient,private redirectUrl:string){
  const {data}=client.auth.onAuthStateChange((event,session)=>this.changed(event,session));
  this.unsubscribe=()=>data.subscription.unsubscribe();
 }
 get current():Readonly<AccountState>{return this.state;}
 subscribe(listener:Listener){this.listeners.add(listener);listener(this.state);return ()=>{this.listeners.delete(listener);};}
 private emit(){if(!this.disposed)for(const listener of this.listeners)listener(this.state);}
 private changed(event:AuthChangeEvent,session:Session|null){
  if(this.disposed)return;
  this.state={...this.state,user:session?.user??null,ready:true,error:'',recovering:event==='PASSWORD_RECOVERY'||event!=='SIGNED_OUT'&&this.state.recovering};
  // Defer consumers until the SDK releases its Auth lock. Consumers can then
  // fetch profiles without nesting Supabase calls inside the auth callback.
  clearTimeout(this.timer);this.timer=setTimeout(()=>this.emit(),0);
 }
 initialize():Promise<void>{
  return this.initialization??=(async()=>{
   const {data,error}=await this.client.auth.getSession();if(this.disposed)return;
   if(error)this.state={...this.state,ready:true,error:authError(error)};
   else this.state={...this.state,user:data.session?.user??null,ready:true};
   this.emit();
  })().catch(error=>{if(!this.disposed){this.state={...this.state,ready:true,error:authError(error)};this.emit();}});
 }
 async register(input:Registration):Promise<'confirmation'|'signed-in'>{
  const {email,password,username}=validateRegistration(input);
  const {data,error}=await this.client.auth.signUp({email,password,options:{data:{username},emailRedirectTo:this.redirectUrl}});
  if(error)throw new Error(authError(error));
  // Confirm-email mode may deliberately return an obfuscated existing user.
  // Do not claim a new account exists until a session is actually established.
  return data.session?'signed-in':'confirmation';
 }
 async login(email:string,password:string):Promise<void>{
  email=validateEmail(email);if(!password)throw new Error('Informe sua senha.');
  const {error}=await this.client.auth.signInWithPassword({email,password});if(error)throw new Error(authError(error));
 }
 async requestRecovery(email:string):Promise<void>{
  email=validateEmail(email);
  const url=new URL(this.redirectUrl);url.searchParams.set('account','recovery');
  const {error}=await this.client.auth.resetPasswordForEmail(email,{redirectTo:url.href});if(error)throw new Error(authError(error));
 }
 async updatePassword(password:string,confirmation:string):Promise<void>{
  validatePassword(password,confirmation);
  if(!this.state.user||!this.state.recovering)throw new Error('Abra o link de recuperação enviado para seu e-mail.');
  const {error}=await this.client.auth.updateUser({password});if(error)throw new Error(authError(error));
  this.state={...this.state,recovering:false};this.emit();
 }
 async logout():Promise<void>{
  const {error}=await this.client.auth.signOut({scope:'local'});if(error)throw new Error(authError(error));
  this.state={user:null,ready:true,recovering:false,error:''};this.emit();
 }
 dispose(){this.disposed=true;clearTimeout(this.timer);this.unsubscribe();this.listeners.clear();}
}
