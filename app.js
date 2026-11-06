'use strict';
/* =========================================================
   Bolso — finanças pessoais (PWA)
   Os dados ficam só neste aparelho (localStorage).
   ========================================================= */

/* ---------- utilidades ---------- */
let KEY = 'bolso.v1'; // com login vira 'bolso.u.<id do usuário>' (cloud.js)
const $ = (s, el = document) => el.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const ymOf = (iso) => iso.slice(0, 7);
const addYM = (ym, n) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`; };
const daysIn = (y, m) => new Date(y, m, 0).getDate();
const dateIn = (ym, day) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(Math.min(day, daysIn(y, m)))}`; };
const addMonthsISO = (iso, n) => dateIn(addYM(ymOf(iso), n), +iso.slice(8, 10));
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const dayDiff = (a, b) => Math.round((Date.parse(a + 'T12:00:00') - Date.parse(b + 'T12:00:00')) / 864e5);
const endOfMonth = (ym) => dateIn(ym, 31);
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESF = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const ymLabel = (ym, long) => { const [y, m] = ym.split('-').map(Number); return long ? `${MESF[m - 1]} ${y}` : `${MES[m - 1]}/${String(y).slice(2)}`; };
const dLabel = (iso) => `${iso.slice(8, 10)} ${MES[+iso.slice(5, 7) - 1]}`;
const dayLabel = (iso) => {
  const dd = dayDiff(iso, todayISO());
  if (dd === 0) return 'hoje';
  if (dd === -1) return 'ontem';
  if (dd === 1) return 'amanhã';
  return `${DOW[new Date(iso + 'T12:00:00').getDay()]}, ${dLabel(iso)}`;
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const sum = (arr, f = (x) => x) => r2(arr.reduce((s, x) => s + (f(x) || 0), 0));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRLF = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = (v) => BRLF.format(v || 0).replace(/ /g, ' ');
const money = (v) => (S.settings.hide ? 'R$ ••••' : brl(v));
function moneyShort(v) {
  if (S.settings.hide) return 'R$ ••••';
  const a = Math.abs(v || 0), s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${s}R$ ${(a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return brl(v);
}
const moneyInput = (v) => (v ? Number(v).toFixed(2).replace('.', ',') : '');
function parseMoney(s) {
  s = String(s ?? '').trim().replace(/[^\d,.\-]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return r2(parseFloat(s) || 0);
}
function bigMoney(v) {
  if (S.settings.hide) return '<span class="cur">R$</span>••••';
  const [i, c] = Math.abs(v || 0).toFixed(2).split('.');
  return `<span class="cur">${v < 0 ? '−' : ''}R$</span>${Number(i).toLocaleString('pt-BR')}<span class="cents">,${c}</span>`;
}
function hexA(hex, a) {
  const h = (hex || '#888888').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- ícones ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="M17 12l4 4-4 4"/><path d="M21 16H7"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 20h16"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h1.5"/><path d="M6 6V5a1 1 0 0 1 1-1h10"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18.5h2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  scale: '<path d="M12 3v18M5 21h14M6 7h12"/><path d="M6 7l-3 7a3 3 0 0 0 6 0L6 7zM18 7l-3 7a3 3 0 0 0 6 0l-3-7z"/>',
  cloud: '<path d="M7 19h10.5a4.5 4.5 0 0 0 .6-8.96A6.5 6.5 0 0 0 5.6 9.3 4.9 4.9 0 0 0 7 19z"/>',
  faceid: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 15.5a4 4 0 0 0 5 0"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>'
};
const ic = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- dados padrão ---------- */
const DEF_CATS = [
  ['d_casa', 'Moradia', '🏠', 'despesa', '#5AAEE8'],
  ['d_contas', 'Contas da casa', '💡', 'despesa', '#F2B544'],
  ['d_mercado', 'Mercado', '🛒', 'despesa', '#52D9AA'],
  ['d_comer', 'Restaurantes', '🍽️', 'despesa', '#F2705C'],
  ['d_transp', 'Transporte', '🚗', 'despesa', '#7FC8F8'],
  ['d_saude', 'Saúde', '💊', 'despesa', '#FF8FB1'],
  ['d_educ', 'Educação', '📚', 'despesa', '#A990F2'],
  ['d_lazer', 'Lazer', '🎉', 'despesa', '#FFB86B'],
  ['d_compras', 'Compras', '🛍️', 'despesa', '#E58BF2'],
  ['d_assin', 'Assinaturas', '📺', 'despesa', '#8C9EFF'],
  ['d_pessoal', 'Cuidados', '💈', 'despesa', '#6FE3D3'],
  ['d_imp', 'Impostos e taxas', '🧾', 'despesa', '#C9B37E'],
  ['d_pets', 'Pets', '🐾', 'despesa', '#D9A36E'],
  ['d_viagem', 'Viagem', '✈️', 'despesa', '#4FD1E8'],
  ['d_presente', 'Presentes', '🎁', 'despesa', '#F28CA0'],
  ['c_out_d', 'Outros', '📦', 'despesa', '#9AA3BC'],
  ['r_sal', 'Salário', '💼', 'receita', '#52D9AA'],
  ['r_com', 'Comissões', '📈', 'receita', '#5AAEE8'],
  ['r_extra', 'Renda extra', '🧰', 'receita', '#F2B544'],
  ['r_rend', 'Rendimentos', '💰', 'receita', '#A990F2'],
  ['r_reemb', 'Reembolso', '↩️', 'receita', '#7FC8F8'],
  ['c_out_r', 'Outros', '📦', 'receita', '#9AA3BC']
].map(([id, name, icon, kind, color]) => ({ id, name, icon, kind, color }));

const COLORS = ['#5AAEE8', '#A990F2', '#8A5CF6', '#F2705C', '#FF9F43', '#F2B544', '#52D9AA', '#4FD1E8', '#E58BF2', '#3B4A6B'];
const ACC_TYPES = {
  corrente: { label: 'Conta corrente', icon: '🏦' },
  poupanca: { label: 'Poupança', icon: '🐷' },
  carteira: { label: 'Dinheiro vivo', icon: '💵' },
  beneficio: { label: 'Vale (VR/VA)', icon: '🍱' },
  investimento: { label: 'Investimento', icon: '📊' }
};
const INV_STATUS = {
  aberta: ['Aberta', ''],
  fechada: ['Fechada', 'soon'],
  paga: ['Paga', 'ok'],
  vencida: ['Vencida', 'late'],
  vazia: ['Sem gastos', '']
};

/* ---------- estado ---------- */
function fresh() {
  return {
    v: 1,
    accounts: [],
    cards: [],
    categories: DEF_CATS.map((c) => ({ ...c })),
    tx: [],
    recurring: [],
    settings: { hide: false, cardMode: 'fatura', lastBackup: null, installDismissed: false, sample: false }
  };
}
function normalize(d) {
  const f = fresh();
  const out = { ...f, ...d, settings: { ...f.settings, ...(d.settings || {}) } };
  for (const k of ['accounts', 'cards', 'tx', 'recurring']) if (!Array.isArray(out[k])) out[k] = [];
  if (!Array.isArray(out.categories) || !out.categories.length) out.categories = f.categories;
  for (const id of ['c_out_d', 'c_out_r']) if (!out.categories.some((c) => c.id === id)) out.categories.push(f.categories.find((c) => c.id === id));
  return out;
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { /* começa vazio */ }
  return fresh();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Não foi possível salvar: o armazenamento do aparelho está cheio'); }
  if (window.Cloud) Cloud.schedulePush();
}

let S = load();
const ui = { tab: 'inicio', month: ymOf(todayISO()), filter: 'todos', q: '', cardId: null, inv: {}, agenda: 'pagar', agendaAll: false, backupHidden: false };

/* ---------- consultas ---------- */
const acc = (id) => S.accounts.find((a) => a.id === id);
const card = (id) => S.cards.find((c) => c.id === id);
const cat = (id, kind = 'despesa') => S.categories.find((c) => c.id === id) || S.categories.find((c) => c.id === (kind === 'receita' ? 'c_out_r' : 'c_out_d'));
const activeAccounts = () => S.accounts.filter((a) => !a.archived);
const activeCards = () => S.cards.filter((c) => !c.archived);
const isInvest = (a) => a && a.type === 'investimento';

function balance(id) {
  const a = acc(id);
  let b = a ? a.initial || 0 : 0;
  for (const t of S.tx) {
    if (!t.paid) continue;
    switch (t.kind) {
      case 'receita': if (t.accountId === id && !t.cardId) b += t.amount; break;
      case 'despesa': if (t.accountId === id && !t.cardId) b -= t.amount; break;
      case 'transferencia': if (t.accountId === id) b -= t.amount; if (t.toAccountId === id) b += t.amount; break;
      case 'fatura': if (t.accountId === id) b -= t.amount; break;
      case 'ajuste': if (t.accountId === id) b += t.amount; break;
    }
  }
  return r2(b);
}

/* Cartão: a fatura é identificada pelo mês em que VENCE (ex.: "2026-12"). */
function closeDayIn(c, ym) { return +dateIn(ym, c.closingDay).slice(8); }
function invoiceKeyFor(c, iso) {
  const ym = ymOf(iso);
  const closeYM = +iso.slice(8) >= closeDayIn(c, ym) ? addYM(ym, 1) : ym; // compra no dia do fechamento já vai para a próxima
  return c.dueDay > c.closingDay ? closeYM : addYM(closeYM, 1);
}
function invDates(c, key) {
  const closeYM = c.dueDay > c.closingDay ? key : addYM(key, -1);
  return { close: dateIn(closeYM, c.closingDay), due: dateIn(key, c.dueDay) };
}
const currentKey = (c) => invoiceKeyFor(c, todayISO());
function invoice(cid, key) {
  const c = card(cid);
  const items = S.tx.filter((t) => t.cardId === cid && t.kind !== 'fatura' && t.invoice === key);
  const payments = S.tx.filter((t) => t.kind === 'fatura' && t.cardId === cid && t.invoice === key);
  const total = sum(items, (t) => (t.kind === 'despesa' ? t.amount : -t.amount));
  const paid = sum(payments, (t) => t.amount);
  const { close, due } = invDates(c, key);
  const today = todayISO();
  const remaining = r2(Math.max(0, total - paid));
  let status;
  if (total <= 0 && paid <= 0) status = today < close ? 'aberta' : 'vazia';
  else if (remaining <= 0.004) status = 'paga';
  else if (today < close) status = 'aberta';
  else if (today <= due) status = 'fechada';
  else status = 'vencida';
  return { key, total, paid, remaining, close, due, status, items, payments };
}
const cardKeys = (cid) => [...new Set(S.tx.filter((t) => t.cardId === cid && t.invoice).map((t) => t.invoice))].sort();
function cardUsed(cid) {
  let u = 0;
  for (const t of S.tx) {
    if (t.cardId !== cid) continue;
    if (t.kind === 'despesa') u += t.amount;
    else if (t.kind === 'receita' || t.kind === 'fatura') u -= t.amount;
  }
  return r2(u);
}
const openInvoices = (c) => cardKeys(c.id).map((k) => invoice(c.id, k)).filter((i) => i.remaining > 0.004);

/* Em que mês um lançamento conta nos relatórios */
function compMonth(t) {
  if (t.cardId && t.kind !== 'fatura' && S.settings.cardMode === 'fatura') return t.invoice;
  return ymOf(t.date);
}
const monthTx = (ym) => S.tx.filter((t) => compMonth(t) === ym);
function flows(ym) {
  let inc = 0, out = 0, incP = 0, outP = 0;
  for (const t of monthTx(ym)) {
    if (t.kind === 'receita') {
      if (t.cardId) out -= t.amount; // estorno no cartão abate o gasto
      else { inc += t.amount; if (!t.paid) incP += t.amount; }
    } else if (t.kind === 'despesa') {
      out += t.amount;
      if (!t.paid && !t.cardId) outP += t.amount;
    }
  }
  return { inc: r2(inc), out: r2(out), incP: r2(incP), outP: r2(outP), res: r2(inc - out) };
}
function byCategory(ym) {
  const m = new Map();
  for (const t of monthTx(ym)) {
    if (t.kind === 'despesa') m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount);
    else if (t.kind === 'receita' && t.cardId) m.set(t.categoryId, (m.get(t.categoryId) || 0) - t.amount);
  }
  return [...m.entries()].map(([id, v]) => ({ c: cat(id), v: r2(v) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
}
function totals() {
  const accs = activeAccounts();
  const cash = sum(accs.filter((a) => !isInvest(a)), (a) => balance(a.id));
  const inv = sum(accs.filter(isInvest), (a) => balance(a.id));
  const debt = sum(activeCards(), (c) => Math.max(0, cardUsed(c.id)));
  return { cash, inv, debt, net: r2(cash + inv - debt) };
}
/* Contas a pagar / a receber (inclui faturas de cartão em aberto) */
function dueList(type, until) {
  const kind = type === 'pagar' ? 'despesa' : 'receita';
  const items = S.tx
    .filter((t) => t.kind === kind && !t.paid && !t.cardId && (!until || t.date <= until))
    .map((t) => ({ type: 'tx', date: t.date, amount: t.amount, t }));
  if (type === 'pagar') {
    for (const c of activeCards()) {
      for (const inv of openInvoices(c)) {
        if (!until || inv.due <= until) items.push({ type: 'inv', date: inv.due, amount: inv.remaining, c, inv });
      }
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
function freeEndOfMonth() {
  const end = endOfMonth(ymOf(todayISO()));
  const cash = sum(activeAccounts().filter((a) => !isInvest(a)), (a) => balance(a.id));
  const pay = sum(dueList('pagar', end), (i) => i.amount);
  const rec = sum(dueList('receber', end), (i) => i.amount);
  return { cash, pay, rec, free: r2(cash - pay + rec) };
}
function overdueCount() {
  const t = todayISO();
  return dueList('pagar', addDays(t, -1)).length;
}
function fixedSummary() {
  const act = S.recurring.filter((r) => r.active);
  const fixo = sum(act.filter((r) => r.kind === 'despesa' && r.group !== 'assinatura'), (r) => r.amount);
  const ass = sum(act.filter((r) => r.kind === 'despesa' && r.group === 'assinatura'), (r) => r.amount);
  const renda = sum(act.filter((r) => r.kind === 'receita'), (r) => r.amount);
  let base = renda;
  if (!base) { const cur = ymOf(todayISO()); base = r2((flows(addYM(cur, -1)).inc + flows(addYM(cur, -2)).inc + flows(addYM(cur, -3)).inc) / 3); }
  return { fixo, ass, renda, total: r2(fixo + ass), base };
}
function srcName(t) {
  if (t.kind === 'transferencia') return `${acc(t.accountId)?.name || '?'} → ${acc(t.toAccountId)?.name || '?'}`;
  if (t.kind === 'fatura') return `${acc(t.accountId)?.name || '?'} → ${card(t.cardId)?.name || '?'}`;
  if (t.cardId) return card(t.cardId)?.name || 'Cartão';
  return acc(t.accountId)?.name || 'Conta';
}
function findDupes(amount, date, exclude) {
  return S.tx.filter((t) => t.kind === 'despesa' && t.id !== exclude && Math.abs(t.amount - amount) < 0.01 && Math.abs(dayDiff(t.date, date)) <= 3);
}

/* ---------- recorrentes (custos fixos, assinaturas, renda fixa) ---------- */
function txFromRecurring(r, m) {
  const date = dateIn(m, r.day);
  const t = { id: uid(), kind: r.kind, desc: r.desc, amount: r.amount, date, categoryId: r.categoryId, recurringId: r.id, paid: false };
  const c = r.cardId && card(r.cardId);
  if (c) { t.cardId = c.id; t.paid = true; t.invoice = invoiceKeyFor(c, date); }
  else t.accountId = r.accountId;
  return t;
}
function genRecurring() {
  const horizon = addYM(ymOf(todayISO()), 1);
  let changed = false;
  for (const r of S.recurring) {
    if (!r.active) continue;
    r.generated = r.generated || [];
    let m = r.start;
    for (let guard = 0; m <= horizon && guard < 240; guard++, m = addYM(m, 1)) {
      if (r.end && m > r.end) break;
      if (r.generated.includes(m)) continue;
      S.tx.push(txFromRecurring(r, m));
      r.generated.push(m);
      changed = true;
    }
  }
  if (changed) save();
}
/* Remove lançamentos futuros ainda não pagos de um recorrente (a partir de "from") */
function dropFuture(r, from) {
  const cur = ymOf(todayISO());
  const gone = [];
  S.tx = S.tx.filter((t) => {
    if (t.recurringId !== r.id || t.date < from) return true;
    const future = t.cardId ? t.invoice >= cur && t.date > todayISO() : !t.paid;
    if (future) { gone.push(ymOf(t.date)); return false; }
    return true;
  });
  r.generated = (r.generated || []).filter((m) => !gone.includes(m));
}

/* ---------- desenho ---------- */
let _gl;
function guilloche() {
  if (_gl) return _gl;
  let paths = '';
  for (let k = 0; k < 15; k++) {
    let d = '';
    for (let i = 0; i <= 90; i++) {
      const x = (i / 90) * 400;
      const y = 120 + k * 8 + Math.sin((i / 90) * Math.PI * 4 + k * 0.42) * 24 + Math.sin((i / 90) * Math.PI * 11 + k) * 4;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    paths += `<path d="${d}"/>`;
  }
  let ros = '';
  for (let k = 0; k < 20; k++) ros += `<ellipse cx="350" cy="36" rx="74" ry="20" transform="rotate(${(k * 9).toFixed(1)} 350 36)"/>`;
  _gl = `<svg class="guilloche" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" fill="none" stroke-width=".7" aria-hidden="true"><g stroke="rgba(255,255,255,.12)">${paths}</g><g stroke="rgba(242,181,68,.20)">${ros}</g></svg>`;
  return _gl;
}
function donut(segs, total, centerLabel) {
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = segs.map((s) => {
    const len = (s.v / total) * C;
    const el = `<circle cx="64" cy="64" r="${R}" fill="none" stroke="${s.color}" stroke-width="15" stroke-dasharray="${Math.max(len - 1.5, 0.01).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += len;
    return el;
  }).join('');
  return `<div class="donut"><svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="${R}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="15"/>${arcs}</svg><div class="center"><small>${centerLabel}</small><b>${money(total)}</b></div></div>`;
}
function notice(type, html, closeAct) {
  return `<div class="notice ${type}">${ic(type === 'info' ? 'info' : 'alert')}<div>${html}</div>${closeAct ? `<button class="x" data-act="${closeAct}" aria-label="Dispensar">×</button>` : ''}</div>`;
}
function dueTag(date) {
  const d = dayDiff(date, todayISO());
  if (d < 0) return `<span class="tag late">venceu ${dLabel(date)}</span>`;
  if (d === 0) return '<span class="tag soon">vence hoje</span>';
  if (d <= 5) return `<span class="tag soon">em ${d} dia${d > 1 ? 's' : ''}</span>`;
  return dLabel(date);
}
const accIcon = (a) => `<span class="ico" style="background:${hexA(a.color, 0.2)};border-color:${hexA(a.color, 0.35)}">${ACC_TYPES[a.type]?.icon || '🏦'}</span>`;
const cardIcon = (c) => `<span class="ico" style="background:${hexA(c.color, 0.25)};border-color:${hexA(c.color, 0.4)};color:#fff">${ic('card')}</span>`;

function txRow(t, opts = {}) {
  const c = cat(t.categoryId, t.kind);
  let icon = `<span class="ico">${c.icon}</span>`, title = t.desc || c.name, meta = [], val;
  const parc = t.installment ? ` · ${t.installment.i}/${t.installment.n}` : '';
  if (t.kind === 'despesa') {
    meta.push(c.name);
    meta.push(t.cardId ? `<span class="tag card">${esc(card(t.cardId)?.name || 'Cartão')}${parc}</span>` : esc(acc(t.accountId)?.name || '') + parc);
    val = `<span class="neg">− ${money(t.amount)}</span>`;
  } else if (t.kind === 'receita') {
    meta.push(t.cardId ? 'Estorno' : c.name);
    meta.push(t.cardId ? `<span class="tag card">${esc(card(t.cardId)?.name || '')}</span>` : esc(acc(t.accountId)?.name || '') + parc);
    val = `<span class="pos">+ ${money(t.amount)}</span>`;
  } else if (t.kind === 'transferencia') {
    icon = `<span class="ico">${ic('swap')}</span>`;
    title = t.desc || 'Transferência';
    meta.push(esc(srcName(t)));
    val = `<span class="muted">${money(t.amount)}</span>`;
  } else if (t.kind === 'fatura') {
    const cc = card(t.cardId);
    icon = cc ? cardIcon(cc) : `<span class="ico">${ic('card')}</span>`;
    meta.push(`Pagamento de fatura · ${esc(acc(t.accountId)?.name || '')}`);
    val = `<span class="muted">${money(t.amount)}</span>`;
  } else {
    icon = `<span class="ico">${ic('scale')}</span>`;
    meta.push(`Ajuste de saldo · ${esc(acc(t.accountId)?.name || '')}`);
    val = `<span class="${t.amount >= 0 ? 'pos' : ''}">${t.amount >= 0 ? '+' : '−'} ${money(Math.abs(t.amount))}</span>`;
  }
  const pending = (t.kind === 'despesa' || t.kind === 'receita') && !t.paid && !t.cardId;
  if (pending) meta.unshift(`<span class="tag ${t.date < todayISO() ? 'late' : 'soon'}">${t.kind === 'despesa' ? 'a pagar' : 'a receber'}</span>`);
  if (opts.showDate) meta.unshift(dLabel(t.date));
  return `<button class="row ${pending ? 'pending' : ''}" data-act="editTx" data-id="${t.id}">${icon}<span class="main"><b>${esc(title)}</b><small>${meta.filter(Boolean).join(' · ')}</small></span><span class="val">${val}</span></button>`;
}
function dueRow(i) {
  if (i.type === 'inv') {
    const st = INV_STATUS[i.inv.status];
    return `<div class="row">${cardIcon(i.c)}<button class="main" style="background:none;border:0;padding:0;text-align:left" data-act="goCard" data-id="${i.c.id}" data-k="${i.inv.key}"><b>Fatura ${esc(i.c.name)}</b><small>${dueTag(i.date)} · ${ymLabel(i.inv.key)} · <span class="tag ${st[1]}">${st[0]}</span></small></button><span class="val">${money(i.amount)}</span><button class="check" data-act="payInv" data-c="${i.c.id}" data-k="${i.inv.key}" aria-label="Pagar fatura">${ic('check')}</button></div>`;
  }
  const t = i.t, c = cat(t.categoryId, t.kind);
  return `<div class="row"><span class="ico">${c.icon}</span><button class="main" style="background:none;border:0;padding:0;text-align:left" data-act="editTx" data-id="${t.id}"><b>${esc(t.desc || c.name)}</b><small>${dueTag(t.date)} · ${esc(acc(t.accountId)?.name || '')}${t.installment ? ` · ${t.installment.i}/${t.installment.n}` : ''}${t.recurringId ? ' · fixo' : ''}</small></button><span class="val ${t.kind === 'receita' ? 'pos' : ''}">${money(t.amount)}</span><button class="check" data-act="pay" data-id="${t.id}" aria-label="${t.kind === 'receita' ? 'Marcar como recebido' : 'Marcar como pago'}">${ic('check')}</button></div>`;
}
function monthNav() {
  const cur = ymOf(todayISO());
  return `<div class="month glass"><button data-act="month" data-d="-1" aria-label="Mês anterior">${ic('chevL')}</button><span>${ymLabel(ui.month, true)}${ui.month !== cur ? '<span class="today-chip" role="button" tabindex="0" data-act="monthToday">voltar para hoje</span>' : ''}</span><button data-act="month" data-d="1" aria-label="Próximo mês">${ic('chevR')}</button></div>`;
}
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

/* =========================================================
   TELAS
   ========================================================= */
const TITLES = { inicio: 'Visão geral', extrato: 'Lançamentos', cartoes: 'Cartões', agenda: 'Agenda', mais: 'Ajustes' };
function header() {
  const d = new Date();
  const sub = {
    inicio: `${DOW[d.getDay()]}, ${d.getDate()} de ${MESF[d.getMonth()]}`,
    extrato: 'Tudo o que entrou e saiu',
    cartoes: 'Faturas, limites e vencimentos',
    agenda: 'A pagar, a receber e custos fixos',
    mais: 'Contas, categorias e backup'
  }[ui.tab];
  return `<h1><small>${sub}</small>${TITLES[ui.tab]}</h1>${window.Cloud && Cloud.user ? Cloud.syncButton() : ''}<button class="icon-btn" data-act="hide" aria-label="${S.settings.hide ? 'Mostrar valores' : 'Esconder valores'}">${ic(S.settings.hide ? 'eyeoff' : 'eye')}</button>`;
}
function tabbar() {
  const n = overdueCount();
  const tabs = [['inicio', 'home', 'Início'], ['extrato', 'list', 'Extrato'], ['cartoes', 'card', 'Cartões'], ['agenda', 'cal', 'Agenda'], ['mais', 'grid', 'Mais']];
  return tabs.map(([k, i, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" aria-current="${ui.tab === k ? 'page' : 'false'}">${ic(i)}${l}${k === 'agenda' && n ? `<span class="badge">${n}</span>` : ''}</button>`).join('');
}

/* ----- Início ----- */
function viewInicio() {
  const T = totals();
  const has = S.accounts.length || S.cards.length;
  const n = new Date();
  let h = '';
  if (S.settings.sample) h += notice('info', 'Você está vendo <b>dados de exemplo</b> para conhecer o app.<br><button class="link" data-act="clearSample">Apagar exemplo e começar do zero</button>');

  h += `<section class="hero glass">${guilloche()}
    <div class="eyebrow"><span>Patrimônio líquido</span><span class="serial">Nº ${pad(n.getDate())}.${pad(n.getMonth() + 1)}.${n.getFullYear()}</span></div>
    <div class="big">${bigMoney(T.net)}</div>
    <div class="hero-stats">
      <div title="${money(T.cash)}"><small><i class="dot" style="background:var(--garoupa)"></i>Em contas</small><b>${moneyShort(T.cash)}</b></div>
      <div title="${money(T.inv)}"><small><i class="dot" style="background:var(--mico)"></i>Investido</small><b>${moneyShort(T.inv)}</b></div>
      <div title="${money(T.debt)}"><small><i class="dot" style="background:var(--garca)"></i>Cartões</small><b>${moneyShort(-T.debt)}</b></div>
    </div></section>`;

  if (!has) {
    h += `<div class="card glass empty"><b>Comece pelo dinheiro que você já tem</b>Cadastre suas contas e investimentos com o saldo de hoje. Depois, seus cartões com o dia de fechamento e de vencimento.
      <div class="btn-row"><button class="btn primary" data-act="addAcc">${ic('wallet')} Adicionar conta</button><button class="btn" data-act="addCard">${ic('card')} Adicionar cartão</button></div>
      <button class="link" style="margin-top:14px" data-act="sample">Quero ver o app com dados de exemplo</button></div>`;
  }
  if (isIOS() && !isStandalone() && !S.settings.installDismissed) {
    h += notice('info', `<b>Instale no iPhone:</b> toque em Compartilhar ${ic('share')} e depois em “Adicionar à Tela de Início”.`, 'dismissInstall');
  }
  if (!ui.backupHidden && !(window.Cloud && Cloud.user) && S.tx.length >= 10 && !S.settings.sample && (!S.settings.lastBackup || dayDiff(todayISO(), S.settings.lastBackup) > 14)) {
    h += notice('warn', `Seus dados ficam só neste aparelho. ${S.settings.lastBackup ? `Último backup em ${dLabel(S.settings.lastBackup)}.` : 'Você ainda não fez backup.'}<br><button class="link" data-act="export">Fazer backup agora</button>`, 'hideBackup');
  }

  if (has) {
    const fr = freeEndOfMonth();
    h += `<div class="free glass"><div><small>Livre até o fim do mês</small><b class="${fr.free < 0 ? 'neg-bad' : ''}" style="${fr.free < 0 ? 'color:var(--arara)' : ''}">${money(fr.free)}</b></div><div class="why num">em contas ${money(fr.cash)}<br>− a pagar ${money(fr.pay)}<br>+ a receber ${money(fr.rec)}</div></div>`;

    // vencimentos próximos
    const soon = dueList('pagar', addDays(todayISO(), 10));
    h += `<div class="section-title"><h2>Vence em breve</h2><button class="link" data-act="tab" data-tab="agenda">Agenda</button></div>`;
    h += soon.length
      ? `<div class="glass list">${soon.slice(0, 5).map(dueRow).join('')}</div>`
      : `<div class="glass card empty" style="padding:18px">Nada vencendo nos próximos 10 dias.</div>`;

    // mês
    const F = flows(ui.month);
    const tot = Math.max(F.inc, 0) + Math.max(F.out, 0) || 1;
    h += `<div class="section-title"><h2>Resumo do mês</h2></div>${monthNav()}`;
    h += `<div class="card glass"><div class="flow">
        <div class="k"><small>Entrou</small><b class="pos">${money(F.inc)}</b>${F.incP ? `<em>${money(F.incP)} ainda a receber</em>` : ''}</div>
        <div class="k"><small>Saiu</small><b>${money(F.out)}</b>${F.outP ? `<em>${money(F.outP)} ainda a pagar</em>` : ''}</div>
      </div>
      <div class="bar"><i style="width:${(Math.max(F.inc, 0) / tot) * 100}%;background:var(--in)"></i><i style="width:${(Math.max(F.out, 0) / tot) * 100}%;background:var(--out)"></i></div>
      <div class="result-line"><span>${F.res >= 0 ? 'Sobra do mês' : 'Faltou no mês'}</span><b style="color:${F.res >= 0 ? 'var(--in)' : 'var(--arara)'}">${money(Math.abs(F.res))}</b></div>
      ${S.settings.cardMode === 'fatura' ? '<div class="faint" style="font-size:11.5px;margin-top:8px">Compras no cartão contam no mês em que a fatura vence.</div>' : ''}
    </div>`;

    // categorias
    const cats = byCategory(ui.month);
    if (cats.length) {
      const total = sum(cats, (x) => x.v);
      const top = cats.slice(0, 5).map((x) => ({ v: x.v, color: x.c.color, label: `${x.c.icon} ${x.c.name}` }));
      const rest = r2(total - sum(top, (x) => x.v));
      if (rest > 0) top.push({ v: rest, color: '#5B647E', label: 'Outras' });
      h += `<div class="card glass"><h3>Gastos por categoria</h3><div class="donut-wrap">${donut(top, total, 'gastos')}<div class="legend">${top.map((s) => `<div><i class="dot" style="background:${s.color}"></i><span>${esc(s.label)}</span><b>${Math.round((s.v / total) * 100)}%</b></div>`).join('')}</div></div></div>`;
    }

    // contas
    const accs = activeAccounts();
    if (accs.length) {
      const reg = accs.filter((a) => !isInvest(a)), inv = accs.filter(isInvest);
      const row = (a) => `<button class="row" data-act="accDetail" data-id="${a.id}">${accIcon(a)}<span class="main"><b>${esc(a.name)}</b><small>${ACC_TYPES[a.type]?.label || ''}</small></span><span class="val ${balance(a.id) < 0 ? '' : ''}" style="${balance(a.id) < 0 ? 'color:var(--arara)' : ''}">${money(balance(a.id))}</span></button>`;
      h += `<div class="section-title"><h2>Onde está o dinheiro</h2><button class="link" data-act="addAcc">Nova conta</button></div>`;
      if (reg.length) h += `<div class="glass list">${reg.map(row).join('')}</div>`;
      if (inv.length) h += `<div class="glass list"><div class="day-head" style="margin:10px 14px 2px"><span>Investimentos</span><span class="num">${money(sum(inv, (a) => balance(a.id)))}</span></div>${inv.map(row).join('')}</div>`;
    }

    // cartões
    const cards = activeCards();
    if (cards.length) {
      h += `<div class="section-title"><h2>Cartões</h2><button class="link" data-act="tab" data-tab="cartoes">Ver faturas</button></div><div class="glass list">`;
      for (const c of cards) {
        const inv = invoice(c.id, currentKey(c));
        const used = Math.max(0, cardUsed(c.id));
        const pct = c.limit ? Math.min(100, (used / c.limit) * 100) : 0;
        h += `<button class="row" data-act="goCard" data-id="${c.id}">${cardIcon(c)}<span class="main"><b>${esc(c.name)}</b><small>Fatura ${ymLabel(inv.key)} · vence ${dLabel(inv.due)}</small>${c.limit ? `<span class="bar" style="height:4px;margin-top:6px"><i style="width:${pct}%;background:${c.color}"></i></span>` : ''}</span><span class="val">${money(inv.total)}<small>${c.limit ? `livre ${money(c.limit - used)}` : ''}</small></span></button>`;
      }
      h += '</div>';
    }

    // fixos
    const fx = fixedSummary();
    if (S.recurring.length) {
      h += `<div class="section-title"><h2>Custo fixo mensal</h2><button class="link" data-act="goFixos">Ver todos</button></div>
      <div class="card glass"><div class="fixed-grid">
        <div><small>Fixos</small><b>${money(fx.fixo)}</b></div>
        <div><small>Assinaturas</small><b>${money(fx.ass)}</b></div>
      </div>
      <div class="result-line"><span>Total por mês</span><b>${money(fx.total)}</b></div>
      ${fx.base > 0 ? `<div class="bar"><i style="width:${Math.min(100, (fx.total / fx.base) * 100)}%;background:linear-gradient(90deg,var(--mico),var(--arara))"></i></div><div class="faint" style="font-size:12px;margin-top:6px">${Math.round((fx.total / fx.base) * 100)}% da sua renda ${fx.renda ? 'fixa' : 'média'} vai para custos fixos.</div>` : ''}
      </div>`;
    }

    // 6 meses
    const months = [...Array(6)].map((_, i) => addYM(ui.month, i - 5));
    const fl = months.map(flows);
    const max = Math.max(1, ...fl.map((f) => Math.max(f.inc, f.out)));
    h += `<div class="section-title"><h2>Últimos 6 meses</h2></div><div class="card glass"><div class="bars">${months.map((m, i) => `<div class="col ${m === ui.month ? 'cur' : ''}"><div class="pair"><i style="height:${(Math.max(0, fl[i].inc) / max) * 100}%;background:var(--in)"></i><i style="height:${(Math.max(0, fl[i].out) / max) * 100}%;background:var(--out)"></i></div><small>${MES[+m.slice(5) - 1]}</small></div>`).join('')}</div><div class="key"><span><i class="dot" style="background:var(--in)"></i>Entradas</span><span><i class="dot" style="background:var(--out)"></i>Saídas</span></div></div>`;
  }
  return `<div class="stack">${h}</div>`;
}

/* ----- Extrato ----- */
const FILTERS = [['todos', 'Tudo'], ['despesa', 'Saídas'], ['receita', 'Entradas'], ['cartao', 'Cartão'], ['pendente', 'Pendentes'], ['mov', 'Transferências']];
function extratoList() {
  const q = ui.q.trim().toLowerCase();
  let list = monthTx(ui.month).filter((t) => {
    switch (ui.filter) {
      case 'despesa': return t.kind === 'despesa';
      case 'receita': return t.kind === 'receita';
      case 'cartao': return t.cardId && t.kind !== 'fatura';
      case 'pendente': return (t.kind === 'despesa' || t.kind === 'receita') && !t.paid && !t.cardId;
      case 'mov': return t.kind === 'transferencia' || t.kind === 'fatura' || t.kind === 'ajuste';
      default: return true;
    }
  });
  if (q) list = list.filter((t) => [t.desc, t.note, cat(t.categoryId, t.kind).name, srcName(t), moneyInput(t.amount)].join(' ').toLowerCase().includes(q));
  list.sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) {
    return `<div class="glass card empty"><b>${q || ui.filter !== 'todos' ? 'Nada encontrado' : 'Nenhum lançamento neste mês'}</b>${q || ui.filter !== 'todos' ? 'Tente outro filtro ou busca.' : 'Toque no + para registrar um gasto ou uma entrada.'}</div>`;
  }
  let h = '', day = null;
  for (const t of list) {
    if (t.date !== day) {
      if (day) h += '</div>';
      day = t.date;
      const dl = dayLabel(day);
      h += `<div class="day-head"><span>${dl[0].toUpperCase() + dl.slice(1)}</span></div><div class="glass list">`;
    }
    h += txRow(t);
  }
  return h + '</div>';
}
function viewExtrato() {
  const F = flows(ui.month);
  return `<div class="stack">${monthNav()}
    <div class="glass summary3"><div><small>Entrou</small><b class="pos">${money(F.inc)}</b></div><div><small>Saiu</small><b>${money(F.out)}</b></div><div><small>Resultado</small><b style="color:${F.res >= 0 ? 'var(--in)' : 'var(--arara)'}">${money(F.res)}</b></div></div>
    <label class="search glass">${ic('search')}<input id="q" type="search" placeholder="Buscar por nome, categoria, valor…" value="${esc(ui.q)}" enterkeyhint="search"></label>
    <div class="chips">${FILTERS.map(([k, l]) => `<button class="chip-btn ${ui.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div>
    <div id="xlist">${extratoList()}</div></div>`;
}

/* ----- Cartões ----- */
function viewCartoes() {
  const cards = activeCards();
  if (!cards.length) {
    return `<div class="stack"><div class="glass card empty"><b>Nenhum cartão ainda</b>Cadastre seu cartão com o dia de fechamento e de vencimento. As compras vão para a fatura certa e não saem da sua conta até você pagar a fatura.<br><button class="btn primary" data-act="addCard">${ic('plus')} Adicionar cartão</button></div></div>`;
  }
  if (!ui.cardId || !cards.some((c) => c.id === ui.cardId)) ui.cardId = cards[0].id;
  const c = card(ui.cardId);
  const cur = currentKey(c);
  const key = ui.inv[c.id] || cur;
  const inv = invoice(c.id, key);
  const st = INV_STATUS[inv.status];
  const used = Math.max(0, cardUsed(c.id));
  const pct = c.limit ? Math.min(100, (used / c.limit) * 100) : 0;

  let h = `<div class="cc-scroller" id="ccs">${cards.map((k) => {
    const ki = invoice(k.id, currentKey(k));
    return `<button class="cc ${k.id === c.id ? 'on' : ''}" data-act="selCard" data-id="${k.id}" style="background:linear-gradient(135deg, ${hexA(k.color, 0.9)}, ${hexA(k.color, 0.35)} 70%, rgba(255,255,255,.08))"><div class="cc-top"><span class="cc-name">${esc(k.name)}</span><span class="chip"></span></div><div class="cc-bottom"><div><small>Fatura atual</small><b>${money(ki.total)}</b></div><div style="text-align:right"><small>vence</small><b style="font-size:15px">${dLabel(ki.due)}</b></div></div></button>`;
  }).join('')}<button class="cc cc-add" data-act="addCard">${ic('plus')}<span style="font-size:13px;font-weight:600">Novo cartão</span></button></div>`;

  h += `<div class="card glass">
    <div class="inv-nav"><button data-act="invNav" data-d="-1" aria-label="Fatura anterior">${ic('chevL')}</button><div class="t"><b>Fatura de ${ymLabel(key, true)}</b><span class="tag ${st[1]}">${st[0]}</span>${key === cur ? ' <span class="tag">atual</span>' : ''}</div><button data-act="invNav" data-d="1" aria-label="Próxima fatura">${ic('chevR')}</button></div>
    <div class="big inv-total">${bigMoney(inv.total)}</div>
    <div class="inv-meta"><span>Fecha <b>${dLabel(inv.close)}</b></span><span>Vence <b>${dLabel(inv.due)}</b></span>${inv.paid ? `<span>Pago <b>${money(inv.paid)}</b></span>` : ''}${inv.paid && inv.remaining ? `<span>Falta <b>${money(inv.remaining)}</b></span>` : ''}</div>
    <div class="btn-row">${inv.remaining > 0 ? `<button class="btn primary" data-act="payInv" data-c="${c.id}" data-k="${key}">${ic('check')} Pagar fatura</button>` : ''}<button class="btn" data-act="newTx" data-source="cartao" data-card="${c.id}">${ic('plus')} Nova compra</button></div>
  </div>`;

  if (c.limit) {
    h += `<div class="card glass limit"><small><span>Limite usado</span><span class="num">${money(used)} de ${money(c.limit)}</span></small><div class="bar"><i style="width:${pct}%;background:linear-gradient(90deg, ${c.color}, var(--arara))"></i></div><small style="margin-top:8px"><span>Disponível</span><b class="num" style="color:var(--text)">${money(c.limit - used)}</b></small><small style="margin-top:4px"><span>Melhor dia de compra</span><span>dia ${c.closingDay}</span></small></div>`;
  }

  const keys = [...Array(6)].map((_, i) => addYM(cur, i - 1));
  const tots = keys.map((k) => invoice(c.id, k).total);
  const mx = Math.max(1, ...tots);
  h += `<div class="section-title"><h2>Próximas faturas</h2><span class="faint" style="font-size:12px">inclui parcelas</span></div><div class="card glass"><div class="mini-bars">${keys.map((k, i) => `<button class="${k === key ? 'sel' : ''}" data-act="invGo" data-k="${k}"><em>${S.settings.hide ? '' : tots[i] ? Math.round(tots[i]).toLocaleString('pt-BR') : ''}</em><i style="height:${Math.max(3, (tots[i] / mx) * 60)}px"></i><small>${MES[+k.slice(5) - 1]}</small></button>`).join('')}</div></div>`;

  const items = [...inv.items, ...inv.payments].sort((a, b) => b.date.localeCompare(a.date));
  h += `<div class="section-title"><h2>Nesta fatura</h2><button class="link" data-act="editCard" data-id="${c.id}">Editar cartão</button></div>`;
  h += items.length ? `<div class="glass list">${items.map((t) => txRow(t, { showDate: true })).join('')}</div>` : '<div class="glass card empty" style="padding:18px">Nenhuma compra nesta fatura.</div>';
  return `<div class="stack">${h}</div>`;
}

/* ----- Agenda ----- */
function viewAgenda() {
  const tabs = [['pagar', 'A pagar'], ['receber', 'A receber'], ['fixos', 'Fixos e assinaturas']];
  let h = `<div class="chips">${tabs.map(([k, l]) => `<button class="chip-btn ${ui.agenda === k ? 'on' : ''}" data-act="agendaTab" data-k="${k}">${l}</button>`).join('')}</div>`;
  if (ui.agenda === 'fixos') return `<div class="stack">${h}${fixosBody()}</div>`;

  const today = todayISO();
  const until = ui.agendaAll ? null : endOfMonth(addYM(ymOf(today), 1));
  const items = dueList(ui.agenda, until);
  const groups = [
    ['Atrasados', (i) => i.date < today],
    ['Próximos 7 dias', (i) => i.date >= today && i.date <= addDays(today, 7)],
    ['Ainda este mês', (i) => i.date > addDays(today, 7) && i.date <= endOfMonth(ymOf(today))],
    ['Mês que vem', (i) => i.date > endOfMonth(ymOf(today)) && i.date <= endOfMonth(addYM(ymOf(today), 1))],
    ['Depois', (i) => i.date > endOfMonth(addYM(ymOf(today), 1))]
  ];
  const total = sum(items, (i) => i.amount);
  const late = sum(items.filter((i) => i.date < today), (i) => i.amount);
  h += `<div class="glass summary3"><div><small>Total</small><b>${money(total)}</b></div><div><small>Atrasado</small><b style="${late ? 'color:var(--arara)' : ''}">${money(late)}</b></div><div><small>Itens</small><b>${items.length}</b></div></div>`;
  if (!items.length) {
    h += `<div class="glass card empty"><b>${ui.agenda === 'pagar' ? 'Nenhuma conta a pagar' : 'Nada a receber'}</b>${ui.agenda === 'pagar' ? 'Lance uma despesa com “Já foi pago” desligado para ela aparecer aqui.' : 'Lance uma receita com “Já recebi” desligado (ex.: comissão que vai cair).'}<br><button class="btn primary" data-act="newTx" data-kind="${ui.agenda === 'pagar' ? 'despesa' : 'receita'}" data-pending="1">${ic('plus')} ${ui.agenda === 'pagar' ? 'Nova conta a pagar' : 'Novo valor a receber'}</button></div>`;
  }
  for (const [label, fn] of groups) {
    const g = items.filter(fn);
    if (!g.length) continue;
    h += `<div class="day-head"><span>${label}</span><span class="num">${money(sum(g, (i) => i.amount))}</span></div><div class="glass list">${g.map(dueRow).join('')}</div>`;
  }
  h += `<div style="text-align:center;margin-top:16px">${items.length || ui.agendaAll ? `<button class="link" data-act="agendaAll">${ui.agendaAll ? 'Mostrar só até o mês que vem' : 'Mostrar também os meses seguintes'}</button>` : ''}</div>`;
  if (items.length) h += `<button class="btn block" style="margin-top:12px" data-act="newTx" data-kind="${ui.agenda === 'pagar' ? 'despesa' : 'receita'}" data-pending="1">${ic('plus')} ${ui.agenda === 'pagar' ? 'Nova conta a pagar' : 'Novo valor a receber'}</button>`;
  return `<div class="stack">${h}</div>`;
}
function fixosBody() {
  const fx = fixedSummary();
  let h = `<div class="card glass"><div class="fixed-grid">
    <div><small>Custos fixos</small><b>${money(fx.fixo)}</b><em>por mês</em></div>
    <div><small>Assinaturas</small><b>${money(fx.ass)}</b><em>${money(fx.ass * 12)} por ano</em></div>
  </div>
  <div class="result-line"><span>Total comprometido por mês</span><b>${money(fx.total)}</b></div>
  ${fx.renda ? `<div class="result-line"><span>Renda fixa por mês</span><b class="pos">${money(fx.renda)}</b></div>` : ''}
  ${fx.base > 0 ? `<div class="faint" style="font-size:12px;margin-top:8px">${Math.round((fx.total / fx.base) * 100)}% da renda ${fx.renda ? 'fixa' : 'média dos últimos 3 meses'}.</div>` : ''}
  </div>`;
  const groups = [['fixo', 'Custos fixos', (r) => r.kind === 'despesa' && r.group !== 'assinatura'], ['assinatura', 'Assinaturas', (r) => r.kind === 'despesa' && r.group === 'assinatura'], ['renda', 'Entradas fixas', (r) => r.kind === 'receita']];
  for (const [k, label, fn] of groups) {
    const list = S.recurring.filter(fn).sort((a, b) => (b.active - a.active) || a.day - b.day);
    if (!list.length) continue;
    h += `<div class="day-head"><span>${label}</span><span class="num">${money(sum(list.filter((r) => r.active), (r) => r.amount))}</span></div><div class="glass list">${list.map((r) => {
      const c = cat(r.categoryId, r.kind);
      const where = r.cardId ? `<span class="tag card">${esc(card(r.cardId)?.name || 'Cartão')}</span>` : esc(acc(r.accountId)?.name || '');
      return `<button class="row" data-act="editRec" data-id="${r.id}" style="${r.active ? '' : 'opacity:.45'}"><span class="ico">${c.icon}</span><span class="main"><b>${esc(r.desc)}</b><small>dia ${r.day} · ${where}${r.active ? '' : ' · pausado'}</small></span><span class="val ${r.kind === 'receita' ? 'pos' : ''}">${money(r.amount)}</span></button>`;
    }).join('')}</div>`;
  }
  if (!S.recurring.length) h += '<div class="glass card empty"><b>Nenhum custo fixo ainda</b>Cadastre aluguel, internet, academia, streaming… O app lança sozinho todo mês e avisa o vencimento.</div>';
  h += `<button class="btn primary block" style="margin-top:14px" data-act="addRec">${ic('plus')} Novo fixo ou assinatura</button>`;
  return h;
}

/* ----- Mais ----- */
function viewMais() {
  const row = (act, icon, title, sub, extra = '') => `<button class="row" data-act="${act}" ${extra}><span class="ico">${icon}</span><span class="main"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="chev">${ic('chevR')}</span></button>`;
  let h = window.Cloud && Cloud.user ? Cloud.maisSection() : '';
  h += `<div class="section-title" ${h ? '' : 'style="margin-top:6px"'}><h2>Contas e investimentos</h2></div><div class="glass list menu">`;
  for (const a of S.accounts) {
    h += `<button class="row" data-act="accDetail" data-id="${a.id}" style="${a.archived ? 'opacity:.45' : ''}">${accIcon(a)}<span class="main"><b>${esc(a.name)}</b><small>${ACC_TYPES[a.type]?.label || ''}${a.archived ? ' · arquivada' : ''}</small></span><span class="val">${money(balance(a.id))}</span></button>`;
  }
  h += row('addAcc', ic('plus'), 'Adicionar conta ou investimento', 'Banco, carteira, VR, Tesouro, CDB…') + '</div>';

  h += '<div class="section-title"><h2>Cartões de crédito</h2></div><div class="glass list menu">';
  for (const c of S.cards) h += `<button class="row" data-act="editCard" data-id="${c.id}" style="${c.archived ? 'opacity:.45' : ''}">${cardIcon(c)}<span class="main"><b>${esc(c.name)}</b><small>fecha dia ${c.closingDay} · vence dia ${c.dueDay}${c.archived ? ' · arquivado' : ''}</small></span><span class="chev">${ic('chevR')}</span></button>`;
  h += row('addCard', ic('plus'), 'Adicionar cartão', 'Com fechamento e vencimento') + '</div>';

  h += '<div class="section-title"><h2>Organização</h2></div><div class="glass list menu">';
  h += row('cats', ic('tag'), 'Categorias', `${S.categories.length} categorias`);
  h += row('goFixos', ic('repeat'), 'Custos fixos e assinaturas', `${S.recurring.filter((r) => r.active).length} ativos`);
  h += row('cardMode', ic('sliders'), 'Compras no cartão contam no mês…', S.settings.cardMode === 'fatura' ? 'da fatura (quando você paga)' : 'da compra');
  h += `<label class="row" style="cursor:pointer"><span class="ico">${ic(S.settings.hide ? 'eyeoff' : 'eye')}</span><span class="main"><b>Esconder valores</b><small>Para abrir o app perto de outras pessoas</small></span><span class="switch" style="border:0;background:none;padding:0;margin:0"><input type="checkbox" data-toggle="hide" ${S.settings.hide ? 'checked' : ''} aria-label="Esconder valores"></span></label>`;
  h += '</div>';

  h += '<div class="section-title"><h2>Backup</h2></div><div class="glass list menu">';
  h += row('export', ic('download'), 'Fazer backup', S.settings.lastBackup ? `Último em ${dLabel(S.settings.lastBackup)} de ${S.settings.lastBackup.slice(0, 4)}` : 'Salva um arquivo com todos os dados');
  h += row('import', ic('upload'), 'Restaurar backup', 'Substitui os dados deste aparelho');
  h += row('csv', ic('file'), 'Exportar planilha', 'Arquivo CSV para Excel ou Google Planilhas');
  h += '</div>';

  h += '<div class="section-title"><h2>App</h2></div><div class="glass list menu">';
  h += row('install', ic('phone'), 'Instalar no iPhone', isStandalone() ? 'Já instalado neste aparelho' : 'Vira um ícone na tela de início');
  if (!S.accounts.length && !S.tx.length) h += row('sample', ic('trend'), 'Ver com dados de exemplo', 'Para conhecer o app');
  h += `<button class="row" data-act="wipe"><span class="ico" style="color:var(--arara)">${ic('trash')}</span><span class="main"><b style="color:#FF9C8C">Apagar todos os dados</b><small>Não dá para desfazer sem backup</small></span></button>`;
  h += '</div>';
  h += '<p class="about">Bolso · dados salvos na sua conta (Supabase)<br>e guardados no aparelho para funcionar sem internet</p>';
  return `<div class="stack">${h}</div>`;
}

const VIEWS = { inicio: viewInicio, extrato: viewExtrato, cartoes: viewCartoes, agenda: viewAgenda, mais: viewMais };
function render() {
  $('#top').innerHTML = header();
  $('#view').innerHTML = VIEWS[ui.tab]();
  $('#tabbar').innerHTML = tabbar();
  if (ui.tab === 'cartoes') {
    const on = $('#ccs .cc.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}

/* =========================================================
   FOLHAS (bottom sheets) E DIÁLOGOS
   ========================================================= */
function openSheet(html, { dialog = false, onClose } = {}) {
  const w = document.createElement('div');
  w.className = 'sheet-wrap';
  w.innerHTML = `<div class="sheet-bg" data-close></div><div class="sheet ${dialog ? 'dialog' : ''}" role="dialog" aria-modal="true">${dialog ? '' : '<div class="grab"></div>'}${html}</div>`;
  w._onClose = onClose;
  $('#sheets').appendChild(w);
  document.body.style.overflow = 'hidden';
  return w;
}
function closeSheet(w) {
  w = w || $('#sheets').lastElementChild;
  if (!w) return;
  w.remove();
  const cb = w._onClose; w._onClose = null;
  if (cb) cb();
  if (!$('#sheets').children.length) document.body.style.overflow = '';
}
function closeAllSheets() { while ($('#sheets').lastElementChild) closeSheet(); }
const sheetHead = (t) => `<div class="sheet-head"><h2>${t}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">${ic('x')}</button></div>`;
function choose(title, msg, buttons) {
  return new Promise((res) => {
    const w = openSheet(`<div class="sheet-head"><h2>${title}</h2></div><p>${msg}</p><div class="btns">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-choice="${i}">${b.label}</button>`).join('')}<button class="btn" data-close>Cancelar</button></div>`, { dialog: true, onClose: () => res(null) });
    w.addEventListener('click', (e) => {
      const b = e.target.closest('[data-choice]');
      if (!b) return;
      w._onClose = null;
      closeSheet(w);
      res(buttons[+b.dataset.choice].value);
    });
  });
}
const confirmDlg = (title, msg, label = 'Confirmar', cls = 'primary') => choose(title, msg, [{ label, value: true, cls }]).then((v) => !!v);

let toastTimer;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Desfazer</button>' : ''}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 5000 : 2600);
  if (undo) el.querySelector('button').onclick = () => { undo(); el.classList.remove('show'); };
}
function withUndo(msg, fn) {
  const snap = JSON.stringify(S);
  fn();
  save(); closeAllSheets(); render();
  toast(msg, () => { S = normalize(JSON.parse(snap)); save(); render(); toast('Desfeito'); });
}
function commit(msg) { save(); closeAllSheets(); render(); if (msg) toast(msg); }

const accOptions = (sel, filter = () => true) => S.accounts.filter((a) => (!a.archived || a.id === sel) && filter(a)).map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)}${isInvest(a) ? ' (invest.)' : ''}</option>`).join('');
const cardOptions = (sel) => S.cards.filter((c) => !c.archived || c.id === sel).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
const catGrid = (kind, sel, name = `cat_${kind}`) => `<div class="cats" data-kind="${kind}">${S.categories.filter((c) => c.kind === kind).map((c) => `<label><input type="radio" name="${name}" value="${c.id}" ${c.id === sel ? 'checked' : ''}><span><i>${c.icon}</i>${esc(c.name)}</span></label>`).join('')}</div>`;
const swatches = (sel) => `<div class="swatches">${COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === sel ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div>`;
const dayOptions = (sel) => [...Array(31)].map((_, i) => `<option value="${i + 1}" ${i + 1 === +sel ? 'selected' : ''}>${i + 1}</option>`).join('');
const defaultAccId = () => (activeAccounts().find((a) => !isInvest(a)) || activeAccounts()[0])?.id || '';

/* ----- Lançamento ----- */
function txSheet(t, p = {}) {
  if (!S.accounts.length && !S.cards.length) {
    choose('Cadastre uma conta primeiro', 'Para lançar gastos e entradas, o app precisa saber de onde o dinheiro sai: uma conta, a carteira ou um cartão.', [{ label: 'Adicionar conta', value: 'acc', cls: 'primary' }, { label: 'Adicionar cartão', value: 'card' }]).then((v) => { if (v === 'acc') accSheet(); if (v === 'card') cardSheet(); });
    return;
  }
  if (t && t.kind === 'ajuste') {
    choose('Ajuste de saldo', `${esc(acc(t.accountId)?.name || '')}: ${t.amount >= 0 ? '+' : '−'} ${brl(Math.abs(t.amount))} em ${dLabel(t.date)}. Excluir este ajuste muda o saldo da conta.`, [{ label: 'Excluir ajuste', value: true, cls: 'danger' }]).then((v) => {
      if (v) withUndo('Ajuste excluído', () => { S.tx = S.tx.filter((x) => x.id !== t.id); });
    });
    return;
  }
  const edit = !!t;
  const d = edit ? { ...t } : {
    kind: p.kind || 'despesa',
    date: todayISO(),
    paid: !p.pending,
    accountId: p.accountId || (p.cardId && card(p.cardId)?.accountId) || defaultAccId(),
    cardId: p.cardId || activeCards()[0]?.id || '',
    toAccountId: p.toAccountId || '',
    invoice: p.invoice || ''
  };
  const source = edit ? (t.cardId && t.kind !== 'fatura' ? 'cartao' : 'conta') : (p.source === 'cartao' && activeCards().length ? 'cartao' : (!activeAccounts().length && activeCards().length ? 'cartao' : 'conta'));
  const kinds = [['despesa', 'Despesa'], ['receita', 'Receita'], ['transferencia', 'Transferir'], ['fatura', 'Pagar fatura']];
  const html = `<form data-form="tx" data-id="${edit ? t.id : ''}" data-inv="${esc(d.invoice || '')}" autocomplete="off" novalidate>
    ${sheetHead(edit ? 'Editar lançamento' : 'Novo lançamento')}
    <div class="seg kind">${kinds.map(([v, l]) => `<label><input type="radio" name="kind" value="${v}" ${d.kind === v ? 'checked' : ''} ${edit && d.kind !== v ? 'disabled' : ''}><span>${l}</span></label>`).join('')}</div>
    <div class="amount-field"><input name="amount" inputmode="decimal" placeholder="0,00" value="${edit ? moneyInput(t.amount) : ''}" aria-label="Valor em reais"><small class="amt-help">valor em reais</small></div>
    <div class="g g-source"><div class="seg"><label><input type="radio" name="source" value="conta" ${source === 'conta' ? 'checked' : ''}><span>Conta · Pix · débito</span></label><label><input type="radio" name="source" value="cartao" ${source === 'cartao' ? 'checked' : ''}><span>Cartão de crédito</span></label></div></div>
    <label class="field"><span>Descrição</span><input name="desc" value="${esc(d.desc || '')}" placeholder="Ex.: Mercado, aluguel, comissão…" maxlength="80" enterkeyhint="done"></label>
    <div class="g g-cat">${catGrid('despesa', d.categoryId)}${catGrid('receita', d.categoryId)}</div>
    <div class="grid2">
      <label class="field g g-acc"><span class="acc-label">Conta</span><select name="accountId">${accOptions(d.accountId)}</select></label>
      <label class="field g g-card"><span>Cartão</span><select name="cardId">${cardOptions(d.cardId)}</select></label>
      <label class="field g g-to"><span>Para a conta</span><select name="toAccountId"><option value="">Escolha…</option>${accOptions(d.toAccountId)}</select></label>
      <label class="field g g-fat"><span>Fatura</span><select name="invoice"></select></label>
      <label class="field"><span class="date-label">Data</span><input type="date" name="date" value="${d.date}"></label>
    </div>
    <label class="switch g g-paid"><span class="paid-label">Já foi pago<small class="paid-help"></small></span><input type="checkbox" name="paid" ${d.paid ? 'checked' : ''}></label>
    ${!edit ? `
      <div class="grid2 g g-parc">
        <label class="field"><span>Parcelas</span><select name="parcelas">${[...Array(48)].map((_, i) => `<option value="${i + 1}">${i === 0 ? 'À vista' : `${i + 1}x`}</option>`).join('')}</select></label>
        <label class="field g g-parcmode"><span>O valor digitado é</span><select name="parcMode"><option value="total">O total</option><option value="parcela">De cada parcela</option></select></label>
      </div>
      <label class="switch g g-rep"><span>Repetir todo mês<small class="rep-help">Vira um custo fixo e entra sozinho nos próximos meses</small></span><input type="checkbox" name="repeat"></label>
      <div class="seg g g-repgroup"><label><input type="radio" name="group" value="fixo" checked><span>Custo fixo</span></label><label><input type="radio" name="group" value="assinatura"><span>Assinatura</span></label></div>`
    : (t.installment ? notice('info', `Parcela <b>${t.installment.i} de ${t.installment.n}</b>. A mudança vale só para esta parcela.`) : '') + (t.recurringId ? notice('info', 'Lançado automaticamente por um fixo. A mudança vale só para este mês.') : '')}
    <div class="hint-box"></div>
    <details class="more" ${d.note ? 'open' : ''}><summary>Observação</summary><label class="field"><textarea name="note" rows="2" placeholder="Opcional">${esc(d.note || '')}</textarea></label></details>
    <div class="form-foot"><button class="btn primary block" type="submit">${edit ? 'Salvar alterações' : 'Salvar lançamento'}</button>${edit ? `<button type="button" class="btn danger block" data-act="delTx" data-id="${t.id}">${ic('trash')} Excluir</button>` : ''}</div>
  </form>`;
  const w = openSheet(html);
  const f = $('form', w);
  syncTx(f);
  if (!edit) setTimeout(() => f.amount.focus(), 280);
}

function syncTx(f, changed) {
  const kind = f.kind.value;
  const edit = !!f.dataset.id;
  const isDR = kind === 'despesa' || kind === 'receita';
  const hasCards = activeCards().length > 0 || (edit && f.cardId.value);
  if (isDR && !hasCards && f.source) { const r = f.querySelector('input[name=source][value=conta]'); if (r) r.checked = true; }
  const src = isDR ? f.source.value || 'conta' : kind === 'fatura' ? 'cartao' : 'conta';
  const vis = (sel, on) => f.querySelectorAll(sel).forEach((el) => { el.hidden = !on; });
  vis('.g-source', isDR && hasCards);
  vis('.g-cat', isDR);
  f.querySelectorAll('.cats').forEach((c) => { c.hidden = c.dataset.kind !== kind; });
  vis('.g-acc', (isDR && src === 'conta') || kind === 'transferencia' || kind === 'fatura');
  vis('.g-card', (isDR && src === 'cartao') || kind === 'fatura');
  vis('.g-to', kind === 'transferencia');
  vis('.g-fat', kind === 'fatura' || (edit && isDR && src === 'cartao'));
  vis('.g-paid', isDR && src === 'conta');
  const parc = f.parcelas ? +f.parcelas.value : 1;
  vis('.g-parc', isDR);
  vis('.g-parcmode', isDR && parc > 1);
  vis('.g-rep', isDR && parc === 1);
  vis('.g-repgroup', kind === 'despesa' && parc === 1 && !!f.repeat?.checked);

  $('.acc-label', f).textContent = { transferencia: 'Sai da conta', fatura: 'Pagar com a conta', receita: 'Entra na conta' }[kind] || 'Sai da conta';
  $('.paid-label', f).firstChild.textContent = kind === 'receita' ? 'Já recebi' : 'Já foi pago';
  $('.paid-help', f).textContent = kind === 'receita' ? 'Desligue para lançar como valor a receber' : 'Desligue para lançar como conta a pagar';
  $('.date-label', f).textContent = isDR && src === 'conta' && !f.paid.checked ? 'Vencimento' : isDR && src === 'cartao' ? 'Data da compra' : 'Data';
  if (f.repeat) $('.rep-help', f).textContent = kind === 'receita' ? 'Para salário ou renda que cai todo mês' : 'Vira um custo fixo e entra sozinho nos próximos meses';
  if (f.parcelas) $('.g-parc .field span', f).textContent = kind === 'receita' ? 'Repetir em' : 'Parcelas';

  if (!$('.g-fat', f).hidden) buildInvoiceOptions(f, kind, changed);
  hints(f, kind, src);
}

function buildInvoiceOptions(f, kind, changed) {
  const c = card(f.cardId.value);
  if (!c) { f.invoice.innerHTML = ''; return; }
  const sig = kind + c.id + (kind === 'fatura' ? '' : f.date.value);
  const rebuild = f._invSig !== sig;
  if (rebuild) {
    f._invSig = sig;
    const prev = f.invoice.value || f.dataset.inv;
    const cur = currentKey(c);
    let keys, label;
    if (kind === 'fatura') {
      keys = [...new Set([...openInvoices(c).map((i) => i.key).filter((k) => k <= addYM(cur, 1)), cur])].sort();
      label = (k) => { const i = invoice(c.id, k); return `${ymLabel(k, true)} · ${i.remaining > 0 ? `falta ${brl(i.remaining)}` : INV_STATUS[i.status][0].toLowerCase()}`; };
      const pick = keys.includes(prev) ? prev : (keys.find((k) => { const i = invoice(c.id, k); return i.remaining > 0 && i.status !== 'aberta'; }) || cur);
      f.invoice.innerHTML = keys.map((k) => `<option value="${k}" ${k === pick ? 'selected' : ''}>${label(k)}</option>`).join('');
    } else {
      const base = invoiceKeyFor(c, f.date.value || todayISO());
      keys = [...new Set([...[...Array(16)].map((_, i) => addYM(base, i - 3)), prev].filter(Boolean))].sort();
      f.invoice.innerHTML = keys.map((k) => `<option value="${k}" ${k === (prev || base) ? 'selected' : ''}>Fatura ${ymLabel(k, true)}</option>`).join('');
    }
  }
  if (kind === 'fatura' && (rebuild || changed?.name === 'invoice') && !f.dataset.amtTouched && !f.dataset.id) {
    const i = invoice(c.id, f.invoice.value);
    f.amount.value = moneyInput(i.remaining);
  }
}

function hints(f, kind, src) {
  const box = $('.hint-box', f);
  const out = [];
  const amt = parseMoney(f.amount.value);
  const date = f.date.value || todayISO();
  const desc = f.desc.value;
  const edit = !!f.dataset.id;
  if ((kind === 'despesa' || kind === 'receita') && src === 'cartao' && !edit) {
    const c = card(f.cardId.value);
    if (c) {
      const k = invoiceKeyFor(c, date);
      const n = f.parcelas ? +f.parcelas.value : 1;
      out.push(notice('info', `Vai para a fatura de <b>${ymLabel(k, true)}</b> (vence ${dLabel(invDates(c, k).due)})${n > 1 ? ` até a de ${ymLabel(addYM(k, n - 1), true)}` : ''}. O dinheiro só sai da conta quando você pagar a fatura.`));
    }
  }
  if (kind === 'despesa' && src === 'conta') {
    const looksInvoice = /fatura|cart[aã]o de cr[eé]dito/i.test(desc);
    let match = null;
    if (amt > 0) for (const c of activeCards()) { const i = openInvoices(c).find((x) => Math.abs(x.remaining - amt) < 0.01 || Math.abs(x.total - amt) < 0.01); if (i) { match = { c, i }; break; } }
    if (looksInvoice || match) {
      out.push(notice('warn', `<b>É o pagamento de uma fatura?</b> ${match ? `Esse valor é igual à fatura de ${esc(match.c.name)} (${ymLabel(match.i.key)}). ` : ''}As compras do cartão já foram contadas uma vez. Registre como pagamento de fatura para não contar o mesmo gasto duas vezes.<br><button type="button" class="link" data-act="toFatura" ${match ? `data-c="${match.c.id}" data-k="${match.i.key}"` : ''}>Registrar como pagamento de fatura</button>`));
    }
  }
  if (!edit && kind === 'despesa' && amt > 0) {
    const dup = findDupes(amt, date)[0];
    if (dup) out.push(notice('bad', `<b>Possível gasto repetido:</b> ${esc(dup.desc)} de ${brl(dup.amount)} em ${dLabel(dup.date)} (${esc(srcName(dup))}). Se for o mesmo gasto, não lance de novo.`));
  }
  box.innerHTML = out.join('');
}

async function submitTx(f) {
  const id = f.dataset.id;
  const old = id ? S.tx.find((x) => x.id === id) : null;
  const kind = f.kind.value;
  const amount = parseMoney(f.amount.value);
  if (!(amount > 0)) { toast('Digite um valor maior que zero'); f.amount.focus(); return; }
  const date = f.date.value || todayISO();
  const desc = f.desc.value.trim();
  const note = f.note.value.trim();
  const isDR = kind === 'despesa' || kind === 'receita';
  const src = isDR ? f.source.value || 'conta' : null;
  const base = { kind, amount, date, desc, note };

  if (isDR) {
    const chk = f.querySelector(`input[name="cat_${kind}"]:checked`);
    base.categoryId = chk ? chk.value : kind === 'despesa' ? 'c_out_d' : 'c_out_r';
    if (src === 'cartao') {
      if (!card(f.cardId.value)) return toast('Escolha o cartão');
      base.cardId = f.cardId.value; base.paid = true;
    } else {
      if (!acc(f.accountId.value)) return toast('Escolha a conta');
      base.accountId = f.accountId.value; base.paid = f.paid.checked;
    }
    if (!desc) base.desc = cat(base.categoryId, kind).name;
  } else if (kind === 'transferencia') {
    if (!acc(f.accountId.value) || !acc(f.toAccountId.value)) return toast('Escolha as duas contas');
    if (f.accountId.value === f.toAccountId.value) return toast('Escolha contas diferentes');
    Object.assign(base, { accountId: f.accountId.value, toAccountId: f.toAccountId.value, paid: true });
    const to = acc(base.toAccountId), from = acc(base.accountId);
    if (!desc) base.desc = isInvest(to) && !isInvest(from) ? `Aporte em ${to.name}` : isInvest(from) && !isInvest(to) ? `Resgate de ${from.name}` : 'Transferência';
  } else if (kind === 'fatura') {
    const c = card(f.cardId.value);
    if (!c) return toast('Escolha o cartão');
    if (!acc(f.accountId.value)) return toast('Escolha a conta que paga');
    if (!f.invoice.value) return toast('Escolha a fatura');
    Object.assign(base, { cardId: c.id, accountId: f.accountId.value, invoice: f.invoice.value, paid: true });
    if (!desc) base.desc = `Fatura ${c.name} ${ymLabel(base.invoice)}`;
  }

  if (old) {
    const keepInv = old.invoice;
    for (const k of ['accountId', 'cardId', 'toAccountId', 'invoice']) delete old[k];
    Object.assign(old, base);
    if (isDR && old.cardId) old.invoice = f.invoice.value || keepInv || invoiceKeyFor(card(old.cardId), date);
    commit('Lançamento atualizado');
    return;
  }

  if (kind === 'despesa') {
    const dup = findDupes(amount, date)[0];
    if (dup && !(await confirmDlg('Pode ser um gasto repetido', `Já existe “${esc(dup.desc)}” de ${brl(dup.amount)} em ${dLabel(dup.date)} (${esc(srcName(dup))}). Salvar mesmo assim?`, 'Salvar mesmo assim'))) return;
  }

  const n = isDR ? +(f.parcelas?.value || 1) : 1;
  if (n > 1) {
    const total = f.parcMode.value === 'parcela' ? r2(amount * n) : amount;
    const per = Math.floor((total / n) * 100) / 100;
    const g = uid();
    const firstKey = base.cardId ? invoiceKeyFor(card(base.cardId), date) : null;
    for (let i = 0; i < n; i++) {
      const t = { ...base, id: uid(), amount: i === 0 ? r2(total - per * (n - 1)) : per, date: addMonthsISO(date, i), installment: { i: i + 1, n, g }, purchaseDate: date };
      if (firstKey) t.invoice = addYM(firstKey, i);
      else if (i > 0) t.paid = false;
      S.tx.push(t);
    }
  } else {
    const t = { ...base, id: uid() };
    if (t.cardId) t.invoice = invoiceKeyFor(card(t.cardId), date);
    if (isDR && f.repeat?.checked) {
      const r = { id: uid(), desc: t.desc, amount, kind, group: kind === 'receita' ? 'renda' : f.group.value || 'fixo', categoryId: t.categoryId, accountId: t.accountId || null, cardId: t.cardId || null, day: +date.slice(8), start: ymOf(date), active: true, generated: [ymOf(date)] };
      S.recurring.push(r);
      t.recurringId = r.id;
    }
    S.tx.push(t);
  }
  genRecurring();
  commit(n > 1 ? `${n} parcelas lançadas` : f.repeat?.checked ? 'Lançado e repetindo todo mês' : 'Lançamento salvo');
}

async function deleteTx(t) {
  if (t.installment) {
    const v = await choose('Excluir parcela', `Esta é a parcela ${t.installment.i} de ${t.installment.n}.`, [{ label: 'Excluir só esta parcela', value: 'one', cls: 'danger' }, { label: `Excluir as ${t.installment.n} parcelas`, value: 'all', cls: 'danger' }]);
    if (!v) return;
    withUndo(v === 'all' ? 'Parcelas excluídas' : 'Parcela excluída', () => { S.tx = S.tx.filter((x) => (v === 'all' ? x.installment?.g !== t.installment.g : x.id !== t.id)); });
  } else if (t.recurringId && S.recurring.some((r) => r.id === t.recurringId)) {
    const v = await choose('Excluir lançamento fixo', 'Este lançamento se repete todo mês.', [{ label: 'Excluir só este mês', value: 'one', cls: 'danger' }, { label: 'Excluir este e os próximos', value: 'future', cls: 'danger' }]);
    if (!v) return;
    withUndo('Lançamento excluído', () => {
      if (v === 'one') { S.tx = S.tx.filter((x) => x.id !== t.id); return; }
      const r = S.recurring.find((x) => x.id === t.recurringId);
      r.end = addYM(ymOf(t.date), -1);
      if (r.end < r.start) r.active = false;
      S.tx = S.tx.filter((x) => !(x.recurringId === r.id && x.date >= t.date));
    });
  } else {
    if (!(await confirmDlg('Excluir lançamento', `“${esc(t.desc)}” de ${brl(t.amount)}.`, 'Excluir', 'danger'))) return;
    withUndo('Lançamento excluído', () => { S.tx = S.tx.filter((x) => x.id !== t.id); });
  }
}

/* ----- Conta ----- */
function accSheet(a) {
  const edit = !!a;
  const d = a || { type: 'corrente', color: COLORS[0], name: '' };
  const hasTx = edit && S.tx.some((t) => t.accountId === a.id || t.toAccountId === a.id);
  openSheet(`<form data-form="acc" data-id="${edit ? a.id : ''}" autocomplete="off">
    ${sheetHead(edit ? 'Editar conta' : 'Nova conta')}
    <label class="field"><span>Nome</span><input name="nm" value="${esc(d.name)}" placeholder="Ex.: Nubank, Itaú, Carteira, Tesouro Selic" maxlength="40" required></label>
    <label class="field"><span>Tipo</span><select name="atype">${Object.entries(ACC_TYPES).map(([k, v]) => `<option value="${k}" ${k === d.type ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}</select></label>
    ${edit ? `<div class="notice info">${ic('info')}<div>Saldo hoje: <b>${brl(balance(a.id))}</b>. Para corrigir o saldo, use “Ajustar saldo” na tela da conta.</div></div><div style="height:12px"></div>`
      : `<label class="field"><span>Saldo atual</span><input name="initial" inputmode="decimal" placeholder="0,00"></label>`}
    <span class="field"><span>Cor</span></span>${swatches(d.color)}
    <div class="form-foot"><button class="btn primary block" type="submit">${edit ? 'Salvar' : 'Adicionar conta'}</button>
    ${edit ? (hasTx ? `<button type="button" class="btn block" data-act="archiveAcc" data-id="${a.id}">${a.archived ? 'Reativar conta' : 'Arquivar conta'}</button>` : `<button type="button" class="btn danger block" data-act="delAcc" data-id="${a.id}">${ic('trash')} Excluir conta</button>`) : ''}</div>
  </form>`);
}
function submitAcc(f) {
  const name = f.nm.value.trim();
  if (!name) return toast('Dê um nome para a conta');
  const color = f.querySelector('input[name=color]:checked')?.value || COLORS[0];
  if (f.dataset.id) {
    const a = acc(f.dataset.id);
    Object.assign(a, { name, type: f.atype.value, color });
    commit('Conta atualizada');
  } else {
    S.accounts.push({ id: uid(), name, type: f.atype.value, color, initial: parseMoney(f.initial.value) });
    commit('Conta adicionada');
  }
}
function accDetail(a) {
  const moves = S.tx.filter((t) => (t.accountId === a.id || t.toAccountId === a.id) && (t.paid || !t.cardId)).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 40);
  openSheet(`${sheetHead(esc(a.name))}
    <div class="muted" style="font-size:13px">${ACC_TYPES[a.type]?.label || ''}${a.archived ? ' · arquivada' : ''}</div>
    <div class="big" style="font-size:40px;margin:8px 0 14px">${bigMoney(balance(a.id))}</div>
    <div class="btn-row" style="margin-top:0">
      <button class="btn" data-act="adjustAcc" data-id="${a.id}">${ic('scale')} Ajustar saldo</button>
      <button class="btn" data-act="newTx" data-kind="transferencia" data-acc="${a.id}">${ic('swap')} ${isInvest(a) ? 'Aplicar/resgatar' : 'Transferir'}</button>
    </div>
    <button class="btn block" style="margin-top:8px" data-act="editAcc" data-id="${a.id}">${ic('edit')} Editar conta</button>
    <div class="section-title"><h2>Movimentações</h2></div>
    ${moves.length ? `<div class="glass list">${moves.map((t) => txRow(t, { showDate: true })).join('')}</div>` : '<div class="empty">Nenhuma movimentação ainda.</div>'}`);
}
function adjustSheet(a) {
  openSheet(`<form data-form="adjust" data-id="${a.id}" autocomplete="off">
    ${sheetHead('Ajustar saldo')}
    <p class="muted" style="margin:0 0 14px;font-size:14px">${isInvest(a) ? 'Informe quanto o investimento vale hoje. A diferença entra como rendimento (ou perda), sem contar como receita do mês.' : 'Informe o saldo que aparece no app do banco. A diferença vira um ajuste, sem contar como gasto ou receita.'}</p>
    <div class="amount-field"><input name="amount" inputmode="decimal" placeholder="0,00" value="${moneyInput(balance(a.id))}" aria-label="Saldo real hoje"><small>saldo real hoje · no app: ${brl(balance(a.id))}</small></div>
    <div class="form-foot"><button class="btn primary block" type="submit">Salvar novo saldo</button></div>
  </form>`);
}
function submitAdjust(f) {
  const a = acc(f.dataset.id);
  const diff = r2(parseMoney(f.amount.value) - balance(a.id));
  if (Math.abs(diff) < 0.005) { closeAllSheets(); return toast('O saldo já está certo'); }
  S.tx.push({ id: uid(), kind: 'ajuste', amount: diff, accountId: a.id, date: todayISO(), desc: isInvest(a) ? (diff > 0 ? 'Rendimento' : 'Desvalorização') : 'Ajuste de saldo', paid: true });
  commit(isInvest(a) ? `Saldo atualizado (${diff > 0 ? '+' : '−'} ${brl(Math.abs(diff))})` : 'Saldo ajustado');
}

/* ----- Cartão ----- */
function cardSheet(c) {
  const edit = !!c;
  const d = c || { name: '', limit: 0, closingDay: 1, dueDay: 10, color: COLORS[2], accountId: defaultAccId() };
  const hasTx = edit && S.tx.some((t) => t.cardId === c.id);
  openSheet(`<form data-form="card" data-id="${edit ? c.id : ''}" autocomplete="off">
    ${sheetHead(edit ? 'Editar cartão' : 'Novo cartão')}
    <label class="field"><span>Nome do cartão</span><input name="nm" value="${esc(d.name)}" placeholder="Ex.: Nubank, XP Visa, Itaú Platinum" maxlength="30" required></label>
    <label class="field"><span>Limite total</span><input name="limit" inputmode="decimal" placeholder="0,00" value="${moneyInput(d.limit)}"></label>
    <div class="grid2">
      <label class="field"><span>Fecha no dia</span><select name="closingDay">${dayOptions(d.closingDay)}</select></label>
      <label class="field"><span>Vence no dia</span><select name="dueDay">${dayOptions(d.dueDay)}</select></label>
    </div>
    <div class="notice info" style="margin-bottom:12px">${ic('info')}<div>Compras feitas <b>no dia do fechamento ou depois</b> vão para a fatura seguinte. Confira as datas no app do banco.</div></div>
    ${S.accounts.length ? `<label class="field"><span>Conta que costuma pagar a fatura</span><select name="accountId">${accOptions(d.accountId, (a) => !isInvest(a))}</select></label>` : ''}
    <span class="field"><span>Cor</span></span>${swatches(d.color)}
    <div class="form-foot"><button class="btn primary block" type="submit">${edit ? 'Salvar' : 'Adicionar cartão'}</button>
    ${edit ? (hasTx ? `<button type="button" class="btn block" data-act="archiveCard" data-id="${c.id}">${c.archived ? 'Reativar cartão' : 'Arquivar cartão'}</button>` : `<button type="button" class="btn danger block" data-act="delCard" data-id="${c.id}">${ic('trash')} Excluir cartão</button>`) : ''}</div>
  </form>`);
}
function submitCard(f) {
  const name = f.nm.value.trim();
  if (!name) return toast('Dê um nome para o cartão');
  const data = { name, limit: parseMoney(f.limit.value), closingDay: +f.closingDay.value, dueDay: +f.dueDay.value, color: f.querySelector('input[name=color]:checked')?.value || COLORS[2], accountId: f.accountId?.value || '' };
  if (data.closingDay === data.dueDay) return toast('Fechamento e vencimento não podem ser no mesmo dia');
  if (f.dataset.id) {
    const c = card(f.dataset.id);
    const datesChanged = c.closingDay !== data.closingDay || c.dueDay !== data.dueDay;
    Object.assign(c, data);
    if (datesChanged) {
      // recalcula as faturas das compras ainda não pagas
      const paidKeys = new Set(S.tx.filter((t) => t.kind === 'fatura' && t.cardId === c.id).map((t) => t.invoice));
      for (const t of S.tx) {
        if (t.cardId !== c.id || t.kind === 'fatura' || paidKeys.has(t.invoice)) continue;
        t.invoice = t.installment && t.purchaseDate ? addYM(invoiceKeyFor(c, t.purchaseDate), t.installment.i - 1) : invoiceKeyFor(c, t.date);
      }
    }
    commit('Cartão atualizado');
  } else {
    const c = { id: uid(), ...data };
    S.cards.push(c);
    ui.cardId = c.id;
    commit('Cartão adicionado');
  }
}

/* ----- Fixos / assinaturas ----- */
function recSheet(r) {
  const edit = !!r;
  const d = r || { kind: 'despesa', group: 'fixo', desc: '', amount: 0, day: new Date().getDate(), accountId: defaultAccId(), cardId: '', categoryId: '', start: ymOf(todayISO()), active: true };
  const src = d.cardId ? 'cartao' : 'conta';
  openSheet(`<form data-form="rec" data-id="${edit ? r.id : ''}" autocomplete="off">
    ${sheetHead(edit ? 'Editar fixo' : 'Novo fixo ou assinatura')}
    <div class="seg kind"><label><input type="radio" name="kind" value="despesa" ${d.kind === 'despesa' ? 'checked' : ''}><span>Gasto fixo</span></label><label><input type="radio" name="kind" value="receita" ${d.kind === 'receita' ? 'checked' : ''}><span>Entrada fixa</span></label></div>
    <div class="seg g-group"><label><input type="radio" name="group" value="fixo" ${d.group !== 'assinatura' ? 'checked' : ''}><span>Custo fixo</span></label><label><input type="radio" name="group" value="assinatura" ${d.group === 'assinatura' ? 'checked' : ''}><span>Assinatura</span></label></div>
    <div class="amount-field"><input name="amount" inputmode="decimal" placeholder="0,00" value="${moneyInput(d.amount)}" aria-label="Valor por mês"><small>valor por mês (se varia, use uma média)</small></div>
    <label class="field"><span>Nome</span><input name="desc" value="${esc(d.desc)}" placeholder="Ex.: Aluguel, Internet, Netflix, Salário" maxlength="60"></label>
    ${catGrid('despesa', d.categoryId, 'rcat_despesa')}${catGrid('receita', d.categoryId, 'rcat_receita')}
    <div class="seg g-src"><label><input type="radio" name="source" value="conta" ${src === 'conta' ? 'checked' : ''}><span>Conta · débito · boleto</span></label><label><input type="radio" name="source" value="cartao" ${src === 'cartao' ? 'checked' : ''} ${activeCards().length ? '' : 'disabled'}><span>Cartão de crédito</span></label></div>
    <div class="grid2">
      <label class="field g-acc"><span>Conta</span><select name="accountId">${accOptions(d.accountId)}</select></label>
      <label class="field g-card"><span>Cartão</span><select name="cardId">${cardOptions(d.cardId || activeCards()[0]?.id)}</select></label>
      <label class="field"><span>Todo dia</span><select name="day">${dayOptions(d.day)}</select></label>
    </div>
    ${edit ? `<label class="switch"><span>Ativo<small>Pausado não gera novos lançamentos</small></span><input type="checkbox" name="active" ${d.active ? 'checked' : ''}></label>`
      : `<label class="field"><span>Começa em</span><input type="month" name="start" value="${d.start}"></label>`}
    <div class="form-foot"><button class="btn primary block" type="submit">${edit ? 'Salvar' : 'Adicionar'}</button>${edit ? `<button type="button" class="btn danger block" data-act="delRec" data-id="${r.id}">${ic('trash')} Excluir fixo</button>` : ''}</div>
  </form>`);
  syncRec($('#sheets').lastElementChild.querySelector('form'));
}
function syncRec(f) {
  const kind = f.kind.value;
  const src = f.source.value;
  f.querySelector('.g-group').hidden = kind !== 'despesa';
  f.querySelectorAll('.cats').forEach((c) => { c.hidden = c.dataset.kind !== kind; });
  f.querySelector('.g-src').hidden = kind !== 'despesa' || !activeCards().length;
  const useCard = kind === 'despesa' && src === 'cartao';
  f.querySelector('.g-acc').hidden = useCard;
  f.querySelector('.g-card').hidden = !useCard;
}
function submitRec(f) {
  const kind = f.kind.value;
  const amount = parseMoney(f.amount.value);
  if (!(amount > 0)) return toast('Digite o valor por mês');
  const chk = f.querySelector(`input[name="rcat_${kind}"]:checked`);
  const categoryId = chk ? chk.value : kind === 'despesa' ? (f.group.value === 'assinatura' ? 'd_assin' : 'c_out_d') : 'c_out_r';
  const useCard = kind === 'despesa' && f.source.value === 'cartao';
  if (useCard && !card(f.cardId.value)) return toast('Escolha o cartão');
  if (!useCard && !acc(f.accountId.value)) return toast('Escolha a conta');
  const data = {
    kind, amount, categoryId,
    group: kind === 'receita' ? 'renda' : f.group.value,
    desc: f.desc.value.trim() || cat(categoryId, kind).name,
    day: +f.day.value,
    accountId: useCard ? null : f.accountId.value,
    cardId: useCard ? f.cardId.value : null
  };
  if (f.dataset.id) {
    const r = S.recurring.find((x) => x.id === f.dataset.id);
    const wasActive = r.active;
    Object.assign(r, data);
    r.active = f.active.checked;
    // atualiza o que ainda vai acontecer
    dropFuture(r, todayISO());
    if (r.active && !wasActive) { r.end = null; if (r.start < ymOf(todayISO())) r.start = ymOf(todayISO()); }
    genRecurring();
    commit('Fixo atualizado');
  } else {
    S.recurring.push({ id: uid(), ...data, start: f.start.value || ymOf(todayISO()), active: true, generated: [] });
    genRecurring();
    commit('Fixo adicionado');
  }
}

/* ----- Categorias ----- */
function catsSheet() {
  const sec = (kind, title) => `<div class="day-head"><span>${title}</span></div><div class="glass list">${S.categories.filter((c) => c.kind === kind).map((c) => `<button class="row" data-act="editCat" data-id="${c.id}"><span class="ico" style="background:${hexA(c.color, 0.2)}">${c.icon}</span><span class="main"><b>${esc(c.name)}</b></span><span class="chev">${ic('chevR')}</span></button>`).join('')}</div>`;
  openSheet(`${sheetHead('Categorias')}${sec('despesa', 'Gastos')}${sec('receita', 'Entradas')}<button class="btn primary block" style="margin-top:16px" data-act="addCat">${ic('plus')} Nova categoria</button>`);
}
function catSheet(c) {
  const edit = !!c;
  const d = c || { name: '', icon: '🏷️', kind: 'despesa', color: COLORS[0] };
  const locked = edit && (c.id === 'c_out_d' || c.id === 'c_out_r');
  openSheet(`<form data-form="cat" data-id="${edit ? c.id : ''}" autocomplete="off">
    ${sheetHead(edit ? 'Editar categoria' : 'Nova categoria')}
    ${edit ? '' : '<div class="seg"><label><input type="radio" name="kind" value="despesa" checked><span>Gasto</span></label><label><input type="radio" name="kind" value="receita"><span>Entrada</span></label></div>'}
    <div class="grid2" style="grid-template-columns:90px 1fr">
      <label class="field"><span>Ícone</span><input name="icon" value="${esc(d.icon)}" maxlength="4" style="text-align:center;font-size:22px"></label>
      <label class="field"><span>Nome</span><input name="nm" value="${esc(d.name)}" maxlength="24" ${locked ? 'readonly' : ''}></label>
    </div>
    <span class="field"><span>Cor no gráfico</span></span>${swatches(d.color)}
    <div class="form-foot"><button class="btn primary block" type="submit">Salvar</button>${edit && !locked ? `<button type="button" class="btn danger block" data-act="delCat" data-id="${c.id}">${ic('trash')} Excluir categoria</button>` : ''}</div>
  </form>`);
}
function submitCat(f) {
  const name = f.nm.value.trim();
  if (!name) return toast('Dê um nome para a categoria');
  const data = { name, icon: f.icon.value.trim() || '🏷️', color: f.querySelector('input[name=color]:checked')?.value || COLORS[0] };
  if (f.dataset.id) Object.assign(S.categories.find((c) => c.id === f.dataset.id), data);
  else S.categories.splice(S.categories.findIndex((c) => c.id === (f.kind.value === 'despesa' ? 'c_out_d' : 'c_out_r')), 0, { id: uid(), kind: f.kind.value, ...data });
  save(); closeAllSheets(); render(); catsSheet(); toast('Categoria salva');
}

/* ----- Instalar ----- */
function installSheet() {
  openSheet(`${sheetHead('Instalar no iPhone')}
    <div class="glass list">
      <div class="row"><span class="ico">1</span><span class="main"><b>Abra este endereço no Safari</b><small>Precisa ser o Safari, não o Chrome</small></span></div>
      <div class="row"><span class="ico">${ic('share')}</span><span class="main"><b>Toque em Compartilhar</b><small>O quadrado com a seta, na barra de baixo</small></span></div>
      <div class="row"><span class="ico">${ic('plus')}</span><span class="main"><b>“Adicionar à Tela de Início”</b><small>Role a lista para baixo se não aparecer</small></span></div>
      <div class="row"><span class="ico">B</span><span class="main"><b>Abra pelo ícone Bolso</b><small>Abre em tela cheia e funciona sem internet</small></span></div>
    </div>
    <div style="height:12px"></div>
    ${notice('info', 'Seus dados ficam salvos na <b>sua conta</b>. Se trocar de celular ou apagar o ícone, é só entrar de novo com e-mail e senha.')}`);
}

/* ----- Backup ----- */
async function shareOrDownload(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
async function exportJSON() {
  const ok = await shareOrDownload(`bolso-backup-${todayISO()}.json`, JSON.stringify({ app: 'bolso', exportedAt: new Date().toISOString(), data: S }), 'application/json');
  if (ok) { S.settings.lastBackup = todayISO(); save(); render(); toast('Backup salvo'); }
}
function importJSON() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const file = inp.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      const d = obj.data || obj;
      if (!Array.isArray(d.accounts) || !Array.isArray(d.tx)) throw new Error('formato');
      if (!(await confirmDlg('Restaurar backup', `O arquivo tem ${d.accounts.length} contas e ${d.tx.length} lançamentos. Os dados atuais deste aparelho serão substituídos.`, 'Restaurar', 'danger'))) return;
      S = normalize(d);
      genRecurring(); save(); closeAllSheets(); render();
      toast('Backup restaurado');
    } catch (e) {
      toast('Esse arquivo não é um backup do Bolso');
    }
  };
  inp.click();
}
async function exportCSV() {
  const kindL = { despesa: 'Despesa', receita: 'Receita', transferencia: 'Transferência', fatura: 'Pagamento de fatura', ajuste: 'Ajuste' };
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta / cartão', 'Fatura', 'Valor', 'Situação', 'Parcela', 'Observação'].map(q).join(';')];
  for (const t of [...S.tx].sort((a, b) => a.date.localeCompare(b.date))) {
    const sign = t.kind === 'despesa' ? -1 : 1;
    lines.push([
      t.date.split('-').reverse().join('/'), kindL[t.kind], t.desc,
      t.kind === 'despesa' || t.kind === 'receita' ? cat(t.categoryId, t.kind).name : '',
      srcName(t), t.invoice ? ymLabel(t.invoice) : '',
      (sign * t.amount).toFixed(2).replace('.', ','),
      t.paid ? 'Pago' : 'Pendente',
      t.installment ? `${t.installment.i}/${t.installment.n}` : '', t.note || ''
    ].map(q).join(';'));
  }
  await shareOrDownload(`bolso-lancamentos-${todayISO()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv');
}

/* ----- Dados de exemplo ----- */
function loadSample() {
  S = fresh();
  S.settings.sample = true;
  const T = todayISO();
  const cur = ymOf(T), prev = addYM(cur, -1);
  const A = (name, type, initial, color) => { const a = { id: uid(), name, type, initial, color }; S.accounts.push(a); return a.id; };
  const nu = A('Nubank', 'corrente', 2350, '#8A5CF6');
  const itau = A('Itaú', 'corrente', 3900, '#FF9F43');
  const cart = A('Carteira', 'carteira', 140, '#52D9AA');
  A('VR', 'beneficio', 520, '#F2705C');
  const selic = A('Tesouro Selic', 'investimento', 12000, '#F2B544');
  A('CDB Inter', 'investimento', 5200, '#4FD1E8');
  const cNu = { id: uid(), name: 'Nubank', limit: 8000, closingDay: 28, dueDay: 5, color: '#8A5CF6', accountId: nu };
  const cXp = { id: uid(), name: 'XP Visa', limit: 15000, closingDay: 10, dueDay: 17, color: '#3B4A6B', accountId: itau };
  S.cards.push(cNu, cXp);
  const R = (desc, amount, kind, group, categoryId, day, where) => S.recurring.push({ id: uid(), desc, amount, kind, group, categoryId, day, start: prev, active: true, generated: [], accountId: where.card ? null : where, cardId: where.card || null });
  R('Salário', 6500, 'receita', 'renda', 'r_sal', 5, itau);
  R('Aluguel', 1800, 'despesa', 'fixo', 'd_casa', 10, itau);
  R('Energia', 230, 'despesa', 'fixo', 'd_contas', 12, nu);
  R('Internet', 119.9, 'despesa', 'fixo', 'd_contas', 15, nu);
  R('Academia', 109.9, 'despesa', 'fixo', 'd_saude', 8, itau);
  R('Netflix', 44.9, 'despesa', 'assinatura', 'd_assin', 18, { card: cNu.id });
  R('Spotify', 21.9, 'despesa', 'assinatura', 'd_assin', 3, { card: cNu.id });
  R('Claude Pro', 110, 'despesa', 'assinatura', 'd_assin', 20, { card: cXp.id });
  genRecurring();
  for (const t of S.tx) if (!t.cardId && t.date < T) t.paid = true;
  const P = (desc, amount, daysAgo, categoryId, where, n = 1) => {
    const date = addDays(T, -daysAgo);
    const c = where.card ? card(where.card) : null;
    const g = uid();
    for (let i = 0; i < n; i++) {
      const t = { id: uid(), kind: 'despesa', desc, amount: r2(amount / n), date: addMonthsISO(date, i), categoryId, paid: true };
      if (c) { t.cardId = c.id; t.invoice = addYM(invoiceKeyFor(c, date), i); } else t.accountId = where;
      if (n > 1) { t.installment = { i: i + 1, n, g }; t.purchaseDate = date; }
      S.tx.push(t);
    }
  };
  P('Mercado Pão de Açúcar', 412.8, 3, 'd_mercado', { card: cXp.id });
  P('iFood', 68.9, 1, 'd_comer', { card: cNu.id });
  P('Uber', 23.4, 2, 'd_transp', { card: cNu.id });
  P('Posto Shell', 250, 6, 'd_transp', { card: cXp.id });
  P('Drogasil', 87.3, 9, 'd_saude', { card: cNu.id });
  P('Outback', 156, 12, 'd_comer', { card: cNu.id });
  P('Presente aniversário', 199, 20, 'd_presente', { card: cNu.id });
  P('Mercado Extra', 380.5, 25, 'd_mercado', { card: cXp.id });
  P('iPhone 16', 5490, 40, 'd_compras', { card: cXp.id }, 10);
  P('Padaria', 32, 1, 'd_comer', cart);
  P('Cabeleireiro', 70, 4, 'd_pessoal', nu);
  S.tx.push({ id: uid(), kind: 'transferencia', desc: 'Aporte em Tesouro Selic', amount: 500, date: addDays(T, -7), accountId: itau, toAccountId: selic, paid: true });
  const g = uid();
  for (let i = 0; i < 3; i++) S.tx.push({ id: uid(), kind: 'receita', desc: 'Comissão consórcio', amount: 1250, date: dateIn(addYM(cur, i), 20), categoryId: 'r_com', accountId: itau, paid: false, installment: { i: i + 1, n: 3, g }, purchaseDate: dateIn(cur, 20) });
  // faturas já vencidas: pagas
  for (const c of S.cards) for (const inv of openInvoices(c)) if (inv.due < T) S.tx.push({ id: uid(), kind: 'fatura', desc: `Fatura ${c.name} ${ymLabel(inv.key)}`, amount: inv.remaining, date: inv.due, cardId: c.id, accountId: c.accountId, invoice: inv.key, paid: true });
  save();
}

/* =========================================================
   EVENTOS
   ========================================================= */
const A = {
  tab: (el) => { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  month: (el) => { ui.month = addYM(ui.month, +el.dataset.d); render(); },
  monthToday: () => { ui.month = ymOf(todayISO()); render(); },
  hide: () => { S.settings.hide = !S.settings.hide; save(); render(); },
  newTx: (el) => {
    const p = { kind: el.dataset.kind, source: el.dataset.source, cardId: el.dataset.card, accountId: el.dataset.acc, pending: !!el.dataset.pending };
    if (el.id === 'fab' && ui.tab === 'cartoes' && ui.cardId) { p.source = 'cartao'; p.cardId = ui.cardId; }
    if (p.kind === 'transferencia' && p.accountId && isInvest(acc(p.accountId))) { p.toAccountId = p.accountId; p.accountId = defaultAccId(); }
    txSheet(null, p);
  },
  editTx: (el) => { const t = S.tx.find((x) => x.id === el.dataset.id); if (t) txSheet(t); },
  delTx: (el) => { const t = S.tx.find((x) => x.id === el.dataset.id); if (t) deleteTx(t); },
  pay: (el) => {
    const t = S.tx.find((x) => x.id === el.dataset.id);
    if (!t) return;
    withUndo(t.kind === 'receita' ? `Recebido: ${t.desc}` : `Pago: ${t.desc}`, () => { t.paid = true; t.paidAt = todayISO(); });
  },
  payInv: (el) => txSheet(null, { kind: 'fatura', cardId: el.dataset.c, invoice: el.dataset.k }),
  toFatura: (el) => {
    const f = el.closest('form');
    f.querySelector('input[name=kind][value=fatura]').checked = true;
    if (el.dataset.c) { f.cardId.value = el.dataset.c; f.dataset.inv = el.dataset.k; f.invoice.innerHTML = ''; }
    f._invSig = null;
    if (!f.desc.value.trim() || /fatura|cart/i.test(f.desc.value)) f.desc.value = '';
    syncTx(f);
  },
  selCard: (el) => { ui.cardId = el.dataset.id; render(); },
  goCard: (el) => { ui.cardId = el.dataset.id; if (el.dataset.k) ui.inv[el.dataset.id] = el.dataset.k; ui.tab = 'cartoes'; render(); window.scrollTo(0, 0); },
  invNav: (el) => { const c = card(ui.cardId); ui.inv[c.id] = addYM(ui.inv[c.id] || currentKey(c), +el.dataset.d); render(); },
  invGo: (el) => { ui.inv[ui.cardId] = el.dataset.k; render(); },
  addCard: () => cardSheet(),
  editCard: (el) => cardSheet(card(el.dataset.id)),
  archiveCard: (el) => { const c = card(el.dataset.id); c.archived = !c.archived; commit(c.archived ? 'Cartão arquivado' : 'Cartão reativado'); },
  delCard: (el) => withUndo('Cartão excluído', () => { S.cards = S.cards.filter((c) => c.id !== el.dataset.id); }),
  addAcc: () => accSheet(),
  editAcc: (el) => accSheet(acc(el.dataset.id)),
  accDetail: (el) => accDetail(acc(el.dataset.id)),
  adjustAcc: (el) => adjustSheet(acc(el.dataset.id)),
  archiveAcc: (el) => { const a = acc(el.dataset.id); a.archived = !a.archived; commit(a.archived ? 'Conta arquivada' : 'Conta reativada'); },
  delAcc: (el) => withUndo('Conta excluída', () => { S.accounts = S.accounts.filter((a) => a.id !== el.dataset.id); }),
  filter: (el) => { ui.filter = el.dataset.f; render(); },
  agendaTab: (el) => { ui.agenda = el.dataset.k; render(); },
  agendaAll: () => { ui.agendaAll = !ui.agendaAll; render(); },
  goFixos: () => { ui.tab = 'agenda'; ui.agenda = 'fixos'; render(); window.scrollTo(0, 0); },
  addRec: () => recSheet(),
  editRec: (el) => recSheet(S.recurring.find((r) => r.id === el.dataset.id)),
  delRec: async (el) => {
    const r = S.recurring.find((x) => x.id === el.dataset.id);
    const v = await choose('Excluir fixo', `“${esc(r.desc)}” deixa de ser lançado todo mês. O que fazer com o que já foi lançado?`, [{ label: 'Manter o histórico, apagar só o futuro', value: 'keep', cls: 'danger' }, { label: 'Apagar tudo, inclusive histórico', value: 'all', cls: 'danger' }]);
    if (!v) return;
    withUndo('Fixo excluído', () => {
      if (v === 'all') S.tx = S.tx.filter((t) => t.recurringId !== r.id);
      else { dropFuture(r, todayISO()); S.tx.forEach((t) => { if (t.recurringId === r.id) delete t.recurringId; }); }
      S.recurring = S.recurring.filter((x) => x.id !== r.id);
    });
  },
  cats: () => catsSheet(),
  addCat: () => catSheet(),
  editCat: (el) => catSheet(S.categories.find((c) => c.id === el.dataset.id)),
  delCat: (el) => {
    const c = S.categories.find((x) => x.id === el.dataset.id);
    const to = c.kind === 'receita' ? 'c_out_r' : 'c_out_d';
    withUndo('Categoria excluída', () => {
      S.tx.forEach((t) => { if (t.categoryId === c.id) t.categoryId = to; });
      S.recurring.forEach((r) => { if (r.categoryId === c.id) r.categoryId = to; });
      S.categories = S.categories.filter((x) => x.id !== c.id);
    });
  },
  cardMode: async () => {
    const v = await choose('Compras no cartão contam no mês…', 'Isso muda só os relatórios (resumo do mês, categorias, extrato). Saldos e faturas não mudam.', [{ label: 'Da fatura: quando o dinheiro sai', value: 'fatura', cls: S.settings.cardMode === 'fatura' ? 'primary' : '' }, { label: 'Da compra: quando você comprou', value: 'compra', cls: S.settings.cardMode === 'compra' ? 'primary' : '' }]);
    if (v) { S.settings.cardMode = v; save(); render(); }
  },
  export: () => exportJSON(),
  import: () => importJSON(),
  csv: () => exportCSV(),
  install: () => installSheet(),
  dismissInstall: () => { S.settings.installDismissed = true; save(); render(); },
  hideBackup: () => { ui.backupHidden = true; render(); },
  sample: () => { loadSample(); render(); toast('Dados de exemplo carregados'); },
  clearSample: async () => {
    if (!(await confirmDlg('Começar do zero', 'Os dados de exemplo serão apagados.', 'Apagar exemplo', 'danger'))) return;
    S = fresh(); save(); render();
  },
  wipe: async () => {
    if (!(await confirmDlg('Apagar todos os dados?', 'Contas, cartões, lançamentos e fixos serão apagados <b>deste aparelho e da nuvem</b>. Sem um backup, não dá para recuperar.', 'Apagar tudo', 'danger'))) return;
    S = fresh(); save(); ui.tab = 'inicio'; render(); toast('Dados apagados');
  }
};
const FORMS = { tx: submitTx, acc: submitAcc, adjust: submitAdjust, card: submitCard, rec: submitRec, cat: submitCat };

document.addEventListener('click', (e) => {
  const close = e.target.closest('[data-close]');
  if (close) { closeSheet(close.closest('.sheet-wrap')); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act][role=button]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape' && $('#sheets').lastElementChild) closeSheet();
});
document.addEventListener('submit', (e) => {
  const fn = FORMS[e.target.dataset.form];
  if (fn) { e.preventDefault(); fn(e.target); }
});
function onFormInput(e) {
  const f = e.target.form;
  if (e.target.id === 'q') { ui.q = e.target.value; $('#xlist').innerHTML = extratoList(); return; }
  if (e.target.dataset.toggle === 'hide') { S.settings.hide = e.target.checked; save(); render(); return; }
  if (!f) return;
  if (f.dataset.form === 'tx') {
    if (e.target.name === 'amount' && e.type === 'input') f.dataset.amtTouched = '1';
    syncTx(f, e.target);
  }
  if (f.dataset.form === 'rec') syncRec(f);
}
document.addEventListener('input', onFormInput);
document.addEventListener('change', (e) => { if (e.target.id !== 'q') onFormInput(e); });

/* ---------- início ---------- */
// O login, a sincronização e a primeira renderização ficam em cloud.js.
$('#fab').innerHTML = ic('plus');
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
