# Interface de sobrevivência — 24/09/2026

Menu, pausa, configurações, créditos, fim de partida, mochila, HUD e lobby usam o mesmo tema preto desgastado, com detalhes vermelhos e texto claro. A textura e seis imagens de itens foram fornecidas pelo autor e copiadas sem edição; a origem está em `public/ui/README.md`.

A apresentação está em `src/ui/survival-theme.css`, importada depois dos estilos existentes. `src/ui/item-art.ts` compartilha os mesmos assets entre mochila, detalhes e barra de recursos. Os elementos e handlers existentes continuam responsáveis por seleção, contagem, peso, depósito, descarte e equipamento. Não há itens novos simulados para reproduzir a imagem de referência.

## Paridade obrigatória

Mudanças de interface devem valer simultaneamente para solo e coop. Ambos usam o mesmo `HUD`, layout, assets e folha de tema. Somente mensagens específicas do modo diferem: no coop, a pausa informa que companheiros e cidade continuam ativos.

## Validação

- `npm run build`: TypeScript e Vite aprovados.
- `tests/ui-theme.spec.ts`: teste solo e teste com dois clientes Photon reais aprovados, sem erros JavaScript.
- Solo: menu, configurações, créditos, mochila, seis imagens carregadas, seleção, abas, descarte de munição (79 → 67), pausa e retorno ao controle do mouse.
- Responsividade: 1920×1080, 1366×768, 960×640 e 640×640 com escala da interface em 120%. Painel limitado à tela; conteúdo e ações acessíveis por rolagem quando necessário.
- Coop: sala privada, pronto/iniciar, mochila nos dois clientes, imagens, seleção, abas, pausa, configurações e retorno ao jogo.
- No teste de redimensionamento, a recuperação pelo botão existente “Clique para controlar o olhar” cobre os casos em que Chromium exige um novo gesto para capturar o mouse.
- Capturas e registros em `docs/ui-theme/`. A cidade permanece renderizada pelo jogo; a referência inteira não foi usada como imagem de fundo.

Execução dos testes visuais neste ambiente:

```sh
LAST_NIGHT_GPU=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/last-night-browsers npx playwright test --config playwright.ui.config.ts
```

Nenhuma operação Git de escrita foi realizada nesta etapa.
