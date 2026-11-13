/* Testes do motor de cálculo — execute: node tests/calc.test.js */
const assert = require('assert');
const C = require('../calc.js');
const S = require('../seed.js');

const ings = JSON.parse(JSON.stringify(S.ingredientes));
const frutas = JSON.parse(JSON.stringify(S.frutas));
const cfg = JSON.parse(JSON.stringify(S.config));
const byId = (id) => frutas.find((f) => f.id === id);
const aprox = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);
let passed = 0;
function test(nome, fn) { fn(); passed++; console.log('✔', nome); }

test('1. Manga 80 g, 15%, 10 un → 12 g proteína, 800 g líquido, ~824,75 g mistura', () => {
  const s = C.simular({ fruta: byId('manga'), ings, M: 80, n: 10, meta: { modo: 'pct', valor: 15 }, cfg, canais: cfg.canais });
  assert.ok(s.form.ok, s.form.msg);
  aprox(s.form.proteinaUnidade, 12, 0.05, 'proteína/unidade');
  assert.strictEqual(s.custo.rendimento.pesoLiquido, 800);
  aprox(s.custo.rendimento.mistura, 824.74, 0.05, 'mistura a preparar');
  const soma = C.BASE_KEYS.reduce((a, k) => a + (s.form.formulacao[k] || 0), 0);
  aprox(soma, 80, 0.011, 'soma das gramagens = massa');
});

test('2. Manga 80 g, meta 15 g/un → 18,75% e reformula', () => {
  const s = C.simular({ fruta: byId('manga'), ings, M: 80, n: 10, meta: { modo: 'g', valor: 15 }, cfg, canais: cfg.canais });
  assert.ok(s.form.ok, s.form.msg);
  aprox(s.p * 100, 18.75, 0.001, 'meta em %');
  aprox(s.form.proteinaUnidade, 15, 0.05, 'proteína/unidade');
  const s1 = C.simular({ fruta: byId('manga'), ings, M: 80, n: 10, meta: { modo: 'pct', valor: 15 }, cfg, canais: cfg.canais });
  assert.ok(s.form.formulacao.whey > s1.form.formulacao.whey, 'whey deve subir');
});

test('3a. Cinco sabores formulam e somam a massa informada', () => {
  for (const f of frutas) {
    const s = C.simular({ fruta: f, ings, M: 85, n: 10, meta: { modo: 'g', valor: 15 }, cfg, canais: cfg.canais });
    assert.ok(s.form.ok, `${f.nome}: ${s.form.msg}`);
    const soma = C.BASE_KEYS.reduce((a, k) => a + (s.form.formulacao[k] || 0), 0);
    aprox(soma, 85, 0.011, `${f.nome} soma`);
    aprox(s.form.proteinaUnidade, 15, 0.1, `${f.nome} proteína`);
    assert.ok(s.custo.custoUnidade > 0 && s.precos.pix.preco > s.custo.custoUnidade, `${f.nome} preço`);
    assert.strictEqual(s.faltando.length, 0, `${f.nome} cadastro completo`);
  }
});

test('3b. Compra de fruta: redução 65→45 e aproveitamento', () => {
  const m = C.compraFruta(byId('morango'), 450);
  aprox(m.limpa, 650, 0.01, 'morango limpo');
  aprox(m.compra, 650 / 0.95, 0.01, 'morango compra');
  const a = C.compraFruta(byId('manga'), 450);
  aprox(a.compra, 450 / 0.70, 0.01, 'manga compra');
  // rendimento medido sobrescreve o padrão
  const ab = JSON.parse(JSON.stringify(byId('abacaxi')));
  ab.reducao.rendimentoMedido = 0.60;
  aprox(C.compraFruta(ab, 45).limpa, 75, 0.01, 'abacaxi rendimento medido');
});

test('3c. Custo muda quando o preço do whey muda', () => {
  const s1 = C.simular({ fruta: byId('manga'), ings, M: 80, n: 10, meta: { modo: 'pct', valor: 15 }, cfg, canais: cfg.canais });
  const ings2 = JSON.parse(JSON.stringify(ings)); ings2.whey.precoEmbalagem = 259.90;
  const s2 = C.simular({ fruta: byId('manga'), ings: ings2, M: 80, n: 10, meta: { modo: 'pct', valor: 15 }, cfg, canais: cfg.canais });
  assert.ok(s2.custo.custoUnidade > s1.custo.custoUnidade, 'custo deve subir');
  const wheyLote = s1.custo.itens.find((i) => i.k === 'whey').gLote;
  aprox(s2.custo.custoUnidade - s1.custo.custoUnidade, wheyLote * (80 / 1000) / 10, 0.0001, 'diferença = Δpreço × g whey');
});

test('3d. Custo por unidade vendável quando o lote rende abaixo', () => {
  const s = C.simular({ fruta: byId('manga'), ings, M: 80, n: 10, meta: { modo: 'pct', valor: 15 }, cfg, canais: cfg.canais });
  const cUnPlan = s.custo.custoUnidade;
  const cVend = C.custoLoteRegistrado({ custoTotal: s.custo.custoLote, unidadesVendaveis: 8 });
  aprox(cVend, cUnPlan * 10 / 8, 0.0001, 'custo por vendável');
  assert.strictEqual(C.custoLoteRegistrado({ custoTotal: 10, unidadesVendaveis: 0 }), null);
});

test('4. Preço: margem sobre recebido e taxa iFood', () => {
  const p = C.preco({ custoUnidade: 2.00, taxa: 0.262, margem: 0.45 });
  aprox(p.preco, 2 / (0.738 * 0.55), 0.0001, 'preço iFood');
  aprox(p.recebido, p.preco * 0.738, 0.0001, 'recebido');
  aprox(p.sobra / p.recebido, 0.45, 0.0001, 'margem sobre recebido');
  const px = C.preco({ custoUnidade: 2.00, taxa: 0, margem: 0.45 });
  aprox(px.preco, 2 / 0.55, 0.0001, 'preço Pix');
});

test('5. Mensagens de ajuste para meta fora da faixa', () => {
  const baixa = C.formular({ fruta: byId('manga'), ings, M: 80, p: 0.01 });
  assert.ok(!baixa.ok && /Ajuste a meta/.test(baixa.msg));
  const alta = C.formular({ fruta: byId('manga'), ings, M: 80, p: 0.85 });
  assert.ok(!alta.ok && /Ajuste a meta/.test(alta.msg));
});

test('6. Cadastro incompleto de fruta nova é apontado', () => {
  const f = C.faltandoFruta({ id: 'x', nome: 'Goiaba', base: { fruta: 0 } });
  assert.ok(f.includes('preço por kg') && f.includes('fórmula-base (fruta pronta > 0)'));
});

console.log(`\n${passed} testes passaram.`);
