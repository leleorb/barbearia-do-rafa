// Menu do celular (☰): um painel com todos os links, montado aqui para as três páginas usarem o mesmo.
(() => {
  const B = window.BARBEARIA || {};
  const wrap = document.querySelector('.topo .wrap');
  if (!wrap) return;

  const caminho = location.pathname.split('/').pop();
  const naHome = caminho === '' || caminho === 'index.html';
  const ancora = id => (naHome ? '#' : 'index.html#') + id;

  const itens = [
    !naHome && { rotulo: 'Início', href: 'index.html' },
    { rotulo: 'Serviços', href: ancora('servicos') },
    { rotulo: 'Planos', href: ancora('planos') },
    { rotulo: 'Fotos', href: ancora('fotos') },
    { rotulo: 'Onde estamos', href: ancora('onde') },
    { rotulo: 'Meus agendamentos', href: 'meus-agendamentos.html', atual: caminho === 'meus-agendamentos.html' }
  ].filter(Boolean);

  const wpp = B.whatsapp ? `https://wa.me/${B.whatsapp}?text=${encodeURIComponent('Olá! Vim pelo site e queria tirar uma dúvida.')}` : '#';

  // Botão ☰
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'menu-btn';
  botao.setAttribute('aria-controls', 'menu-movel');
  botao.setAttribute('aria-expanded', 'false');
  botao.setAttribute('aria-label', 'Abrir menu');
  botao.innerHTML = '<span></span><span></span><span></span>';
  wrap.appendChild(botao);

  // Painel
  const painel = document.createElement('nav');
  painel.id = 'menu-movel';
  painel.className = 'menu-movel';
  painel.setAttribute('aria-label', 'Menu');
  painel.hidden = true;
  painel.innerHTML = `
    <ul>${itens.map(i => `<li><a href="${i.href}"${i.atual ? ' aria-current="page"' : ''}>${i.rotulo}</a></li>`).join('')}</ul>
    <a class="btn btn-ouro menu-cta" href="agendamento.html"${caminho === 'agendamento.html' ? ' aria-current="page"' : ''}>Agendar horário</a>
    <div class="menu-rodape">
      <a href="${wpp}" target="_blank" rel="noopener">WhatsApp</a>
      <a href="https://www.instagram.com/a.barbeariadorafa/" target="_blank" rel="noopener">Instagram</a>
    </div>`;
  document.body.appendChild(painel);

  const aberto = () => !painel.hidden;
  function abrir() {
    painel.hidden = false;
    document.documentElement.classList.add('menu-aberto');
    botao.setAttribute('aria-expanded', 'true');
    botao.setAttribute('aria-label', 'Fechar menu');
    const primeiro = painel.querySelector('a');
    if (primeiro) primeiro.focus({ preventScroll: true });
  }
  function fechar(devolverFoco) {
    if (!aberto()) return;
    painel.hidden = true;
    document.documentElement.classList.remove('menu-aberto');
    botao.setAttribute('aria-expanded', 'false');
    botao.setAttribute('aria-label', 'Abrir menu');
    if (devolverFoco) botao.focus({ preventScroll: true });
  }

  botao.addEventListener('click', () => (aberto() ? fechar(true) : abrir()));
  // Tocar num link fecha antes da navegação (a rolagem até a seção acontece logo depois).
  painel.addEventListener('click', e => { if (e.target.closest('a')) fechar(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && aberto()) fechar(true); });
  // Virou tela grande (girou o tablet, por exemplo): fecha o menu do celular.
  const grande = window.matchMedia('(min-width: 900px)');
  const aoMudar = () => { if (grande.matches) fechar(false); };
  if (grande.addEventListener) grande.addEventListener('change', aoMudar); else grande.addListener(aoMudar);
  // Voltar do navegador com o menu aberto (página guardada em cache): garante tudo fechado.
  window.addEventListener('pageshow', () => fechar(false));
})();
