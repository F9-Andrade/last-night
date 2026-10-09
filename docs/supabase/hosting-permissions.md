# Saída do anfitrião e autorização para continuar/salvar

Status: implementação no cliente; migration **proposta, não aplicada no Supabase**.

## Comportamento

- A saída ou desconexão do anfitrião encerra a partida para cada convidado sem autorização. O cliente bloqueia comandos, tenta salvar o último estado confirmado do sobrevivente e volta ao menu. Se o envio falhar, mantém a recuperação/exportação existente; não informa sucesso falso.
- O dono concede/revoga por conta em **Esc → Permissões dos amigos** ou **Meus mundos → Detalhes**. É uma permissão separada do convite para entrar.
- Um amigo autorizado permanece; se necessário, a autoridade do gameplay migra para um dos autorizados. Os saves compartilhados desse anfitrião usam a nova RPC; cada inventário continua salvo pelo próprio usuário em `player_saves`.
- O cliente confere o registro autenticado de cada conta, vinculado à identidade de transporte, actor e partida. Nomes de exibição e mensagens recebidas não concedem permissão persistente.
- As permissões são verificadas periodicamente e novamente na saída do anfitrião, antes da promoção. Revogar impede imediatamente novos saves no banco e é percebido pelos clientes na próxima consulta. O timeout das consultas é limitado. Na LAN, uma conexão sem tráfego por 18 segundos é removida na próxima verificação de presença (intervalo de 3 segundos), cobrindo o fechamento abrupto da aba/processo sem aguardar o timeout longo do ICE.
- Em partidas temporárias sem conta, a autorização em Esc vale somente para a sala atual. Não promete um save Supabase para um mundo temporário.
- Photon e LAN continuam transportes independentes. O identificador de versão de rede mudou para impedir que clientes antigos entrem em salas com regras incompatíveis.

## Por que a migration é necessária

O schema atual permite UPDATE de `world_state` e do resumo `worlds` somente ao dono. Ser membro/aceitar convite não concede autorização para salvar esses dados. Permitir migração de host apenas no navegador perderia as alterações compartilhadas feitas depois da saída do dono.

Arquivo completo: [002-world-host-permissions.proposed.sql](002-world-host-permissions.proposed.sql).

A migration adiciona:

1. `world_host_permissions`, com RLS e sem acesso direto das roles de cliente. A FK composta exige participação no mundo e remove a autorização se essa participação for removida.
2. `get_world_host_permissions(uuid)`: consulta autenticada, somente por membro.
3. `set_world_host_permission(uuid, uuid, boolean)`: somente o proprietário pode autorizar/revogar membros. Não altera o dono nem concede administração.
4. `save_hosted_world(uuid, bigint, jsonb, text)`: exige `auth.uid()` proprietário ou membro autorizado; salva estado, revisão e resumo atomicamente.

SECURITY DEFINER é necessário para o save delegado sem ampliar as policies existentes. Todas as funções usam `search_path = ''`, objetos qualificados, autorização interna e EXECUTE limitado a `authenticated`. Não recebem um user_id de escritor; usam `auth.uid()`. Não usam/exibem service_role.

## Concorrência e riscos

- Grant/revogação/save bloqueiam a mesma linha do mundo; uma revogação não corre por fora de um save em andamento. Uma operação já concluída antes da revogação permanece válida.
- Entre partidas diferentes ou solo, permanece o controle por revisão (CAS). Na migração dentro da mesma partida, um host com revisão local antiga só pode enviar checkpoint mais novo da mesma sessão. Checkpoint antigo e outra sessão são rejeitados; não há recarga cega de revisão seguida de overwrite.
- `extra.hostSession` é um marcador público de partida, não credencial nem autorização. A RPC checa a conta/permissão antes de usá-lo.
- Autorizar alguém permite modificar o estado compartilhado inteiro: construções, loot, estado do mundo etc. Conceder somente a amigos confiáveis. Não concede excluir o mundo, alterar dono, autorizar terceiros ou escrever inventários alheios.
- O gameplay continua hospedado por clientes. Isso não transforma Photon/WebRTC em servidor anti-cheat: clientes deliberadamente adulterados podem ignorar fechamento visual, mas não recebem permissão de gravação do banco.
- Ao fechar o navegador/processo abruptamente, não há garantia de envio de um último save. A migração usa o último checkpoint recebido; os convidados conectados ainda tentam salvar seu progresso confirmado.
- O save de `player_saves` continua separado da transação do mundo. Falhas parciais mantêm o mecanismo de recuperação existente.

## Compatibilidade e aplicação

É aditiva e retrocompatível com os dados, tabelas, policies, triggers e funções existentes. Não concede permissões a membros antigos automaticamente. Nenhuma policy existente é removida/enfraquecida. O dono ainda pode salvar pela API antiga. Nenhum sistema de gameplay foi substituído.

Sem a migration, o cliente reconhece a RPC ausente, mantém os saves atuais do proprietário e encerra convidados na saída do anfitrião. A UI explica que delegação ainda está pendente. Jogar solo no mundo de outra pessoa exige autorização para continuar/salvar.

O proprietário deve revisar o arquivo e executá-lo manualmente no SQL Editor do projeto correto, uma única vez. `CREATE` sem `OR REPLACE` impede substituir objetos homônimos silenciosamente. Depois de aplicar, reabrir a partida para usar a configuração nova. Codex não executou esta migration remotamente.

## Validação

- Build e typecheck aprovados (somente o aviso pré-existente do Vite sobre chunks grandes). 354 testes de unidade aprovados; 3 testes do relay LAN aprovados.
- Testes de unidade: autorização padrão, grant/revogação, rejeição de mensagens forjadas e replay, atores autenticados, ausência da migration, save delegado, conflitos e proibição de writes diretos.
- Navegador: 7 cenários de contas/mundos e 3 cenários WebRTC aprovados. Supabase simulado com SDK oficial; Photon/WebRTC reais. Saída sem permissão preserva inventário; autorizado continua/salva; revogação encerra a sessão.
- SQL executado somente em PostgreSQL/WASM descartável (PGlite 0.5.8, instalado em `/tmp`, fora das dependências do jogo). Foi carregado o schema de referência fornecido, com o bootstrap local de `auth` e sem instalar pgcrypto (gen_random_uuid já existe no runtime). Verificados policies intactas, grants idempotentes somente pelo dono, RLS, anon/não membro recusados, save delegado, CAS entre sessões, checkpoints obsoletos, revogação, cascade e rollback de estado/revisão quando a atualização do resumo falha.
- O teste SQL não simula duas conexões PostgreSQL independentes: a proteção concorrente é implementada por locks transacionais e ainda requer validação no Supabase após aplicação manual.
- Runner reproduzível: `node scripts/test-hosting-migration.mjs <caminho-local-do-pglite/dist/index.js> <schema-de-referencia.sql>`. Nunca acessa servidor/banco remoto nem lê credenciais.
