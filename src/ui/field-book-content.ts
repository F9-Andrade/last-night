import { BALANCE } from '../game/config.ts';
import { ITEMS, itemKeys } from '../game/inventory.ts';
import type { Item } from '../game/inventory.ts';
import { FOODS, foodKeys, isFood } from '../game/nutrition.ts';
import { WEAPONS } from '../game/weapons.ts';
import type { WeaponId } from '../game/weapons.ts';
import { ENEMIES } from '../game/enemies.ts';
import type { EnemyKind } from '../game/enemies.ts';
import { MELEE, RECIPES } from '../game/crafting.ts';
import type { MeleeId, Recipe } from '../game/crafting.ts';
import { STRUCTURE_DEFS, LEVEL_HEIGHT } from '../game/construction.ts';
import type { StructureKind } from '../game/construction.ts';
import { MERCHANT_PROFILES, SHOP_CATALOGS, SELL_PRICES } from '../game/economy.ts';
import { CHEST_SLOTS, CHEST_STACK } from '../game/chests.ts';

export type BookKind = 'guide' | 'encyclopedia';
export type BookCategory = 'items' | 'infected' | 'food' | 'weapons' | 'npcs';
export interface BookEntry {
  id: string;
  category: BookCategory;
  title: string;
  kicker: string;
  summary: string;
  paragraphs: string[];
  facts: { label: string; value: string }[];
  /** Existing local artwork. This is an image URL, never HTML. */
  icon?: string;
  tags: string[];
}
export interface GuideChapter {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  paragraphs: string[];
  checklist: string[];
}
export const BOOK_CATEGORIES: { id: BookCategory; label: string }[] = [
  { id: 'items', label: 'Itens e construção' },
  { id: 'infected', label: 'Infectados' },
  { id: 'food', label: 'Alimentos e bebidas' },
  { id: 'weapons', label: 'Armas e ferramentas' },
  { id: 'npcs', label: 'Sobreviventes' },
];

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const cost = (recipe: Pick<Recipe, 'cost'>) => Object.entries(recipe.cost).map(([id, amount]) => `${amount} × ${ITEMS[id as Item].label}`).join(' · ');
const recipeFor = (id: string) => RECIPES.find(recipe => recipe.id === id)!;
const recipeCost = (id: string) => cost(recipeFor(id));
const daylight = (BALANCE.cycle.day + BALANCE.cycle.dusk + BALANCE.cycle.preparation) / 60;
const night = BALANCE.cycle.night / 60;

