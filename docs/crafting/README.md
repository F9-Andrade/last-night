# Crafting e abrigo a partir da cama

**Registro histórico da primeira implementação.** O fluxo, as receitas e o mapa foram atualizados em [Oficina e expansão](../workshop-expansion/README.md). Agora a mochila fabrica somente a mesa; o catálogo é aberto com botão direito na mesa colocada.

Estado: implementação local, com testes de lógica e build. A validação final no navegador e com dois clientes Photon reais permanece pendente. Não publicar como atualização validada antes de concluir `playwright.crafting.config.ts` e a regressão de coop/FPS.

## Como jogar

- Tab → Craft: receitas manuais e receitas da mesa, com custos, quantidades disponíveis e motivo de indisponibilidade.
- Fabrique a mesa com 6 madeiras + 3 sucatas. O kit pesa 3 kg.
- Mire um chão livre, abra Craft e use **Colocar mesa à minha frente**. A prévia verde/vermelha indica disponibilidade. O local fica a 1,9 m do sobrevivente; não pode sobrepor objetos, pessoas, cama ou outras mesas.
- Trabalhe a até 3 m da mesa. Materiais do depósito só ficam acessíveis na região do abrigo.
- 1: arma pesada; 2: arma leve; 3: arma branca; 4: punhos. O menu de Craft permite selecionar ferramentas já fabricadas. Guardar a última arma no armário deixa os punhos disponíveis.
- Acerte troncos com punhos/ferramentas para obter madeira. Os golpes gastam stamina. Madeira que não cabe na mochila fica no chão para saque.
- Mire os restos de infectados e use E para vasculhar. Pele, tecido, sucata e pequenas quantidades de munição compõem os restos. Um cadáver não gera dois saques.
- Couro e couro reforçado absorvem parte dos golpes até perder durabilidade. A receita de remendo recupera proteção.
- A cama substitui a construção inicial do abrigo como objetivo a proteger. Os suprimentos iniciais próximos continuam disponíveis.
- Construa paredes e portão pré-prontos na aba Craft; os pontos de defesa anteriores também continuam disponíveis. E abre/fecha o portão da cama, segurar E repara e X desmonta. O portão não fecha sobre sobreviventes/infectados.
- Nos últimos 30 segundos, aparece o aviso de retorno. O marcador mostra a cama e a distância em metros, incluindo indicação lateral quando ela está atrás. O marcador continua durante a noite.

## Receitas e equilíbrio inicial

25 receitas: mesa, corda, porrete, bandagem, faca, machado, lança, facão, couro, couro reforçado, remendo, reforço de mochila, três munições, três armas de fogo, reparo da cama e seis módulos do abrigo.

| Equipamento | Dano base | Alcance | Intervalo | Stamina | Dano no tronco |
|---|---:|---:|---:|---:|---:|
| Punhos | 14 | 1,85 m | 0,58 s | 8 | 12 |
| Porrete | 28 | 2,1 m | 0,8 s | 13 | 17 |
| Faca | 24 | 1,85 m | 0,42 s | 9 | 10 |
| Machado | 43 | 2,2 m | 0,95 s | 17 | 42 |
| Lança | 32 | 3 m | 0,85 s | 14 | 12 |
| Facão | 39 | 2,2 m | 0,64 s | 14 | 25 |

Multiplicadores anatômicos existentes continuam aplicados. Um infectado na frente do tronco recebe o golpe antes da árvore. Ataques não emitem disparos, estojos ou muzzle flash e não gastam munição.

- Árvores: 100 HP; 4–6 madeiras por corte. Retorno aleatório entre 240 e 480 segundos, nos pontos existentes, fora de 12 m dos sobreviventes. Árvores não surgem sobre mesas ou infectados próximos. Árvores decorativas fora do limite jogável não são coletáveis.
- Loot do mapa: locais já vazios podem renovar entre 360 e 660 segundos, fora de 18 m dos sobreviventes. Sobras não são substituídas; bolsas de cadáveres, madeira cortada e recompensas não renovam. Reposição tem rendimento reduzido e não recria a garantia inicial nem uma arma grátis por abertura.
- Couro: absorção de 20%, 80 de durabilidade. Reforçado: 32%, 140. Remendo: até +45.
- Mochila: melhoria única de +4 kg. O perk existente continua compatível.
- Armas artesanais: comuns e descarregadas. A fabricação preserva a arma substituída e as balas que ela já tinha.
- Mesa: 200 HP, máximo de 12; infectados podem destruí-la. Apenas mesas intactas podem ser recolhidas; isto evita reparo gratuito por recolocação.
- Módulos: 300 HP e custos reais. A base mantém 1000 HP. A noite e o dano dos infectados não foram reduzidos.

