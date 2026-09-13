# LAST NIGHT

**Só preciso sobreviver a mais uma noite.**

Jogo de sobrevivência **3D isométrica com voxel detalhado** para navegador. Explore Santa Luz, vasculhe containers, escolha o que carregar e prepare as defesas do Abrigo 07. A noite termina quando a horda é eliminada. O amanhecer traz recursos, uma escolha de vantagem para a expedição e um próximo dia mais difícil. Há seis armas, loot de equipamento e quatro tipos de infectado especial. Santa Luz tem 312 × 312 unidades, com hospital distante, escola, motel, indústria e quarentena. Veja [o relatório desta etapa](CITY_REPORT.md).

## Executar

Node.js **22.18+** ou **24+**, npm e navegador desktop com **WebGL 2**.

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Abra o endereço do Vite, normalmente **http://localhost:5173**, e clique em **Jogar**. Esse gesto habilita o áudio. O jogo usa modelos, fontes locais e sons gerados localmente, sem packs ou serviços externos durante a partida.

```sh
npm test
npm run build
npm run preview
```

O build fica em `dist/`. Não abra `index.html` diretamente pelo sistema de arquivos.

## Controles

| Entrada | Ação |
| --- | --- |
| WASD | Mover pelos eixos da tela isométrica |
| Shift | Correr, consumindo fôlego |
| Mouse | Mirar |
| Clique esquerdo | Disparar; segure para SMG e rifle de assalto |
| 1 / 2 | Arma longa / arma curta |
| R | Recarregar usando munição da reserva |
| E | Interagir: vasculhar, equipar arma, abrir cache, ativar gerador, desligar alarme ou construir |
| Segurar E | Reparar uma barricada danificada |
| H | Aplicar bandagem |
| Tab | Mochila, armas e vantagens adquiridas |
| M / F | Mapa / lanterna |
| X | Desmontar a barricada próxima e liberar passagem |
| Esc | Fechar mochila; com ela fechada, pausar/retomar |

O inventário permite guardar, retirar e descartar recursos. O depósito só está disponível no pátio do abrigo. **O tempo continua com a mochila aberta.** O botão de pausa pausa diretamente; sair da janela também pausa. A pausa oferece qualidade **ALTA/LEVE**. Som pode ser desativado no canto superior direito.

## Uma expedição

1. Comece no pátio com pistola, 12 cartuchos no pente, 60 de reserva, uma bandagem e poucos materiais. As duas caixas do pátio garantem munição e material para a primeira barricada.
2. Explore: hospital favorece medicina; delegacia favorece munição; mercado, posto, casas e áreas externas oferecem materiais e recursos variados. Os marcadores do minimapa indicam os locais principais, sem revelar todo loot.
3. Vasculhar demora 0,75 s. Itens vão para a mochila; o que não couber permanece no container. Mover, disparar ou sofrer dano interrompe ações. Loot já sorteado não é sorteado novamente.
4. Volte e construa nos três pontos de defesa. A construção usa madeira e sucata da mochila e do depósito. Barricadas bloqueiam jogador e inimigos; desmonte uma se precisar abrir passagem.
5. Há avisos a 60 e 30 segundos do anoitecer, com contagem destacada nos últimos 10. Recarregue e prepare as defesas.
6. Enfrente a horda, distribuída em três grupos com intervalos. Inimigos próximos perseguem você; os demais avançam para o abrigo e atacam barricadas que bloqueiam a rota.
7. Elimine **os inimigos do cerco e os que permanecem perto do abrigo**, depois da chegada do último grupo. Há três segundos de silêncio, recompensa no depósito e escolha de uma entre três vantagens. A escolha pausa a simulação; depois, seguem dez segundos de amanhecer. A noite não acaba simplesmente por um cronômetro.
8. No próximo dia, 20% dos containers vazios do núcleo podem receber uma única reposição reduzida. Os novos POIs não se renovam. A próxima horda traz Corredores. Cuspidor entra na terceira noite e Brutamontes na quarta e Arauto na quinta; Errantes continuam sendo a maioria.

