# Contas e mundos persistentes — integração aditiva

Estado: implementação local; sem commit, push ou deploy. A RPC `public.accept_world_invite(text)` foi aplicada **manualmente pelo proprietário**, conforme confirmação recebida. O agente não executou SQL no projeto remoto. Não reaplique o arquivo `.proposed.sql`: ele permanece como registro da proposta aprovada.

## 1. Arquitetura encontrada

Cliente TypeScript 5.9 / DOM nativo, Three.js 0.180, Vite 7, npm. `src/main.ts` coordena `Simulation`, `GameScene`, `Input`, áudio, HUD e sessões. Não há React nem substituição do renderer. Persistência é uma camada nova em `src/services`, sem reescrever os sistemas de gameplay.

## 2. Funcionamento anterior

Partidas eram expedições em memória. `last-night-settings` conserva configurações locais e `last-night-player-name` conserva o nome temporário da rede. Não foi encontrado save local persistente da partida. Essas chaves não são apagadas ou migradas. “Jogar solo”, coop sem conta e seus menus continuam disponíveis.

## 3. Coop existente

Photon Realtime 4.4.0 usa MasterClient e salas privadas, até quatro jogadores. LAN usa PeerJS/WebRTC na rede local; o servidor WebSocket opcional também permanece. `CoopWorld` é autoridade do combate, inventário compartilhado, infectados e ciclo; `CoopSession` aplica checkpoints, deltas e interpolação. Snapshot de presença continua a 20 Hz. A saída do host mantém a migração existente. PostgreSQL não executa a simulação e Supabase Realtime não foi usado.

## 4. Inventário e regressões

Sistemas encontrados e conservados: cidade expandida, interiores, portas/janelas, props, vegetação, veículos, abrigo/cama, nove peças de construção e andares, martelo, encaixe/fortificação, armadilhas, bancadas/baús móveis e seus 27 slots, craft, árvores/refill, loot/raridades, oito tipos de infectados, IA/hordas/tensão/eventos, FPS/Pointer Lock, armas/punhos/corpo a corpo, munição/recarga/recoil, dano/sangue/cadáveres, stamina, fome/sede/alimentos, perks, mapas, HUD, áudio, iluminação/pós-processamento, presets/otimizações/preparação de shaders, pausa/configurações, Photon, LAN, incapacitação/revive e migração de host.

A suíte original de 300 testes passou antes e depois. Foram repetidos testes de navegador com Photon real e solo offline, incluindo tiro, loot disputado, inventário, portas, noite, morte e migração. O resultado detalhado desta fase fica em `test-results/supabase/` (artefatos locais ignorados pelo Git).

## 5. Arquivos criados

`src/services/{cloud-config,supabase-client,auth-validation,auth-service,cloud-types,world-service,save-codec,save-service,save-recovery,autosave,coop-account,cloud-controller}.ts`; `src/ui/account.ts`, `src/ui/account.css`; `tests/cloud.test.ts`, `tests/cloud.spec.ts`; `playwright.cloud.config.ts`; documentos deste diretório.

## 6. Arquivos existentes modificados

`src/main.ts` recebeu pontos de integração de boot/entrada/saída/save. `src/network/{protocol,manager,lan-webrtc,coop-session,checkpoint}.ts` e `scripts/lan-server.mjs` receberam metadata opcional de mundo, mensagem de associação de conta e admissão em salas persistentes. `src/ui/coop.ts` preenche o nome pelo perfil. `.env.example`, `package.json` e lockfile incluem a configuração/dependência nova. Assets, render, áudio, mapa e regras da simulação não foram removidos.

## 7–8. Dependência e cliente

Cliente oficial `@supabase/supabase-js` 2.117.3, com suas dependências transitivas. Singleton com sessão persistente, refresh e PKCE; nenhuma subscription Realtime. Requisições têm timeout de 15 segundos. Configuração aceita somente URL segura e chave anon/publishable; o guard não substitui a verificação de assinatura feita pelo Supabase. Nenhum segredo privilegiado foi usado.

## 9–12. Cadastro, login, sessão e perfil

Cadastro envia username em metadata para o trigger existente. Validação: 3–24 letras/números/underscore, e-mail, senha 8–128 e confirmação. Login, cadastro, recuperação e atualização de senha usam Auth; senhas não são armazenadas pelo jogo. Cadastro com confirmação não é apresentado como sessão pronta. `profiles.username` fornece o nome público; os nomes exibidos na rede respeitam o limite preexistente de 20 caracteres, enquanto o perfil conserva os 24.

O callback Auth adia consumidores para evitar consultas aninhadas no lock do SDK. Sessão é restaurada no boot. Sair da conta passa pelo save e encerramento da sessão. Se a sessão expira durante a partida, a gravação não usa outra identidade; mantém o progresso em memória e informa o erro. O menu original recebe Conta e Meus mundos. Há opção de jogar sem conta.

