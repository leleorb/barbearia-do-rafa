// Funções compartilhadas pelo agendamento e por "Meus agendamentos".
(() => {
  const B = window.BARBEARIA;
  const TZ = 'America/Belem';
  const CHAVE_LOGIN = 'barbearia-rafa-login';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- telefone ----------
  // O preenchimento automático do celular manda "+55 91 9...": tira o 55 do país e zeros na frente.
  function normTel(valor) {
    let d = String(valor || '').replace(/\D/g, '');
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    d = d.replace(/^0+/, '');
    return d.slice(0, 11);
  }
  const fmtTel = valor => {
    const d = normTel(valor);
    return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
  };
  const mascaraTel = valor => {
    const d = normTel(valor);
    return d.length <= 2 ? d : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
      : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  const telValido = valor => /^\d{10,11}$/.test(normTel(valor));

  // Login por telefone, sem confirmação: guardamos só os dígitos neste aparelho.
  const Login = {
    ler() { try { const t = localStorage.getItem(CHAVE_LOGIN); return telValido(t) ? normTel(t) : null; } catch (e) { return null; } },
    gravar(tel) { try { localStorage.setItem(CHAVE_LOGIN, normTel(tel)); } catch (e) { /* sem armazenamento */ } },
    sair() { try { localStorage.removeItem(CHAVE_LOGIN); } catch (e) { /* ok */ } }
  };

  // ---------- aparelho ----------
  const ua = navigator.userAgent || '';
  const ehIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ehAndroid = /Android/i.test(ua);
  // Navegadores de dentro de apps (Instagram, Facebook, TikTok...) costumam bloquear downloads.
  const ehDentroDeApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|Snapchat|musical_ly|BytedanceWebview|TikTok/i.test(ua);

  // ---------- datas (sempre no fuso de Belém) ----------
  // formatToParts em vez de depender do formato de um idioma (que já mudou em versões do Chrome).
  const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const diaIso = d => { const p = Object.fromEntries(partes.formatToParts(new Date(d)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
  const fmt = {
    hora: iso => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)),
    dia: iso => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(iso)),
    diaIso
  };

  // ---------- lembrete no calendário ----------
  const utc = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function linksLembrete(ag) {
    const titulo = `${ag.servico} · ${B.nome}`;
    const google = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
      action: 'TEMPLATE', text: titulo, dates: `${utc(ag.starts_at)}/${utc(ag.ends_at)}`, ctz: TZ,
      location: B.endereco,
      details: `${ag.servico} com ${ag.barbeiro}. Dica: deixe a notificação do evento em 1 hora antes. Para cancelar, chame no WhatsApp ${B.whatsappTexto}.`
    }).toString();
    return { ics: `${B.supabaseUrl}/functions/v1/lembrete?id=${encodeURIComponent(ag.id)}`, google };
  }

  // Um botão só. iPhone: abre direto o "Adicionar ao Calendário" do Safari (com aviso 1h antes).
  // Android e outros: mostra as opções logo abaixo do botão.
  function lembrete(botao, ag) {
    const l = linksLembrete(ag);
    if (ehIOS && !ehDentroDeApp) { window.location.href = l.ics; return; }
    const caixa = botao.closest('[data-lembrete-caixa]') || botao.parentElement;
    let painel = caixa.parentElement.querySelector('.opcoes-lembrete');
    if (painel) { painel.remove(); botao.setAttribute('aria-expanded', 'false'); return; }
    painel = document.createElement('div');
    painel.className = 'opcoes-lembrete';
    const google = `<a class="op-lembrete principal" href="${esc(l.google)}" target="_blank" rel="noopener">
        <b>Google Agenda</b><small>Abre o Google Agenda pra salvar o horário</small></a>`;
    const arquivo = `<a class="op-lembrete${ehIOS ? ' principal' : ''}" href="${esc(l.ics)}">
        <b>${ehIOS ? 'Calendário do iPhone' : 'Outro app de calendário'}</b><small>${ehIOS ? 'Com aviso 1 hora antes' : 'Samsung, Outlook e outros. Já vem com aviso 1 hora antes'}</small></a>`;
    painel.innerHTML = `
      ${ehDentroDeApp ? '<p class="aviso-app">Você está no navegador do Instagram ou Facebook, que pode bloquear o lembrete. Se não abrir, toque em <b>⋯</b> e escolha <b>Abrir no navegador</b>.</p>' : ''}
      ${ehIOS ? arquivo + google : google + arquivo}
      ${ehIOS ? '' : '<p class="nota-lembrete">No Google Agenda, o aviso segue o padrão do seu celular. Se quiser, ajuste pra 1 hora antes ao salvar.</p>'}`;
    caixa.insertAdjacentElement('afterend', painel);
    botao.setAttribute('aria-expanded', 'true');
  }

  window.Barbearia = { Login, normTel, fmtTel, mascaraTel, telValido, linksLembrete, lembrete, fmt, TZ, ehIOS, ehAndroid, ehDentroDeApp };
})();
