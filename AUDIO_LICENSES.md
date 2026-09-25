# LAST NIGHT — áudio e procedência

Nenhum áudio foi baixado de terceiros durante a conversão FPS.

## Arquivos fornecidos pelo usuário

Os arquivos abaixo foram entregues diretamente pelo usuário nesta conversa, com pedido explícito para integrá-los ao jogo. Os originais foram preservados. Autor, site de origem e licença pública não foram informados; não são apresentados como CC0 ou domínio público. A autorização documentada é o uso neste projeto solicitado pelo próprio usuário.

| Arquivo em `public/audio` | Origem / URL | Autor | Permissão informada | Finalidade |
| --- | --- | --- | --- | --- |
| pistolatiro.mp3 | Arquivo local fornecido pelo usuário; sem URL | Não informado | Autorização direta de integração | Disparo da pistola |
| pistolasemmunicao.mp3 | Arquivo local fornecido pelo usuário; sem URL | Não informado | Autorização direta de integração | Clique de pistola vazia; trecho de um clique |
| pistolarecarga.mp3 | Arquivo local fornecido pelo usuário; sem URL | Não informado | Autorização direta de integração | Recarga da pistola, sincronizada com a ação |
| alarmecarro.mp3 | Arquivo local fornecido pelo usuário; sem URL | Não informado | Autorização direta de integração | Alarme espacial com início/fim e loop delimitado |
| zumbisom.mp3 | Arquivo local fornecido pelo usuário; sem URL | Não informado | Autorização direta de integração | Gemidos dos Errantes em trechos separados pelas pausas |
| zumbiataque.mp3 | Arquivo local fornecido pelo usuário; sem URL | Não informado | Autorização direta de integração | Ataque corpo a corpo, até duas vozes |

## Síntese original do projeto

`src/game/audio.ts` gera os sons restantes via Web Audio: revólver, SMG, escopeta, rifle e rifle de precisão têm envelopes, camadas de ruído, filtros e caudas diferentes. Não são cópias do tiro da pistola com outra afinação. São preservados os sinais próprios do Arauto, Cuspidor e Brutamontes, passos por superfície, vento, música de tensão, respiração, batimentos, madeira e vidro.

Origem/autor: código desenvolvido para LAST NIGHT. Sem arquivo externo ou URL de asset. A variação procedural é pequena; não foram inventadas múltiplas gravações por arma quando não existem.

Todas as fontes passam pelo controle geral e de efeitos; vento/ambiente também respeitam o ajuste de ambiente. Pausar suspende o AudioContext. Reinício encerra as gravações em andamento. O limite global continua sendo 16 vozes de efeitos.

## Fase 9 — áudio original em código

Nenhum novo arquivo de áudio foi baixado. Os seis MP3 fornecidos pelo usuário continuam com a atribuição e a situação de licença descritas acima.

| Nome | Arquivo | Autor/origem | URL | Licença/origem do uso | Uso |
|---|---|---|---|---|---|
| Motor do gerador | `src/game/audio.ts` | Implementação original do projeto | Não se aplica | Código original, sem gravação de terceiros | Oscilação grave espacial, limitada a 32 m, uma voz |
| Reflexão de interiores | `src/game/audio.ts` | Impulso gerado em tempo de execução | Não se aplica | Síntese original | Reverberação de 420 ms, transição suave |
| Metal distante, passos e recargas | `src/game/audio.ts` | Síntese original ampliada | Não se aplica | Sem amostra externa | Materiais, suspense e mecanismos das armas |

A qualidade perceptiva deve ser conferida com fones/alto-falantes em uma sessão humana; verificação automatizada confirma carregamento, espacialização configurada, ciclo e limite de vozes.
