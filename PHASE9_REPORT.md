# LAST NIGHT — Fase 9

Snapshot em validação. Continuação da versão FPS, sem multiplayer. Em 23/09/2026, o usuário autorizou explicitamente commit e push de todo o trabalho atual, substituindo a restrição Git do prompt original. A Fase 9 ainda não está declarada concluída.

## 1. Espaços vazios anteriores
O mapa mantinha 312 × 312 m, mas a expansão concentrava conteúdo em POIs separados. Os intervalos entre as avenidas ±88/±142, o entorno residencial e as ligações ao sul tinham terrenos subutilizados. Praça, pátio do abrigo, pátios de carga, áreas de triagem e corredores de circulação foram tratados como espaços propositais. O baseline possui oito vistas e métricas anteriores em `docs/phase9/before.json`.

## 2. Estruturas adicionadas
52 construções de preenchimento e dois POIs exploráveis: 54 estruturas. Os lotes têm coordenadas determinísticas, rejeitam sobreposição com vias, edifícios, árvores, loot, encontros e instalações existentes. Dez becos receberam mochilas acessíveis. Cinco casas antigas ganharam maior altura no skyline.

## 3. Tipos de estrutura
Casas térreas e sobrados, comércio estreito, apartamentos de dois a quatro pavimentos e oficinas/galpões pequenos. Quatro famílias estruturais, dimensões e cores variadas, diferentes estados de conservação. Os pavimentos superiores dessas fachadas não são exploráveis.

## 4. Distritos
Residencial: casas, varandas, cozinha, sofá e malas. Comercial: lojas, toldos, vitrines fechadas e calçadas. Industrial: oficinas, caminhões, máquinas e gerador de doca. Hospital: ambulância/triagem, enfermaria e estoque. Quarentena: checkpoint, sacos de areia, tendas existentes e sinalização de evacuação.

## 5. Ruas
Calçadas ao longo dos eixos, veículos estacionados e cenas pontuais interrompem os corredores vazios. A circulação central permanece reconhecível. O verificador percorreu por movimento e colisão os 16 eixos completos, usando desvios de navegação quando necessário; resultados em `street-routes.json`.

## 6. Veículos
63 veículos adicionais, em nove famílias: sedan, hatch, SUV, pickup, van, caminhão, ônibus, ambulância e viatura. Rodas, vidros, faróis, grade, placas, retrovisores e detalhes de portas; veículos especiais têm proporções próprias. Não são dirigíveis.

## 7. Acidentes
Viatura danificada junto ao poste, ônibus avariado e veículos com capô escurecido e fragmentos. Distribuição concentrada em cenas, sem acidentes repetidos em cada esquina. Não foi implementada física de capotamento.

## 8. Evacuação
Fila no eixo oeste, ônibus ao sul, portas abertas e malas sugerem fuga interrompida. Igreja e terminal complementam a rota visual. As malas e corpos ambientais não dependem de texto para identificar abandono.

## 9. Cenas militares
Checkpoint do Setor Zero com caminhão, cones, sacos de areia, sinal de evacuação e materiais deixados para trás. Preservados tendas, barreiras e composição de infectados da quarentena.

## 10. Detalhes urbanos
Toldos, vitrines, caixilhos, tábuas, tubulação, caixas elétricas, antenas, reservatórios, equipamentos de cobertura, pequenos resíduos e calçadas. Detalhes menores somem à distância; volumes e skyline continuam visíveis.

## 11. Interiores alterados
Casas externas ganharam cozinha e sofá; hospital, comércio e delegacia receberam sinalização, objetos nas mesas, computadores, lockers e sujeira contextual. A fundição ganhou máquinas. Os três interiores centrais existentes foram preservados.

## 12. Novos interiores
Igreja São Miguel: bancos, altar, cruz, velas e indicação do Setor Zero. Terminal: bancos, armários, partidas canceladas e rádio interativo. Duas entradas por POI, integradas às portas/janelas, navegação, loot e mapa existentes.

## 13. Histórias ambientais
Sete cenas com intenção explícita: fuga interrompida, triagem, último checkpoint, entrega industrial, viatura no poste, fuga de uma família e ônibus sem destino. A composição usa veículos, bagagens, sangue, corpos estilizados e suprimentos.

