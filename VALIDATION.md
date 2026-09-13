> Registro da fase inicial. A validação da expansão atual está em [CITY_REPORT.md](CITY_REPORT.md). O restante deste arquivo preserva o registro histórico.

# Validação do vertical slice — 09/09/2026

- `npm install`: dependências instaladas; auditoria retornou zero vulnerabilidades.
- `npm run build`: TypeScript sem erros e build Vite de produção concluído, sem aviso de tamanho de chunk após separar Three.js do jogo.
- `npm test`: **10 testes passaram**.
- `npm run test:e2e`: **2 testes passaram**, rodada final de 44,4 segundos.
- Console do navegador integrado e fluxo automatizado: **nenhum erro de aplicação**.
- Inspeção visual: menu, gameplay, HUD, telhados, câmera, dia, noite e viewport 1024×640. Aumentada a luz ambiente noturna para preservar leitura.
- Verificado que `__LAST_NIGHT__` e `debug-stats` não aparecem no JavaScript de produção.

## Correções encontradas durante a validação

Cliques rápidos podiam desaparecer entre dois passos da simulação. A entrada de disparo agora fica pendente até ser consumida pelo próximo passo. O teste de navegador usa cliques instantâneos e verifica cada munição consumida. A espera entre disparos observa a cadência da simulação; não depende da velocidade de renderização da máquina.

Corrigida a orientação da seção triangular dos telhados e a continuidade da altura do sol no fim do amanhecer. O HUD evita recriar conteúdo HTML que não mudou. A fase noturna usa ícone de lua.

## Desempenho observado

No navegador integrado, uma amostra de gameplay em qualidade alta, viewport aproximadamente 1054×918, mostrou **180 FPS e 167 draw calls**. É uma amostra pontual, não uma garantia para outros equipamentos ou para a horda máxima.

O Chromium headless dos testes foi forçado a usar SwiftShader, com desempenho muito inferior (3–6 FPS nas amostras em 1440×900). Esses resultados validam comportamento e renderização por software, não o desempenho de uma GPU. O snapshot inicial tem **252 draw calls e 19.012 triângulos**. Qualidade leve está disponível na pausa.

Ainda não foram realizados benchmarks em uma matriz de GPUs, navegadores, dispositivos móveis ou com a horda máxima em hardware de entrada. O escopo permanece desktop.

As capturas da última execução estão em `test-results/menu.png`, `day.png`, `night.png` e `compact.png`. Os arquivos de resultados são ignorados pelo Git.
