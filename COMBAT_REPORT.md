# LAST NIGHT — combate, consequências e Santa Luz ampliada

Etapa de 9–10 de setembro de 2026, continuada sobre o projeto existente. Sem commit, push, merge ou tag. O bairro original, abrigo, inventário, loot, barricadas, hordas e ciclo foram mantidos.

## 1. Combate

A pistola mantém pente de 12, cadência de 0,23 s, recarga de 1,35 s e alcance de 26 m. O disparo agora combina recuo do modelo e braços, abertura da mira, traçante, flash muito breve, luz local, ejeção estilizada, partículas e resposta localizada. Não há números de dano nem hit-stop que interrompa a simulação.

## 2. Hit zones

Seis volumes anatômicos orientados com o Walker representam HEAD, TORSO, ARMS e LEGS. A mira isométrica seleciona um ponto tridimensional nesses volumes; o disparo verifica novamente sua trajetória e a primeira obstrução. A seleção não percorre os milhares de triângulos voxel a cada atualização. As hitboxes são aproximações estáveis da anatomia, não colisão exata de cada voxel ou membro em toda pose.

## 3. Cabeça e membros

| Região | Multiplicador | Dano | Tiros contra 90 HP |
|---|---:|---:|---:|
| Cabeça | 3 | 102 | 1 |
| Torso | 1 | 34 | 3 |
| Braços | 0,65 | 22,1 | 5 |
| Pernas | 0,70 | 23,8 | 4 |

Headshots têm hitmarker e som distintos. Pernas aplicam 2,5 s de redução de velocidade a 55%. O stagger dura 0,28 s e reduz o avanço sem reiniciar ou paralisar completamente a IA.

## 4. Reações

Cabeça recua; torso inclina; braço atingido gira lateralmente; pernas produzem desequilíbrio. A direção lateral e o membro controlam a pose. A IA continua usando navegação e separação existentes.

## 5. Sangue

Partículas voxel em vermelho escuro, curtas e direcionadas pelo disparo. O pool visual tem 100 elementos e recicla entradas. Manchas discretas acompanham os corpos, usando instancing. Não há amputação nem gore realista.

## 6. Ferimentos

Até seis marcas por Walker, anexadas ao grupo do membro correspondente. Marcas antigas são substituídas. Geometria e materiais são compartilhados; os objetos de marcas vivas são criados apenas quando necessários. Nos cadáveres, as marcas usam um único InstancedMesh. A localização visual é aproximada por membro, não um decal exato no voxel atingido.

## 7. Morte

HP zero desativa imediatamente IA e ataques, libera a vaga de Walker vivo e transfere posição, aparência, ferimentos e direção para um estado independente de cadáver. Um teste garante que o limite combinado reserva espaço para o corpo antes de permitir o spawn.

## 8. Cadáveres

Queda procedural de aproximadamente 0,85 s, com direção frontal, traseira ou lateral. Três malhas anatômicas mescladas são reutilizadas. É uma animação procedural estável, sem motor de ragdoll ou colisões entre articulações.

## 9. Remoção e limites

30 s de permanência, seguidos de 4 s de fade e pequeno afundamento. Corpos a mais de 65 m passam a envelhecer mais rápido somente depois de 20 s. Limite de 80 estados combinados de vivos/cadáveres e máximo de 40 Walkers ativos; quando faltam vagas, o spawn aguarda e não consome o orçamento da horda. Cadáveres não bloqueiam movimento. As malhas liberadas ficam no pool para reutilização; memória retida pelo pool não é uma fuga de memória.

## 10. Recoil e mira

Arma recua e levanta, braços absorvem parte do movimento e a mira abre gradualmente. Corrida amplia a dispersão. O deslocamento de câmera é pequeno (0,07 unidade) e decai rapidamente. A câmera isométrica e seu enquadramento principal foram preservados.

## 11. Recarga

Arma baixa, mão acompanha, magazine se desloca para fora e retorna; sons marcam retirada, inserção, ferrolho e conclusão. Munição só transfere ao terminar. Correr, iniciar outra ação ou sofrer dano interrompe sem conceder cartuchos ou descontar reserva. O magazine retorna à posição inicial no cancelamento. A animação é estilizada e não distingue um carregador descartado de um segundo objeto novo.

## 12. Áudio

Som procedural local para tiro, última bala, arma vazia, estágios da recarga, carne, concreto, madeira e metal. Pequenas variações de pitch; compressor no master; limite de 16 vozes transitórias. Impactos e ameaças usam pan e atenuação por distância. A arma do jogador permanece central no mix, independentemente da distância do impacto.

