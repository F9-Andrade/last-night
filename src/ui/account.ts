import type {WorldRow} from '../services/cloud-types';
import './account.css';

type Fields=Record<string,string>;
export class AccountUI {
 readonly panel=document.createElement('section');
 readonly status=document.createElement('p');
 private card=document.createElement('div');private body=document.createElement('div');private message=document.createElement('p');private title=document.createElement('h2');private back=document.createElement('button');
 onClose=()=>{};onAccount=()=>{};onWorlds=()=>{};onSave=()=>{};
 private account=document.createElement('button');private worlds=document.createElement('button');private save=document.createElement('button');
 constructor(root:HTMLElement){
  this.panel.id='account-panel';this.panel.hidden=true;this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-modal','true');this.panel.setAttribute('aria-labelledby','account-title');
  this.card.className='account-card';const header=document.createElement('header'),label=document.createElement('span');label.className='eyebrow';label.textContent='LAST NIGHT / SOBREVIVENTES';this.back.textContent='Voltar';this.back.onclick=()=>this.onClose();header.append(label,this.back);
  this.title.id='account-title';this.message.setAttribute('role','status');this.message.className='account-message';this.body.className='account-body';this.card.append(header,this.title,this.message,this.body);this.panel.append(this.card);root.append(this.panel);
  this.account.id='account-open';this.account.textContent='Conta';this.account.onclick=()=>this.onAccount();this.worlds.id='worlds-open';this.worlds.textContent='Meus mundos';this.worlds.onclick=()=>this.onWorlds();
  const menu=root.querySelector('#start')!.parentElement!;menu.append(this.worlds,this.account);
  this.save.id='cloud-save';this.save.textContent='Salvar progresso';this.save.hidden=true;this.save.onclick=()=>this.onSave();root.querySelector('#pause-screen .pause-card')?.append(this.save);
  this.status.id='cloud-status';this.status.hidden=true;this.status.setAttribute('role','status');root.append(this.status);
  this.panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.onClose();}if(e.key==='Tab'){const all=[...this.panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(el=>!el.hidden);const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 }
 get opened(){return !this.panel.hidden;}
 close(){this.panel.hidden=true;document.getElementById('menu')!.inert=false;this.account.focus();}
 show(title:string){this.panel.hidden=false;document.getElementById('menu')!.inert=true;this.title.textContent=title;this.body.replaceChildren();this.feedback('');this.back.focus();}
 identity(name?:string){this.account.textContent=name?`Conta · ${name}`:'Conta';}
 feedback(text:string,error=false){this.message.textContent=text;this.message.classList.toggle('error',error);}
 note(text:string){const p=document.createElement('p');p.textContent=text;this.body.append(p);return p;}
 button(text:string,action:()=>void,primary=false,parent:HTMLElement=this.body){const button=document.createElement('button');button.type='button';button.textContent=text;button.classList.toggle('primary',primary);button.onclick=action;parent.append(button);return button;}
 async busy(action:()=>Promise<void>){if(this.panel.getAttribute('aria-busy')==='true')return;this.panel.setAttribute('aria-busy','true');const buttons=[...this.panel.querySelectorAll<HTMLButtonElement>('button')];buttons.forEach(b=>b.disabled=true);try{await action();}catch(error){this.feedback(error instanceof Error?error.message:'Não foi possível concluir. Tente novamente.',true);}finally{buttons.forEach(b=>b.disabled=false);this.panel.removeAttribute('aria-busy');}}
 form(fields:{key:string;label:string;type?:string;max?:number;autocomplete?:string}[],submit:string,action:(values:Fields)=>Promise<void>){
  const form=document.createElement('form');const inputs=new Map<string,HTMLInputElement>();
  for(const f of fields){const label=document.createElement('label'),input=document.createElement('input');input.name=f.key;input.id=`account-${f.key}`;input.type=f.type??'text';input.required=true;input.maxLength=f.max??128;input.setAttribute('autocomplete',f.autocomplete??'off');label.htmlFor=input.id;label.textContent=f.label;inputs.set(f.key,input);form.append(label,input);}
  const button=document.createElement('button');button.type='submit';button.className='primary';button.textContent=submit;form.append(button);
  form.onsubmit=e=>{e.preventDefault();const values=Object.fromEntries([...inputs].map(([k,v])=>[k,v.value]));void this.busy(async()=>{try{await action(values);}finally{for(const input of inputs.values())if(input.type==='password')input.value='';for(const key of Object.keys(values))values[key]='';}});};this.body.append(form);return form;
 }
 worldList(worlds:WorldRow[],userId:string,open:(world:WorldRow,coop:boolean)=>void,manage:(world:WorldRow)=>void){
  const list=document.createElement('div');list.className='world-list';
  for(const w of worlds){const row=document.createElement('article'),title=document.createElement('h3'),meta=document.createElement('p'),actions=document.createElement('div');title.textContent=w.name;
   const date=new Date(w.updated_at);meta.textContent=`Dia ${w.current_day} · ${{normal:'Normal',easy:'Fácil',hard:'Difícil',nightmare:'Pesadelo'}[w.difficulty]} · ${w.owner_id===userId?'Seu mundo':'Membro'} · ${Number.isNaN(date.valueOf())?'':date.toLocaleDateString('pt-BR')}`;
   actions.className='world-actions';this.button('Continuar',()=>open(w,false),true,actions);if(w.owner_id===userId)this.button('Hospedar coop',()=>open(w,true),false,actions);this.button('Detalhes',()=>manage(w),false,actions);row.append(title,meta,actions);list.append(row);
  }this.body.append(list);if(!worlds.length)this.note('Ainda não há mundos salvos. Comece por Jogar solo ou Criar sala no coop.');
 }
 saveStatus(message:string,kind='idle',active=true){this.status.hidden=!active;this.status.textContent=message;this.status.dataset.kind=kind;this.save.hidden=!active;this.save.disabled=kind==='saving';}
 download(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
