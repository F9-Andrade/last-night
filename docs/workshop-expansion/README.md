# Oficina, defesas e expansão de Santa Luz

## Controles e funcionamento

- **Tab → Craft:** somente a receita da mesa inteligente. As demais receitas exigem uma mesa próxima, inclusive corda, porrete e bandagem.
- **Posicionar mesa:** fecha a mochila e mostra uma prévia. WASD e mouse continuam ativos. Mirar mais abaixo/aproximar-se altera o ponto no chão; botão esquerdo confirma, direito ou Esc cancela sem consumir o kit. Colisões, distância da cama, outros jogadores e limite de 12 mesas são validados pelo host.
- **Botão direito mirando na mesa:** abre uma oficina separada. A grade 3 × 3 mostra os ingredientes automaticamente; o catálogo lateral permite selecionar, buscar pelo nome/material, filtrar por categoria e mostrar apenas receitas disponíveis. Não é necessário arrastar ingredientes. Fechar, Tab ou Esc retorna ao jogo. A oficina fecha se o jogador se afastar, morrer ou a mesa for destruída.
- Materiais do depósito só são utilizados dentro do abrigo. Custos, peso, equipamentos já possuídos e limites continuam validados antes de gastar recursos.
- A mesa pode ser consertada (+80 HP por 2 madeiras e 3 sucatas). Recolhimento só funciona quando intacta e com espaço para o kit, impedindo reparo gratuito.
- **1 / 2 / 3 / 4:** arma pesada, leve, branca e punhos. Corrigidos o identificador duplicado e o estilo antigo que ocultava o terceiro slot.
- **Mirar + atirar:** o mouse agora usa `mousedown`/`mouseup` para cada botão. `pointerdown` só reportava o primeiro botão pressionado e perdia o tiro ao segurar a mira.

São 38 receitas ao todo: a mesa na mochila e 37 receitas na oficina.

## Fortificações e armadilhas

Os seis módulos ao redor da cama podem receber dois reforços depois de construídos: 300 → 550 → 900 HP. Cada estágio custa 4 madeiras, 6 tecidos, 8 sucatas e 2 cordas. É necessário reparar o módulo antes de melhorar; não é possível ultrapassar o estágio final. As geometrias ganham tecido, amarrações e chapas. Reparos e HUD respeitam o HP máximo de cada estágio.

O portão gira suavemente pela dobradiça com interpolação independente da taxa de frames. O estado aberto/fechado permanece autoritativo e compartilhado; a animação é local. Não fecha sobre personagens.

Há seis posições de armadilhas ao redor do abrigo:

| Tipo | Posições | Efeito | Custo |
|---|---|---|---|
| Estacas | Frente e traseira | 24 dano por segundo, lentidão breve | 8 madeiras, 4 sucatas |
| Laços | Oeste e leste | 8 dano por segundo, lentidão por 3 s | 3 madeiras, 4 cordas, 3 sucatas |
| Cercas de arame | Oeste e leste | Bloqueiam passagem, 12 dano por segundo | 4 madeiras, 12 sucatas, 2 tecidos |

Armadilhas começam com 200 HP, perdem 5 por acerto e atingem até quatro infectados por intervalo. Não ferem sobreviventes. Mortes preservam ragdoll, saque único e limites de ácido. A colocação usa posições pré-prontas do abrigo, não construção livre pelo mapa.

## Infectados

Os cinco tipos anteriores permanecem. Três novos tipos têm modelos voxel, animações, combate e cadáveres integrados:

- **Blindado:** 185 HP, lento, colete reduz em 50% o dano no tronco. Cabeça e pernas ficam vulneráveis.
- **Caçador:** 82 HP; prepara uma investida por 0,7 s, corre em linha reta até a posição observada e tem recarga de 8 s. Uma bala forte durante a preparação interrompe o ataque. A investida respeita colisões e pode ser evitada lateralmente.
- **Putrefato:** 155 HP; ao morrer deixa ácido com o aviso/tempo de reação e limites já existentes. Saquear imediatamente é perigoso.

Especiais aparecem progressivamente nas hordas e em locais apropriados; o número total de infectados continua limitado. Errantes continuam sendo a maioria. Balanceamento de uma campanha longa ainda exige sessões prolongadas com jogadores.

## Mapa e desempenho

Limite: ±624 m, isto é, **1.248 × 1.248 m**, 16 vezes a área anterior de 312 × 312 m. O centro permanece nas mesmas coordenadas. Foram acrescentados 24 bairros, 72 destinos com interiores, vias, fachadas, carros, cenas de evacuação e pontos de saque. Total: 92 destinos com interiores, 184 portas/janelas interativas, 598 árvores coletáveis e 324 pontos iniciais de loot.

