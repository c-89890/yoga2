const DB_NAME = "yoga-snap-db";
const STORE = "snaps";
const MAX = 120;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const r = fn(store);
    t.oncomplete = () => resolve(r ? r.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export class SnapshotBook {
  constructor() {
    this.items = [];
    this._readyP = this._load();
  }

  async _load() {
    try {
      const all = await run("readonly", (s) => s.getAll());
      this.items = (all || []).sort((a, b) => b.ts - a.ts).slice(0, MAX);
    } catch (e) {
      console.warn("读取定格记录失败", e);
      this.items = [];
    }
  }

  ready() { return this._readyP; }

  get all() { return this.items; }

  get(id) { return this.items.find((i) => i.id === id) || null; }

  add(item) {
    const rec = {
      ...item,
      id: item.id || String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
      ts: item.ts || Date.now()
    };
    this.items.unshift(rec);
    if (this.items.length > MAX) this.items.length = MAX;
    run("readwrite", (s) => s.put(rec)).catch(() => {});
    return rec;
  }

  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    run("readwrite", (s) => s.delete(id)).catch(() => {});
  }

  clear() {
    this.items = [];
    run("readwrite", (s) => s.clear()).catch(() => {});
  }
}
