/* seed.js — dados iniciais editáveis (marcados como estimativas). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PPSeed = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ingredientes = {
    whey:    { id: 'whey',    nome: 'Whey Protein Neutro 80%', marca: '', pesoEmbalagem: 1000, precoEmbalagem: 179.90, porcao: 30,  proteinaPorcao: 24,  estimativa: true },
    leitePo: { id: 'leitePo', nome: 'Leite em pó integral',    marca: '', pesoEmbalagem: 380,  precoEmbalagem: 24.99,  porcao: 25,  proteinaPorcao: 6.4, estimativa: true },
    creme:   { id: 'creme',   nome: 'Creme de leite 20%',      marca: '', pesoEmbalagem: 200,  precoEmbalagem: 3.99,   porcao: 100, proteinaPorcao: 2.7, estimativa: true },
    acucar:  { id: 'acucar',  nome: 'Açúcar / adoçante',       marca: '', pesoEmbalagem: 1000, precoEmbalagem: 5.49,   porcao: 100, proteinaPorcao: 0,   estimativa: true },
    liga:    { id: 'liga',    nome: 'Liga neutra para sorvete',marca: '', pesoEmbalagem: 100,  precoEmbalagem: 11.99,  porcao: 100, proteinaPorcao: 0,   estimativa: true },
    agua:    { id: 'agua',    nome: 'Água filtrada',           marca: '', pesoEmbalagem: 1000, precoEmbalagem: 0,      porcao: 100, proteinaPorcao: 0,   estimativa: false, fixo: true },
    raspas:  { id: 'raspas',  nome: 'Raspas de limão',         marca: '', pesoEmbalagem: 100,  precoEmbalagem: 0,      porcao: 100, proteinaPorcao: 1.5, proteina100: 1.5, estimativa: true, fixo: true }
  };

  const frutas = [
    { id: 'manga', nome: 'Manga', formaPronta: 'Polpa de manga madura', categoria: 'Fruta cremosa / doce',
      precoKg: 4.99, aproveitamento: 0.70, proteina100: 0.41, estimativa: true,
      reducao: { ativa: false }, tratamento: null, acida: false, raspas: false,
      preparo: 'Usar crua, bem madura, batida até virar purê liso sem água.',
      ordem: 'Bater a manga pura. Adicionar whey, leite em pó, creme de leite, adoçante e liga. Bater rápido só para homogeneizar.',
      base: { fruta: 45, whey: 17, leitePo: 6, creme: 12, acucar: 2, agua: 0, raspas: 0, liga: 0.10 } },
    { id: 'morango', nome: 'Morango', formaPronta: 'Redução de morango', categoria: 'Fruta aguada',
      precoKg: 39.60, aproveitamento: 0.95, proteina100: 0.82, estimativa: true,
      reducao: { ativa: true, rendimentoPadrao: 45 / 65, rendimentoMedido: null }, tratamento: null, acida: false, raspas: false,
      preparo: 'Fogo baixo 5–10 min sem água até redução espessa. Esfriar totalmente.',
      ordem: 'Bater a redução fria com o creme de leite. Adicionar whey, leite em pó, adoçante e liga. Velocidade média.',
      base: { fruta: 45, whey: 15, leitePo: 10, creme: 12, acucar: 6, agua: 0, raspas: 0, liga: 0.15 } },
    { id: 'abacaxi', nome: 'Abacaxi', formaPronta: 'Redução de abacaxi', categoria: 'Fruta aguada, levemente ácida',
      precoKg: 8.00, aproveitamento: 0.55, proteina100: 0.65, estimativa: true,
      reducao: { ativa: true, rendimentoPadrao: 45 / 65, rendimentoMedido: null },
      tratamento: { tempoMin: 8, tempC: null }, acida: false, raspas: false,
      preparo: 'Cozinhar em fogo baixo 8 min para evaporar água e inativar a bromelina. Esfriar na geladeira.',
      ordem: 'Bater a base branca (creme, whey, leite em pó, adoçante, liga) e incorporar a redução fria no final.',
      base: { fruta: 45, whey: 15, leitePo: 10, creme: 12, acucar: 5, agua: 0, raspas: 0, liga: 0.15 } },
    { id: 'maracuja', nome: 'Maracujá', formaPronta: 'Polpa coada de maracujá', categoria: 'Fruta muito ácida',
      precoKg: 15.99, aproveitamento: 0.35, proteina100: 0.81, estimativa: true,
      reducao: { ativa: false }, tratamento: null, acida: true, raspas: false,
      preparo: 'Pulsar a polpa só para soltar das sementes e peneirar. Usar crua e fria.',
      ordem: 'Bater água, whey, leite em pó, creme, adoçante e liga até creme liso. Em velocidade baixa, despejar o suco frio aos poucos por último.',
      base: { fruta: 30, whey: 17, leitePo: 6, creme: 15, acucar: 9, agua: 10, raspas: 0, liga: 0.15 } },
    { id: 'limao', nome: 'Limão', formaPronta: 'Suco de limão coado', categoria: 'Cítrica, extremamente ácida',
      precoKg: 11.99, aproveitamento: 0.42, proteina100: 0.42, estimativa: true,
      reducao: { ativa: false }, tratamento: null, acida: true, raspas: true,
      preparo: 'Ralar a casca antes de cortar. Espremer na hora, coar, usar frio. Nunca aquecer.',
      ordem: 'Bater água, whey, leite em pó, creme, raspas, adoçante e liga até mousse lisa. Em baixa, adicionar o suco frio em fio por último.',
      base: { fruta: 16, whey: 17, leitePo: 6, creme: 18, acucar: 10, agua: 20, raspas: 0.50, liga: 0.15 } }
  ];

  const config = {
    embalagem: 0.40, palito: 0.10, etiqueta: 0.10, maoObra: 1.00, energia: 0.30, rateio: 0,
    perda: 0.03, margem: 0.45, estimativa: true,
    canais: [ { id: 'pix', nome: 'Direto (Pix)', taxa: 0 }, { id: 'ifood', nome: 'iFood', taxa: 0.262 } ],
    simulacao: { frutaId: 'manga', M: 80, metaModo: 'pct', metaValor: 15, n: 10 }
  };

  return { ingredientes, frutas, config, BACKUP_VERSION: 1 };
});