/** Field notes describe the actual game. Reading does not unlock or consume items. */
export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: 'purpose', kicker: '01 / Sua missão', title: 'Só mais uma noite.',
    summary: 'Explore Santa Luz, sustente seu sobrevivente e proteja a cama do abrigo até o amanhecer.',
    paragraphs: [
      'A cidade caiu. O seu objetivo é resistir às noites e preparar uma base capaz de suportar a próxima horda. A cama é o coração do abrigo: perder sua resistência encerra a defesa.',
      'Durante o dia, transforme cada saída em uma decisão: buscar munição, recolher materiais, negociar ou voltar com o que já conseguiu. Sobreviver hoje só vale a pena se houver recursos para amanhã.',
    ],
    checklist: ['Reconheça o terreno ao redor da cama.', 'Separe materiais, água, comida e munição.', 'Volte com tempo para reparar e defender.'],
  },
  {
    id: 'first-expedition', kicker: '02 / Primeiros passos', title: 'Saia com um plano.',
    summary: 'Uma mochila organizada e uma rota de volta valem mais que uma expedição longa demais.',
    paragraphs: [
      `A mochila começa com ${number(BALANCE.inventory.capacity)} kg de capacidade. Abra com Tab, confira a reserva da arma e guarde espaço para madeira, sucata e tecido. Moedas ficam na carteira e não ocupam peso.`,
      'Aproxime-se dos pontos de saque e use E. Infectados mortos também deixam restos aproveitáveis. Observe a rua antes de saquear; o tempo gasto junto a um corpo pode ser suficiente para outro inimigo alcançar você.',
    ],
    checklist: ['Use M para consultar o mapa.', 'Recarregue com R antes de entrar em perigo.', 'Mantenha uma saída livre; correr também gasta recursos.'],
  },
  {
    id: 'workbench', kicker: '03 / Oficina de campo', title: 'Comece pela mesa.',
    summary: 'A mesa inteligente transforma sucata de sobrevivência em equipamento de verdade.',
    paragraphs: [
      `Na aba Craft da mochila, fabrique o kit da mesa inteligente: ${recipeCost('bench')}. Posicione-o em um chão livre; depois mire na mesa e pressione E para abrir as receitas.`,
      `Na mesa, fabrique ferramentas, proteção, munição e um baú de ${CHEST_SLOTS} espaços. O baú precisa ser colocado no chão e aberto com E. Ele aceita pilhas de até ${CHEST_STACK} unidades e também guarda armas.`,
    ],
    checklist: ['Deixe espaço para circular ao redor da mesa.', 'Fabrique o martelo para começar a construção.', 'Use baús para organizar reservas e equipamento.'],
  },
  {
    id: 'building', kicker: '04 / Um lugar para resistir', title: 'Construa ao redor da cama.',
    summary: 'Erga paredes altas, deixe passagem e crie posições de defesa dentro do terreno do abrigo.',
    paragraphs: [
      `Fabrique o martelo na mesa (${recipeCost('hammer')}) e equipe-o para entrar no modo de construção. Escolha uma peça nos slots, alinhe o encaixe e confirme apenas quando o local estiver válido.`,
      `Paredes têm ${number(LEVEL_HEIGHT)} metros de altura. Janelas permitem observar e disparar; portas abrem com E. Pisos, tetos e escadas precisam de apoio e passagem livre. Aproxime-se de uma estrutura e use G para gerenciar, reparar ou fortificar com os materiais pedidos.`,
    ],
    checklist: ['Construa somente dentro do terreno permitido.', 'Reserve a abertura acima das escadas.', 'Fortifique pontos frágeis e mantenha uma rota de fuga.'],
  },
  {
    id: 'survival', kicker: '05 / Corpo e suprimentos', title: 'Fome não espera.',
    summary: 'Comida, água, vida e fôlego são reservas diferentes. Cuide de todas.',
    paragraphs: [
      'Consuma alimentos e bebidas pela mochila quando estiver em segurança. Conservas e ração sustentam, mas algumas aumentam a sede. Água potável é a opção mais eficiente para hidratar; alimentos não curam ferimentos.',
      `H aplica uma bandagem: ${BALANCE.interaction.healAmount} de vida em ${number(BALANCE.interaction.heal)} segundos. Movimento, disparos ou dano interrompem o tratamento. Correr acelera o consumo de saciedade e hidratação; passar fome ou sede prejudica a recuperação de fôlego e pode causar dano.`,
    ],
    checklist: ['Leve água junto de alimentos salgados.', 'Procure cobertura antes de comer ou se tratar.', 'Observe a durabilidade da proteção de couro.'],
  },
  {
    id: 'night', kicker: '06 / A última luz', title: 'A horda não é o relógio.',
    summary: `${number(daylight)} minutos de luz. ${number(night)} minutos de noite. Resista até o tempo acabar.`,
    paragraphs: [
      'Pressione O para consultar o relógio e o tempo até a próxima mudança. Nos últimos 30 segundos antes da noite, o aviso de retorno marca o abrigo e a distância até ele. Use esse tempo para fechar acessos, reparar a cama e preparar as armas.',
      'Derrubar os inimigos presentes não faz o sol nascer: novas ondas continuam chegando até o fim da noite. Controle munição e distância, observe ameaças especiais e evite abandonar o abrigo durante a pressão da horda.',
    ],
    checklist: ['Repare a cama antes de a defesa entrar em colapso.', 'Use armadilhas, janelas e cobertura a seu favor.', 'Ao amanhecer, reabasteça e prepare a noite seguinte.'],
  },
  {
    id: 'trade', kicker: '07 / Gente que restou', title: 'Nem tudo precisa ser saqueado.',
    summary: 'Encontre os sobreviventes de Santa Luz. Materiais esquecidos podem pagar sua próxima expedição.',
    paragraphs: [
      'Moedas aparecem em saques e restos de infectados. Comerciantes compram itens da mochila e oferecem provisões, materiais ou armamentos. Aproxime-se e interaja para conferir o estoque e o preço antes de confirmar.',
      'Estoque e dinheiro dos comerciantes são limitados e renovam ao amanhecer. Armas compradas são entregues descarregadas no chão, junto de você. Recolha a arma e prepare a munição correta antes de seguir.',
    ],
    checklist: ['Venda o excedente sem comprometer a defesa.', 'Procure Serrano para armas modificadas.', 'Os postos mudam conforme o mundo; explore para encontrá-los.'],
  },
  {
    id: 'coop', kicker: '08 / Ninguém fica para trás', title: 'Dividam o trabalho.',
    summary: 'Solo, Photon ou LAN: a sobrevivência continua sendo a mesma. Em grupo, cada reserva ajuda.',
    paragraphs: [
      'No coop, conversem antes de gastar os materiais compartilhados no mundo. Uma pessoa pode buscar provisões enquanto outra prepara a defesa. Protejam companheiros caídos e usem a interação indicada na tela para ajudar.',
      'Em mundos vinculados à conta, cada participante tem seu próprio progresso de jogador e o mundo conserva o estado compartilhado. Ao sair, espere a confirmação de salvamento. Se o anfitrião sair, a sessão fecha para quem não recebeu permissão de continuar; essa autorização é concedida pelo dono.',
    ],
    checklist: ['Confiram comida e munição antes de sair juntos.', 'Acompanhem as mensagens de salvamento.', 'Usem os livros em local seguro: no coop, o mundo continua.'],
  },
];

