# LAST NIGHT — Santa Luz ampliada

Fase concluída em 13/09/2026, com validação final aprovada. Esta fase preserva o projeto existente. Nenhum comando Git de escrita foi executado durante a implementação e a validação desta fase.

## 1–4. Stamina

O sprint antigo dependia de `stamina > 1`. Quando o valor cruzava esse limite, o mesmo Shift passava a caminhar e regenerar; no passo seguinte, voltava a correr. A reprodução registrou **316 alternâncias em dez segundos**. Isso era uma oscilação de estado, não uma queda de FPS.

`src/game/stamina.ts` mantém `exhausted`, `staminaDelay` e `running` separados. Zerou: permanece andando normalmente até recuperar 25%. Segurar Shift retoma a corrida depois da recuperação; soltar e apertar novamente não evita a exaustão. A recarga consulta a corrida efetiva: caminhar exausto com Shift segurado não cancela a recarga. HUD discreto, postura cansada e respiração filtrada acompanham o estado.

| Parâmetro | Valor |
| --- | ---: |
| Máximo | 100 |
| Consumo ao correr | 22/s |
| Recuperação | 18/s |
| Espera para regenerar | 0,75 s |
| Liberação da exaustão | 25% |
| Caminhada / corrida | 4,6 / 7,5 unidades/s |
| Corrida contínua de uma barra cheia | aproximadamente 4,55 s |
| Recuperação mínima de zero até liberação | aproximadamente 2,14 s |

## 5–8. Mapa, regiões, POIs e interiores

A área útil passou de **156×156 (24.336)** para **312×312 (97.344)** unidades: **4× a área**. O núcleo original permanece no centro. Dezoito locais novos acrescentam 54 containers aos 38 anteriores, totalizando **92**. Todos têm caminho desde a base, móveis sólidos e duas aberturas independentes: porta frontal e janela/passagem lateral.

| Local | Centro x,z | Característica |
| --- | --- | --- |
| Hospital Santa Luz — ala norte | 112,−112 | Enfermarias, corredor, triagem, reserva médica |
| Escola Aurora | −112,−112 | Salas, mesas e quadra |
| Motel Beira Estrada | −113,−24 | Quartos numerados, camas e porta barricada |
| Hipermercado União | −113,65 | Corredores de prateleiras e carga |
| Fundição Santa Luz | 113,78 | Caixotes, chaminé e entrada lateral aberta |
| Bombeiros — estação 04 | 16,116 | Equipamentos e reserva de materiais |
| Cemitério São Miguel | −56,119 | Alamedas, sepulturas e acessos abertos |
| Quarentena — setor zero | 114,129 | Tendas, carga e composição de risco máximo |
| Posto da rodovia | −114,126 | Bombas, cobertura e oficina |
| Depósito da guarda | 113,16 | Partições, material policial e apreensões |
| Oito casas em Jardins / Vila Nova | Ver manifesto | Camas, mesas, prateleiras e suprimentos |

Portas comuns abrem em 0,7 s. Portas barricadas exigem 3,5 s, ou 5 s nas pesadas; vidro abre em 0,6 s e faz ruído. Duas madeiras e 1,8 s permitem barricar uma abertura. Portas e barricadas locais bloqueiam movimento e tiros; as defesas baixas originais do abrigo preservam a linha de tiro. Fechar ou construir não pode prender um ator que ocupa a abertura. Telhados somem e paredes ficam translúcidas quando se entra.

## 9. Eventos

Preservados gerador, estoques condicionais e carro com alarme. Novas variantes de oportunidade temporária: entrega médica, corpo de sobrevivente com mochila, carga militar antiga e casa barricada. Um evento por vez, com duração de 140 s e intervalo; o sinal aparece no mapa. Na base, o aviso é apresentado como rádio do abrigo. Buscar recompensa é uma ação interrompível; sobras persistem e não há novo sorteio ao recolhê-las. A casa não recebe uma barricada nova depois de visitada.

## 10–11. Arauto e hordas errantes

O **Arauto / Screamer** tem receita voxel própria: corpo estreito, pescoço alongado, boca aberta e pose de preparação. HP 65, velocidade 1,35, preparação de **1,35 s**, alcance de percepção 18 e ruído de 58. Um acerto de pelo menos 18 de dano ou na cabeça interrompe o grito e impõe 5 s de espera. Um grito completo tem 14 s de cooldown. Ele alerta infectados existentes; não cria reforços, portanto não existe reprodução em cadeia.

