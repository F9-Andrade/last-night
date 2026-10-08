# Registro de validação

Validação local da integração. Nenhum commit, push ou SQL remoto foi executado pelo agente.

| Verificação | Resultado | Evidência local |
| --- | --- | --- |
| Baseline dos testes existentes | 300 aprovados | `/tmp/last-night-supabase-baseline-tests.log` |
| Testes existentes + novos de domínio/serviços | 310 aprovados, zero falhas | `test-results/supabase/logs/unit-310.log` |
| Typecheck e build final | Aprovados | `test-results/supabase/logs/build.log` |
| Cadastro, confirmação, recuperação, refresh e logout | Aprovado com API simulada | `test-results/supabase/logs/cloud-browser-five.log` |
| Novo mundo pelo solo, saída automática, reabertura, offline e conflito | Aprovado com API simulada | Mesmo log |
| Convite RPC + dois clientes Photon + saves individuais | Aprovado; Photon real, Supabase simulado | Mesmo log |
| Mundo salvo solo → WebRTC LAN → entrada tardia → migração | Aprovado; WebRTC real, Supabase simulado | Mesmo log |
| Novo mundo pelo botão Criar sala + saída com autosave + Meus mundos | Aprovado; Photon real, Supabase simulado | Mesmo log |
| Regressão do coop existente: combate, disputa de loot, inventário, portas, migração | Aprovado com dois clientes Photon reais | `test-results/supabase/logs/existing-coop-offline.log` |
| Regressão solo offline: combate, inventário, loot, porta, noite e morte | Aprovado | Mesmo log |
| Protocolo LAN: quatro jogadores, checkpoints grandes, identidade, reconexão | Aprovado | `test-results/supabase/logs/lan-protocol.log` |
| Diff / espaços inválidos | `git diff --check` sem erros | Verificação de leitura |
| Duas contas confirmadas / RLS do Supabase remoto | Não executado; preparação dispensada pelo usuário | Limitação explícita |

Os cinco testes de navegador da integração terminaram em aproximadamente 1,3 minuto no último run. Não é um benchmark de FPS. Build conserva o aviso de chunks maiores que 500 kB; renderer/qualidade não foram reduzidos.

## O que os novos testes verificam

Roundtrip de classes, inventário, baú, arma/raridade/magazine, armadura, nutrição, noite/horda, árvores e progressão; rejeição antes de mutar a simulação de saves corrompidos/futuros; exclusão de registros individuais do world_state; chaves privilegiadas/URL inválida; RPC exclusiva para resgate, inclusive código legado; protocolo antigo sem worldId; CAS de revisão/timestamp; coalescência de save; retry de erro sem sobrescrever conflitos; propriedades opcionais de eventos/infectados.

A API simulada serve para verificar SDK, telas, ciclo de vida, serialização e tratamento de falhas. Não comprova o SQL, RLS ou entrega de e-mails do serviço real. Os cenários não criam usuários nem mundos no Supabase real.

## Capturas locais

- `test-results/supabase/worlds-after-coop-exit.png`: mundo criado pelo coop, salvo ao sair e listado em Meus mundos.
- `test-results/supabase/menu-preserved.png`: menu existente com as opções novas de conta/mundos.
- `test-results/supabase/saved-pause.png`: confirmação de save na pausa.
- `test-results/supabase/offline-retained.png`: falha de rede com progresso preservado.
- `test-results/supabase/coop-owner.png` e `coop-member.png`: saves separados no Photon.
- `test-results/supabase/lan-migration.png`: save individual após migração LAN.

Esses artefatos estão no diretório de resultados ignorado pelo Git. O fluxo final de criação é Jogar solo / Criar sala; Meus mundos contém somente acesso/gerenciamento de mundos existentes e resgate de convite. Expedições temporárias sem conta permanecem disponíveis e não são apresentadas como saves na nuvem.
