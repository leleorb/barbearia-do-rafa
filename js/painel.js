// Painel do dono: login pelo Supabase Auth e agenda lida com o token do usuário.
// Quem não está na tabela "admins" faz login mas o banco devolve lista vazia (RLS).
(() => {
  const B = window.BARBEARIA;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CHAVE = 'barbearia-rafa-sessao';
  const TZ = 'America/Belem';
  const STATUS = { pending: 'Aguardando', confirmed: 'Confirmado', done: 'Concluído', cancelled: 'Cancelado', no_show: 'Faltou' };

  let sessao = null;          // { access_token, refresh_token, expira (ms), email }
  let filtro = 'hoje';
  let dataEscolhida = null;
  let pedido = 0;
  let timer = null;

  // ---------- datas (sempre no fuso de Belém) ----------
  const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });                   // 2026-11-17
  const hojeBelem = () => fmtDia.format(new Date());
  const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00-03:00'); d.setUTCDate(d.getUTCDate() + n); return fmtDia.format(d); };
  const horaTxt = iso => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const diaTxt = iso => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(iso));
  const diaDe = iso => fmtDia.format(new Date(iso));

  // ---------- sessão ----------
  function guarda() { try { sessao ? localStorage.setItem(CHAVE, JSON.stringify(sessao)) : localStorage.removeItem(CHAVE); } catch (e) { /* sem armazenamento */ } }
  function le() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }

  async function auth(corpo, tipo) {
    const r = await fetch(`${B.supabaseUrl}/auth/v1/token?grant_type=${tipo}`, {
      method: 'POST', headers: { apikey: B.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error_code || d.msg || 'erro'); e.http = r.status; throw e; }
    return { access_token: d.access_token, refresh_token: d.refresh_token, expira: Date.now() + (d.expires_in - 60) * 1000, email: (d.user && d.user.email) || '' };
  }

  async function tokenValido() {
    if (!sessao) throw new Error('sem_sessao');
    if (Date.now() < sessao.expira) return sessao.access_token;
    try {
      const nova = await auth({ refresh_token: sessao.refresh_token }, 'refresh_token');
      nova.email = nova.email || sessao.email; sessao = nova; guarda();
      return sessao.access_token;
    } catch (e) { sair(); throw new Error('sem_sessao'); }
  }

  async function api(caminho, opts = {}) {
    const token = await tokenValido();
    const r = await fetch(`${B.supabaseUrl}/rest/v1/${caminho}`, {
      method: opts.method || 'GET',
      headers: { apikey: B.supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: opts.corpo ? JSON.stringify(opts.corpo) : undefined
    });
    const d = await r.json().catch(() => null);
    if (r.status === 401) { sair(); throw new Error('sem_sessao'); }
    if (!r.ok) throw new Error((d && d.message) || 'erro');
    return d;
  }

  // ---------- telas ----------
  function mostra(logado) {
    $('login').hidden = logado; $('agenda').hidden = !logado; $('topo-acoes').hidden = !logado;
    $('quem').textContent = logado && sessao ? sessao.email : '';
  }

  function sair() {
    sessao = null; guarda(); clearInterval(timer); timer = null; mostra(false);
    $('senha').value = '';
  }

  $('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('email').value.trim(), senha = $('senha').value;
    $('erro-login').textContent = '';
    if (!email || !senha) { $('erro-login').textContent = 'Preencha e-mail e senha.'; return; }
    $('entrar').disabled = true; $('entrar').textContent = 'Entrando…';
    try {
      sessao = await auth({ email, password: senha }, 'password');
      sessao.email = sessao.email || email; guarda();
      $('senha').value = '';
      abreAgenda();
    } catch (err) {
      $('erro-login').textContent = err.http === 400 || err.http === 401 || err.http === 422
        ? 'E-mail ou senha incorretos.' : 'Não consegui entrar agora. Confere a internet e tenta de novo.';
    } finally { $('entrar').disabled = false; $('entrar').textContent = 'Entrar'; }
  });
  $('sair').addEventListener('click', sair);

  // ---------- agenda ----------
  function intervalo() {
    const hoje = hojeBelem();
    if (filtro === 'amanha') { const d = somaDias(hoje, 1); return { de: d, ate: somaDias(d, 1), titulo: 'Amanhã' }; }
    if (filtro === 'semana') return { de: hoje, ate: somaDias(hoje, 7), titulo: 'Próximos 7 dias' };
    if (filtro === 'data' && dataEscolhida) return { de: dataEscolhida, ate: somaDias(dataEscolhida, 1), titulo: dataEscolhida.split('-').reverse().join('/') };
    return { de: hoje, ate: somaDias(hoje, 1), titulo: 'Hoje' };
  }

  async function carrega() {
    const meu = ++pedido;
    const { de, ate, titulo } = intervalo();
    $('titulo-dia').textContent = titulo;
    $('data-longa').textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(de + 'T12:00:00-03:00'));
    $('erro-agenda').textContent = '';
    try {
      const q = `appointments?select=id,starts_at,status,customer_name,customer_phone,services(name),barbers(name)`
        + `&starts_at=gte.${encodeURIComponent(de + 'T00:00:00-03:00')}&starts_at=lt.${encodeURIComponent(ate + 'T00:00:00-03:00')}&order=starts_at.asc`;
      const dados = await api(q);
      if (meu === pedido) desenha(dados);
    } catch (e) {
      if (e.message === 'sem_sessao') return;
      if (meu === pedido) $('erro-agenda').textContent = 'Não consegui carregar a agenda. Tenta atualizar.';
    }
  }

  function desenha(lista) {
    const ativos = lista.filter(a => a.status === 'pending' || a.status === 'confirmed').length;
    const aguard = lista.filter(a => a.status === 'pending').length;
    $('contagem').textContent = lista.length
      ? `${lista.length} agendamento${lista.length > 1 ? 's' : ''} · ${ativos} ativo${ativos !== 1 ? 's' : ''}${aguard ? ` · ${aguard} aguardando confirmação` : ''}`
      : '';
    if (!lista.length) {
      $('lista').innerHTML = '<p class="vazio-agenda">Nenhum agendamento nesse período.</p>';
      return;
    }
    let html = '', ultimo = '';
    for (const a of lista) {
      const dia = diaDe(a.starts_at);
      if (filtro === 'semana' && dia !== ultimo) { html += `<h2 class="dia-sep">${esc(diaTxt(a.starts_at))}</h2>`; ultimo = dia; }
      const tel = String(a.customer_phone || '').replace(/\D/g, '');
      const msg = `Olá, ${a.customer_name}! Aqui é da Barbearia do Rafa. Seu horário de ${a.services ? a.services.name : 'atendimento'} está marcado para ${diaTxt(a.starts_at)} às ${horaTxt(a.starts_at)}. Te esperamos!`;
      const ativo = a.status === 'pending' || a.status === 'confirmed';
      html += `
      <article class="cartao ${esc(a.status)}" data-id="${esc(a.id)}">
        <div class="hora">${esc(horaTxt(a.starts_at))}</div>
        <div>
          <div class="nome">${esc(a.customer_name)}<span class="chip ${esc(a.status)}">${esc(STATUS[a.status] || a.status)}</span></div>
          <div class="det">${esc(a.services ? a.services.name : '—')} · ${esc(a.barbers ? a.barbers.name : '—')} · ${esc(fmtTel(tel))}</div>
        </div>
        <div class="acoes">
          ${a.status === 'pending' ? '<button class="ok" data-s="confirmed" type="button">Confirmar</button>' : ''}
          ${ativo ? '<button data-s="done" type="button">Concluído</button><button data-s="no_show" type="button">Faltou</button><button class="ruim" data-s="cancelled" type="button">Cancelar</button>' : '<button data-s="pending" type="button">Reabrir</button>'}
          ${tel.length >= 10 ? `<a href="https://wa.me/55${esc(tel)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        </div>
      </article>`;
    }
    $('lista').innerHTML = html;
  }

  const fmtTel = d => d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;

  $('lista').addEventListener('click', async e => {
    const b = e.target.closest('button[data-s]');
    if (!b) return;
    const novo = b.dataset.s, id = b.closest('.cartao').dataset.id;
    if (novo === 'cancelled' && !confirm('Cancelar esse agendamento? O horário volta a ficar livre no site.')) return;
    const todos = b.closest('.acoes').querySelectorAll('button'); todos.forEach(x => x.disabled = true);
    try {
      const r = await api(`appointments?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', corpo: { status: novo } });
      if (!r || !r.length) throw new Error('sem_permissao');
      carrega();
    } catch (err) {
      todos.forEach(x => x.disabled = false);
      if (err.message === 'sem_sessao') return;
      $('erro-agenda').textContent = err.message === 'sem_permissao' ? 'Sem permissão pra alterar. Essa conta não é de administrador.'
        : /sobreposi|conflicting|exclu/i.test(err.message) ? 'Esse horário já foi ocupado por outro agendamento, então não dá pra reabrir.'
        : 'Não consegui alterar agora. Tenta de novo.';
    }
  });

  document.querySelectorAll('.filtro').forEach(btn => btn.addEventListener('click', () => {
    filtro = btn.dataset.f; dataEscolhida = null; $('data').value = '';
    document.querySelectorAll('.filtro').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
    carrega();
  }));
  $('data').addEventListener('change', e => {
    if (!e.target.value) return;
    filtro = 'data'; dataEscolhida = e.target.value;
    document.querySelectorAll('.filtro').forEach(x => x.setAttribute('aria-pressed', 'false'));
    carrega();
  });
  $('atualizar').addEventListener('click', carrega);

  function abreAgenda() {
    mostra(true); carrega();
    clearInterval(timer); timer = setInterval(() => { if (!document.hidden) carrega(); }, 30000);
  }

  sessao = le();
  if (sessao && sessao.refresh_token) abreAgenda(); else mostra(false);
})();
