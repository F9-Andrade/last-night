import { FPS } from './first-person.ts';
export const QUALITY_LEVELS=['low','medium','high','ultra'] as const;
export type QualityPreset=typeof QUALITY_LEVELS[number];
export const QUALITY_LABELS:Record<QualityPreset,string>={low:'LEVE',medium:'MÉDIA',high:'ALTA',ultra:'ULTRA'};
export interface Settings { master:number; music:number; effects:number; ambient:number; sensitivity:number; fov:number; headBob:number; quality:QualityPreset; shadows:boolean; uiScale:number; shake:boolean; captions:boolean }
export const DEFAULT_SETTINGS:Settings={master:80,music:35,effects:85,ambient:70,sensitivity:1,fov:FPS.fov,headBob:.5,quality:'high',shadows:true,uiScale:1,shake:true,captions:true};
export function sanitizeSettings(value:unknown):Settings {
 const source=(value&&typeof value==='object'?value:{}) as Partial<Settings>;
 const range=(key:keyof Settings,min:number,max:number)=>typeof source[key]==='number'&&Number.isFinite(source[key])?Math.min(max,Math.max(min,source[key] as number)):DEFAULT_SETTINGS[key] as number;
 const quality=QUALITY_LEVELS.includes(source.quality as QualityPreset)?source.quality as QualityPreset:DEFAULT_SETTINGS.quality;
 return {master:range('master',0,100),music:range('music',0,100),effects:range('effects',0,100),ambient:range('ambient',0,100),sensitivity:range('sensitivity',.25,2.5),fov:range('fov',70,105),headBob:range('headBob',0,1),uiScale:range('uiScale',.85,1.2),quality,shadows:typeof source.shadows==='boolean'?source.shadows:true,shake:typeof source.shake==='boolean'?source.shake:true,captions:typeof source.captions==='boolean'?source.captions:true};
}
export function loadSettings():Settings {try{return sanitizeSettings(JSON.parse(localStorage.getItem('last-night-settings')??'{}'));}catch{return {...DEFAULT_SETTINGS};}}
export function saveSettings(settings:Settings):void {try{localStorage.setItem('last-night-settings',JSON.stringify(settings));}catch{/* Optional browser storage. */}}