Walkers próximos têm gemido/arrasto priorizado, com variação de detecção, ataque e morte. Passos do jogador mudam de ritmo com corrida e de timbre entre grama, asfalto, concreto e madeira. Vento muda com o anoitecer; eventos raros de pássaro/ruído metálico/sirene estilizada ocorrem com intervalo de 20–42 s. Não há propagação acústica por paredes, HRTF nem gravações externas. A validação automatizada confirma os estados/limites; não substitui uma escuta humana em fones para julgar timbre e mix.

## 13. Ruído

Pistola: 30 m. Corrida: 7 m. Busca barulhenta: 20 m. Alarme: 42 m. Memória de investigação: 7 s. Ruído redireciona Walkers já existentes, sem criar inimigos ou iniciar uma cadeia de spawns. Alarmes duram 7 s e cada veículo dispara uma vez por expedição.

## 14. Walkers

Continuam sendo apenas Walker. Preservadas três variantes voxel de aparência, variação de postura, gait e velocidade; adicionadas reações, ferimentos, lentidão, memória de ruído e estado de morte separado. Não foram criadas novas classes. A variedade de roupas permanece limitada às variantes existentes.

## 15. Expansão

Limite jogável passou de ±39 m para ±78 m: quadrado de 156 × 156 m, quatro vezes a área total anterior de 78 × 78 m. A área útil desconta edifícios e obstáculos. Toda a disposição central foi preservada. A navegação passou de 80 × 80 para 158 × 158 células, mantendo conexão cardinal e validação de passagens estreitas.

## 16. Regiões e conteúdo

12 referências regionais no minimapa/nome discreto de localização. Abrigo, mercado, hospital, delegacia e posto permanecem. Expansões: Jardins do Norte, Vila das Acácias, Galeria Santa Luz, triagem externa, praça da evacuação, indústria e manutenção.

18 construções adicionais de escala residencial/comercial, três galpões, 12 veículos adicionais, pátios, tendas, bancos, árvores, containers industriais, pallets e detritos. Ambulância batida, checkpoint, engarrafamento, carrinho tombado e acampamento formam pequenas cenas ambientais. Os edifícios continuam predominantemente fechados; a exploração acontece nas ruas, pátios, entradas e áreas externas.

35 pontos de loot no total, preservando os 15 anteriores. Indústria garante mais materiais; triagem oferece cura; checkpoint oferece munição; caches afastados oferecem reserva selada. Há 14 grupos de encontro, com 2–3 inimigos por local, ativados uma vez por expedição fora da visão próxima. Não é mundo procedural.

## 17. Microeventos

1. Alarme de veículo ao se aproximar: sinal audiovisual e atração de Walkers existentes.
2. Armário/porta barulhenta ao vasculhar: risco de chamar inimigos.
3. Cache escondido: container afastado com recompensa garantida melhor, sem quest ou marcador de loot no minimapa.

## 18. Atmosfera

Neblina e transição de cores preservam a leitura do combate noturno. As três luzes reais de rua são reposicionadas para luminárias próximas; letreiros e outras fontes usam emissivo. Uma luz tem oscilação lenta de intensidade, sem estrobo. Muzzle usa uma única luz curta. A sombra do sol acompanha a região explorada. Vegetação periférica e chão de fundo estendido escondem a borda abrupta observada na primeira inspeção.

## 19. Performance

Medições em Chromium com SwiftShader (renderização por software), qualidade ALTA nos cenários de stress. O FPS observado foi baixo, aproximadamente 3–6; o registro de 40 Walkers marca 3 FPS, contra 12 no registro histórico da etapa anterior. Não há evidência para afirmar 60 FPS ou recomendar qualidade em uma GPU real. A comparação histórica não é um experimento controlado de FPS.

A cena ampliada usa 11,8 MB estimados de geometria, contra 5 MB antes; o cache passou de 4,7 para 7,8 MB. Cena e cache compartilham buffers e não devem ser somados. Um ensaio separado de 1.200 passos com 40 Walkers mediu CPU da simulação: média 0,633 ms, p95 0,922 ms e máximo 15,49 ms. Esse ensaio não mede renderização nem o custo total do navegador.

Árvores, telhados e esquadrias compartilham geometria. Grupos regionais, edifícios e containers distantes são ocultados; manchas e marcas dos corpos usam instancing. Cada corpo acrescenta uma malha, sem rig animado completo. Os tetos anteriores de draw calls e triângulos dos testes foram mantidos; os limites de materiais/geometria foram atualizados para o mundo quatro vezes maior.

## 20. Draw calls

| Cenário | Draw calls | Triângulos | Geometria da cena |
|---|---:|---:|---:|
| 40 vivos, registro histórico anterior | 334 | 148.390 | 5 MB |
| 40 vivos, mundo atual | 338 | 174.198 | 11,8 MB |
| 10 cadáveres | 70 | 151.344 | 11,8 MB |
| 20 cadáveres | 80 | 159.024 | 11,8 MB |
| 40 cadáveres | 100 | 174.384 | 11,8 MB |
| 40 vivos + 40 cadáveres | 380 | 204.918 | 11,8 MB |
| Após limpeza dos cadáveres | 58 | — | 11,8 MB |

