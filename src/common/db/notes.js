import { withStore, openDB, NOTE_STORE as NOTE_STORE_NAME } from './core.js';

export async function getNote(bvid) {
  return withStore(NOTE_STORE_NAME, 'readonly', (store) => store.get(bvid));
}

export async function saveNote(note) {
  return withStore(NOTE_STORE_NAME, 'readwrite', (store) => store.put(note));
}

export async function getAllNotes() {
  return withStore(NOTE_STORE_NAME, 'readonly', (store) => store.getAll());
}

export async function clearNotes() {
  return withStore(NOTE_STORE_NAME, 'readwrite', (store) => store.clear());
}

export async function batchSaveNotes(notes) {
  const db = await openDB();
  if (!db) {
    // 内存 fallback 在 withStore 中已处理，这里备用
    for (const n of notes) {
      await saveNote(n);
    }
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(NOTE_STORE_NAME);
    for (const n of notes) {
      store.put(n);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export { NOTE_STORE_NAME as NOTE_STORE };
