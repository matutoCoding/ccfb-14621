import { STORAGE_KEYS } from './constants'

type StoreName = keyof typeof STORAGE_KEYS.stores

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(STORAGE_KEYS.db, STORAGE_KEYS.version)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of Object.values(STORAGE_KEYS.stores)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORAGE_KEYS.stores[store], mode)
        const request = run(transaction.objectStore(STORAGE_KEYS.stores[store]))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
  )
}

export const idb = {
  async getAll<T>(store: StoreName): Promise<T[]> {
    return tx(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
  },

  async get<T>(store: StoreName, id: string): Promise<T | undefined> {
    return tx(store, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>)
  },

  async put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
    await tx(store, 'readwrite', (s) => s.put(value))
  },

  async bulkPut<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORAGE_KEYS.stores[store], 'readwrite')
      const objectStore = transaction.objectStore(STORAGE_KEYS.stores[store])
      for (const value of values) objectStore.put(value)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  },

  async remove(store: StoreName, id: string): Promise<void> {
    await tx(store, 'readwrite', (s) => s.delete(id))
  },

  async clear(store: StoreName): Promise<void> {
    await tx(store, 'readwrite', (s) => s.clear())
  }
}
