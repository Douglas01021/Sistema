# Picolés Proteicos (beta)

PWA offline para formular picolés proteicos: escolhe a fruta, o peso, a meta de proteína e o lote; calcula gramagens, compra de fruta, preparo, custo e preço (Pix e iFood). Sem servidor, sem conta — os dados ficam no celular (IndexedDB) com backup/restauração em JSON.

## Arquivos
| Arquivo | Função |
|---|---|
| `index.html`, `styles.css`, `app.js` | Interface (3 telas: Simular · Ingredientes e custos · Receitas e lotes) |
| `calc.js` | Motor de cálculo puro (proteína, rendimento, compra, custo, preço) |
| `seed.js` | Dados iniciais editáveis (marcados como estimativas) |
| `db.js` | IndexedDB + exportar/restaurar backup (formato v1, validado) |
| `sw.js`, `manifest.json`, `icons/` | PWA instalável e offline |
| `tests/calc.test.js` | Testes automatizados do motor |

## Rodar localmente
```bash
node tests/calc.test.js          # testes do cálculo
python3 -m http.server 8080      # abre http://localhost:8080
```
Service worker exige HTTPS **ou** `localhost`.

## Hospedagem estática HTTPS (GitHub Pages)
1. Envie os arquivos para a raiz do repositório (ou para a pasta `docs/`).
2. No GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / root** → Save.
3. O app fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Netlify, Cloudflare Pages e Vercel também funcionam: basta publicar a pasta como site estático.

## Instalar no Android (Chrome)
1. Abra a URL HTTPS no Chrome e espere carregar uma vez com internet.
2. Menu ⋮ → **Instalar aplicativo** (ou "Adicionar à tela inicial").
3. Abra pelo ícone: roda em tela cheia e funciona em modo avião.

## Atualizar o app sem perder dados
Altere `VERSAO` em `sw.js` e publique. Os registros ficam no IndexedDB e não são apagados; o usuário vê um aviso para fechar e reabrir o app.

## Regras de cálculo
- **Whey** `= M × (p − q) ÷ (w − q)` — M peso da unidade, p meta (fração), q proteína da base sem whey, w proteína do whey pelo rótulo. O restante segue as proporções da fórmula-base do sabor. Fora da faixa (p < q ou p ≥ w) o app pede ajuste.
- **Mistura a preparar** `= peso líquido ÷ (1 − perda)`.
- **Compra de fruta** `= fruta pronta ÷ rendimento da redução ÷ aproveitamento`.
- **Preço** `= custo ÷ [(1 − taxa) × (1 − margem)]`, margem sobre o valor recebido.

## Testes executados aqui
- ✔ Manga 80 g · 15 % · 10 un → 12,0 g de proteína, 800 g líquido, 824,74 g de mistura (3 % de perda)
- ✔ Mesmo picolé com meta 15 g/un → 18,75 % e whey maior
- ✔ Cinco sabores: formulação, soma das gramagens = massa, cadastro completo
- ✔ Custo acompanha mudança do preço do whey; custo por unidade vendável quando o lote rende menos
- ✔ Preço Pix (0 %) e iFood (26,2 %); mensagens de ajuste; cadastro incompleto de fruta nova
- ✔ Chrome headless: app abre, service worker registra e cacheia os arquivos, IndexedDB semeia e persiste

## Depende de um Android real
Instalação pelo Chrome, uso em modo avião após instalado, fechar/reabrir pelo ícone e o `navigator.storage.persist()` real do aparelho.
