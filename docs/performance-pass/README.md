# Otimização sem redução de qualidade

Passe sobre a versão `272cca1`. Mantidos mapa, distâncias de renderização, presets, sombras, AO, pós-processamento, modelos, animações, quantidades, regras e frequências de simulação/rede.

O custo dominante encontrado na simulação era a repetição de consultas de chão e buscas de portais para cada combinação infectado/obstáculo. No renderer havia travessias e transformações redundantes entre os passes de cor e AO. HUD, inventário e construções também recriavam resultados inalterados.

## Resultado no navegador

Chromium/ANGLE, AMD Radeon RX 6650 XT, 1920×1080, DPR 1, preset High. Mesmos pontos, direção da câmera e fase antes/depois. 1,6 s de estabilização e pelo menos 180 frames por cena. Nenhum infectado nas quatro cenas gráficas; a carga de infectados é medida separadamente em `simulation.md`.

CPU é a duração do callback principal de requestAnimationFrame, incluindo trabalho de JavaScript/submissão ao driver. GPU é EXT_disjoint_timer_query_webgl2, quando disponível. CDP profiling esteve ativo nos dois ensaios. Os valores são médias de uma execução por versão, sujeitos à variação de clocks e agendamento.

| Cena | CPU antes → depois (ms/frame) | Redução CPU | GPU antes → depois (ms/frame) | Draw calls, iguais | Triângulos, iguais |
|---|---:|---:|---:|---:|---:|
| shelter | 6.99 → 5.64 | 19.3% | 6.02 → 6.11 | 719 | 820,858 |
| expanded-city | 5.46 → 3.62 | 33.6% | 5.66 → 5.78 | 265 | 98,910 |
| night | 7.86 → 5.62 | 28.6% | 5.71 → 6.32 | 737 | 826,166 |
| built-shelter | 7.27 → 5.62 | 22.7% | 5.93 → 6.77 | 727 | 1,073,722 |

**60 FPS antes e depois**, limitados pela cadência de 60 Hz neste ambiente. O resultado comprovado é mais folga de CPU; não se deve converter esses percentuais diretamente em ganho de FPS. Não foi medido ganho de GPU — o tempo de GPU foi ligeiramente maior nesta execução. O trabalho geométrico e todos os efeitos permanecem iguais.

As cenas de abrigo construído usam 72 peças de carga sintética; não modificam as regras de posicionamento do jogo. As screenshots mantêm câmera/fase, mas partículas, nuvens e animações têm tempo de execução variável.

## Simulação e equivalência

Veja [simulação](simulation.md): com 40 infectados e 72 peças, solo **18,692 → 2,375 ms/tick**, coop autoritativo com quatro jogadores **19,162 → 2,603 ms/tick**. Sete hashes SHA-256 finais conferidos iguais. Rede de transporte e renderer não entram nesse microbenchmark.

Foi conferida também a equivalência de 6.360 consultas de foco de interação contra a implementação anterior, com 2.184 acertos e nenhuma divergência. Três testes permanentes com varredura integral da cidade cobrem consultas espaciais, raios e colisões.

## Alterações

- Índice espacial de telhados/tendas, descarte rápido de obstáculos fora do raio e menos alocações nas consultas.
- Cálculo de chão por infectado/tick; índice de janelas preservando o estado vivo durante o tick.
- Matrizes do mundo atualizadas uma vez por frame e reutilizadas por cor/AO; cenário imóvel congelado.
- Remoção de grupos vazios deixados pelo batching; geometria preservada.
- Buffers das construções atualizados apenas quando algo muda ou uma porta anima. Bounds recalculados nessas mudanças para culling correto.
- Cálculo de preview e foco compartilhado entre UI/render; consultas ocultas sem utilidade evitadas.
- HUD reutiliza nós e resultados iguais. Mapas invalidam a imagem ao mudar posição, direção, descoberta, colegas, eventos, tamanho ou fonte.

## Validação

- 292 testes unitários aprovados; typecheck e build aprovados.
- Build mantém o aviso existente de chunks acima de 500 kB.
- 4 testes de construção solo aprovados: martelo, combate, escadas/segundo andar, porta animada, inventário, E, baú cheio e reposicionamento.
- 3 testes de UI aprovados: identidade dos cartuchos, invalidação do mapa e nenhuma mutação DOM redundante em 120 frames do martelo.
- 2 testes com clientes reais aprovados: Photon e LAN/WebRTC, construção, fortificação, baú com itens e migração do anfitrião.
- 1 teste de HUD/mapas aprovado em 1366×768, 1600×900, 1920×1080 e 960×640; mapa colorido, inventário, pausa, escala de UI e Pointer Lock.
- Benchmark gráfico concluído sem erros JavaScript. Screenshots revisadas; geometria, iluminação e composição preservadas. A captura de HUD dedicada está em `hud-verified.png`.

## Evidências e reprodução

`before.json`, `after.json`, `simulation-before.json` e `simulation-after.json` contêm métricas brutas. Screenshots `before-*.png` / `after-*.png` cobrem abrigo, cidade expandida, noite e abrigo construído. Logs e perfis CPU ficam em `test-results/` (não versionados).

```sh
npm test
npm run build
node --experimental-strip-types scripts/profile-simulation.mjs
LAST_NIGHT_GPU=1 PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright npx playwright test --config playwright.performance-pass.config.ts
PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright npx playwright test --config playwright.ui-performance.config.ts
```

O ganho real de FPS depende de CPU, GPU, resolução e carga da partida. Não houve teste em todos os dispositivos nem garantia de um FPS mínimo universal.
