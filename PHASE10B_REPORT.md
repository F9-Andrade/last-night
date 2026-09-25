# LAST NIGHT — relatório da Fase 10B

Data: 24/09/2026. Implementação validada com testes determinísticos e partidas Photon reais em dois, três e quatro contextos independentes de Chromium. Os limites dos testes estão descritos abaixo. Nenhuma operação Git de escrita foi usada. Alterações de fases anteriores foram preservadas.

## Arquitetura e gameplay — 53 pontos solicitados

1. **Autoridade adotada:** MasterClient coordena `CoopWorld` no navegador. O cliente prevê câmera/movimento/apresentação; requests são resolvidos uma vez e publicados.
2. **Limitações da autoridade:** não é servidor confiável. Movimento e Master podem ser adulterados; sem anti-cheat competitivo, banco de dados ou consenso externo.
3. **Protocolo:** v2, build `santa-luz-10b-1`, separado do v1 também por appVersion Photon. Eventos 10–15 complementam presença/start.
4. **Registry:** registro tipado com consulta, remoção, contagem e rejeição de IDs duplicados.
5. **IDs:** prefixos infected/container/door/weapon/player. IDs numéricos de infectado e arma, IDs estáveis de locais, UID inicial por actor. Não se usa índice de array como identidade.
6. **Spawn:** coordenador cria encontro uma vez por local e considera proximidade de qualquer sobrevivente. Mesmo ID/tipo/HP para todos. Aleatoriedade compartilhada só é executada ali.
7. **IA:** uma atualização de mundo por passo; Walker/Runner/Tank/Spitter/Screamer preservados. Alvo pode ser qualquer vivo e ruído de qualquer jogador influencia investigação.
8. **Snapshots:** checkpoint essencial completo no início/recuperação; patches por revisão depois. Movimento de infectados usa lote numérico separado. Paths não são transmitidos.
9. **Relevância:** distância ao membro mais próximo, três faixas. Ainda é interesse por grupo, sem lista distinta por destinatário.
10. **Interpolação:** jogadores mantêm buffer da 10A; infectados têm atraso de 150 ms, máximo 24 amostras, yaw curto e correção de saltos grandes.
11. **Combate:** apresentação local imediata; dano confirmado pelo coordenador; efeitos compartilhados e hitmarker confirmado.
12. **FireRequest:** arma, shot sequence, seed, ADS/bloom/kick e pose com timestamp. Não aceita valor de dano do cliente.
13. **Validação:** vida, sequência, equipamento, ammo, posição próxima à presença, cadência, reload e troca. Rate limit por remetente. Timestamps ainda não fazem rewind.
14. **Hitscan:** reutiliza colisão do mundo e volumes anatômicos, preservando alcance/spread/regiões.
15. **Shotgun:** oito pellets determinísticos em um request; uma munição; impactos agregados por vítima. Recarga por cartucho mantida.
16. **Projéteis:** Spitter publica origem/destino/idade do ácido. Réplicas animam o voo; dano/persistência são calculados no coordenador.
17. **Headshots:** resolução única com zona, dano e HP restante. Morte por headshot confirmada no teste real de dois clientes.
18. **Damage:** HP de infectados/jogadores compartilhado. Friendly fire desligado; companheiro não bloqueia raycast.
19. **Morte:** infectado fica inativo uma vez, com evento identificado; eventos repetidos de tiro não reaplicam morte/drop.
20. **Cadáver:** ID e estado inicial/lifetime coordenados, animação local; duração normal 30 s + 4 s de fade, com envelhecimento distante do sistema existente.
21. **Loot drop:** seis munições por infectado morto, ID derivado dele. Caixa visual por instancing; retirada remove o drop para todos.
22. **Pickups:** request de interação → validação de foco/distância/entidade → concessão serializada → estado compartilhado. Arma no chão mantém UID.
23. **Loot race:** teste unitário e dois clientes Photon com E na mesma caixa. Só um recebeu 36 munições; o outro recebeu zero e feedback de item já recolhido.
24. **Inventário:** individual, incluindo mochila, depósito e loadout. TAB funcional no teste real; mutações passam pelo coordenador.
25. **Ammo:** magazine/reserva mantidos por ator; reconciliação após confirmação, sem duplicação em recarga ou pickup.
26. **Reload:** duração e transferência da arma existente, com previsão visual. Sprint cancela também no coordenador; shotgun pode interromper recarga para disparar.
27. **Armas remotas:** world model usa arma equipada do estado compartilhado, flash/recoil e pose básica de reload. Viewmodel permanece local.
28. **Áudio remoto:** evento usa posição do atirador, StereoPanner e atenuação. Corrigido ruído sintetizado que ignorava pan/volume. Verificação automatizada dos parâmetros não é avaliação subjetiva por audição.
29. **Player HP:** mantido por ator no coordenador e exibido no HUD do grupo. Inclui melee/ácido e cancelamento de ações por dano.
30. **Downed:** zero HP incapacita, oculta arma e impede andar/atirar; câmera livre e corpo caído remoto.
31. **Bleedout:** 45 s de tempo da simulação. Sem espera no solo. Após terminar, morto observa do lugar da queda; sem respawn/câmera de perseguição.
32. **Revive:** E por 4 s a até 2,6 m com linha livre; restaura 40 HP/proteção de 2 s. Afastamento, soltura, dano, tiro e mudança de conexão interrompem; dois revivers produzem um resultado.
33. **Wipe:** todos downed/dead encerram partida no fluxo de derrota existente; reinício exige voltar ao menu/reunir sala.
34. **HUD coop:** HP e estado de cada membro, timer de bleedout e progresso/prompt de revive. Layout existente preservado.
35. **Portas:** abertura/fechamento/janela/HP replicados por ID. Testes determinísticos de simultaneidade e reais de A abrir/B fechar/reabrir.
36. **Containers:** caixas, armários, depósitos e porta-malas sincronizados. Facilities concedem recompensa uma vez. Gerador só desbloqueia depósito e faz ruído inicial; alarmes/eventos complexos estão desativados no coop.
37. **MasterClient migration:** saída real de A com mundo alterado transfere a coordenação para B. B continuou e matou o infectado sobrevivente.
38. **Recuperação:** último checkpoint válido preserva infectado com 37 HP, morto ausente, porta aberta, loot vazio, jogador com 80 HP e inventário. Cancela buscas/revives; sem checkpoint há erro explícito. Pedidos em trânsito podem se perder.
39. **Desync detection:** revisão/hash, entidades/infectados, idade do snapshot, mensagens descartadas e histórico limitado de efeitos. Hash só deve ser comparado na mesma revisão.
40. **Bandwidth:** medição em `stress-photon.json` usa frames WSS reais, excluindo TLS/TCP/IP. `stress-simulation.json` mede JSON UTF-8, sem chamar isso de tráfego real. Full checkpoint é maior que patches; não se usa room property por tiro.
41. **Send rates:** presença 20 Hz nominal; movimento de infectados até 10/4/1 Hz; checkpoint/patch 2 Hz, antecipado em ações críticas. Patches também levam posição: piso efetivo distante 2 Hz. Timers dependem da carga do browser.
42. **Performance:** benchmark CPU independente e teste gráfico/transporte separados. SwiftShader não foi tratado como GPU. Chromium também conseguiu usar `ANGLE (AMD, AMD Radeon RX 6650 XT (radeonsi navi23 ACO), OpenGL ES 3.2)`; resultados finais registrados abaixo.
43. **Dois clientes:** passou no Photon real: tiros em ambas direções, hit/headshot/morte/corpo, mochila, corrida por loot, portas e migração com continuação do combate.
44. **Três clientes:** passou no Photon real: shotgun, disparos de membros distintos, Runner derrubando B, interrupção/retomada de revive, 40 HP, loot, bleedout real e wipe.
45. **Quatro clientes:** passou com GPU real: disparos de todos os membros, shotgun, Runner derrubando B, revive interrompido/concluído, loot comum, bleedout, áudio espacial parametrizado e wipe. A execução lenta em SwiftShader foi interrompida; não conta como aprovação.
46. **Stress test:** CPU com 1/2/3/4 atores e pedidos 10/25/50/100; os dois últimos respeitam cap de 40. Transporte/browser com quatro clientes tem evidência separada. Não foi alterado balanceamento para fabricar um teste de cem.
47. **Regressão solo:** suíte determinística preservada e caso de navegador offline aprovado para combate, loot, mochila, porta, fase noturna e morte imediata. O avanço/orçamento da horda também permanece coberto pelos testes determinísticos anteriores.
48. **Bugs encontrados:** bloqueios deliberados da fundação 10A; drop sem representação; facilities não sincronizadas; áudio sintetizado sem pan/atenuação; reload coordenado ignorava sprint; hold podia atrasar reconciliação; cadáveres poderiam envelhecer por ator; timer negativo de infectado poderia invalidar checkpoint longo; prompt de revive reaparecia vazio entre updates; pose remota caía parcialmente sob o chão.
49. **Bugs corrigidos:** fluxo ativo de requests/resultados, instancing de drops, facilities no checkpoint/patch, pan na síntese, flags de movimento preservadas no ator, sequência de reconciliação separada do hold, avanço de cadáver uma vez, schema de timers corrigido, visibilidade do prompt preservada entre updates e corpo caído posicionado acima do piso. Testes também corrigiram duas fixtures: esperar busca terminar e não spawnar sobre um drop existente.
50. **Limitações restantes:** Master não confiável, sem rewind, sem late join/rejoin, pausa local não pausa mundo, migração sem consenso/zero perda, Director/hordas/eventos/alarme/progressão de dia e construção fora do coop. Nenhuma 10C iniciada. Medição em uma máquina não substitui playtest de amigos em redes distintas.
51. **Arquivos principais:** `src/network/{entities,gameplay-protocol,coop-world,coop-session,checkpoint,world-patch}.ts`, integração em manager/protocol, Simulation/main, remote-players/scene/survival-view/audio, HUD/CSS coop e documentação. Nenhuma troca de SDK/engine/framework.
52. **Testes adicionados:** `tests/coop.test.ts`, `tests/coop.spec.ts`, `playwright.coop.config.ts`, `scripts/coop-stress.ts`; script npm `test:coop`. Teste histórico de presença passou a esperar infectados na v2.
53. **Recomendações para 10C:** manter coordinator único, migrar Director/hordas/eventos/relógio com IDs e checkpoints explícitos, medir interesse por destinatário se necessário, decidir recuperação/rejoin e ampliar playtest com GPUs/redes distintas. Não iniciar sem novo pedido.

