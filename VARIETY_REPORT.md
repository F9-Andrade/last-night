# LAST NIGHT — arsenal, infectados e decisões de expedição

Etapa de 10/09/2026. Trabalho realizado no projeto existente, preservando o mapa, a identidade visual, o ciclo de sobrevivência, a navegação, as barricadas e o combate anatômico. O envio inicial ao GitHub foi autorizado posteriormente pelo usuário, em 11/09/2026. A validação final desta etapa foi pausada para registrar o estado atual do projeto.

## Arsenal e diferenças de uso

Valores de armas comuns, antes de modificadores e perks. Distâncias usam as unidades do mundo. Dano de cabeça ×3; braços ×0,65; pernas ×0,7. A redução por distância começa no alcance eficaz e chega a 25% no alcance máximo.

| Arma | Dano | Intervalo | Pente | Recarga | Alcance eficaz / máximo | Munição | Ruído |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Pistola | 34 | 0,23 s | 12 | 1,35 s | 26 / 26 | Leve | 30 |
| Revólver | 72 | 0,68 s | 6 | 2,5 s | 26 / 32 | Leve | 38 |
| Submetralhadora | 18 | 0,085 s | 30 | 1,9 s | 12 / 22 | Leve | 27 |
| Escopeta | 14 × 8 chumbos | 0,88 s | 6 | 0,65 s por cartucho | 5 / 16 | Cartuchos | 40 |
| Rifle de assalto | 29 | 0,16 s | 24 | 2,2 s | 25 / 36 | Rifle | 36 |
| Rifle de precisão | 85 | 0,9 s | 8 | 2,7 s | 38 / 46 | Rifle | 42 |

A pistola mantém sua função econômica. O revólver troca capacidade e rapidez por impacto. A SMG oferece fogo automático curto e consome rapidamente a mesma reserva das armas curtas. A escopeta é forte perto do alvo, espalha chumbos entre corpos e perde muito dano à distância. O rifle de assalto cobre a média distância. O de precisão recompensa tiros escolhidos e exige mais tempo de recarga e mobilidade menor.

Cada família possui receita voxel própria, silhueta no HUD, capacidade, dispersão, recuo, impulso, clarão e velocidade de movimento. Os multiplicadores de movimento são 1 / 0,97 / 0,96 / 0,90 / 0,93 / 0,86, respectivamente. A animação distingue pente, tambor e inserção de cartucho; a mão de apoio acompanha as armas longas. A troca abaixa os braços por 0,32 s e bloqueia o tiro durante esse intervalo.

Pistola, revólver, escopeta e precisão disparam a cada clique; SMG e assalto também aceitam segurar. A cadência usa o passo fixo e conserva a fração do intervalo entre disparos automáticos. Os oito chumbos são resolvidos antes de aplicar a morte: um alvo não gera oito eliminações ou oito cadáveres. A escopeta permite interromper a recarga e disparar após carregar pelo menos um cartucho.

## Munição, slots e equipamento

- **1:** uma arma longa — SMG, escopeta, assalto ou precisão.
- **2:** uma arma curta — pistola ou revólver.
- A estrutura de utilidade futura não oferece equipamento fictício nesta fase.

Os três recursos de munição têm reservas independentes e pesos próprios: leve 0,025 kg, cartucho 0,08 kg e rifle 0,045 kg. Os pentes ficam em cada instância de arma. Trocar ou cancelar recarga não transforma munição de uma categoria em outra. Não há transferência antecipada antes da conclusão da recarga.

Equipar usa **E** perto da arma. O equipamento substituído fica no chão com a identidade, os modificadores e a munição preservados. A mochila tem abas de suprimentos e de armas/vantagens; o HUD inferior direito mostra os dois slots e a reserva da categoria equipada. A comparação contextual mostra dano, cadência, precisão angular, capacidade, recarga, raridade, modificador e qual arma será substituída.

## Loot, raridades e modificadores

Delegacia e lockers policiais garantem oportunidades de arma; casas, posto, mercado e outros containers usam chances e famílias adequadas à região. Reservas especiais da delegacia e indústria oferecem melhores chances de raridade. O estoque do hospital privilegia medicina e reserva selada. O conteúdo de equipamento é sorteado uma vez por container na expedição; retirar, trocar e recolher novamente não cria cópias.

Raridades: **comum, incomum, raro, épico e lendário**, com cores contidas. Fora das reservas especiais, as faixas de probabilidade são 28% / 56% / 12,5% / 3,1% / 0,4%. Nas reservas: 28% / 29% / 31% / 9,5% / 2,5%.