const itemIcons: Partial<Record<Item, string>> = {
  ammo: '/ui/items/ammo.png', rifleAmmo: '/ui/items/rifle-ammo.png', shells: '/ui/items/shells.png',
  med: '/ui/items/bandage.png', wood: '/ui/items/wood.png', scrap: '/ui/items/scrap.png',
};
const itemNotes: Partial<Record<Item, string[]>> = {
  bench: ['É a primeira receita disponível na mochila. Após fabricar o kit, posicione-o em uma área livre e abra a mesa com E.', 'A mesa reúne as receitas de ferramentas, munição, equipamentos e manutenção. Deixe espaço para alcançá-la sem atravessar uma parede.'],
  chest: [`O baú guarda ${CHEST_SLOTS} espaços de itens e armas. Pilhas do mesmo item podem chegar a ${CHEST_STACK} unidades.`, 'Fabrique na mesa, posicione no chão e use E para abrir. É possível reposicionar o baú pelo gerenciamento, preservando o conteúdo.'],
  hide: ['Os restos dos infectados fornecem pele aproveitável. Recolha quando a área estiver segura.', 'A mesa usa esse material para fabricar e remendar proteção, reforçar a mochila e criar ferramentas.'],
  cloth: ['Retalhos são úteis para bandagens, cordas e equipamentos. Guarde uma reserva mesmo quando a mochila parecer cheia de materiais mais valiosos.', 'Tecido também entra na fortificação das estruturas do abrigo.'],
  cord: ['Corda é fabricada com tecido na mesa inteligente. Ela conecta materiais simples a ferramentas e construções mais elaboradas.', 'Separe algumas unidades antes de planejar escadas, armadilhas ou proteção.'],
  ammo: ['Abastece pistola, revólver e submetralhadora. A arma usa a reserva correta automaticamente ao recarregar com R.', 'Fabricar munição consome sucata e reserva selada. Rajadas longas podem esgotar o mesmo estoque que sustentaria sua pistola por uma expedição inteira.'],
  shells: ['Cartuchos são usados pela escopeta. A recarga insere um cartucho de cada vez.', 'Funcionam melhor quando você deixa o alvo se aproximar de uma posição controlada, preservando uma saída segura.'],
  rifleAmmo: ['Abastece os rifles de assalto e de precisão. Não substitui munição leve.', 'É uma reserva valiosa para alvos difíceis e ameaças distantes. Confira a quantidade antes de depender de um rifle como única defesa.'],
  med: ['Bandagens recuperam vida; elas não substituem comida nem água. Use H ou a ação correspondente na mochila.', 'Procure cobertura: mover, disparar ou sofrer dano cancela a aplicação.'],
  wood: ['Madeira serve para ferramentas, mesa, baús, paredes, pisos e reparos. Pode ser saqueada ou obtida atacando árvores.', 'Punhos cortam lentamente; o machado é mais eficiente. Madeira que não cabe na mochila fica no chão.'],
  scrap: ['Sucata é um dos materiais mais versáteis da cidade. Repare, fabrique ferramentas, prepare munição e fortaleça o abrigo.', 'Moedas ajudam a comprar material em falta, mas gastar toda a sucata pode deixar a cama sem reparo na hora crítica.'],
  rare: ['Reserva selada é um recurso raro usado em fabricação de munição e armas. Não é alimento.', `No abrigo, também permite uma recuperação de emergência de ${BALANCE.base.rareRepair} de resistência da base. Decida entre preparar equipamento e conservar uma reserva de defesa.`],
};