## 14. Apocalipse
Fachadas chamuscadas, vidros incompletos, tábuas, objetos abandonados e pequenas marcas de sangue. Há contraste entre edifícios conservados e danificados; o bairro não foi convertido em ruína uniforme.

## 15. Vegetação
Pequenas trepadeiras, ervas nos passeios e vegetação preexistente preservada. Não representa décadas de floresta tomando a cidade.

## 16. Destruição
Variações visuais de fachada e veículos. Portas, janelas e barricadas mantêm destruição funcional. O restante é cenário estático, sem simulação estrutural.

## 17. Interações
Dez mochilas de becos, loot dos dois novos POIs, gerador industrial, depósito condicionado à energia e rádio do terminal. Não se tornou cada móvel interativo; os recipientes existentes mantêm as famílias visuais por contexto.

## 18. Alarmes
Mantidos interação com porta-malas, eventos e alarmes existentes. Impactos em hatches e viaturas selecionados agora disparam um alarme de 16 segundos, uma única vez por veículo/expedição. Há NoiseEvent, atração, áudio espacial, término e desligamento manual. O áudio é descartado fora de 65 m e recuperado apenas enquanto o mesmo alarme ainda está ativo.

## 19. Geradores
Gerador da triagem preservado, com motor próprio em vez de sirene de carro. Novo gerador da doca libera o depósito industrial. Motores ligados emitem ruído periodicamente e uma única voz espacial próxima; a luz reutilizada acompanha o depósito energizado mais próximo. Estado permanece até nova partida.

## 20. Eventos
Cache, rádio, alarme e horda errante existentes continuam opcionais. Rotas errantes passam a usar locais fixos previamente definidos, consumidos uma vez por run, em vez de posições calculadas atrás do jogador. Não há novo evento de queda de energia ou sistema climático.

## 21. TensionDirector
`src/game/tension.ts` recebe observações agregadas dos sobreviventes, sem referência a câmera/DOM. Não altera vida, munição, dano, mira, loot ou posição dos infectados. A interface aceita um conjunto de sobreviventes para evolução futura, sem implementar rede.

## 22. Estados
CALM, SUSPENSE, CONTACT, PRESSURE, PEAK e RELIEF. Histórico limitado a 64 transições, atualização a cada segundo. Contato real pode interromper calmaria; o diretor não remove ameaças presentes para fabricar segurança.

## 23. Ritmo
Calmaria inicial, sinais espaçados no suspense e 42 segundos de alívio após o contato cessar. Oportunidades errantes são adiadas em calmaria/alívio ou quando o sobrevivente está muito vulnerável. A defesa noturna continua sendo uma ameaça explícita e não é desativada pelo diretor.

## 24. IA
Percepção distingue idle, investigação, busca e perseguição. A distância sozinha deixou de permitir detectar o jogador atrás de paredes. Mantidas classes especiais, ataques, patrulhas, sono espacial e identidades dos atores.

## 25. Investigação sonora
Som chega com posição aproximada, erro crescente com distância e atenuação através de obstáculos. O infectado investiga, percorre alguns pontos próximos e relaxa se não houver novo sinal. Ruído não cria atores. Sons contínuos, como um gerador, podem manter a investigação ativa.

## 26. Linha de visão
Paredes e portas fechadas bloqueiam detecção. Vidro intacto permite ver, mas bloqueia ataques; o infectado pode golpear a barreira. Disparos e interação continuam usando a geometria de colisão existente.

## 27. Memória
Última posição vista é uma cópia, válida por sete segundos, e não uma referência à posição atual do jogador. Ruídos têm memória de dez segundos. A memória também expira durante a dormência, evitando perseguição antiga reaparecendo quando o ator acorda.

## 28. Combate
Mantidos seis armamentos, ADS, recarga e dano anatômico da Fase 8. Impactos continuam causando dano mesmo durante imunidade temporária ao stagger. Recuo físico respeita colisão e resistência de cada classe.

## 29. Hit reactions
Cooldown de 0,85 s para stagger forte evita renovação infinita a cada bala. Pernas fracas produzem desaceleração breve; impactos fortes têm reação maior. Tronco, cabeça e braços conservam respostas distintas; joelhos/corpo reagem a impactos nas pernas. Escopeta próxima conserva reação ampliada.