No cenário de 40 vivos, o registro atual acrescentou quatro chamadas (+1,2%) ao histórico. Cenários de cadáveres usam outro enquadramento e não devem ser subtraídos diretamente do de 40 vivos. Dados completos em `docs/combat/performance.json` e `docs/combat/loop-metrics.json`.

## 21. Triângulos e memória

O registro de 40 vivos passou de 148.390 para 174.198 triângulos (+17,4%). O cenário combinado chegou a 204.918. O heap observado no cenário combinado foi 45,2 MB; no registro separado de 40 vivos, 77,6 MB. Heap depende de coleta de lixo e momento da amostra, portanto esses valores não constituem uma medição de fuga de memória.

As amostras de 10, 20 e 40 cadáveres mantiveram a geometria estimada em 11,8 MB e o cache em 7,8 MB. O pool retém malhas e materiais após a limpeza para reutilização. O desaparecimento visual não reduz imediatamente a contagem de objetos alocados.

## 22. Populações testadas

Testados 10, 20 e 40 cadáveres; 40 Walkers vivos; 40 vivos simultâneos a 40 corpos; limpeza por tempo e reinício. O pico medido de áudio foi 16 vozes, com retorno a zero vozes transitórias após os efeitos. Os limites de estados, partículas, ferimentos e vozes são explícitos e cobertos por verificações apropriadas.

## 23. Testes de lógica

**48 testes de lógica passaram**: 10 de simulação, 7 de voxel, 16 de sobrevivência e 15 de combate. Incluem anatomia, dano, morte, vida útil, direção de queda, reserva de corpos, ruído, conservação de munição, cancelamento de recarga, alarmes, materiais, acesso aos locais e varredura de movimento até todos os suprimentos. Um teste específico protege a linha de tiro do defensor através das barricadas construídas, mantendo sua colisão de movimento.

## 24. Navegador e inspeção visual

**Build de produção e TypeScript passaram.** Hooks de teste/diagnóstico não aparecem no JavaScript de produção. Os 12 cenários de navegador foram validados entre a execução ampla e as repetições específicas; não se trata de uma única execução integral verde. A execução ampla teve 11 aprovados e uma interrupção por recarga do Vite. Após os últimos ajustes, os três cenários visuais de combate passaram novamente e a expedição foi repetida isoladamente.

Suíte Playwright cobre gameplay, HUD compacto, inventário, defesa, transições, derrota/reinício, orçamento de 40 Walkers, galeria voxel, loop completo, headshot real por mouse, 10/20/40 cadáveres, 40 vivos + 40 corpos, limpeza, visita a oito áreas da expansão e galeria aproximada de reações/recarga/quedas.

A expedição contínua usou qualidade LEVE, teclado e mouse: vasculhou as duas reservas iniciais, a delegacia e o hospital, retornou, construiu o portão, eliminou os 18 inimigos da primeira horda, recebeu a recompensa do amanhecer e entrou na Noite 2 com orçamento de 24 inimigos. A espera ociosa do dia foi abreviada e o combate executado a 2×; não houve injeção de vida, munição, loot ou eliminações. Resultado final: vida 100, abrigo 1000, 22 eliminações, portão com 300 HP e munição 12/104. Os valores finais estão em `docs/combat/loop-playthrough.json`.

A primeira execução que concluiu toda a expedição encontrou um `ENOENT` no encerramento do rastreamento do Playwright. As asserções de gameplay tinham passado e os artefatos finais foram gravados. A confirmação isolada desativou somente esse rastreamento e usou um diretório de saída separado em `/tmp`: **1 teste aprovado em 3,5 minutos, saída 0**, sem erros de console ou exceções da página.

O tour visual usa posicionamento de fixture entre regiões e deslocamento por teclado dentro delas. A varredura de todas as rotas usa a movimentação real da simulação. O playthrough completo usa teclado/mouse, recursos reais e o orçamento normal da primeira horda; acelera espera/combate para validação. Fixtures de stress injetam os alvos e munição para isolar a carga de renderização, não representam uma run normal.

## 25. Bugs encontrados

A validação encontrou regressões reais na linha de tiro através das defesas, posicionamento de encontro, colisões de peças da expansão, finalização de tiros sem alvo, aparência/rotação de corpos e custos de materiais/mira. Também encontrou problemas na automação: recarga durante corrida, passagem junto à quina de uma casa, waypoint sobre um carro, reload do Vite durante teste e falha ao encerrar o trace. As falhas da automação não motivaram mudanças no balanceamento.

