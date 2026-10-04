# Abrigo modular

A base deixa de depender de pontos fixos. Fabrique o **martelo de construção** na mesa inteligente com **3 madeiras, 5 sucatas e 1 tecido**. Ao equipá-lo, a barra inferior oferece paredes altas, paredes com janela, portas, pisos, tetos, escadas, estacas, laços e cercas. A seleção dessas peças saiu da mesa; o restante do catálogo permanece disponível.

## Uso

- **E:** abrir mesa/baú, abrir/fechar porta ou inspecionar uma peça.
- **G:** inspecionar qualquer estrutura na mira, inclusive portas.
- **B** ou **Mochila → Equipamento → Martelo de construção:** equipar o martelo já fabricado.
- **1–9 / roda**, com o martelo na mão: escolher peça; os materiais são descontados na confirmação válida.
- **R / botão direito**, com o martelo na mão: girar 90° durante posicionamento.
- **PgUp / PgDn:** mudar o nível da construção.
- **Clique esquerdo:** confirmar. O posicionamento continua para repetir peças.
- **B / 0 / Esc:** guardar o martelo e sair da construção sem consumir materiais da prévia. Fora desse modo, **1–4** voltam a selecionar armas/ferramenta/punhos e o botão direito volta a mirar.
- **R**, ao reposicionar mesa/baú: girar o móvel; **direito / Esc** cancelam, preservando o original.
- **Reposicionar**, no menu do baú ou mesa: mover mantendo ID, inventário e condição.

Os nove slots seguem esta ordem: **1** parede, **2** parede com janela, **3** porta, **4** piso, **5** teto, **6** escada, **7** estacas, **8** laço e **9** cerca de arame. O martelo é uma ferramenta, sem dano de combate ou corte de árvores. Depois de fabricado, pode continuar sendo usado mesmo que a mesa seja recolhida.

A malha é de 3 m, com paredes de 3 m. Construções só cabem no terreno de 12 × 18 m (`x=-5..7`, `z=-8..10`). Níveis selecionáveis: térreo, primeiro e segundo andares. Pisos superiores precisam de apoio, e o teto serve de superfície para o próximo nível. As escadas têm quinze degraus de 20 cm. A abertura acima delas deve ficar livre. Limite: 192 peças, 12 mesas e 24 baús.

Fortificação ocorre junto da peça: madeira estrutural → trama de tecido/corda → blindagem de sucata. A interface mostra materiais, condição, nível e impedimentos. Reparo deve preceder fortificação de uma peça danificada. Desmontagem devolve apenas parte dos materiais e não permite retirar apoios de outras peças/móveis. Destruição por dano remove estruturas que perderam sustentação.

## Implementação

- `src/game/crafting.ts`: receita e propriedade do martelo; o catálogo da mesa não inclui receitas de estruturas.
- `src/game/construction.ts`: malha, limites, apoios, volumes com vãos reais, escadas, colocação, reparo, fortificação e dano. A colocação exige martelo próprio equipado.
- `src/game/relocation.ts`: colocação e movimento atômico de móveis, respeitando piso, alcance, visibilidade e ocupação.
- `src/game/simulation.ts`: locomoção por altura, colisão, proteção da cama, dano em estruturas e armadilhas.
- `src/network/`: novas ações validadas pelo anfitrião, revisões contra pedidos defasados, transferência incremental e migração de anfitrião.
- `src/render/construction-view.ts`: geometria voxel compartilhada, instancing limitado, porta interpolada e grade contextual. Instâncias imóveis não são reenviadas à GPU a cada quadro.
- `src/ui/construction.ts`: barra inferior com nove slots, prévia de custos e gerenciamento da peça. Mesa e baú oferecem reposicionamento; botão direito continua disponível para mirar durante combate.
- `src/ui/variety.ts`: seleção das ferramentas já fabricadas na aba Equipamento da mochila.

A altura é usada na câmera, lanterna, disparo, sombras, cápsulas e marcas de impacto. Coop valida elevação nas escadas; pontos de entrada evitam estruturas já construídas. Um jogador incapacitado permanece no andar correto e não pode ser reanimado através do piso.

## Validação reproduzível

```sh
npm test
npm run typecheck
npm run build
LAST_NIGHT_GPU=1 PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright npm run test:construction
LAST_NIGHT_GPU=1 PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright npx playwright test --config playwright.construction-network.config.ts
```

Validação do martelo em 04/10/2026: **286 testes de lógica passaram**, com **typecheck e build aprovados**. Os quatro testes solo de navegador passaram (fabricação, nove slots, fortificação, movimentação, Escape, retorno aos punhos, baús e escadas). As capturas foram feitas em 1366×768, 1920×1080 e 960×640.

Nos testes ao vivo Photon e LAN, fabricação, construção, fortificação remota, baú cheio e migração passaram até o último passo; a tentativa imediata de guardar o martelo ainda ocorria durante o tempo de troca de equipamento. O teste foi ajustado para aguardar esse tempo. A repetição completa e a captura após o ajuste final de escala/posição do martelo ficaram pendentes: a revisão automática bloqueou a execução de navegador por limite de uso da conta. O build final passou após esses ajustes. [Registro do martelo](hammer-validation.json).

Histórico da construção modular, antes do martelo: **281 testes automatizados passaram**, typecheck e build concluídos. Naquela etapa, os seis testes de navegador passaram: três de construção/escadas/reposicionamento, um de regressão do catálogo da mesa e dois com jogadores reais (Photon e LAN), incluindo troca de anfitrião e retirada de itens após migração. O Vite mantém o aviso de chunks acima de 500 kB. [Registro da validação](validation.json).

Os novos testes cobrem custo único do martelo, fabricação somente na mesa, posse e equipamento obrigatórios, construção sem mesa permanente, bloqueio de ataques/corte de árvores e migração com as sete ferramentas.

Os testes da construção modular cobrem limites da malha, cobrança única, ocupação, janelas/portas, sustentação, subida/descida nas quatro orientações, agachamento em andares, efeitos de dano, baú cheio, pedidos defasados, checkpoints e migração. Na etapa anterior, a interface foi exercitada em 1366×768, 1920×1080 e 960×640. Os testes de rede ao vivo dependem das conexões Photon e da sinalização WebRTC disponíveis no ambiente.

Capturas do fluxo com martelo, anteriores ao último ajuste de escala/posição: [barra 1366](hammer-1366.png), [barra 1920](hammer-1920.png), [barra 960](hammer-960.png). Demais capturas: [catálogo](workshop.png), [posicionamento](placement.png), [fortificação](fortify-1366.png), [andar superior](upper-floor.png), [peças construídas](shelter.png).

Modelos e desenhos são originais em código; usam os materiais voxel existentes e o painel grunge já fornecido. Nenhuma dependência ou asset externo foi adicionado. A IA continua centrada na defesa da cama e no combate no térreo; não ganhou navegação de infectados em andares superiores nesta alteração.