## 30. Sangue e corpos
Preservados partículas voxel, feridas anatômicas e três variantes de corpos com queda e vida limitada. Marcas dos corpos agora respeitam a altura de calçadas/pisos. Novas manchas e corpos ambientais aparecem em cenas selecionadas. Não há ragdoll ou desmembramento.

## 31. Áudio novo
Motor espacial, reflexão curta de interiores, ajustes de mecanismos e sinais discretos de metal. Tudo criado no código do projeto; nenhum arquivo externo foi baixado. Os seis MP3 fornecidos pelo usuário foram preservados, com sua proveniência registrada em `AUDIO_LICENSES.md`.

## 32. Armas
Pistola mantém a gravação fornecida. Revólver, SMG, escopeta e rifles mantêm perfis distintos de corpo, transiente e cauda. Escopeta usa transiente grave mais longo. Síntese não foi descrita como gravação realista de arma.

## 33. Recargas
Eventos sincronizados com as fases existentes. Diferenciação entre inserção de cartucho, cilindro, carregador e acionamento do mecanismo. A pistola continua usando a gravação cuja duração acompanha a animação.

## 34. Ambiente
Vento atenuado no abrigo/interior, transição gradual ao sair, sons ocasionais espaçados. Calmaria e alívio silenciam a trilha de tensão. O suspense não produz um jumpscare ou spawn junto ao jogador.

## 35. Interior/exterior
Resposta de 420 ms gerada proceduralmente, misturada suavemente apenas nos interiores. Fontes de eventos atrás de obstáculos têm menor intensidade. Passos conservam cinco superfícies e variação, com redução ao agachar.

## 36. Noite
Luz global noturna reduzida, contraste com luzes locais e lanterna, emergência hospitalar com variação suave. A noite permanece legível; o abrigo mantém iluminação quente como referência.

## 37. Pistas e objetivo de longo prazo
Igreja aponta para o Setor Zero; rádio do terminal revela canal 07; checkpoint registra a pista final desta etapa. HUD pode sugerir investigação opcional. Não foi implementado final de fuga, campanha linear ou NPC.

## 38. Otimizações
Planejamento urbano ocorre uma vez, colisões entram no índice espacial existente, materiais são compartilhados e os novos volumes não têm rigidbodies. Posição, geometria e navegação usam os mesmos dados de lotes e veículos.

## 39. Batching/instancing
Volumes estáticos e detalhes são fundidos por célula, com cores de vértice. Fumaça usa um pool instanciado de 18 volumes. Não há milhares de objetos decorativos atualizados individualmente por frame.

## 40. Chunks/culling
Novos chunks de 32 m, volumes até 145 m e detalhes até 64 m. Frustum culling do Three.js permanece. Chunks e interiores existentes continuam ativos apenas no entorno do jogador.

## 41. IA distante
Infectados não envolvidos no cerco dormem além de 86 m, preservando HP e identidade. Memórias expiram a baixa frequência; caminhos distantes são recalculados menos frequentemente. Não há varredura de todos os props pelo diretor.

## 42. Performance antes/depois
Oito vistas idênticas, 1280 × 720, qualidade baixa, três amostras por vista. Valores abaixo: antes → depois. Chromium/SwiftShader renderiza por software: os FPS baixos já existiam no baseline e não certificam desempenho em GPU física. O tempo de quadro é uma estimativa de 1000/FPS arredondado do HUD, não um perfil de CPU/GPU.

| Área | FPS | Quadro estimado (ms) | Draw calls | Triângulos | Geometria (MB) | Heap (MB) |
|---|---:|---:|---:|---:|---:|---:|
| Abrigo | 2.7 → 2 | 388.9 → 500 | 197 → 236 | 281482 → 298242 | 16.8 → 26.8 | 73.1 → 82.4 |
| Residencial | 4.3 → 4 | 233.3 → 250 | 62 → 83 | 82594 → 93286 | 17 → 26.9 | 73.1 → 82.4 |
| Centro | 5.7 → 5.3 | 181 → 194.4 | 122 → 154 | 181170 → 199574 | 16.9 → 26.9 | 73.1 → 82.4 |
| Hospital | 6 → 4.3 | 169.8 → 233.3 | 34 → 53 | 68434 → 75998 | 16.9 → 26.9 | 73.1 → 82.4 |
| Indústria | 5 → 4.7 | 200 → 222.2 | 52 → 122 | 80872 → 95662 | 17 → 27 | 73.1 → 82.4 |
| Quarentena | 5 → 4.3 | 222.2 → 244.4 | 82 → 134 | 178526 → 203796 | 17 → 27 | 73.1 → 82.4 |
| Avenida norte | 3.7 → 3.7 | 288.9 → 288.9 | 101 → 135 | 210498 → 224682 | 17 → 27 | 73.1 → 82.4 |
| Avenida sul | 6.3 → 5 | 158.7 → 200 | 112 → 181 | 189984 → 220832 | 17 → 27 | 73.1 → 82.4 |