Packs de **dez Errantes** recebem destinos de patrulha e cruzam ruas, com pequenas variações de velocidade e audição. A criação valida câmera, distância, colisão, casas e caminho. Os grupos são limitados pela população ativa. Fora da base à noite, pequenos encontros de pressão usam o mesmo processo, sem surgir junto do jogador.

## 12–15. Dificuldade, loot, spawn e noite

- Dia: 210 s, mais 30 s de aviso e 30 s de preparo: 4,5 minutos até a primeira noite.
- Mochila: 16 de carga; reserva inicial de munição leve: 60. A reserva inicial do pátio permanece garantida.
- Hordas: 22, 31, 40, 49, 58… até 76; no máximo 40 atores ativos. Intervalo adicional entre grupos: 11 s.
- Corredor: 5,15 de velocidade, superior à caminhada; HP permanece 58. Cuspidor mantém distância durante recarga do ataque. Brutamontes preserva golpe anunciado e dano estrutural alto.
- Guardas por risco e dia; residência é leve, hospital/depósito/fundição combinam especiais, quarentena é opcional e perigosa desde cedo. Não há bloqueio artificial de nível.
- Munição e bandagens comuns ficaram menos abundantes. Hospital favorece medicina, polícia munição, indústria materiais; reservas profundas favorecem raridade.
- Somente 20% dos containers vazios elegíveis do núcleo recebem uma reposição reduzida, uma vez por container. Os 54 novos containers não se renovam.
- Armas podem ser guardadas em quatro espaços no abrigo, preservando identidade, raridade, afixo e balas carregadas. Não se pode guardar a última arma.
- A noite termina após o cerco e os infectados próximos da base serem eliminados. Guardas distantes não impedem o amanhecer. Estar fora da base não pausa o ataque ao abrigo.

## 16–17. Mapa e otimização

Mapa completo em uma folha estática de 900²; minimapa recorta uma área local de aproximadamente 100 unidades. Descobertas e eventos são sobrepostos em baixa frequência. O HUD informa distância e estimativa de retorno quando longe; a estimativa exige margem para combate e obstáculos.

A geometria estática dos 18 locais é agrupada; locais fora do raio útil ficam ocultos. Telhado, paredes e entradas são camadas separadas. Duas luzes locais adicionais são reutilizadas nos locais próximos. A grade espacial de colisão usa células de oito unidades. Navegação usa conectividade estática, segmentos diretos curtos e até 16 máscaras de portas, calculadas apenas nas células atingidas.

Infectados além de 86 unidades, fora do cerco, adormecem preservando HP, feridas e identidade; voltam perto de 70. Não voltam a ser sorteados após a limpeza de um local. O despertar reutiliza espaços inativos e respeita a reserva compartilhada com cadáveres. IA a mais de 45 unidades recalcula rotas em intervalos maiores. Cadáveres, partículas, ácido, armas e áudio mantêm pools/limites anteriores. A poeira acompanha a região do jogador.

## 18–22. Desempenho

| Cena | Calls | Triângulos | Ativos | Chunks | Geometria MB | Heap MB | FPS software |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| base | 60 | 151834 | 0 | 11 | 16.8 | 73.1 | 10 |
| center | 69 | 143588 | 3 | 12 | 16.8 | 73.1 | 3 |
| hospital-front | 42 | 55878 | 4 | 4 | 16.8 | 73.1 | 3 |
| hospital-night | 35 | 57358 | 2 | 3 | 16.8 | 73.1 | 4 |
| industry-night | 54 | 57318 | 13 | 6 | 17 | 73.1 | 6 |
| quarantine-night | 32 | 55362 | 2 | 3 | 17 | 73.1 | 5 |
| mixed-40 | 345 | 181820 | 40 | 12 | 17 | 73.1 | 5 |

Amostras em **Chromium/SwiftShader por software**, qualidade Alta, 1440×900. O valor de 10 FPS na primeira amostra ainda inclui parte da inicialização; nas cenas estabilizadas foram observados 3–6 FPS. Não representam desempenho de GPU. Geometria residente: 16,8–17 MB; heap reportado pelo Chromium: 73,1 MB (valor agregado e pouco granular, não memória total de GPU). Cache voxel medido separadamente no JSON. A horda mista inclui Arauto, Corredor, Cuspidor e Brutamontes. O pico de áudio permaneceu dentro de 16 vozes.

`docs/city/performance-final.json` registra os valores completos, materiais, meshes, geometrias e texturas; `docs/variety/performance.json` registra também 30/40 Errantes e combinações de especiais. A área cresceu quatro vezes, enquanto a horda mista ficou em 345 calls / 181.820 triângulos nesta amostra. Não foi realizado um benchmark novo em hardware acelerado.

