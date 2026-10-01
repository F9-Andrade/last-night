import type {Recipe} from '../game/crafting';
import {itemArt} from './item-art';

/** Original workshop drawings. Static, shared by solo/co-op; no GPU scene or external assets. */
const ink = '#b8b5a3', steel = '#555a56', dark = '#242b29', wood = '#896647', edge = '#c99b67';
const material = (fill:string, body:string, stroke=ink) => `<g fill="${fill}" stroke="${stroke}" stroke-width="1.25" stroke-linejoin="bevel">${body}</g>`;
const seams = (body:string) => `<g fill="none" stroke="${edge}" stroke-width="1" opacity=".65">${body}</g>`;
const hardware = (points:readonly (readonly [number,number])[]) => points.map(([x,y])=>`<rect x="${x}" y="${y}" width="2" height="2" fill="${ink}"/>`).join('');
const table = material(dark,'<path d="m35 51 4 49 7 3-1-46m68-17-2 48 7 3 8-43"/>')+
 material(wood,'<path d="m20 46 87-18 34 15-87 21z"/><path d="m20 46 34 18v7L20 54zm34 18 87-21v8L54 71z"/>')+
 material(dark,'<path d="m39 91 75-16v6L40 98z"/><path d="m64 45-2-26 32-7 2 26z"/>')+
 material('#6e8274','<path d="m69 23 20-4 1 13-20 4z"/>')+
 seams('<path d="m23 48 85-17m-72 24 83-17M74 27l5 3 6-6m-33 31 52-12M65 57l9-2m5-1 13-3"/>')+
 material(steel,'<path d="m115 39 10 4-1 11-9-4zM110 37l6-2 10 4-6 2z"/>')+hardware([[40,58],[57,65],[121,50],[112,84]]);
const chest = material(wood,'<path d="m29 47 66-19 36 17-64 22z"/><path d="m29 47 38 20v39L29 85z"/><path d="m67 67 64-22v39l-64 22z"/>')+
 material('#3c3026','<path d="m29 57 38 21 64-22v5L67 84 29 62z"/>')+
 material(steel,'<path d="m38 45 7-2 37 19v41l-7 2V67zM109 35l7 3-62 20v41l-7-4V54z"/>')+
 material(dark,'<path d="m94 66 12-4v15l-12 4z"/>')+seams('<path d="m98 68 4-1v6l-4 1m-63-8 26 14M35 80l27 15m52-32 13-5m-15 17 15-6M58 43l29-8"/>')+
 hardware([[40,50],[40,84],[77,74],[77,94],[49,60],[110,49],[118,79]]);
const armor = (reinforced=false) => material('#735b42','<path d="m57 21 13-5 10 13 10-13 14 5 7 17-10 12 11 45-32 12-32-12 11-45-10-12z"/>')+
 material(dark,'<path d="m70 16 10 13 10-13-4 20H74zM77 36h6v64h-6z"/>')+
 material(reinforced?steel:'#9a7650','<path d="m56 51 16 2v19l-20-4zM88 53l16-2 4 17-20 4zM53 79l19 4v14l-23-8zM88 83l19-4 4 10-23 8z"/>')+
 seams('<path d="m57 25 9-3 7 16m14 0 7-16 9 3M62 39l-8 7M98 39l8 7M53 72l19 4m16 0 19-4"/>')+
 material(steel,'<path d="M63 39h9v6h-9zM88 39h9v6h-9z"/>')+hardware([[57,56],[68,58],[92,58],[101,56],[57,83],[101,83]]);
const pack = material('#59634b','<path d="m50 43 9-15h40l11 15 5 51-13 11H57L45 94z"/><path d="M66 27V17h28v10h-6v-4H72v4z"/>')+
 material('#353b31','<path d="M51 46h58v15H51zM50 67l-9 3v21l8 3m62-27 9 3v21l-7 3"/>')+
 material('#7d7d58','<path d="M58 64h43v30H58zM61 30h8v68h-8zM91 30h8v68h-8z"/>')+
 material(steel,'<path d="M58 49h13v10H58zM89 49h13v10H89z"/>')+seams('<path d="M73 72h15m-15 6h10M56 98h46M59 38h42"/>');
const wall = (fortify=false,gate=false) => material('#65513b','<path d="M29 32h11v72H29zM121 24h11v80h-11z"/><path d="m40 36 81-8v65l-81 8z"/>')+
 seams('<path d="m53 35 1 64m12-65 1 63m12-64 1 63m12-65 1 62m12-65 1 63"/>')+
 material(fortify?steel:'#8a7450',fortify?'<path d="m43 44 73-7v38l-73 7z"/><path d="m48 83 62-6v13l-62 6z"/>':'<path d="m38 48 85-9v7l-85 9zM38 85l85-9v7l-85 9z"/>')+
 (gate?material(dark,'<path d="m77 32 5-1v66h-5z"/><path d="m69 59 25-3v8l-25 3z"/>')+hardware([[35,50],[35,87],[126,41],[126,79],[72,62],[89,60]]):
 material(fortify?dark:'#ae865a','<path d="m43 87 70-46 4 7-70 47z"/>')+hardware([[46,87],[107,47],[48,49],[108,44],[51,89],[108,84]]));
