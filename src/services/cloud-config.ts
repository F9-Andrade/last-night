export interface CloudConfig {url:string;key:string;storageKey:string}

/** Validate configuration without ever including a credential in an error. */
export function cloudConfig(urlValue:unknown,keyValue:unknown):CloudConfig|null {
 const rawUrl=typeof urlValue==='string'?urlValue.trim():'',key=typeof keyValue==='string'?keyValue.trim():'';
 if(!rawUrl&&!key)return null;
 if(!rawUrl||!key)throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para ativar sua conta.');
 let url:URL;try{url=new URL(rawUrl);}catch{throw new Error('A URL do Supabase não é válida.');}
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use a URL HTTPS do projeto Supabase, sem credenciais ou parâmetros.');
 let publicKey=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
 if(!publicKey)try{
  const parts=key.split('.');if(parts.length===3){const encoded=parts[1].replace(/-/g,'+').replace(/_/g,'/');const payload=JSON.parse(atob(encoded));publicKey=payload?.role==='anon'&&payload?.iss==='supabase';}
 }catch{/* A malformed key must fail closed. */}
 // This is a configuration guard, not verification of a JWT signature. Supabase
 // verifies credentials; privileged keys must never be bundled into the client.
 if(!publicKey)throw new Error('Use somente a chave pública anon/publishable. Chaves secretas ou administrativas não são permitidas.');
 return {url:url.origin,key,storageKey:`last-night-auth-${url.host}`};
}
