/*
 * Plano B para o CNPJ: quando a ReceitaWS não responde (limite do plano gratuito) ou não tem o CNPJ em cache,
 * abre um modal para colar o texto do "Comprovante de Inscrição e de Situação Cadastral" (Receita Federal),
 * separa os campos e preenche o formulário. Uso: window.DecamComprovante.abrir(cnpj, motivoDoErro)
 */
(() => {
  'use strict';

  /* ---------- 1. Rótulos do comprovante (já normalizados: sem acento e em maiúsculas) ----------
     '_' = rótulo conhecido cujo valor não usamos (serve só para delimitar o bloco anterior) */
  const ROTULOS = {
    'NUMERO DE INSCRICAO': 'cnpj',
    'COMPROVANTE DE INSCRICAO E DE SITUACAO CADASTRAL': '_',
    'DATA DE INSCRICAO NO CNPJ': '_',
    'NOME EMPRESARIAL': 'razao',
    'DATA DE CONSTITUICAO': '_',
    'DATA DE ABERTURA': '_',
    'TITULO DO ESTABELECIMENTO (NOME DE FANTASIA)': 'fantasia',
    'PORTE': '_',
    'CODIGO E DESCRICAO DA ATIVIDADE ECONOMICA PRINCIPAL': 'principal',
    'CODIGO E DESCRICAO DAS ATIVIDADES ECONOMICAS SECUNDARIAS': 'secundarias',
    'CODIGO E DESCRICAO DA NATUREZA JURIDICA': '_',
    'LOGRADOURO': 'logradouro',
    'NUMERO': 'numero',
    'COMPLEMENTO': 'complemento',
    'CEP': 'cep',
    'BAIRRO/DISTRITO': 'bairro',
    'MUNICIPIO': 'municipio',
    'UF': 'uf',
    'ENDERECO ELETRONICO': 'email',
    'TELEFONE': 'telefone',
    'ENTE FEDERATIVO RESPONSAVEL (EFR)': '_',
    'SITUACAO CADASTRAL': 'situacao',
    'DATA DA SITUACAO CADASTRAL': '_',
    'MOTIVO DE SITUACAO CADASTRAL': '_',
    'SITUACAO ESPECIAL': '_',
    'DATA DA SITUACAO ESPECIAL': '_',
  };

  /* Receita abrevia o tipo do logradouro ("R JESUINO DOS SANTOS") */
  const TIPOS = {
    R: 'RUA', RUA: 'RUA', AV: 'AVENIDA', AVENIDA: 'AVENIDA', AL: 'ALAMEDA', ALAMEDA: 'ALAMEDA',
    TV: 'TRAVESSA', TRAV: 'TRAVESSA', TRAVESSA: 'TRAVESSA', PC: 'PRAÇA', PCA: 'PRAÇA', PRACA: 'PRAÇA',
    ROD: 'RODOVIA', RODOVIA: 'RODOVIA', EST: 'ESTRADA', ESTRADA: 'ESTRADA', LRG: 'LARGO', LARGO: 'LARGO',
    VLA: 'VIELA', VIELA: 'VIELA', LD: 'LADEIRA', LADEIRA: 'LADEIRA', BC: 'BECO', BECO: 'BECO',
    PQ: 'PARQUE', PARQUE: 'PARQUE', VIA: 'VIA',
  };

  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const vazio = s => !s || /^\*+$/.test(s.trim());
  const dig = v => String(v || '').replace(/\D/g, '');

  /* ---------- 2. Separação do texto em campos ---------- */
  function analisar(texto) {
    const linhas = String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const marcas = [];
    linhas.forEach((l, i) => { const k = ROTULOS[norm(l)]; if (k) marcas.push({ k, i }); });

    const blocos = {};
    marcas.forEach((m, n) => {
      const fim = n + 1 < marcas.length ? marcas[n + 1].i : linhas.length;
      if (m.k !== '_' && !(m.k in blocos)) blocos[m.k] = linhas.slice(m.i + 1, fim);
    });

    const um = k => { const v = (blocos[k] || [])[0]; return vazio(v) ? '' : v.trim(); };
    return { blocos, um, reconhecidos: Object.keys(blocos).length };
  }

  function separarLogradouro(l) {
    const m = (l || '').match(/^(\S+)\s+(.+)$/);
    const tipo = m && TIPOS[m[1].toUpperCase().replace(/\.$/, '')];
    return tipo ? [tipo, m[2]] : ['', l || ''];
  }

  /* campos já no formato do formulário (name dos inputs) */
  function mapear(a) {
    const [tipoLog, logradouro] = separarLogradouro(a.um('logradouro'));
    const lista = k => (a.blocos[k] || []).filter(l => !vazio(l)).join('\n');
    const p = lista('principal'), s = lista('secundarias');
    let atividades = p ? 'ATIVIDADE PRINCIPAL:\n' + p : '';
    if (s) atividades += (atividades ? '\n\n' : '') + 'ATIVIDADES SECUNDÁRIAS:\n' + s;

    return {
      cnpj: a.um('cnpj'),
      situacao: a.um('situacao'),
      campos: {
        razao: a.um('razao'), fantasia: a.um('fantasia'),
        tipoLog, logradouro, numero: a.um('numero'), complemento: a.um('complemento'),
        bairro: a.um('bairro'), municipio: a.um('municipio'), uf: a.um('uf'), cep: a.um('cep'),
        email: a.um('email').toLowerCase(), telefone: a.um('telefone'),
        atividades,
      },
    };
  }

  /* ---------- 3. Modal e preenchimento do formulário ---------- */
  const form = document.getElementById('decam');
  const dlg = document.getElementById('dlgCnpj');
  const txt = document.getElementById('txtCnpj');
  const msg = document.getElementById('msgCnpj');
  const motivo = document.getElementById('cnpjMotivo');
  let esperado = '';

  const aviso = (m, cls = '') => { msg.textContent = m; msg.className = cls; };

  function definir(nome, valor) {
    const el = form.elements[nome];
    if (!el) return;
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true })); // reaproveita máscaras e autoajuste do decam.js
  }

  function marcar(nome, valor) {
    const r = form.querySelector(`input[name="${nome}"][value="${valor}"]`);
    if (r) r.checked = true;
  }

  function processar() {
    const a = analisar(txt.value);
    if (a.reconhecidos < 5) return aviso('Não reconheci o texto. Copie a página inteira do comprovante e cole de novo.', 'err');

    const d = mapear(a);
    if (dig(d.cnpj) && esperado && dig(d.cnpj) !== esperado)
      return aviso(`O CNPJ do texto (${d.cnpj}) é diferente do informado no formulário.`, 'err');

    Object.entries(d.campos).forEach(([k, v]) => definir(k, v));
    marcar('contrib', 'pj');
    marcar('tpend', 'estabelecimento');

    const st = document.getElementById('status');
    if (st) {
      const ok = !d.situacao || norm(d.situacao) === 'ATIVA';
      st.textContent = ok ? 'Dados preenchidos a partir do comprovante da Receita Federal.'
                          : `Dados preenchidos. Atenção: situação cadastral ${d.situacao}.`;
      st.className = ok ? 'ok' : 'warn';
    }
    dlg.close();
  }

  function abrir(cnpj, erro) {
    esperado = dig(cnpj);
    txt.value = '';
    aviso('');
    motivo.textContent = erro ? `A consulta automática não retornou dados (${erro}).` : '';
    if (!dlg.open) dlg.showModal();
    txt.focus();
  }

  document.getElementById('btnCnpjPreencher').addEventListener('click', processar);
  document.getElementById('btnCnpjManual').addEventListener('click', () => {
    dlg.close();
    const st = document.getElementById('status');
    if (st) { st.textContent = 'Preencha os dados da empresa manualmente.'; st.className = ''; }
  });
  txt.addEventListener('paste', () => setTimeout(processar, 0)); // ao colar, já processa

  window.DecamComprovante = { abrir, analisar, mapear };
})();
