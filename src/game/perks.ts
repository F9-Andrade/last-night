export const PERKS={
  steady:{name:'Mãos firmes',icon:'hand',hint:'15% menos recuo e dispersão.'},
  scavenger:{name:'Catador',icon:'ammo',hint:'20% de chance de uma reserva extra de munição por busca.'},
  runner:{name:'Corredor',icon:'stamina',hint:'Corrida 10% mais rápida.'},
  tough:{name:'Casca grossa',icon:'health',hint:'+15 de vida máxima e recuperação imediata de 15.'},
  cold:{name:'Sangue frio',icon:'night',hint:'Cada tiro na cabeça recupera 8 de fôlego.'},
  engineer:{name:'Engenheiro',icon:'scrap',hint:'Reparar barricadas custa só madeira.'},
  pressure:{name:'Sob pressão',icon:'danger',hint:'Recarga 25% mais rápida abaixo de 35% de vida.'},
  last:{name:'Último recurso',icon:'gun',hint:'O último disparo do pente causa 20% mais dano.'},
  medic:{name:'Fôlego novo',icon:'med',hint:'Bandagens também recuperam todo o fôlego.'},
  builder:{name:'Primeiro abrigo',icon:'shelter',hint:'Sua próxima barricada custa 2 madeiras a menos.'},
  opening:{name:'Primeira resposta',icon:'light',hint:'O primeiro headshot após recarregar dobra a reação do alvo.'},
  pack:{name:'Bem preparado',icon:'bag',hint:'+3 kg de capacidade na mochila.'},
} as const;
export type PerkId=keyof typeof PERKS;
export function perkOffer(owned:Set<PerkId>,random:()=>number):PerkId[]{
  const pool=(Object.keys(PERKS) as PerkId[]).filter(id=>!owned.has(id));
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,3);
}
