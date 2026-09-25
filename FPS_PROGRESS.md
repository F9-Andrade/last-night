# Fase 8 — implementação e validação concluídas

Prompt atendido: `/home/pedroban/.codex/attachments/de9a0a6d-e3ed-4b7b-ab77-1a9e2ee64ce7/pasted-text.txt`.

**Git somente leitura: nenhum add, commit, push ou alteração de histórico. Não iniciar multiplayer ou outra fase sem nova instrução.**

O relatório final de 36 itens está em `FPS_REPORT.md`, com arquitetura, decisões, limitações e screenshots. Procedência de áudio: `AUDIO_LICENSES.md`. Evidências: `docs/fps/validation.json`, `baseline.json`, `after.json`, `performance.json`, `weapons.json`, `interiors.json`, `ordinary-session.json` e capturas.

- FPS em PerspectiveCamera única; mouse look imediato e Pointer Lock com tratamento de liberação assíncrona/eventos duplicados; WASD relativo, sprint, stamina, crouch, pequenos degraus e tetos baixos.
- Seis viewmodels com mãos voxel, ADS, recoil, recarga, peças articuladas, flash e pool de cápsulas; hitscan 3D e validação do cano.
- Interação central com alcance/oclusão; portas animadas, tetos permanentes, iluminação, lanterna, áudio orientado ao olhar e HUD ajustado.
- Build/typecheck aprovados; 129 testes de lógica aprovados. Oito cenários distintos de navegador aprovados em rodadas: a rodada integrada passou em 7/8; o restante expôs retomada rápida após ESC, foi corrigido e passou no rerun de 18,7 s.
- A sessão normal não usa hooks, teleporte ou tempo acelerado; recolheu recursos, percorreu ruas, disparou/recarregou e usou UI. Não certifica uma expedição inteira nem chegada ao abrigo no trecho de retorno.
- Benchmark software alta1280×720: antes 3/3/3 FPS, 80draws/153746tris/16,8MB; depois5/3/3 FPS,245draws/392750tris/17MB. Alcance maior mantém45chunks; não há conclusão sobre GPU real. Horda40 em leve:3FPS/458draws/275416tris, áudio≤16vozes.
- Casos de UI isométrica anteriores preservados, fora da suíte ativa, acessíveis por LAST_NIGHT_LEGACY_E2E=1 e ainda exigindo migração. Não foram declarados aprovados.

Limitações documentadas: controller planar sem salto, corpo local oculto, animações procedurais, anatomia/colisores aproximados, sem acústica por cômodo. Avaliação de game feel físico, GPU real e balanceamento prolongado depende de sessões humanas. Não há rede, lobby ou coop nesta entrega.

Nenhum commit ou push foi realizado.
