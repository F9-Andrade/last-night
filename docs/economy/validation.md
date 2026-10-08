# Validação — economia, cidade por seed e ciclo de sobrevivência

Data: 8 de outubro de 2026. Validação local da versão em desenvolvimento; não houve deploy, commit, push ou alteração do banco de produção.

## Funcionalidades verificadas

- Moedas de restos de infectados e recipientes vão para uma carteira sem peso. Saque repetido não duplica dinheiro, mesmo com a mochila cheia.
- Seis comerciantes de quatro especialidades, compras/vendas por **E**, estoques e caixa limitados. Armas modificadas são entregues descarregadas no chão, sem sobrescrever o equipamento atual.
- Transações rejeitam falta de espaço, saldo insuficiente, distância incorreta, revisões antigas e pedidos repetidos. O anfitrião decide os valores; cada jogador tem sua própria carteira.
- **K** mostra um relógio temporário sem pausar movimento ou combate. Dia e noite duram 600 segundos cada; os avisos finais pertencem ao período diurno. A horda recebe reforços até o amanhecer, respeitando o limite de infectados ativos.
- Novos mundos variam prédios e postos pela seed. Portas, janelas, interiores, saques, colisão, navegação e mapa acompanham os prédios. Ruas, abrigo e construções pessoais permanecem estáveis. Alguns marcos únicos conservam o lote quando não existe deslocamento seguro.
- Saves anteriores preservam o mapa original. Carteira, estoque e dinheiro restante nos recipientes usam os campos JSON já existentes; nenhuma migration é necessária.
- Gume e empunhadura do machado corrigidos na visão local e nos personagens remotos, sem alterar alcance ou dano.

## Testes executados

| Validação | Resultado |
| --- | --- |
| `npm test` | 339 testes passaram, incluindo economia, migração de anfitrião, saves antigos, combate, construção e geração da cidade |
| `tests/cloud.test.ts`, revisão final | 15 testes passaram após a última proteção de migração, incluindo 3 cenários adicionais à execução completa acima |
| `npm run build` | TypeScript e build Vite passaram; permanece o aviso de chunks acima de 500 kB |
| `npm run test:lan` | 3 testes passaram: salas, identidade de mensagens, carregamento, migração, limite de jogadores e rejeição de origens/builds incompatíveis |
| Rig das armas | 8 testes unitários e 4 cenários de navegador passaram durante a implementação |
| Postos de comerciantes | 3 testes de modelos passaram; imagens das quatro especialidades inspecionadas |
| Cidade por seed | 5 testes passaram; acessos de 92 locais conferidos em múltiplas seeds |
| Navegador: economia e LAN | 2 cenários passaram: compras/vendas, saldo, capacidade, interface, relógio e arma modificada no solo; cidade, carteiras e estoque sincronizados entre dois jogadores em WebRTC real |
| Navegador: contas, mundos e coop | 6 cenários passaram: cadastro/sessão, save/reabertura/offline/conflito, convites com dois jogadores Photon, mundo legado, migração LAN e criação pelo menu coop |
| Navegador após a proteção final de contas | Os 2 cenários afetados foram repetidos e passaram: duas contas em Photon e migração de anfitrião em LAN/WebRTC |

Os cenários de navegador usam Chromium com GPU. As conexões Photon e WebRTC são reais; as respostas HTTP do Supabase são simuladas. Isso verifica a integração do cliente e os fluxos de salvamento, mas **não comprova as policies/RLS com duas contas autenticadas no Supabase real**.

## Correções encontradas durante a revisão

- Abertura de mundo persistido podia iniciar a cena com uma seed diferente da seed salva.
- Abrir um mundo legado para LAN podia deixar o layout antigo como padrão das partidas seguintes.
- O relógio principal ocultava a contagem noturna; agora mostra o tempo até o amanhecer.
- Após uma troca de anfitrião, a checagem de contas duplicadas esquecia a identidade do novo líder. Ela agora reserva essa identidade antes de processar mensagens, inclusive no intervalo anterior ao primeiro timer. Novos jogadores aguardam a comprovação dos demais atores restaurados que continuam online; os jogadores existentes continuam jogando. A autoridade é conferida novamente depois da consulta assíncrona. Testes cobrem duplicação, entrada legítima, saída de um ator pendente e nova troca de líder durante a consulta.
- A fixture do teste LAN usava invulnerabilidade acima do limite aceito pelo protocolo. O teste passou a respeitar o contrato e validar seu checkpoint antes de avaliar a replicação.

## Evidências locais e limites

As capturas ficam em `test-results/economy/`, `test-results/merchant-posts/`, `test-results/axe-grip/` e `test-results/supabase/`. A pasta de resultados é ignorada pelo Git. O painel comercial foi conferido em 960×640, 1366×768 e 1920×1080.

Um posto com NPC usa sete draw calls em cena isolada e nenhuma luz adicional. Os modelos compartilham recursos e são ocultados além de 100 metros. Essa medição isolada não é uma promessa de FPS para a cidade inteira; não foi medido um comparativo controlado de FPS antes/depois nesta etapa.

O save pessoal e o compartilhado preservam a proteção anterior por revisões, recuperação local e retentativas. Eles não formam uma única transação entre tabelas. Não foi aplicado SQL nem desabilitada qualquer policy.

Após uma migração, novas entradas em um mundo com contas podem aguardar a reconfirmação dos jogadores existentes (normalmente até 10 segundos mais a consulta ao serviço). Se alguém permanecer online sem conseguir comprovar sua conta, a entrada de novos jogadores aguarda sua reconfirmação ou saída, evitando admitir a mesma carteira duas vezes.
