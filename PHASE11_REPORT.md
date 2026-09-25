# LAST NIGHT — Fase 11: apresentação visual

Relatório de 25/09/2026. A etapa mantém a cidade, Three.js, Vite, Photon e a simulação existentes. A referência enviada orienta iluminação, materiais, atmosfera e arma. Conforme a última orientação visual do autor, o mundo recebeu a prioridade; a interface grunge já integrada foi preservada e verificada.

**Estado da validação:** typecheck, build, 168 testes unitários e 20 testes de navegador passaram. Photon real foi validado com 2, 3 e 4 jogadores; a interface compartilhada também passou em qualidade Alta. O roteiro final de captura também passou e usa os sete enquadramentos originais, após todas as correções.

[Comparação visual das sete cenas](docs/phase11/comparison.html) · [Análise inicial e refinamentos](docs/phase11/analysis.md) · [Assets e licenças](PHASE11_ASSETS.md).

## 1. Diferenças visuais iniciais

O estado anterior tinha céu verde uniforme, luz ambiente intensa, pouca separação entre fachadas iluminadas e sombreadas, asfalto sem variação local e arma iluminada de forma independente do horário. A referência combina sol lateral quente, céu nublado, sombras profundas, superfícies gastas e composição urbana mais densa. A cidade existente já possuía veículos e cenas de colapso; o trabalho concentrou-se na forma como essas estruturas recebem luz e nos detalhes próximos ao jogador.

## 2. Iluminação anterior e nova

A luz hemisférica diurna, antes em 1,95 durante a atualização da cena, passa a 0,68. O sol diurno usa intensidade 3,5, cor `#ffd1a0` e direção proporcional a `(-58, 35, 26)`. O resultado é lateral, com sombras que revelam o volume dos blocos. Luz ambiente fria/neutra e chão menos saturado preservam cores reconhecíveis.

## 3. Sombras

O mapa direcional acompanha a região visível do jogador, com centro alinhado aos texels para reduzir instabilidade. A câmera de sombras usa extensão de 42 unidades para cada lado, near 1, far 190, bias −0,00012 e normalBias 0,025. PCFSoft permanece como filtragem. A resolução varia por preset; detalhes minúsculos recebem sombra sem projetar sombras caras de poucos pixels.

## 4. Ambient occlusion

GTAOPass, da versão r180 instalada de Three.js, reforça contatos, cantos, veículos e arquitetura. Alta usa metade da resolução de render e 12 amostras; Ultra usa 75% e 16. Intensidade 0,65, raio 1,05 e denoise moderado evitam contornos excessivos. Céu e decals ficam fora do passe; a arma é composta depois. APIs foram conferidas na documentação oficial e no código da dependência instalada, sem instalar outra engine.

## 5. Tone mapping

AgX substitui ACES Filmic, aplicado por OutputPass depois da composição HDR do mundo e do viewmodel. O renderer mantém saída sRGB. O céu e os materiais iluminados conservam gradação nos highlights; não foi aplicada uma LUT sépia.

## 6. Exposição

`VISUAL.exposure`, em `src/render/visual-config.ts`, centraliza o valor 0,94. Interiores recebem adaptação suave de até +0,10, ao mesmo tempo em que a luz ambiente diminui. A captura do hospital registrou aproximadamente 1,04 depois da adaptação. Não há mudança instantânea de exposição ao cruzar uma porta.

## 7. Color grading

Saturação 0,93 e contraste 1,055, com pequena contribuição fria nas sombras e quente nos highlights. O asfalto foi neutralizado após a primeira revisão, para que a luz produza o calor da cena. O passe mantém verdes oliva, pintura dos edifícios, ferrugem e sangue distinguíveis.

## 8. Atmosfera e fog

FogExp2 com densidade 0,0038 de dia e 0,0068 à noite adiciona perspectiva aérea. As cores transitam entre cinza quente `#9c9690` e azul noturno `#273545`. O alcance do cenário também acompanha o preset. A neblina não pretende ocultar a cidade próxima nem simular nevoeiro denso.

## 9. Céu

Um shader original produz horizonte quente, parte superior mais fria e camadas de nuvens com ruído de quatro oitavas. A esfera acompanha a câmera e a posição aparente do sol segue a luz da cena. As nuvens são estilizadas, sem simulação volumétrica, HDRI ou skybox externo. A cobertura foi refinada após a comparação com a referência.

## 10. Pós-processamento

