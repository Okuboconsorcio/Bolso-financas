-- Aplicada em 2026-11-06 no projeto Supabase Data-NTO (dkwtidhcuvrdzfcewfoz).
-- Perfil da pessoa (vale para todos os projetos pessoais do Data-NTO).
create table public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  sobrenome text not null check (char_length(btrim(sobrenome)) between 1 and 80),
  telefone text not null check (telefone ~ '^\+\d{10,15}$'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.perfis is 'Nome, sobrenome e telefone (formato +55DDDNUMERO) de cada usuário';

alter table public.perfis enable row level security;
alter table public.perfis force row level security;
revoke all on public.perfis from public, anon;
grant select, insert, update on public.perfis to authenticated;
grant all on public.perfis to service_role;

create policy "dono vê" on public.perfis for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.perfis for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.perfis for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger tocar_atualizado_em before update on public.perfis
  for each row execute function financeiro_nick.tocar_atualizado_em();

-- Ao criar a conta, usa nome/sobrenome/telefone enviados no cadastro.
-- Se algo vier faltando, não bloqueia o cadastro: o app pede para completar depois.
create or replace function nucleo.criar_perfil_no_cadastro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if coalesce(btrim(new.raw_user_meta_data ->> 'nome'), '') <> ''
       and coalesce(btrim(new.raw_user_meta_data ->> 'sobrenome'), '') <> ''
       and coalesce(new.raw_user_meta_data ->> 'telefone', '') ~ '^\+\d{10,15}$' then
      insert into public.perfis (user_id, nome, sobrenome, telefone)
      values (new.id, btrim(new.raw_user_meta_data ->> 'nome'), btrim(new.raw_user_meta_data ->> 'sobrenome'), new.raw_user_meta_data ->> 'telefone')
      on conflict (user_id) do nothing;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;
revoke execute on function nucleo.criar_perfil_no_cadastro() from public, anon, authenticated;
grant execute on function nucleo.criar_perfil_no_cadastro() to supabase_auth_admin;

create trigger criar_perfil_no_cadastro
  after insert on auth.users
  for each row execute function nucleo.criar_perfil_no_cadastro();

-- Perfil do Nicolas preenchido manualmente (conta criada antes desta tabela):
-- insert into public.perfis (user_id, nome, sobrenome, telefone)
-- select id, 'Nicolas', 'Okubo', '+5511958801219' from auth.users where email = 'nicolas@okuboconsorcio.com.br';