function items(): BookEntry[] {
  return itemKeys.filter(id => !isFood(id)).map(id => {
    const item = ITEMS[id], recipe = RECIPES.find(r => r.item === id);
    const facts = [{ label: 'Peso por unidade', value: `${number(item.weight)} kg` }, { label: 'Venda por unidade', value: `${SELL_PRICES[id]} moedas` }];
    if (recipe) facts.push({ label: 'Fabricação', value: cost(recipe) });
    if (id === 'med') facts.push({ label: 'Tratamento', value: `+${BALANCE.interaction.healAmount} vida / ${number(BALANCE.interaction.heal)} s` });
    return { id: `item-${id}`, category: 'items', title: item.label, kicker: 'Suprimentos de campo', summary: item.hint, paragraphs: itemNotes[id] ?? [item.hint], facts, icon: itemIcons[id], tags: [id, 'mochila', 'materiais', recipe ? 'craft' : 'saque'] };
  });
}

const infectedNotes: Record<EnemyKind, string[]> = {
  walker: ['É a ameaça mais comum de Santa Luz. Sozinho, dá tempo de observar e escolher o disparo; em grupo, fecha rotas e pressiona a base.', 'Mantenha espaço para recuar. Não deixe uma coleta demorada terminar com sua saída bloqueada.'],
  runner: ['O corredor encurta distância muito mais rápido que o errante. A preparação do ataque é sua oportunidade de reposicionamento.', 'Evite recarregar exposto e preserve fôlego para romper o contato. Um grupo misto exige atenção aos alvos rápidos.'],
  tank: ['O brutamontes combina muita resistência com golpes fortes contra sobreviventes e estruturas. Sua aproximação lenta não torna a defesa segura.', 'Use o tempo de preparação do golpe para sair do alcance. Priorize tiros precisos e não concentre toda a proteção em uma única peça.'],
  spitter: ['O cuspidor prepara um ataque de ácido à distância. A poça continua perigosa depois do impacto.', 'Interrompa o preparo quando possível e saia da área marcada pelo ácido. Cobertura e movimento lateral ajudam a evitar o ataque.'],
  screamer: ['O arauto prepara um grito que alerta os infectados próximos. Deixá-lo chamar atenção pode transformar um encontro pequeno em perseguição.', 'Priorize o alvo durante a preparação do grito. Um impacto suficiente ou um tiro na cabeça pode interrompê-lo.'],
  armored: ['O colete reduz o dano de tiros no tronco. Atirar repetidamente na região protegida desperdiça a reserva.', 'Procure a cabeça ou as pernas e mantenha distância. A proteção não cobre todas as zonas de impacto.'],
  stalker: ['O caçador prepara uma investida e avança pela trajetória escolhida. Ficar parado na linha de ataque é a pior resposta.', 'Desloque-se para o lado ou interrompa o preparo. Evite corredores apertados quando não houver espaço para esquiva.'],
  bloater: ['O putrefato libera ácido ao morrer. Derrubá-lo perto dos pés pode trocar uma ameaça por outra.', 'Elimine à distância e espere a área ficar segura antes de saquear os restos. Proteja a rota usada para voltar ao abrigo.'],
};

