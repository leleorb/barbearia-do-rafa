// Agendamento: lê os horários livres e grava a reserva no Supabase.
// Se o banco não responder, cai no modo WhatsApp (monta o pedido e abre a conversa).
(() => {
  const B = window.BARBEARIA;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SEM_PREF = '';
  const DIAS_A_FRENTE = 14;
  const ANTECEDENCIA_MIN = 30;

  const semana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const semanaLonga = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const p2 = n => String(n).padStart(2, '0');
  const isoDia = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const deIso = s => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
  const hm = min => `${p2(Math.floor(min / 60))}:${p2(min % 60)}`;

  const est = { servico: null, barbeiro: SEM_PREF, dia: null, hora: null };
  let online = true;          // false = modo WhatsApp
  let barbeiros = [];         // [{id, name}]
  let pedidoHoras = 0;        // descarta respostas atrasadas
  let enviando = false;

  // ---------- Supabase (REST puro, sem biblioteca) ----------
  async function api(caminho, corpo) {
    const r = await fetch(`${B.supabaseUrl}/rest/v1/${caminho}`, {
      method: corpo ? 'POST' : 'GET',
      headers: { apikey: B.supabaseKey, 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
    });
    const dados = await r.json().catch(() => null);
    if (!r.ok) { const e = new Error((dados && dados.message) || 'erro'); e.http = r.status; throw e; }
    return dados;
  }

  const ERROS = {
    horario_ocupado: 'Esse horário acabou de ser ocupado. Escolhe outro, por favor.',
    horario_passado: 'Esse horário já passou. Escolhe outro.',
    fora_do_expediente: 'Esse horário está fora do expediente.',
    fechado: 'A barbearia não abre nesse dia.',
    nome_invalido: 'Confere teu nome.',
    telefone_invalido: 'Confere teu WhatsApp, com DDD.',
    limite_por_telefone: 'Esse número já tem 5 horários marcados. Fala com a gente no WhatsApp.',
    muitas_reservas_tente_depois: 'Muita gente agendando agora. Tenta de novo em alguns minutos.',
    muito_distante: 'Dá pra agendar com até 30 dias de antecedência.'
  };

  const radio = (nome, valor, html, marcado, desativado) => `
    <label class="opcao"><input type="radio" name="${nome}" value="${esc(valor)}"${marcado ? ' checked' : ''}${desativado ? ' disabled' : ''}><span class="cx">${html}</span></label>`;

  // 1. Serviços
  const pedido = new URLSearchParams(location.search).get('servico');
  if (B.servicos.some(s => s.id === pedido)) est.servico = pedido;
  $('servicos').innerHTML = B.servicos.map(s => radio('servico', s.id,
    `<span><b>${esc(s.nome)}</b><small>${s.minutos} min</small></span><span class="preco">${precoTexto(s.preco)}</span>`,
    s.id === est.servico)).join('');

  // 2. Barbeiros (do banco; no modo WhatsApp, os nomes de dados.js)
  function desenhaBarbeiros() {
    const lista = [{ id: SEM_PREF, name: 'Sem preferência' }, ...barbeiros];
    $('barbeiros').innerHTML = lista.map(b => radio('barbeiro', b.id,
      `<span><b>${esc(b.name)}</b>${b.id === SEM_PREF ? '<small>Quem estiver livre primeiro</small>' : ''}</span>`,
      b.id === est.barbeiro)).join('');
  }

  // 3. Dias abertos nas próximas duas semanas
  const diasAbertos = [];
  for (let i = 0, d = new Date(); i < DIAS_A_FRENTE; i++) {
    const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    if (B.horarios[dia.getDay()]) diasAbertos.push(dia);
  }
  const hojeIso = isoDia(new Date());
  $('dias').innerHTML = diasAbertos.map(d => radio('dia', isoDia(d),
    `<small>${isoDia(d) === hojeIso ? 'hoje' : semana[d.getDay()]}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small>`,
    false)).join('');

  // 4. Horários
  function horariosLocais() {
    const d = deIso(est.dia);
    const [abre, fecha] = B.horarios[d.getDay()];
    const dur = (B.servicos.find(s => s.id === est.servico) || { minutos: B.intervaloMin }).minutos;
    const agora = new Date();
    const minimo = est.dia === hojeIso ? agora.getHours() * 60 + agora.getMinutes() + ANTECEDENCIA_MIN : 0;
    const lista = [];
    for (let m = abre * 60; m + dur <= fecha * 60; m += B.intervaloMin) if (m >= minimo) lista.push(hm(m));
    return lista;
  }

  function mostraHoras(lista) {
    if (lista && !lista.includes(est.hora)) est.hora = null;
    $('horas').innerHTML = !lista
      ? `<p class="vazio">${est.dia ? 'Escolhe o serviço primeiro.' : 'Escolhe o dia primeiro.'}</p>`
      : lista.length
        ? lista.map(h => radio('hora', h, h, h === est.hora)).join('')
        : '<p class="vazio">Sem horário livre nesse dia. Escolhe outro dia ou chega direto, que a gente encaixa.</p>';
    atualiza();
  }

  async function carregaHoras() {
    if (!est.dia || !est.servico) return mostraHoras(null);
    if (!online) return mostraHoras(horariosLocais());
    const meu = ++pedidoHoras;
    $('horas').innerHTML = '<p class="vazio">Buscando horários livres…</p>';
    try {
      const r = await api('rpc/horarios_livres', { p_dia: est.dia, p_servico: est.servico, p_barbeiro: est.barbeiro || null });
      if (meu === pedidoHoras) mostraHoras(r.map(x => x.hora));
    } catch (e) {
      if (meu !== pedidoHoras) return;
      entraModoWhatsApp();
      mostraHoras(horariosLocais());
    }
  }

  function entraModoWhatsApp() {
    if (!online) return;
    online = false;
    barbeiros = B.barbeiros.map(n => ({ id: n, name: n }));
    if (est.barbeiro && !barbeiros.some(b => b.id === est.barbeiro)) est.barbeiro = SEM_PREF;
    desenhaBarbeiros();
    $('enviar').textContent = 'Confirmar pelo WhatsApp';
    $('obs').textContent = 'O horário fica reservado quando a barbearia responder tua mensagem. Assinante? Avisa na conversa.';
  }

  // Resumo e validação
  const servicoAtual = () => B.servicos.find(s => s.id === est.servico);
  const barbeiroNome = () => (barbeiros.find(b => b.id === est.barbeiro) || { name: 'Sem preferência' }).name;
  const telDigitos = () => $('tel').value.replace(/\D/g, '');
  function faltando() {
    const f = [];
    if (!est.servico) f.push('o serviço');
    if (!est.dia) f.push('o dia');
    if (!est.hora) f.push('o horário');
    if ($('nome').value.trim().length < 2) f.push('teu nome');
    if (!/^\d{10,11}$/.test(telDigitos())) f.push('teu WhatsApp com DDD');
    return f;
  }
  const diaTexto = () => { const d = deIso(est.dia); return `${semanaLonga[d.getDay()]}, ${p2(d.getDate())}/${p2(d.getMonth() + 1)}`; };
  function atualiza() {
    if (!$('r-servico')) return; // já mostrou a confirmação
    const s = servicoAtual();
    $('r-servico').textContent = s ? s.nome : '—';
    $('r-barbeiro').textContent = barbeiroNome();
    $('r-dia').textContent = est.dia ? diaTexto() : '—';
    $('r-hora').textContent = est.hora || '—';
    $('r-preco').textContent = s ? precoTexto(s.preco) : '—';
    $('enviar').setAttribute('aria-disabled', faltando().length || enviando ? 'true' : 'false');
  }

  $('tel').addEventListener('input', e => {
    const d = telDigitos().slice(0, 11);
    e.target.value = d.length <= 2 ? d
      : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
      : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
      : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  });

  try {
    const salvo = JSON.parse(localStorage.getItem('barbearia-rafa-cliente') || '{}');
    if (salvo.nome) $('nome').value = salvo.nome;
    if (salvo.tel) $('tel').value = salvo.tel;
  } catch (e) { /* sem armazenamento */ }

  $('form').addEventListener('change', e => {
    const { name, value } = e.target;
    if (!(name in est)) return;
    est[name] = value;
    if (name !== 'hora') carregaHoras();
    $('falta').textContent = '';
    atualiza();
  });
  $('form').addEventListener('input', () => { $('falta').textContent = ''; atualiza(); });

  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    if (enviando) return;
    const f = faltando();
    if (f.length) { $('falta').textContent = 'Falta ' + f.join(', ').replace(/, ([^,]*)$/, ' e $1') + '.'; return; }
    const nome = $('nome').value.trim();
    try { localStorage.setItem('barbearia-rafa-cliente', JSON.stringify({ nome, tel: $('tel').value })); } catch (err) { /* ok */ }
    if (!online) return abreWhatsApp(mensagem('Olá! Quero agendar um horário pelo site:'));

    enviando = true; atualiza();
    $('enviar').textContent = 'Reservando…';
    try {
      await api('rpc/criar_agendamento', {
        p_servico: est.servico, p_barbeiro: est.barbeiro || null, p_dia: est.dia,
        p_hora: est.hora, p_nome: nome, p_telefone: telDigitos()
      });
      confirmado();
    } catch (err) {
      $('enviar').textContent = 'Confirmar agendamento';
      if (ERROS[err.message]) {
        $('falta').textContent = ERROS[err.message];
        if (/horario|fora|fechado/.test(err.message)) carregaHoras();
      } else {
        $('falta').textContent = 'Não consegui reservar agora. Tenta de novo, ou confirma pelo WhatsApp.';
        entraModoWhatsApp();
      }
    } finally {
      enviando = false; atualiza();
    }
  });

  function mensagem(cabeca) {
    const s = servicoAtual();
    return [cabeca,
      `• Serviço: ${s.nome}${s.preco != null ? ` (${precoTexto(s.preco)})` : ''}`,
      `• Barbeiro: ${barbeiroNome()}`,
      `• Dia: ${diaTexto()}`,
      `• Horário: ${est.hora}`,
      `• Nome: ${$('nome').value.trim()}`,
      `• WhatsApp: ${$('tel').value}`].join('\n');
  }
  const abreWhatsApp = msg => window.open(`https://wa.me/${B.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');

  function confirmado() {
    const msg = mensagem('Olá! Acabei de agendar pelo site:');
    $('form').innerHTML = `
      <div class="ok" role="status">
        <p class="sobre">Horário reservado</p>
        <h2>Fechado, ${esc($('nome').value.trim().split(' ')[0])}! <em>Te esperamos.</em></h2>
        <dl>
          <div><dt>Serviço</dt><dd>${esc(servicoAtual().nome)}</dd></div>
          <div><dt>Dia</dt><dd>${esc(diaTexto())}</dd></div>
          <div><dt>Horário</dt><dd>${esc(est.hora)}</dd></div>
          <div><dt>Barbeiro</dt><dd>${esc(barbeiroNome())}</dd></div>
        </dl>
        <p>Se precisar desmarcar ou mudar, é só chamar no WhatsApp.</p>
        <div class="acoes">
          <a class="btn btn-terra" href="https://wa.me/${B.whatsapp}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Avisar no WhatsApp</a>
          <a class="btn btn-linha-escura" href="index.html">Voltar ao início</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Início: tenta o banco; se falhar, modo WhatsApp
  desenhaBarbeiros();
  mostraHoras(null);
  $('enviar').textContent = 'Confirmar agendamento';
  api('barbers?select=id,name&active=eq.true&order=name')
    .then(r => { barbeiros = r; desenhaBarbeiros(); atualiza(); })
    .catch(() => entraModoWhatsApp());
  if (est.dia) carregaHoras();
  $('ano').textContent = new Date().getFullYear();
})();
