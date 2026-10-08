# Revisão do contrato DATABASE V1

O SQL fornecido em 07/10/2026 foi lido integralmente como referência. Não foi executado.

## Convite por código: RPC aplicada manualmente

1. **Problema:** somente membros podem consultar `world_invites`; somente o owner pode inserir `world_members`; ninguém possui policy de UPDATE em `world_invites`. Um convidado ainda não membro não consegue resgatar um convite nem incrementar `uses`.
2. **Por que o cliente não resolve:** duas chamadas independentes não garantem consumo atômico e o frontend não pode contornar RLS. Expor todos os convites também seria incorreto.
3. **Proposta:** `001-accept-world-invite.proposed.sql` adiciona exclusivamente uma RPC de resgate autenticado, com lock de linha, validade, limite de usos e associação apenas do próprio `auth.uid()`. Convites são tokens aleatórios de 192 bits; os códigos curtos Photon/LAN continuam exclusivos do networking.
4. **Riscos:** quem tiver o token e uma conta poderá ingressar até sua expiração/limite. O token deve ser compartilhado somente com convidados. A função tem privilégio elevado restrito a essa operação, não deve aceitar um `user_id` arbitrário. Tentativas devem ser sujeitas aos limites de infraestrutura; o token de alta entropia impede enumeração prática.
5. **Compatibilidade:** aditiva; não modifica tabelas, policies, triggers ou funções existentes. Mundos/salas/saves existentes continuam válidos.

**Estado: aplicação manual confirmada pelo proprietário em 07/10/2026. O agente não executou a migration.** O cliente usa a RPC existente; nenhuma outra alteração estrutural foi aplicada. A concessão por username também utiliza a policy existente de INSERT em `world_members`.

O parâmetro `code` recebe o `invite_code` exato e a RPC retorna o UUID do mundo. O cliente usa `rpc('accept_world_invite', {code: inviteCode})`. A função aceita formatos antigos de códigos já cadastrados; novos convites devem usar os tokens aleatórios de 192 bits. Repetições por alguém já membro não consomem uso, inclusive depois do esgotamento/expiração do convite. Convites inexistentes e mundos inativos continuam sendo recusados.

## Migração de host e autorização de save

O coop atual migra o host quando o líder sai. O schema autoriza exclusivamente o proprietário do mundo a atualizar `world_state` e `worlds`. Ser host de uma sala não confere esse privilégio no banco.

A migração de host do gameplay deve ser preservada. Cada jogador continua salvando o próprio estado. Se o owner sair, a persistência compartilhada fica suspensa e isso deve ser indicado claramente; não se deve informar “mundo salvo”. A implementação grava o mundo somente quando o owner também é a autoridade atual, pois os timers privados do mundo não integram todos os checkpoints de migração. O save individual continua disponível aos membros.

Permitir que outro membro grave o mundo exigiria um modelo adicional de delegação/lease verificado no servidor, com revogação e disputa de sessões. Isso **não será habilitado silenciosamente** nem por uma policy ampla permitindo UPDATE a qualquer membro.

## Concorrência e visibilidade

- `world_state.revision` permite UPDATE condicionado à revisão lida; resultado de zero linhas é conflito/acesso perdido, nunca sucesso. Não realizar retry sobrescrevendo dados remotos com um estado antigo.
- O schema não possui `revision` em `player_saves`; usar `updated_at` como comparação para updates e tratar conflito de INSERT na PK sem upsert cego.
- `player_saves` pode ser lido por todos os membros, conforme a policy fornecida. Não armazenar senhas, tokens de autenticação ou dados pessoais extras nesse JSON.
- `profiles` é visível a usuários autenticados; username é único sem diferenciar maiúsculas.
- O cadastro real está habilitado e a confirmação por e-mail está ativa. Os testes de duas contas reais precisam de confirmação dos respectivos e-mails; testes com respostas simuladas não substituem essa verificação.
