# Fase 11 — assets e licenças

| Nome | Fonte / autor | Licença / situação | Uso |
| --- | --- | --- | --- |
| Fundo grunge e seis ícones voxel | Fornecidos pelo autor do projeto, 24/09/2026 | Arquivos fornecidos para uso neste projeto; nenhum direito adicional presumido | Inventário/HUD; origens em `public/ui/README.md` |
| Materiais de Santa Luz | Código original desta etapa (`surface-materials.ts`) | Criados no projeto, sem imagem externa | Texturas determinísticas de 256×256 / atlas compartilhado |
| Céu e nuvens | Shader original (`cinematic-sky.ts`) | Criado no projeto, sem HDRI ou skybox baixados | Atmosfera diurna/noturna |
| Marcas de impacto/sangue | Código original (`impact-decals.ts`) | Criadas no projeto | Texturas pequenas em pool limitado |
| Armas e braços voxel | Receitas originais do projeto, ampliadas nesta etapa | Criados no projeto | Cena FPS e armas do mundo |
| Noto Sans | Fontes locais já existentes | SIL Open Font License; nenhuma fonte nova baixada | Interface existente preservada |
| GTAOPass, EffectComposer, OutputPass, UnrealBloomPass, FXAAShader | Three.js / colaboradores — https://github.com/mrdoob/three.js/blob/r180/LICENSE | MIT, dependência já existente r180 | Pipeline WebGL de pós-processamento |

Nenhum asset visual externo com marca d’água foi incorporado. O Chromium temporário usado para testes não é asset distribuído com o jogo.

APIs consultadas e conferidas também no código instalado r180:
- https://threejs.org/docs/pages/GTAOPass.html
- https://threejs.org/docs/pages/EffectComposer.html
- https://threejs.org/docs/pages/OutputPass.html
- https://threejs.org/manual/pages/post-processing.html
