export interface Registration {username:string;email:string;password:string;confirmation:string}
export const validUsername=(name:string)=>/^[A-Za-z0-9_]{3,24}$/.test(name);
export function validateEmail(email:string):string {
 const clean=email.trim();if(clean.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean))throw new Error('Informe um e-mail válido.');return clean;
}
export function validatePassword(password:string,confirmation:string):void {
 if(password.length<8||password.length>128)throw new Error('Use uma senha com 8 a 128 caracteres.');
 if(password!==confirmation)throw new Error('As senhas não coincidem.');
}
export function validateRegistration(input:Registration):Registration {
 const username=input.username.trim();if(!validUsername(username))throw new Error('Use de 3 a 24 letras, números ou underscore no nome.');
 const email=validateEmail(input.email);validatePassword(input.password,input.confirmation);return {...input,username,email};
}
/** Supabase errors can include database details: never render their raw message. */
export function authError(error:unknown):string {
 const e=error&&typeof error==='object'?error as {code?:string;status?:number;name?:string}:{};
 if(e.status===429||e.code==='over_request_rate_limit'||e.code==='over_email_send_rate_limit')return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
 if(e.code==='invalid_credentials')return 'E-mail ou senha incorretos.';
 if(e.code==='email_not_confirmed')return 'Confirme seu e-mail antes de entrar.';
 if(e.code==='user_already_exists'||e.code==='email_exists')return 'Este e-mail já possui uma conta. Entre ou recupere sua senha.';
 if(e.code==='weak_password')return 'A senha não atende aos requisitos de segurança. Escolha uma senha mais forte.';
 if(e.code==='same_password')return 'Escolha uma senha diferente da atual.';
 if(e.code==='email_address_invalid'||e.code==='validation_failed')return 'Confira o e-mail e os campos informados.';
 if(e.code==='23505')return 'Este nome já está em uso. Escolha outro nome de sobrevivente.';
 if(e.code==='session_not_found'||e.code==='refresh_token_not_found'||e.code==='refresh_token_already_used'||e.status===401)return 'Sua sessão expirou. Entre novamente para continuar.';
 if(e.code==='signup_disabled')return 'Novos cadastros estão temporariamente indisponíveis.';
 if(e.code==='unexpected_failure'||e.status===500)return 'Não foi possível concluir o cadastro. O nome pode estar em uso ou o serviço está indisponível.';
 if(e.name==='AbortError'||e.name==='TimeoutError'||e.name==='AuthRetryableFetchError'||e.name==='TypeError'||e.status===0)return 'Sem conexão com o abrigo. Confira a internet e tente novamente.';
 return 'Não foi possível concluir a operação. Tente novamente em instantes.';
}
