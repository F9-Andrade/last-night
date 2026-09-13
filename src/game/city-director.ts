import type {CitySite} from './city.ts';
import type {EnemyKind} from './enemies.ts';
export function cityEncounter(site:CitySite,day:number,health:number):EnemyKind[]{
 const count=Math.min(12,site.risk+1+Math.min(2,Math.floor(day/2))-(health<35?1:0));
 const group:EnemyKind[]=Array.from({length:count},()=> 'walker');
 if(site.risk>=3)group[count-1]='runner';
 if(site.risk>=4)group[count-2]=site.kind==='market'?'spitter':'screamer';
 if(site.risk>=5)group[count-3]='spitter';
 if(site.kind==='quarantine'||site.kind==='industry'&&day>=2)group[1]='tank';
 if(site.kind==='quarantine')group[count-4]='runner';
 return group;
}
export const SCREAM={windup:1.35,cooldown:14,range:18,noise:58,interrupt:18};
export const CITY_PACING={activation:64,sleep:86,roamCount:10,roamInterval:90,nightOutsideInterval:32};