Pipeline: mundo HDR → GTAO quando habilitado → arma/mãos → bloom discreto → AgX/sRGB → grading e vinheta → FXAA. O render target usa HalfFloat e duas amostras. Bloom tem intensidade 0,13 e threshold 2,8, concentrando-se em emissivos HDR. Vinheta normal 0,14; dano/HP baixo aumentam o efeito de forma contextual. Não foram adicionados film grain ou aberração cromática.

## 11. Materiais

Oito famílias originais — voxel pintado, asfalto, pavimento, reboco, telhado, metal, vidro e terra — recebem variação de cor e resposta de roughness/metalness. A projeção em coordenadas do mundo funciona sobre geometria já agrupada. As cores dos vértices e as formas blocadas permanecem. Um atlas compartilhado evita multiplicar materiais em cada lote estático.

## 12. Estrada

Asfalto cinza mais neutro, remendos, fraturas angulares, granulação e pequenas manchas quebram a uniformidade. Sujeira, papel, pedrinhas e óleo aparecem sobretudo junto a sarjetas e veículos. Os centros das pistas permanecem disponíveis para circulação e combate.

## 13. Calçadas

Juntas e rachaduras no material, detritos pequenos e vegetação nas bordas dão desgaste ao pavimento. Os acréscimos são cosméticos; alturas, colisões, passagens e acesso às portas seguem a cidade existente.

## 14. Paredes e telhados

Reboco recebe manchas, descascados e escorridos. Detalhes geométricos localizados acrescentam umidade na fundação, alvenaria exposta em cantos e lascas de platibanda. Algumas casas receberam acabamentos assimétricos de chaminé e detritos no telhado. O sistema amplia as fachadas existentes, sem reconstruir Santa Luz.

## 15. Metal

Oxidação, variação de roughness e manchas foram adicionadas à família metálica. Na arma, metal, madeira e polímero usam acabamentos compartilhados distintos. O metal do viewmodel foi refinado para roughness 0,52 e metalness 0,22: a primeira versão ficava excessivamente preta sem environment map.

## 16. Vidro

Vidros usam resposta mais lisa e tonalidade própria. Estados existentes de janelas abertas/quebradas foram preservados. O vidro fixo dos veículos continua como geometria opaca estilizada; esta etapa não implementa refração, reflexão em tempo real ou destruição nova.

## 17. Decals

Um pool limitado reproduz marcas de tiro e sangue a partir dos eventos existentes. São duas malhas instanciadas, texturas originais de 64×64, limite de 34/62/96/96 marcas por preset e descarte visual além de 55 unidades. Impactos duram até 55 segundos; sangue, 85, com desaparecimento gradual. Normais dos obstáculos existentes orientam os impactos, sem alterar o raycast autoritativo.

## 18. Sangue

Acertos e mortes podem deixar pequenas manchas vermelho-escuro no chão; roupas e rostos de infectados receberam sangue seco e contraste. As partículas existentes foram mantidas. O sangue novo no mundo é cosmético, limitado e não se transforma em objetos de rede. Marcas de sangue projetadas em paredes ainda não foram adicionadas.

## 19. Vegetação

O passe acrescenta 1.054 pequenos conjuntos de mato ao longo de calçadas, fundações e áreas abandonadas, com instancing por célula. A iluminação lateral dá mais volume às copas existentes. O preset Leve oculta esse mato adicional. Modelos, variedade e posicionamento das árvores anteriores foram preservados.

## 20. Densidade urbana

O conjunto cosmético contém 5.674 peças distribuídas em 98 células de 32 metros. Apenas células próximas ficam visíveis; por exemplo, a captura residencial ativa 15 células e 992 peças. O detalhe concentra-se em bordas e pontos de interesse, sem preencher todas as vias com novos obstáculos ou criar novos veículos bloqueantes.

## 21. Storytelling ambiental

As cenas existentes de evacuação, triagem e abandono recebem papel espalhado, bagagens, lixo e marcas nas proximidades. Óleo acompanha veículos; sujeira e vegetação acompanham fundações e sarjetas. O significado vem da composição, sem texto explicativo novo ou alterações em missões e loot.

## 22. Interiores

O ambiente interno reduz a luz hemisférica em até 42% e atenua o sol recebido pela arma. A pequena adaptação de exposição preserva navegação e leitura. As duas luzes internas existentes recebem cores quentes/neutras ou frias no hospital, intensidade 12 de dia e 18 à noite, com fonte visual correspondente e oscilação sutil.