O equilíbrio precisa de playtests de duração real; os valores acima são uma base inicial e não uma afirmação de dificuldade já validada com jogadores.

## Solo e coop

As mesmas funções de crafting/coleta/proteção atendem ambos os modos. O MasterClient valida receita, materiais, proximidade, ocupação, equipamento e cadência. Não há partículas replicadas individualmente.

Checkpoints e patches preservam mesas, HP/cooldown de árvores, renovação de loot, módulos, portão aberto/fechado, cama, ciclo, estado da horda, armadura, ferramentas e capacidade da mochila. A restauração do host usa esse estado. A identificação de build da sala mudou para `santa-luz-craft-1`, isolando clientes com o protocolo anterior.

A rede continua no modelo de autoridade do host já usado pelo projeto. Esta atualização não introduz servidor dedicado ou persistência entre expedições.

## Apresentação e desempenho

- Geometria voxel original para cama, mesa e cinco ferramentas; mantém as armas, infectados detalhados e ragdolls existentes.
- Árvores existentes são ocultadas/restauradas nas malhas originais, incluindo instancing; nenhum bairro é regenerado. Os obstáculos usados para planejar a cidade foram preservados para impedir que a remoção do prédio inicial reorganizasse Santa Luz.
- Geometria compartilhada, 12 malhas reutilizadas para mesas, ferramentas em cache, colisões de árvores/mesas em cache por revisão.
- Máximo de 80 bolsas de infectados e 80 pilhas de madeira; o mais antigo pode ser removido ao atingir o limite.
- Teste de serialização local com 4 jogadores, 166 árvores e 268 containers: 82.355 bytes, aceito pelo parser. Isso não mede tráfego Photon ao vivo nem FPS.
- Sem novas dependências de runtime; sem assets externos. Os novos modelos e ícones são código original, e os assets fornecidos anteriormente permanecem em uso.

## Validação

Última verificação local: `npm test` passou nos 195 testes; `npm run build` passou, incluindo o typecheck; `git diff --check` passou. A suíte adiciona testes para custos atômicos, peso, distância, munição, armas vazias, desgaste de armadura, saque único, renovação, colisão, destruição/recolhimento da mesa, bloqueio de construção, migração, payload e árvores instanciadas.

Testes antigos que dependiam do prédio inicial fixo foram transferidos para uma casa intacta. O teste de guardar a última arma passou a verificar a nova opção desarmada. O teste de cerco continua verificando que os infectados chegam à base após romper o perímetro; não exige que destruam paredes que podem contornar após uma brecha.

O primeiro teste de navegador tentou abrir o inventário durante o carregamento; a espera por `#loading-screen` foi adicionada. As duas execuções de navegador não terminaram com sucesso. Depois desse ajuste, a nova execução foi recusada pela revisão automática de permissões por limite de uso da conta. Não há aprovação final de screenshots, responsividade ou Photon ao vivo desta atualização.

### Próximos passos antes de publicar

1. Executar `LAST_NIGHT_GPU=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/last-night-browsers npx playwright test --config playwright.crafting.config.ts` após liberar o bloqueio de uso/permissão. O navegador de testes já foi baixado em `/tmp`.
2. Conferir as capturas de Craft, machado, cama e retorno em `test-results/crafting`; refinar qualquer problema encontrado.
3. Executar regressão de coop real (combate, saque, revive, troca de host), armas FPS e carregamento.
4. Fazer uma expedição completa em solo e coop para verificar o custo do primeiro perímetro, noite, renovação e a progressão de armaduras.
5. Somente após validar, finalizar commit/push conforme autorização anterior do usuário. Nenhum commit ou push desta atualização foi realizado.
