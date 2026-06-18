import { DB_NAME, DB_VERSION, VIDEO_STORE, NOTE_STORE } from './schema.js';

let dbPromise = null;
let idbFailed = false;
const memoryVideoStore = new Map();
const memoryNoteStore = new Map();

function tryOpen(resolve, reject, isRetry) {
  const req = indexedDB.open(DB_NAME, DB_VERSION);

  req.onerror = () => {
    if (!isRetry && req.error && req.error.name === 'VersionError') {
      console.warn('[BiliAux] IndexedDB version mismatch, deleting and recreating...');
      const delReq = indexedDB.deleteDatabase(DB_NAME);
      delReq.onsuccess = () => tryOpen(resolve, reject, true);
      delReq.onerror = () => reject(delReq.error);
      delReq.onblocked = () => reject(new Error('IndexedDB delete blocked'));
    } else {
      console.error('[BiliAux] IndexedDB open error:', req.error);
      reject(req.error);
    }
  };

  req.onsuccess = () => {
    const db = req.result;
    window.addEventListener('beforeunload', () => {
      try { db.close(); } catch (e) {}
    });
    resolve(db);
  };

  req.onupgradeneeded = (event) => {
    const db = event.target.result;
    try {
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        const videoStore = db.createObjectStore(VIDEO_STORE, { keyPath: 'bvid' });
        videoStore.createIndex('date_uploaded', 'date_uploaded', { unique: false });
      }
      if (!db.objectStoreNames.contains(NOTE_STORE)) {
        const noteStore = db.createObjectStore(NOTE_STORE, { keyPath: 'bvid' });
        noteStore.createIndex('note_updated_at', 'note_updated_at', { unique: false });
      }
    } catch (e) {
      console.error('[BiliAux] IndexedDB upgrade error:', e);
      throw e;
    }
  };

  req.onblocked = () => {
    console.warn('[BiliAux] IndexedDB open blocked, waiting for existing connections to close...');
  };
}

export async function openDB() {
  if (idbFailed) return null;
  if (dbPromise) return dbPromise;

  const openPromise = new Promise((resolve, reject) => {
    tryOpen(resolve, reject, false);
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('IndexedDB open timeout')), 3000);
  });

  dbPromise = Promise.race([openPromise, timeoutPromise]).catch(err => {
    idbFailed = true;
    console.warn('[BiliAux] IndexedDB unavailable, using memory fallback:', err.message);
    return null;
  });

  return dbPromise;
}

export async function withStore(storeName, mode, callback) {
  const db = await openDB();

  if (!db) {
    const isNote = storeName === NOTE_STORE;
    const memoryStore = isNote ? memoryNoteStore : memoryVideoStore;
    const fakeStore = {
      get(bvid) {
        const result = memoryStore.get(bvid) || null;
        return { result, onsuccess: null, onerror: null };
      },
      put(item) {
        memoryStore.set(item.bvid, JSON.parse(JSON.stringify(item)));
        return { result: item.bvid, onsuccess: null, onerror: null };
      },
      getAll() {
        const result = Array.from(memoryStore.values());
        return { result, onsuccess: null, onerror: null };
      },
      clear() {
        memoryStore.clear();
        return { result: undefined, onsuccess: null, onerror: null };
      }
    };
    const result = callback(fakeStore);
    if (result && typeof result === 'object' && result.onsuccess === null) {
      return result.result;
    }
    return result;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = callback(store);
    if (result instanceof IDBRequest) {
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    } else {
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    }
  });
}

export { VIDEO_STORE, NOTE_STORE };
