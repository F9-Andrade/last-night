# LAST NIGHT — identidade, UX e polimento

Auditoria e implementação concluídas em 10/09/2026, sobre o projeto existente. A comparação de referência está em [`docs/identity/before/`](docs/identity/before/); as capturas finais estão em [`docs/identity/`](docs/identity/), com os quadros de tiro/cadáveres preservados em [`docs/combat/`](docs/combat/). Nenhum commit, push, merge ou alteração de histórico foi feito.

## Direção

LAST NIGHT agora usa a linguagem de um equipamento de campo improvisado em Santa Luz: mundo frio e dessaturado, informação em creme, atenção âmbar, vermelho apenas para dano e azul frio na noite. O sol nascendo entre duas travessas virou a marca do jogo; ela aparece no menu, no survivor stamp e no HUD sem depender de texto ou numeral decorativo.

O sistema evita o aspecto de dashboard: painéis têm fundos locais, recortes de etiqueta e separadores curtos; mapa é papel somente quando faz sentido; o inventário é uma bolsa de campo com bolsos e slots. A direção completa, incluindo espaçamento e estados, está em [`docs/identity/DIRECTION.md`](docs/identity/DIRECTION.md).

## Design system

- **Tipografia:** Noto Sans local (regular e black, OFL); corpo 14–16 px, legendas 12 px, títulos black e números grandes com peso alto. A monospace ficou restrita a teclas e métricas de desenvolvimento.
- **Escala:** ritmo 4/8/12/20/32 px, cantos de 2 px, sombra curta e transparente, entrada de 180 ms e saída de 100 ms com `cubic-bezier(.2,.8,.2,1)`. Foco de teclado é visível; `reduce-motion` desliga animações de impacto.
- **Paleta:** fundo `#172729`, superfície `#243633`, creme `#e8dfc8`, secundário `#b9c0ae`, âmbar `#d8ad70`, vida `#b9c49a`, perigo `#bf735f`, noite `#9db8cc`, papel `#c9c4a7`, tinta `#33483e`.
- **Ícones:** conjunto SVG original em [`src/ui/icons.ts`](src/ui/icons.ts), com a mesma espessura e proporção para vida, fôlego, recursos, arma, abrigo, mapa, noite, interação e perigo; nenhum emoji ou biblioteca visual externa.

## Interface e UX

- **HUD:** leve e integrado ao mundo: vitalidade e estado do survivor no canto inferior esquerdo, arma e pente dominantes à direita, arco de ciclo no alto, objetivo transitório, recursos essenciais e minimapa dobrado. O abrigo ganha presença durante a noite.
- **Vida e fôlego:** retrato/emblema, estado textual, barra de vida e borda discreta de baixa vida; fôlego só ganha contraste quando está sendo gasto ou baixo.
- **Arma:** silhueta da pistola, nome/calibre, pente grande, reserva, pips individuais e faixa de recarga. Slots 1/2/3 preparam arma principal, secundária futura e utilidade sem criar botões vazios grandes; slot selecionado tem highlight e som curto.
- **Inventário:** slots com ícones grandes e quantidade, capacidade com barra e peso, detalhe do item selecionado, ações com ícones para guardar/retirar/largar e uso de bandagem. Abrir desliza, escurece o mundo e mantém a expedição ativa; fechar é mais rápido. O depósito só habilita no abrigo.
- **Mapa:** minimapa redesenhado como papel de campo e mapa completo em `M`, com ruas, blocos, abrigo, jogador, regiões e legenda autoral; inimigos não são despejados no mapa. O mapa explicita que o tempo continua correndo.
- **Relógio e objetivos:** arco solar mostra dia, fase e contagem; proximidade do anoitecer muda cor e urgência. Objetivo aparece forte na transição de fase e se aquieta depois; tutorial contextual cobre movimento, loot e cura sem manual permanente.
- **Prompts e feedback:** interação fica junto do objeto projetado, com progresso; barricada informa vida/custo apenas quando próxima; loot e gasto aparecem como recibos compactos ao lado do HUD; dano, munição, abrigo e objetivo usam microanimações de cor, posição e escala.
- **Menu, pausa e fim:** menu principal com o bairro voxel ao fundo, marca própria e três escolhas; pausa com “Respire.”, continuar, configurações, reiniciar e menu; configurações reúnem áudio, imagem, controles, escala, legendas e tela cheia; game over preserva o mundo escurecido e mostra dia, eliminações, tempo, headshots, loot, noites e dano.

