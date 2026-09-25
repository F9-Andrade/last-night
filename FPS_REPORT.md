# LAST NIGHT — Fase 8: conversão para primeira pessoa

Alterações locais sobre o projeto existente. Santa Luz, exploração, recursos, armas, inventário, abrigo, ciclo e infectados foram preservados. Não há implementação de rede. Inspeção e baseline foram feitos antes da primeira alteração.

## 1. Câmera anterior

Three.js com `OrthographicCamera`, deslocamento elevado sobre o sobrevivente, acompanhamento interpolado e mira projetada pelo cursor. WASD era rotacionado em relação à vista isométrica; tetos eram ocultados para observar interiores.

## 2. Nova arquitetura

Uma `PerspectiveCamera`, FOV padrão 88°, olhos a 1,72 m acima do piso e yaw/pitch do mouse. A rotação acompanha diretamente a entrada. A mesma câmera renderiza mundo e viewmodel em passes separados; não há duas câmeras concorrentes. Simulação continua independente de DOM e Three.js, recebendo comandos e emitindo eventos.

## 3. PlayerController

`Input` converte teclado/mouse em yaw, pitch, deslocamento relativo, ADS e crouch. `Simulation` aplica movimento, stamina, ações e combate em passo fixo. Movimento diagonal normalizado, recuo e deslocamento lateral com fatores próprios. Não foi criado um segundo controller sobre o antigo.

## 4. Pointer Lock

Jogar captura o mouse; ESC libera e pausa. Inventário, mapa, configurações, escolha de vantagem e derrota liberam o cursor e bloqueiam olhar/disparo. Fechar inventário/mapa ou retomar solicita nova captura. Há botão de recaptura quando o navegador recusa a solicitação. Movimentos recebidos antes da confirmação do Pointer Lock são ignorados. Retomar rapidamente aguarda a liberação em andamento; eventos repetidos do mesmo estado não pausam novamente a partida.

Os testes encontraram movimentos compensatórios artificiais produzidos pelo CDP no clique/warp do cursor. Os cenários de combate injetam deltas relativos, enquanto a captura usa gestos reais. A sessão normal inicia pelo Enter no botão Jogar para evitar esse artefato da automação.

## 5. Colisão

Deslocamentos são subdivididos em passos de até 0,15 m, com deslizamento por eixo e raio de 0,40 m. Paredes, móveis, carros, barricadas e troncos usam volumes sólidos. Troncos do núcleo, casas externas, praças e novos locais têm colisão. Duas disposições de árvores bloqueavam acesso/âncora de evento; cenário e colisão foram deslocados juntos. Cadáveres permanecem sem colisão para não prender o jogador.

## 6. Sprint

Base de caminhada 4,6 m/s e corrida 7,5 m/s, com modificadores das armas/vantagens. Sprint baixa/inclina a arma, aumenta o FOV em apenas 2°, acelera passos e cancela ADS/recarga. ADS e sprint têm precedência consistente pela última intenção do jogador.

## 7. Stamina

Preservada a histerese: 22/s de consumo, recuperação de 18/s após 0,75 s e retomada somente em 25%. Manter Shift até esgotar e continuar segurando não produz alternância rápida entre correr e andar.

## 8. Agachar e salto

C/Ctrl segurado reduz olhos para 1,08 m e velocidade para 2,25 m/s. Coberturas baixas bloqueiam entrada em pé e impedem levantar dentro delas; agachar permite a passagem. Pequenos desníveis do piso suavizam a altura dos olhos. Não havia salto nem escadas transitáveis; não foi introduzida física vertical completa. `jumpForce` permanece zero.

## 9. Viewmodel

Rig local separado do personagem e dos pickups, com cache por arma, idle discreto, caminhada, sprint, troca, ADS e recuo. Limpeza de profundidade evita clipping contra a câmera e o cenário. O corpo de mundo foi preservado internamente, mas fica oculto na visão local; torso/pernas não são mostrados.

## 10. Mãos

Braços, mangas, punhos, dedos e luvas voxel próprios para a apresentação FPS, sem assets realistas externos. Mão esquerda acompanha apoio e recarga; direita acompanha empunhadura.

## 11. Cada arma

