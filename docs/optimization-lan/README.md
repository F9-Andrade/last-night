# Oficina, LAN e otimização de renderização

## Correção da mesa inteligente

A oficina comparava o HTML gerado com `element.innerHTML`. O navegador normaliza esse HTML (por exemplo, SVG, entidades e atributos), fazendo trechos equivalentes parecerem diferentes. Isso recriava botões durante atualizações do HUD, podendo destruir o alvo entre pressionar e soltar o mouse.

Agora cada região guarda a última string renderizada e só altera o DOM quando o conteúdo muda de fato. A rolagem do catálogo é preservada. Um teste segura o clique por 450 ms e verifica também a identidade do botão ao longo de várias atualizações. Receitas, preços, materiais e funcionamento continuam iguais.

## Photon e LAN

O menu coop oferece **Photon · Online** e **LAN · Rede local**. As duas opções usam o mesmo `CoopSession`, `CoopWorld`, inventário, combate, crafting, checkpoints e migração de líder. A LAN muda somente o transporte e o lobby; não é uma simulação com duas abas via armazenamento local.

Para hospedar na rede local, dentro do projeto:

```sh
npm run build
npm run lan
```

O terminal mostra os endereços disponíveis. Todos os jogadores abrem o endereço IP do anfitrião, como `http://192.168.1.10:8787/?coop=lan`, escolhem LAN e criam/entram na sala pelo código. O processo do servidor deve permanecer aberto. A porta pode ser configurada por `LAN_PORT`. O servidor serve os arquivos compilados de `dist`; após alterações no jogo é necessário executar o build novamente.

A LAN funciona sem Photon/App ID e não depende de internet para jogar depois que os arquivos locais estão disponíveis. Não há descoberta automática de computadores: o endereço é informado pelo anfitrião. É preciso que os dispositivos consigam acessar a porta local, sem isolamento entre clientes Wi-Fi. Nenhuma configuração de firewall ou roteador foi alterada.

O servidor mantém salas privadas com até quatro jogadores, verifica a versão, espera todos carregarem, atribui a identidade do remetente, limita mensagens e elege outro líder quando alguém sai. Se o computador que executa o **servidor** desligar, a conexão termina; migração do líder do gameplay não transfere o processo servidor para outra máquina.

O site HTTPS publicado não abre um WebSocket HTTP inseguro. O botão “Abrir jogo LAN” navega para o jogo servido pelo anfitrião. Essa separação evita [conteúdo misto de WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications). Identificadores usam aleatoriedade criptográfica também no HTTP local, onde `randomUUID` pode não existir. Copiar pelo clipboard depende das permissões do navegador; o código continua selecionável.

`ws` 8.21.3, licença MIT, já estava instalado como dependência transitiva. Foi declarado explicitamente para o servidor e o lockfile foi atualizado offline. Ele não é importado pelo cliente do jogo. Não foram baixados assets, alteradas credenciais nem feitos deploys.

## Diagnóstico e otimizações

A hipótese de “todo o mapa sendo renderizado” era parcialmente correta: havia descarte por distância nos bairros, mas alguns lotes de árvores e o lote estático do centro tinham limites grandes demais. Além disso, o perfil de CPU mostrou custo elevado em matrizes e travessias dos ramos invisíveis.

- **Cenário estático:** matrizes de bairros e decoração são calculadas uma vez. `StaticChunk` é restrito a cenários imóveis sob a cena com transformação identidade; portas, personagens e partículas permanecem móveis.
- **Objetos dinâmicos ocultos:** não recalculam suas matrizes para desenhar enquanto invisíveis; quando reaparecem, a árvore inteira atualiza antes do desenho. Simulação e animações continuam funcionando.
- **AO:** aplica as mesmas exclusões percorrendo apenas ramos visíveis. GTAO, resolução do efeito, bloom e correção de cor são preservados. Os hooks utilizados correspondem à versão Three.js instalada, r180, e foram verificados no código do addon.
- **Árvores:** instancing por variante e célula de 64 m, mantendo a ordem do gerador aleatório, posições, escala e geometria. Cada lote pode ser descartado pela câmera e pelo frustum das sombras. Corte e reaparecimento continuam atualizando as instâncias originais.
- **Centro estático:** objetos detalhados agrupados por células de 64 m. Terreno e vias simples ficam em lote separado, evitando que um chão enorme obrigue a GPU a desenhar os carros e objetos do centro em bairros distantes.

