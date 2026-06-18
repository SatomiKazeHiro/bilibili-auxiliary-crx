/**
 * IndexedDB 封装层（带内存 fallback）
 * 数据库名: bili-aux-history-v2
 * 对象存储:
 *   - videos: 所有从 B 站抓取的新视频
 *   - notes: 所有带备注的视频（字段与 Supabase 一致）
 */
(function () {
  'use strict';

  const DB_NAME = 'bili-aux-history-v2';
  const DB_VERSION = 2;
  const VIDEO_STORE = 'videos';
  const NOTE_STORE = 'notes';

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
        delReq.onblocked = () => {
          console.warn('[BiliAux] IndexedDB delete blocked');
          reject(new Error('IndexedDB delete blocked'));
        };
      } else {
        console.error('[BiliAux] IndexedDB open error:', req.error);
        reject(req.error);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      console.log('[BiliAux] IndexedDB opened, stores:', Array.from(db.objectStoreNames));
      // 页面关闭/刷新时主动关闭连接，减少多标签页 blocked
      window.addEventListener('beforeunload', () => {
        try { db.close(); } catch (e) {}
      });
      resolve(db);
    };
    req.onupgradeneeded = (event) => {
      console.log('[BiliAux] IndexedDB upgrade needed, oldVersion:', event.oldVersion, 'newVersion:', event.newVersion);
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
        console.log('[BiliAux] IndexedDB stores created:', VIDEO_STORE, NOTE_STORE);
      } catch (e) {
        console.error('[BiliAux] IndexedDB upgrade error:', e);
        throw e;
      }
    };
    req.onblocked = () => {
      console.warn('[BiliAux] IndexedDB open blocked, waiting for existing connections to close...');
      // 不立即 reject，让 onsuccess/onerror 或外层 timeout 处理
    };
  }

  async function openDB() {
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

  async function withStore(storeName, mode, callback) {
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

  window.BiliAuxDB = {
    // ========== videos（新视频） ==========

    async getVideo(bvid) {
      return withStore(VIDEO_STORE, 'readonly', (store) => store.get(bvid));
    },

    async saveVideo(video) {
      const existing = await this.getVideo(video.bvid);
      const merged = { ...(existing || {}), ...video };
      return withStore(VIDEO_STORE, 'readwrite', (store) => store.put(merged));
    },

    async getAllVideos() {
      return withStore(VIDEO_STORE, 'readonly', (store) => store.getAll());
    },

    // ========== notes（备注视频） ==========

    async getNote(bvid) {
      return withStore(NOTE_STORE, 'readonly', (store) => store.get(bvid));
    },

    async saveNote(note) {
      return withStore(NOTE_STORE, 'readwrite', (store) => store.put(note));
    },

    async getAllNotes() {
      return withStore(NOTE_STORE, 'readonly', (store) => store.getAll());
    },

    async clearNotes() {
      return withStore(NOTE_STORE, 'readwrite', (store) => store.clear());
    },

    async batchSaveNotes(notes) {
      const db = await openDB();
      if (!db) {
        for (const n of notes) {
          memoryNoteStore.set(n.bvid, JSON.parse(JSON.stringify(n)));
        }
        return;
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(NOTE_STORE, 'readwrite');
        const store = tx.objectStore(NOTE_STORE);
        for (const n of notes) {
          store.put(n);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    // ========== Supabase 同步/上传 ==========

    /**
     * 从 Supabase 同步备注到本地 notes 存储。
     * 远程返回空数组 → 不动本地
     * 远程有数据 → 清空本地 notes，用远程数据填充
     * 请求失败 → 不动本地
     */
    async syncNotesFromSupabase() {
      const SB = window.BiliAuxSupabase;
      if (!SB) return 0;
      const remoteNotes = await SB.fetchVideosWithNote();
      if (!remoteNotes || remoteNotes.length === 0) return 0;
      await this.clearNotes();
      await this.batchSaveNotes(remoteNotes);
      return remoteNotes.length;
    },

    /**
     * 将本地全部视频一次性上传到 Supabase（含完整字段）。
     * 会合并 videos 和 notes 中的数据，避免覆盖备注。
     * 返回上传条数。
     */
    async uploadLocalToSupabase() {
      const SB = window.BiliAuxSupabase;
      if (!SB) throw new Error('Supabase not loaded');
      const localVideos = await this.getAllVideos();
      const localNotes = await this.getAllNotes();
      const noteMap = {};
      localNotes.forEach(n => { noteMap[n.bvid] = n; });

      const merged = localVideos.map(v => {
        const note = noteMap[v.bvid];
        if (note) {
          return { ...v, note: note.note, note_updated_at: note.note_updated_at };
        }
        return v;
      });

      // 补充只有 note 没有 video 的数据
      localNotes.forEach(n => {
        if (!merged.some(v => v.bvid === n.bvid)) {
          merged.push(n);
        }
      });

      if (merged.length === 0) return 0;
      const uploaded = await SB.batchUpsert(merged);
      return uploaded;
    }
  };
})();
