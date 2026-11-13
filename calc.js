/* calc.js — motor de cálculo puro (sem DOM). Funciona no navegador (global PPCalc) e no Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PPCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Chaves dos ingredientes da base (ordem de exibição)
  const BASE_KEYS = ['fruta', 'whey', 'leitePo', 'creme', 'acucar', 'agua', 'raspas', 'liga'];
  const LABELS = {
    fruta: 'Fruta pronta', whey: 'Whey neutro', leitePo: 'Leite em pó', creme: 'Creme de leite 20%',
    acucar: 'Açúcar / adoçante', agua: 'Água filtrada', raspas: 'Raspas de limão', liga: 'Liga neutra'
  };

  const r2 = (x) => Math.round(x * 100) / 100;
  const r1 = (x) => Math.round(x * 10) / 10;

  /** Fração de proteína (g/g) de um ingrediente de rótulo. */
  function fracaoProteina(ing) {
    if (!ing || !ing.porcao || ing.porcao <= 0) return 0;
    return (ing.proteinaPorcao || 0) / ing.porcao;
  }

  /** Preço por grama comprada. */
  function precoPorGrama(ing) {
    if (!ing || !ing.pesoEmbalagem || ing.pesoEmbalagem <= 0) return 0;
    return (ing.precoEmbalagem || 0) / ing.pesoEmbalagem;
  }

  /** g de fruta limpa (antes da redução) por g de fruta pronta. */
  function fatorLimpaPorPronta(fruta) {
    if (!fruta.reducao || !fruta.reducao.ativa) return 1;
    const rend = fruta.reducao.rendimentoMedido || fruta.reducao.rendimentoPadrao; // g pronta por g limpa
    return rend > 0 ? 1 / rend : 1;
  }

  /** Proteína (g) contida em `gPronta` gramas de fruta pronta. */
  function proteinaFruta(fruta, gPronta) {
    const limpa = gPronta * fatorLimpaPorPronta(fruta);
    return limpa * ((fruta.proteina100 || 0) / 100);
  }

  /** Proteína (g) de uma formulação completa {fruta, whey, ...} em gramas. */
  function proteinaFormulacao(form, fruta, ings) {
    let p = 0;
    p += proteinaFruta(fruta, form.fruta || 0);
    p += (form.whey || 0) * fracaoProteina(ings.whey);
    p += (form.leitePo || 0) * fracaoProteina(ings.leitePo);
    p += (form.creme || 0) * fracaoProteina(ings.creme);
    p += (form.acucar || 0) * fracaoProteina(ings.acucar);
    p += (form.raspas || 0) * ((ings.raspas && ings.raspas.proteina100 != null ? ings.raspas.proteina100 : 1.5) / 100);
    p += (form.liga || 0) * fracaoProteina(ings.liga);
    return p;
  }

  /** Arredonda mantendo a soma exatamente igual a M. Liga com 2 casas, demais com 1; a fruta absorve a diferença. */
  function arredondarFechando(form, M) {
    const out = {};
    let soma = 0;
    for (const k of BASE_KEYS) {
      const v = form[k] || 0;
      out[k] = (k === 'liga' || k === 'raspas' || k === 'whey') ? r2(v) : r1(v);
      if (k !== 'fruta') soma += out[k];
    }
    out.fruta = r2(M - soma);
    if (out.fruta < 0) out.fruta = 0;
    return out;
  }

  /**
   * Formula uma unidade de massa M (g) com meta de proteína p (fração).
   * Retorna { ok, msg, formulacao, proteinaUnidade, proteinaFracao, q, w, whey }.
   */
  function formular({ fruta, ings, M, p }) {
    const res = { ok: false, msg: '', M, p };
    if (!fruta || !fruta.base) return Object.assign(res, { msg: 'Fruta sem fórmula-base cadastrada.' });
    if (!(M > 0)) return Object.assign(res, { msg: 'Informe o peso do picolé (g).' });
    if (!(p >= 0 && p < 1)) return Object.assign(res, { msg: 'Meta de proteína inválida.' });

    const base = fruta.base;
    // base sem whey
    let massaBase = 0, protBase = 0;
    for (const k of BASE_KEYS) {
      if (k === 'whey') continue;
      massaBase += base[k] || 0;
    }
    if (massaBase <= 0) return Object.assign(res, { msg: 'Fórmula-base sem ingredientes além do whey.' });
    const semWhey = Object.assign({}, base, { whey: 0 });
    protBase = proteinaFormulacao(semWhey, fruta, ings);
    const q = protBase / massaBase;
    const w = fracaoProteina(ings.whey);
    res.q = q; res.w = w;

    if (!(w > q)) return Object.assign(res, { msg: 'Dados inconsistentes: o whey precisa ter mais proteína que a base.' });
    if (p < q) return Object.assign(res, { msg: `Ajuste a meta: a base sem whey já tem ${(q * 100).toFixed(1)}% de proteína. Meta mínima ${(q * 100).toFixed(1)}%.` });
    if (p >= w) return Object.assign(res, { msg: `Ajuste a meta: acima de ${(w * 100).toFixed(0)}% não é possível só com whey.` });

    const whey = M * (p - q) / (w - q);
    const resto = M - whey;
    const fator = resto / massaBase;
    const form = { whey };
    for (const k of BASE_KEYS) if (k !== 'whey') form[k] = (base[k] || 0) * fator;

    const formR = arredondarFechando(form, M);
    const prot = proteinaFormulacao(formR, fruta, ings);
    return Object.assign(res, {
      ok: true, whey, formulacao: formR, formulacaoBruta: form,
      proteinaUnidade: prot, proteinaFracao: prot / M,
      fracaoFruta: formR.fruta / M
    });
  }

  /** Converte meta em fração: {modo:'pct'|'g', valor} */
  function metaParaFracao(meta, M) {
    if (meta.modo === 'g') return M > 0 ? meta.valor / M : 0;
    return meta.valor / 100;
  }

  /** Rendimento do lote. */
  function rendimento({ M, n, perda }) {
    const pesoLiquido = M * n;
    const mistura = perda < 1 ? pesoLiquido / (1 - perda) : pesoLiquido;
    return { pesoLiquido, mistura, fatorLote: M > 0 ? mistura / M : 0 };
  }

  /** Peso de fruta a comprar para `gPronta` gramas de fruta pronta. */
  function compraFruta(fruta, gPronta) {
    const limpa = gPronta * fatorLimpaPorPronta(fruta);
    const aproveitamento = fruta.aproveitamento > 0 ? fruta.aproveitamento : 1;
    const compra = limpa / aproveitamento;
    return { pronta: gPronta, limpa, compra, descarte: compra - limpa, evaporacao: limpa - gPronta };
  }

  /**
   * Custo do lote e por unidade.
   * cfg: { embalagem, palito, etiqueta, maoObra, energia, rateio, perda }
   */
  function custo({ formulacao, fruta, ings, M, n, cfg }) {
    const rend = rendimento({ M, n, perda: cfg.perda || 0 });
    const f = rend.fatorLote;
    const itens = [];
    let totalIng = 0;

    // fruta
    const gProntaLote = (formulacao.fruta || 0) * f;
    const cf = compraFruta(fruta, gProntaLote);
    const custoFruta = cf.compra * ((fruta.precoKg || 0) / 1000);
    itens.push({ k: 'fruta', nome: fruta.formaPronta || fruta.nome, gUnidade: formulacao.fruta, gLote: gProntaLote, gCompra: cf.compra, custo: custoFruta, estimativa: !!fruta.estimativa });
    totalIng += custoFruta;

    for (const k of BASE_KEYS) {
      if (k === 'fruta') continue;
      const g = (formulacao[k] || 0);
      if (g <= 0) continue;
      const gLote = g * f;
      let c = 0, gCompra = gLote, nome = LABELS[k];
      if (k === 'agua') c = 0;
      else if (k === 'raspas') { c = 0; nome = 'Raspas (dos mesmos limões)'; }
      else { c = gLote * precoPorGrama(ings[k]); nome = ings[k] && ings[k].nome ? ings[k].nome : LABELS[k]; }
      itens.push({ k, nome, gUnidade: g, gLote, gCompra, custo: c, estimativa: !!(ings[k] && ings[k].estimativa) });
      totalIng += c;
    }

    const porUnidadeIng = n > 0 ? totalIng / n : 0;
    const fixos = (cfg.embalagem || 0) + (cfg.palito || 0) + (cfg.etiqueta || 0) + (cfg.maoObra || 0) + (cfg.energia || 0) + (cfg.rateio || 0);
    const custoUnidade = porUnidadeIng + fixos;
    return {
      itens, totalIngredientes: totalIng, ingredientesPorUnidade: porUnidadeIng,
      fixosPorUnidade: fixos, custoUnidade, custoLote: custoUnidade * n,
      compraFruta: cf, rendimento: rend,
      detalheFixos: { embalagem: cfg.embalagem || 0, palito: cfg.palito || 0, etiqueta: cfg.etiqueta || 0, maoObra: cfg.maoObra || 0, energia: cfg.energia || 0, rateio: cfg.rateio || 0 }
    };
  }

  /** Preço = custo ÷ [(1 − taxa) × (1 − margem)] */
  function preco({ custoUnidade, taxa, margem }) {
    const den = (1 - taxa) * (1 - margem);
    if (!(den > 0)) return { ok: false, msg: 'Taxa ou margem inválida.' };
    const preco = custoUnidade / den;
    const taxaDescontada = preco * taxa;
    const recebido = preco - taxaDescontada;
    const sobra = recebido - custoUnidade;
    return { ok: true, preco, taxaDescontada, recebido, sobra, margemSobreRecebido: recebido > 0 ? sobra / recebido : 0 };
  }

  /** Custo por unidade vendável de um lote registrado. */
  function custoLoteRegistrado({ custoTotal, unidadesVendaveis }) {
    return unidadesVendaveis > 0 ? custoTotal / unidadesVendaveis : null;
  }

  /** Campos faltantes no cadastro da fruta. */
  function faltandoFruta(fruta) {
    const f = [];
    if (!fruta.nome) f.push('nome');
    if (!(fruta.precoKg > 0)) f.push('preço por kg');
    if (!(fruta.aproveitamento > 0 && fruta.aproveitamento <= 1)) f.push('aproveitamento (0–100%)');
    if (fruta.proteina100 == null || fruta.proteina100 < 0) f.push('proteína por 100 g');
    if (!fruta.base || !(fruta.base.fruta > 0)) f.push('fórmula-base (fruta pronta > 0)');
    if (fruta.reducao && fruta.reducao.ativa && !(fruta.reducao.rendimentoPadrao > 0) && !(fruta.reducao.rendimentoMedido > 0)) f.push('rendimento da redução');
    return f;
  }

  /** Simulação completa. */
  function simular({ fruta, ings, M, n, meta, cfg, canais }) {
    const p = metaParaFracao(meta, M);
    const form = formular({ fruta, ings, M, p });
    const out = { p, form, faltando: faltandoFruta(fruta) };
    if (!form.ok) return out;
    out.custo = custo({ formulacao: form.formulacao, fruta, ings, M, n, cfg });
    out.precos = {};
    for (const c of canais) out.precos[c.id] = Object.assign({ nome: c.nome, taxa: c.taxa }, preco({ custoUnidade: out.custo.custoUnidade, taxa: c.taxa, margem: cfg.margem }));
    return out;
  }

  return { BASE_KEYS, LABELS, fracaoProteina, precoPorGrama, proteinaFruta, proteinaFormulacao, formular, metaParaFracao, rendimento, compraFruta, custo, preco, custoLoteRegistrado, faltandoFruta, simular, arredondarFechando };
});
