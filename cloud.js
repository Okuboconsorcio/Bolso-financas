'use strict';
/* =========================================================
   Bolso — nuvem
   Login (Supabase Auth), sincronização com o schema
   financeiro_nick e bloqueio com Face ID (WebAuthn).
   O app continua funcionando offline: guarda no aparelho e
   envia para a nuvem quando a internet volta.
   ========================================================= */
(() => {
  const SB_URL = 'https://dkwtidhcuvrdzfcewfoz.supabase.co';
  // Chave pública (publishable): pode ficar no app. Quem protege os dados são as regras RLS do banco.
  const SB_KEY = 'sb_publishable_oFpXDSyvcEqsocNWx6ohTQ_kvZT0dpt';
  const SB_SCHEMA = 'financeiro_nick';
  const LOCK_AFTER_MS = 60 * 1000; // pede Face ID de novo depois de 1 min fora do app
  const LEGACY_KEY = 'bolso.v1';

  // links de e-mail (recuperar senha / erro) — lidos antes do supabase-js limpar a URL
  const HASH = new URLSearchParams(location.hash.replace(/^#/, ''));
  let RECOVERY = HASH.get('type') === 'recovery';
  const HASH_ERROR = HASH.get('error_code') || HASH.get('error');

  const sb = supabase.createClient(SB_URL, SB_KEY, {
    db: { schema: SB_SCHEMA },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'bolso.auth' }
  });

  const C = (window.Cloud = { user: null, status: 'off', error: '', faceOK: false });
  let snap = null; // último estado confirmado na nuvem: { tabela: { id: json }, pref: json }
  let busy = false, dirty = false, timer = null, starting = false, locked = false, hiddenAt = 0;

  const SNAP_KEY = () => `bolso.snap.${C.user.id}`;
  const LOCK_KEY = () => `bolso.lock.${C.user.id}`;
  const PERFIL_KEY = () => `bolso.perfil.${C.user.id}`;
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* cheio */ } };
  const saveSnap = () => writeJSON(SNAP_KEY(), snap);
  const lockCfg = () => (C.user && readJSON(LOCK_KEY())) || {};
  const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
  const color = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : d);
  const txt = (s, n, d = '') => (String(s ?? '').trim() || d).slice(0, n);
  const day = (v) => Math.min(31, Math.max(1, parseInt(v, 10) || 1));
  const ymOk = (v) => (/^\d{4}-\d{2}$/.test(v || '') ? v : null);

  /* ---------- mapeamento app ⇄ tabelas (ordem = ordem de envio) ---------- */
  const MAP = [
    {
      table: 'categorias', key: 'categories', order: 'ordem',
      to: (c, i) => ({ id: c.id, nome: txt(c.name, 60, 'Sem nome'), icone: txt(c.icon, 16, '🏷️'), tipo: c.kind === 'receita' ? 'receita' : 'despesa', cor: color(c.color, '#9AA3BC'), ordem: i }),
      from: (r) => ({ id: r.id, name: r.nome, icon: r.icone, kind: r.tipo, color: r.cor })
    },
    {
      table: 'contas', key: 'accounts', order: 'criado_em',
      to: (a) => ({ id: a.id, nome: txt(a.name, 60, 'Conta'), tipo: a.type, saldo_inicial: r2(Number(a.initial) || 0), cor: color(a.color, '#5AAEE8'), arquivada: !!a.archived }),
      from: (r) => ({ id: r.id, name: r.nome, type: r.tipo, initial: Number(r.saldo_inicial), color: r.cor, ...(r.arquivada ? { archived: true } : {}) })
    },
    {
      table: 'cartoes', key: 'cards', order: 'criado_em',
      to: (c, i, ref) => ({ id: c.id, nome: txt(c.name, 60, 'Cartão'), limite: Math.max(0, r2(Number(c.limit) || 0)), dia_fechamento: day(c.closingDay), dia_vencimento: day(c.dueDay), conta_pagamento_id: ref('accounts', c.accountId), cor: color(c.color, '#8A5CF6'), arquivado: !!c.archived }),
      from: (r) => ({ id: r.id, name: r.nome, limit: Number(r.limite), closingDay: r.dia_fechamento, dueDay: r.dia_vencimento, accountId: r.conta_pagamento_id || '', color: r.cor, ...(r.arquivado ? { archived: true } : {}) })
    },
    {
      table: 'recorrentes', key: 'recurring', order: 'criado_em',
      to: (x, i, ref) => ({
        id: x.id, descricao: txt(x.desc, 120, 'Fixo'), valor: Math.max(0, r2(Number(x.amount) || 0)), tipo: x.kind === 'receita' ? 'receita' : 'despesa',
        grupo: ['fixo', 'assinatura', 'renda'].includes(x.group) ? x.group : x.kind === 'receita' ? 'renda' : 'fixo',
        categoria_id: ref('categories', x.categoryId), conta_id: ref('accounts', x.accountId), cartao_id: ref('cards', x.cardId),
        dia: day(x.day), inicio: ymOk(x.start) || ymOf(todayISO()), fim: ymOk(x.end), ativo: !!x.active, meses_gerados: (x.generated || []).filter(ymOk)
      }),
      from: (r) => ({ id: r.id, desc: r.descricao, amount: Number(r.valor), kind: r.tipo, group: r.grupo, categoryId: r.categoria_id || '', accountId: r.conta_id || null, cardId: r.cartao_id || null, day: r.dia, start: r.inicio, end: r.fim || null, active: r.ativo, generated: r.meses_gerados || [] })
    },
    {
      table: 'lancamentos', key: 'tx', order: 'criado_em',
      to: (t, i, ref) => ({
        id: t.id, tipo: t.kind, descricao: txt(t.desc, 120), valor: r2(Number(t.amount) || 0), data: t.date, pago: !!t.paid, pago_em: t.paidAt || null,
        conta_id: ref('accounts', t.accountId), conta_destino_id: ref('accounts', t.toAccountId), cartao_id: ref('cards', t.cardId),
        fatura: ymOk(t.invoice), categoria_id: ref('categories', t.categoryId), recorrente_id: ref('recurring', t.recurringId),
        parcela_num: t.installment ? t.installment.i : null, parcela_total: t.installment ? t.installment.n : null, parcela_grupo: t.installment ? t.installment.g : null,
        data_compra: t.purchaseDate || null, observacao: t.note ? txt(t.note, 500) : null
      }),
      from: (r) => {
        const t = { id: r.id, kind: r.tipo, desc: r.descricao, amount: Number(r.valor), date: r.data, paid: r.pago };
        if (r.pago_em) t.paidAt = r.pago_em;
        if (r.conta_id) t.accountId = r.conta_id;
        if (r.conta_destino_id) t.toAccountId = r.conta_destino_id;
        if (r.cartao_id) t.cardId = r.cartao_id;
        if (r.fatura) t.invoice = r.fatura;
        if (r.categoria_id) t.categoryId = r.categoria_id;
        if (r.recorrente_id) t.recurringId = r.recorrente_id;
        if (r.parcela_num) t.installment = { i: r.parcela_num, n: r.parcela_total, g: r.parcela_grupo };
        if (r.data_compra) t.purchaseDate = r.data_compra;
        if (r.observacao) t.note = r.observacao;
        return t;
      }
    }
  ];

  function serialize(state) {
    const ids = {};
    for (const k of ['accounts', 'cards', 'categories', 'recurring']) ids[k] = new Set((state[k] || []).map((x) => x.id));
    const ref = (k, id) => (id && ids[k].has(id) ? id : null);
    const out = {};
    for (const m of MAP) {
      out[m.table] = {};
      (state[m.key] || []).forEach((o, i) => { const row = m.to(o, i, ref); out[m.table][o.id] = { row, json: JSON.stringify(row) }; });
    }
    out.pref = JSON.stringify({ cartao_conta_no_mes: state.settings && state.settings.cardMode === 'compra' ? 'compra' : 'fatura' });
    return out;
  }
  function snapOf(ser, hasPref) {
    const o = {};
    for (const m of MAP) { o[m.table] = {}; for (const [id, v] of Object.entries(ser[m.table])) o[m.table][id] = v.json; }
    o.pref = hasPref ? ser.pref : null;
    return o;
  }
  function stateFromServer(server) {
    const st = {};
    for (const m of MAP) st[m.key] = server.rows[m.table].map(m.from);
    st.settings = { cardMode: (server.pref && server.pref.cartao_conta_no_mes) || 'fatura' };
    return st;
  }
  function hasPending() {
    if (!snap) return false;
    const ser = serialize(S);
    if (ser.pref !== snap.pref) return true;
    return MAP.some((m) => {
      const old = snap[m.table] || {}, cur = ser[m.table];
      return Object.keys(cur).some((id) => old[id] !== cur[id].json) || Object.keys(old).some((id) => !(id in cur));
    });
  }

  /* ---------- status ---------- */
  const ST = {
    off: '',
    ok: 'Tudo salvo na nuvem',
    sync: 'Sincronizando…',
    offline: 'Sem internet: salvo no aparelho, envia quando voltar',
    erro: 'Erro ao sincronizar. Toque para tentar de novo'
  };
  function setStatus(s) {
    C.status = s;
    document.querySelectorAll('.sd').forEach((el) => { el.className = `sd ${s}`; });
    document.querySelectorAll('[data-sync-text]').forEach((el) => { el.textContent = ST[s]; });
    document.querySelectorAll('.sync-btn').forEach((el) => el.setAttribute('aria-label', ST[s] || 'Sincronizar'));
  }
  function fail(e) {
    C.error = (e && (e.message || e.details)) || String(e);
    console.warn('[Bolso] sincronização:', e);
    setStatus(navigator.onLine ? 'erro' : 'offline');
  }

  /* ---------- envio (push) ---------- */
  function schedule() { clearTimeout(timer); timer = setTimeout(push, 700); }
  C.schedulePush = () => { if (C.user && snap) schedule(); };

  async function push() {
    if (!C.user || !snap) return;
    if (busy) { dirty = true; return; }
    if (!navigator.onLine) { setStatus('offline'); return; }
    busy = true;
    setStatus('sync');
    try {
      const ser = serialize(S);
      const uid = C.user.id;
      for (const m of MAP) {
        const old = snap[m.table] || {};
        const up = Object.entries(ser[m.table]).filter(([id, v]) => old[id] !== v.json).map(([, v]) => ({ ...v.row, user_id: uid }));
        for (const part of chunk(up, 400)) {
          const { error } = await sb.from(m.table).upsert(part, { onConflict: 'user_id,id' });
          if (error) throw error;
        }
      }
      for (const m of [...MAP].reverse()) {
        const old = snap[m.table] || {};
        const del = Object.keys(old).filter((id) => !(id in ser[m.table]));
        for (const part of chunk(del, 150)) {
          const { error } = await sb.from(m.table).delete().in('id', part);
          if (error) throw error;
        }
      }
      if (snap.pref !== ser.pref) {
        const { error } = await sb.from('preferencias').upsert({ user_id: uid, ...JSON.parse(ser.pref) }, { onConflict: 'user_id' });
        if (error) throw error;
      }
      snap = snapOf(ser, true);
      saveSnap();
      setStatus('ok');
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
      if (dirty) { dirty = false; schedule(); }
    }
  }

  /* ---------- recebimento (pull) ---------- */
  async function fetchAll(table, order) {
    const out = [];
    const size = 1000;
    for (let from = 0; ; from += size) {
      const { data, error } = await sb.from(table).select('*').order(order).order('id').range(from, from + size - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < size) break;
    }
    return out;
  }
  async function fetchServer() {
    const lists = await Promise.all(MAP.map((m) => fetchAll(m.table, m.order)));
    const { data: pref, error } = await sb.from('preferencias').select('cartao_conta_no_mes').maybeSingle();
    if (error) throw error;
    const rows = {};
    MAP.forEach((m, i) => { rows[m.table] = lists[i]; });
    return { rows, pref };
  }
  const localOnly = (s = {}) => ({ hide: !!s.hide, installDismissed: !!s.installDismissed, lastBackup: s.lastBackup || null, sample: !!s.sample });
  function applyServer(server) {
    const st = stateFromServer(server);
    snap = snapOf(serialize(st), !!server.pref);
    saveSnap();
    S = normalize({ ...st, settings: { ...localOnly(S.settings), cardMode: st.settings.cardMode } });
    save(); // se o normalize completou algo (ex.: categorias padrão), isso vai para a nuvem
  }
  /* Evita fixos duplicados se dois aparelhos gerarem o mesmo mês */
  function dedupeRecurring() {
    const seen = new Map(), drop = new Set();
    for (const t of S.tx) {
      if (!t.recurringId) continue;
      const k = `${t.recurringId}|${t.date.slice(0, 7)}`;
      const prev = seen.get(k);
      if (!prev) { seen.set(k, t); continue; }
      if (!prev.paid && t.paid) { drop.add(prev.id); seen.set(k, t); } else drop.add(t.id);
    }
    if (!drop.size) return false;
    S.tx = S.tx.filter((t) => !drop.has(t.id));
    return true;
  }
  function afterSync() {
    if (dedupeRecurring()) save();
    genRecurring(); // já salva (e agenda envio) se criou algo
    render();
  }
  async function syncNow() {
    if (!C.user || !snap) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    await push();
    if (C.status !== 'ok') return;
    try {
      setStatus('sync');
      const server = await fetchServer();
      if (busy || dirty || hasPending()) { schedule(); return; } // mudou algo enquanto baixava: envia antes
      applyServer(server);
      afterSync();
      if (C.status === 'sync') setStatus('ok');
    } catch (e) {
      fail(e);
    }
  }
  C.syncNow = syncNow;

  /* ---------- primeira vez neste aparelho (e migração) ---------- */
  function readLegacy() {
    const d = readJSON(LEGACY_KEY);
    if (!d) return null;
    const n = (d.accounts || []).length + (d.cards || []).length + (d.tx || []).length + (d.recurring || []).length;
    return n ? normalize(d) : null;
  }
  function archiveLegacy() {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) { localStorage.setItem('bolso.v1.migrado', raw); localStorage.removeItem(LEGACY_KEY); }
  }
  async function useLocal(state, server) {
    snap = snapOf(serialize(stateFromServer(server)), !!server.pref);
    saveSnap();
    S = normalize({ ...state, settings: { ...localOnly(state.settings), sample: false, cardMode: state.settings.cardMode || 'fatura' } });
    save();
    archiveLegacy();
    await push();
  }
  async function firstSync() {
    if (!navigator.onLine) { setStatus('offline'); toast('Conecte-se à internet para baixar seus dados'); return; }
    setStatus('sync');
    let server;
    try { server = await fetchServer(); } catch (e) { fail(e); toast('Não foi possível conectar à nuvem. Toque na nuvem para tentar de novo.'); return; }
    const legacy = readLegacy();
    const r = server.rows;
    const serverHas = r.contas.length + r.cartoes.length + r.lancamentos.length + r.recorrentes.length > 0;

    if (legacy && !serverHas) {
      let send = true;
      if (legacy.settings.sample) {
        send = (await choose('Dados deste aparelho', `Este aparelho tem ${legacy.tx.length} lançamentos, incluindo os <b>dados de exemplo</b>. Enviar tudo para a sua conta?`, [{ label: 'Enviar para a nuvem', value: true, cls: 'primary' }, { label: 'Não, eram só exemplo', value: false }])) === true;
      }
      if (send) {
        await useLocal(legacy, server);
        if (C.status === 'ok') toast('Pronto! Os dados deste aparelho agora estão na nuvem');
      } else { applyServer(server); archiveLegacy(); }
    } else if (legacy && serverHas) {
      const v = await choose('Qual versão manter?', `Este aparelho tem ${legacy.tx.length} lançamentos salvos antes do login, e sua conta na nuvem já tem ${r.lancamentos.length}.`, [{ label: 'Manter os da nuvem', value: 'cloud', cls: 'primary' }, { label: 'Substituir a nuvem pelos deste aparelho', value: 'local', cls: 'danger' }]);
      if (v === 'local') await useLocal(legacy, server);
      else { applyServer(server); archiveLegacy(); }
    } else {
      applyServer(server);
    }
    afterSync();
    if (C.status === 'sync') setStatus('ok');
  }

  /* ---------- perfil (public.perfis: nome, sobrenome, telefone) ---------- */
  const telDigits = (s) => String(s || '').replace(/\D/g, '');
  function telE164(s) {
    let d = telDigits(s);
    if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
    return d.length === 10 || d.length === 11 ? `+55${d}` : null;
  }
  function telMask(v) {
    const d = telDigits(v).slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  const telFmt = (e) => telMask(String(e || '').replace(/^\+55/, ''));
  C.telFmt = telFmt;
  function perfilFields(p = {}) {
    return `<div class="grid2">
        <label class="field"><span>Nome</span><input name="nome" autocomplete="given-name" autocapitalize="words" maxlength="60" value="${esc(p.nome || '')}"></label>
        <label class="field"><span>Sobrenome</span><input name="sobrenome" autocomplete="family-name" autocapitalize="words" maxlength="80" value="${esc(p.sobrenome || '')}"></label>
      </div>
      <label class="field"><span>Celular (WhatsApp)</span><input name="telefone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(11) 91234-5678" value="${esc(telFmt(p.telefone))}"></label>`;
  }
  function readPerfil(f) {
    const nome = f.nome.value.trim().replace(/\s+/g, ' ');
    const sobrenome = f.sobrenome.value.trim().replace(/\s+/g, ' ');
    const telefone = telE164(f.telefone.value);
    if (!nome) return 'Preencha seu nome.';
    if (!sobrenome) return 'Preencha seu sobrenome.';
    if (!telefone) return 'Celular inválido: use DDD + número, ex.: (11) 91234-5678.';
    return { nome, sobrenome, telefone };
  }
  function perfilGateHtml() {
    return `${logo}<h1>Complete seu cadastro</h1><p class="gate-sub">Falta pouco: só seu nome e celular.</p>
      <form data-form="perfil" class="glass card gate-card" novalidate>
        ${perfilFields(C.perfil || {})}
        <div class="gate-msg"></div>
        <button class="btn primary block" type="submit">Salvar e continuar</button>
      </form>`;
  }
  async function ensurePerfil() {
    if (!C.user) return;
    C.perfil = readJSON(PERFIL_KEY()) || C.perfil || null;
    if (!navigator.onLine) return;
    const { data, error } = await sb.schema('public').from('perfis').select('nome, sobrenome, telefone').maybeSingle();
    if (error) return;
    if (data) {
      C.perfil = data;
      C.needPerfil = false;
      writeJSON(PERFIL_KEY(), data);
      render();
    } else {
      C.needPerfil = true;
      if (!locked && !RECOVERY) showGate(perfilGateHtml());
    }
  }
  async function submitPerfil(f) {
    const p = readPerfil(f);
    if (typeof p === 'string') return gateMsg(f, p);
    if (!navigator.onLine) return gateMsg(f, 'Sem internet. Conecte-se para salvar o perfil.');
    busyBtn(f, true);
    const { error } = await sb.schema('public').from('perfis').upsert({ user_id: C.user.id, ...p }, { onConflict: 'user_id' });
    busyBtn(f, false);
    if (error) return gateMsg(f, `Não foi possível salvar: ${esc(error.message)}`);
    C.perfil = p;
    C.needPerfil = false;
    writeJSON(PERFIL_KEY(), p);
    if (f.closest('#gate')) hideGate(); else closeAllSheets();
    render();
    toast('Perfil salvo');
  }
  function perfilSheet() {
    openSheet(`<form data-form="perfil" novalidate>${sheetHead('Seu perfil')}
      ${perfilFields(C.perfil || {})}
      <label class="field"><span>E-mail de acesso</span><input value="${esc(C.user.email)}" disabled></label>
      <div class="gate-msg"></div>
      <div class="form-foot"><button class="btn primary block" type="submit">Salvar perfil</button></div>
    </form>`);
  }

  /* ---------- sessão ---------- */
  async function startUser(user, { fromLogin = false } = {}) {
    if (starting || (C.user && C.user.id === user.id && snap)) return;
    starting = true;
    try {
      C.user = user;
      KEY = `bolso.u.${user.id}`;
      snap = readJSON(SNAP_KEY());
      C.perfil = readJSON(PERFIL_KEY());
      S = load();
      if (RECOVERY) showGate(newPassHtml());
      else if (!fromLogin && lockCfg().credId) lock();
      else hideGate();
      render();
      if (snap) await syncNow();
      else await firstSync();
      await ensurePerfil();
    } finally {
      starting = false;
    }
  }
  function teardown() {
    clearTimeout(timer);
    if (C.user) {
      localStorage.removeItem(KEY);
      localStorage.removeItem(SNAP_KEY());
      localStorage.removeItem(LOCK_KEY());
      localStorage.removeItem(PERFIL_KEY());
    }
    C.user = null; C.perfil = null; C.needPerfil = false; snap = null; locked = false;
    KEY = LEGACY_KEY;
    S = fresh();
    closeAllSheets();
    ui.tab = 'inicio';
    setStatus('off');
    showGate(loginHtml());
  }
  async function logout() {
    const pending = hasPending();
    const ok = await confirmDlg('Sair da conta', pending
      ? 'Há alterações que ainda não chegaram na nuvem (sem internet?). Se sair agora, elas se perdem.'
      : 'Seus dados continuam salvos na nuvem. Neste aparelho eles são apagados até você entrar de novo.', 'Sair', 'danger');
    if (!ok) return;
    await sb.auth.signOut().catch(() => {});
    teardown();
  }

  /* ---------- telas de entrada / bloqueio ---------- */
  const gateEl = () => document.getElementById('gate');
  function showGate(html) {
    gateEl().innerHTML = `<div class="gate-inner">${html}</div>`;
    document.body.classList.add('gated');
  }
  function hideGate() {
    document.body.classList.remove('gated');
    gateEl().innerHTML = '';
  }
  function gateMsg(f, html, type = 'bad') {
    const box = f.querySelector('.gate-msg');
    box.innerHTML = html ? notice(type, html) : '';
  }
  function busyBtn(f, on, label) {
    const b = f.querySelector('button[type=submit]');
    if (!b) return;
    if (on) { b.dataset.label = b.textContent; b.textContent = label || 'Aguarde…'; b.disabled = true; }
    else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; }
  }
  const logo = '<div class="gate-logo" aria-hidden="true">B</div>';
  function loginHtml(msg = '') {
    return `${logo}<h1>Bolso</h1><p class="gate-sub">Suas finanças guardadas na sua conta, em qualquer aparelho.</p>
      <form data-form="login" class="glass card gate-card" autocomplete="on" novalidate>
        <div class="seg"><label><input type="radio" name="mode" value="entrar" checked><span>Entrar</span></label><label><input type="radio" name="mode" value="criar"><span>Criar conta</span></label></div>
        <label class="field"><span>E-mail</span><input name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
        <label class="field"><span>Senha</span><input name="senha" type="password" autocomplete="current-password" minlength="8" required></label>
        <div class="signup-only" hidden>${perfilFields()}</div>
        <div class="gate-msg">${msg ? notice('info', msg) : ''}</div>
        <button class="btn primary block" type="submit">Entrar</button>
        <button type="button" class="link gate-link" data-act="forgot">Esqueci minha senha</button>
      </form>
      <p class="gate-foot">Só e-mails autorizados conseguem criar conta.</p>`;
  }
  function lockHtml() {
    const email = (C.user && C.user.email) || '';
    return `${logo}<h1>Bolso bloqueado</h1><p class="gate-sub">${esc(email)}</p>
      <div class="glass card gate-card">
        <div class="gate-msg"></div>
        <button class="btn primary block" data-act="faceUnlock">${ic('faceid')} Desbloquear com Face ID</button>
        <form data-form="unlockpass" hidden style="margin-top:12px" novalidate>
          <input type="email" name="email" value="${esc(email)}" autocomplete="username" hidden>
          <label class="field"><span>Senha da conta</span><input name="senha" type="password" autocomplete="current-password" required></label>
          <button class="btn block" type="submit">Entrar com a senha</button>
        </form>
        <button type="button" class="link gate-link" data-act="passUnlock">Usar a senha</button>
      </div>
      <button type="button" class="link gate-link" data-act="logout">Sair da conta</button>`;
  }
  function newPassHtml() {
    return `${logo}<h1>Nova senha</h1><p class="gate-sub">Crie uma nova senha para ${esc((C.user && C.user.email) || 'sua conta')}.</p>
      <form data-form="newpass" class="glass card gate-card" novalidate>
        <input type="email" name="email" value="${esc((C.user && C.user.email) || '')}" autocomplete="username" hidden>
        <label class="field"><span>Nova senha</span><input name="senha" type="password" autocomplete="new-password" minlength="8" required></label>
        <div class="gate-msg"></div>
        <button class="btn primary block" type="submit">Salvar nova senha</button>
      </form>`;
  }
  function authMsg(e) {
    const m = String((e && e.message) || '').toLowerCase();
    if (!navigator.onLine || m.includes('failed to fetch') || m.includes('network')) return 'Sem internet. Conecte-se para entrar.';
    if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
    if (m.includes('not confirmed')) return 'Falta confirmar o e-mail: abra o link que enviamos para a sua caixa de entrada.';
    if (m.includes('database error saving new user')) return 'Este e-mail não tem permissão para criar conta no Bolso.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Já existe uma conta com este e-mail. Use “Entrar”.';
    if ((e && e.status === 429) || m.includes('rate limit')) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
    if (m.includes('password')) return 'Senha fraca: use pelo menos 8 caracteres, misturando letras e números.';
    return `Não foi possível concluir: ${esc((e && e.message) || 'erro desconhecido')}`;
  }
  function hashErrorMsg() {
    if (!HASH_ERROR) return '';
    history.replaceState(null, '', location.pathname);
    return HASH_ERROR === 'otp_expired'
      ? 'Esse link expirou ou já foi usado. Entre com e-mail e senha ou peça um novo link.'
      : 'Não foi possível usar esse link. Entre com e-mail e senha.';
  }

  async function submitLogin(f) {
    const mode = f.mode.value;
    const email = f.email.value.trim().toLowerCase();
    const password = f.senha.value;
    if (!email || !password) return gateMsg(f, 'Preencha e-mail e senha.');
    if (mode === 'criar' && password.length < 8) return gateMsg(f, 'Use uma senha com pelo menos 8 caracteres.');
    const perfil = mode === 'criar' ? readPerfil(f) : null;
    if (typeof perfil === 'string') return gateMsg(f, perfil);
    gateMsg(f, '');
    busyBtn(f, true);
    try {
      if (mode === 'entrar') {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return gateMsg(f, authMsg(error));
        await startUser(data.user, { fromLogin: true });
      } else {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname, data: perfil } });
        if (error) return gateMsg(f, authMsg(error));
        if (data.session) await startUser(data.user, { fromLogin: true });
        else gateMsg(f, `Conta criada! Enviamos um link de confirmação para <b>${esc(email)}</b>. Abra o link e depois entre aqui com a sua senha.`, 'info');
      }
    } finally {
      busyBtn(f, false);
    }
  }
  async function forgot(el) {
    const f = el.closest('form');
    const email = f.email.value.trim().toLowerCase();
    if (!email) return gateMsg(f, 'Digite seu e-mail acima e toque de novo em “Esqueci minha senha”.', 'info');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    gateMsg(f, error ? authMsg(error) : `Se ${esc(email)} tiver conta, enviamos um link para criar uma nova senha.`, error ? 'bad' : 'info');
  }
  async function submitNewPass(f) {
    const password = f.senha.value;
    if (password.length < 8) return gateMsg(f, 'Use uma senha com pelo menos 8 caracteres.');
    busyBtn(f, true);
    const { error } = await sb.auth.updateUser({ password });
    busyBtn(f, false);
    if (error) return gateMsg(f, authMsg(error));
    RECOVERY = false;
    history.replaceState(null, '', location.pathname);
    hideGate();
    toast('Senha alterada');
  }
  async function submitUnlockPass(f) {
    const box = f.closest('.gate-card');
    busyBtn(f, true);
    const { error } = await sb.auth.signInWithPassword({ email: C.user.email, password: f.senha.value });
    busyBtn(f, false);
    if (error) return gateMsg(box, authMsg(error));
    unlock();
  }

  /* ---------- Face ID (WebAuthn com o autenticador do próprio aparelho) ---------- */
  const b64e = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = (s) => { const p = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(p + '='.repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0)); };
  const rnd = () => crypto.getRandomValues(new Uint8Array(32));

  function lock() {
    if (!lockCfg().credId) return;
    locked = true;
    closeAllSheets();
    showGate(lockHtml());
    setTimeout(() => { if (locked) faceUnlock(true); }, 400);
  }
  function unlock() {
    locked = false;
    if (C.needPerfil) showGate(perfilGateHtml());
    else hideGate();
    render();
  }
  async function faceUnlock(auto) {
    const cfg = lockCfg();
    if (!cfg.credId) return unlock();
    try {
      await navigator.credentials.get({
        publicKey: { challenge: rnd(), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: b64d(cfg.credId), transports: ['internal'] }], userVerification: 'required', timeout: 60000 }
      });
      unlock();
    } catch (e) {
      if (!auto) {
        const card = gateEl().querySelector('.gate-card');
        if (card) gateMsg(card, 'Não deu para confirmar o Face ID. Tente de novo ou use a senha.');
      }
    }
  }
  function setFace(input) {
    if (!input.checked) {
      localStorage.removeItem(LOCK_KEY());
      toast('Bloqueio com Face ID desligado');
      return render();
    }
    if (!C.faceOK) {
      input.checked = false;
      return toast('Este aparelho não tem Face ID ou Touch ID disponível para o app');
    }
    // chamado direto no toque (o iPhone exige que seja em resposta a um gesto)
    navigator.credentials.create({
      publicKey: {
        challenge: rnd(),
        rp: { name: 'Bolso', id: location.hostname },
        user: { id: new TextEncoder().encode(C.user.id), name: C.user.email, displayName: C.user.email },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000,
        attestation: 'none'
      }
    }).then((cred) => {
      writeJSON(LOCK_KEY(), { credId: b64e(cred.rawId), em: todayISO() });
      toast('Face ID ativado');
      render();
    }).catch(() => {
      toast('Face ID não foi ativado');
      render();
    });
  }

  /* ---------- pedaços de tela usados pelo app.js ---------- */
  C.syncButton = () => `<button class="icon-btn sync-btn" data-act="syncNow" aria-label="${ST[C.status] || 'Sincronizar'}">${ic('cloud')}<span class="sd ${C.status}"></span></button>`;
  C.maisSection = () => {
    const face = !!lockCfg().credId;
    const p = C.perfil;
    const nome = p ? `${p.nome} ${p.sobrenome}` : 'Complete seu perfil';
    const ini = p ? (p.nome[0] + p.sobrenome[0]).toUpperCase() : '?';
    return `<div class="section-title" style="margin-top:6px"><h2>Sua conta</h2></div><div class="glass list menu">
      <button class="row" data-act="editPerfil"><span class="ico avatar">${esc(ini)}</span><span class="main"><b>${esc(nome)}</b><small>${esc(C.user.email)}${p ? ` · ${esc(telFmt(p.telefone))}` : ''}</small></span><span class="chev">${ic('chevR')}</span></button>
      <button class="row" data-act="syncNow"><span class="ico">${ic('cloud')}</span><span class="main"><b>Sincronização</b><small data-sync-text>${ST[C.status] || 'Conectado'}</small></span><span class="chev">${ic('repeat')}</span></button>
      <label class="row" style="cursor:pointer"><span class="ico">${ic('faceid')}</span><span class="main"><b>Bloquear com Face ID</b><small>${C.faceOK || face ? 'Pede Face ID ao abrir e depois de 1 min fora do app' : 'Indisponível neste aparelho ou navegador'}</small></span><span class="switch" style="border:0;background:none;padding:0;margin:0"><input type="checkbox" data-toggle="faceid" ${face ? 'checked' : ''} ${C.faceOK || face ? '' : 'disabled'} aria-label="Bloquear com Face ID"></span></label>
      <button class="row" data-act="logout"><span class="ico">${ic('logout')}</span><span class="main"><b>Sair da conta</b><small>Os dados continuam salvos na nuvem</small></span></button>
    </div>`;
  };

  /* ---------- ligações com o app ---------- */
  Object.assign(A, {
    syncNow: async () => {
      if (!C.user) return;
      await syncNow();
      if (C.status === 'ok') toast('Tudo sincronizado');
      else if (C.status === 'offline') toast('Sem internet: os dados ficam no aparelho e sobem quando voltar');
      else if (C.status === 'erro') toast(`Erro ao sincronizar: ${C.error}`);
    },
    logout: () => logout(),
    editPerfil: () => perfilSheet(),
    faceUnlock: () => faceUnlock(false),
    passUnlock: () => { const f = gateEl().querySelector('form[data-form=unlockpass]'); if (f) { f.hidden = false; f.senha.focus(); } },
    forgot: (el) => forgot(el)
  });
  Object.assign(FORMS, { login: submitLogin, newpass: submitNewPass, unlockpass: submitUnlockPass, perfil: submitPerfil });

  document.addEventListener('input', (e) => {
    if (e.target.name === 'telefone' && e.target.form && /^(login|perfil)$/.test(e.target.form.dataset.form)) e.target.value = telMask(e.target.value);
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.toggle === 'faceid') setFace(t);
    if (t.name === 'mode' && t.form && t.form.dataset.form === 'login') {
      const criar = t.value === 'criar';
      t.form.querySelector('button[type=submit]').textContent = criar ? 'Criar conta' : 'Entrar';
      t.form.senha.setAttribute('autocomplete', criar ? 'new-password' : 'current-password');
      t.form.querySelector('[data-act=forgot]').hidden = criar;
      t.form.querySelector('.signup-only').hidden = !criar;
      gateMsg(t.form, criar ? 'Use o e-mail autorizado e uma senha com pelo menos 8 caracteres.' : '', 'info');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!C.user) return;
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      if (snap && hasPending()) push();
    } else {
      if (lockCfg().credId && !locked && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS) lock();
      if (!starting) syncNow();
    }
  });
  window.addEventListener('online', () => { if (C.user && !starting) syncNow(); });
  window.addEventListener('offline', () => { if (C.user) setStatus('offline'); });

  /* ---------- início ---------- */
  async function boot() {
    try { C.faceOK = !!(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())); } catch (e) { C.faceOK = false; }
    const { data } = await sb.auth.getSession();
    if (data.session) await startUser(data.session.user);
    else showGate(loginHtml(hashErrorMsg()));
    sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY') { RECOVERY = true; if (session) setTimeout(() => showGate(newPassHtml()), 0); return; }
      if (ev === 'SIGNED_OUT') { if (C.user) setTimeout(teardown, 0); return; }
      if (ev === 'SIGNED_IN' && session && !C.user) setTimeout(() => startUser(session.user), 0);
    });
  }
  C._test = { serialize, stateFromServer, snapOf, MAP };
  boot();
})();
