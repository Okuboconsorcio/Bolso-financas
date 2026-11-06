// Bolso — avisos de vencimento por notificação (Web Push).
//
// Ações (POST com JSON { acao }):
//   "chave"   → devolve a chave pública VAPID (pública por natureza; o app usa para se inscrever)
//   "testar"  → manda um aviso agora para os aparelhos de quem está logado (Authorization: Bearer <token>)
//   "enviar"  → rodada diária do agendador (pg_cron); exige o cabeçalho x-cron-secret
//
// As chaves VAPID são geradas na primeira chamada e guardadas no Vault do Supabase.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3 });
const CONTATO = "mailto:nicolas@okuboconsorcio.com.br";
const APP_URL = "https://bolso-financas-six.vercel.app/?abrir=agenda";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function segredo(nome: string): Promise<string | null> {
  const r = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${nome} limit 1`;
  return r[0]?.decrypted_secret ?? null;
}

// ---------- chaves VAPID ----------
type Vapid = { server: any; publicKey: string };
let vapidP: Promise<Vapid> | null = null;
async function carregarVapid(): Promise<Vapid> {
  let raw = await segredo("vapid_keys");
  if (!raw) {
    const keys = await webpush.generateVapidKeys({ extractable: true });
    raw = JSON.stringify(await webpush.exportVapidKeys(keys));
    try {
      await sql`select vault.create_secret(${raw}, 'vapid_keys', 'Chaves VAPID das notificações do Bolso')`;
    } catch (_) {
      raw = await segredo("vapid_keys"); // outra execução criou ao mesmo tempo
    }
  }
  const vapidKeys = await webpush.importVapidKeys(JSON.parse(raw!), { extractable: false });
  const server = await webpush.ApplicationServer.new({ contactInformation: CONTATO, vapidKeys });
  const publicKey = await webpush.exportApplicationServerKey(vapidKeys);
  return { server, publicKey };
}
const vapid = () => (vapidP ??= carregarVapid().catch((e) => { vapidP = null; throw e; }));

// ---------- o que avisar ----------
type Item = { user_id: string; tipo: string; descricao: string; valor: number; dias: number; mostrar_valor: boolean };

// Contas a pagar/receber pendentes e faturas com saldo, que vencem hoje, daqui a N dias
// (preferência da pessoa) ou que estão atrasadas há 1, 3 ou 7 dias.
async function itensDoDia(userId: string | null, ignorarDesligado = false): Promise<Item[]> {
  return await sql<Item[]>`
    with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
    alvo as (
      select distinct s.user_id from financeiro_nick.push_inscricoes s
      where ${userId}::uuid is null or s.user_id = ${userId}::uuid
    ),
    prefs as (
      select a.user_id,
        coalesce(p.aviso_dias, 1) as dias,
        coalesce(p.avisos_ativos, true) as ativos,
        coalesce(p.aviso_mostrar_valor, true) as mostrar_valor
      from alvo a left join financeiro_nick.preferencias p on p.user_id = a.user_id
    ),
    contas as (
      select l.user_id, l.tipo, coalesce(nullif(l.descricao, ''), 'Conta') as descricao, l.valor, l.data as vence
      from financeiro_nick.lancamentos l join prefs p on p.user_id = l.user_id
      where l.pago = false and l.cartao_id is null and l.tipo in ('despesa', 'receita')
    ),
    faturas as (
      select c.user_id, 'fatura'::text as tipo, 'Fatura ' || c.nome as descricao,
        sum(case when l.tipo = 'despesa' then l.valor else -l.valor end) as valor,
        make_date(split_part(l.fatura, '-', 1)::int, split_part(l.fatura, '-', 2)::int, 1)
          + (least(c.dia_vencimento, extract(day from (make_date(split_part(l.fatura, '-', 1)::int, split_part(l.fatura, '-', 2)::int, 1) + interval '1 month - 1 day'))::int) - 1) as vence
      from financeiro_nick.cartoes c
      join financeiro_nick.lancamentos l on l.user_id = c.user_id and l.cartao_id = c.id
        and l.fatura is not null and l.tipo in ('despesa', 'receita', 'fatura')
      join prefs p on p.user_id = c.user_id
      where not c.arquivado
      group by c.user_id, c.id, c.nome, c.dia_vencimento, l.fatura
    )
    select x.user_id, x.tipo, x.descricao, x.valor::float8 as valor, (x.vence - h.d)::int as dias, p.mostrar_valor
    from (select * from contas union all select * from faturas) x
    join prefs p on p.user_id = x.user_id
    cross join hoje h
    where (p.ativos or ${ignorarDesligado}) and x.valor > 0.004 and (
      x.vence = h.d
      or (p.dias > 0 and x.tipo <> 'receita' and x.vence = h.d + p.dias)
      or (x.tipo <> 'receita' and (h.d - x.vence) in (1, 3, 7))
    )
    order by x.user_id, x.vence, x.valor desc`;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quando = (d: number) => d === 0 ? "hoje" : d === 1 ? "amanhã" : d > 1 ? `em ${d} dias` : d === -1 ? "desde ontem" : `há ${-d} dias`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function montar(itens: Item[]) {
  const mostrar = itens[0]?.mostrar_valor ?? true;
  const v = (i: Item) => (mostrar ? ` ${brl.format(i.valor)}` : "");
  const lista = (arr: Item[]) => arr.map((i) => `${i.descricao}${v(i)}`).join(" · ");
  const pagar = itens.filter((i) => i.tipo !== "receita");
  const hoje = pagar.filter((i) => i.dias === 0);
  const prox = pagar.filter((i) => i.dias > 0);
  const atras = pagar.filter((i) => i.dias < 0);
  const receber = itens.filter((i) => i.tipo === "receita");

  let title: string;
  if (hoje.length) title = hoje.length === 1 ? `${hoje[0].descricao} vence hoje` : `${hoje.length} contas vencem hoje`;
  else if (prox.length) title = prox.length === 1 ? `${prox[0].descricao} vence ${quando(prox[0].dias)}` : `${prox.length} contas vencem ${quando(prox[0].dias)}`;
  else if (atras.length) title = atras.length === 1 ? `${atras[0].descricao} está atrasada` : `${atras.length} contas atrasadas`;
  else title = receber.length === 1 ? `${receber[0].descricao}: entra hoje` : `${receber.length} valores entram hoje`;

  const linhas: string[] = [];
  if (hoje.length) linhas.push(`Hoje: ${lista(hoje)}`);
  if (prox.length) linhas.push(`${cap(quando(prox[0].dias))}: ${lista(prox)}`);
  if (atras.length) linhas.push(`Atrasado: ${atras.map((i) => `${i.descricao}${v(i)} (${quando(i.dias)})`).join(" · ")}`);
  if (receber.length) linhas.push(`A receber hoje: ${lista(receber)}`);
  return { title, body: linhas.join("\n"), url: APP_URL, tag: "bolso-vencimentos" };
}

// ---------- envio ----------
async function enviarPara(userId: string, payload: Record<string, unknown>) {
  const { server } = await vapid();
  const subs = await sql`select endpoint, p256dh, auth from financeiro_nick.push_inscricoes where user_id = ${userId}`;
  let ok = 0, removidos = 0;
  for (const s of subs) {
    try {
      await server
        .subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
        .pushTextMessage(JSON.stringify(payload), { ttl: 60 * 60 * 12, topic: "vencimentos" });
      ok++;
      await sql`update financeiro_nick.push_inscricoes set ultimo_envio = now() where user_id = ${userId} and endpoint = ${s.endpoint}`;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404 || status === 410) {
        // aparelho desinstalou o app ou revogou a permissão
        await sql`delete from financeiro_nick.push_inscricoes where user_id = ${userId} and endpoint = ${s.endpoint}`;
        removidos++;
      } else {
        console.error("push falhou", status, String(e));
      }
    }
  }
  return { aparelhos: subs.length, enviados: ok, removidos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const acao = body?.acao;

    if (acao === "chave") return json({ chave: (await vapid()).publicKey });

    if (acao === "enviar") {
      const s = await segredo("avisos_cron_secret");
      if (!s || req.headers.get("x-cron-secret") !== s) return json({ erro: "não autorizado" }, 401);
      const itens = await itensDoDia(null);
      const porPessoa = new Map<string, Item[]>();
      for (const i of itens) porPessoa.set(i.user_id, [...(porPessoa.get(i.user_id) ?? []), i]);
      const resultado = [];
      for (const [userId, lista] of porPessoa) {
        const novo = await sql`
          insert into financeiro_nick.push_envios (user_id, dia, itens)
          values (${userId}, (now() at time zone 'America/Sao_Paulo')::date, ${lista.length})
          on conflict do nothing returning 1`;
        if (!novo.length) continue; // já avisou hoje
        resultado.push({ itens: lista.length, ...(await enviarPara(userId, montar(lista))) });
      }
      return json({ pessoas: porPessoa.size, resultado });
    }

    if (acao === "testar") {
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data, error } = await auth.auth.getUser(token);
      if (error || !data?.user) return json({ erro: "Faça login para testar" }, 401);
      const itens = await itensDoDia(data.user.id, true);
      const payload = itens.length
        ? { ...montar(itens), tag: "bolso-teste" }
        : { title: "Avisos do Bolso ligados ✓", body: "Todo dia às 9h você recebe o que vence e o que está atrasado.", url: APP_URL, tag: "bolso-teste" };
      return json(await enviarPara(data.user.id, payload));
    }

    return json({ erro: "ação desconhecida" }, 400);
  } catch (e: any) {
    console.error(e);
    return json({ erro: String(e?.message ?? e) }, 500);
  }
});
