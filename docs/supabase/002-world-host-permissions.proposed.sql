-- LAST NIGHT: continuar E salvar sem o anfitrião.
-- PROPOSTA. NÃO aplicada por Codex. Aplicação manual pelo proprietário.
-- Executar uma vez: CREATE sem OR REPLACE evita substituir objetos existentes.
-- Adiciona uma tabela e três RPCs. Não altera nenhuma policy, função ou trigger
-- existente. Nenhum save/membro recebe autorização automaticamente.
begin;

create table public.world_host_permissions (
  world_id uuid not null,
  user_id uuid not null,
  granted_at timestamptz not null default now(),
  primary key (world_id, user_id),
  foreign key (world_id, user_id) references public.world_members(world_id, user_id) on delete cascade
);
alter table public.world_host_permissions enable row level security;
-- Sem acesso direto: inclusive authenticated usa exclusivamente as RPCs abaixo.
revoke all on table public.world_host_permissions from public, anon, authenticated, service_role;

create function public.get_world_host_permissions(p_world_id uuid)
returns table(user_id uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated'
     or not exists(select 1 from public.world_members m where m.world_id=p_world_id and m.user_id=auth.uid()) then
    raise exception 'World access denied' using errcode='42501';
  end if;
  return query select w.owner_id from public.worlds w where w.id=p_world_id and w.is_active
    union select h.user_id from public.world_host_permissions h
    join public.worlds w on w.id=h.world_id and w.is_active where h.world_id=p_world_id;
end;
$$;

create function public.set_world_host_permission(p_world_id uuid, p_user_id uuid, p_allowed boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare w public.worlds%rowtype;
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated' then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  -- Mesmo lock usado pelo save: revogação e gravação nunca passam juntas.
  select * into w from public.worlds where id=p_world_id for update;
  if not found or not w.is_active or w.owner_id<>auth.uid() then
    raise exception 'Only the owner can grant hosting' using errcode='42501';
  end if;
  if p_user_id is null or p_user_id=w.owner_id or p_allowed is null then
    raise exception 'Invalid hosting permission' using errcode='22023';
  end if;
  if p_allowed then
    perform 1 from public.world_members m where m.world_id=p_world_id and m.user_id=p_user_id for key share;
    if not found then raise exception 'Member required' using errcode='42501'; end if;
    insert into public.world_host_permissions(world_id,user_id) values(p_world_id,p_user_id)
      on conflict(world_id,user_id) do nothing;
  else
    delete from public.world_host_permissions where world_id=p_world_id and user_id=p_user_id;
  end if;
end;
$$;

create function public.save_hosted_world(
  p_world_id uuid, p_expected_revision bigint, p_state jsonb, p_session_token text default null
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid:=auth.uid(); w public.worlds%rowtype; s public.world_state%rowtype;
  incoming jsonb; incoming_sequence bigint; previous_sequence bigint;
  saved_day integer; saved_time real;
begin
  if caller is null or auth.role() is distinct from 'authenticated' then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  select * into w from public.worlds where id=p_world_id for update;
  if not found or not w.is_active then raise exception 'World access denied' using errcode='42501'; end if;
  perform 1 from public.world_members m where m.world_id=p_world_id and m.user_id=caller for key share;
  if not found then raise exception 'Membership required' using errcode='42501'; end if;
  if caller<>w.owner_id and not exists(select 1 from public.world_host_permissions h where h.world_id=p_world_id and h.user_id=caller) then
    raise exception 'Hosting permission required' using errcode='42501';
  end if;
  if p_expected_revision is null or p_expected_revision<0
     or p_state is null or jsonb_typeof(p_state) is distinct from 'object'
     or octet_length(p_state::text)>4000000
     or p_state->>'format' is distinct from 'last-night'
     or p_state->>'schema_version' is distinct from '1'
     or p_state->>'runSeed' is distinct from w.seed::text
     or jsonb_typeof(p_state->'extra') is distinct from 'object'
     or jsonb_typeof(p_state->'checkpoint') is distinct from 'object'
     or p_state#>>'{checkpoint,v}' is distinct from '2'
     or coalesce(p_state#>>'{checkpoint,revision}','') !~ '^[0-9]{1,15}$'
     or coalesce(p_state#>>'{checkpoint,survival,day}','') !~ '^[0-9]{1,9}$'
     or coalesce(p_state#>>'{checkpoint,survival,elapsed}','') !~ '^[0-9]+([.][0-9]+)?$'
     or (p_session_token is not null and p_session_token !~ '^[a-zA-Z0-9-]{8,64}$') then
    raise exception 'Invalid world payload' using errcode='22023';
  end if;
  incoming_sequence:=(p_state#>>'{checkpoint,revision}')::bigint;
  saved_day:=(p_state#>>'{checkpoint,survival,day}')::integer;
  saved_time:=(p_state#>>'{checkpoint,survival,elapsed}')::real;
  if saved_day<1 or saved_time<0 or saved_time>1000000000 then
    raise exception 'Invalid survival clock' using errcode='22023';
  end if;
  -- Remove qualquer marcador arbitrário do payload e grava o token desta chamada.
  incoming:=jsonb_set(p_state,'{extra}',(p_state->'extra')-'hostSession');
  if p_session_token is not null then incoming:=jsonb_set(incoming,'{extra,hostSession}',to_jsonb(p_session_token)); end if;
  select * into s from public.world_state where world_id=p_world_id for update;
  if not found then raise exception 'World state missing' using errcode='42501'; end if;
  if s.state=incoming then return s.revision; end if;
  if s.revision<>p_expected_revision then
    -- Handoff não recarrega cegamente a revisão. Só aceita checkpoint MAIS NOVO
    -- da MESMA partida. Outra partida/solo usa CAS estrito. O token não concede
    -- permissão: a autorização por auth.uid() já foi conferida acima.
    if p_session_token is null or s.state#>>'{extra,hostSession}' is distinct from p_session_token
       or coalesce(s.state#>>'{checkpoint,revision}','') !~ '^[0-9]{1,15}$' then
      raise exception 'World changed in another session' using errcode='40001';
    end if;
    previous_sequence:=(s.state#>>'{checkpoint,revision}')::bigint;
    if incoming_sequence<=previous_sequence then
      raise exception 'Stale checkpoint' using errcode='40001';
    end if;
  elsif p_session_token is not null and s.state#>>'{extra,hostSession}'=p_session_token
     and coalesce(s.state#>>'{checkpoint,revision}','') ~ '^[0-9]{1,15}$'
     and incoming_sequence<(s.state#>>'{checkpoint,revision}')::bigint then
    raise exception 'Stale checkpoint' using errcode='40001';
  end if;
  update public.world_state set state=incoming,revision=s.revision+1 where world_id=p_world_id;
  update public.worlds set current_day=saved_day,game_time=saved_time where id=p_world_id;
  return s.revision+1;
end;
$$;

revoke all on function public.get_world_host_permissions(uuid) from public, anon, service_role;
revoke all on function public.set_world_host_permission(uuid,uuid,boolean) from public, anon, service_role;
revoke all on function public.save_hosted_world(uuid,bigint,jsonb,text) from public, anon, service_role;
grant execute on function public.get_world_host_permissions(uuid) to authenticated;
grant execute on function public.set_world_host_permission(uuid,uuid,boolean) to authenticated;
grant execute on function public.save_hosted_world(uuid,bigint,jsonb,text) to authenticated;

comment on table public.world_host_permissions is 'Autorização explícita do proprietário para continuar e salvar um mundo sem ele. Não concede administração nem escrita em saves de terceiros.';
comment on function public.save_hosted_world(uuid,bigint,jsonb,text) is 'Save atômico por auth.uid() proprietário ou membro autorizado. CAS entre partidas; sequência monotônica dentro da mesma partida para handoff.';
commit;
