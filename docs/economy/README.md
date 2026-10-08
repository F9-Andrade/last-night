# Economia, comerciantes e expedições por seed

Implementação aditiva ao LAST NIGHT. Three.js, Photon, LAN/WebRTC, Supabase e os sistemas de sobrevivência permanecem em uso. Nenhuma migration de banco é necessária: os novos dados usam os campos JSON existentes.

## Jogar

- Vasculhe restos de infectados e recipientes para encontrar moedas. O valor vai para a carteira, separada dos itens/peso da mochila. A carteira aparece no inventário e na negociação.
- Há seis comerciantes: Rute e Lia vendem provisões; Dra. Mara atende no posto de campo; Serrano vende munição e armas modificadas; Bento e Caio negociam materiais. Todos compram itens da mochila.
- Os símbolos dourados `$` no mapa indicam os postos. Aproxime-se do NPC, mire nele e pressione **E**. Comprar e Vender usam o mesmo painel; **Esc** fecha e devolve o controle.
- As armas do armeiro são variantes dos sistemas de raridade e modificadores existentes. São entregues **descarregadas no chão junto ao comprador** e recolhidas com E, preservando a arma que ele já carrega.
- **K** exibe o relógio por cinco segundos. K novamente guarda o relógio. Ele não pausa o jogo nem bloqueia movimento/combate.
- São **600 segundos de dia**, incluindo o aviso e a preparação final, e **600 segundos de noite**. Reforços continuam chegando até o amanhecer. Eliminar uma onda não encerra a noite. O limite de infectados simultâneos continua valendo.

## Balanceamento e autoridade

`src/game/economy.ts` concentra preços, quantidades, carteiras dos NPCs, tipos e posições dos postos. A geração usa uma sequência aleatória própria e não altera o RNG do combate/loot. A primeira vendedora fica a até 105 metros do abrigo. Estoque e caixa são limitados; renovam uma vez por amanhecer. Comprar e revender, inclusive passando pelas receitas existentes, não gera lucro infinito.

`Simulation.trade()` aplica toda a transação após validar distância, linha de visão, estoque, revisão, moedas e espaço. No coop, apenas `CoopWorld` a executa. Mensagens incluem item/quantidade, nunca um preço escolhido pelo cliente. Número de sequência e revisão rejeitam repetições e disputas pelo mesmo estoque. A carteira tem limite inteiro explícito; moedas excedentes ficam no recipiente.

A carteira pessoal, as moedas restantes no saque e os estoques compartilhados viajam nos checkpoints/deltas e nos saves JSON. Saves antigos começam com carteira zero e novos postos sem remover itens antigos. A troca de anfitrião mantém o estado já confirmado. O identificador de build de rede foi atualizado para impedir partidas entre clientes com regras diferentes.

## Cidade

Mundos novos recebem uma disposição determinística de prédios e postos pela seed. Os prédios existentes continuam presentes; portas, interiores, suprimentos, colisões, navegação e mapa acompanham seus lotes. Ruas e o terreno do abrigo permanecem referências estáveis, assim como as construções colocadas pelo jogador. Não se trata de mover a cidade enquanto alguém está jogando.

A versão do layout fica no save. Saves anteriores à geração por seed mantêm a disposição original. `configureWorld(seed, version)` só é chamado durante a abertura do mundo; a cena estática é reconstruída sob a tela de carregamento. A versão e a seed também são transmitidas por Photon/LAN para todos usarem o mesmo mapa. As posições e estoques dos comerciantes salvos prevalecem sobre uma nova geração.

## Apresentação e desempenho

Quatro estilos de postos e NPCs voxel, com caixas, bancadas, toldos e objetos específicos da profissão. Os modelos usam geometria compartilhada, animação sutil e descarte visual por distância de 100 m. Um posto com NPC usa sete draw calls no teste isolado e não cria luzes adicionais. A interface mantém os elementos da lista montados enquanto os valores mudam, evitando perder cliques durante atualizações.

O machado mantém o gume apontado para a frente em primeira e terceira pessoa, com as mãos ancoradas no cabo. A correção não altera dano, alcance ou modelos existentes.

## Validação

Os resultados e limitações finais são registrados em `validation.md`. Testes relevantes: `npm test`, `npm run build`, `npm run test:economy`. A suíte de nuvem usa HTTP Supabase simulado; isso não equivale a validar as policies com duas contas autenticadas no serviço real. O salvamento pessoal e compartilhado preserva o mecanismo anterior de revisões, recuperação local e retentativas; não adiciona uma transação entre tabelas do Supabase.