A navegação usa células esparsas de um metro e conectividade em cache, em vez de pré-alocar conexões para toda a cidade. Consultas dos infectados ignoram obstáculos dinâmicos distantes. Renderização conserva culling por bairros/células, batches, geometrias compartilhadas e os presets existentes. Não há aumento do limite simultâneo de infectados.

Árvores intactas não são reenviadas em cada patch. Medição local com quatro jogadores: checkpoint inicial de 137.320 caracteres JSON e patch sem alterações de 6.270 caracteres antes dos ajustes finais de apresentação; tamanhos variam com o estado da partida. Isso não é uma medição de FPS ou de bytes reais transmitidos pelo Photon.

## Coop e correção do transporte

A validação com dois clientes reais revelou que o servidor Photon JSON encerra a conexão quando uma mensagem ultrapassa 50.000 bytes. O transporte agora divide mensagens grandes em fragmentos de até 6.000 unidades UTF-16. A remontagem:

- identifica remetente e mensagem;
- valida quantidade, índice e tamanho;
- tolera ordem diferente e rejeita partes conflitantes;
- limita assemblies simultâneos e expira mensagens incompletas;
- só entrega um checkpoint completo ao parser existente.

O limite total de estado, autenticação por actor/master, cadência de ações e validações de receita permanecem. Build de sala: `santa-luz-workshop-2`, isolando clientes antigos.

## Validação

A suíte local completa passou em **209 testes**, incluindo custos, colocação, proteção, armadilhas, habilidades, acesso aos novos destinos, coordenadas remotas, patches de árvores e fragmentação. A rodada final de `npm run build` (inclui `typecheck`) e `git diff --check` passou.

**Os três cenários de navegador passaram**, em execuções sucessivas de `playwright.crafting.config.ts`:

1. Solo: mochila com apenas a mesa, movimento durante colocação, abertura com botão direito, machado, armadura, coleta em três golpes, punhos, aviso de retorno e tiro com botão direito segurado.
2. Dois clientes Photon reais: criação/entrada na sala, mesa compartilhada, fabricação, coleta sincronizada e migração de host preservando mesa, árvore cortada, fase e HP da cama.
3. Oficina: duas fortificações, estacas, laço, cerca, busca/filtros, atalhos desativados enquanto se digita, portão abrindo, bairros distantes e os três novos infectados. Layouts verificados em 1366×768, 1920×1080 e 2560×1440, além da cena padrão 1600×900.

Nenhum erro JavaScript foi registrado nesses cenários. A automação usa posições/ângulos de fixtures para reproduzir as cenas e botões reais de mouse. Movimentos absolutos artificiais emitidos pelo driver CDP sob Pointer Lock são suprimidos no teste; isso não modifica os controles do jogo. A validação da rotação usa os testes existentes de MouseLook. A animação do portão também possui verificação numérica em 30 e 144 FPS.

As primeiras execuções encontraram e motivaram a correção do limite de mensagens Photon. Também foram corrigidos o slot de arma branca oculto/duplicado, atalhos ao digitar na busca e detalhes de rua desenhados além dos conectores curtos.

Capturas e métricas geradas localmente em `test-results/crafting/`:

- `craft-panel.png`, `fortification-catalog.png`: oficina e catálogo.
- `open-gate.png`, `axe-harvest.png`, `return-beacon.png`: interações.
- `new-infected.png`, `district--468.png`, `district-468.png`: infectados e expansão.
- `coop-migration.png`, `solo.json`, `coop.json`, `expansion.json`: evidências e estado.

Amostras curtas dos bairros novos, qualidade Medium, viewport 1600×900:

| Posição (x, z) | FPS observado | Draw calls | Triângulos |
|---|---:|---:|---:|
| -468, -449 | 60 | 171 | 264.455 |
| 468, 447 | 60 | 178 | 259.847 |

São leituras do contador após 1,5 s em cada ponto, não um benchmark prolongado ou garantia para outro hardware. Não foram medidos tempos separados de CPU/GPU. Campanhas longas, balanceamento de todos os novos bairros e latência extrema ainda exigem playtests prolongados. A grade de receita é automática e as defesas usam posições pré-prontas; não há drag-and-drop de ingredientes nem construção livre de paredes.

Nenhuma dependência ou asset externo foi adicionado. Ícones voxel fornecidos continuam em uso; novos ícones e modelos são código do projeto. Nenhum commit ou push foi realizado.
