# Manutenção — 29/09/2026

Atualização limitada a correções e custo de execução. Aparência, modelos de infectados, materiais, iluminação, efeitos, HUD, presets e regras de gameplay foram preservados. A reformulação visual dos zumbis solicitada anteriormente foi suspensa pela orientação mais recente.

## Correções no coop

- O buffer antigo parava ao alcançar o último pacote: o atraso fixo de 150 ms não cobria as atualizações de distância intermediária (~300 ms) e os checkpoints de entidades distantes (~500 ms).
- Novo buffer de apresentação adapta o histórico ao intervalo recebido. O cursor avança continuamente, ajustando a velocidade ao mudar de faixa. Predição limitada a 100 ms cobre pequenas lacunas; interrupções longas não causam deslocamento indefinido.
- Atraso mínimo de 150 ms, máximo de 600 ms, conforme a cadência. Isso envolve maior atraso de apresentação para entidades distantes; o host continua executando a mesma IA, colisões e combate. As taxas e o formato das mensagens Photon permanecem iguais.
- O relógio é corrigido uma vez por pacote, independentemente da quantidade de infectados. Poses e animações de pacotes de movimento antigos não substituem dados novos.
- Migração de host limpa relógio e histórico antigo. Remoção de entidades também limpa o registro de envio, evitando acumulação durante partidas longas.

## Otimizações sem redução gráfica

- Cores e vetores temporários da iluminação/câmera são reutilizados.
- Matriz de projeção só é recalculada quando FOV, proporção ou distância de visão mudam; ADS e redimensionamento continuam atualizando a câmera.
- Pontos de iluminação são reutilizados e suas distâncias são calculadas uma vez por ponto, usando distância ao quadrado. A ordem de desempate original é preservada.
- Idades de corpos/ácido são indexadas por ID a cada checkpoint, eliminando buscas quadráticas por frame. Lotes de movimento usam um índice dos infectados; o host calcula proximidade sem criar arrays por infectado.
- Nenhum asset, shader, efeito, resolução, preset, dano, HP, loot, spawn ou regra de IA foi alterado.

## Evidências

[Interpolação determinística](interpolation.json): trajetória constante, renderização amostrada a 60 Hz, excluindo aquecimento inicial. Em 299 frames, o algoritmo anterior congelava em 136 frames com pacotes de 300 ms e 203 frames com pacotes de 500 ms. O novo buffer teve zero nesses cenários. Isso mede continuidade, não aumento de FPS.

[Photon real](photon-motion.json): dois clientes, trajetória controlada no host a mais de 30 m dos jogadores, transportada pelas mensagens normais. Foram 301 amostras válidas em cinco segundos, zero frames congelados, média de 16,63 ms entre frames. O cenário isola o transporte da tomada de decisão da IA; combate e migração foram validados separadamente com os testes existentes.

[Benchmark gráfico](render-benchmark.json): Chromium/ANGLE, Radeon RX 6650 XT, 1280×720, qualidade alta, abrigo durante o dia. Três amostras antes e três depois: **60 FPS, 742 draw calls e 934.126 triângulos** em todas. Não houve ganho de FPS mensurável nesta cena limitada a 60; o trabalho remove custo de CPU/alocações sem reduzir conteúdo gráfico. Não foram medidos tempos GPU por passe ou redução total de garbage collection.

[Antes](before.png) / [Depois](after.png): mesma câmera/cena/preset; inspeção visual preservou composição, luz, arma, materiais e HUD. Partículas e animações ambientais variam com o tempo; não é uma comparação pixel a pixel de um frame congelado.

## Validação

- `npm run build` (inclui typecheck).
- `npm test`: 174 testes aprovados, incluindo seis regressões novas de interpolação/relógio.
- Oito testes Playwright com GPU: combate/loot/portas/migração Photon; downed/revive/arma remota; movimento de infectados Photon; Pointer Lock/menu/inventário/movimento/retry; seis armas; interiores/noite; cinco tipos de infectado/horda; troca de arma/recarga/benchmark em qualidade alta.
- Cinco testes Playwright de carregamento: GPU antes de liberar menu, preparação do solo, qualidade baixa/alta e espera pelos dois clientes Photon.

As medições são locais e de cenários delimitados. Latência elevada, pausas do navegador e capacidade do equipamento ainda afetam fluidez; não há promessa de 60 FPS em todas as máquinas ou cenas.