Bônus sorteados chegam a 12% de dano, 12% de redução do tempo de recarga, 14% de estabilidade e, em certos épicos/lendários, uma carga adicional. Raro ou superior recebe um único modificador:

| Modificador | Efeito |
| --- | --- |
| Perfurante | Atravessa um segundo corpo com 55% do dano; paredes continuam bloqueando |
| Pesado | +8% de dano, impulso ×1,4 e recuo ×1,2 |
| Rápido | Intervalo entre disparos 10% menor |
| Preciso | Dispersão 18% menor e +10% no dano de cabeça |
| Silenciado | Metade do raio de ruído, assinatura sonora abafada e alcance 10% menor |

Os valores derivados são calculados sem modificar repetidamente a instância. A apresentação usa uma marca discreta no chão, a cor contextual e um som curto ao encontrar equipamento raro, sem explosões de partículas.

## Vantagens da expedição

Após sobreviver à noite, o jogador escolhe **uma entre três opções**. A simulação pausa durante a escolha. Não há bônus permanente entre partidas nem escolha duplicada do mesmo perk.

| Perk | Efeito |
| --- | --- |
| Mãos firmes | −15% recuo e dispersão |
| Catador | 20% de chance de munição adicional por busca |
| Corredor | +10% na velocidade de corrida |
| Casca grossa | +15 de vida máxima e recuperação imediata de 15 |
| Sangue frio | Headshot recupera 8 de fôlego |
| Engenheiro | Reparo de barricada dispensa sucata |
| Sob pressão | Recarga 25% mais rápida abaixo de 35% de vida |
| Último recurso | Último disparo do pente causa +20% de dano |
| Fôlego novo | Bandagem também recupera o fôlego |
| Primeiro abrigo | Próxima barricada custa 2 madeiras a menos |
| Primeira resposta | Primeiro headshot após recarregar dobra a reação do alvo |
| Bem preparado | +3 kg de capacidade |

## Infectados e combate

| Inimigo | Vida | Velocidade base | Dano jogador / barricada / abrigo | Intervalo corpo a corpo | Reação / impulso relativos | Introdução na horda |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Errante | 90 | 1,15 | 9 / 18 / 24 | 1,1 s | 1 / 1 | Noite 1 |
| Corredor | 58 | 3,35 | 7 / 10 / 14 | 0,85 s | 0,55 / 1,5 | Noite 2 |
| Brutamontes | 310 | 0,78 | 22 / 65 / 62 | 2,3 s | 0,3 / 0,18 | Noite 4 |
| Cuspidor | 78 | 1,08 | 6 / 12 / 18 | 1,4 s | 1 / 0,8 | Noite 3 |

O Errante mantém o pequeno bônus de velocidade por noite da configuração anterior, limitado a +0,45. Não há multiplicação geral da vida dos infectados por noite.

**Corredor:** corpo fino e inclinado, braços pendentes, passadas rápidas e vocalização mais aguda. Aproxima-se depressa, sofre menos stagger temporal e maior deslocamento com impactos fortes.

**Brutamontes:** torso, ombros e braços próprios; não é apenas o Errante ampliado. Seus ataques têm preparação de 0,65 s. Passos geram som grave e pouca poeira, sem tremor excessivo da câmera. Derruba barricadas mais rapidamente, mas uma arma comum continua causando dano útil; headshots de precisão reduzem bastante o tempo de combate.

**Cuspidor:** peito/mandíbula diferentes e postura própria. Mantém distância quando há linha de visão, recua se o jogador chega perto, para durante 1,05 s de preparação e emite aviso sonoro antes de cuspir. Acerto de pelo menos 20 de dano ou headshot durante a preparação interrompe o ataque.

O projétil leva 0,7 s até o destino marcado. O ácido tem raio 1,45, dura 4 s e causa 5 de dano por contato em intervalos de 0,65 s. O ataque recarrega em 5,5 s. Há no máximo oito projéteis/poças ativos; paredes e barricadas bloqueiam o lançamento e o dano radial. O ponto de impacto não acompanha o jogador depois da preparação.

Todos usam as mesmas zonas anatômicas, ferimentos limitados, colisão, caminhos e gerenciamento de cadáveres. Os modelos de cadáver são mesclados e armazenados por espécie e pose. O Corredor cai mais rápido e o Brutamontes mais devagar; corpos permanecem 30 s e desaparecem por transição em 4 s.

