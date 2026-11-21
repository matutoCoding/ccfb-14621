// IndexedDB 原生封装
const DB_NAME = 'flora_db'
const VERSION = 1
const STORES = ['venues', 'flowers', 'projects', 'structures', 'placements'] as const
export type StoreName = typeof STORES[number]

let dbp: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, VERSION)
      req.onupgradeneeded = () => {
        const d = req.result
        for (const s of STORES) {
          if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
  }
  return dbp
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(d => new Promise<T>((res, rej) => {
    const t = d.transaction(store, mode)
    const r = fn(t.objectStore(store))
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  }))
}

export const dbAll = <T>(s: StoreName): Promise<T[]> =>
  tx(s, 'readonly', st => st.getAll() as IDBRequest<T[]>)
export const dbGet = <T>(s: StoreName, id: string): Promise<T | undefined> =>
  tx(s, 'readonly', st => st.get(id) as IDBRequest<T | undefined>)
export const dbPut = (s: StoreName, v: unknown): Promise<IDBValidKey> =>
  tx(s, 'readwrite', st => st.put(v) as IDBRequest<IDBValidKey>)
export const dbDel = (s: StoreName, id: string): Promise<undefined> =>
  tx(s, 'readwrite', st => st.delete(id) as IDBRequest<undefined>)
