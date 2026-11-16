// Funções compartilhadas pelo agendamento e por "Meus agendamentos".
(() => {
  const B = window.BARBEARIA;
  const TZ = 'America/Belem';
  const CHAVE_LOGIN = 'barbearia-rafa-login';

  // Login por telefone, sem confirmação: guardamos só os dígitos neste aparelho.
  const Login = {
    ler() { try { const t = localStorage.getItem(CHAVE_LOGIN); return /^\d{10,11}$/.test(t || '') ? t : null; } catch (e) { return null; } },
    gravar(tel) { try { localStorage.setItem(CHAVE_LOGIN, String(tel).replace(/\D/g, '')); } catch (e) { /* sem armazenamento */ } },
    sair() { try { localStorage.removeItem(CHAVE_LOGIN); } catch (e) { /* ok */ } }
  };

  const fmtTel = d => {
    d = String(d || '').replace(/\D/g, '');
    return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
  };
  const mascaraTel = valor => {
    const d = String(valor).replace(/\D/g, '').slice(0, 11);
    return d.length <= 2 ? d : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
      : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  // ---------- calendário (.ics) com lembrete 1h antes ----------
  const utc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escIcs = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  // Linhas do .ics têm no máximo 75 bytes; o que passar disso continua na linha seguinte, começando com um espaço.
  const dobra = linha => {
    const enc = new TextEncoder(); const dec = new TextDecoder();
    if (enc.encode(linha).length <= 75) return linha;
    const partes = []; let atual = '';
    for (const ch of linha) {
      const limite = partes.length ? 74 : 75;
      if (enc.encode(atual + ch).length > limite) { partes.push(atual); atual = ch; } else atual += ch;
    }
    partes.push(atual);
    return partes.map((p, i) => (i ? ' ' : '') + p).join('\r\n');
  };

  function gerarIcs(ag) {
    const ini = new Date(ag.starts_at), fim = new Date(ag.ends_at);
    const titulo = `${ag.servico} · ${B.nome}`;
    const linhas = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Barbearia do Rafa//Agendamento//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${ag.id}@barbearia-do-rafa`,
      `DTSTAMP:${utc(new Date())}`,
      `DTSTART:${utc(ini)}`, `DTEND:${utc(fim)}`,
      `SUMMARY:${escIcs(titulo)}`,
      `LOCATION:${escIcs(B.endereco)}`,
      `DESCRIPTION:${escIcs(`${ag.servico} com ${ag.barbeiro}. Se precisar cancelar, chame no WhatsApp ${B.whatsappTexto}.`)}`,
      'STATUS:CONFIRMED', 'TRANSP:OPAQUE',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escIcs(`Daqui a 1 hora: ${titulo}`)}`, 'TRIGGER:-PT1H', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return linhas.map(dobra).join('\r\n') + '\r\n';
  }

  function baixarIcs(ag) {
    const blob = new Blob([gerarIcs(ag)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lembrete-barbearia.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const fmt = {
    hora: iso => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)),
    dia: iso => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(iso)),
    diaIso: iso => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))
  };

  window.Barbearia = { Login, fmtTel, mascaraTel, gerarIcs, baixarIcs, fmt, TZ };
})();
