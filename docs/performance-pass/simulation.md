# CPU da simulação — passe de otimização

Medição isolada da CPU, sem renderer nem rede de transporte. Não representa FPS ou tempo de GPU. Node v26.8.2, 420 passos determinísticos de 1/60 s por cenário; os primeiros 60 passos são aquecimento e ficam fora das médias. Mesma máquina, fixtures, seed e comandos antes/depois.

| Cenário | Antes (ms/tick) | Depois (ms/tick) |
|---|---:|---:|
| Solo, sem infectados | 0,138 | 0,091 |
| Solo, 40 infectados | 7,864 | 1,453 |
| Solo, 40 infectados + 72 peças | 18,692 | 2,375 |
| Solo, 80 infectados + 192 peças (stress sintético) | 50,663 | 5,568 |
| Coop autoritativo, 2 jogadores, 40 infectados + 72 peças | 19,038 | 2,600 |
| Coop autoritativo, 4 jogadores, 40 infectados + 72 peças | 19,162 | 2,603 |
| Coop autoritativo, 4 jogadores, 80 infectados + 192 peças (stress sintético) | 52,082 | 5,847 |

**Todos os sete hashes SHA-256 do estado final são idênticos antes/depois.** Os cenários de 80 infectados excedem propositalmente o limite normal do jogo: são carga sintética do script, e não uma alteração do limite de produção. A geometria das fixtures serve para carga de colisão, não para validar regras de encaixe.

10.000 raios de interação idênticos: 1.836,121 ms → 36,135 ms (resultado acumulado idêntico: 60.000).

Alterações:

- Altura do chão calculada uma vez por infectado/tick, em vez de duas vezes por candidato de colisão. A cidade atual tem 758 sólidos dinâmicos e 92 locais.
- Índice por ID de janelas, evitando busca linear entre 184 portais a cada teste de visibilidade. O índice mantém referência ao estado vivo, incluindo uma janela quebrada por outro infectado no mesmo tick.
- Telhados e tendas têm caixas estáticas e índice espacial construídos uma vez, em vez de recriar toda a cidade para cada raio 3D.
- Broad phase de raios 2D/3D descarta caixas que não intersectam a projeção do segmento antes do teste completo. Raios, alcance, colisões e prioridades preservados.
- Consultas dentro de uma célula espacial reutilizam sua lista; colisões e raios deixam de concatenar arrays de todos os sólidos.
- O protocolo de rede, frequências, checkpoint, danos, IA, animações e limites não foram alterados. O coordenador coop usa as mesmas otimizações da simulação solo.

Validação direcionada: **86 testes aprovados**, incluindo 3 novos testes de equivalência com varredura integral da cidade (colisões, raios 3D, raios 2D), além de simulation, FPS, construction, coop e construction-coop. Cobrem telhados/tendas, portas, janelas, munição, perseguição, escadas, fortificação, migração, revive e reposicionamento.

Reproduzir:

```sh
node --experimental-strip-types scripts/profile-simulation.mjs
node --experimental-strip-types tests/world-queries.test.ts
```

Valores brutos, percentis e hashes: `simulation-before.json` e `simulation-after.json`. Este benchmark não permite prometer o mesmo ganho percentual de FPS em uma máquina limitada pela GPU. Consulte também as medições e screenshots do navegador deste diretório.