const spikes = material('#64513c','<path d="m18 82 90-23 37 18-91 25z"/><path d="m18 82 36 20v8L18 90zm36 20 91-25v8l-91 25z"/>')+
 material('#8c7856','<path d="m35 84 3-46 16 42zM59 77l3-48 17 43zM87 70l3-49 17 44zM62 96l2-45 16 41zM94 87l2-43 16 39zM118 80l3-43 13 39z"/>')+
 seams('<path d="m38 46 8 29m17-35 7 27m22-36 7 24m-32 4 6 26m27-28 5 18m19-27 4 20"/>');
const wire = material('#675139','<path d="M27 26h9v75h-9zM122 19h9v75h-9z"/>')+
 material('none','<path d="m33 42 93-9m-93 29 93-9m-93 29 93-9M44 32l14 55m10-58 14 55m10-58 14 55m10-58-14 61m-10-59-14 61m-10-59-14 61"/>',steel)+
 seams('<path d="m45 36 8 10m-8-1 8-10m23-1 8 10m-8-1 8-10m21-1 8 10m-8-1 8-10M45 76l8 10m-8-1 8-10m22-1 8 10m-8-1 8-10m21-1 8 10m-8-1 8-10"/>');
const snare = material('#675139','<path d="m117 33 7-3 6 68-7 3z"/>')+
 material('none','<path d="M121 39c-42-20-61-8-52 24 6 21 44 32 28 41-14 8-67 1-71-14-5-18 37-26 56-17 18 9 12 25-6 29-13 3-35-1-39-12-3-10 21-17 31-13"/>',edge)+
 material(steel,'<path d="m108 36 18-4 2 7-18 4z"/>')+seams('<path d="m122 48 5 41M44 83l-7 9m25-13-8 9m29-4-8 8"/>');
const gun = (kind:string) => {
 if(kind==='pistol')return material(steel,'<path d="M29 39h97l9 7v19H68l-9 37H34l9-37H26V48z"/>')+
  material(dark,'<path d="M29 47h99v12H29zM42 70h19l-6 28H36zM72 65v15h17l4-15h-6l-4 9h-5v-9z"/>')+
  material('#897c64','<path d="M35 35h8v5h-8zM113 34h8v6h-8z"/>')+
  seams('<path d="M43 43h57m7 0h13M38 73l17 13M37 81l16 13M103 48v9m5-9v9m5-9v9"/>')+hardware([[47,75],[42,91],[64,62]]);
 const rifle=kind==='rifle';
 return material(wood,'<path d="m12 67 31-15 13 8-7 12-32 21-8-4z"/>')+
  material(steel,`<path d="M39 48h${rifle?'55':'49'}v18H39zM${rifle?'94':'88'} 49h45v9H${rifle?'94':'88'}z"/><path d="M135 46h11v15h-11z"/>`)+
  material(wood,'<path d="M91 58h33v11H91zM58 65h13l-6 25H54z"/>')+
  material(dark,`<path d="M69 66v15h15l4-15h-5l-4 9h-5v-9z"/>${rifle?'<path d="M83 67h14l5 30-14 2zM57 42h25v6H57zM62 37h15v5H62z"/>':'<path d="M92 70h26v6H92z"/>'}`)+
  seams('<path d="M19 72l17-9m-17 16 17-9M45 51h33m-30 6h18M98 61v5m6-5v5m6-5v5m6-5v5"/>')+hardware([[44,61],[80,61],[138,49]]);
};
const tool = (kind:string) => {
 if(kind==='club')return material(wood,'<path d="m44 97 12 7 15-30 10-6 26-36-1-10-17-9-10 6-16 44 1 11z"/>')+
  material('#777059','<path d="m62 53 26 13 4-7-27-12zM67 37l30 15 5-8-31-15z"/>')+
  seams('<path d="m56 80 10 6m-13 0 10 6m15-56 15-18m-14 35 13-18"/>')+hardware([[68,53],[75,56],[84,60],[75,36],[85,41],[94,45]]);
 if(kind==='axe')return material(wood,'<path d="m42 100 9 6 47-81-8-5z"/>')+
  material(steel,'<path d="m70 21 15 5 12-3 26 2-5 20-10 14-20-14-14-5-14-10z"/>')+
  material('#b6b9aa','<path d="m116 28 7-3-5 20-10 14-6-5 8-13z"/>')+
  material('#41392f','<path d="m42 93 14 8 8-14-14-8z"/>')+seams('<path d="m54 80 8 4m-12 2 8 4m-12 2 8 4m31-64 8 4m-14-1 8 4"/>');
 if(kind==='spear')return material(wood,'<path d="m26 101 6 5 70-74-6-6z"/>')+
  material(steel,'<path d="m91 33 34-23-15 36-11-6z"/>')+
  material('#b6b9aa','<path d="m125 10-26 30 11 6z"/>')+
  seams('<path d="m86 36 9 8m-13-3 8 8m-13-3 8 8m-40 34 7 5"/>');
 const knife=kind==='knife';
 return material('#534332',knife?'<path d="m39 98 13 9 29-37-14-10z"/>':'<path d="m29 96 13 10 27-34-14-11z"/>')+
  material(steel,knife?'<path d="m68 63 50-48 2 21-9 21-34 15z"/>':'<path d="m56 66 48-59 23 11-7 18-54 39z"/>')+
  material('#babcae',knife?'<path d="m118 15 2 21-9 21-34 15 6-9 24-12z"/>':'<path d="m127 18-7 18-54 39 8-11 40-34z"/>')+
  material(dark,knife?'<path d="m62 60 7-7 18 14-6 7z"/>':'<path d="m50 63 7-7 18 14-6 7z"/>')+
  seams(knife?'<path d="m49 88 11 8m-6-15 11 8M89 42l15-15"/>':'<path d="m38 91 10 7m-5-14 10 8m-5-15 10 8M86 41l14-16"/>');
};
const cord = material('none','<path d="M106 29c-8-19-69-19-72 4-4 22 70 27 79 6 10-25-54-24-63-10-12 18 36 35 53 17 17-18-28-26-39-14-13 15 24 31 42 29 29-3 22 33-15 39-38 7-69-5-53-23 16-17 60-8 55 7-5 13-44 5-34-3 11-8 69-3 73 17"/>',edge)+
 seams('<path d="m36 27 6 10m10-16 4 10m15-11 2 10m17-8-1 11m15-4-4 10M37 89l7-7m5 13 5-9m12 12 3-10m14 7-2-9m36-6-5 9m15 0-5 8"/>');