## Câmera, combate e áudio

A câmera ficou aproximadamente 11% mais próxima (span 28.5), com antecipação limitada na direção da mira, resposta configurável e shake opcional. A mira tem bloom de movimento/recuo, muda suavemente sobre alvo e mantém contraste. Flashlight `F` usa cone curto e segue a mira. O loop existente de combate foi preservado: headshots, hit reactions, ferimentos, corpos, sangue/decalques e defesa continuam sendo simulados pelos módulos anteriores; o novo HUD torna esses estados legíveis.

O áudio procedural agora tem mixagem persistente para volume geral, música e efeitos, além de sons de UI, seleção, inventário, recarga e eventos. Camadas de música mínima no dia, tensão crescente no crepúsculo, pressão na horda e redução no fim são filtradas pela fase, ameaça próxima e amanhecer. Legendas de eventos podem ser desligadas.

## Mundo e atmosfera

O bairro ampliado, landmarks, sinalização, bloqueios, iluminação, interiores decorativos, grupos de Walker, cadáveres e variações voxel da etapa anterior foram mantidos e recebem a nova leitura de cor. A lanterna reforça a exploração noturna; o mapa e os nomes de região ajudam navegação sem setas constantes. Construção, reparo, dano e destruição continuam com estágios visuais e partículas existentes.

Nesta etapa **não** foram adicionados interiores exploráveis completos, portas/janelas quebráveis, cutaway de telhado, sistema de furtividade, novos tipos de arma, crafting complexo, backend/save online ou uma reescrita de IA. O motivo é preservar as mecânicas autorizadas (loot, inventário, munição, cura, abrigo, barricadas, horda, dia/noite e reset), evitar aumentar o risco de regressão e manter a performance do renderer voxel. A estrutura de slots, a lanterna e a camada de áudio deixam pontos claros para uma próxima fase sem fingir que esses sistemas já existem.

## Performance e validação

O HUD atualiza valores com cache e no máximo a cada 100 ms; abrir mapa/inventário não recria a árvore DOM. Em uma sessão de inspeção `?test`, o estado reportou 525 nós, 86 atualizações e 228 mutações em cerca de seis segundos. No mesmo ambiente Chromium/SwiftShader, o cenário do dia ficou em aproximadamente 56–78 draw calls, 143–146k triângulos, 101 materiais e 11.8 MB de buffers estimados; os valores variam com viewport e composição. Isso não é benchmark de GPU real.

Validações executadas:

- `npm run typecheck` — passou.
- `npm run build` — passou (Vite produção).
- `npm test` — 48 testes de simulação, voxel, sobrevivência e combate passaram.
- Playwright: gameplay (2), sobrevivência (2), visual de combate (3), visual de sobrevivência (1) e a run contínua de exploração/horda (1) passaram isoladamente; o fluxo cobre início, movimento, mira, recarga, loot, cura, pausa, inventário/depósito, construção, reparo, horda, amanhecer, derrotas e reset.
- Inspeção visual em 1920×1080, 1600×900, 1366×768 e 1024×640; capturas finais e auditoria antes/depois ficam em [`docs/identity/`](docs/identity/).

Não há lint configurado no `package.json`; por isso a checagem disponível é typecheck, testes e build. A bateria agregada de 12 E2E também foi executada; sob carga máxima do SwiftShader, duas asserções de movimento de passeio podem oscilar por falta de um frame dentro da janela de 500 ms, enquanto as repetições isoladas e a run completa passaram. O servidor local continua acessível em [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

## Arquivos principais

`src/ui/layout.ts`, `src/ui/hud.ts`, `src/ui/icons.ts`, `src/ui/map.ts`, `src/style.css`, `src/game/settings.ts`, `src/game/audio.ts`, `src/game/simulation.ts`, `src/render/scene.ts`, `src/game/input.ts`, `public/fonts/` e este relatório. Os módulos de mundo voxel, combate, loot, hordas, defesas e navegação existentes foram preservados, com apenas os ajustes de integração necessários.