## 26. Correções realizadas

- Encontro industrial dentro de uma parede: reposicionado e protegido por teste de acesso.
- Fixture de stress atirava a partir de cercas: corrigida a posição do atirador, sem ignorar colisão de balas.
- Objetos de ferimentos pré-criados violavam o orçamento do rig original: criação sob demanda.
- Árvores e peças repetidas copiavam geometria ao mesclar cada construção: compartilhamento preservado.
- Materiais de uma mesma construção eram clonados por peça: material de fade compartilhado dentro do edifício.
- Mira examinava triângulos detalhados várias vezes por frame: volumes anatômicos analíticos.
- Cadáver reutilizado podia escolher aparência diferente do Walker vivo: seleção pelo slot visual correto.
- Quedas em ângulos intermediários podiam acumular rotações pouco naturais: eixo direcional único com quaternion.
- Barricadas passaram a bloquear todos os tiros do defensor: restaurada a linha de tiro prevista pelo loop original; cercas e prédios estáticos continuam bloqueando tiros.
- Driver da run tentava recarregar correndo: adaptado ao cancelamento de recarga, parando brevemente.
- Impacto distante alterava o corpo do som da arma: tiro central separado da atenuação do impacto.
- Ruído do tiro não entrava no limite de vozes: contabilizado no mesmo limite de 16.
- Containers industriais, placas e borda visual do mundo foram ajustados após inspeção.
- Cargas industriais e monumento da praça ganharam colisão coerente com os volumes visíveis.
- Tiro descendente sem alvo termina no chão; expiração de alcance no ar não cria poeira nem som de impacto fictício.
- O driver usa ruas mais largas e waypoints livres; nenhuma mudança de vida, dano ou recursos para facilitar sua aprovação.
- Reexecução final isolada evita alterações de arquivos durante a run e salva a saída em diretório próprio, sem trace.

## 27. Limitações

O desempenho em renderização por software permanece baixo. Perfil em GPU real e avaliação humana do áudio/game feel continuam pendentes; não são apresentados como validação concluída.

Sem ragdoll articulado, desmembramento, física de pilhas ou balística complexa. Marcas aproximadas por membro. Cadáveres podem se sobrepor. Maioria dos interiores fechada. Caches são pontos autorais e previsíveis entre novas runs. Ruídos ambientais são síntese estilizada, com variedade menor que uma biblioteca de gravações. Não foi feito benchmark em hardware gráfico dedicado nem uma avaliação humana subjetiva de diversão/áudio. A recomendação de qualidade depende desse teste real.

## 28. Arquivos principais

- `src/game/combat.ts`: anatomia, dano e cadáveres.
- `src/game/simulation.ts`: integração, reação, reload, ruído, encontros e eventos.
- `src/game/config.ts`: balanceamento e limites.
- `src/game/districts.ts`, `world.ts`, `loot.ts`: região autoral, navegação e recompensas.
- `src/game/audio.ts`: síntese, posicionamento, ambiência e vozes.
- `src/render/corpses.ts`: renderização/pool dos mortos.
- `src/render/districts.ts`, `town.ts`, `building-assets.ts`: expansão e compartilhamento.
- `src/render/models.ts`, `weapon-assets.ts`, `scene.ts`: poses, magazine e feedback.
- `src/game/input.ts`, `src/ui/hud.ts`, `src/style.css`, `src/main.ts`: mira, HUD e integração.
- `tests/combat.test.ts`, `tests/combat-visual.spec.ts`, `tests/fixtures/combat-gallery.*`: validação nova.

## 29. Controles

WASD move; Shift corre; mouse mira na anatomia; clique/segurar dispara; R recarrega; E interage/vasculha/constrói; segurar E repara; H usa bandagem; Tab abre mochila; X desmonta defesa; Esc pausa. Correr ou sofrer dano cancela a recarga. Qualidade e som continuam disponíveis no HUD/pausa.

## 30. Próxima etapa recomendada

Uma sessão humana em hardware real, focada no mix, leitura de tiros nos membros e ritmo da exploração; depois ajustar densidade e balanceamento com essa evidência. Não iniciar novos sistemas grandes antes disso. Nenhuma próxima fase foi iniciada automaticamente.

## Evidências da entrega

Capturas permanentes em `docs/combat/`: `headshot.png`, `rig-inspection.png`, `corpses-10.png`, `corpses-20.png`, `corpses-40.png`, `night-40-walkers-40-corpses.png`, as oito regiões visitadas e `loop-night-one.png`, `loop-dawn.png`, `loop-night-two.png`. Métricas e estado da run ficam no mesmo diretório. Documentos das etapas anteriores foram preservados como histórico.