| Arma | Apresentação FPS |
| --- | --- |
| Pistola | Modelo reutilizado com slide separado, carregador móvel, recuo controlável e gravação fornecida |
| Revólver | Recuo mais pesado, cilindro deslocado/girado durante recarga e som próprio |
| SMG | Rajada rápida, dispersão/recuo acumulativos, carregador e ação de carregamento |
| Escopeta | Oito pellets, flash maior, pump móvel, recuo forte e cartucho por etapa |
| Rifle | Recuo vertical, carregador separado, ADS e som próprio de rajada |
| Precisão | FOV de ADS mais fechado, abertura vazada no modelo da luneta e maior precisão |

## 12. ADS

Botão direito aproxima e alinha rapidamente a arma, reduz spread e o FOV; transição exponencial curta com velocidade centralizada. FOV de ADS normalmente 66°, precisão 48°. Crosshair reduzido, sem salto visual entre posições.

## 13. Recoil

Recuo do modelo separado da elevação da mira e da dispersão. Cada arma usa seu perfil existente; rajadas aumentam bloom. Impacto da escopeta e dano usam deslocamento de câmera pequeno e desativável. O mouse não recebe lerp pesado.

## 14. Reload

Carregador saindo/entrando, ação do slide/ferrolho, cilindro e cartucho da escopeta. Munição só transfere na conclusão da etapa. Escopeta aceita disparo que interrompe recarga quando já há cartucho. Sprint, troca e outras interrupções mantêm as regras anteriores.

## 15. Muzzle flash e cápsulas

Flash no viewmodel, luz breve no mundo, tracer e impacto. Flash apresentado por pelo menos um frame mesmo em renderização lenta. Até 24 cápsulas reutilizadas, com gravidade visual e vida curta; revólver não ejeta a cada disparo. Não há acúmulo ou física persistente de cápsulas.

## 16. Impactos

Raio 3D da câmera escolhe alvo; o trajeto até o cano e do cano até o alvo é validado. Um cano obstruído não atravessa a parede e o impacto usa o ponto real de obstrução. Raios respeitam altura de móveis, paredes, pisos e tetos. Concreto, madeira, metal e vidro mantêm partículas próprias.

## 17. Sangue e feridas

Partículas voxel, reação anatômica, feridas por região e corpos preservados. Headshot combina dano, reação, som e hitmarker discreto. Feridas nos corpos mantêm o tipo do infectado e a zona atingida.

## 18. Infectados

Os cinco modelos voxel existentes foram preservados. Ataque próximo projeta braços em direção ao jogador; Runner mantém passada rápida, Tank escala/peso e preparação, Spitter sinaliza ácido e Screamer preparação/grito espacial. Dano informa direção relativa ao olhar. Os volumes anatômicos de todos os tipos foram testados com o raio FPS, incluindo morte e cadáver.

## 19. Interação

Raio central independente do renderer escolhe um único alvo, com oclusão e alcance de 2,5 m até seu volume. Portas, janelas, containers, arma no chão, instalações, alarme, defesas e depósito usam esse foco. O aviso de arma no chão mostra nome, raridade, substituição e E, sem ficha longa cobrindo a vista.

## 20. Interiores

Tetos e paredes permanecem visíveis. Foram inspecionados casa, hospital distante, delegacia, supermercado, indústria, quarentena, hospital central e abrigo. A validação inclui abrir uma porta e caminhar para dentro. Os três interiores centrais e os locais da expansão continuam com móveis sólidos. Nem toda construção decorativa antiga é acessível.

## 21. Iluminação

Luz direcional e ambiente ajustadas para visão ao nível da rua, interiores com luzes próximas reutilizadas e emergência existente. Sombra acompanha a região do jogador. Noite mantém contraste legível; não depende de escurecer toda a imagem.

## 22. Lanterna

F alterna cone suave de 24 m, orientado por yaw e pitch da câmera. Funciona em interiores e à noite, sem bateria.

## 23. Áudio

