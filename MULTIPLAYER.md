# LAST NIGHT — multiplayer, Fase 10B

A 10B acrescenta combate, infectados, inventário individual, loot compartilhado, portas, HP e downed/revive à conexão Photon e ao lobby da 10A. O histórico dos testes da fundação está em `PHASE10A_REPORT.md`; a validação da implementação atual está em `PHASE10B_REPORT.md`.

## Executar

Stack preservado: TypeScript 5.9.3, Three.js 0.180.0, Vite 7.3.6, DOM/CSS e simulação própria. Photon Realtime JavaScript **4.4.0**, fixado no package.json, é carregado apenas ao abrir o coop. npm é o package manager; Node 26.8.2/npm 12.0.2 foram usados nesta implementação. Nenhuma engine ou framework novo.

1. Instale as dependências com `npm ci`.
2. Configure `VITE_PHOTON_APP_ID` em `.env.local`, usando um aplicativo Photon Realtime. `.env.example` é o modelo público, sem credenciais administrativas.
3. Rode `npm run dev`. Reinicie o Vite após alterar variáveis de ambiente.
4. Em dois a quatro navegadores/contextos, abra **Coop online**, crie uma sala, compartilhe o código e marque pronto nos convidados. O líder inicia.
5. WASD move; Shift corre; C agacha; mouse dispara/mira; R recarrega; 1/2 troca arma; TAB abre mochila; E interage; H usa bandagem; segure E perto de um colega caído para reviver. ESC pausa apenas seus controles: o mundo online continua.

Sem App ID, a interface informa que o coop está indisponível; solo não precisa do SDK/conexão. Sem internet, uma página já carregada pode jogar solo. Isto não implementa instalação offline/PWA. `VITE_*` é público no bundle; o App ID não é senha. Não publique chaves administrativas. As exclusões existentes de `.env`, `.env.*` e `*.local` permanecem; `.env.example` é a exceção.

### Deploy na Netlify e carregamento

`netlify.toml` centraliza a configuração do build publicado: `npm run build`,
diretório `dist` e o App ID público Photon Realtime usado por este jogo. O arquivo
local `.env.local` é ignorado pelo Git e não chega a um build remoto. O Vite lê
`VITE_PHOTON_APP_ID` durante a compilação; um novo deploy é necessário para alterar
essa configuração. A validação em `vite.config.ts` impede builds Netlify sem um ID
válido. Não há senha do dashboard, token da Netlify ou chave administrativa nesses
arquivos. Ao trocar o aplicativo Photon, atualize a configuração de deploy e o
ambiente de desenvolvimento para usar o mesmo aplicativo.

A tela de carregamento prepara os shaders, os recursos da área inicial e o áudio
antes de liberar a partida. No coop, a confirmação `loaded` só é enviada depois
de concluir essa preparação. O coordenador aguarda todos os clientes; o mundo não
avança durante a espera. A conclusão de um carregamento cancelado não envia uma
confirmação para outra conexão.

## Transporte, salas e ciclo preservados

SDK CommonJS convertido pelo Vite; `PhotonPeer.setWebSocketImpl(WebSocket)` seleciona WebSocket nativo antes da conexão. WSS/TCP, sem UDP ou servidor de gameplay adicional. O serviço Photon transporta mensagens; **não executa nossa simulação**.

Estados: disconnected → connecting → connected → joining → lobby → loading → playing, com error e deadlines explícitos. Callbacks antigos são invalidados por geração. Regiões são escolhidas por aproximação de latência de handshake WSS; o prefixo do código leva os convidados à mesma região.

Sala privada não listada, quatro vagas, código de seis caracteres, TTL zero, sem late join/rejoin. UUID por conexão e actorNumber da sala identificam jogadores; nomes são sanitizados. A sala fecha ao iniciar e continua fechada após saídas. Refresh exige nova sala aberta, sem restauração silenciosa. Código é um convite conveniente, não senha forte. Room properties guardam versão/build/seed/estado de início; não são o canal de combate em tempo real.