Perder toda a vida ou os 1.000 HP do abrigo encerra a expedição. **TENTAR OUTRA VEZ** reinicia os recursos, interações, containers, inimigos, defesas e ciclo sem atualizar a página.

## A cidade ampliada

Dezoito locais novos têm interiores, móveis e duas entradas. Use **E** na porta ou janela; entradas barricadas demoram mais e fazem barulho. Use **X** perto de uma entrada aberta para barricar com duas madeiras. Vidro quebra com um disparo livre; madeira continua bloqueando a abertura. O depósito de equipamentos, em **Tab → Equipamento**, guarda até quatro armas no abrigo e preserva a munição carregada.

A exaustão não trava a caminhada: sprint consome 22/s, o fôlego volta 18/s após 0,75 s sem corrida, e correr fica bloqueado até recuperar 25%. Segurar Shift retoma a corrida somente depois desse limite.

Guardas dos locais persistem, grupos de dez Errantes atravessam ruas e o Arauto anuncia seu grito antes de atrair infectados já existentes. Há suprimentos médicos, mochilas de sobreviventes, cargas antigas e sinais em uma casa barricada. O mapa registra descobertas; longe da base, o objetivo mostra distância e uma estimativa de retorno. Ela não inclui combate, obstáculos ou tempo de busca: deixe margem.

## Recursos e balanceamento

| Recurso | Função | Carga por unidade |
| --- | --- | ---: |
| Munição leve | Pistola, revólver e SMG | 0,025 |
| Cartuchos | Escopeta | 0,08 |
| Munição de rifle | Assalto e precisão | 0,045 |
| Bandagem | +45 HP após 2,4 s de uso interrompível | 1 |
| Madeira | Construção e reparo de barricadas | 0,5 |
| Sucata | Barricadas e reparo do abrigo | 0,25 |
| Reserva selada | Recuperação de emergência de até 250 HP do abrigo | 1 |

A mochila suporta **16 unidades de carga**. O depósito local não tem esse limite. A reserva selada é usada pelo botão **REFORÇAR ABRIGO**, perto da base. Sem dano no abrigo, ela não é consumida.

| Parâmetro | Padrão |
| --- | --- |
| Dia / aviso de anoitecer / preparação | 210 / 30 / 30 s; 4,5 minutos até a noite |
| Noite | Duração variável: chegada dos grupos + eliminação dos sobreviventes |
| Silêncio / amanhecer | 3 / 10 s |
| Horda 1 / horda 2 | 22 Errantes / 31 infectados, incluindo 2 Corredores |
| Escala | +9 por noite, orçamento limitado a 76; até 40 ativos |
| Intervalo entre grupos | 11 s adicionais |
| Barricada | 6 madeira + 2 sucata; 300 HP; 1,2 s para construir |
| Reparo de barricada | 1 madeira + 1 sucata; até +90 HP em 2 s |
| Reparo do abrigo | 4 sucata; até +120 HP em 3 s, junto à entrada |
| Recompensa | 3 sucata + 1 reserva selada + escolha de perk |

Desmontar devolve ao depósito até metade da madeira, proporcional à integridade; não devolve sucata. Não é possível construir sobre jogador ou inimigo. Custos de ações temporizadas são cobrados na conclusão, depois de validar o estado novamente.

A pistola mantém 34 de dano, pente de 12, intervalo de 0,23 s, recarga de 1,35 s e alcance de 26 unidades. Um Walker tem 90 HP. Seus golpes causam 9 no jogador, 18 na barricada ou 24 no abrigo. Armas e raridades estão em **`src/game/weapons.ts`**, infectados em **`src/game/enemies.ts`** e vantagens em **`src/game/perks.ts`**. Os custos e limites gerais estão em **`src/game/config.ts`**; tabelas ponderadas e pontos de loot ficam em **`src/game/loot.ts`**.

## Arquitetura

