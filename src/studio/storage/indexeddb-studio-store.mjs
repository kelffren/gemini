/* KELO-INDEX
 * area: STUDIO / STORAGE
 * owns: local checkpoints and command journal for crash recovery
 * does-not-own: canonical online world state or publish authority
 * public-api: createStudioStore()
 * online: local recovery cache only; server remains canonical
 */

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

export function createStudioStore({ indexedDBFactory = globalThis.indexedDB, dbName = 'kelo-studio-v1' } = {}) {
  const memoryCheckpoints = new Map(), memoryJournal = new Map();
  let dbPromise = null, seq = 1;

  function openDb() {
    if (!indexedDBFactory) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDBFactory.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('checkpoints')) db.createObjectStore('checkpoints', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('journal')) db.createObjectStore('journal', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('STUDIO_INDEXEDDB_OPEN_FAILED'));
    });
    return dbPromise;
  }

  function put(db, store, value) {
    if (!db) return Promise.resolve();
    return new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  }
  function getAll(db, store) {
    if (!db) return Promise.resolve([]);
    return new Promise((resolve, reject) => { const tx = db.transaction(store, 'readonly'), req = tx.objectStore(store).getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error); });
  }

  async function saveCheckpoint(documentId, document) {
    documentId = String(documentId); const createdAt = Date.now();
    const row = { key: documentId, documentId, createdAt, document: copy(document) };
    memoryCheckpoints.set(documentId, row);
    const db = await openDb(); await put(db, 'checkpoints', row); return copy(row);
  }

  async function appendCommand(documentId, command) {
    documentId = String(documentId); const createdAt = Date.now(), key = `${documentId}:${createdAt}:${seq++}`;
    const row = { key, documentId, createdAt, command: copy(command) };
    if (!memoryJournal.has(documentId)) memoryJournal.set(documentId, []);
    memoryJournal.get(documentId).push(row);
    const db = await openDb(); await put(db, 'journal', row); return copy(row);
  }

  async function loadRecovery(documentId) {
    documentId = String(documentId); const db = await openDb();
    let checkpoint = memoryCheckpoints.get(documentId) || null, journal = memoryJournal.get(documentId)?.slice() || [];
    if (db) {
      const checkpoints = await getAll(db, 'checkpoints'), persistedJournal = await getAll(db, 'journal');
      checkpoint = checkpoints.find(row => row.documentId === documentId) || checkpoint;
      journal = persistedJournal.filter(row => row.documentId === documentId);
    }
    const since = Number(checkpoint?.createdAt) || 0;
    return { checkpoint: checkpoint ? copy(checkpoint) : null, commands: journal.filter(row => row.createdAt >= since).sort((a,b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key)).map(row => copy(row)) };
  }

  async function clearDocument(documentId) {
    documentId = String(documentId); memoryCheckpoints.delete(documentId); memoryJournal.delete(documentId);
    const db = await openDb(); if (!db) return;
    for (const store of ['checkpoints','journal']) {
      const rows = await getAll(db, store);
      await Promise.all(rows.filter(row => row.documentId === documentId).map(row => new Promise((resolve,reject) => { const tx = db.transaction(store,'readwrite'); tx.objectStore(store).delete(row.key); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); })));
    }
  }

  return Object.freeze({ saveCheckpoint, appendCommand, loadRecovery, clearDocument, close: async () => { const db = await openDb(); db?.close?.(); dbPromise = null; } });
}
