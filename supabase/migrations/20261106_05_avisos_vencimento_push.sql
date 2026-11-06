-- Aplicada em 2026-11-06 no projeto Supabase Data-NTO (dkwtidhcuvrdzfcewfoz).
-- Avisos de vencimento por notificação (Web Push).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Aparelhos que aceitaram receber notificações
create table financeiro_nick.push_inscricoes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  dispositivo text check (dispositivo is null or char_length(dispositivo) <= 200),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  ultimo_envio timestamptz,
  primary key (user_id, endpoint)
);
comment on table financeiro_nick.push_inscricoes is 'Aparelhos inscritos para receber avisos de vencimento (Web Push)';
alter table financeiro_nick.push_inscricoes enable row level security;
alter table financeiro_nick.push_inscricoes force row level security;
revoke all on financeiro_nick.push_inscricoes from public, anon;
grant select, insert, update, delete on financeiro_nick.push_inscricoes to authenticated;
grant all on financeiro_nick.push_inscricoes to service_role;
create policy "dono vê" on financeiro_nick.push_inscricoes for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on financeiro_nick.push_inscricoes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on financeiro_nick.push_inscricoes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on financeiro_nick.push_inscricoes for delete to authenticated using ((select auth.uid()) = user_id);
create trigger tocar_atualizado_em before update on financeiro_nick.push_inscricoes
  for each row execute function financeiro_nick.tocar_atualizado_em();

-- Registro de envios (1 aviso por pessoa por dia) — só a função de envio usa
create table financeiro_nick.push_envios (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  itens integer not null default 0,
  enviado_em timestamptz not null default now(),
  primary key (user_id, dia)
);
comment on table financeiro_nick.push_envios is 'Controle interno: evita mandar o aviso diário duas vezes';
alter table financeiro_nick.push_envios enable row level security;
revoke all on financeiro_nick.push_envios from public, anon, authenticated;
grant all on financeiro_nick.push_envios to service_role;

-- Preferências de aviso
alter table financeiro_nick.preferencias
  add column avisos_ativos boolean not null default true,
  add column aviso_dias smallint not null default 1 check (aviso_dias between 0 and 7),
  add column aviso_mostrar_valor boolean not null default true;
comment on column financeiro_nick.preferencias.aviso_dias is 'Quantos dias antes do vencimento avisar (além do próprio dia). 0 = só no dia';

-- Senha que o agendador usa para chamar a função (fica no cofre, ninguém vê)
select vault.create_secret(
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  'avisos_cron_secret',
  'Senha que o agendador (pg_cron) usa para chamar a função avisos'
);
-- As chaves VAPID ('vapid_keys') são geradas pela própria função avisos na primeira chamada.