Dados reproduzíveis: [comparação](docs/phase9/comparison.json), [baseline](docs/phase9/before.json) e [resultado](docs/phase9/after.json). As vistas preparadas removem os infectados próximos para isolar custo urbano; entidades/IA/fontes de áudio são registradas nas amostras. O cenário de horda é separado em `interiors-performance.json`.


Comparação adicional com o cenário noturno da Fase 8, mesma resolução e qualidade (contagens de infectados solicitadas ao fixture):

| Horda | FPS antes → depois | Draw calls | Triângulos | Pico de vozes | Geometria MB |
|---|---:|---:|---:|---:|---:|
| 30 | 4 → 4 | 379 → 449 | 267368 → 307830 | 15 → 9 | 17.1 → 27 |
| 40 | 3 → 3 | 458 → 526 | 275416 → 315790 | 16 → 16 | 17 → 27 |

Uma amostra por cenário; não é uma média de longa duração. Evidência: `docs/phase9/fps-regression/performance.json`.

## 43. Draw calls
A tabela acima registra a variação por região. O maior aumento absoluto é na indústria: +70 chamadas; abrigo +39, centro +32. Há um batch por camada/célula, e letreiros seguem objetos próprios. Mais conteúdo não ficou gratuito: não se apresenta aumento de densidade como ganho de FPS.

## 44. Triângulos
Geometria visível na tabela: de 68–281 mil para 76–298 mil triângulos entre as vistas comparadas. O acréscimo usa malha fundida, sem atualizar cada objeto decorativo separadamente.

## 45. Memória
Geometria residente: cerca de 17 → 27 MB (+10 MB). Heap reportado: 73,1 → 82,4 MB (+9,3 MB). São fotografias sujeitas ao coletor de lixo e à implementação do navegador, não prova de vazamento ou ausência dele; a geometria inclui conteúdo residente fora da vista. Os pools existentes e limites de vozes/decals permanecem.

## 46. Testes automatizados
140 testes de lógica passaram, incluindo 11 novos para densidade/rotas, diretor, memória, visão, som, stagger, gerador e rádio. As verificações de colisão encontraram e permitiram corrigir móveis/loot sobrepostos. O roteiro dos 16 eixos percorre efetivamente movimento com colisão sobre caminhos calculados.

## 47. Navegador
10 casos de navegador aprovados em uma execução completa de 8,4 minutos (`docs/phase9/browser-validation.log`): controles/menus/reinício, seis armas, oito interiores, cinco classes, hordas de 30/40, slots/recarga de escopeta, gravações locais, alarme por impacto, gerador e rádio. A suíte inclui um percurso comum curto sem hooks; a sessão adicional até a noite é registrada abaixo. Evidências de regressão ficam em `docs/phase9/fps-regression`, preservando as capturas históricas da Fase 8.

## 48. Playtests
A regressão inclui um percurso comum curto sem hooks. Na sessão adicional interativa, foram saqueadas 6 madeiras e 2 sucatas, seguidas de tentativa de fuga e uso de bandagem; o sobrevivente morreu aos 31 segundos, após 100 de dano. Evidências: `docs/phase9/ordinary-play.json` e `play-00.png` a `play-06.png`. Não houve alteração de vida/recursos nem aceleração de tempo. Ainda faltam investigar essa pressão inicial e concluir uma partida com entrada em prédio, retorno e noite. O usuário interrompeu a validação para solicitar este snapshot em Git. As inspeções preparadas com reposicionamento/vida elevada são separadas dessa sessão comum.

### Avaliação das perguntas obrigatórias