## 23. Noite

Sol/lua e céu transitam para azul frio, luz direcional 0,35 e ambiente 0,48. A captura E mantém a mesma posição e orientação da residencial diurna. Há também registros do hospital noturno e da lanterna na regressão. A noite continua escura: não foi aumentada globalmente a exposição para fazê-la parecer dia.

## 24. Lanterna

A lanterna continua iluminando materiais e infectados e recebe sombras de 512×512 nos presets Alta/Ultra. Seus parâmetros de alcance e jogabilidade foram preservados nesta etapa visual. A cena da arma recebe uma aproximação sutil do retorno da lanterna. Não foram adicionadas dezenas de luzes com sombra.

## 25. Viewmodel

A cena FPS separada foi mantida e passa a copiar direção, cor e intensidade do sol e da luz hemisférica do mundo. Girar a câmera não gira o sol junto com a arma. A composição ocorre em HDR antes do tone mapping. Respiração, oscilação ao andar e corrida usam amplitudes pequenas; mirar reduz o movimento.

## 26. Armas

A pistola ganhou ferrolho, abertura do cano, miras, serrilhas, área do gatilho, empunhadura e detalhes mecânicos. Armas longas mantêm suas silhuetas, com detalhes adicionais de trilhos e peças. Seis perfis de retorno, inclinação e deslocamento dão personalidade ao recuo visual, sem mudar dano, cadência, munição ou trajetória dos tiros.

## 27. Braços

Braços voxel com punho estreito, luvas de trabalho, nós dos dedos, costuras e dobras blocadas. A paleta de tecido acompanha o mundo. A iluminação é coerente com exterior/interior/noite, mas ainda aproximada: não há transporte de luz global nem amostragem completa de oclusão do cenário sobre as mãos.

## 28. Muzzle flash

Flash voxel HDR reutilizável e uma única luz local iluminam arma e mãos por um intervalo curto. A luz breve no mundo continua ligada ao evento de disparo existente. Efeitos remotos reutilizam os eventos de rede; partículas e luzes individuais não são replicadas. Estojos continuam em pool de 24, com interação visual com a altura do chão.

## 29. Impactos

Concreto, madeira, metal e vidro recebem marcas com cor e tamanho coerentes com o material atingido. Partículas e acertos existentes continuam funcionando. A regressão visual registrou um headshot e dois decals ativos após combate; esse registro verifica o caminho funcional e não demonstra todos os materiais em todas as orientações.

## 30. Infectados

Sombras novas, roupas mais gastas, sangue seco e contraste facial reforçam sua leitura no ambiente. Silhuetas, modelos blocados, número de partes e lógica de IA foram mantidos. Nenhum comportamento de ataque, spawn, HP ou dano foi reequilibrado por motivos visuais.

## 31. HUD

O HUD grunge que já estava integrado antes desta fase foi preservado: vida legível, abrigo, recursos rápidos e carregador destacado com reserva menor. A mira permanece discreta. Não se adicionou moldura permanente de sangue. A prioridade posterior do autor foi o jogo dentro da imagem de referência, não reproduzir toda a interface ao redor.

## 32. Inventário

Painel escuro lateral, seleção vermelha, quantidade, peso, descrição, ações e abas continuam funcionais. O mundo permanece visível atrás da mochila. A regressão verifica abertura/fechamento, saída e retorno do Pointer Lock, seleção, descarte de munição, abas e alcance dos controles em quatro resoluções.

## 33. Background fornecido

`public/ui/distressed-panel.png` é a imagem original fornecida pelo autor, já integrada no painel. O teste verifica seu uso real em `background-image`. Ela não foi substituída por textura procedural. A screenshot de referência não é usada como um falso cenário do jogo.

## 34. Ícones fornecidos

Os seis PNGs originais continuam em `public/ui/items/`: bandagem, sucata, madeira, munição leve, munição de rifle e cartuchos. São assets de imagem; não foram redesenhados em CSS. O mapeamento para os nomes originais está em `public/ui/README.md`.

## 35. Tipografia

Noto Sans local, sob o nome CSS Field Sans, nas variantes regular e black, foi preservada. Peso forte e hierarquia mantêm legibilidade nos painéis escuros. Não foi baixada uma nova fonte condensada nesta etapa; a tipografia não é uma cópia exata da referência.

## 36. Interface coop