## Validação final

Bateria principal: 5 testes de navegador passaram em 5,1 minutos. Stress com métricas ampliadas e caso visual passaram separadamente; o ajuste final da pose foi conferido novamente. Não foram usados mocks do Photon. Fixtures só preparam entidades/posições no coordenador de teste; interações e resultados atravessam o transporte real. Evidências em `docs/phase10b/`.

| Verificação | Estado |
|---|---|
| TypeScript + build | Passou |
| Regressão determinística | 167 testes: 150 anteriores + 17 de coop; zero falhas |
| Photon real — 2 clientes | Passou |
| Photon real — 3 clientes | Passou, inclusive repetição com GPU real |
| Photon real — 4 clientes | Passou com GPU real |
| Stress de coordenador | Passou; 16 combinações, cap preservado |
| Stress Photon/GPU | Passou com quatro clientes, 10/25/40 infectados |
| Solo offline no browser | Passou sem conexão Photon |
| Inspeção visual | Corpo caído, revive, mochila e arma remota conferidos |
| Hooks de teste no build | Ausentes: `__LAST_NIGHT__`/`coopFixture` não aparecem no bundle |
| `git diff --check` | Passou |



## Métricas reais

Chromium headless com Radeon RX 6650 XT via ANGLE/OpenGL, qualidade baixa, 960 × 640, escala 1. Quatro clientes no mesmo computador e sala Photon real. Amostras curtas de cerca de 3,5 s por cenário; não são benchmark prolongado nem garantia em outras máquinas. FPS foi 60 em todos os quatro clientes nas amostras abaixo.