**TypeScript + Vite + Three.js**, sem framework adicional. A simulação recebe comandos e emite eventos; não acessa DOM, áudio ou Three.js. O passo fixo de 60 Hz continua sendo usado. Cada partida recebe uma semente nova; a semente 1977 é usada em `?test` para reprodução. Equipamento e eventos têm um fluxo de RNG separado do combate.

| Arquivo | Responsabilidade |
| --- | --- |
| `src/game/weapons.ts`, `enemies.ts`, `perks.ts` | Definições de arsenal, infectados e vantagens |
| `src/game/expedition.ts`, `interiors.ts` | Instalações, eventos e interiores com móveis sólidos |
| `src/ui/variety.ts`, `variety.css` | Slots, comparação, equipamento e escolha de perk |
| `src/render/expedition-view.ts` | Pools de equipamento, instalações, projéteis e ácido |
| `src/game/config.ts` | Durações, custos, capacidade, combate e escala |
| `src/game/cycle.ts` | Controlador explícito de fases, avisos e condição do amanhecer |
| `src/game/horde.ts` | Orçamento, grupos internos e cadência de spawn |
| `src/game/inventory.ts` | Recursos, carga, consumo e transferências |
| `src/game/loot.ts` | Tabelas ponderadas e containers por região |
| `src/game/defenses.ts` | Pontos de defesa, geometria de colisão e estágios de integridade |
| `src/game/simulation.ts` | Integração do loop, ações temporizadas, combate e alvos dos Walkers |
| `src/game/world.ts` | Mapa preservado, colisão, raycasts e A* com máscara dinâmica |
| `src/game/input.ts`, `src/main.ts` | Entradas, pausa, reinício, eventos e integração com a interface |
| `src/game/audio.ts` | Gravações locais, áudio sintetizado e ambiente por fase |
| `src/render/voxel.ts` | Volumes esparsos, greedy meshing e cache de receitas |
| `src/render/survival-assets.ts` | Receitas voxel de recursos, containers e quatro estados das barricadas |
| `src/render/survival-view.ts` | Instâncias persistentes, tampa dos containers, ações e troca de geometria |
| `src/render/scene.ts` | Câmera, luzes, atmosfera e pools de efeitos |
| `src/render/models.ts`, `town.ts`, `*-assets.ts` | Personagens, armas e cidade voxel da etapa anterior |
| `src/ui/hud.ts`, `src/style.css` | HUD, mochila, interações e minimapa |

A navegação usa células de uma unidade para resolver os acessos laterais estreitos, A* com heap e conectividade estática pré-calculada. Máscaras das barricadas são reutilizadas. Construção/destruição invalida os planos dos inimigos; separação usa vizinhanças espaciais. Spawns naturais da horda usam os acessos periféricos do bairro central, a mais de 31 unidades do jogador e fora da câmera com margem.

Voxels continuam sendo dados, **nunca um Mesh por célula**. Faces internas são eliminadas e faces compatíveis são mescladas; geometria, materiais, batching e instancing da cidade foram preservados. Os estados de dano das barricadas são pré-gerados e compartilhados. Detritos usam o pool de partículas existente; não há física por voxel.

## Validação

Esta etapa também consolidou a identidade visual, o HUD e a UX em um passe de produto. A direção, as decisões de interface, as capturas de auditoria e os limites estão em [IDENTITY_REPORT.md](IDENTITY_REPORT.md) e na galeria [docs/identity/](docs/identity/).

```sh
npx playwright install chromium
npm run test:e2e
```

O Playwright inicia/reutiliza o Vite. Testes cobrem simulação, mesher, recursos, ações, navegação, fases, hordas, derrotas, reset e fluxos reais no navegador. As capturas ficam em `test-results/`; rastros de falha ficam em `test-results/traces/`.

O modo **`/?test`** de desenvolvimento expõe estado e preparação de cenários. Permite acelerar a simulação e ajustar fases para testar transições sem aguardar todo o dia. Esses hooks são removidos do build de produção. A expedição automatizada contínua usa teclado e mouse para mover, procurar loot, construir e combater; não injeta vida, munição nem eliminações. O tempo ocioso do dia é abreviado e o combate é acelerado para viabilizar a execução por software.