## 13. Mundos

Meus mundos lista os mundos acessíveis, nome, papel, dia, dificuldade e data; não contém ação de criação. **Jogar solo → nome do mundo → Criar mundo e jogar** inicia uma expedição persistente para a conta conectada. **Coop → Criar sala → nome do mundo → Criar mundo e sala** usa a conexão escolhida. Sair da partida salva antes de voltar ao menu, e o mundo fica em Meus mundos para continuar. Criação com seed de 32 bits; abertura solo e hospedagem coop pelo proprietário; exclusão exige digitar o nome exato e continua restrita por RLS. Triggers continuam criando automaticamente owner membership e world_state. Não há inserts redundantes nesses registros.

A dificuldade disponível para novos mundos é **Normal**, o equilíbrio já existente. O banco aceita outros nomes de dificuldade, mas o jogo não possuía presets correspondentes; não foram inventadas novas regras de dano/spawn para esta integração.

## 14–15. Saves individuais e compartilhados

`save-codec.ts` serializa os sistemas reais e restaura suas classes, não objetos genéricos substitutos. Salva posição/rotação, HP/stamina, inventário, armas/magazines, perks, gear/armadura, mochila, nutrição/consumo, estatísticas, descobertas e progressão individual.

O estado compartilhado inclui ciclo/horda, base/defesas, construções, mesas, baús e conteúdo, árvores/respawn/refills, loot, portas, facilities, armas no chão, infectados ativos/dormentes, cadáveres, ácidos, geradores, eventos, sets de exploração/ativação e timers/PRNG. `world_state` não inclui registros individuais de jogadores. Ações interativas em andamento são canceladas ao restaurar; caminhos de navegação e efeitos transitórios são recalculados. Não se ressuscita um personagem morto nem se reseta silenciosamente um mundo finalizado.

Save v1, validação de tamanho/profundidade, números finitos, chaves perigosas, entidades/itens e versões. Um candidato separado é validado antes de substituir a simulação. Saves futuros/corrompidos são recusados. Linhas iniciais vazias criadas pelos triggers são suportadas.

## 16. Autosave e recuperação

Intervalo de 45 segundos; eventos importantes agrupados em 8 segundos; dirty flag de movimento verificada no máximo a cada 5 segundos. Não há queries nem serialização por frame. Botão Salvar na pausa e flush antes da saída. Uma falha nunca vira “Salvo”.

IndexedDB separado mantém uma cópia da tentativa de save, sem tocar configurações locais. Na reabertura, essa cópia não sobrescreve a nuvem automaticamente. Se revisão e timestamp ainda coincidem, é possível recuperar explicitamente em solo; caso contrário, pode-se exportar a cópia e continuar com a nuvem. Erro de save preserva a partida e permite retry, exportação ou encerramento explicitamente confirmado. Fechamento abrupto do navegador não garante que uma requisição assíncrona termine; existe aviso ao sair e save quando a página perde visibilidade.

## 17–18. Mundo e identidade no coop

`worldId` é metadata opcional do StartData/sala Photon/pacote LAN. Seed é conferida contra o mundo carregado. ID de ator Photon e peerId LAN permanecem intactos. A associação persistente é `{userId, playerId, actor, token da sessão de jogo, nonce}` em extra_data do próprio player_save. Esse token é o identificador público da partida, **não um token Auth**.

O cliente escreve a prova com sua sessão Auth. O host confere a prova no banco, a participação em world_members, o actor remetente real, playerId e token da partida. Somente então restaura o save e admite o ator. Checkpoints/efeitos de salas persistentes são enviados apenas a atores admitidos. Nenhum JWT, refresh token, senha ou service_role trafega na rede de jogo. A mensagem adicional não substitui os eventos de combate ou o transporte existente.

Salas temporárias continuam com o comportamento original. O convite de mundo concede participação via RPC; o código curto Photon/LAN continua servindo para entrar na sala.

## 19. Concorrência

World update exige a revisão originalmente lida e incrementa revision. Player update exige seu updated_at; INSERT concorrente na PK é conflito, sem upsert cego. Zero linhas atualizadas não é sucesso. A gravação da mesma instância é sequencial e coalesce pedidos em andamento. Conflitos interrompem retries automáticos para evitar substituir dados remotos antigos.

Player save, world_state e resumo worlds são chamadas separadas; **não formam uma transação única**. É possível ocorrer sucesso parcial, por exemplo player salvo e falha no mundo. As versões locais acompanham respostas confirmadas e a cópia local permanece para recuperação. Atomicidade entre essas tabelas exigiria outra RPC, não aprovada nem aplicada nesta fase.