Panning acompanha a direção do olhar. Passos variam em asfalto, concreto, madeira, grama e metal; agachar reduz intensidade/cadência. Passos próximos dos infectados ajudam a localizar ameaça. Vida baixa acrescenta respiração e batimentos. Porta e vidro têm sinais próprios. Os seis MP3 do usuário foram preservados; os outros tiros têm sínteses distintas. Procedência em [AUDIO_LICENSES.md](AUDIO_LICENSES.md).

## 24. Alarmes

Uma instância de áudio por alarme, distância/direção, alcance audível limitado, duração e término controlados pela simulação. Ruído continua atraindo infectados existentes. Desligar, expirar e reiniciar encerram o loop; não há reinício infinito.

## 25. HUD

Crosshair central e mínimo responde a movimento, recuo, crouch e ADS; hitmarker distingue cabeça. HP, stamina, munição e slots preservados. Dano direcional discreto e vinheta leve. Objetivo, minimapa e avisos foram compactados para liberar a vista.

## 26. Minimap e mapa

Identidade e descobertas preservadas; minimapa reduzido no canto. M abre mapa, libera cursor e bloqueia disparo/olhar. Fechar retoma captura. Não há novo sistema de navegação ou mapa de outra fase.

## 27. Configurações

Sensibilidade, FOV 70–105, head bob, camera shake, volume geral, efeitos e ambiente. Valores antigos migram para defaults válidos. Tuning FPS está em `first-person.ts`; velocidades principais e stamina continuam em `config.ts`, evitando duplicar o balanceamento existente.

## 28. Otimizações

Geometria voxel mesclada/cacheada preservada; nenhuma malha por voxel. Distância de chunks 135 m e plano distante 150 m com fog moderado, sem surgimento a 15 m. Frustum culling do Three.js, pools de partículas/corpos/cápsulas, viewmodel cacheado e duas luzes internas reutilizadas. Sombras locais de 1024². O rig adiciona aproximadamente 5–6 draws quando visível, não dezenas por arma.

## 29. Testes automatizados

**Build de produção e typecheck aprovados. 129 testes de lógica aprovados, incluindo 25 testes FPS.** Cobertura inclui simulação, mesher, sobrevivência, combate, variedade, stamina, cidade e os novos testes FPS. Casos históricos de UI isométrica continuam no repositório, mas não compõem a suíte ativa; não são declarados aprovados.

## 30. Navegador e sessão jogada

**8 cenários distintos de navegador aprovados em rodadas de validação e regressão.** A rodada integrada passou em 7/8 e revelou a retomada rápida após ESC; após a correção, o cenário restante passou integralmente em 18,7 s. Não foi declarado sucesso da rodada que apresentou a falha.

Chromium/Playwright: Pointer Lock, menus, derrota/retry, stamina, seis armas, empty, recarga, troca, escopeta interrompível, interiores, lanterna, cinco tipos de infectado, dano direcional e hordas 30/40. Dois testes de gravações/Web Audio preservados. Cenários específicos usam preparação explícita em `?test`.

A sessão `fps-playthrough.spec.ts` usa `/`, teclado, deltas de mouse e UI, sem hooks de cenário, teleporte, injeção de vida/munição ou aceleração do tempo. A sessão recolheu tábuas do pátio, abriu mochila/mapa, percorreu ruas, disparou duas vezes e recarregou com a reserva real; registrou 55 HP ao final da última execução. O trecho final iniciou a rota de retorno, sem comprovar chegada ao abrigo. As capturas foram inspecionadas visualmente. Essa execução automatizada não equivale a uma avaliação humana com mouse físico e GPU.

## 31. Performance antes/depois

Mesmo Chromium SwiftShader, viewport 1280×720, qualidade alta e ponto inicial do abrigo. A mudança de projeção muda necessariamente o conteúdo visível.

| Medida | Isométrico anterior | FPS |
| --- | ---: | ---: |
| FPS por software, 3 amostras | 3 / 3 / 3 | 5 / 3 / 3 |
| Draw calls | 80 | 245 |
| Triângulos | 153.746 | 392.750 |
| Buffers de geometria estimados | 16,8 MB | 17,0 MB |
| Chunks ativos | 12 | 45 |

A rua longa e o alcance maior custam mais draws/geometria renderizada. Os números de FPS não demonstram ganho em GPU real. Heap depende de coleta de lixo e não é usado como prova de otimização.