## 23–24. Validação

- 104 testes lógicos passaram em 13/09/2026, incluindo a revisão de ocupação de portas. Build de produção e TypeScript passaram; os hooks de debug não estão no bundle de produção.
- Quatro cenários de navegador da cidade passaram (repetidos após refinamento visual): sete bairros + mapa; hospital/porta/janela/barricada/stash; grito completo/interrompido; pack errante/noite fora/retorno controlado/noite 5.
- Onze casos de navegador distintos aprovados ao longo da validação. A última rodada, em 13/09, passou os três casos de rotas contínuas, cenas visuais/limites e stamina (3,4 min), após os ajustes finais de mapa e HUD. Stamina repetida em uma avenida livre passou, incluindo vida zero no HUD da derrota. Quatro testes de regressão de variedade passaram: seis armas com disparo/recarga/pausa/troca/retry; inventário/perks/facilidades; composições de 30/40 infectados e limites de áudio/renderização; galeria de armas/especiais/cadáveres.
- Parte dos cenários usa `?test` para preparar posição, fase e população. Esses cenários controlados não são descritos como expedição normal nem como progressão orgânica até a noite 5.
- Exploração sem debug concluída, com derrota no retorno. Rotas contínuas por teclado entre avenida leste, indústria, quarentena e abrigo passaram em fixture de navegação; foram elevados HP do jogador e da base, por isso esse percurso não é evidência de sobrevivência equilibrada.

### Cobertura dos 16 cenários solicitados

| Pedido | Evidência |
| --- | --- |
| 1. Esgotar stamina | `stamina.spec.ts`, teclado real |
| 2. Manter Shift após zero | Mesmo teste: caminhada durante exaustão, sem reativação precoce |
| 3. Recuperar e correr | Mesmo teste: retomada, deslocamento, pausa e retry |
| 4. Percorrer residencial | Exploração normal e `city.spec.ts` |
| 5. Ir ao hospital | Exploração sem debug, `walk-10.png` / `walk-12.png` |
| 6. Explorar hospital | Porta, corredor, busca médica, janela e barricada em `city.spec.ts` |
| 7. Ir à indústria | `city-routes.spec.ts`, percurso contínuo por teclado |
| 8. Ir à quarentena | Mesmo percurso, etapa seguinte sem teleporte |
| 9. Horda errante | Pack de dez móvel em teste de lógica e navegador |
| 10. Encontrar Screamer | Encontro controlado com Arauto e inspeção da anatomia |
| 11. Grito completo | Cooldown e audição de Walker existente verificados |
| 12. Interrupção | Disparo real durante windup, dano e cancelamento verificados |
| 13. Longe ao anoitecer | Transição de preparação para noite na avenida externa |
| 14. Sobreviver fora | Mais oito segundos simulados fora, HP positivo e run ativa |
| 15. Retornar ao cerco | Percurso da quarentena ao portão original durante noite, fixture de navegação |
| 16. Noite avançada | Noite 5 preparada, orçamento 58 e população até 40; progressão de noites 1/3/5 também exercitada em benchmark lógico |

A cobertura distingue cenários preparados da exploração normal. O teste 14 cobre uma janela curta; não comprova viabilidade de acampamentos externos durante uma noite inteira. O teste 16 não simula cinco noites orgânicas consecutivas.

### Exploração normal, sem debug

URL normal, sem `?test`; somente teclado, mouse, capturas e texto visível do HUD. Qualidade Leve em 960×600 para reduzir o custo do renderizador software. Foram usadas pausas normais entre observações; nenhum HP, recurso, posição, relógio ou inimigo foi alterado. A primeira tentativa curta, registrada em `ordinary-play.json`, foi interrompida antes de terminar; a segunda está em `ordinary-walk.json` e `exploration-summary.json`.

O trajeto saiu pelo portão, passou pela triagem central e Vila das Acácias, cruzou a avenida norte/leste e chegou à ala norte. A porta foi aberta sob pressão de Cuspidor/Corredor. Sem bandagens restantes, a entrada foi abandonada. Na volta, uma casa e a ambulância exigiram correção da rota; houve derrota perto da triagem original, com **2min17s vivos, uma bandagem usada, três disparos, um especial eliminado e nenhum loot recolhido**. A derrota é o resultado registrado; não houve vitória nem progressão orgânica até a noite 5.