Solo e coop utilizam a mesma implementação visual e os mesmos assets de HUD/inventário. A apresentação de jogadores remotos recebe a iluminação da cena. O painel coop grunge existente foi preservado. Os testes reais Photon desta etapa passaram com 2–4 jogadores, incluindo inventário, pausa dos controles, armas remotas e revive. A rodada dedicada à UI coop em Alta passou com dois clientes reais: lobby, mochila, ícones, abas, pausa, configurações e retorno do Pointer Lock.

## 37. Presets de qualidade

| Preset | Limite de DPR | Sombra solar | GTAO | Bloom | Distância | Decals |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| Leve / Low | 1 | Desligada | Desligado | Desligado | 105 | 34 |
| Média / Medium | 1,25 | 1024² | Desligado | Desligado | 125 | 62 |
| Alta / High | 1,5 | 2048² | 50%, 12 amostras | Discreto | 150 | 96 |
| Ultra | 1,75 | 4096² | 75%, 16 amostras | Discreto | 165 | 96 |

O DPR efetivo é o menor entre o do dispositivo e o limite do preset. Raio de detalhes adicionais aproximado: 39/54/70/70 metros. Alta é o alvo visual; Ultra melhora sombra e resolução de AO, sem alterar regras do jogo.

## 38. Performance anterior

Baseline em `docs/phase11/before-high/metrics.json`, com AMD Radeon RX 6650 XT, ANGLE/OpenGL ES 3.2, Chromium de teste, 1600×900, DPR 1 e preset Alta. Cada cena mantém posição, yaw, pitch, seed e fase do dia; são cinco amostras ao vivo após 1,8 segundo de estabilização. CPU usa delta de `Performance.getMetrics().TaskDuration` do CDP por segundo decorrido; inclui trabalho da thread do renderer, não apenas JavaScript do jogo, e exclui GPU. Não há medição de tempo de GPU no baseline.

| Cena | FPS antes | Draw calls antes | Triângulos antes | CPU antes, ms por segundo |
| --- | ---: | ---: | ---: | ---: |
| A — Residencial | 60 | 266 | 400.730 | 394,9 |
| B — Avenida | 60 | 178 | 244.174 | 406,0 |
| C — Interior | 60 | 83 | 136.572 | 402,9 |
| D — Abrigo | 60 | 305 | 414.070 | 408,4 |
| E — Noite | 60 | 282 | 404.838 | 398,8 |
| F — Inventário | 60 | 266 | 400.730 | 192,1 |
| G — Combate | 60 | 204 | 247.166 | 415,1 |

## 39. Performance depois

Mesmo hardware, resolução, DPR, preset e roteiro. Fonte: `docs/phase11/08-optimized-high/metrics.json`. Valores representam médias das cinco amostras. Triângulos e chamadas incluem a repetição de geometria nos passes de sombra/AO: não equivalem à quantidade de polígonos únicos do mundo.

| Cena | FPS depois | Draw calls depois | Triângulos depois | CPU depois, ms por segundo |
| --- | ---: | ---: | ---: | ---: |
| A — Residencial | 60 | 662 | 893.638 | 496,2 |
| B — Avenida | 60 | 466 | 534.864 | 463,9 |
| C — Interior | 60 | 209 | 293.300 | 418,1 |
| D — Abrigo | 60 | 742 | 934.126 | 516,5 |
| E — Noite | 60 | 662 | 893.638 | 478,3 |
| F — Inventário | 60 | 662 | 893.638 | 362,9 |
| G — Combate | 60 | 517,8 | 541.751,6 | 476 |

O teste chegou a 60 FPS nas sete cenas, limitado pelo refresh do navegador. **O custo de renderização e CPU aumentou**; 60 FPS não significa ausência de custo nem garante o mesmo resultado em hardware integrado. Na cena A, geometria contabilizada passou de 26,8 a 36,8 MiB e heap observado de 68,9 a 92,9 MiB; esses valores não são uma medição completa de VRAM.

Uma execução adicional na avenida, também 1600×900 e DPR 1, mediu GPU usando `EXT_disjoint_timer_query_webgl2`, envolvendo o callback principal do frame e lendo o resultado posteriormente, sem bloqueio. Foram 60 amostras válidas por preset e nenhum lote disjoint. Fonte: `docs/phase11/regression/quality-responsiveness.json`.