function infected(): BookEntry[] {
  return (Object.keys(ENEMIES) as EnemyKind[]).map(id => {
    const enemy = ENEMIES[id];
    return { id: `infected-${id}`, category: 'infected', title: enemy.name, kicker: 'Registro de ameaça', summary: enemy.hint, paragraphs: infectedNotes[id], facts: [
      { label: 'Vida de referência', value: `${enemy.hp} HP` },
      { label: 'Movimento de referência', value: `${number(enemy.speed)} m/s` },
      { label: 'Dano corpo a corpo', value: `${enemy.damage}` },
      { label: 'Dano contra a cama', value: `${enemy.baseDamage}` },
    ], tags: [id, 'zumbi', 'inimigo', enemy.name, 'combate'] };
  });
}

function foods(): BookEntry[] {
  return foodKeys.map(id => {
    const food = FOODS[id], signed = (n: number) => `${n > 0 ? '+' : ''}${number(n)}`;
    return { id: `food-${id}`, category: 'food', title: food.label, kicker: food.kind === 'drink' ? 'Bebida lacrada' : 'Provisão de longa duração', summary: food.hint,
      paragraphs: [food.kind === 'drink' ? 'Beba pela mochila enquanto estiver em segurança. A hidratação ajuda a manter o fôlego nas expedições.' : 'Consuma pela mochila enquanto estiver em segurança. Alimento recupera saciedade, mas não cura ferimentos.', food.thirst < 0 ? 'Esta provisão aumenta a sede. Leve água para acompanhar e evite consumi-la com a hidratação já crítica.' : 'Confira os indicadores antes de consumir: o excedente além da capacidade do sobrevivente não fica reservado para depois.'],
      facts: [{ label: 'Saciedade', value: signed(food.hunger) }, { label: 'Hidratação', value: signed(food.thirst) }, { label: 'Consumo', value: `${number(food.duration)} s` }, { label: 'Peso', value: `${number(food.weight)} kg` }], icon: `/ui/items/food-${id}.svg`, tags: [id, 'comida', 'alimento', food.kind === 'drink' ? 'bebida' : 'comer', 'fome', 'sede'] };
  });
}

function firearms(): BookEntry[] {
  return (Object.keys(WEAPONS) as WeaponId[]).map(id => {
    const weapon = WEAPONS[id];
    return { id: `weapon-${id}`, category: 'weapons', title: weapon.name, kicker: weapon.slot === 1 ? 'Armamento leve' : 'Armamento pesado', summary: weapon.hint,
      paragraphs: ['Os valores desta ficha são do modelo básico. Raridade, modificadores e a zona atingida podem alterar o resultado de um disparo.', weapon.reloadStyle === 'shell' ? 'Recarrega um cartucho por vez. De perto, vários chumbos podem atingir o mesmo alvo; a dispersão e a perda de dano reduzem a eficiência à distância.' : weapon.automatic ? 'Dispara continuamente enquanto o gatilho estiver pressionado. Use rajadas curtas para controlar dispersão e economizar munição.' : 'Cada acionamento do gatilho produz um disparo. Controle a cadência e aproveite o tempo entre tiros para reencontrar o alvo.'],
      facts: [{ label: weapon.pellets > 1 ? 'Dano por chumbo' : 'Dano básico', value: `${number(weapon.damage)}${weapon.pellets > 1 ? ` × ${weapon.pellets} chumbos` : ''}` }, { label: 'Carregador', value: `${weapon.magazine} disparos` }, { label: 'Munição', value: ITEMS[weapon.ammo].label }, { label: 'Alcance máximo', value: `${weapon.range} m` }, { label: weapon.reloadStyle === 'shell' ? 'Recarga por cartucho' : 'Recarga básica', value: `${number(weapon.reload)} s` }],
      tags: [id, 'arma', 'tiro', weapon.automatic ? 'automática' : 'semiautomática', ITEMS[weapon.ammo].label] };
  });
}

