import {createClient} from '@supabase/supabase-js';
import type {SupabaseClient} from '@supabase/supabase-js';
import {cloudConfig} from './cloud-config.ts';

let singleton:SupabaseClient|null|undefined;
/** Lazy singleton: no websocket, Realtime channel or per-frame request. */
export function getSupabaseClient():SupabaseClient|null {
 if(singleton!==undefined)return singleton;
 const config=cloudConfig(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
 if(!config)return singleton=null;
 singleton=createClient(config.url,config.key,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:config.storageKey},
  global:{fetch:async(input,init)=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('Tempo de conexão excedido.','TimeoutError')),15000);
   const source=init?.signal??(input instanceof Request?input.signal:undefined),abort=()=>controller.abort(source?.reason);
   if(source?.aborted)abort();else source?.addEventListener('abort',abort,{once:true});
   try{return await fetch(input,{...init,signal:controller.signal});}
   finally{clearTimeout(timer);source?.removeEventListener('abort',abort);}
  }},
 });
 return singleton;
}
