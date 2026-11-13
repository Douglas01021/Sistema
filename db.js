/* db.js — persistência local em IndexedDB + backup JSON. Sem servidor, sem conta. */
(function (root) {
  'use strict';
  const DB_NAME = 'picoles-proteicos';
  const DB_VERSION = 1;
  const STORES = ['ingredientes', 'frutas', 'receitas', 'lotes', 'config'];
  const BACKUP_VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Falha ao abrir o banco local.'));
      req.onblocked = () => reject(new Error('Banco bloqueado por outra aba. Feche as outras abas do app.'));
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const st = t.objectStore(store);
      let result;
      try { result = fn(st); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve((typeof IDBRequest !== 'undefined' && result instanceof IDBRequest) ? result.result : result);
      t.onerror = () => reject(t.error || new Error('Erro de gravação.'));
      t.onabort = () => reject(t.error || new Error('Gravação cancelada (espaço insuficiente?).'));
    }));
  }

  const api = {
    BACKUP_VERSION,
    async persistir() {
      try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (_) {}
      return false;
    },
    getAll(store) { return tx(store, 'readonly', (st) => st.getAll()); },
    get(store, id) { return tx(store, 'readonly', (st) => st.get(id)); },
    put(store, obj) { if (!obj.id) obj.id = api.novoId(); obj.atualizadoEm = new Date().toISOString(); return tx(store, 'readwrite', (st) => { st.put(obj); return obj; }); },
    del(store, id) { return tx(store, 'readwrite', (st) => st.delete(id)); },
    clear(store) { return tx(store, 'readwrite', (st) => st.clear()); },
    novoId() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); },

    /** Semeia dados iniciais apenas se o banco estiver vazio (atualização do app preserva registros). */
    async semear(seed) {
      const cfg = await api.get('config', 'geral');
      if (cfg) return false;
      for (const k of Object.keys(seed.ingredientes)) await api.put('ingredientes', Object.assign({}, seed.ingredientes[k]));
      for (const f of seed.frutas) await api.put('frutas', JSON.parse(JSON.stringify(f)));
      await api.put('config', Object.assign({ id: 'geral' }, JSON.parse(JSON.stringify(seed.config))));
      return true;
    },

    async exportar() {
      const data = { app: 'picoles-proteicos', versaoBackup: BACKUP_VERSION, geradoEm: new Date().toISOString(), dados: {} };
      for (const s of STORES) data.dados[s] = await api.getAll(s);
      return data;
    },

    /** Valida o JSON antes de substituir. Retorna {ok, erros, resumo}. */
    validarBackup(obj) {
      const erros = [];
      if (!obj || typeof obj !== 'object') erros.push('Arquivo não é um JSON válido.');
      else {
        if (obj.app !== 'picoles-proteicos') erros.push('Não é um backup do Picolés Proteicos.');
        if (typeof obj.versaoBackup !== 'number') erros.push('Versão do backup ausente.');
        else if (obj.versaoBackup > BACKUP_VERSION) erros.push(`Backup da versão ${obj.versaoBackup}; este app lê até a versão ${BACKUP_VERSION}. Atualize o app.`);
        if (!obj.dados || typeof obj.dados !== 'object') erros.push('Bloco "dados" ausente.');
        else {
          for (const s of STORES) {
            if (!Array.isArray(obj.dados[s])) { erros.push(`Lista "${s}" ausente ou inválida.`); continue; }
            obj.dados[s].forEach((r, i) => { if (!r || typeof r !== 'object' || !r.id) erros.push(`${s}[${i}] sem id.`); });
          }
          if (!erros.length) {
            const cfg = obj.dados.config.find((c) => c.id === 'geral');
            if (!cfg) erros.push('Configuração geral ausente.');
            const ids = new Set(obj.dados.ingredientes.map((i) => i.id));
            for (const k of ['whey', 'leitePo', 'creme', 'acucar', 'liga']) if (!ids.has(k)) erros.push(`Ingrediente obrigatório ausente: ${k}.`);
          }
        }
      }
      const resumo = obj && obj.dados ? STORES.map((s) => `${s}: ${(obj.dados[s] || []).length}`).join(' · ') : '';
      return { ok: erros.length === 0, erros, resumo };
    },

    /** Substitui tudo pelo backup (já validado). Se falhar no meio, os dados anteriores são restaurados. */
    async restaurar(obj) {
      const v = api.validarBackup(obj);
      if (!v.ok) throw new Error(v.erros.join(' '));
      const anterior = await api.exportar();
      try {
        for (const s of STORES) { await api.clear(s); for (const r of obj.dados[s]) await tx(s, 'readwrite', (st) => st.put(r)); }
      } catch (e) {
        for (const s of STORES) { await api.clear(s); for (const r of anterior.dados[s]) await tx(s, 'readwrite', (st) => st.put(r)); }
        throw new Error('Restauração falhou e os dados anteriores foram mantidos: ' + e.message);
      }
      return v.resumo;
    }
  };

  root.PPDB = api;
})(typeof self !== 'undefined' ? self : this);