## Coordenação e fronteira de confiança

**O MasterClient é um coordenador rodando em um navegador. Não é um servidor autoritativo confiável nem proteção contra cheating.** Ele simula IA uma vez, resolve tiros, mantém HP/inventários e aplica mutações do mundo em sequência. Um cliente malicioso ainda pode falsificar seu movimento; um Master modificado pode alterar toda a sessão. O modelo é um protótipo coop entre amigos.

Cada cliente mantém input, câmera, movimento, recoil, som de tiro e viewmodel imediatos. `CoopSession` envia intenções ao coordenador e aplica estados confirmados. `CoopWorld` tem uma `Simulation` para o mundo e uma por sobrevivente para inventário, equipamento e timers. Essas instâncias compartilham referências das entidades do mundo; apenas `updateCoopWorld` executa IA/ácido/cadáveres. A réplica não causa dano, não sorteia loot nem roda Director/hordas.

Separar requests, resolução de `CoopWorld` e DTOs de estado deixa um ponto de integração futuro para mover a lógica crítica para infraestrutura confiável. Isso ainda não foi feito.

## Identidades e arquivos

`NetworkEntityId` usa prefixo + identificador estável: `infected:42`, `container:base-ammo`, `container:infected-42`, `door:hospital-main-front`, `weapon:7`, `player:2`. Armas iniciais têm UID distinto por actor. Não há identidade por índice de array ou referência JavaScript. Containers/portas do cenário usam os IDs existentes. Decoração não entra no registry.

`NetworkEntityRegistry` oferece registrar, consultar, remover, limpar, contar e rejeitar duplicação. O coordenador registra infectados vivos, containers, facilities, portas, armas e jogadores. IDs de cadáveres preservam o infectado morto; o registry de gameplay remove o infectado vivo.

- `src/network/manager.ts`: Photon, sala, participantes, presença, roteamento/ticker e contadores.
- `protocol.ts`: protocolo/build, início, presença e identidades de jogadores.
- `entities.ts`: IDs e registry.
- `gameplay-protocol.ts`: configuração coop, eventos, schemas de requests e seed de tiro.
- `coop-world.ts`: decisões compartilhadas e checkpoint de recuperação.
- `coop-session.ts`: input previsto, requests, confirmações, interpolação e migração.
- `checkpoint.ts` / `world-patch.ts`: schemas, hash diagnóstico e patches versionados.
- `src/game/simulation.ts`: regras existentes reutilizadas em solo, ator coordenado e réplica.
- `src/render/remote-players.ts`: arma de mundo, reload e pose incapacitada.
- `src/ui/coop-gameplay.ts`: HP do grupo, bleedout e progresso de revive.

## Protocolo v2

Build `santa-luz-10b-1`. Versão também integra appVersion Photon: v1 e v2 não entram silenciosamente na mesma sessão. Uma versão isolada por appVersion pode aparecer como sala inexistente; erro explícito de incompatibilidade cobre metadados divergentes na mesma aplicação.

| Código | Mensagem | Remetente e destino |
|---|---|---|
| 1 | PlayerSnapshot | Jogador → demais, presença em array de 11 números |
| 2 | GameStart | Master → demais no lobby |
| 10 | ActionRequest | Jogador → Master, ação tipada + sequência + pose |
| 11 | WorldCheckpoint | Master → demais, estado essencial completo |
| 12 | InfectedMotion | Master → demais, lote compacto numérico |
| 13 | Effects | Master → demais, eventos transitórios confirmados |
| 14 | WorldPatch | Master → demais, alterações desde revisão anterior |
| 15 | RecoveryRequest | Réplica → Master quando não consegue aplicar patch |

Pedidos: fire/reload/switch/heal/cancel/interact/hold/inventory/store/retrieve. HP, morte, pickups, inventário e portas são estado persistente. Partículas, sons, flashes e hitmarkers são eventos, sem física de partículas na rede. Checkpoint omite paths da IA e dados visuais pesados; path é refeito na migração. Não se transmite uma instância inteira de `Simulation`.

