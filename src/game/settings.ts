export interface Settings { master:number; music:number; effects:number; sensitivity:number; quality:'high'|'low'; shadows:boolean; uiScale:number; shake:boolean; captions:boolean }
export const DEFAULT_SETTINGS:Settings={master:80,music:35,effects:85,sensitivity:1,quality:'high',shadows:true,uiScale:1,shake:true,captions:true};
export function sanitizeSettings(value:unknown):Settings {
  const source=(value&&typeof value==='object'?value:{}) as Partial<Settings>;
  const range=(key:keyof Settings,min:number,max:number)=>typeof source[key]==='number'&&Number.isFinite(source[key])?Math.min(max,Math.max(min,source[key] as number)):DEFAULT_SETTINGS[key] as number;
  return {master:range('master',0,100),music:range('music',0,100),effects:range('effects',0,100),sensitivity:range('sensitivity',.5,1.5),uiScale:range('uiScale',.85,1.2),quality:source.quality==='low'?'low':'high',shadows:typeof source.shadows==='boolean'?source.shadows:true,shake:typeof source.shake==='boolean'?source.shake:true,captions:typeof source.captions==='boolean'?source.captions:true};
}
export function loadSettings():Settings {try{return sanitizeSettings(JSON.parse(localStorage.getItem('last-night-settings')??'{}'));}catch{return {...DEFAULT_SETTINGS};}}
export function saveSettings(settings:Settings):void {try{localStorage.setItem('last-night-settings',JSON.stringify(settings));}catch{/* Storage may be unavailable in a private browser. */}}