| Pedido / vivos reais | Draw calls (quatro clientes) | Envio Master (KiB/s WSS) | Recebimento convidado (KiB/s WSS) | CPU Master (ms de renderer/s) | Idade checkpoint (ms) |
|---|---|---:|---:|---:|---|
| 10 / 10 | 187–204 | 22.8 | 26.0–26.3 | 373 | 416–430 |
| 25 / 25 | 280–307 | 50.6 | 54.0–54.3 | 413 | 38–59 |
| 50 / 40 | 371–415 | 80.1 | 83.8–84.0 | 438 | 474–495 |
| 100 / 40 | 362–416 | 80.2 | 83.9–84.2 | 426 | 16–33 |

Variação dos intervalos de chegada de frames WSS: desvio padrão de 10.1–17.2 ms. Inclui tipos de mensagem diferentes e scheduling do browser; **não é jitter de latência isolado**. CPU usa CDP TaskDuration do renderer, excluindo GPU. Bytes incluem framing Photon, excluem TLS/TCP/IP. Taxas de eventos/RTT/amostras completas constam do JSON.

Benchmark determinístico separado: 16 combinações de 1/2/3/4 jogadores e pedidos 10/25/50/100, com cap de 40. Média de passo de simulação entre 0,19 e 1,42 ms; maior p95 1,90 ms nesta execução. Isto não mede render/transporte. Arquivos: `stress-simulation.json` e `stress-photon.json`.

Os testes de gameplay não colocaram jogadores em máquinas/redes físicas distintas. Não houve avaliação subjetiva do som por uma pessoa, nem execução de cem infectados simultâneos. Late join/reconnect e a Fase 10C não foram implementados.

Nenhum commit ou push foi realizado.
