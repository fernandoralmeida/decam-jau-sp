(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const form = $('#decam'), dlg = $('#dlg'), frm = $('#frmSocio'), statusEl = $('#status');
  const MAX_SOCIOS = 6;
  const STATUS = ['Sem Alteração', 'Com Alteração', 'Inclusão', 'Exclusão'];
  let socios = [], editando = -1, ultimoCnpj = '', ultimoCep = '', ultimoCepSig = '';

  /* ---------- utilitários ---------- */
  const dig = v => String(v || '').replace(/\D/g, '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const setStatus = (msg, cls = '') => { statusEl.textContent = msg; statusEl.className = cls; };
  const autoSize = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
  const put = (name, val) => {
    const el = form.elements[name];
    if (!el || val == null) return;
    el.value = val;
    if (el.tagName === 'TEXTAREA') autoSize(el);
  };
  const setRadio = (name, val) => {
    const r = form.querySelector(`input[name="${name}"][value="${val}"]`);
    if (r) r.checked = true;
  };

  /* ---------- máscaras ---------- */
  const mask = {
    cpf: v => dig(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
    cnpj: v => dig(v).slice(0, 14).replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2'),
    cpfcnpj: v => (dig(v).length > 11 ? mask.cnpj(v) : mask.cpf(v)),
    cep: v => dig(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
    date: v => dig(v).slice(0, 8).replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2'),
    phone: v => dig(v).slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'),
  };

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset && t.dataset.mask) t.value = mask[t.dataset.mask](t.value);
    if (t.tagName === 'TEXTAREA') autoSize(t);
    if (t.name === 'doc' && form.contains(t)) onDoc(t.value);
    if (t.name === 'cep' && frm.contains(t)) onCepSocio(t.value);
    if (t.name === 'sigCep' && form.contains(t)) onCepSig(t.value);
  });

  /* ---------- CPF (manual) x CNPJ (ReceitaWS) ---------- */
  function cnpjValido(c) {
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const calc = n => {
      let s = 0, p = n - 7;
      for (let i = 0; i < n; i++) { s += c[i] * p--; if (p < 2) p = 9; }
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) == c[12] && calc(13) == c[13];
  }

  function onDoc(v) {
    const d = dig(v);
    if (d.length === 11) { setRadio('contrib', 'pf'); setStatus('CPF: preencha os dados manualmente.'); }
    if (d.length === 14) {
      if (!cnpjValido(d)) return setStatus('CNPJ inválido.', 'err');
      setRadio('contrib', 'pj');
      if (d !== ultimoCnpj) { ultimoCnpj = d; buscarCnpj(d); }
    }
  }

  // A ReceitaWS não envia CORS no fetch; ela atende JSONP (?callback=), que funciona em qualquer origem (inclusive file://)
  function jsonp(url, ms = 15000) {
    return new Promise((resolve, reject) => {
      const cb = '__rws' + Date.now();
      const s = document.createElement('script');
      const fim = () => { clearTimeout(t); delete window[cb]; s.remove(); };
      const t = setTimeout(() => { fim(); reject(new Error('tempo esgotado')); }, ms);
      window[cb] = d => { fim(); resolve(d); };
      s.onerror = () => { fim(); reject(new Error('falha de rede')); };
      s.src = `${url}?callback=${cb}`;
      document.head.appendChild(s);
    });
  }

  async function consultaReceita(cnpj) {
    const url = `https://www.receitaws.com.br/v1/cnpj/${cnpj}`;
    try { return await jsonp(url); }
    catch (e) { const r = await fetch(url); return r.json(); } // fallback (funciona se o domínio tiver CORS liberado)
  }

  async function buscarCnpj(cnpj) {
    setStatus('Consultando CNPJ na ReceitaWS…');
    try {
      const d = await consultaReceita(cnpj);
      if (d.status === 'ERROR') throw new Error(d.message || 'erro na consulta');
      if (dig(form.elements.doc.value) !== cnpj) return; // usuário já mudou o documento
      preencher(d);
      if (d.situacao && d.situacao !== 'ATIVA') setStatus(`Dados carregados. Atenção: situação cadastral ${d.situacao}.`, 'warn');
      else setStatus('Dados do CNPJ carregados.', 'ok');
    } catch (e) {
      ultimoCnpj = '';
      setStatus(`Não foi possível consultar o CNPJ (${e.message}). Preencha manualmente.`, 'err');
    }
  }

  function preencher(d) {
    const lst = a => (a || []).map(x => `${x.code} - ${x.text}`).join('\n');
    const log = (d.logradouro || '').trim();
    const m = log.match(/^(RUA|AVENIDA|AV\.?|TRAVESSA|TRAV\.?|ALAMEDA|PRAÇA|PRACA|RODOVIA|ESTRADA|LARGO|VIA|VIELA|LADEIRA|BECO|PARQUE)\s+(.+)$/i);

    put('razao', d.nome);
    put('fantasia', d.fantasia);
    setRadio('contrib', 'pj');
    setRadio('tpend', 'estabelecimento');
    put('tipoLog', m ? m[1].toUpperCase() : '');
    put('logradouro', m ? m[2] : log);
    put('numero', d.numero);
    put('complemento', d.complemento);
    put('bairro', d.bairro);
    put('municipio', d.municipio);
    put('uf', d.uf);
    put('cep', mask.cep(d.cep));
    put('email', (d.email || '').toLowerCase());
    put('telefone', d.telefone);
    if (d.capital_social != null && d.capital_social !== '')
      put('capital', Number(d.capital_social).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

    let t = 'ATIVIDADE PRINCIPAL:\n' + lst(d.atividade_principal);
    if (d.atividades_secundarias && d.atividades_secundarias.length)
      t += '\n\nATIVIDADES SECUNDÁRIAS:\n' + lst(d.atividades_secundarias);
    put('atividades', t);
  }

  /* ---------- sócios ---------- */
  function blocoSocio(i) {
    const ok = i < socios.length, s = ok ? socios[i] : {};
    const cbs = STATUS.map((n, k) => `<div class="st-i"><span class="cb ${ok && s.status === k ? 'on' : ''}"></span>${n}</div>`).join('');
    const c = (cls, l, v) => `<div class="c ${cls}"><b>${l}</b> ${esc(v)}</div>`;
    const acoes = ok ? `<div class="acoes no-print no-m-p"><button type="button" data-edit="${i}">Editar</button><button type="button" data-del="${i}">Remover</button></div>` : '';
    return `<div class="socio">${acoes}<div class="st">${cbs}</div><div class="dd">
      <div class="row">${c('s12', 'NOME:', s.nome)}</div>
      <div class="row">${c('s10', 'Endereço:', s.endereco)}${c('s2', 'Nº:', s.numero)}${c('s6', 'Bairro:', s.bairro)}${c('s6', 'Cidade:', s.cidade)}</div>
      <div class="row">${c('s3', 'CEP:', s.cep)}${c('s5', 'CPF:', s.cpf)}${c('s4', 'RG:', s.rg)}</div>
      <div class="row">${c('s4', 'Telefone:', s.telefone)}${c('s8', 'E-mail:', s.email)}</div>
    </div></div>`;
  }

  function renderSocios() {
    $('#socios').innerHTML = Array.from({ length: MAX_SOCIOS }, (_, i) => blocoSocio(i)).join('');
    $('#btnAddSocio').disabled = socios.length >= MAX_SOCIOS;
  }

  const cepMsg = (m, cls = '') => { const el = $('#cepMsg'); el.textContent = m; el.className = cls; };
  const cepMsgSig = (m, cls = '') => { const el = $('#cepMsgSig'); el.textContent = m; el.className = cls; };

  async function onCepSocio(v) {
    const c = dig(v);
    if (c.length < 8) { ultimoCep = ''; return cepMsg(''); }
    if (c === ultimoCep) return;
    ultimoCep = c;
    cepMsg('Buscando CEP…');
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (dig(frm.elements.cep.value) !== c) return;
      if (d.erro) { ultimoCep = ''; return cepMsg('CEP não encontrado.', 'err'); }
      frm.elements.endereco.value = d.logradouro || '';
      frm.elements.bairro.value = d.bairro || '';
      frm.elements.cidade.value = d.localidade || '';
      frm.elements.uf.value = d.uf || '';
      cepMsg('Endereço preenchido.', 'ok');
      frm.elements.numero.focus();
    } catch (e) {
      ultimoCep = '';
      cepMsg('Falha na consulta; preencha manualmente.', 'err');
    }
  }

  async function onCepSig(v) {
    const c = dig(v);
    if (c.length < 8) { ultimoCepSig = ''; return cepMsgSig(''); }
    if (c === ultimoCepSig) return;
    ultimoCepSig = c;
    cepMsgSig('Buscando CEP…');
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (dig(form.elements.sigCep.value) !== c) return;
      if (d.erro) { ultimoCepSig = ''; form.elements.sigEnd.value = ''; form.elements.sigBairro.value = ''; form.elements.sigCidade.value = ''; return cepMsgSig('CEP não encontrado.', 'err'); }
      form.elements.sigEnd.value = d.logradouro || '';
      form.elements.sigBairro.value = d.bairro || '';
      form.elements.sigCidade.value = d.localidade || '';
      cepMsgSig('', 'ok');
      form.elements.sigNum.focus();
    } catch (e) {
      ultimoCepSig = '';
      cepMsgSig('Falha na consulta; preencha manualmente.', 'err');
    }
  }

  function abrirModal(idx) {
    editando = idx;
    frm.reset();
    ultimoCep = ''; cepMsg('');
    if (idx >= 0) Object.entries(socios[idx]).forEach(([k, v]) => { if (frm.elements[k]) frm.elements[k].value = v; });
    dlg.showModal();
    frm.elements.nome.focus();
  }

  frm.addEventListener('submit', e => {
    e.preventDefault();
    const s = Object.fromEntries(new FormData(frm));
    s.status = Number(s.status);
    if (editando >= 0) socios[editando] = s; else socios.push(s);
    renderSocios();
    dlg.close();
  });
  $('#btnCancel').addEventListener('click', () => dlg.close());
  $('#btnAddSocio').addEventListener('click', () => abrirModal(-1));
  $('#socios').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) abrirModal(+ed.dataset.edit);
    if (del && confirm('Remover este sócio?')) { socios.splice(+del.dataset.del, 1); renderSocios(); }
  });

  /* ---------- PDF (impressão do navegador, layout A4 via CSS) ---------- */
  const tituloOriginal = document.title;
  window.addEventListener('beforeprint', () => {
    $$('textarea').forEach(autoSize);
    const nome = (form.elements.razao.value || '').trim();
    document.title = 'DECAM' + (nome ? ' - ' + nome : '');
  });
  window.addEventListener('afterprint', () => { document.title = tituloOriginal; });

  // $('#btnPdf').addEventListener('click', () => {
  //   if (!form.elements.razao.value.trim() && !confirm('Razão Social/Nome está vazio. Gerar o PDF assim mesmo?')) return;
  //   window.print(); // no diálogo, escolha "Salvar como PDF"
  // });

  /* ---------- Declaração MEI (isenção do Corpo de Bombeiros) ---------- */
  const val = n => ((form.elements[n] && form.elements[n].value) || '').trim();

  function perguntaMei() {
    return new Promise(resolve => {
      const d = $('#dlgMei');
      d.returnValue = '';
      d.addEventListener('close', () => resolve(d.returnValue), { once: true });
      d.showModal();
    });
  }

  function paginaMei() {
    const s = socios[0] || {};                 // dados do 1º sócio
    const t = val('tipo');                     // inscrição / alteração / renovação da página 1
    const cb = on => `<span class="cb ${on ? 'on' : ''}"></span>`;
    const lb = x => `<b>${x}</b>`;
    const v = x => `<span class="mv">${esc(x)}</span>`;
    const endEmp = [val('tipoLog'), val('logradouro')].filter(Boolean).join(' ');
    const compl = val('complemento') ? `${lb('COMPL.')} ${v(val('complemento'))}` : '';
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `<section class="sheet mei" id="pgMei">
      <div class="mei-box">
        <img class="brasao" src="brasao-jahu-sp.png" alt="" onerror="this.style.visibility='hidden'">
        <div class="mei-head"><b>PREFEITURA DA ESTÂNCIA TURÍSTICA DE JAHU</b>SECRETARIA DE ECONOMIA E FINANÇAS<br>DEPARTAMENTO DE CADASTRO MOBILIÁRIO<br><i><u>DECLARAÇÃO DE ATIVIDADE ISENTA DO AUTO DE VISTORIA DO CORPO DE BOMBEIROS</u></i></div>
      </div>
      <div class="mei-tipo">
        <span>${cb(t === 'nova')} INSCRIÇÃO</span><span>${cb(t === 'alteracao')} ALTERAÇÃO</span><span>${cb(t === 'renovacao')} RENOVAÇÃO</span>
      </div>
      <p class="mei-corpo">
        ${lb('EU,')} ${v(s.nome)} ${lb(', INSCRITO NO CPF:')} ${v(s.cpf)} ${lb('E NO RG:')} ${v(s.rg)}
        ${lb('RESIDENTE AO ENDEREÇO,')} ${v(s.endereco)} ${lb('Nº')} ${v(s.numero)} ${lb('BAIRRO')} ${v(s.bairro)}
        ${lb('CEP')} ${v(s.cep)} ${lb('MUNICIPIO')} ${v(s.cidade)} ${lb('ESTADO')} ${v(s.uf)}
        ${lb('RESPONSAVEL LEGAL PELA EMPRESA,')} ${v(val('razao'))}
        ${lb('INSCRITO NO CNPJ:')} ${v(val('doc'))} ${lb('FONE')} ${v(val('telefone'))}
        ${lb('E-MAIL:')} ${v(val('email'))}
        ${lb('ESTABELECIDA NO ENDEREÇO,')} ${v(endEmp)} ${lb('Nº')} ${v(val('numero'))} ${compl}
        ${lb('BAIRRO')} ${v(val('bairro'))} ${lb('CEP')} ${v(val('cep'))} ${lb('MUNICIPIO')} ${v(val('municipio'))} ${lb('ESTADO')} ${v(val('uf'))}
      </p>
      <p class="mei-decl">DECLARO, PARA OS DEVIDOS FINS, QUE A EMPRESA ACIMA DESCRITA POSSUI LOTAÇÃO MÁXIMA NÃO SUPERIOR A 49 (QUARENTA E NOVE) PESSOAS E, PORTANTO, ESTÁ ISENTA DO ATESTADO DE VISTORIA DO CORPO DE BOMBEIROS, CONFORME O ARTIGO 1º, § 2º, INCISO II, DA LEI Nº 3.029, DE 05/12/1995.</p>
      <p class="mei-data">JAHU, &nbsp;${esc(hoje)}</p>
      <div class="mei-ass">${esc(s.nome)}</div>
      <div class="mei-nota">* ASSINATURA DO REQUERENTE IDENTICA AO DOCUMENTO COM FOTO APRESENTADO</div>
    </section>`;
  }

  const removerMei = () => { const p = $('#pgMei'); if (p) p.remove(); };
  window.addEventListener('afterprint', removerMei);

  $('#btnPdf').addEventListener('click', async () => {
    if (!val('razao') && !confirm('Razão Social/Nome está vazio. Gerar o PDF assim mesmo?')) return;
    const r = await perguntaMei();
    if (r === '' || r === 'cancel') return;
    removerMei();
    if (r === 'sim') {
      if (!socios.length) { alert('Cadastre ao menos um sócio: os dados do 1º sócio são usados na declaração MEI.'); return; }
      form.insertAdjacentHTML('beforeend', paginaMei()); // vira a página 3
    }
    window.print(); // no diálogo, escolha "Salvar como PDF"
  });

  $('#btnLimpar').addEventListener('click', () => {
    if (!confirm('Limpar todos os dados do formulário?')) return;
    form.reset(); socios = []; ultimoCnpj = '';
    $$('textarea').forEach(autoSize);
    dataHoje(); renderSocios(); setStatus('');
  });

  function dataHoje() {
    put('dataAss', new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }));
  }

  form.addEventListener('submit', e => e.preventDefault());
  dataHoje();
  renderSocios();
})();
