# Bolso: finanças pessoais (PWA)

App de controle financeiro que roda no navegador e se instala no iPhone como um app, sem App Store e sem conta de desenvolvedor Apple.

## O que tem

- **Visão geral**: patrimônio líquido (contas + investimentos − dívida de cartão), "livre até o fim do mês", vencimentos próximos, resumo do mês, gastos por categoria, saldo por conta, cartões, custo fixo e gráfico de 6 meses.
- **Contas e investimentos**: conta corrente, poupança, dinheiro, vale (VR/VA) e investimento. Ajuste de saldo e rendimento entram como ajuste e não contam como receita.
- **Lançamentos**: despesa, receita, transferência (aporte/resgate) e pagamento de fatura. Também tem parcelamento (até 48x), "repetir todo mês", busca e filtros.
- **Cartões**: fatura por mês de vencimento, regra de fechamento (compra no dia do fechamento vai para a próxima), status (aberta, fechada, paga, vencida), limite usado e disponível, parcelas futuras.
- **Contra duplicação**:
  - Compra no cartão não tira dinheiro da conta. Só o **pagamento da fatura** tira.
  - Pagamento de fatura não conta como gasto, porque as compras já foram contadas.
  - Um aviso aparece se você lançar como despesa um Pix com o mesmo valor de uma fatura aberta, ou com "fatura" na descrição. Um toque converte o lançamento.
  - Outro aviso aparece se existir um gasto de mesmo valor em ±3 dias, em qualquer conta ou cartão.
- **Agenda**: contas a pagar e a receber (atrasados, 7 dias, este mês, mês que vem), faturas incluídas, com botão para marcar como pago.
- **Fixos e assinaturas**: lançados sozinhos todo mês, com total mensal, total anual das assinaturas e % da renda.
- **Backup**: arquivo JSON (pela planilha de compartilhar do iPhone), restauração e exportação CSV para Excel.
- Esconder valores, desfazer exclusões e funcionamento offline.

## Onde ficam os dados

Na **sua conta no Supabase** (projeto *Data-NTO*, região São Paulo, schema `financeiro_nick`), com uma cópia no aparelho para o app funcionar sem internet.

- **Login**: e-mail e senha (Supabase Auth). Só os e-mails da tabela `nucleo.usuarios_permitidos` conseguem criar conta.
- **Segurança**: RLS em todas as tabelas. Cada usuário só lê e altera as próprias linhas. Visitante sem login não tem acesso. A chave no `cloud.js` é a *publishable* (pública por natureza).
- **Sincronização**: cada alteração é salva no aparelho e enviada à nuvem em seguida. Sem internet, fica pendente e sobe quando a conexão volta. Ao abrir o app, ele baixa a versão da nuvem, o que permite usar em mais de um aparelho.
- **Face ID**: em Mais → Sua conta. Pede Face ID ao abrir o app e depois de 1 minuto fora dele. Se o Face ID falhar, dá para entrar com a senha.
- **Migração**: no primeiro login, os dados salvos no aparelho antes da conta são enviados automaticamente. Uma cópia fica em `bolso.v1.migrado` no aparelho.

### Banco (Supabase)

| Tabela | Conteúdo |
|---|---|
| `financeiro_nick.contas` | Contas, carteira, vales e investimentos |
| `financeiro_nick.cartoes` | Cartões (fechamento, vencimento, limite) |
| `financeiro_nick.categorias` | Categorias de gasto e entrada |
| `financeiro_nick.recorrentes` | Fixos, assinaturas e entradas fixas |
| `financeiro_nick.lancamentos` | Despesas, receitas, transferências, faturas pagas e ajustes |
| `financeiro_nick.preferencias` | Preferências por usuário |
| `nucleo.usuarios_permitidos` | E-mails liberados para criar conta (vale para todos os projetos pessoais) |

As migrações aplicadas estão em `supabase/migrations/`.

### Avisos de vencimento (notificações)

- Liga em **Mais → Avisos de vencimento**. No iPhone, só funciona com o app instalado na tela de início (iOS 16.4 ou mais novo).
- Todo dia às **9h (Brasília)** o `pg_cron` chama a Edge Function `avisos` (`supabase/functions/avisos/index.ts`). Ela manda uma notificação com:
  - contas e faturas que vencem hoje;
  - as que vencem daqui a N dias (preferência `aviso_dias`);
  - as atrasadas há 1, 3 ou 7 dias;
  - os valores a receber hoje.
- Uma notificação por pessoa por dia (`financeiro_nick.push_envios`). Aparelhos que desinstalaram o app são removidos automaticamente.
- Segredos no Vault do Supabase: `vapid_keys` (gerada pela própria função) e `avisos_cron_secret`.
- Reimplantar a função: pelo MCP/CLI do Supabase, com `verify_jwt = false`. A função faz a própria autenticação: login do usuário para `testar` e senha do agendador para `enviar`.

Para liberar outro e-mail (SQL Editor do Supabase):

```sql
insert into nucleo.usuarios_permitidos (email, nome) values ('email@exemplo.com', 'Nome');
```

**Novo projeto pessoal no mesmo Supabase**: crie um schema próprio (ex.: `viagens_nick`), aplique RLS como em `financeiro_nick` e inclua o schema em `pgrst.db_schemas` (ver `supabase/migrations/20261106_03_expor_schema_na_api.sql`) ou em Project Settings → Data API → Exposed schemas.

## Rodar localmente

```bash
python -m http.server 5178 --directory C:\dev\financeiro-pessoal
```

Depois abra http://localhost:5178.

## Publicar (precisa de HTTPS para instalar no iPhone)

É um site estático, sem build. Qualquer hospedagem estática serve: Vercel, Netlify, GitHub Pages ou Cloudflare Pages. Suba a pasta inteira.

**Ao atualizar o app**, aumente `VERSION` em `sw.js` (ex.: `bolso-v2`) para o cache offline ser renovado.

## Instalar no iPhone

1. Abra o endereço publicado no **Safari**.
2. Toque em **Compartilhar** → **Adicionar à Tela de Início**.
3. Abra pelo ícone **Bolso**.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `index.html` | Página e metatags de app do iPhone |
| `styles.css` | Visual em vidro fosco (glass) |
| `app.js` | Lógica e telas do app |
| `cloud.js` | Login, sincronização com o Supabase e Face ID |
| `vendor/` | Biblioteca supabase-js (local, para abrir offline) |
| `supabase/migrations/` | SQL aplicado no banco |
| `sw.js` | Funcionamento offline |
| `manifest.webmanifest` | Nome, cores e ícones do app |
| `icons/` | Ícones PNG (gerados por `tools/make-icons.ps1`) |
