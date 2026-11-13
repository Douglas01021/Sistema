/* Teste de navegador (Chrome headless): abre o app, confere valores, SW, IndexedDB, reabertura e backup.
   Uso: node tests/browser.test.js http://localhost:8765/  (requer puppeteer-core e google-chrome) */
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const assert = require('assert');
const URL = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const erros = []; page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#s-resultado .destaque');

  const txt = await page.$eval('#s-resultado', (el) => el.innerText);
  assert.ok(/12 g/.test(txt), 'proteína 12 g'); assert.ok(/824,7/.test(txt), 'mistura 824,7x'); assert.ok(/800 g/.test(txt), 'líquido 800 g');
  console.log('✔ Manga 80 g 15% 10 un → 12 g, 800 g, 824,7 g');

  await page.click('.alternar button[data-modo="g"]'); await page.waitForSelector('#s-meta');
  await page.$eval('#s-meta', (i) => { i.value = '15'; i.dispatchEvent(new Event('input')); });
  const t2 = await page.$eval('#s-resultado', (el) => el.innerText);
  assert.ok(/18,75%/.test(t2), 'meta 18,75%'); assert.ok(/15 g/.test(t2), 'proteína 15 g');
  console.log('✔ Meta 15 g/un → 18,75%');

  // service worker e cache
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 15000 }).catch(() => {});
  const cache = await page.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); return (await c.keys()).map((r) => r.url.split('/').pop()); });
  assert.ok(cache.includes('app.js') && cache.includes('calc.js') && cache.includes('icon-512.png'), 'cache incompleto: ' + cache);
  console.log('✔ Service worker ativo, cache com', cache.length, 'arquivos');

  // salvar receita, mudar preço do whey, reabrir
  await page.click('#s-salvar-receita'); await new Promise((r) => setTimeout(r, 400));
  await page.click('.abas button[data-tela="ingredientes"]');
  await page.$eval('#i-whey-preco', (i) => { i.value = '259,90'; i.dispatchEvent(new Event('input')); });
  await new Promise((r) => setTimeout(r, 900));
  await page.goto(URL, { waitUntil: 'networkidle0' }); await page.waitForSelector('#s-resultado .destaque');
  const preco = await page.$eval('#i-whey-preco', (i) => i.value);
  assert.strictEqual(preco, '259,9', 'preço do whey persistiu: ' + preco);
  const nRec = await page.$$eval('[data-rec]', (els) => els.length);
  assert.strictEqual(nRec, 1, 'receita persistiu');
  const metaModo = await page.$eval('.alternar button.ativo', (b) => b.dataset.modo);
  assert.strictEqual(metaModo, 'g', 'simulação persistiu');
  console.log('✔ Fechar/reabrir: preço do whey, receita e simulação preservados');

  // offline: bloqueia rede e recarrega
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#s-resultado .destaque', { timeout: 10000 });
  console.log('✔ Recarga em modo offline servida pelo cache');
  await page.setOfflineMode(false);

  // backup: exportar (via API) e validar/restaurar
  const bk = await page.evaluate(async () => PPDB.exportar());
  assert.strictEqual(bk.versaoBackup, 1); assert.strictEqual(bk.dados.receitas.length, 1);
  const inval = await page.evaluate(() => PPDB.validarBackup({ app: 'outro' }));
  assert.ok(!inval.ok, 'backup inválido rejeitado');
  await page.evaluate(() => PPDB.del('receitas', PPApp.S.receitas[0].id));
  const res = await page.evaluate(async (b) => { await PPDB.restaurar(b); return (await PPDB.getAll('receitas')).length; }, bk);
  assert.strictEqual(res, 1, 'restauração devolveu a receita');
  console.log('✔ Backup: exportação v1, validação e restauração');

  assert.deepStrictEqual(erros, [], 'erros no console: ' + erros.join(' | '));
  console.log('✔ Sem erros de JavaScript');
  await browser.close();
  console.log('\nTestes de navegador concluídos.');
})().catch((e) => { console.error('✖', e.message); process.exit(1); });
