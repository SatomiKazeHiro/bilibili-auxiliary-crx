/**
 * IndexedDB 封装层
 * 数据库名: bilibili-history-aux
 * 对象存储: videos (主键 bvid)
 */
(function () {
  'use strict';

  const DB_NAME = 'bilibili-history-aux';
  const DB_VERSION = 1;
  const STORE_NAME = 'videos';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'bvid' });
          store.createIndex('uploadDate', 'uploadDate', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
    return dbPromise;
  }

  async function withStore(mode, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
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

  window.BiliAuxDB = {
    async getVideo(bvid) {
      return withStore('readonly', (store) => store.get(bvid));
    },

    async saveVideo(video) {
      const existing = await this.getVideo(video.bvid);
      const merged = { ...(existing || {}), ...video, updatedAt: Date.now() };
      if (!video.hasOwnProperty('note') && existing && existing.note !== undefined) {
        merged.note = existing.note;
      }
      return withStore('readwrite', (store) => store.put(merged));
    },

    async updateNote(bvid, note) {
      const existing = await this.getVideo(bvid);
      const data = existing || { bvid };
      data.note = note;
      data.updatedAt = Date.now();
      return withStore('readwrite', (store) => store.put(data));
    },

    async getAllVideos() {
      return withStore('readonly', (store) => store.getAll());
    },

    async batchSave(videos) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const now = Date.now();
        for (const v of videos) {
          v.updatedAt = now;
          store.put(v);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  };
})();
