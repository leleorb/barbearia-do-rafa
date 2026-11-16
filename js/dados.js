// Dados da barbearia num lugar só. As duas páginas leem daqui.
// Preço null = "consulte". Corte avulso (R$ 50) ainda não confirmado com o Rafa.
window.BARBEARIA = {
  // Supabase: chave pública (publishable), feita pra ficar no navegador. A segurança está nas regras do banco.
  supabaseUrl: 'https://kfuitldodcajyurnuhhd.supabase.co',
  supabaseKey: 'sb_publishable_0f8VxiWnRnVnRNa_rL7ybw_h12eiOi_',

  nome: 'Barbearia do Rafa',
  endereco: 'Tv. Quintino Bocaiúva, 1900, Nazaré, Belém - PA, 66045-315',

  whatsapp: '5591991642161',
  whatsappTexto: '(91) 99164-2161',

  servicos: [
    { id: 'corte',    nome: 'Corte',          desc: 'Máquina, tesoura ou degradê, do jeito que você pedir.', preco: 50,   minutos: 30 },
    { id: 'barba',    nome: 'Barba',          desc: 'Aparada, desenhada ou feita, com acabamento caprichado.',preco: null, minutos: 30 },
    { id: 'combo',    nome: 'Corte e barba',  desc: 'O serviço completo numa sentada só.',                    preco: null, minutos: 60 },
    { id: 'infantil', nome: 'Corte infantil', desc: 'Traz o pequeno junto. Paciência a gente tem de sobra.',   preco: null, minutos: 30 }
  ],

  planos: [
    { nome: 'Corte ilimitado',           preco: 99,  desc: 'Corte quantas vezes quiser no mês.',           vantagem: '10% off em produtos e outros serviços' },
    { nome: 'Corte e barba ilimitados',  preco: 140, desc: 'Corte e barba quantas vezes quiser no mês.',   vantagem: '15% off em produtos e outros serviços', destaque: true },
    { nome: 'Barba ilimitada',           preco: 93,  desc: 'Barba feita quantas vezes quiser no mês.',     vantagem: null }
  ],

  barbeiros: ['Barbeiro 1', 'Barbeiro 2'],

  // 0 = domingo. [abre, fecha] em horas.
  horarios: { 1: [12, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 18] },
  intervaloMin: 30
};

window.precoTexto = p => (p == null ? 'Consulte' : 'R$ ' + p.toLocaleString('pt-BR'));
