-- Aplicada em 2026-11-06 no projeto Supabase Data-NTO (dkwtidhcuvrdzfcewfoz).
-- Núcleo: controle de acesso compartilhado por todos os projetos pessoais.
-- Não é exposto na API: só o banco (e o painel do Supabase) enxergam.
create schema if not exists nucleo;
comment on schema nucleo is 'Controle de acesso compartilhado pelos projetos pessoais (não exposto na API)';
revoke all on schema nucleo from public, anon, authenticated;
grant usage on schema nucleo to supabase_auth_admin;

create table nucleo.usuarios_permitidos (
  email text primary key check (email = lower(email) and email like '%@%'),
  nome text,
  criado_em timestamptz not null default now()
);
comment on table nucleo.usuarios_permitidos is 'Só e-mails desta lista conseguem criar conta no projeto. Para liberar alguém: insert into nucleo.usuarios_permitidos (email, nome) values (''email@x.com'', ''Nome'');';
alter table nucleo.usuarios_permitidos enable row level security;
-- Sem policies de propósito: anon/authenticated não leem nem alteram a lista.
revoke all on nucleo.usuarios_permitidos from public, anon, authenticated;
grant select on nucleo.usuarios_permitidos to supabase_auth_admin;

insert into nucleo.usuarios_permitidos (email, nome) values ('nicolas@okuboconsorcio.com.br', 'Nicolas');

create or replace function nucleo.bloquear_cadastro_nao_autorizado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or not exists (
    select 1 from nucleo.usuarios_permitidos p where p.email = lower(new.email)
  ) then
    raise exception 'Cadastro não autorizado para este e-mail' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function nucleo.bloquear_cadastro_nao_autorizado() from public, anon, authenticated;
grant execute on function nucleo.bloquear_cadastro_nao_autorizado() to supabase_auth_admin;

create trigger bloquear_cadastro_nao_autorizado
  before insert on auth.users
  for each row execute function nucleo.bloquear_cadastro_nao_autorizado();
