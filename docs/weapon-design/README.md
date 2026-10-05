# Armas, mãos e apresentação do combate

Atualização visual de 5 de outubro de 2026. Mantém o estilo voxel, o balanceamento, as receitas, os controles e os protocolos Photon/LAN existentes.

## Alterações

- Seis armas de fogo com peças mecânicas, miras, canos, carregadores e materiais distintos. Ferrolho, tambor e bomba preservam seus pivôs durante tiro/recarga.
- Faca, porrete, machado, lança, facão e martelo com novos modelos, cabos, lâminas, acabamento e pontos de empunhadura.
- Mãos com dedos articulados, polegares espelhados e luvas; braços ligados aos ombros e cotovelos com comprimentos fixos. A lança usa apoio das duas mãos; os punhos mantêm golpes alternados.
- Modelos compartilhados na primeira pessoa, sobreviventes remotos e armas no chão. O pickup agora conserva todas as peças e seus materiais.
- Rastros curtos de disparo, cápsulas por calibre, impactos de madeira/concreto/metal/vidro e sangue. A origem visual acompanha o cano/janela de ejeção sem modificar a trajetória calculada pelo gameplay.
- Geometria e materiais compartilhados: armas de fogo com três meshes e até 1.400 triângulos; ferramentas com um mesh e até 600. Efeitos reutilizam pools de 10 rastros, 24 cápsulas e o limite existente de partículas.
- Todos os modelos foram produzidos no código do projeto; nenhum asset externo ou dependência foi adicionado.

## Validação

- `npm test`: **300 testes aprovados**.
- `npm run build`: typecheck e build aprovados; permanece o aviso de chunks acima de 500 kB.
- `playwright.weapon-design.config.ts`: **4 testes aprovados**, incluindo captura das 13 apresentações e verificação das empunhaduras/articulações a 30, 60 e 144 Hz, durante golpes, mira, recuo, corrida e recarga.
- `playwright.weapon-remote.config.ts`: **1 teste aprovado** para apresentação remota e pickups.
- `playwright.weapon-regression.config.ts`: **3 testes aprovados** entre a execução inicial e a repetição do teste de armas: punhos, retorno ao armamento, poses remotas e seis armas com coleta, tiro, ADS, recarga, munição vazia, corrida e headshot.
- A primeira execução do teste de armas encontrou um problema antigo na preparação do teste: o loot da primeira morte impedia o próximo alvo de nascer no mesmo ponto. A fixture agora limpa esses restos entre armas e verifica que o alvo nasceu; o jogo não foi alterado para contornar a regra.

A representação remota foi exercitada em fixture; não foi criada uma sala Photon com jogadores reais nesta validação. As métricas instantâneas das capturas são evidência de renderização, não um benchmark de ganho de FPS.

## Evidências

- `before-*.png` / `after-*.png`: mesmas posições, ângulos e preset High, 1600×900, para todas as armas e punhos.
- `remotes-*.png`: sobreviventes em terceira pessoa.
- `action/`: tiros, mira, recargas e corrida das seis armas, 1280×720, preset Low; resultados em `action/weapons.json`.
- `before.json` / `after.json`: contadores instantâneos capturados durante a inspeção.

Para repetir as verificações gráficas em uma máquina com GPU compatível:

```sh
LAST_NIGHT_GPU=1 PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright npx playwright test --config playwright.weapon-design.config.ts
LAST_NIGHT_GPU=1 PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright npx playwright test --config playwright.weapon-remote.config.ts
FPS_EVIDENCE_DIR=docs/weapon-design/action LAST_NIGHT_GPU=1 PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright npx playwright test --config playwright.weapon-regression.config.ts
```