Schemas limitam tamanho/profundidade, números finitos, IDs de armas, estoques não negativos, entidades únicas, vida/HP compatíveis e limites de mundo. Requests rejeitam tipos/valores inválidos; o autor é o actorNumber autenticado pelo transporte. As mensagens de resultado só são aceitas do Master atual. Sequências repetidas são rejeitadas. Orçamento por remetente permite 40 mensagens em lote e recompõe 30/s para ações, separado do orçamento de presença. Isto não é anti-cheat competitivo.

## Combate e IA

O cliente prevê somente apresentação e débito local de munição. FireRequest contém arma, sequência de tiro, pose com timestamp, ADS, bloom/kick e seed derivada de actor+shot. O coordenador verifica estado vivo, posição próxima à última presença, equipamento, munição, reload, troca e cadência. O dano vem da configuração da arma, nunca de um número informado pelo jogador.

O hitscan existente resolve paredes, alcance e volumes anatômicos. Shotgun mantém oito pellets: um request/uma munição, impactos agregados por vítima; eventos visuais são enviados em lote. Headshot, feridas, reação, HP final e morte saem da mesma resolução. Evento de hit carrega entidade, região, dano aplicado e HP restante. Hitmarker aparece somente após confirmação. Não há rollback/rewind: o tiro usa a posição atual do infectado no coordenador, enquanto a réplica apresenta histórico interpolado. Latência pode causar diferença entre a mira percebida e a validação.

Friendly fire desligado: companheiros são ignorados pelo hitscan e não bloqueiam tiros. Reload conserva magazine/reserva e duração; shotgun mantém recarga por cartucho/interrupção. Inventário é reconciliado após confirmação da última intenção crítica, sem uma confirmação de hold bloquear tiros anteriores.

Walker, Runner, Tank, Spitter e Screamer reutilizam suas regras. Alvo pode ser qualquer sobrevivente vivo; ruído de qualquer atirador chama a IA. Spitter possui projétil de ácido com origem/destino/idade e dano coordenado; réplicas animam a trajetória entre snapshots. Só o coordenador nasce/mata infectados e avança cadáveres. Drop de munição de seis unidades por infectado é criado uma vez; IDs mortos não são reutilizados. Os encontros locais ativam uma vez por local, perto de qualquer jogador; a pressão contínua de Director/hordas está reservada para 10C.

## Loot, inventário e mundo

Cada jogador tem mochila, munição, bandagens, loadout e depósito individuais. O coordenador processa pickup/search em sequência sobre os mesmos objetos. Quem completa primeiro recebe o que couber; sobras continuam no container. O perdedor recebe feedback discreto. Não existe inventário global.

Caixas do mapa, armas no chão, drops, armários e porta-malas compartilham IDs/estado. Portas e janelas usam os estados existentes; abertura, fechamento, quebra e HP são replicados. Geradores apenas liberam o depósito associado e fazem o ruído inicial; sem pulso/evento mundial independente. Porta-malas não dispara alarme no coop desta fase. Facilities não concedem recompensa duas vezes e persistem na migração.

Bancada/perks, construção/reparo do abrigo, alarmes, eventos aleatórios, rotas de campanha, Director, hordas e progressão do ciclo não estão ativos no coop. Prompts de construção foram removidos. O cenário mantém a mesma fase inicial de iluminação, sem quatro relógios avançando de forma independente. Solo conserva esses sistemas.

## HP, queda e revive

HP só é decidido no coordenador. Zero HP → downed, com câmera ainda controlável, corpo caído, arma oculta e sem movimento/disparo. Bleedout: **45 segundos de simulação**. Segurar E a até **2,6 m**, com linha livre, por **4 segundos** revive com **40 HP** e dois segundos de proteção.