## Hordas, encontros, mundo e mapa

A horda preserva três grupos e intervalos adicionais de 13 s. Noite 1: 18 Errantes; Noite 2: 24 infectados, incluindo dois Corredores. A partir da terceira entra um Cuspidor; a quarta adiciona um Brutamontes. Os especiais ocupam momentos específicos da onda, mantendo uma maioria ampla de Errantes. O orçamento cresce em seis por noite até 60, com no máximo 40 vivos.

Encontros consideram pontos regionais de interesse, densidade, dia, vida atual e sorteio da expedição. Saúde baixa reduz grupos de exploração e suspende novos eventos ocasionais. Áreas médicas, policiais e industriais oferecem risco e recompensas distintos. Os spawns respeitam colisão, distância da base/jogador e o veto da câmera; os grupos regionais verificam cada posição de nascimento.

Foram acrescentadas interações temporizadas:

- **Gerador da triagem:** energiza o hospital e libera o estoque refrigerado; o ruído atrai infectados próximos.
- **Estoque refrigerado:** bandagens e reserva selada, dependente da energia.
- **Armário de apreensões:** equipamento e munição na delegacia.
- **Reserva da oficina:** materiais defensivos e equipamento na indústria.
- **Porta-malas:** recompensa com alarme; é possível desligá-lo em 1,4 s.

Eventos ocasionais, com intervalo de 160–250 s após o primeiro, oferecem suprimentos abandonados, alarme distante ou grupo errante. O mapa recebe apenas um marcador contextual temporário. Não há estrutura de quests.

O hospital, a delegacia e o mercado passaram a ter interiores pequenos e transitáveis: entrada, corredor central, móveis que bloqueiam movimento/tiros, containers e acesso às reservas. Telhados cedem visualmente ao aproximar-se. O gerador ilumina o interior hospitalar. Não foram deslocadas ruas, edifícios ou regiões; casas e galpões grandes permanecem com sua estrutura anterior.

Uma nova semente é criada a cada partida normal. Containers opcionais ativos, loot, equipamento, raridades, eventos, posições de entrada da horda e ofertas de perk variam. O início preserva pistola funcional, 72 de munição leve, bandagem e as reservas garantidas do pátio e da rota médica. Loot raro não é necessário para a primeira noite.

## Áudio, interface e estatísticas

As seis armas combinam envelopes, filtros, ruído e componentes tonais diferentes; não são apenas o mesmo disparo com outra altura. Sons de troca, recarga, equipamento raro, passos pesados e preparação/cuspe foram integrados. A música acrescenta pressão gradual quando especiais e Brutamontes estão próximos. O áudio continua procedural e local, com limite de 16 vozes simultâneas de efeitos, além das fontes contínuas de música/ambiente.

A interface mantém fontes, ícones e cores do projeto. Slots úteis ficam no canto inferior direito; raridade e comparação aparecem ao alcance do equipamento; vantagens são consultadas na mochila ou na escolha do amanhecer. O resumo final inclui noites, eliminações, headshots, especiais, equipamento encontrado, maior raridade, loot, dano e reparos.

## Validação e problemas corrigidos

- **83 testes de lógica passaram:** 48 de regressão e 35 novos. Cobrem as seis armas, recarga vazia/interrompida, três reservas, acertos anatômicos, chumbos, queda de dano, cadência em 30/60/144 passos, troca sem duplicação, raridades, perks, especiais, gerador, alarme, eventos, sementes e caminhos.
- **Build de produção e verificação TypeScript passaram.**
- **Navegador:** a primeira rodada dos quatro testes novos passou em três. O quarto encontrou uma mochila 15 px além da borda inferior em 1024×640; a altura foi corrigida e o cenário passou na regressão seguinte.
- A inspeção das capturas também encontrou compartilhamento indevido do material de transparência do telhado com móveis/ambiente. O telhado passou a usar o material exclusivo do prédio.
- Testes antigos de movimento esperavam 400–500 ms de relógio e podiam perder completamente um frame em renderização por software. Agora mantêm a tecla pressionada até observar deslocamento real. O hook de teleporte não reposiciona mais silenciosamente o jogador para favorecer a captura.
- As fixtures de inventário foram atualizadas para os dois novos recursos. A verificação de reinício preserva as reservas garantidas e permite containers opcionais inativos sorteados na nova partida.

