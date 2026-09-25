# LAST NIGHT — Fase 10A: implementação e validação

**Estado: implementação funcional; validação final incompleta.** Dois clientes passaram pelo fluxo real completo. Quatro clientes chegaram ao gameplay com três avatares remotos por cliente. A suíte de quatro clientes ainda não passou integralmente: o teste expirou aguardando `load` após refresh. O teste foi ajustado para aguardar `domcontentloaded`, mas a reexecução foi bloqueada pela revisão automática de aprovação por limite de uso da conta. Não houve fallback, mock de salas ou início da Fase 10B.

## Relatório solicitado

1. **SDK:** pacote `photon-realtime`, publicado pela Exit Games, para Photon Realtime JavaScript.
2. **Versão:** 4.4.0, fixada no package.json/lockfile.
3. **Escolha:** verificação prévia no catálogo e referência oficiais; adequado à aplicação browser TypeScript/Three.js. Links e termos em [MULTIPLAYER.md](MULTIPLAYER.md).
4. **Vite:** importação dinâmica do CommonJS e substituição oficial do transporte padrão Node pelo `WebSocket` nativo via `PhotonPeer.setWebSocketImpl`. Build de produção passou; conexão real foi testada no servidor Vite de desenvolvimento. Ainda falta smoke test executando o bundle de produção.
5. **App ID:** centralizado em `VITE_PHOTON_APP_ID`. É configuração pública do cliente; não é tratado como senha.
6. **Ambiente:** `.env.local` configurado com o ID fornecido; `.env.example` sem ID real.
7. **Gitignore:** ambientes ignorados, exceto exemplo. `git check-ignore .env.local` confirmou a exclusão. Nenhuma credencial administrativa foi adicionada.
8. **NetworkManager:** possui transporte, callbacks, regiões, sala, identidades, envio/recepção, deadlines e descarte da conexão anterior. Renderer/UI permanecem separados.
9. **Estados:** disconnected, connecting, connected, joining, lobby, loading, playing, error; falhas recuperáveis de join retornam à tela conectada. Os controles refletem operações pendentes.
10. **Protocolo:** v1, build `santa-luz-10a-1`; eventos 1 PlayerSnapshot e 2 GameStart. Valida formato, tamanho, números, atores, versões e estado de sessão.
11. **Códigos:** seis caracteres; prefixo de região e cinco caracteres aleatórios sem I/L/O/0/1; colisões no servidor têm tentativas limitadas. Não é senha forte.
12. **Criação:** privada/não listada, quatro vagas, TTL zero para participantes/sala vazia. A seleção de região mede handshake de PhotonPeer; não é o algoritmo Best Region de outro SDK.
13. **Entrada:** normaliza código, valida e conecta à região do criador. Join nunca cria sala inexistente. Códigos inválidos foram testados na UI.
14. **Lobby:** quatro posições, identificação do próprio jogador, líder, estado de pronto, código, botão de copiar e link de convite.
15. **Ready:** alternância pronta/não pronta verificada em dois navegadores reais, bloqueando/liberando start no host.
16. **Host:** MasterClient resolvido pelo método do SDK, incluindo fallback ao menor actor number. Troca de líder confirmada no lobby e, no cenário de dois clientes, em gameplay.
17. **Start:** host fecha sala, publica loading e envia seed/token/membros; todos carregam, confirmam loaded e recebem playing. Dois e quatro clientes atingiram playing com a mesma cidade. Corrida de entrada simultânea ao fechamento ainda precisa de teste específico.
18. **Room properties:** protocol, build, seed, gameState, token. AppVersion Photon também isola builds/protocolos; uma sala de outro appVersion aparece como inexistente.
19. **Player properties:** displayName, playerId, ready, loaded; UUID por conexão e actor number por sala. Nome de 2–20 caracteres, sanitizado e persistido localmente.
20. **Avatar:** corpo voxel articulado, cabeça, pernas, braços e pistola de mundo; não cria câmera nem usa viewmodel remoto. Nametag com profundidade/fade/distância; não há tag própria.
21. **Spawn:** quatro posições distintas e verificadas sem colisão no cenário, atribuídas pela ordenação de actor numbers, perto do abrigo.
22. **Posição:** snapshot do jogador local alimentado pela simulação fixa e publicado em timer separado; remotos não controlam física local.
23. **Rotação:** yaw pelo arco curto e pitch aplicado à cabeça/braços. Rotação recebida confirmada entre dois clientes.
24. **Locomotion:** idle, walk, run e crouch; corrida/agachamento testados no outro cliente. Não foi inventado salto: o jogo atual não tem jump funcional.
25. **Send rate:** nominal de 20 Hz, sem rajadas acumuladas; taxa real dependente da thread principal. Nas amostras finais houve aproximadamente 9–20 envios/s sob renderização por software.
26. **Interpolação:** atraso 120 ms, até 32 amostras, extrapolação máxima 100 ms; correção imediata acima de 8 m, repouso após amostra obsoleta. Jogador local não é interpolado.
27. **Sequence/time:** sequence monotônica e timestamp do emissor; duplicatas, sequências antigas e relógio regressivo são rejeitados. Offset entre relógios é estimado com ajuste gradual.
28. **Disconnect:** sair pelo menu remove o participante e o avatar do outro cliente; passou com dois clientes. Perda abrupta de rede possui tratamento, mas teste browser específico permanece pendente.
29. **Host leave:** confirmado no lobby com outros jogadores e em gameplay com dois. Continuidade refere-se à presença; não representa migração de IA/dano autoritativos.
30. **Reconnect/rejoin:** reconexão explícita pela UI; sem restauração de sessão iniciada. Sala permanece fechada após start. Refresh não deve duplicar jogador, mas o teste completo ainda precisa terminar.
31. **Cleanup:** invalidação de callbacks antigos, disconnect, cancelamento de probes/deadlines/ticker, limpeza de atores/buffers e remoção de meshes/texturas/materiais exclusivos. Geometrias compartilhadas são preservadas. Falta ensaio prolongado de memória em repetidas entradas/saídas.
32. **UI:** estética existente, nome, sala, pronto, status/erros, loading e HUD do grupo. ESC pausa apenas input local. Lobby encobre cenário e reduz atualização de fundo. Casos 1920×1080, 1600×900 e 1366×768 foram preparados em teste, ainda não executados.
33. **Solo:** continua no caminho original da simulação, sem conectar Photon. Entrada no solo com contexto offline passou. A suíte browser FPS completa ainda não foi reexecutada nesta fase.
34. **Unitários:** 150 testes passaram, incluindo dez novos testes de rede/modo de exploração. `npm run build` passou (TypeScript estrito + Vite). Descoberta dos quatro testes Playwright também passou; descoberta não equivale à execução.
35. **Photon real:** salas criadas no serviço real, membros reais em contextos independentes, sem simular callbacks. Teste de latência encaminha frames ao Photon real com atraso controlado.
36. **Máximo testado:** cinco clientes conectados ao serviço; quatro simultaneamente na sala/jogo e quinto rejeitado por lotação. Não excede a capacidade de 20 CCU informada pelo usuário.
37. **Dois clientes:** teste integral passou em 58,7 s na rodada final. Pronto/cancelamento, start, A→B/B→A, corrida, agachamento, olhar, ESC com tráfego ativo, saída, sucessão, limpeza e solo offline.
38. **Três clientes:** lobby confirmado durante a rodada de expansão; screenshot preservado. Não houve rodada separada de gameplay somente com três participantes.
39. **Quatro clientes:** gameplay confirmado em todos, três avatares por cliente e quinto rejeitado. O caso completo falhou depois, no `page.reload()` aguardando load por 45 s. Ajustado para DOMContentLoaded/90 s, ainda sem reexecução. Não declarar a suíte aprovada.
40. **Latência:** região sa; amostras sem atraso artificial com RTT de 10–13 ms. Com atrasos adicionados de 50/100/150/200 ms e jitter entre −6/+12 ms, RTT observado foi 206/162/187/303 ms. A carga local e o momento do ping afetam essas medidas. Todos os quatro cenários passaram; erro de posição após parar ficou abaixo de 0,005 unidade. Isso não comprova suavidade perceptual em hardware real.
41. **Bandwidth:** payload de movimento médio aproximadamente 37–40 bytes nas amostras finais, sem encapsulamento. A 20 Hz, cerca de 0,74–0,8 kB/s por emissor; com três remotos, aproximadamente 2,2–2,4 kB/s recebidos apenas de payload. Relay real mediu TX 0,47–0,98 kB/s e RX 1,43–1,57 kB/s com encapsulamento Photon, excluindo TLS/TCP/IP, nas taxas efetivamente observadas. Não extrapolar como benchmark definitivo de quatro clientes.
42. **Performance:** Chromium SwiftShader, qualidade baixa, viewport 960×640, deviceScaleFactor 0,5 na rodada de quatro. Amostras de 1 FPS, 197–241 draw calls, 274–287 mil triângulos. Não é desempenho aceitável para jogar nem benchmark de GPU real. Buffers permaneceram ≤32; houve descartes de lotes em clientes sobrecarregados (até 210 na amostra). Validação visual de fluidez com GPU e redes distintas permanece pendente.
43. **Screenshots:** `docs/phase10a/`: create-room, invalid-code, lobby-two, host-ready, lobby-three, lobby-four, room-full, gameplay-two, gameplay-four, pause-online e connection-smoke. Capturas de sala fechada, conexão perdida e resoluções maiores continuam pendentes. Algumas imagens foram capturadas com escala de dispositivo reduzida; não devem ser apresentadas como capturas Full HD.
44. **Bugs/questões encontrados:** host ID pode exigir fallback do SDK; transporte publicado é Node por padrão; filtro de intervalo mínimo descartava lotes TCP legítimos; painel coop reaparecia após saída; browser por software atrasou navegação; sala simultaneamente cheia/fechada retorna erro de lotação primeiro.
45. **Correções:** transporte WebSocket nativo; método oficial de MasterClient; token bucket por ator; estado de apresentação encerrado ao jogar; input bloqueado durante loading; velocidade zerada ao pausar; cenário de fundo do lobby limitado; timeout de refresh do teste ajustado. A última alteração do teste ainda não foi exercitada.
46. **Limitações:** validação final incompleta; navegador WSS/TCP pode sofrer head-of-line blocking e throttling; sem reconexão automática, anticheat ou autoridade de gameplay. Fechamento, ausência de configuração, perda de rede, incompatibilidade e convite/clipboard ainda precisam de cobertura browser concluída. Não declarar a Fase 10A totalmente encerrada.
47. **Não sincronizados:** combate, tiros, dano/HP, downed/revive/morte, inventário, loot, infectados/IA, hordas, TensionDirector, eventos, portas interativas e persistência. Exploração coop usa dia congelado e entradas abertas; HUD informa a limitação. Sem chat, voz, contas, matchmaking público ou Fase 10B.
48. **Arquivos principais:** `src/network/*`, `src/render/remote-players.ts`, `src/ui/coop.ts`, `src/ui/coop.css`, `src/main.ts`, `src/game/simulation.ts`, `src/render/scene.ts`, `src/render/models.ts`, `src/ui/layout.ts`, `tests/network.*`, `playwright.network.config.ts`, package.json/lock, ambientes/gitignore, README e MULTIPLAYER.md. Alterações preexistentes das Fases 8/9 foram preservadas.
49. **Dependências:** direta photon-realtime 4.4.0; transitiva ws 8.21.3. Chromium de teste baixado em `/tmp/last-night-browsers`; nenhuma migração de stack.
50. **10B:** somente após fechar pendências 10A, definir autoridade, IDs de entidades, validação de hits, HP/revive, inventário/loot/portas, regras de late join e migração. Não assumir MasterClient como servidor confiável.

## Retomada exata

1. Reexecutar `npm run test:network -- --grep 'four slots|deleted room'` com Chromium disponível e conectividade ao Photon. O bloqueio atual veio da revisão automática de aprovação por limite de uso, não de falha de autenticação Photon. Não contornar esse bloqueio por outro meio de execução.
2. Resolver o que esses casos encontrarem e completar captura responsiva, erro de sala, refresh, perda de conexão e metadados incompatíveis.
3. Verificar clipboard/convite, App ID ausente, nametag ocluído/distante e limpeza prolongada; smoke test do bundle de produção e regressão browser FPS.
4. Playtest com GPU real para movimento suave e desempenho de quatro jogadores; os números de SwiftShader não satisfazem esse critério perceptual.
5. Atualizar este relatório com evidências novas; não iniciar 10B e não executar Git de escrita.

Evidências numéricas: [dois clientes](docs/phase10a/two-clients.json), [quatro clientes](docs/phase10a/four-clients.json), [latência](docs/phase10a/latency.json). Instruções técnicas: [MULTIPLAYER.md](MULTIPLAYER.md).

**Nenhum commit ou push foi realizado.**
