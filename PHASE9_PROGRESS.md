# Fase 9 — snapshot de trabalho

Prompt: `/home/pedroban/.codex/attachments/811ce695-6620-423a-ab25-364a112508f5/pasted-text.txt`.

A restrição original de Git foi substituída pelo pedido explícito do usuário em 23/09/2026 para fazer commit e push de tudo até aqui. Preservar a Fase 8 e não implementar multiplayer.

Prioridades: malha urbana e abandono; interiores e histórias; diretor de tensão; percepção e combate; áudio/interações; inspeção em FPS e validação.

Baseline: `scripts/phase9-survey.mjs before`, oito áreas, 1280×720, qualidade baixa, Chromium SwiftShader. A medição de software não certifica GPU real.

Análise inicial: perímetro de 312 m, 18 POIs externos, 26 edifícios centrais/residenciais e 3 galpões. Grandes intervalos entre avenidas ±88/±142 e POIs; quarteirões externos incompletos. Praça, pátios, acessos e corredores das vias devem continuar livres. Preenchimento usará lotes determinísticos que rejeitam sobreposição com construções, vias, árvores e pontos de interação existentes.

## Implementado

- Infill determinístico (~52 fachadas, contagem final em street-routes.json), 2 POIs (igreja/terminal), 9 famílias de veículos, 7 cenas de abandono, becos com loot, calçadas. Batches por células de 32 m, skyline até 145 m, detalhe 64 m.
- Interiores: cozinhas, sofás, lockers, máquinas, computadores, bancos, sinalização e sangue contextual.
- TensionDirector puro, seis estados, alívio, oportunidades adiadas; sem mudanças secretas em dano/munição.
- IA com visão ocluída, vidro transparente à visão mas sólido ao ataque, última posição, investigação aproximada, expiração de memória inclusive dormência.
- Stagger com cooldown; passos/motor/reverb, silêncio no Calm/Relief; gerador industrial e rádio do terminal, pistas de evacuação. Alarmes de carros selecionados por impacto, uma ativação por carro/run.
- Nenhum asset externo baixado. Nenhuma operação Git de escrita.

## Validação em 23/09

- 140 testes de lógica aprovados: `docs/phase9/unit-validation.log`.
- Typecheck + build aprovados: `docs/phase9/build-validation.log`.
- 16 eixos completos percorridos com colisão, nenhum bloqueio final: `docs/phase9/street-routes.json`.
- Survey antes/depois em oito áreas e 48 vistas dos eixos concluídos sem erros de página; `before.json`, `after.json`, `streets.json`.
- Comparação numérica e galeria em `docs/phase9/comparison.json` e `index.html`.
- Regressão completa de 10 casos aprovada em 8,4 minutos: `docs/phase9/browser-validation.log`. Evidências FPS atuais em `docs/phase9/fps-regression`, preservando o arquivo histórico da Fase 8.
- Os dois cenários específicos da Fase 9 também passaram na suíte completa.
- Partida comum adicional: saque real de 6 madeiras e 2 sucatas; tentativa de fuga e cura terminou em morte aos 31 segundos. Registro sem hooks em `docs/phase9/ordinary-play.json`. Essa sessão NÃO validou sobrevivência noturna.

Pendente: conduzir outra partida comum até a noite no driver `scripts/phase9-play.mjs` (sem hooks), investigar a pressão inicial observada nessa tentativa, registrar avaliação e concluir o relatório. O trabalho foi pausado para o commit/push solicitado pelo usuário. O teste em software não certifica GPU física. Não alterar fontes durante a validação de navegador.
