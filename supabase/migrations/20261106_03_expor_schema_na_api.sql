-- Aplicado em 2026-11-06. Libera o schema financeiro_nick na API REST (PostgREST).
-- O mesmo ajuste pode ser feito no painel: Project Settings → Data API → Exposed schemas.
-- Ao criar o schema de um novo projeto pessoal, inclua-o aqui também.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, financeiro_nick';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
