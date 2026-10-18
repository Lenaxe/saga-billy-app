const DB_NAME = 'saga-billy-db';
const DB_VERSION = 2;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('saves')) {
        db.createObjectStore('saves', { keyPath: 'slotId' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (db.objectStoreNames.contains('photos')) {
        db.deleteObjectStore('photos');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const db = {
  async putSave(save) {
    const store = await tx('saves', 'readwrite');
    return wrap(store.put(save));
  },
  async getSave(slotId) {
    const store = await tx('saves', 'readonly');
    return wrap(store.get(slotId));
  },
  async getAllSaves() {
    const store = await tx('saves', 'readonly');
    return wrap(store.getAll());
  },
  async deleteSave(slotId) {
    const store = await tx('saves', 'readwrite');
    return wrap(store.delete(slotId));
  },

  async setMeta(key, value) {
    const store = await tx('meta', 'readwrite');
    return wrap(store.put({ key, value }));
  },
  async getMeta(key) {
    const store = await tx('meta', 'readonly');
    const row = await wrap(store.get(key));
    return row ? row.value : undefined;
  },

  async clearAll() {
    const db_ = await openDB();
    await Promise.all(['saves', 'meta'].map(name =>
      wrap(db_.transaction(name, 'readwrite').objectStore(name).clear())
    ));
  }
};