| Pergunta | Avaliação pelas inspeções e evidências |
|---|---|
| Parece uma cidade, grande e densa? | Sim, especialmente nos eixos internos e ligações norte/sul; os novos lotes fecham intervalos visíveis na comparação. O perímetro continua mais aberto que o centro. |
| Há espaços vazios sem propósito? | Praça, circulação, pátios e faixa periférica permanecem abertos. A borda visual do mapa ainda é simples e não representa uma cidade infinita. |
| Existem estruturas suficientes? | 54 estruturas adicionais, quatro famílias de fachada, além dos edifícios anteriores. Nem todo volume novo é acessível. |
| Parece um apocalipse e as ruas contam histórias? | Veículos interrompidos, malas, sangue, tábuas, triagem e checkpoint criam sete cenas; a destruição é seletiva. |
| Existe motivo para entrar nos prédios? | Móveis contextualizados, loot, energia/depósito e rádio; igreja e terminal acrescentam locais reconhecíveis. |
| Distritos são reconhecíveis sem mapa? | Hospital, indústria e quarentena têm veículos, escala e sinalização próprios. Residências ainda reutilizam módulos. |
| Existem silêncio e antecipação? | Calm/Relief retiram a trilha; suspense espaça sinais. A eficácia emocional precisa de avaliação humana, não é inferida apenas de testes. |
| Encontros parecem naturais? | Grupos vêm de POIs e rotas preparadas; visão, som e memória têm regras verificadas. Nenhum spawn de oportunidade dentro da visão ou junto ao jogador. |
| Áudio localiza ameaças e investigação convence? | Pan, atenuação, oclusão, limite de fontes e alvo aproximado foram implementados/verificados. Localização percebida com fones não foi certificada por esses testes. |
| Tiros têm impacto e a shotgun é forte? | Dano anatômico, reação, sangue, recuo e morte foram exercitados nas seis armas; escopeta mantém impacto maior próximo. A avaliação de peso sonoro continua subjetiva. |
| A noite muda a experiência? | Menos luz global, silhuetas, luzes locais e cone da lanterna; a defesa noturna permanece ativa. Capturas mostram leitura do cenário com e sem lanterna. |
| Há motivo para continuar explorando? | Novos becos, loot contextual e sequência opcional igreja → rádio → checkpoint; sem obrigar uma missão de contagem de abates. |

## 49. Problemas encontrados
Sofás sobrepostos a loot, mochila de beco em construção vizinha, timers de memória congelados na dormência, perseguição anterior baseada apenas em distância e gerador usando alarme de carro. Na automação, reload durante captura voltou ao menu e encerrar a horda vazia abriu perks durante a inspeção noturna.

## 50. Correções
Reposicionamento e reserva de acesso ao loot, expiração de memória distante, linha de visão/última posição, áudio próprio do motor, cooldown de stagger, ajustes de bancos e altura das manchas de corpos. Cenários de teste estabilizados e noite de inspeção mantida ativa.

## 51. Limitações
Não há pavimentos superiores navegáveis novos, física de veículos, destruição estrutural, chuva ou final de evacuação. Carros e fachadas novos são modelos modulares simples. O ambiente usa síntese original; percepção musical/espacial e conforto de mouse exigem avaliação humana. GPU física não foi medida. Nenhum multiplayer foi iniciado.

## 52. Screenshots
[Galeria antes/depois e inspeções](docs/phase9/index.html): oito pares comparáveis, 48 vistas dos 16 eixos, interiores, noite, interações e partida comum. Capturas preparadas podem mostrar vida/base elevadas e a barra de diagnóstico; isso não altera a partida normal.

## 53. Arquivos principais
`src/game/urban-layout.ts`, `base-loot.ts`, `world.ts`, `city.ts`, `loot.ts`, `tension.ts`, `simulation.ts`, `expedition.ts`, `audio.ts`; `src/render/urban-view.ts`, `city-view.ts`, `scene.ts`, `models.ts`, `corpses.ts`, `expedition-view.ts`; `src/ui/map.ts`, `hud.ts`, `src/main.ts`; testes e roteiros `phase9`; `AUDIO_LICENSES.md` e este relatório. A separação dos pontos de loot básicos evita dependência circular entre layout e simulação.

Snapshot autorizado para commit e push pelo usuário em 23/09/2026. Validação de partida prolongada pendente; não iniciar multiplayer.