Na noite, qualidade leve: 30 infectados = 4 FPS software / 379 draws / 267.368 triângulos; 40 = 3 FPS / 458 draws / 275.416 triângulos. Pico de áudio limitado a 16 vozes. Dados: [baseline](docs/fps/baseline.json), [depois](docs/fps/after.json), [hordas](docs/fps/performance.json).

## 32. Problemas encontrados

Colisão antiga rejeitava deslocamentos grandes inteiros; troncos bloqueavam acesso leste e um ponto de evento; ESC dependia apenas da saída nativa; modelos não tinham peças FPS articuladas; luneta era opaca; testes antigos dependiam do cursor isométrico. Na automação apareceram warps de mouse e comandos de troca enviados antes do término do saque da arma.

## 33. Correções

Movimento subdividido com sliding; árvores deslocadas visual/fisicamente; ESC explícito, recaptura aguardando a liberação e descarte de eventos duplicados de Pointer Lock; raycasts 3D e validação do cano; teto permanente; peças móveis, luneta vazada, luz/flash e cápsulas; interação por foco. Fixtures de navegador respeitam o tempo de troca e usam entrada relativa. Os testes de colisão/alcance foram atualizados para as novas regras sem enfraquecer as verificações de acesso.

## 34. Limitações

- Controller planar: sem salto, escadas em vários andares ou cápsula física 3D completa. Altura do piso trata os pequenos desníveis existentes.
- Corpo local oculto; não há pernas/pés na vista FPS.
- Colisores e anatomia usam volumes aproximados. Armas/mãos têm animação procedural, sem IK ou simulação de dedos.
- Luneta é uma abertura voxel com FOV reduzido; não renderiza imagem ampliada independente dentro de uma lente.
- Sem acústica por cômodo, sombras da lanterna ou oclusão de som detalhada.
- Software SwiftShader serve à validação, não à certificação de 60 FPS. Game feel físico, mixagem em fones/caixas e GPUs reais ainda precisam de avaliação humana.
- Os MP3 foram fornecidos/autorizados pelo usuário; autor/licença pública não informados estão registrados com transparência.
- Balanceamento de expedições e noites prolongadas permanece sujeito a sessões humanas. Nenhuma fase de multiplayer foi iniciada.

## 35. Arquivos principais

`src/game/first-person.ts`, `input.ts`, `interaction.ts`, `simulation.ts`, `world.ts`, `city.ts`, `districts.ts`, `interiors.ts`, `settings.ts`, `audio.ts`; `src/render/scene.ts`, `viewmodel.ts`, `weapon-assets.ts`, `city-view.ts`, `town.ts`, `districts.ts`; `src/main.ts`; HUD/layout/estilos/variedade; `tests/fps.test.ts`, `fps.spec.ts`, `fps-playthrough.spec.ts`, `audio.spec.ts`, configuração Playwright; README e documentação de áudio/FPS.

## 36. Screenshots

- [Antes: isométrico](docs/fps/before-isometric.png) e [depois: FPS](docs/fps/after-fps.png).
- [Partida normal](docs/fps/ordinary-start.png), [rua](docs/fps/ordinary-street.png), [mochila](docs/fps/ordinary-inventory.png).
- [Pistola ADS](docs/fps/pistol-ads.png), [escopeta](docs/fps/shotgun-combat.png), [rifle de precisão ADS](docs/fps/marksman-ads.png).
- [Hospital](docs/fps/interior-hospital.png), [casa](docs/fps/interior-house.png), [delegacia](docs/fps/interior-police.png), [mercado](docs/fps/interior-market.png), [indústria](docs/fps/interior-industry.png), [quarentena](docs/fps/interior-quarantine.png).
- [Hospital noturno e lanterna](docs/fps/hospital-night-flashlight.png), [horda de 40](docs/fps/horde-40.png), [dano direcional](docs/fps/directional-damage.png).

A pasta `docs/fps` também contém recarga, ADS, combate e sprint das seis armas, os cinco infectados, mapa e dados brutos. Capturas de cenários preparados podem mostrar HUD de diagnóstico e valores de vida elevados utilizados para inspeção.

Nenhum commit ou push foi realizado.