| Preset | FPS observado | Draw calls | Triângulos | GPU mediana, ms | GPU p95, ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Leve | 60 | 142 | 132.883 | 3,954 | 4,069 |
| Média | 60 | 272 | 311.535 | 3,343 | 4,1 |
| Alta | 60 | 466 | 534.864 | 5,628 | 5,865 |
| Ultra | 60 | 466 | 534.864 | 6,685 | 7,117 |

Essa medição é posterior ao overhaul e não permite calcular um delta de GPU contra o baseline. As capturas em 1920×1080, 1366×768 e 2560×1440 verificam layout e renderização; não constituem benchmarks prolongados nessas resoluções.

## 40. Otimizações

Atlas 1024×512 reúne as oito famílias em um material para lotes estáticos; a família fica codificada por vértice. Texturas originais de 256×256 são geradas uma vez e compartilhadas. Detritos são agrupados por célula, mato usa instancing e o culling limita os detalhes distantes. Foram removidas clonagens desnecessárias de materiais opacos. AO não refaz mapas de sombra durante o passe de normais; arma, estojos e decals reaproveitam recursos. O atlas ocupa cerca de 2,67 MiB com mipmaps; a estimativa total de atlas e oito texturas-fonte criadas é 5,33 MiB, não um tempo de GPU.

## 41. Assets externos

Nenhum novo HDRI, skybox, textura de mundo ou fonte foi baixado para esta etapa. Céu, materiais e marcas foram criados no código do projeto. O background e os seis ícones são os arquivos fornecidos anteriormente pelo autor. Three.js e seus passes são dependências já existentes.

## 42. Licenças

`PHASE11_ASSETS.md` registra origem, autoria, situação de uso e URLs aplicáveis. Os passes Three.js usam MIT; Noto Sans local usa SIL Open Font License. Os arquivos entregues pelo autor são usados no escopo do projeto, sem presumir direitos adicionais. Nenhum asset com marca d'água foi incorporado.

## 43. Screenshots antes/depois

[Abrir as sete comparações lado a lado](docs/phase11/comparison.html). Os arquivos originais ficam em `before-high/` e `08-optimized-high/`, sem pintura ou edição da imagem renderizada. A página também mostra a referência enviada e os valores de câmera. As cenas são A residencial, B avenida, C interior, D abrigo, E noite, F inventário e G combate. Animações e estados controlados permitem repetir enquadramento e fase; partículas e quadros de animação não são garantidos idênticos.

As pastas `01-lighting-high`, `02-ao-shadows-high`, `03-atmosphere-high`, `04-materials-high`, `05-density-high` e `06-viewmodel-high` registram passes intermediários. A segunda revisão corrigiu cinco diferenças relevantes: superfícies ainda lisas, rua excessivamente marrom, metal escuro da arma, desgaste repetitivo e custo excessivo de materiais. Não há uma pasta separada de passe 07 porque a UI grunge já estava integrada; inventário e responsividade estão nas capturas finais e de regressão.

## 44. Bugs e problemas encontrados

Foram identificados custo elevado de múltiplos materiais por lote, importação incompatível com a execução direta de testes TypeScript, assinatura de chamada do passe GTAO incompatível com a tipagem instalada, iluminação fixa da arma e metal demasiado escuro sem environment map. A revisão visual também encontrou excesso de tendência marrom no asfalto e repetições grandes de desgaste. A auditoria final identificou decals que podiam ficar enterrados na superfície visual do chão e recriação desnecessária de recursos de pós-processamento ao alterar configurações sem mudar a resolução; ambos foram corrigidos antes da rodada final de regressão.

## 45. Bugs e problemas corrigidos

O atlas e o compartilhamento reduziram o custo dos materiais; a importação e a assinatura GTAO foram adequadas à infraestrutura instalada. A arma agora recebe luz coerente com o mundo e seu metal foi ajustado. Asfalto foi neutralizado e manchas macro/detalhes locais refinados. A projeção das marcas agora usa um cache espacial das faces horizontais do cenário, evitando manchas enterradas sem mudar o piso da simulação. O passe de AO recebe dimensões já escaladas e configurações sem mudança de resolução/qualidade não recriam seus buffers. Os JSONs das sete cenas e das duas regressões visuais registram `errors: []` para erros JavaScript/console monitorados.

## 46. Regressões e validação

