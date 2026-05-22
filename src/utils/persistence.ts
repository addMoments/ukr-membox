let cachedDB: IDBDatabase | null = null;

const DB_NAME = 'storageDB';
const STORE_NAME = 'keyValueStore';
const LSPREFIX = 'lsg';

// Open or get the cached IndexedDB database
const openDB = async (): Promise<IDBDatabase> => {
  if (cachedDB) {
    return cachedDB;
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => {
      cachedDB = request.result;
      cachedDB.onclose = () => { cachedDB = null; };
      cachedDB.onerror = () => { cachedDB = null; };
      resolve(cachedDB);
    };
    request.onerror = (e) => reject(e);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

// Helper function to get the object store, retrying once if the connection is stale
const getStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
  let db = await openDB();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  } catch (e) {
    // Connection was closed or DB was deleted — reset cache and retry once
    cachedDB = null;
    db = await openDB();
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }
};

// Function to set a key-value pair in IndexedDB
const set_key = async (key = '', value: any): Promise<void> => {
  const store = await getStore('readwrite');
  const data = { v: value };
  return new Promise<void>((resolve, reject) => {
    const request = store.put(data, LSPREFIX + key);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
};

// Function to get a value by key from IndexedDB
const get_key = async (key = ''): Promise<any> => {
  const store = await getStore('readonly');
  return new Promise<any>((resolve, reject) => {
    const request = store.get(LSPREFIX + key);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        resolve(result.v);
      } else {
        reject(new Error("Key " + key + " not found"));
      }
    };
    request.onerror = (e) => reject(e);
  });
};

// Function to remove a key from IndexedDB
const rm_key = async (key = '') => {
  const store = await getStore('readwrite');
  store.delete(LSPREFIX + key);  // Remove the key-value pair
};

// Function to list all keys in IndexedDB that start with a given prefix
const ls_key = async (prefix = ''): Promise<string[]> => {
  const store = await getStore('readonly');
  return new Promise<string[]>((resolve, reject) => {
    const keys: string[] = [];
    const range = IDBKeyRange.bound(LSPREFIX + prefix, LSPREFIX + prefix + '\uffff');  // Keys within a specific prefix range
    const request = store.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        keys.push(cursor.key.slice(LSPREFIX.length));  // Remove prefix from the key
        cursor.continue();
      } else {
        resolve(keys);
      }
    };

    request.onerror = (e) => reject(e);
  });
};

/*
declare global {
  interface Window {
    get_key: typeof get_key;
    set_key: typeof set_key;
    rm_key: typeof rm_key;
    ls_key: typeof ls_key;
  }
}
window.get_key = get_key;
window.set_key = set_key;
window.rm_key = rm_key;
window.ls_key = ls_key;*/

export { set_key, get_key, rm_key, ls_key };