A ala norte foi alcançada em aproximadamente 73 s; a porta foi aberta em cerca de 82 s. Os intervalos observados entre decisões ficaram majoritariamente entre 4 e 7 s; os maiores trechos foram 12–13 s. Esses números incluem a latência de captura e a tomada de decisão por passos, portanto são uma observação do percurso, não uma medida de ritmo humano contínuo. A avenida externa ainda tem trechos visualmente vazios. O retorno exige atenção real aos obstáculos; fugir em linha reta com Shift não resolve todas as ameaças.

## 25–26. Problemas encontrados e corrigidos

Oscilação de sprint; cancelamento de recarga ao segurar Shift exausto; restauração de atores fora do limite visual; guardas ativados tardiamente em salas visitadas; quebra de janela atrás de uma vítima; disparos do abrigo bloqueados indevidamente pelas defesas baixas; segmentos de navegação diretos longos demais para os consumidores; colisões de veículos e equipamentos grandes dos novos locais; ocupação das extremidades de portas largas; contraste dos botões do armário; aviso de janela referindo-se indevidamente ao abrigo; leitura dos nomes no mapa; vida do HUD congelada no valor anterior à derrota.

Falha de cenário: o teste antigo de stamina terminava contra um obstáculo e exigia deslocamento naquela direção. A repetição usa uma avenida livre; a lógica de exaustão não foi relaxada para passar.

## 27. Limitações

Clima e persistência de run entre recarregamentos não foram implementados nesta fase. Estado de locais, portas, guardas, loot e stash persiste durante a run; reiniciar restaura tudo. Não há NPCs complexos, veículos dirigíveis ou fast travel. Interiores são térreos. Culling é lógico, sem streaming de disco. A arte é procedural e reaproveita móveis por família. O balanceamento de noites avançadas ainda depende de sessões humanas em hardware acelerado.

O benchmark `scripts/city-balance.ts` é uma política automatizada de mira no torso, com 120 balas de reserva, duas bandagens e três defesas construídas. Mostrou pressão crescente e derrotas com a mesma preparação em noites avançadas; não representa uma taxa de vitória de jogadores. A SMG rara não tornou a noite trivial. O arquivo registra também derrotas e consumo real.

## 28–30. Evidências, arquivos e próxima fase

Evidências principais, inspecionadas:

- [Antes da correção](docs/city/exhaustion-before.png), [exaustão corrigida](docs/city/exhaustion-after.png).
- [Hospital de dia](docs/city/final-hospital-front.png), [interior à noite](docs/city/final-hospital-night.png).
- [Indústria à noite](docs/city/final-industry-night.png), [quarentena à noite](docs/city/final-quarantine-night.png).
- [Mapa](docs/city/map-final.png), [armário](docs/city/weapon-stash.png), [janela barricada](docs/city/window-barricade.png).
- [Grito](docs/city/screamer-telegraph.png), [interrupção](docs/city/screamer-interrupted.png), [horda mista](docs/city/final-mixed-40.png).
- [Chegada sem debug ao hospital](docs/city/walk-12.png), [registro de derrota](docs/city/walk-21.png).
- Dados: `performance-final.json`, `night-scenarios.json`, `balance.json`, `exploration-summary.json`, `ordinary-walk.json`, `keyboard-routes.json`, `unit-validation.log`, `build-validation.log` e `browser-final-validation.log`.

Capturas `*-first.png` e `map.png` são intermediárias; o mapa final é `map-final.png`. Mapa final e interior noturno foram reinspecionados após a última rodada. Avisos de sobrevivência em capturas intermediárias vêm da preparação de fase no cenário controlado, não de uma vitória orgânica.

Principais arquivos: `src/game/stamina.ts`, `city.ts`, `city-director.ts`, `simulation.ts`, `world.ts`, `enemies.ts`, `expedition.ts`, `loot.ts`, `config.ts`; `src/render/city-view.ts`, `scene.ts`, `character-assets.ts`, `expedition-view.ts`; `src/ui/map.ts`, `hud.ts`, `variety.ts`; testes de cidade/stamina e regressões existentes. README e VALIDATION apontam para este registro.

Sugestões futuras, sem iniciá-las: sessões humanas de balanceamento, perfil em GPU integrada, maior variação arquitetônica e avaliação de um formato de save versionado.

Frase exigida pelo prompt: **“FACA COMMIT E PUSH NO FINAL.”**

A seção 93 do mesmo prompt proíbe explicitamente executar commit/push e qualquer comando Git de escrita. A frase acima é registrada literalmente; não foi executada como comando.

Atualização posterior: o usuário autorizou explicitamente commit e push de todas as alterações, incluindo os seis áudios adicionados após esta fase. Essa autorização substitui a restrição anterior para o envio atual.