const meleeNotes: Record<MeleeId, string[]> = {
  fists: ['Sempre disponíveis, mesmo sem arma equipada. São uma última defesa e permitem coletar madeira atacando árvores.', 'O alcance curto exige cuidado. Economize fôlego para sair do contato antes que o grupo feche a distância.'],
  club: ['Ferramenta simples de fabricar, mas com recuperação lenta entre ataques.', 'Use contra alvos isolados e evite trocar golpes cercado. Também consegue danificar árvores.'],
  knife: ['A faca prioriza velocidade e exige proximidade. Seu pequeno alcance deixa pouca margem para erro.', 'Ataque quando houver espaço para recuar. O baixo custo por golpe não elimina o risco de gastar todo o fôlego.'],
  axe: ['O machado combina impacto forte com corte eficiente de árvores. É útil tanto na preparação do abrigo quanto em combate.', 'Cada ataque exige mais fôlego e tempo. Prepare o golpe com distância, sem ficar exposto entre dois inimigos.'],
  spear: ['A lança oferece o maior alcance entre as armas corpo a corpo disponíveis.', 'Aproveite a distância em vez de avançar até encostar no infectado. Preserve espaço atrás de você para reposicionar.'],
  machete: ['O facão equilibra impacto e velocidade, mas exige materiais mais valiosos para fabricar.', 'É uma opção de combate próximo para quando a munição precisa ser preservada. Continue atento ao fôlego.'],
  hammer: ['Equipe o martelo para abrir a seleção de construções do abrigo. Paredes, janelas, portas, pisos, tetos e escadas usam encaixes no terreno.', 'É uma ferramenta de construção: não causa dano nem corta árvores. Troque de equipamento quando precisar se defender.'],
};
function melee(): BookEntry[] {
  return (Object.keys(MELEE) as MeleeId[]).map(id => {
    const tool = MELEE[id], recipe = RECIPES.find(r => r.melee === id), facts = id === 'hammer' ? [{ label: 'Uso', value: 'Modo de construção' }] : [
      { label: 'Dano básico', value: `${tool.damage}` }, { label: 'Alcance', value: `${number(tool.reach)} m` },
      { label: 'Fôlego por golpe', value: `${tool.stamina}` }, { label: 'Intervalo entre golpes', value: `${number(tool.cooldown)} s` },
    ];
    if (recipe) facts.push({ label: 'Fabricação na mesa', value: cost(recipe) });
    return { id: `melee-${id}`, category: 'weapons', title: tool.name, kicker: id === 'hammer' ? 'Ferramenta de construção' : 'Corpo a corpo', summary: id === 'fists' ? 'Sem equipamento, ainda há uma forma de lutar e recolher madeira.' : recipe?.hint ?? tool.name, paragraphs: meleeNotes[id], facts, tags: [id, 'corpo a corpo', 'ferramenta', 'craft', 'madeira'] };
  });
}

function structures(): BookEntry[] {
  return (Object.keys(STRUCTURE_DEFS) as StructureKind[]).map(id => {
    const piece = STRUCTURE_DEFS[id], trap = ['spikes', 'snare', 'wire'].includes(id);
    return { id: `structure-${id}`, category: 'items', title: piece.name, kicker: trap ? 'Defesa do terreno' : 'Construção modular', summary: piece.hint,
      paragraphs: [trap ? 'Posicione com o martelo dentro do terreno do abrigo. Armadilhas ajudam a conter a pressão, mas também precisam de manutenção.' : 'Equipe o martelo e escolha a peça na seleção de construção. O encaixe precisa estar dentro do terreno, desocupado e apoiado quando necessário.', 'Aproxime-se e use G para gerenciar a peça. Repare os danos e confira os materiais exigidos antes de fortificar.'],
      facts: [{ label: 'Resistência inicial', value: `${piece.maxHP} HP` }, { label: 'Materiais', value: cost(piece) }, { label: 'Ferramenta', value: MELEE.hammer.name }], tags: [id, 'construção', 'abrigo', 'base', 'martelo', trap ? 'armadilha' : 'estrutura'] };
  });
}