## 20–21. Erros e segurança

Mensagens de rede, credenciais inválidas, e-mail não confirmado, nome em uso, rate limit, acesso negado, convite inválido e conflito são tratadas sem exibir SQL/segredos. Nenhuma policy, trigger, tabela ou função remota foi alterada pelo agente. O SQL fornecido foi lido somente como contrato.

RLS continua sendo a fronteira de autorização. `player_saves` é legível pelos membros, conforme a policy existente; não recebe segredos. O host do gameplay continua sendo um navegador, não um servidor confiável contra trapaças. Prova de conta não transforma o modelo existente em anti-cheat.

## 22. Configuração de produção

No Netlify, configure no escopo **Builds / Production**:

- `VITE_SUPABASE_URL`: URL pública do projeto fornecido.
- `VITE_SUPABASE_ANON_KEY`: chave pública anon ou publishable correspondente.
- `VITE_PHOTON_APP_ID`: manter a configuração Photon existente.
- Runtime Node **22 ou superior**, requerido pelo SDK instalado; `NODE_VERSION=24` é uma opção compatível.

Valores reais ficam fora de `.env.example`. Variáveis Vite entram no bundle durante build; editar variáveis requer novo deploy. Não houve deploy automático. No Supabase Auth, conferir Site URL de produção e Redirect URLs permitidos: `https://ltnight.netlify.app/`, `https://ltnight.netlify.app/?account=recovery`, `http://127.0.0.1:5173/` e a variante local de recuperação durante desenvolvimento. E-mail precisa ser confirmado. Recuperação PKCE exige abrir o link no navegador que iniciou a operação. Não habilitar chaves privilegiadas no frontend.

## 23–26. Validação

Baseline: build, 300 testes de domínio, dois cenários de navegador (Photon real + solo offline) e protocolo LAN aprovados. Pós-integração: 300 testes antigos novamente aprovados; testes novos de codec/configuração/RPC/CAS/autosave e navegadores estão descritos no registro de validação desta pasta.

Os testes de navegador da integração usam **respostas Supabase simuladas** com o SDK oficial, enquanto Photon/WebRTC usam transportes reais. Eles não comprovam as policies executadas no banco remoto. O usuário criou duas contas, mas dispensou preparar suas duas sessões para o teste ao vivo; portanto a validação com duas contas reais confirmadas e RLS remoto permanece **não executada**. Nenhuma senha foi solicitada ou recebida.

## 27. Problemas corrigidos durante a integração

Propriedades opcionais `undefined` de eventos/infectados são normalizadas antes de validar JSON; roundtrip de classes e conteúdo de baú foi coberto. Saves usam CAS e não fazem upsert last-write-wins. Atores não admitidos não recebem checkpoints persistentes. A prova está vinculada ao actor remetente, impedindo reutilizar apenas o playerId anunciado. A falha de rede não descarta a partida. Um teste inicialmente consultava a simulação antes do carregamento começar; a espera foi corrigida e o cenário passou.

## 28. Limitações explícitas

- Apenas o proprietário **enquanto autoridade** grava o mundo compartilhado. Após sua saída, coop/migração continuam e membros gravam seu estado individual; o mundo compartilhado deixa de ser gravado. Não foram ampliadas policies para contornar isso.
- Photon continua fechando a sala ao iniciar, como antes. Voltar com o personagem salvo funciona em uma nova sala; LAN continua permitindo entrada tardia. Não foi implementado um novo mecanismo de reconexão Photon.
- Saves de tabelas distintas não são atômicos entre si; backups dependem de espaço/permissão do armazenamento local.
- Dificuldades extras do schema não têm regras novas de gameplay.
- Verificação final com duas contas reais/RLS remoto e deploy Netlify dependem de validação posterior, dispensada pelo usuário nesta sessão.

## 29. Banco / migrations

A única migration proposta foi `001-accept-world-invite.proposed.sql`, aprovada e aplicada manualmente pelo proprietário. Nenhuma migration adicional foi executada ou é necessária para usar esta integração. Uma delegação segura de saves a outro host, ou uma operação atômica player+world, exigiria propostas futuras separadas e aprovação explícita; não foi criada policy ampla nem SQL implícito para isso.

## Atualização: fechamento da sala e permissão de hospedagem

As limitações de migração automática descritas acima foram revisadas no cliente: sem autorização, convidados saem quando o anfitrião sair. Continuar **e salvar** exige permissão explícita do dono e a migration aditiva `002-world-host-permissions.proposed.sql`, ainda **não aplicada** pelo agente. Contrato, riscos, testes e instruções estão em [hosting-permissions.md](hosting-permissions.md). A gravação delegada de estado/resumo é atômica nessa nova RPC; o save individual permanece separado.