A consolidação final permanece pendente. Antes da pausa, a regressão de 16 cenários no navegador passou, assim como verificações adicionais de comparação, ácido e galeria. As duas expedições por sementes possuem registros em `docs/variety/`. A inspeção visual identificou que a poça de ácido pode ficar encoberta pelo piso elevado do abrigo; esse ajuste e sua validação ainda precisam ser concluídos. Os ferimentos dos novos modelos receberam pontos de fixação próprios, compartilhados com os cadáveres; a galeria e o build passaram após esse ajuste.

## Performance e limites

Pools: 40 infectados vivos; reserva combinada de 80 vivos/cadáveres; seis marcas por corpo; 100 partículas; dez traçantes; oito ataques de ácido; 48 armas no chão. Geometrias de armas e anatomias são reutilizadas por família. A navegação e separação continuam compartilhadas.

As amostras estão em [performance.json](docs/variety/performance.json) e [simulation-performance.json](docs/variety/simulation-performance.json). O ambiente gráfico é **Chromium com SwiftShader**, em 1440×900, qualidade alta. São números de renderização por software, sem comprovação de FPS numa GPU física. O estado inicial anterior já registrava cerca de 2 FPS durante captura.

Medição final da regressão:

| Cena | Draw calls | Triângulos (máx.) | Geometria | FPS observados em software |
| --- | ---: | ---: | ---: | ---: |
| 30 Errantes | 270–274 | 167.474 | 11,9 MB | 3–11 |
| 40 Errantes | 339 | 174.512 | 11,9 MB | 2–3 |
| 27 Errantes + 3 Corredores | 269 | 166.558 | 12,1 MB | 2–3 |
| 29 Errantes + Cuspidor | 269 | 166.854 | 12 MB | 2 |
| 29 Errantes + Brutamontes | 272–276 | 167.220 | 12 MB | 2–3 |
| 36 Errantes + 2 Corredores + Brutamontes + Cuspidor | 340–343 | 174.454 | 12,2 MB | 3 |

Os modelos especiais não provocaram crescimento expressivo no orçamento de desenho em relação aos 40 Errantes. O teste isolado da simulação, com 300 passos por cenário e o navegador também ativo na máquina, registrou medianas de 1,83–2,79 ms e percentis 95 de 3,82–5,37 ms por passo. Foram observados picos de até 43,89 ms; portanto, esses números não eliminam a necessidade de um perfil em hardware real.

## Arquivos principais e capturas

Dados/lógica: `src/game/weapons.ts`, `enemies.ts`, `perks.ts`, `expedition.ts`, `interiors.ts`, `simulation.ts`, `combat.ts`, `inventory.ts`, `loot.ts`, `world.ts`, `input.ts`, `audio.ts` e `src/main.ts`.

Apresentação: `src/render/weapon-assets.ts`, `character-assets.ts`, `models.ts`, `corpses.ts`, `expedition-view.ts`, `survival-assets.ts`, `building-assets.ts`, `town.ts`, `scene.ts`; `src/ui/variety.ts`, `variety.css`, `hud.ts`, `layout.ts`, `icons.ts` e `map.ts`.

Validação: `tests/variety.test.ts`, `tests/variety.spec.ts`, galeria em `tests/fixtures/variety-gallery.*`, ajustes nos testes de regressão, `package.json` e este relatório.

Capturas anteriores à alteração: `docs/variety/before.png` e `before-inventory.png`.

Capturas em `docs/variety/`: seis `weapon-*.png`, `rare-ground.png`, `equipment.png`, `perk-choice.png`, `arsenal-and-specials.png`, três `*-interior.png`, `inventory-compact.png` e seis `horde-*.png`.

## Limitações e próxima fase recomendada

Não há salvamento da expedição, progressão permanente, utilitário utilizável, novos bosses, multiplayer ou outras funcionalidades excluídas do prompt. Casas e galpões não receberam interiores completos; o recorte desta etapa abrange os três prédios de serviço. O alarme do gerador representa a partida ruidosa do motor por 20 s, não uma simulação elétrica completa. As 12 vantagens deixam de gerar novas ofertas quando todas já foram adquiridas.

A validação em software não permite declarar 60 FPS em hardware real. O balanceamento cobre a primeira horda, cenários controlados e as regras dos especiais; sessões humanas longas continuam necessárias para avaliar preferência de armas e economia nas noites avançadas.

Recomendação: uma etapa dedicada a jogar e medir várias expedições até as noites 4–6 em GPU real, ajustando economia, legibilidade de ataques e escolhas de perk antes de ampliar o arsenal. Esta recomendação não inicia outra fase.
