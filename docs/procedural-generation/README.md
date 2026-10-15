# Geração procedural — correção de posicionamento

Novas expedições usam `layoutVersion: 2`. O sorteio por seed continua determinístico e mantém todos os IDs e quantidades. O planejamento acontece durante o carregamento, nunca por frame.

## Causas corrigidas

- Ruas originais estendidas através de terrenos antes seguros, sem nova validação dos lotes sorteados.
- Reservas consideravam apenas paredes, deixando árvores, toldos, quintais e anexos sem espaço.
- Marcadores e decoração de bairros seguiam a casa mais próxima durante o embaralhamento; agora as regiões de bairro mantêm suas âncoras.
- Calçadas verificavam apenas o centro dos segmentos; as extremidades podiam atravessar cruzamentos. As superfícies agora são recortadas pelo retângulo completo de cada rua e interior.
- Postos de NPCs verificavam o centro, não a cobertura inteira nem o acesso. O novo teste reserva o posto completo e encontra um caminho livre até uma via.
- Reposição de árvores/loots ignorava construções e ocupação atual. Agora aguarda espaço livre. Drops de recompensas, madeira, cadáveres e armas usam busca local com separação e teste de paredes.
- Decoração externa usa os limites completos dos modelos, incluindo rotação e filhos; evita construções, árvores, acessos, suprimentos e acampamentos. Objetos com colisão, como containers e árvores, usam os mesmos dados na renderização.

## Validação

- `tests/procedural-placement.test.ts`: 24 seeds, repetibilidade, preservação de conteúdo, ruas e lotes, árvores, loots, entradas, rotas aos 92 destinos e roundtrip de save/checkpoint coop.
- `tests/surface-layout.test.ts`: recorte de todos os segmentos de calçada, cruzamentos e pátios, sem faces duplicadas.
- `tests/outdoor-placement.test.ts`: limites de grupos rotacionados, separação de objetos e invalidação das reservas ao trocar mundos.
- Suites de economia, crafting, rede, cloud e LAN cobrem posicionamento e compatibilidade.
- `tests/procedural.spec.ts`: navegador em 1366×768, solo v2 seed 813, promoção para LAN/WebRTC, segundo cliente com geometria idêntica e compra pelo convidado confirmada pelo host. Nenhum erro JavaScript observado. Photon foi verificado pelos contratos automatizados, sem uma sessão real Photon nesta etapa.

Em três seeds documentadas, os lotes que invadiam ruas passaram de **21 para 0**; os troncos nas ruas passaram de **79–80 para 0**. Mantidos **445 edifícios/locais**, **598 árvores** e **322 pontos de loot** nas medições. Os critérios e os tempos de preparação em Node constam em [placement-validation.json](placement-validation.json); não são um benchmark de FPS.

Capturas: [cruzamento](junction-v2.png), [fachada](facade-v2.png), [mapa](map-v2.png), [troca em LAN](lan-trade-v2.png). Resultado do navegador: [validation.json](validation.json).

## Compatibilidade e limites

Saves v0/v1 conservam as coordenadas anteriores, sem migração automática de jogadores, árvores, construções e itens. Recebem o recorte visual de pavimentos e as verificações de reposição; a reorganização física completa v2 exige nova expedição. Os clientes cooperativos precisam estar na mesma versão do jogo.

Drops em local excepcionalmente fechado preservam os itens na origem caso nenhuma posição local segura exista; locais lotados podem compartilhar o ponto livre mais próximo. Isso evita apagar recompensas ou atravessar paredes para escondê-las em outra sala. A correção não altera balanceamento, inventários ou schema do banco.
