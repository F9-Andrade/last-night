-- LAST NIGHT / DATABASE V1 / Resgate atômico de convite
-- NÃO EXECUTADA. Solução aprovada; aplicação manual pelo proprietário.
-- Adição compatível com o schema fornecido: não altera tabelas, triggers,
-- policies ou funções existentes; não remove dados e não desabilita RLS.
-- Executar uma única vez no SQL Editor do projeto correto.
-- CREATE FUNCTION (sem OR REPLACE) falha sem substituir uma função homônima.
begin;

create function public.accept_world_invite(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  invitation public.world_invites%rowtype;
begin
  if caller is null or auth.role() is distinct from 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- Comparação exata: preserva formatos de códigos já existentes no banco.
  -- O cliente novo deve gerar tokens de 192 bits (48 caracteres hex),
  -- diferentes do código curto de sala Photon/LAN. Nunca aceitar user_id.
  if code is null or code = '' then
    raise exception 'Invalid or expired invitation' using errcode = '22023';
  end if;
  -- O lock é mantido até o fim da transação. Chamadas concorrentes para
  -- este convite aguardam e leem a contagem já atualizada.
  select i.* into invitation from public.world_invites i
  where i.invite_code = code for update;
  if not found then
    raise exception 'Invalid or expired invitation' using errcode = '22023';
  end if;
  if not exists (select 1 from public.worlds w where w.id = invitation.world_id and w.is_active) then
    raise exception 'Invalid or expired invitation' using errcode = '22023';
  end if;
  -- Repetir um resgate concluído é sucesso sem nova mutação, inclusive
  -- se o convite tiver esgotado/expirado desde então. Não há novo acesso:
  -- a associação já existe. Um convite inexistente não é aceito.
  if exists (select 1 from public.world_members m where m.world_id = invitation.world_id and m.user_id = caller) then
    return invitation.world_id;
  end if;
  if (invitation.expires_at is not null and invitation.expires_at <= clock_timestamp())
     or invitation.max_uses <= 0 or invitation.uses < 0
     or invitation.uses >= invitation.max_uses then
    raise exception 'Invalid or expired invitation' using errcode = '22023';
  end if;
  insert into public.world_members (world_id, user_id, role)
  values (invitation.world_id, caller, 'member')
  on conflict (world_id, user_id) do nothing;
  -- Dois convites diferentes para a mesma pessoa também são seguros:
  -- a PK permite uma única inserção e somente seu convite consome um uso.
  if found then
    update public.world_invites set uses = uses + 1 where id = invitation.id;
  end if;
  return invitation.world_id;
end;
$$;

revoke all on function public.accept_world_invite(text) from public, anon;
revoke all on function public.accept_world_invite(text) from service_role;
grant execute on function public.accept_world_invite(text) to authenticated;

comment on function public.accept_world_invite(text) is
  'Resgata um convite para auth.uid(), atomicamente e sem consumir uso de membro existente. EXECUTE apenas authenticated; nunca aceita user_id externo.';
commit;
