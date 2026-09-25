# Fase 11 — análise e decisões visuais

## Referência e escopo

A imagem fornecida em 24/09 orienta o mundo e a arma; a última instrução do autor retirou a interface ao redor da prioridade. Mantêm-se a interface grunge e os seis ícones já integrados, com verificação de paridade solo/coop.

Diferenças observadas antes de editar o renderizador:

1. Ambiente verde-claro uniforme e céu de cor sólida. A referência tem horizonte quente, nuvens e ar em perspectiva.
2. HemisphereLight 1,95 durante o dia lavava paredes, folhas e interiores; a referência tem luz solar lateral e sombras com volume.
3. Asfalto/calçadas/fachadas sem resposta local de material. A referência mostra remendos, juntas, detritos, ferrugem e manchas.
4. A arma recebia HemisphereLight 2 + DirectionalLight 2 fixos, inclusive à noite, e tinha pouco detalhe mecânico.
5. Embora Santa Luz já possuísse veículos, bloqueios e cenas de evacuação, grandes superfícies e bordas de vias ainda pareciam limpas.

## Comparação controlada

As sete cenas e os valores de câmera estão em `tests/visual-overhaul.spec.ts`. Baseline: `before-high/`. Resolução 1600×900, DPR 1, qualidade alta, mesmo seed de teste1977, mesmos horários/fases e posições. O roteiro recolhe cinco amostras após estabilização e CDP TaskDuration para CPU. FPS é limitado pelo refresh do navegador; 60 FPS não significa GPU sem custo.

Pastas intermediárias documentam luz, sombras/AO, atmosfera, materiais, densidade e viewmodel. As alterações não mudam colisões, dano, inventário, IA, economia, seed ou autoridade Photon.

## Segunda revisão da referência

Após a primeira implementação, os cinco maiores problemas restantes eram: superfícies ainda lisas, rua puxando para marrom, arma escura demais por metalness sem environment map, texturas de desgaste muito repetitivas e custo de múltiplos materiais por lote. Refinamentos: asfalto cinza neutro; sujeira/descascados macroscópicos; metal da arma com mais componente difuso; detalhes de canto e telhado localizados; compartilhamento/atlas dos materiais estáticos.

O passe contra excesso preserva bloom restrito a valores HDR, vinheta discreta, sem aberração cromática nem film grain. A noite preserva silhuetas e iluminação local; interiores permanecem escuros com luzes existentes e lanterna.
