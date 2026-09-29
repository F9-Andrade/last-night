# Infectados detalhados — 29/09/2026

Retomada do pedido de detalhamento dos zumbis após a atualização de manutenção. A correção da interpolação coop de `3dfc15f` foi preservada e novamente validada; esta atualização modifica as receitas visuais compartilhadas pelos infectados vivos e cadáveres no solo e no coop.

## Visual

- Detalhes locais em voxels de 4 cm, sobre as formas originais de 8 cm. As dimensões principais, articulações, silhuetas e definições de hitbox permanecem as mesmas.
- Rostos com órbitas escuras, pálpebras, dentes irregulares, mandíbula, narinas, dobras nas orelhas, machucados e couro cabeludo ferido.
- Roupas com gola, costuras, botões, bolsos, rasgos, pele exposta, manchas secas e detalhes nas botas. Mãos com separação de dedos e marcas nos nós dos dedos.
- Walker: camisa e bolso gastos; Runner: costelas e rasgos; Tank: colete de trabalho e cicatriz no peito; Spitter: glândulas e secreção em tons oliva; Screamer: garganta aberta e tendões do pescoço.
- Três variantes determinísticas por tipo, com geometria em cache. Nenhuma textura, fonte ou asset externo novo.
- Os sobreviventes, armas, HUD, cidade e iluminação não foram redesenhados. Nenhuma alteração de HP, dano, IA, spawn, loot ou protocolo de rede.

## Custo e carregamento

As seis partes continuam fundidas individualmente por greedy meshing. Cada infectado mantém sete meshes, contando a sombra de contato. As variantes são construídas uma vez durante a tela de carregamento, evitando a geração das malhas detalhadas no primeiro encontro. Isso prepara a geometria em CPU; não significa que todos os futuros uploads de GPU ou cadáveres sejam antecipados.

Na [comparação controlada dos cinco modelos](geometry.json), o render manteve **36 draw calls**, incluindo o piso. As variantes exibidas passaram de 572–1.040 para 1.200–1.916 triângulos por modelo. O teste de todas as 15 combinações verifica o orçamento de menos de 2.500 triângulos e sete meshes, compartilhamento do cache e reconstrução determinística.

[Antes](before.png) / [Depois](after.png): mesma câmera, luz, pose e cenário de inspeção. [Modelo dentro do jogo](gameplay.png).

## Fluidez e regressão

- `npm run build`, incluindo typecheck: aprovado.
- `npm test`: **175 testes aprovados**.
- Dez testes Playwright aprovados: galeria dos modelos; seis armas/headshots/recarga; cinco tipos/horda/dano; combate/loot/portas/migração Photon; continuidade dos infectados Photon; cinco cenários de carregamento solo/coop/qualidade baixa e alta.
- A regressão das armas inicialmente revelou uma corrida no próprio teste: ao substituir a pistola por outra pistola, o teste aceitava a arma antiga antes de processar a interação e disparava durante a troca. Agora aguarda também a mudança de UID; repetição aprovada, sem alterar a lógica do jogo.
- [Photon real](photon-motion.json): dois clientes, trajetória controlada no host e transporte normal de movimento. 301 frames válidos, zero congelamentos, média de 16,65 ms. Teste independente das decisões da IA; combate e mortes validados separadamente.
- [Hordas](horde-benchmark.json): Radeon RX 6650 XT/ANGLE, 1280×720, qualidade baixa. Cenários com 30 e 40 infectados mantiveram 60 FPS antes e depois. Os triângulos totais cresceram de 279.849/288.581 para 304.235/321.009. Draw calls variam ligeiramente pela animação e visibilidade (404/482 antes, 405/480 depois); a comparação estática confirma que os detalhes não adicionam draw calls aos modelos.

Os resultados de FPS são locais, em cenas delimitadas e limitadas a 60 Hz. O aumento geométrico é real; não implica custo zero ou garantia de 60 FPS em qualquer equipamento. Não foi medido tempo de GPU por passe.

## Complemento: animações e ragdoll

A pedido do usuário, antes da publicação:

- Respiração e balanço discreto em repouso; cabeça e braços com movimento secundário.
- Caminhada com intensidade suavizada pelo deslocamento real, evitando pernas andando quando o infectado está parado contra um obstáculo.
- Transições de ataque, preparação, cuspe e grito interpoladas por frame.
- Reação ao tiro por região com recuperação gradual, inclusive quando os estados coop chegam em intervalos. Animação não modifica HP, timers ou dados da IA.
- Ragdoll visual de nove pontos com gravidade, restrições de distância e contatos amortecidos no chão; usa direção da morte e variação determinística. Sem biblioteca de física adicional, sem transmitir membros na rede e sem transformar cadáveres em obstáculos.
- Após 2,4 segundos a física dorme e as seis peças são fundidas em uma malha por corpo. Geometrias resultantes são descartadas ao reciclar o slot; limite de cadáveres e duração originais são mantidos.
- Ferimentos acompanham os membros durante a queda e permanecem depois de estabilizar. A variante visual usa o ID do infectado para permanecer consistente entre clientes e cadáver.
- Colisão visual simplificada: chão e contenção do centro contra obstáculos. Não há colisão exata de cada membro com todos os objetos nem física entre cadáveres. Pequenas interseções em locais apertados ainda são possíveis.

Testes adicionais cobrem consistência do solver a 30/60/144 Hz, limites das articulações, parada definitiva e animações sem mutar gameplay. A suíte completa soma **177 testes**. A galeria registrou queda e repouso dos cinco tipos: 33 draw calls durante a queda e 8 depois de estabilizar (incluindo piso, manchas e ferimentos da cena de teste).

A fusão final é limitada a quatro corpos por frame; os demais continuam visíveis e já sem simular física enquanto aguardam. Os templates também são preparados no carregamento. O ensaio inicial de 80 mortes incluía a criação de templates e fusão simultânea e atingiu 69,6 ms em uma chamada; antecipar a criação e distribuir a fusão removeu esse pico do caminho normal de gameplay. A [medição final](ragdoll-stress.json) registra CPU de `CorpseView.update`, incluindo montagem inicial, percentil 95 e média com todos os corpos estabilizados. Não inclui tempo de GPU e não representa FPS do jogo inteiro. A reutilização dos 80 slots foi verificada sem crescimento da quantidade de objetos da cena.

[Queda](ragdoll-fall.png) / [Repouso](ragdoll-rest.png). Após adicionar as animações, o benchmark de hordas registrou novamente 60 FPS nos cenários de 30 e 40 infectados; veja `withAnimations` no JSON. Toda a regressão de gameplay (quatro testes) e de carregamento (cinco testes) foi repetida depois da integração do ragdoll.