Soltar E, perder alcance/linha de visão, ser atingido, disparar, perder alvo ou mudar a conexão cancela revive. Hold expira após 0,4 s sem renovação. Dois colegas não duplicam o resultado. Ao esgotar bleedout, o morto observa do local da queda, com câmera livre; não há respawn nem câmera seguindo outro jogador. Todos downed/dead → derrota do grupo. Solo mantém morte imediata normal.

## Replicação, interesse e recuperação

Presença: 20 Hz nominal, buffer 32/120 ms já existente. Infectados: lotes de movimento a até 10 Hz próximos (<30 m), 4 Hz médios (<70 m), 1 Hz distantes, usando distância ao jogador mais próximo. Mensagem é comum aos destinatários: relevância é por grupo, ainda não por assinaturas individuais. Buffer de infectados: até 24 amostras/150 ms, sem extrapolação, yaw pelo arco curto. Checkpoints/patches a cada 0,5 s também corrigem posição, portanto a frequência efetiva de estado distante tem piso de 2 Hz.

Checkpoint inicial completo, depois patches de entidades alteradas + estado dos jogadores, com base/revisão. Ações e resultados críticos antecipam publicação. Inventário não vai em todos os frames de render, mas integra os registros de jogadores nesses patches. Mensagens comuns em JSON, sem binário prematuro; métricas distinguem bytes do payload e frames WSS observados nos testes.

Ao trocar Master, o sucessor reconstrói o mundo do último checkpoint válido: IDs/counters, infectados vivos e HP, loot/facilities, portas, corpos/ácido e inventários/HP/downed. Remove o participante que saiu, cancela buscas/revives e recalcula caminhos. Publica um checkpoint completo antes de retomar patches. Sem checkpoint válido, exibe erro explícito, sem reset silencioso. Patch incompatível solicita recuperação completa ao Master atual.

Isto não é migração perfeita. Pedidos em trânsito e mudanças ainda não recebidas podem se perder; timers de reload retomam do último checkpoint, não há consenso/armazenamento externo. Timers do browser podem ser limitados em segundo plano. Sob travamento prolongado, a simulação reduz seu ritmo em vez de acumular uma rajada ilimitada de passos. O Master deve manter a aba ativa.

## Diagnóstico e testes

`VITE_NETWORK_DEBUG=true` habilita diagnóstico de rede em desenvolvimento. `?test` oferece fixtures/observação somente com `import.meta.env.DEV`; não existe no build de produção. Hash/revisão, quantidade de entidades/infectados, idade do snapshot, contadores de mensagens e histórico limitado de efeitos ajudam a investigar divergência. Hashes só são comparáveis na mesma revisão.

- `npm test`: regressão determinística solo + presença + coop.
- `npm run build`: TypeScript e bundle de produção.
- `npm run test:coop`: clientes Chromium independentes no Photon real, gameplay, migração, stress e solo offline.
- `LAST_NIGHT_GPU=1 npm run test:coop`: usa ANGLE/OpenGL para GPU disponível; confira o renderer gravado antes de interpretar FPS como hardware. Sem essa variável, o config mantém SwiftShader explícito.
- `npm run test:network`: lobby/presença da 10A, adaptado ao início com infectados da v2.
- `node --experimental-strip-types scripts/coop-stress.ts`: CPU/serialização do coordenador, sem transporte/GPU.

Fixtures organizam um encontro repetível no coordenador real; não simulam Photon nem inventam retornos de rede. Evidências em `docs/phase10b/`. SwiftShader serve para correção, **não comprova FPS em GPU real**. A validação nesta máquina também conseguiu utilizar a Radeon RX 6650 XT; o relatório distingue as duas execuções. O limite existente é 40 infectados vivos; pedidos de stress de 50/100 são explicitamente registrados como limitados a 40, não como testes com cem.

Próxima etapa proposta, sem implementação automática: **Fase 10C — Mundo Compartilhado, Hordas, Diretor de Tensão e Eventos**. Antes dela, fazer playtest em GPUs/redes físicas distintas, incluindo latência e aba do Master em segundo plano, e revisar resultados pendentes no relatório.
