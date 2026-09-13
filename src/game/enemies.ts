export type EnemyKind='walker'|'runner'|'tank'|'spitter'|'screamer';
export interface EnemyDefinition {name:string;hp:number;speed:number;radius:number;damage:number;structure:number;baseDamage:number;interval:number;stagger:number;knockback:number;windup:number;startNight:number;scaleX:number;scaleY:number;headY:number;headZ:number;hint:string}
export const ENEMIES:Record<EnemyKind,EnemyDefinition>={
  walker:{name:'Errante',hp:90,speed:1.15,radius:.48,damage:9,structure:18,baseDamage:24,interval:1.1,stagger:1,knockback:1,windup:0,startNight:1,scaleX:1,scaleY:1,headY:1.89,headZ:.18,hint:'Lento, mas perigoso em grupo.'},
  runner:{name:'Corredor',hp:58,speed:5.15,radius:.42,damage:7,structure:10,baseDamage:14,interval:.85,stagger:.55,knockback:1.5,windup:.22,startNight:2,scaleX:.8,scaleY:.94,headY:1.72,headZ:.32,hint:'Rápido. Mantenha distância e uma rota de fuga.'},
  tank:{name:'Brutamontes',hp:310,speed:.78,radius:.58,damage:22,structure:65,baseDamage:62,interval:2.3,stagger:.3,knockback:.18,windup:.65,startNight:4,scaleX:1.65,scaleY:1.24,headY:2.36,headZ:.24,hint:'Golpes pesados destroem defesas. Mire na cabeça.'},
  spitter:{name:'Cuspidor',hp:78,speed:1.08,radius:.46,damage:6,structure:12,baseDamage:18,interval:1.4,stagger:1,knockback:.8,windup:.35,startNight:3,scaleX:1.1,scaleY:1,headY:1.87,headZ:.35,hint:'Interrompa a preparação e saia do ácido.'},
  screamer:{name:'Arauto',hp:65,speed:1.35,radius:.43,damage:6,structure:12,baseDamage:16,interval:1.4,stagger:1.2,knockback:1.1,windup:.3,startNight:5,scaleX:.9,scaleY:1.08,headY:2.16,headZ:.24,hint:'Interrompa o grito. Ele chama os infectados da região.'},
};
/** The large majority stays Walkers. Specials occupy deliberate beats of later waves. */
export function nightEnemy(day:number,index:number,budget:number):EnemyKind {
  if(day>=5&&index===Math.floor(budget*.35))return 'screamer';
  if(day>=5&&index===Math.floor(budget*.9))return 'tank';
  if(day>=3&&(index===Math.floor(budget*.2)||index===Math.floor(budget*.62)))return 'runner';
  if(day>=4&&index===Math.floor(budget*.7))return 'tank';
  if(day>=3&&index===Math.floor(budget*.48))return 'spitter';
  if(day>=2&&(index===5||index===Math.floor(budget*.8)))return 'runner';
  return 'walker';
}
export const ACID={windup:1.05,flight:.7,lifetime:4,radius:1.45,damage:5,interval:.65,cooldown:5.5,range:13,capacity:8};