const bed = material(wood,'<path d="M26 54h9v43h-9zM118 39h9v58h-9zM38 64h9v40h-9zM137 54h8v38h-8z"/>')+
 material('#676d50','<path d="m27 53 91-23 28 23-101 29z"/><path d="m27 53 18 29 101-29v12L45 92 27 67z"/>')+
 material('#aaa58b','<path d="m94 38 20-5 20 16-25 7z"/>')+seams('<path d="m41 56 61-16m-53 29 59-16m-58 23 14-4m9-3 7-2m-32-9 10-3"/>');
const repairMark = '<g fill="none" stroke="var(--bench-accent,#c99b67)" stroke-width="2"><path d="M125 81v22m-11-11h22"/><path d="m111 77-6 6v18l6 6h28l6-6V83l-6-6z"/></g>';
const drawings:Record<string,string> = {
 bench:table,chest,cord,club:tool('club'),knife:tool('knife'),axe:tool('axe'),spear:tool('spear'),machete:tool('machete'),
 leather:armor(),reinforced:armor(true),pack,'armor-repair':armor()+repairMark,'bench-repair':table+repairMark,repair:bed+repairMark,
 pistol:gun('pistol'),shotgun:gun('shotgun'),rifle:gun('rifle'),spikes,wire,snare,wall:wall(),gate:wall(false,true),fortify:wall(true),
};
const cache = new Map<string,string>();
/** Art depends on recipe output, never inventory state; cached strings avoid work in HUD updates. */
export function recipeArt(recipe:Recipe):string {
 const key = recipe.fortify?'fortify':recipe.trap??(recipe.module?(recipe.module==='bed-gate'?'gate':'wall'):recipe.id);
 const existing=cache.get(key);if(existing)return existing;
 const body=drawings[key];
 const art=body?`<svg class="recipe-art" viewBox="0 0 160 120" fill="none" aria-hidden="true" focusable="false"><g stroke="var(--bench-accent,#c99b67)" stroke-width=".7" opacity=".3"><path d="M8 31V14h17m110 0h17v17M8 89v17h17m110 0h17V89M8 60h7m130 0h7M80 7v7m0 92v7"/><path d="M20 111h120M20 108v6m120-6v6"/></g>${body}</svg>`:
  `<span class="recipe-art recipe-art--item" aria-hidden="true">${recipe.item?itemArt(recipe.item):''}</span>`;
 cache.set(key,art);return art;
}