Os registros visuais confirmam troca dos quatro presets, mochila nas quatro resoluções solicitadas, slots/abas/descarte, Pointer Lock, interior diurno/noturno, lanterna, mapa, portas, disparo, headshot, recarga, bandagem, HUD e pause. O registro solo mostra headshots de 0 para 1, carregador com 12 depois da recarga, HP 65 depois da bandagem e Pointer Lock ativo ao final. Evidências: `docs/phase11/regression/quality-responsiveness.json` e `solo-gameplay.json`.

Validação final executada em 25/09/2026:

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado, Vite 7.3.6, 98 módulos.
- `npm test`: 168 testes aprovados, zero falhas.
- `playwright.phase11.config.ts`: 16 testes aprovados em 8,2 minutos, após as correções finais de decals e dimensionamento do AO.
- Áudio fornecido, seis armas, ADS, recarga, headshot, Pointer Lock, menus, movimento, interiores, noite, horda, rádio e gerador verificados.
- Photon real com 2, 3 e 4 clientes: combate compartilhado, disputa por loot sem duplicação, portas, migração do MasterClient com continuidade, downed/revive/bleedout, morte do grupo, arma remota e solo offline aprovados.
- Estresse Photon, qualidade Leve, 960×640 por cliente, quatro clientes na mesma GPU: 60 FPS observados em cada cliente com 10, 25 e 40 infectados; pedidos de 50/100 respeitam o limite existente de 40. Fonte: `docs/phase11/coop/stress-photon.json`.

As duas regressões visuais de presets/responsividade e combate solo passaram novamente após os ajustes finais. O teste de instrumentação confirmou **zero descartes de texturas** ao alterar repetidamente o volume. As quatro resoluções solicitadas foram verificadas com mochila e gameplay. As duas regressões dedicadas à interface também passaram em Alta, incluindo dois clientes Photon, menus, assets, inventário, pausa e configurações. Total: **20 testes de navegador** mais o roteiro de captura comparativa de sete cenas.

O limite transitório do serviço de aprovação foi superado; todas as rodadas adicionais foram executadas individualmente. Não ficaram testes bloqueados por esse motivo. Evidências posteriores às correções: `docs/phase11/regression`, `ui-coop`, `fps`, `coop` e `interiors`. O teste visual adicional também cobre inventário com escala de interface 1,2, em 960×640 e 640×640. Esses tamanhos menores são verificações de layout, não suporte a controles móveis.


## 47. Principais arquivos alterados

| Área | Arquivos |
| --- | --- |
| Direção visual e renderer | `src/render/visual-config.ts`, `scene.ts`, `post-processing.ts`, `cinematic-sky.ts` |
| Materiais e cidade | `src/render/surface-materials.ts`, `facade-weathering.ts`, `environmental-dressing.ts`, `models.ts`, `town.ts`, `city-view.ts`, `urban-view.ts`, `districts.ts` |
| Arma e personagens | `src/render/viewmodel.ts`, `weapon-assets.ts`, `character-assets.ts`, `impact-decals.ts` |
| Presets | `src/game/settings.ts`, `src/main.ts`, `src/ui/layout.ts` |
| Verificação | `tests/visual-overhaul.spec.ts`, `tests/visual-regression.spec.ts`, `tests/fps.test.ts`, configurações Playwright da fase |
| Evidências | `docs/phase11/`, `PHASE11_ASSETS.md`, este relatório |

O diretório de trabalho também contém alterações de fases anteriores. Uma diferença total contra o último commit não corresponde exclusivamente ao trabalho da Fase 11.

## 48. Limitações restantes

A iluminação, os contatos e os materiais se aproximam da direção da referência, mas a composição urbana ainda é mais simples, com ruas mais largas e menos elementos próximos sobrepostos. A paisagem existente foi preservada; não houve uma reconstrução para copiar o enquadramento da imagem. GTAO é um efeito de tela, sem GI, ray tracing, nuvens volumétricas, SSR ou sombras de contato fora do quadro. Vidro permanece estilizado; o viewmodel usa iluminação aproximada e não recebe todas as sombras do mundo. Sangue novo é projetado no chão e não em todas as paredes.

Padrões procedurais ainda podem ser percebidos em áreas extensas. A tipografia preservada não replica exatamente a condensação da referência. O benchmark é curto e foi realizado em uma única GPU dedicada; permanecem necessários testes prolongados em máquinas integradas e em outros navegadores para caracterizar limites de desempenho. As comparações e números documentam o resultado real, sem afirmar equivalência visual completa com a referência ou FPS universal.