**FPS do Chromium com SwiftShader não é benchmark de GPU real.** As métricas de geometria estimam buffers, não memória total do navegador.

Consulte [VARIETY_REPORT.md](VARIETY_REPORT.md) para o arsenal, especiais, perks, interiores, testes e limitações atuais. Capturas e medições desta etapa ficam em `docs/variety/`. [COMBAT_REPORT.md](COMBAT_REPORT.md) registra a expansão e o combate da etapa anterior. [SURVIVAL_REPORT.md](SURVIVAL_REPORT.md) registra a etapa anterior do loop. [VOXEL_REPORT.md](VOXEL_REPORT.md) e [VALIDATION.md](VALIDATION.md) registram entregas anteriores e seus valores históricos. Galerias de inspeção em `/tests/fixtures/voxel-gallery.html` e `/tests/fixtures/survival-gallery.html` são exclusivas do desenvolvimento.

## Limites

Desktop, single player, uma região urbana, seis armas e quatro tipos de infectado. Há três interiores pequenos de serviço. Não há salvamento da expedição, backend, contas, multiplayer, crafting complexo, direção de veículos ou progressão permanente. A morte encerra os recursos daquela expedição. Destruição é visual por estágios; não altera voxels individuais com física. Noites posteriores à segunda têm escala limitada, mas ainda exigem testes de balanceamento prolongados.

Próxima etapa recomendada: sessões manuais curtas para calibrar ritmo de exploração, custos e pressão das duas primeiras noites, além de perfil em GPUs reais. Nenhuma nova fase é iniciada automaticamente. Nenhum commit, push ou alteração de histórico foi realizado.

## Combate e Santa Luz ampliada

O mundo jogável tem 156 × 156 m, com o bairro original preservado no centro, 38 pontos de suprimento, além de instalações e eventos e novas áreas residenciais, comerciais, de triagem, evacuação e indústria. Locais distantes oferecem recompensas melhores e pequenos grupos de Walkers. Alarmes e buscas barulhentas podem atrair inimigos existentes.

Mire na anatomia. Com a pistola comum, a cabeça causa 102 de dano, torso 34, braços 22,1 e pernas 23,8. Pernas reduzem a velocidade por 2,5 s. Há até seis ferimentos por Walker. Mortes deixam corpos por 30 s, com remoção gradual em mais 4 s. Cadáveres não bloqueiam caminhos.

A recarga tem magazine e sons sincronizados; correr, sofrer dano ou iniciar outra ação a cancela. A munição transfere no final de cada recarga; a escopeta transfere um cartucho por etapa. O disparo da pistola comum atrai inimigos em 30 m, com ruído próprio para cada arma e modificador; correr atrai em 7 m.

Novos módulos: `src/game/combat.ts` (anatomia e cadáveres), `src/game/districts.ts` (região autoral), `src/render/corpses.ts` (pool visual), `src/render/districts.ts` (cenário), `tests/combat.test.ts` e `tests/combat-visual.spec.ts`. Galeria de inspeção: `/tests/fixtures/combat-gallery.html`.

### Efeitos de áudio fornecidos

Os seis MP3 em `public/audio` foram fornecidos pelo usuário: tiro, gatilho sem munição e recarga da pistola, alarme de carro, vocalização e ataque de zumbi. Compartilham os controles de volume/efeitos e pausa. A recarga acompanha sua duração e cancelamento; o alarme toca em loop enquanto ativo, com distância e direção, e para ao ser desligado. Os originais foram preservados: o player recorta um clique da sequência sem munição e remove o silêncio inicial/final do loop de alarme. As demais armas mantêm seus sons próprios; se um MP3 não carregar, o efeito sintetizado continua disponível.

`zumbisom.mp3` fornece gemidos variados dos Errantes próximos, em trechos separados pelas pausas do original, com uma vocalização por vez. `zumbiataque.mp3` toca nos golpes corpo a corpo contra jogador, barricadas ou abrigo, com até duas vozes simultâneas. Distância e direção afetam ambos; os avisos próprios dos especiais continuam ativos.
