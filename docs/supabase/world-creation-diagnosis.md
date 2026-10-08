# Falha ao criar mundo — diagnóstico de 08/10/2026

Reproduzido em `http://127.0.0.1:5173/`, na sessão autenticada existente, acessando o Supabase real. Não foi executado SQL, alterada policy, função ou trigger. A única gravação de diagnóstico usa o fluxo normal do jogo, no mundo **Diagnóstico criação 08-10**.

## Erro original

Após **Criar mundo e jogar**, a requisição `POST /rest/v1/worlds` com `Prefer: return=representation` retornou HTTP **403**:

```json
{
  "code": "42501",
  "message": "new row violates row-level security policy for table \"worlds\"",
  "details": null,
  "hint": null
}
```

A consulta de autenticação `/auth/v1/user` retornou 200. Na requisição de INSERT, o bearer JWT tinha `role=authenticated`, subject presente, expiração válida e subject igual ao `owner_id` enviado. Tokens, chaves, e-mails e IDs de usuário não foram registrados. A mensagem da interface sobre sessão expirada era a tradução genérica de `42501`, não a causa comprovada.

## Causa e correção

`WorldService.create()` usava `insert(...).select('*').single()`. Isso solicita `RETURNING`, cuja linha também deve satisfazer a policy de SELECT de `worlds`. Essa policy exige `is_world_member(id, auth.uid())`, mas a participação é criada pelo trigger **AFTER INSERT** `on_world_created` / `handle_new_world()`. A verificação de visibilidade da linha acontece antes de essa participação estar disponível; a operação inteira é rejeitada.

No SQL fornecido pelo proprietário, `handle_new_world()` é `SECURITY DEFINER`, com `search_path=''` e tabelas qualificadas por schema. Ele executa no contexto do proprietário da função; não herda simplesmente o contexto RLS do chamador. Não inspecionamos privilégios administrativos no serviço real, mas o teste corrigido confirma operacionalmente que a função consegue criar os registros dependentes. Não houve erro apontando para `world_members`.

A correção fica exclusivamente no cliente:

1. Validar a sessão com `auth.getUser()`.
2. Gerar um UUID para identificar exatamente o novo mundo.
3. Executar INSERT sem `.select()`/RETURNING, aguardando sua conclusão, inclusive o trigger.
4. Executar SELECT por esse UUID em uma requisição separada, com a participação já criada.
5. Preservar o carregamento e os saves existentes, no solo e no coop.

Não se insere `world_members` ou `world_state` pelo cliente, não há nova RPC, retry com privilégios elevados nem relaxamento de RLS.

Referências: [PostgreSQL — SELECT policies e RETURNING](https://www.postgresql.org/docs/current/sql-createpolicy.html), [Supabase JS — INSERT sem retorno por padrão](https://supabase.com/docs/reference/javascript/insert).

## Evidência da sequência real

| Etapa | Antes | Depois |
| --- | --- | --- |
| Sessão `/auth/v1/user` | 200, JWT válido | 200, mesma conta |
| POST `worlds` | 403 / 42501, `return=representation` | 201, sem solicitação de representação |
| Trigger de criação | A transação não concluía | INSERT concluído, `world_state` acessível e `world_members` confirmando o proprietário |
| SELECT do mundo | Nenhuma requisição separada | 200, consultado pelo UUID criado |
| Carregamento de `world_state` | Não alcançado | 200 |
| Leitura de `player_saves` | Não alcançada | 200 |
| Criação de `player_saves` | Não alcançada | POST 201 |
| Saves posteriores | Não alcançados | PATCH 200 em `player_saves`, `world_state` e resumo de `worlds` |

## Regressão

O mock antigo retornava sucesso incondicional no INSERT de mundos e não reproduzia a dependência entre SELECT e trigger. Agora ele rejeita `return=representation` nesse INSERT e verifica o UUID da leitura posterior.

Um teste usando o SDK real com transporte HTTP simulado comprova a sequência `GET auth/user → POST worlds → GET worlds`, o cabeçalho de autenticação e a leitura apenas após a conclusão da gravação. Outro confirma que um INSERT rejeitado interrompe o fluxo, sem gravar registros de trigger pelo cliente.

Validação: 17 testes unitários de contas/saves e 6 cenários de navegador passaram, incluindo criação solo, save/reabertura, mundo legado, convites e duas contas Photon, migração LAN/WebRTC e criação de mundo pelo coop. Os cenários automatizados usam Supabase simulado; a reprodução do erro e as respostas da tabela acima foram capturadas na sessão real do localhost. Build e typecheck passaram.

A instrumentação temporária registrou apenas método, caminho sem parâmetros, status, flags de autenticação e os campos originais do erro PostgREST. Foi removida após a captura; o cliente final não imprime JWTs nem adiciona logs de requisições. Nenhum commit ou push realizado.

Observação separada no navegador de inspeção: a primeira entrada mostrou timeout da preparação da GPU depois de o carregamento Supabase já ter passado. A nuvem concluiu os saves; o mundo apareceu em Meus mundos e foi reaberto com sucesso, chegando ao gameplay e ao fim da partida de diagnóstico. A preparação gráfica não foi modificada para contornar esse erro de acesso.
