/* app.js — interface do Picolés Proteicos (pt-BR, uso com uma mão). */
(function () {
  'use strict';
  const C = window.PPCalc, DB = window.PPDB, SEED = window.PPSeed;
  const $ = (s, el = document) => el.querySelector(s);
  const S = { ings: {}, frutas: [], config: null, receitas: [], lotes: [], sim: null, aberto: {} };

  // ---------- utilidades ----------
  const fmtRS = (v) => (v == null || isNaN(v)) ? '—' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtG = (v, d = 1) => (v == null || isNaN(v)) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d }) + ' g';
  const fmtPct = (v, d = 1) => (v == null || isNaN(v)) ? '—' : (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: d }) + '%';
  const num = (s, def = 0) => { if (typeof s === 'number') return s; if (s == null) return def; const t = String(s).trim().replace(/\s|R\$/g, '').replace(',', '.'); const v = parseFloat(t); return isNaN(v) ? def : v; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dataBR = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
  let toastT;
  function toast(msg, tipo = '') { const t = $('#toast'); t.textContent = msg; t.className = 'toast ' + tipo; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, tipo === 'erro' ? 6000 : 2500); }
  async function salvar(store, obj, okMsg) { try { await DB.put(store, obj); if (okMsg) toast(okMsg, 'ok'); return true; } catch (e) { toast('Erro ao gravar: ' + e.message + ' Os dados já salvos foram mantidos.', 'erro'); return false; } }
  const debounce = (fn, ms = 500) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const inp = (id, label, val, attrs = '') => `<div class="campo"><label for="${id}">${label}</label><input id="${id}" type="text" inputmode="decimal" value="${esc(typeof val === 'number' ? String(val).replace('.', ',') : val)}" ${attrs}></div>`;
  const inpT = (id, label, val, attrs = '') => `<div class="campo"><label for="${id}">${label}</label><input id="${id}" type="text" value="${esc(val)}" ${attrs}></div>`;
  const pctIn = (v) => v == null ? '' : Math.round(v * 10000) / 100;

  // ---------- carregamento ----------
  async function carregar() {
    const ings = await DB.getAll('ingredientes'); S.ings = {}; ings.forEach((i) => { S.ings[i.id] = i; });
    S.frutas = await DB.getAll('frutas');
    S.config = await DB.get('config', 'geral');
    S.receitas = (await DB.getAll('receitas')).sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
    S.lotes = (await DB.getAll('lotes')).sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
    S.sim = Object.assign({}, S.config.simulacao);
  }
  const fruta = (id) => S.frutas.find((f) => f.id === id) || S.frutas.find((f) => f.nome.toLowerCase() === String(id || '').toLowerCase());

  // ---------- SIMULAR ----------
  function simular(sim) {
    const f = fruta(sim.frutaId);
    if (!f) return null;
    return C.simular({ fruta: f, ings: S.ings, M: sim.M, n: sim.n, meta: { modo: sim.metaModo, valor: sim.metaValor }, cfg: S.config, canais: S.config.canais });
  }

  function renderSimular() {
    const sim = S.sim, f = fruta(sim.frutaId);
    const opcoes = S.frutas.map((x) => `<option value="${esc(x.nome)}"></option>`).join('');
    const el = $('#tela-simular');
    el.innerHTML = `
    <section class="cartao">
      <h2>Simulação <span class="selo">Em teste</span></h2>
      <div class="campo"><label for="s-fruta">Fruta (digite ou escolha)</label>
        <input id="s-fruta" type="search" list="lista-frutas" value="${esc(f ? f.nome : sim.frutaId)}" autocomplete="off" placeholder="Manga, Morango…"><datalist id="lista-frutas">${opcoes}</datalist></div>
      <div class="linha">
        ${inp('s-M', 'Peso de venda (g/unidade)', sim.M)}
        ${inp('s-n', 'Quantidade de picolés', sim.n)}
      </div>
      <div class="campo"><label for="s-meta">Meta de proteína</label>
        <div class="grupo"><input id="s-meta" type="text" inputmode="decimal" value="${esc(sim.metaValor)}">
        <div class="alternar"><button data-modo="pct" class="${sim.metaModo === 'pct' ? 'ativo' : ''}">%</button><button data-modo="g" class="${sim.metaModo === 'g' ? 'ativo' : ''}">g/un</button></div></div></div>
      <div id="s-resultado"></div>
    </section>`;

    const atualizar = () => {
      sim.frutaId = (fruta($('#s-fruta', el).value) || {}).id || $('#s-fruta', el).value;
      sim.M = num($('#s-M', el).value); sim.n = Math.max(0, Math.round(num($('#s-n', el).value))); sim.metaValor = num($('#s-meta', el).value);
      renderResultado(); guardarSim();
    };
    const guardarSim = debounce(async () => { S.config.simulacao = Object.assign({}, sim); await DB.put('config', S.config).catch(() => {}); }, 800);
    ['#s-fruta', '#s-M', '#s-n', '#s-meta'].forEach((id) => { $(id, el).addEventListener('input', atualizar); $(id, el).addEventListener('change', atualizar); });
    el.querySelectorAll('.alternar button').forEach((b) => b.addEventListener('click', () => {
      const novo = b.dataset.modo; if (novo === sim.metaModo) return;
      // converte o valor mantendo a mesma meta
      if (novo === 'g') sim.metaValor = Math.round(sim.M * sim.metaValor / 100 * 100) / 100; else sim.metaValor = sim.M > 0 ? Math.round(sim.metaValor / sim.M * 10000) / 100 : 0;
      sim.metaModo = novo; renderSimular();
    }));
    renderResultado();
  }

  function renderResultado() {
    const box = $('#s-resultado'), sim = S.sim, f = fruta(sim.frutaId);
    if (!f) { box.innerHTML = `<div class="aviso">Fruta "${esc(sim.frutaId)}" não cadastrada. Cadastre em <b>Ingredientes</b> → Frutas → Nova fruta.</div>`; return; }
    const r = simular(sim);
    let html = '';
    if (r.faltando.length) html += `<div class="aviso">Cadastro de ${esc(f.nome)} incompleto: ${r.faltando.join(', ')}.</div>`;
    if (!r.form.ok) { box.innerHTML = html + `<div class="aviso erro">${esc(r.form.msg)}</div>`; return; }
    const fm = r.form.formulacao, cu = r.custo, rend = cu.rendimento, fl = rend.fatorLote;
    const estim = Object.values(S.ings).some((i) => i.estimativa) || f.estimativa || S.config.estimativa;
    html += `
    <div class="destaque">
      <div><small>Proteína estimada</small><b>${fmtG(r.form.proteinaUnidade, 1)}</b><small>meta ${fmtPct(r.p, 2)} · estimado ${fmtPct(r.form.proteinaFracao, 2)} · fruta ${fmtPct(r.form.fracaoFruta, 0)} da mistura</small></div>
      <div><small>Custo por unidade</small><b>${fmtRS(cu.custoUnidade)}</b><small>lote ${fmtRS(cu.custoLote)}${estim ? ' · <span class="selo">estimativa</span>' : ''}</small></div>
    </div>
    <h3>Gramagens</h3>
    <table><thead><tr><th>Ingrediente</th><th class="n">1 un</th><th class="n">Lote ${sim.n}</th></tr></thead><tbody>
    ${C.BASE_KEYS.filter((k) => fm[k] > 0).map((k) => `<tr><td>${k === 'fruta' ? esc(f.formaPronta || f.nome) : esc(C.LABELS[k])}</td><td class="n">${fmtG(fm[k], 2)}</td><td class="n">${fmtG(fm[k] * fl, 1)}</td></tr>`).join('')}
    <tr class="total"><td>Total</td><td class="n">${fmtG(sim.M, 2)}</td><td class="n">${fmtG(rend.mistura, 1)}</td></tr></tbody></table>
    <p class="mini">Peso líquido ${fmtG(rend.pesoLiquido, 0)} · mistura a preparar ${fmtG(rend.mistura, 2)} (perda ${fmtPct(S.config.perda)}).</p>
    <h3>Fruta a comprar</h3>
    <table><tbody>
      <tr><td>${esc(f.formaPronta || f.nome)} (pronta)</td><td class="n">${fmtG(cu.compraFruta.pronta, 1)}</td></tr>
      ${f.reducao && f.reducao.ativa ? `<tr><td>Fruta limpa antes da redução</td><td class="n">${fmtG(cu.compraFruta.limpa, 1)}</td></tr>` : ''}
      <tr class="total"><td>Comprar (aproveitamento ${fmtPct(f.aproveitamento, 0)})</td><td class="n">${fmtG(cu.compraFruta.compra, 0)}</td></tr>
      ${f.raspas ? `<tr><td colspan="2" class="mini">Raspas (${fmtG(fm.raspas * fl, 1)}) saem dos mesmos limões do suco — sem compra extra.</td></tr>` : ''}
    </tbody></table>
    <h3>Preparo</h3>
    <ol class="passos">
      <li><b>Fruta:</b> ${esc(f.preparo || '—')}${f.tratamento ? ` <span class="mini">(tratamento: ${f.tratamento.tempoMin || '?'} min${f.tratamento.tempC ? ` a ${f.tratamento.tempC} °C` : ''})</span>` : ''}</li>
      <li><b>Mistura:</b> ${esc(f.ordem || '—')}</li>
      ${f.acida ? '<li><b>Ácida:</b> incorporar aos poucos à base fria e registrar se houve separação.</li>' : ''}
      <li><b>Congelar:</b> encher as formas deixando 0,5 cm de borda, inserir palitos, freezer −18 °C por no mínimo 6 h.</li>
    </ol>
    <h3>Custo</h3>
    <table><thead><tr><th>Item</th><th class="n">Lote</th><th class="n">Por un.</th></tr></thead><tbody>
    ${cu.itens.map((i) => `<tr><td>${esc(i.nome)}${i.k === 'fruta' ? ` <span class="mini">(${fmtG(i.gCompra, 0)} comprados)</span>` : ''}</td><td class="n">${fmtRS(i.custo)}</td><td class="n">${fmtRS(sim.n ? i.custo / sim.n : 0)}</td></tr>`).join('')}
    <tr><td>Embalagem + palito + etiqueta</td><td class="n">${fmtRS((cu.detalheFixos.embalagem + cu.detalheFixos.palito + cu.detalheFixos.etiqueta) * sim.n)}</td><td class="n">${fmtRS(cu.detalheFixos.embalagem + cu.detalheFixos.palito + cu.detalheFixos.etiqueta)}</td></tr>
    <tr><td>Mão de obra + energia</td><td class="n">${fmtRS((cu.detalheFixos.maoObra + cu.detalheFixos.energia) * sim.n)}</td><td class="n">${fmtRS(cu.detalheFixos.maoObra + cu.detalheFixos.energia)}</td></tr>
    ${cu.detalheFixos.rateio ? `<tr><td>Despesas rateadas</td><td class="n">${fmtRS(cu.detalheFixos.rateio * sim.n)}</td><td class="n">${fmtRS(cu.detalheFixos.rateio)}</td></tr>` : ''}
    <tr class="total"><td>Total</td><td class="n">${fmtRS(cu.custoLote)}</td><td class="n">${fmtRS(cu.custoUnidade)}</td></tr></tbody></table>
    <h3>Preço de venda (margem ${fmtPct(S.config.margem, 0)} sobre o recebido)</h3>
    <table><thead><tr><th>Canal</th><th class="n">Preço</th><th class="n">Taxa</th><th class="n">Recebe</th><th class="n">Sobra</th></tr></thead><tbody>
    ${Object.values(r.precos).map((p) => p.ok ? `<tr><td>${esc(p.nome)} <span class="mini">${fmtPct(p.taxa)}</span></td><td class="n"><b>${fmtRS(p.preco)}</b></td><td class="n">${fmtRS(p.taxaDescontada)}</td><td class="n">${fmtRS(p.recebido)}</td><td class="n">${fmtRS(p.sobra)}</td></tr>` : `<tr><td colspan="5">${esc(p.msg)}</td></tr>`).join('')}
    </tbody></table>
    <p class="mini">Preço = custo ÷ [(1 − taxa) × (1 − margem)]. Contém leite.</p>
    <button class="botao" id="s-salvar-receita">Salvar como receita (Em teste)</button>`;
    box.innerHTML = html;
    $('#s-salvar-receita', box).addEventListener('click', async () => {
      const rec = { id: DB.novoId(), nome: `${f.nome} ${sim.M} g · ${fmtG(r.form.proteinaUnidade, 1)} prot.`, frutaId: f.id, frutaNome: f.nome, M: sim.M, metaModo: sim.metaModo, metaValor: sim.metaValor,
        formulacao: fm, proteinaUnidade: r.form.proteinaUnidade, status: 'teste', criadoEm: new Date().toISOString(),
        teste: { rendimentoMedido: f.reducao && f.reducao.rendimentoMedido || null, tratamentoTempoMin: f.tratamento ? f.tratamento.tempoMin : null, tratamentoTempC: f.tratamento ? f.tratamento.tempC : null, separacao: null, textura: '' },
        processo: { pasteurizacaoTempC: null, pasteurizacaoTempoMin: null, conservacao: '', validadeDias: null, observacoes: '' } };
      if (await salvar('receitas', rec, 'Receita salva em "Receitas e lotes".')) { S.receitas.unshift(rec); }
    });
  }

  // ---------- INGREDIENTES E CUSTOS ----------
  function renderIngredientes() {
    const el = $('#tela-ingredientes'), cfg = S.config;
    const ingsOrdem = ['whey', 'leitePo', 'creme', 'acucar', 'liga'];
    el.innerHTML = `
    <section class="cartao colapsavel ${S.aberto.ings === false ? 'fechado' : ''}" data-chave="ings"><h2>Ingredientes <span class="mini">preço e rótulo</span></h2>
      ${ingsOrdem.map((k) => { const i = S.ings[k]; return `
      <div class="item-lista" data-ing="${k}"><h4>${esc(i.nome)} ${i.estimativa ? '<span class="selo">estimativa</span>' : '<span class="selo ok">meus dados</span>'}</h4>
        ${inpT(`i-${k}-marca`, 'Marca', i.marca || '')}
        <div class="linha">${inp(`i-${k}-peso`, 'Peso da embalagem (g)', i.pesoEmbalagem)}${inp(`i-${k}-preco`, 'Preço da embalagem (R$)', i.precoEmbalagem)}</div>
        <div class="linha">${inp(`i-${k}-porcao`, 'Porção do rótulo (g)', i.porcao)}${inp(`i-${k}-prot`, 'Proteína na porção (g)', i.proteinaPorcao)}</div>
        <p class="mini">${fmtRS(C.precoPorGrama(i) * 1000)}/kg · ${fmtPct(C.fracaoProteina(i))} de proteína</p>
      </div>`; }).join('')}
      <div class="item-lista"><h4>Raspas de limão</h4>${inp('i-raspas-prot', 'Proteína por 100 g (referência)', S.ings.raspas.proteina100)}<p class="mini">Sem custo: saem dos limões do suco.</p></div>
    </section>

    <section class="cartao colapsavel ${S.aberto.frutas === false ? 'fechado' : ''}" data-chave="frutas"><h2>Frutas e fórmulas-base <span class="mini">g por unidade</span></h2>
      ${S.frutas.map((f) => renderFruta(f)).join('')}
      <button class="botao secundario" id="f-nova">+ Nova fruta</button>
    </section>

    <section class="cartao colapsavel ${S.aberto.custos === false ? 'fechado' : ''}" data-chave="custos"><h2>Custos de produção ${cfg.estimativa ? '<span class="selo">estimativa</span>' : '<span class="selo ok">meus dados</span>'}</h2>
      <div class="linha-3">${inp('c-embalagem', 'Embalagem (R$/un)', cfg.embalagem)}${inp('c-palito', 'Palito (R$/un)', cfg.palito)}${inp('c-etiqueta', 'Etiqueta (R$/un)', cfg.etiqueta)}</div>
      <div class="linha-3">${inp('c-maoObra', 'Mão de obra (R$/un)', cfg.maoObra)}${inp('c-energia', 'Energia (R$/un)', cfg.energia)}${inp('c-rateio', 'Rateio opcional (R$/un)', cfg.rateio || '')}</div>
      <div class="linha">${inp('c-perda', 'Perda de mistura (%)', pctIn(cfg.perda))}${inp('c-margem', 'Margem sobre recebido (%)', pctIn(cfg.margem))}</div>
      <h3>Taxas por canal</h3>
      ${cfg.canais.map((c, i) => `<div class="linha">${inpT(`c-canal-${i}-nome`, 'Canal', c.nome)}${inp(`c-canal-${i}-taxa`, 'Taxa (%)', pctIn(c.taxa))}</div>`).join('')}
    </section>

    <section class="cartao"><h2>Backup</h2>
      <div class="acoes"><button class="botao secundario" id="b-exportar">Exportar JSON</button><button class="botao secundario" id="b-restaurar">Restaurar JSON</button></div>
      <p class="mini">Formato v${DB.BACKUP_VERSION}. A restauração valida o arquivo antes de substituir os dados.</p>
    </section>`;

    // colapsar
    el.querySelectorAll('.cartao.colapsavel > h2').forEach((h) => h.addEventListener('click', () => { const c = h.parentElement; c.classList.toggle('fechado'); S.aberto[c.dataset.chave] = !c.classList.contains('fechado'); }));

    // ingredientes: autosave
    for (const k of ingsOrdem) {
      const i = S.ings[k], box = el.querySelector(`[data-ing="${k}"]`);
      const salvarIng = debounce(async () => {
        i.marca = $(`#i-${k}-marca`, box).value.trim(); i.pesoEmbalagem = num($(`#i-${k}-peso`, box).value); i.precoEmbalagem = num($(`#i-${k}-preco`, box).value);
        i.porcao = num($(`#i-${k}-porcao`, box).value); i.proteinaPorcao = num($(`#i-${k}-prot`, box).value); i.estimativa = false;
        if (await salvar('ingredientes', i)) { box.querySelector('.mini').textContent = `${fmtRS(C.precoPorGrama(i) * 1000)}/kg · ${fmtPct(C.fracaoProteina(i))} de proteína`; box.querySelector('.selo').outerHTML = '<span class="selo ok">meus dados</span>'; }
      });
      box.querySelectorAll('input').forEach((x) => x.addEventListener('input', salvarIng));
    }
    $('#i-raspas-prot', el).addEventListener('input', debounce(async () => { S.ings.raspas.proteina100 = num($('#i-raspas-prot', el).value); S.ings.raspas.proteinaPorcao = S.ings.raspas.proteina100; await salvar('ingredientes', S.ings.raspas); }));

    // frutas
    S.frutas.forEach((f) => ligarFruta(f, el));
    $('#f-nova', el).addEventListener('click', async () => {
      const nome = prompt('Nome da nova fruta:'); if (!nome) return;
      const f = { id: DB.novoId(), nome: nome.trim(), formaPronta: '', categoria: '', precoKg: 0, aproveitamento: 0, proteina100: null, estimativa: false,
        reducao: { ativa: false, rendimentoPadrao: 45 / 65, rendimentoMedido: null }, tratamento: null, acida: false, raspas: false, preparo: '', ordem: '',
        base: { fruta: 0, whey: 15, leitePo: 8, creme: 12, acucar: 5, agua: 0, raspas: 0, liga: 0.15 } };
      if (await salvar('frutas', f, 'Fruta criada. Complete os dados marcados.')) { S.frutas.push(f); S.aberto.frutas = true; renderIngredientes(); }
    });

    // custos: autosave
    const salvarCfg = debounce(async () => {
      cfg.embalagem = num($('#c-embalagem', el).value); cfg.palito = num($('#c-palito', el).value); cfg.etiqueta = num($('#c-etiqueta', el).value);
      cfg.maoObra = num($('#c-maoObra', el).value); cfg.energia = num($('#c-energia', el).value); cfg.rateio = num($('#c-rateio', el).value);
      cfg.perda = num($('#c-perda', el).value) / 100; cfg.margem = num($('#c-margem', el).value) / 100;
      cfg.canais.forEach((c, i) => { c.nome = $(`#c-canal-${i}-nome`, el).value.trim() || c.nome; c.taxa = num($(`#c-canal-${i}-taxa`, el).value) / 100; });
      cfg.estimativa = false; await salvar('config', cfg);
    });
    el.querySelectorAll('[id^="c-"]').forEach((x) => x.addEventListener('input', salvarCfg));

    // backup
    $('#b-exportar', el).addEventListener('click', async () => {
      try { const data = await DB.exportar(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `picoles-proteicos-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Backup exportado.', 'ok'); }
      catch (e) { toast('Falha ao exportar: ' + e.message, 'erro'); }
    });
    $('#b-restaurar', el).addEventListener('click', () => $('#arquivo-backup').click());
  }

  function renderFruta(f) {
    const falt = C.faltandoFruta(f);
    return `<div class="item-lista" data-fruta="${f.id}"><h4>${esc(f.nome)} ${falt.length ? `<span class="selo">faltam: ${esc(falt.join(', '))}</span>` : (f.estimativa ? '<span class="selo">estimativa</span>' : '<span class="selo ok">meus dados</span>')}</h4>
      <details><summary>Editar fruta e fórmula-base</summary>
        ${inpT(`f-${f.id}-nome`, 'Nome', f.nome)}
        ${inpT(`f-${f.id}-forma`, 'Forma pronta na mistura (ex.: Polpa, Redução, Suco)', f.formaPronta || '')}
        <div class="linha-3">${inp(`f-${f.id}-preco`, 'Preço (R$/kg)', f.precoKg || '')}${inp(`f-${f.id}-aprov`, 'Aproveitamento (%)', f.aproveitamento ? pctIn(f.aproveitamento) : '')}${inp(`f-${f.id}-prot`, 'Proteína /100 g', f.proteina100 == null ? '' : f.proteina100)}</div>
        <div class="campo"><label><input type="checkbox" id="f-${f.id}-red" ${f.reducao && f.reducao.ativa ? 'checked' : ''}> Passa por redução (evapora água)</label></div>
        <div class="linha">${inp(`f-${f.id}-redpad`, 'Rendimento padrão (g pronta / 100 g limpa)', f.reducao && f.reducao.rendimentoPadrao ? Math.round(f.reducao.rendimentoPadrao * 1000) / 10 : '')}${inp(`f-${f.id}-redmed`, 'Rendimento medido (opcional)', f.reducao && f.reducao.rendimentoMedido ? Math.round(f.reducao.rendimentoMedido * 1000) / 10 : '')}</div>
        <div class="linha">${inp(`f-${f.id}-trat-t`, 'Tratamento: tempo (min)', f.tratamento && f.tratamento.tempoMin != null ? f.tratamento.tempoMin : '')}${inp(`f-${f.id}-trat-c`, 'Tratamento: temperatura (°C)', f.tratamento && f.tratamento.tempC != null ? f.tratamento.tempC : '')}</div>
        <div class="linha"><div class="campo"><label><input type="checkbox" id="f-${f.id}-acida" ${f.acida ? 'checked' : ''}> Ácida (incorporar aos poucos)</label></div><div class="campo"><label><input type="checkbox" id="f-${f.id}-raspas" ${f.raspas ? 'checked' : ''}> Usa raspas da casca</label></div></div>
        <h3>Fórmula-base (g por unidade, 0 = ausente)</h3>
        <div class="linha-3">${C.BASE_KEYS.map((k) => inp(`f-${f.id}-b-${k}`, C.LABELS[k], f.base ? (f.base[k] == null ? 0 : f.base[k]) : 0)).join('')}</div>
        <div class="campo"><label for="f-${f.id}-preparo">Preparo da fruta</label><textarea id="f-${f.id}-preparo">${esc(f.preparo || '')}</textarea></div>
        <div class="campo"><label for="f-${f.id}-ordem">Ordem de mistura</label><textarea id="f-${f.id}-ordem">${esc(f.ordem || '')}</textarea></div>
        ${['manga', 'morango', 'abacaxi', 'maracuja', 'limao'].includes(f.id) ? '' : `<button class="botao perigo" id="f-${f.id}-excluir">Excluir fruta</button>`}
      </details></div>`;
  }

  function ligarFruta(f, el) {
    const box = el.querySelector(`[data-fruta="${f.id}"]`); if (!box) return;
    const g = (s) => $(`#f-${f.id}-${s}`, box);
    const salvarF = debounce(async () => {
      f.nome = g('nome').value.trim() || f.nome; f.formaPronta = g('forma').value.trim();
      f.precoKg = num(g('preco').value); f.aproveitamento = num(g('aprov').value) / 100; f.proteina100 = g('prot').value.trim() === '' ? null : num(g('prot').value);
      f.reducao = { ativa: g('red').checked, rendimentoPadrao: num(g('redpad').value) / 100 || 45 / 65, rendimentoMedido: g('redmed').value.trim() === '' ? null : num(g('redmed').value) / 100 };
      const tt = g('trat-t').value.trim(), tc = g('trat-c').value.trim();
      f.tratamento = (tt === '' && tc === '') ? null : { tempoMin: tt === '' ? null : num(tt), tempC: tc === '' ? null : num(tc) };
      f.acida = g('acida').checked; f.raspas = g('raspas').checked;
      f.base = {}; C.BASE_KEYS.forEach((k) => { f.base[k] = num(g('b-' + k).value); });
      f.preparo = g('preparo').value; f.ordem = g('ordem').value; f.estimativa = false;
      if (await salvar('frutas', f)) { const falt = C.faltandoFruta(f); box.querySelector('h4').innerHTML = `${esc(f.nome)} ${falt.length ? `<span class="selo">faltam: ${esc(falt.join(', '))}</span>` : '<span class="selo ok">meus dados</span>'}`; }
    });
    box.querySelectorAll('input, textarea').forEach((x) => x.addEventListener('input', salvarF));
    const ex = g('excluir'); if (ex) ex.addEventListener('click', async () => { if (!confirm(`Excluir ${f.nome}?`)) return; try { await DB.del('frutas', f.id); S.frutas = S.frutas.filter((x) => x.id !== f.id); renderIngredientes(); toast('Fruta excluída.'); } catch (e) { toast('Erro: ' + e.message, 'erro'); } });
  }

  async function restaurarArquivo(file) {
    try {
      const txt = await file.text(); let obj; try { obj = JSON.parse(txt); } catch (_) { throw new Error('Arquivo não é um JSON válido.'); }
      const v = DB.validarBackup(obj);
      if (!v.ok) { toast('Backup inválido: ' + v.erros.join(' '), 'erro'); return; }
      if (!confirm(`Substituir TODOS os dados atuais pelo backup de ${dataBR(obj.geradoEm)}?\n${v.resumo}`)) return;
      await DB.restaurar(obj); await carregar(); renderTudo(); toast('Backup restaurado.', 'ok');
    } catch (e) { toast(e.message, 'erro'); }
  }

  // ---------- RECEITAS E LOTES ----------
  function renderReceitas() {
    const el = $('#tela-receitas');
    el.innerHTML = `
    <section class="cartao"><h2>Receitas</h2>
      ${S.receitas.length ? S.receitas.map(renderReceita).join('') : '<p class="mini">Nenhuma receita. Salve uma a partir da tela Simular.</p>'}
    </section>
    <section class="cartao"><h2>Lotes</h2>
      ${S.lotes.length ? S.lotes.map(renderLote).join('') : '<p class="mini">Nenhum lote. Registre um lote a partir de uma receita.</p>'}
    </section>`;
    S.receitas.forEach((r) => ligarReceita(r, el));
    S.lotes.forEach((l) => ligarLote(l, el));
  }

  function renderReceita(r) {
    const f = fruta(r.frutaId), t = r.teste || {}, p = r.processo || {};
    const aprovada = r.status === 'aprovada';
    return `<div class="item-lista" data-rec="${r.id}"><h4>${esc(r.nome)} ${aprovada ? '<span class="selo ok">Aprovada no teste de textura</span>' : '<span class="selo">Em teste</span>'}</h4>
      <p class="mini">${esc(r.frutaNome)} · ${fmtG(r.M, 0)} · ${fmtG(r.proteinaUnidade, 1)} proteína · criada ${dataBR(r.criadoEm)}</p>
      <details><summary>Formulação, teste e processo</summary>
        <table><tbody>${C.BASE_KEYS.filter((k) => r.formulacao[k] > 0).map((k) => `<tr><td>${k === 'fruta' ? esc(f ? f.formaPronta || f.nome : 'Fruta') : esc(C.LABELS[k])}</td><td class="n">${fmtG(r.formulacao[k], 2)}</td></tr>`).join('')}</tbody></table>
        <h3>Registro do teste</h3>
        ${f && f.reducao && f.reducao.ativa ? inp(`r-${r.id}-rend`, 'Rendimento medido da redução (g pronta / 100 g limpa)', t.rendimentoMedido ? Math.round(t.rendimentoMedido * 1000) / 10 : '') : ''}
        ${f && f.id === 'abacaxi' || (f && f.tratamento) ? `<div class="linha">${inp(`r-${r.id}-trat-t`, 'Tratamento: tempo (min)', t.tratamentoTempoMin == null ? '' : t.tratamentoTempoMin)}${inp(`r-${r.id}-trat-c`, 'Tratamento: temperatura (°C)', t.tratamentoTempC == null ? '' : t.tratamentoTempC)}</div>` : ''}
        ${f && f.acida ? `<div class="campo"><label>Houve separação ao incorporar o ácido?</label><select id="r-${r.id}-sep"><option value="">—</option><option value="nao" ${t.separacao === 'nao' ? 'selected' : ''}>Não</option><option value="sim" ${t.separacao === 'sim' ? 'selected' : ''}>Sim</option></select></div>` : ''}
        <div class="campo"><label for="r-${r.id}-textura">Observações de textura</label><textarea id="r-${r.id}-textura">${esc(t.textura || '')}</textarea></div>
        <button class="botao ${aprovada ? 'secundario' : ''}" id="r-${r.id}-status">${aprovada ? 'Voltar para "Em teste"' : 'Aprovar no teste de textura'}</button>
        <h3>Ficha de produção (processo validado)</h3>
        <div class="linha">${inp(`r-${r.id}-past-c`, 'Pasteurização: temperatura (°C)', p.pasteurizacaoTempC == null ? '' : p.pasteurizacaoTempC)}${inp(`r-${r.id}-past-t`, 'Pasteurização: tempo (min)', p.pasteurizacaoTempoMin == null ? '' : p.pasteurizacaoTempoMin)}</div>
        ${inpT(`r-${r.id}-cons`, 'Conservação (temperatura, embalagem)', p.conservacao || '')}
        ${inp(`r-${r.id}-val`, 'Validade (dias)', p.validadeDias == null ? '' : p.validadeDias)}
        <p class="mini">${p.validadeDias ? `Validade definida: ${p.validadeDias} dias.` : '<span class="selo">Validade pendente</span> — definir para a receita real.'} · <b>Contém leite.</b></p>
        <div class="campo"><label for="r-${r.id}-obs">Observações do processo</label><textarea id="r-${r.id}-obs">${esc(p.observacoes || '')}</textarea></div>
        <div class="acoes"><button class="botao" id="r-${r.id}-lote">Registrar lote</button><button class="botao perigo" id="r-${r.id}-excluir">Excluir receita</button></div>
      </details></div>`;
  }

  function ligarReceita(r, el) {
    const box = el.querySelector(`[data-rec="${r.id}"]`); const g = (s) => $(`#r-${r.id}-${s}`, box);
    const salvarR = debounce(async () => {
      r.teste = r.teste || {}; r.processo = r.processo || {};
      if (g('rend')) r.teste.rendimentoMedido = g('rend').value.trim() === '' ? null : num(g('rend').value) / 100;
      if (g('trat-t')) { r.teste.tratamentoTempoMin = g('trat-t').value.trim() === '' ? null : num(g('trat-t').value); r.teste.tratamentoTempC = g('trat-c').value.trim() === '' ? null : num(g('trat-c').value); }
      if (g('sep')) r.teste.separacao = g('sep').value || null;
      r.teste.textura = g('textura').value;
      r.processo.pasteurizacaoTempC = g('past-c').value.trim() === '' ? null : num(g('past-c').value);
      r.processo.pasteurizacaoTempoMin = g('past-t').value.trim() === '' ? null : num(g('past-t').value);
      r.processo.conservacao = g('cons').value; r.processo.validadeDias = g('val').value.trim() === '' ? null : num(g('val').value); r.processo.observacoes = g('obs').value;
      await salvar('receitas', r);
    });
    box.querySelectorAll('input, textarea, select').forEach((x) => x.addEventListener('input', salvarR));
    g('status').addEventListener('click', async () => { r.status = r.status === 'aprovada' ? 'teste' : 'aprovada'; r.aprovadaEm = r.status === 'aprovada' ? new Date().toISOString() : null; if (await salvar('receitas', r, r.status === 'aprovada' ? 'Receita aprovada no teste de textura.' : 'Receita voltou para teste.')) renderReceitas(); });
    g('excluir').addEventListener('click', async () => { if (!confirm('Excluir esta receita?')) return; try { await DB.del('receitas', r.id); S.receitas = S.receitas.filter((x) => x.id !== r.id); renderReceitas(); } catch (e) { toast('Erro: ' + e.message, 'erro'); } });
    g('lote').addEventListener('click', async () => {
      const n = Math.round(num(prompt('Quantidade planejada de picolés:', '10'))); if (!(n > 0)) return;
      const f = fruta(r.frutaId); if (!f) { toast('Fruta da receita não existe mais.', 'erro'); return; }
      const cu = C.custo({ formulacao: r.formulacao, fruta: f, ings: S.ings, M: r.M, n, cfg: S.config });
      const l = { id: DB.novoId(), receitaId: r.id, nome: `${r.frutaNome} · ${n} un · ${new Date().toLocaleDateString('pt-BR')}`, criadoEm: new Date().toISOString(), nPlanejado: n, M: r.M,
        custoRegistrado: { total: cu.custoLote, porUnidadePlanejada: cu.custoUnidade, itens: cu.itens.map((i) => ({ nome: i.nome, gLote: i.gLote, gCompra: i.gCompra, custo: i.custo })), fixosPorUnidade: cu.fixosPorUnidade, misturaPrevista: cu.rendimento.mistura, compraFruta: cu.compraFruta.compra },
        pesoEnvasado: null, unidadesVendaveis: null, observacoes: '' };
      if (await salvar('lotes', l, 'Lote registrado com os custos de hoje.')) { S.lotes.unshift(l); renderReceitas(); }
    });
  }

  function renderLote(l) {
    const c = l.custoRegistrado, cv = C.custoLoteRegistrado({ custoTotal: c.total, unidadesVendaveis: l.unidadesVendaveis });
    return `<div class="item-lista" data-lote="${l.id}"><h4>${esc(l.nome)} <span class="selo neutro">custos congelados</span></h4>
      <p class="mini">Planejado ${l.nPlanejado} un × ${fmtG(l.M, 0)} · mistura prevista ${fmtG(c.misturaPrevista, 0)} · fruta a comprar ${fmtG(c.compraFruta, 0)}</p>
      <div class="destaque"><div><small>Custo do lote (registrado)</small><b>${fmtRS(c.total)}</b><small>${fmtRS(c.porUnidadePlanejada)} por un. planejada</small></div>
        <div><small>Custo por un. vendável</small><b>${cv == null ? '—' : fmtRS(cv)}</b><small>${l.unidadesVendaveis ? `${l.unidadesVendaveis} vendáveis` : 'informe as vendáveis'}</small></div></div>
      <div class="linha">${inp(`l-${l.id}-peso`, 'Peso envasado (g)', l.pesoEnvasado == null ? '' : l.pesoEnvasado)}${inp(`l-${l.id}-vend`, 'Unidades vendáveis', l.unidadesVendaveis == null ? '' : l.unidadesVendaveis)}</div>
      <div class="campo"><label for="l-${l.id}-obs">Observações</label><textarea id="l-${l.id}-obs">${esc(l.observacoes || '')}</textarea></div>
      <details><summary>Custos registrados por item</summary><table><tbody>${c.itens.map((i) => `<tr><td>${esc(i.nome)} <span class="mini">${fmtG(i.gCompra, 0)}</span></td><td class="n">${fmtRS(i.custo)}</td></tr>`).join('')}<tr><td>Fixos por unidade × ${l.nPlanejado}</td><td class="n">${fmtRS(c.fixosPorUnidade * l.nPlanejado)}</td></tr></tbody></table></details>
      <button class="botao perigo" id="l-${l.id}-excluir">Excluir lote</button></div>`;
  }

  function ligarLote(l, el) {
    const box = el.querySelector(`[data-lote="${l.id}"]`); const g = (s) => $(`#l-${l.id}-${s}`, box);
    const salvarL = debounce(async () => {
      l.pesoEnvasado = g('peso').value.trim() === '' ? null : num(g('peso').value); l.unidadesVendaveis = g('vend').value.trim() === '' ? null : Math.round(num(g('vend').value)); l.observacoes = g('obs').value;
      if (await salvar('lotes', l)) { const cv = C.custoLoteRegistrado({ custoTotal: l.custoRegistrado.total, unidadesVendaveis: l.unidadesVendaveis }); const d = box.querySelectorAll('.destaque div')[1]; d.querySelector('b').textContent = cv == null ? '—' : fmtRS(cv); d.querySelector('small:last-child').textContent = l.unidadesVendaveis ? `${l.unidadesVendaveis} vendáveis` : 'informe as vendáveis'; }
    });
    box.querySelectorAll('input, textarea').forEach((x) => x.addEventListener('input', salvarL));
    g('excluir').addEventListener('click', async () => { if (!confirm('Excluir este lote?')) return; try { await DB.del('lotes', l.id); S.lotes = S.lotes.filter((x) => x.id !== l.id); renderReceitas(); } catch (e) { toast('Erro: ' + e.message, 'erro'); } });
  }

  // ---------- navegação e inicialização ----------
  function renderTudo() { renderSimular(); renderIngredientes(); renderReceitas(); }
  function mostrar(tela) {
    document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', t.id === 'tela-' + tela));
    document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.tela === tela));
    if (tela === 'simular') renderSimular(); if (tela === 'receitas') renderReceitas();
    window.scrollTo(0, 0);
  }
  function rede() { const s = $('#status-rede'); s.classList.toggle('off', !navigator.onLine); s.title = navigator.onLine ? 'Online' : 'Offline — o app continua funcionando'; }

  async function iniciar() {
    try {
      await DB.persistir();
      const semeou = await DB.semear(SEED);
      await carregar(); renderTudo();
      if (semeou) toast('Dados iniciais carregados como estimativas. Ajuste em Ingredientes.', 'ok');
    } catch (e) { $('#tela-simular').innerHTML = `<div class="aviso erro">Não foi possível abrir o banco local: ${esc(e.message)}</div>`; }
    document.querySelectorAll('.abas button').forEach((b) => b.addEventListener('click', () => mostrar(b.dataset.tela)));
    $('#arquivo-backup').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restaurarArquivo(f); });
    window.addEventListener('online', rede); window.addEventListener('offline', rede); rede();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => { const nw = reg.installing; nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Nova versão disponível. Feche e reabra o app para atualizar. Seus dados são preservados.'); }); });
      }).catch(() => {});
    }
  }
  window.PPApp = { S, simular, renderTudo };
  document.addEventListener('DOMContentLoaded', iniciar);
})();
