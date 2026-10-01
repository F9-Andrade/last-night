# LAN pelo site — WebRTC separado do Photon

## Como jogar

1. Abra o site do LAST NIGHT, escolha **Coop online → LAN / Rede local → Criar expedição LAN**. Também é possível abrir uma expedição solo existente.
2. Durante o jogo, pressione **Esc → Abrir para LAN**.
3. Copie o convite ou o código `L-XXXXXXXXXX` exibido na pausa.
4. Os outros jogadores abrem o mesmo site, escolhem **LAN / Rede local** e entram pelo código. Um convite por link já seleciona LAN e preenche o código; clique em Entrar.
5. Até quatro jogadores participam. A cidade continua durante a pausa da partida compartilhada.

O navegador não hospeda uma porta TCP digitável como o Minecraft. O código identifica o anfitrião e WebRTC negocia suas portas locais. Não é necessário instalar Node, abrir terminal ou executar um iniciador. Todos precisam estar na mesma rede e conseguir comunicar-se nela; redes Wi-Fi de convidados/isoladas podem impedir isso.

## Dois transportes independentes

- **Photon / Online:** mantém Photon Realtime 4.4.0, suas regiões, lobby, pronto, sincronização e migração.
- **LAN / WebRTC:** usa PeerJS 1.5.5 / PeerServer para descoberta e sinalização, sem carregar/conectar o SDK Photon. Os canais de dados usam `iceServers: []`, sem STUN/TURN, e trafegam entre pares locais. Nenhum checkpoint, tiro, posição ou inventário passa pelo Photon/PeerServer.

A inspiração de conexão é [ARENA FPS](https://arena-fps-brown.vercel.app/), cujos scripts públicos utilizam PeerJS. Não foram copiados código, mapas ou assets daquele jogo.

A sinalização cloud padrão do PeerJS requer internet para encontrar/conectar novos participantes e depende da disponibilidade desse serviço. Se a sinalização cair, os canais locais estabelecidos continuam; a reconexão da sinalização não reinicia a sessão. Não há descoberta por broadcast nem garantia de funcionamento entre sub-redes, VPNs ou roteadores que isolam clientes.

## Partida preservada e entrada tardia

`Simulation.cloneForCoop()` cria cópias de estado com os protótipos das classes e o RNG vinculados às novas instâncias. `CoopWorld.fromSolo()` preserva o mundo e o personagem existentes antes de instalar a réplica local: inventário, armas/munição, vantagens, armadura, posição, ciclo/noite, HP da cama, portas, loot, árvores, estruturas, mesas e baús. A abertura não recria Santa Luz nem recompila a cena do anfitrião.

Convidados carregam a cena normalmente e recebem checkpoints do mundo atual. Adicionar participantes não substitui os registros dos sobreviventes presentes. Mudanças na lista de jogadores forçam um checkpoint completo; o mecanismo de recuperação continua ativo.

Conexões entre todos os participantes permitem continuar após a saída do líder. O sobrevivente com menor número de ator assume. **O código exibido muda para o do novo anfitrião**; novos convidados devem usar esse novo convite. Quem já entrou permanece na partida.

## Validação e limites

- Identidade dos eventos vem do canal associado ao participante; um campo `actor` enviado no payload não é confiado.
- Limite de quatro membros, validação de versão/nome/roster, timeout de negociação, limite de mensagens/tamanho e fila limitada do canal.
- Checkpoints grandes usam a fragmentação já existente. Não há replicação individual de partículas.
- O pacote PeerJS só é carregado ao selecionar LAN, por import dinâmico.
- O coordenador continua no navegador do líder, como no Photon: não é servidor antitrapaça.
- Sem câmera ou microfone; nenhum `getUserMedia` é solicitado.

## Testes

- `tests/lan-promotion.test.ts`: preservação/detachment da expedição, RNG, classes, baús, vantagens, migração e entrada/saída tardias.
- `tests/browser-lan.spec.ts`: três contextos reais Chromium com PeerServer cloud, criação pela UI, publicação na pausa, baú e inventário preservados, convidados tardios, tiro mirando, mochila, migração; cenário adicional com quatro participantes + rejeição do quinto, checkpoint de 120 mil caracteres, identidade de eventos, roster inválido e reconexão de sinalização.
- Registro: `validation.json` e `pause-lan.png`. Os testes usam vários navegadores no mesmo computador; não substituem validação entre computadores físicos na rede do usuário.
- Regressão Photon: cenário existente de baú compartilhado e migração com dois clientes reais.

Com Chromium configurado: `LAST_NIGHT_GPU=1 PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright npm run test:browser-lan`.

## Desenvolvimento e licenças

O servidor WebSocket anterior é opcional para instalações locais/offline: `npm run build && npm run lan`, abrindo o endereço mostrado, com `?coop=lan&lan=server`. Ele não é usado pelo modo LAN padrão do site. Seus testes existentes permanecem em `npm run test:lan` e `playwright.lan.config.ts`.

PeerJS — PeerJS Contributors, MIT: https://github.com/peers/peerjs ; documentação https://peerjs.com/client/getting-started . Dependências transitivas e licenças estão no lockfile (MIT / ISC / BSD-3-Clause). A biblioteca é instalada via npm e incorporada ao build, sem script de CDN. Nenhuma conta/serviço pago novo ou alteração de firewall foi configurada.