function equipment(): BookEntry[] {
  return ['leather', 'reinforced', 'pack'].map(id => {
    const recipe = recipeFor(id);
    return { id: `gear-${id}`, category: 'items', title: recipe.name, kicker: 'Equipamento do sobrevivente', summary: recipe.hint,
      paragraphs: id === 'pack' ? ['O reforço aumenta a capacidade de carga do sobrevivente e só pode ser fabricado uma vez por personagem.', 'Mais espaço facilita expedições, mas não substitui organização. Deixe as reservas que não precisa carregar em um baú.'] : ['A proteção absorve parte do dano enquanto tiver durabilidade. Ela não torna o sobrevivente imune a ferimentos.', 'Use a receita de remendo na mesa para recuperar a armadura. Preserve pele e tecido para a manutenção.'],
      facts: [{ label: 'Fabricação', value: cost(recipe) }, { label: 'Estação', value: ITEMS.bench.label }], tags: [id, 'equipamento', id === 'pack' ? 'mochila' : 'armadura', 'couro', 'craft'] };
  });
}

function survivors(): BookEntry[] {
  return MERCHANT_PROFILES.map(npc => ({ id: `npc-${npc.id}`, category: 'npcs', title: npc.name, kicker: npc.title, summary: npc.hint,
    paragraphs: [npc.kind === 'gunsmith' ? 'Recupera armas modificadas e vende munições. Armas compradas aparecem descarregadas no chão, junto de você: recolha e prepare o equipamento antes de sair.' : npc.kind === 'medic' ? 'Mantém um estoque de bandagens, tecido, água e conservas. Os suprimentos ajudam no tratamento; conversar com a médica não cura automaticamente.' : npc.kind === 'salvage' ? 'Negocia peças para construção, manutenção e equipamento. É uma alternativa quando falta material para concluir a defesa.' : 'Negocia comida, água e suprimentos básicos. Uma parada antes da expedição pode evitar uma volta forçada pela fome.', 'O posto é definido pelo mundo e pode estar em outro lugar numa nova expedição. Estoque e caixa são limitados; a reposição acontece ao amanhecer.'],
    facts: [{ label: 'Ofertas', value: SHOP_CATALOGS[npc.kind].map(offer => offer.name).join(' · ') }, { label: 'Caixa de referência', value: `${npc.budget} moedas` }, { label: 'Troca', value: 'Compra itens da mochila' }], tags: [npc.id, 'npc', 'comerciante', 'troca', 'moedas', npc.kind] }));
}

export const BOOK_ENTRIES: BookEntry[] = [
  ...items(),
  { id: 'item-coins', category: 'items', title: 'Moedas', kicker: 'O que ainda tem valor', summary: 'Dinheiro recuperado entre ruínas e restos de infectados. Não pesa na mochila.', paragraphs: ['Recolha moedas durante o saque ou venda itens aos comerciantes. A carteira é separada do estoque de materiais.', 'Confira preços e estoque antes de comprar. Cada comerciante tem um caixa limitado para pagar pelos seus itens.'], facts: [{ label: 'Peso', value: '0 kg' }, { label: 'Destino', value: 'Carteira do sobrevivente' }, { label: 'Uso', value: 'Comprar e vender com NPCs' }], tags: ['dinheiro', 'moeda', 'carteira', 'comércio', 'npc'] },
  ...equipment(), ...structures(), ...infected(), ...foods(), ...firearms(), ...melee(), ...survivors(),
];
