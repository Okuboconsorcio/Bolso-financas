-- Aplicada em 2026-11-06 no projeto Supabase Data-NTO (dkwtidhcuvrdzfcewfoz).
-- Bolso: finanças pessoais. Cada linha pertence a um usuário (user_id) e só ele acessa.
create schema if not exists financeiro_nick;
comment on schema financeiro_nick is 'Bolso — finanças pessoais (contas, cartões, lançamentos, fixos)';
revoke all on schema financeiro_nick from public, anon;
grant usage on schema financeiro_nick to authenticated, service_role;

create or replace function financeiro_nick.tocar_atualizado_em()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function financeiro_nick.tocar_atualizado_em() from public, anon;

create table financeiro_nick.categorias (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  nome text not null check (char_length(nome) between 1 and 60),
  icone text not null default '🏷️' check (char_length(icone) <= 16),
  tipo text not null check (tipo in ('despesa', 'receita')),
  cor text not null default '#9AA3BC' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, id)
);
comment on table financeiro_nick.categorias is 'Categorias de gastos e entradas';

create table financeiro_nick.contas (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  nome text not null check (char_length(nome) between 1 and 60),
  tipo text not null check (tipo in ('corrente', 'poupanca', 'carteira', 'beneficio', 'investimento')),
  saldo_inicial numeric(14,2) not null default 0,
  cor text not null default '#5AAEE8' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  arquivada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, id)
);
comment on table financeiro_nick.contas is 'Contas bancárias, carteira, vales e investimentos. Saldo = saldo_inicial + lançamentos pagos';

create table financeiro_nick.cartoes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  nome text not null check (char_length(nome) between 1 and 60),
  limite numeric(14,2) not null default 0 check (limite >= 0),
  dia_fechamento smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  conta_pagamento_id text,
  cor text not null default '#8A5CF6' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  arquivado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, conta_pagamento_id) references financeiro_nick.contas (user_id, id) on delete set null (conta_pagamento_id)
);
comment on table financeiro_nick.cartoes is 'Cartões de crédito. A fatura é identificada pelo mês de vencimento (AAAA-MM)';

create table financeiro_nick.recorrentes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  descricao text not null check (char_length(descricao) between 1 and 120),
  valor numeric(14,2) not null check (valor >= 0),
  tipo text not null check (tipo in ('despesa', 'receita')),
  grupo text not null check (grupo in ('fixo', 'assinatura', 'renda')),
  categoria_id text,
  conta_id text,
  cartao_id text,
  dia smallint not null check (dia between 1 and 31),
  inicio text not null check (inicio ~ '^\d{4}-\d{2}$'),
  fim text check (fim is null or fim ~ '^\d{4}-\d{2}$'),
  ativo boolean not null default true,
  meses_gerados text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, categoria_id) references financeiro_nick.categorias (user_id, id) on delete set null (categoria_id),
  foreign key (user_id, conta_id) references financeiro_nick.contas (user_id, id) on delete set null (conta_id),
  foreign key (user_id, cartao_id) references financeiro_nick.cartoes (user_id, id) on delete set null (cartao_id)
);
comment on table financeiro_nick.recorrentes is 'Custos fixos, assinaturas e entradas fixas, lançados automaticamente todo mês';

create table financeiro_nick.lancamentos (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  tipo text not null check (tipo in ('despesa', 'receita', 'transferencia', 'fatura', 'ajuste')),
  descricao text not null default '' check (char_length(descricao) <= 120),
  valor numeric(14,2) not null,
  data date not null,
  pago boolean not null default true,
  pago_em date,
  conta_id text,
  conta_destino_id text,
  cartao_id text,
  fatura text check (fatura is null or fatura ~ '^\d{4}-\d{2}$'),
  categoria_id text,
  recorrente_id text,
  parcela_num smallint check (parcela_num is null or parcela_num >= 1),
  parcela_total smallint check (parcela_total is null or parcela_total >= 1),
  parcela_grupo text,
  data_compra date,
  observacao text check (observacao is null or char_length(observacao) <= 500),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, id),
  check (tipo = 'ajuste' or valor >= 0),
  foreign key (user_id, conta_id) references financeiro_nick.contas (user_id, id) on delete set null (conta_id),
  foreign key (user_id, conta_destino_id) references financeiro_nick.contas (user_id, id) on delete set null (conta_destino_id),
  foreign key (user_id, cartao_id) references financeiro_nick.cartoes (user_id, id) on delete set null (cartao_id),
  foreign key (user_id, categoria_id) references financeiro_nick.categorias (user_id, id) on delete set null (categoria_id),
  foreign key (user_id, recorrente_id) references financeiro_nick.recorrentes (user_id, id) on delete set null (recorrente_id)
);
comment on table financeiro_nick.lancamentos is 'Despesas, receitas, transferências, pagamentos de fatura e ajustes de saldo';
comment on column financeiro_nick.lancamentos.fatura is 'Para compras no cartão e pagamentos de fatura: mês de vencimento da fatura (AAAA-MM)';

create table financeiro_nick.preferencias (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  cartao_conta_no_mes text not null default 'fatura' check (cartao_conta_no_mes in ('fatura', 'compra')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table financeiro_nick.preferencias is 'Preferências do app por usuário';

-- índices das chaves estrangeiras e consultas comuns
create index on financeiro_nick.cartoes (user_id, conta_pagamento_id);
create index on financeiro_nick.recorrentes (user_id, categoria_id);
create index on financeiro_nick.recorrentes (user_id, conta_id);
create index on financeiro_nick.recorrentes (user_id, cartao_id);
create index on financeiro_nick.lancamentos (user_id, data);
create index on financeiro_nick.lancamentos (user_id, conta_id);
create index on financeiro_nick.lancamentos (user_id, conta_destino_id);
create index on financeiro_nick.lancamentos (user_id, cartao_id, fatura);
create index on financeiro_nick.lancamentos (user_id, categoria_id);
create index on financeiro_nick.lancamentos (user_id, recorrente_id);

-- RLS, permissões e atualizado_em em todas as tabelas
do $$
declare t text;
begin
  foreach t in array array['categorias', 'contas', 'cartoes', 'recorrentes', 'lancamentos', 'preferencias'] loop
    execute format('alter table financeiro_nick.%I enable row level security', t);
    execute format('alter table financeiro_nick.%I force row level security', t);
    execute format('revoke all on financeiro_nick.%I from public, anon', t);
    execute format('grant select, insert, update, delete on financeiro_nick.%I to authenticated', t);
    execute format('grant all on financeiro_nick.%I to service_role', t);
    execute format('create policy "dono vê" on financeiro_nick.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono cria" on financeiro_nick.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono altera" on financeiro_nick.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono apaga" on financeiro_nick.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create trigger tocar_atualizado_em before update on financeiro_nick.%I for each row execute function financeiro_nick.tocar_atualizado_em()', t);
  end loop;
end $$;
