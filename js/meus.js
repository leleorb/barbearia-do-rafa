// "Meus agendamentos": login só com o telefone (sem confirmação), lembrete no calendário e cancelamento pelo WhatsApp.
(() => {
  const B = window.BARBEARIA, C = window.Barbearia;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUS = { pending: 'Aguardando', confirmed: 'Confirmado', done: 'Concluído', cancelled: 'Cancelado', no_show: 'Faltou' };
  let lista = [];
  let pedido = 0;

  async function api(tel) {
    const r = await fetch(`${B.supabaseUrl}/rest/v1/rpc/meus_agendamentos`, {
      method: 'POST', headers: { apikey: B.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_telefone: tel })
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.message) || 'erro');
    return d;
  }

  const wa = msg => `https://wa.me/${B.whatsapp}?text=${encodeURIComponent(msg)}`;
  document.querySelectorAll('.js-wpp').forEach(a => { a.href = wa('Olá! Vim pelo site e queria tirar uma dúvida.'); a.target = '_blank'; a.rel = 'noopener'; });

  function mostra(logado) { $('login').hidden = logado; $('agenda').hidden = !logado; }

  async function carrega(tel) {
    const meu = ++pedido;
    $('quem').textContent = C.fmtTel(tel);
    $('erro-agenda').textContent = '';
    $('proximos').innerHTML = '<p class="vazio-agenda">Buscando seus horários…</p>';
    $('historico').innerHTML = ''; $('tit-hist').hidden = true; $('ajuda').hidden = true;
    try {
      const dados = await api(tel);
      if (meu === pedido) { lista = dados; desenha(); }
    } catch (e) {
      if (meu !== pedido) return;
      $('proximos').innerHTML = '';
      $('erro-agenda').textContent = 'Não consegui carregar agora. Confere a internet e tenta de novo.';
    }
  }

  function cartao(a, ativo) {
    const codigo = a.id.slice(0, 8).toUpperCase();
    const msgCancelar = `Olá! Quero cancelar meu agendamento:\n• ${a.servico} com ${a.barbeiro}\n• ${C.fmt.dia(a.starts_at)} às ${C.fmt.hora(a.starts_at)}\n• Código: ${codigo}\n• Meu número: ${C.fmtTel($('quem').dataset.tel)}`;
    return `
      <article class="cartao ${esc(a.status)}${ativo ? '' : ' passado'}" data-id="${esc(a.id)}">
        <div class="quando"><span class="hora">${esc(C.fmt.hora(a.starts_at))}</span><small>${esc(C.fmt.dia(a.starts_at))}</small></div>
        <div>
          <div class="nome">${esc(a.servico)}<span class="chip ${esc(a.status)}">${esc(STATUS[a.status] || a.status)}</span></div>
          <div class="det">com ${esc(a.barbeiro)}</div>
        </div>
        ${ativo ? `<div class="acoes">
          <button class="lembrete" type="button" data-lembrete="${esc(a.id)}">Adicionar lembrete</button>
          <a class="ruim" href="${esc(wa(msgCancelar))}" target="_blank" rel="noopener">Cancelar pelo WhatsApp</a>
        </div>` : ''}
      </article>`;
  }

  function desenha() {
    const agora = Date.now();
    const ativo = a => (a.status === 'pending' || a.status === 'confirmed') && new Date(a.ends_at).getTime() > agora;
    const proximos = lista.filter(ativo).sort((x, y) => new Date(x.starts_at) - new Date(y.starts_at));
    const hist = lista.filter(a => !ativo(a));
    $('proximos').innerHTML = proximos.length ? proximos.map(a => cartao(a, true)).join('')
      : '<p class="vazio-agenda">Você não tem horários marcados.<br><a class="btn btn-ouro" style="margin-top:1rem" href="agendamento.html">Agendar horário</a></p>';
    $('historico').innerHTML = hist.map(a => cartao(a, false)).join('');
    $('tit-hist').hidden = !hist.length;
    $('ajuda').hidden = false;
  }

  $('proximos').addEventListener('click', e => {
    const b = e.target.closest('button[data-lembrete]');
    if (!b) return;
    const a = lista.find(x => x.id === b.dataset.lembrete);
    if (!a) return;
    C.baixarIcs(a);
    const antes = b.textContent; b.textContent = 'Abra o arquivo baixado';
    setTimeout(() => { b.textContent = antes; }, 4000);
  });

  $('tel').addEventListener('input', e => { e.target.value = C.mascaraTel(e.target.value); $('erro-login').textContent = ''; });

  $('form-login').addEventListener('submit', e => {
    e.preventDefault();
    const d = $('tel').value.replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(d)) { $('erro-login').textContent = 'Confere o número, com DDD.'; return; }
    C.Login.gravar(d); abre(d);
  });

  $('sair').addEventListener('click', () => {
    C.Login.sair(); pedido++; lista = []; mostra(false); $('tel').value = ''; $('tel').focus();
  });

  function abre(tel) { $('quem').dataset.tel = tel; mostra(true); carrega(tel); }

  $('ano').textContent = new Date().getFullYear();
  const salvo = C.Login.ler();
  if (salvo) abre(salvo); else mostra(false);
})();