Não houve redução de resolução, qualidade, distância de visão, sombras, vegetação, modelos ou efeitos. O mapa, receitas, dano, população e cadência de rede foram mantidos. O congelamento de matrizes segue os mecanismos descritos na [documentação Three.js](https://threejs.org/manual/pages/how-to-update-things.html).

## Medições antes/depois

Mesma máquina, navegador Chromium com GPU, High, 1600×900, mesma semente, posições e ângulos. Cada amostra espera 1,5 s e registra 180 frames. Cenas controladas sem infectados próximos. O profiler CDP fica ativo nas duas execuções. São amostras curtas, não um benchmark de campanha ou garantia para outro hardware.

| Cena | Frame médio antes → depois | p95 antes → depois | Triângulos antes → depois | Draw calls antes → depois |
|---|---|---|---|---|
| Base (1, 18) | 17,20 → 16,61 ms | 16,80 → 16,70 ms | 1.062.990 → 822.390 | 643 → 741 |
| Bairro (468, 447) | 16,56 → 16,59 ms | 16,70 → 16,70 ms | 472.014 → 98.910 | 247 → 265 |

O teste já estava próximo do limite de apresentação de 60 FPS. A redução de triângulos foi de cerca de **23% na base** e **79% no bairro**. Dividir os lotes aumenta alguns draw calls em troca de evitar geometria distante; o tamanho final de 64 m foi escolhido após uma tentativa de 32 m gerar chamadas excessivas.

No perfil de CPU, a proporção de amostras ociosas passou de **3,4% para 48,8%**. As amostras em atualização/multiplicação de matrizes passaram de 4.376/10.501 para 281/9.984; travessias genéricas passaram de 1.679 para 23. Isso indica mais margem de CPU, **não** uma promessa de aumento de FPS nessa proporção. Tempos independentes da GPU não foram medidos. Dados em `before.json`, `after.json` e `cpu-summary.json`.

Capturas dos mesmos enquadramentos: `before-base.png`, `after-base.png`, `before-district.png`, `after-district.png`. Foram inspecionadas visualmente. Poeira, tempo da animação e HUD podem variar entre capturas.

## Validação

- `npm test`: **211 testes aprovados**, incluindo preservação de matrizes estáticas e atualização de objetos reexibidos.
- `npm run test:lan`: **3 testes aprovados** — lobby, barreira de carregamento, remetente real, mensagens grandes, migração, versões, origem WebSocket, limite de quatro jogadores e liberação de vaga.
- Navegador: os **três cenários de crafting** passaram, incluindo clique prolongado na oficina, solo, dois clientes Photon reais e migração de host.
- Navegador: regressão de interior, noite, lanterna, porta, combate, recarga, bandagem, HUD e pausa aprovada.
- Navegador: versão de produção com dois clientes LAN, inventário, tiro mirando e continuidade após saída do líder aprovada. Também passou pelo IP privado da rede, em HTTP com `isSecureContext: false`, além de localhost. `lan-browser.json` registra o transporte observado.
- `npm run build`, incluindo typecheck, aprovado. Vite informa o aviso de chunk Three.js ligeiramente maior que 500 kB; não é erro de build.
- `git diff --check` sem erros.

Os testes usam dois navegadores na mesma máquina; não substituem um playtest entre computadores físicos diferentes. A LAN local não transforma a hospedagem estática Netlify em servidor de rede local.

Nenhum commit ou push foi realizado.
