let cachedDB: IDBDatabase | null = null;
let openPromise: Promise<IDBDatabase> | null = null;

const DB_NAME = 'storageDB';
const STORE_NAME = 'keyValueStore';
const LSPREFIX = 'lsg';
// Onarim sirasinda baska bir sekme bagli kalirsa sonsuza kadar beklememek icin ust sinir.
const BLOCKED_TIMEOUT_MS = 5000;

// Ne: IndexedDB hic acilamadiginda devreye giren yedek depolama (once localStorage,
//     o da yoksa bellek).
// Nasil: Yedek YALNIZCA store hic acilamazsa (getStore firlatirsa) aktiflesir; acilmis
//        bir store'daki tekil istek hatasi eskisi gibi reject eder.
// Neden: Token IndexedDB'de tutuluyor. Safari gizli mod, uygulama ici tarayicilar
//        (Instagram/Viber/Facebook) ve "tum cerezleri engelle" ayarinda indexedDB.open
//        reddediyor; token saklanamayinca pgREST istekleri Authorization header'i olmadan
//        gidiyor, proxy 401 donuyor ve misafir 404 sayfasina dusuyordu.
// Dikkat: Yedege gecis sadece "hic acilamadi" durumunda olmali. Gecici bir hatada kalici
//        olarak yedege gecilirse IndexedDB'de duran mevcut token gorunmez olur ve
//        kullanici oturumu kapanmis gibi davranir.
let fallbackActive = false;
let useLocalStorage: boolean | null = null;
const memoryStore = new Map<string, string>();

const activateFallback = (err: unknown) => {
  if (fallbackActive) { return; }
  fallbackActive = true;
  const reason = err instanceof Error ? err.message : String(err);
  console.warn('[persistence] IndexedDB kullanilamiyor, yedek depolamaya geciliyor:', reason);
};

const localStorageUsable = (): boolean => {
  if (useLocalStorage !== null) { return useLocalStorage; }
  try {
    const probe = LSPREFIX + '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    useLocalStorage = true;
  } catch {
    useLocalStorage = false;
  }
  return useLocalStorage;
};

const fbSet = (fullKey: string, value: any): void => {
  const raw = JSON.stringify({ v: value });
  if (localStorageUsable()) {
    try {
      window.localStorage.setItem(fullKey, raw);
      return;
    } catch {
      // Kota dolmus ya da yazma engellenmis olabilir; bellege dus.
      useLocalStorage = false;
    }
  }
  memoryStore.set(fullKey, raw);
};

const fbGetRaw = (fullKey: string): string | null => {
  if (localStorageUsable()) {
    try {
      const raw = window.localStorage.getItem(fullKey);
      if (raw !== null) { return raw; }
    } catch {
      useLocalStorage = false;
    }
  }
  return memoryStore.get(fullKey) ?? null;
};

const fbRemove = (fullKey: string): void => {
  if (localStorageUsable()) {
    try { window.localStorage.removeItem(fullKey); } catch { useLocalStorage = false; }
  }
  memoryStore.delete(fullKey);
};

const fbKeys = (fullPrefix: string): string[] => {
  const keys = new Set<string>();
  if (localStorageUsable()) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) { keys.add(k); }
      }
    } catch {
      useLocalStorage = false;
    }
  }
  memoryStore.forEach((_v, k) => {
    if (k.startsWith(fullPrefix)) { keys.add(k); }
  });
  return Array.from(keys);
};

// get_key'in "bulunamadi" davranisi yedek yolda da aynen korunur: reject eder.
const fbReadOrThrow = (fullKey: string, key: string): any => {
  const raw = fbGetRaw(fullKey);
  if (raw !== null) {
    try {
      return JSON.parse(raw).v;
    } catch {
      // Bozuk kayit: yok sayilir, asagida "bulunamadi" olarak dondurulur.
    }
  }
  throw new Error("Key " + key + " not found");
};

// Ne: DB'yi versiyon belirtmeden acar ve store yoksa upgrade sirasinda yaratir.
// Nasil: indexedDB.open(DB_NAME) versiyonsuz cagrilir; DB varsa mevcut versiyonuyla baglanilir,
//        DB hic yoksa tarayici onu v1 olarak yaratir ve onupgradeneeded tetiklenir.
// Neden: Versiyonu sabit 1 vermek, DB baska bir versiyondaysa VersionError uretir. Versiyonsuz
//        acmak her build icin (ve rollback sonrasi icin) guvenlidir.
const rawOpen = (): Promise<IDBDatabase> =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'));
  });

// Ne: Object store'u olmayan bozuk DB'yi siler.
// Nasil: deleteDatabase; baska sekme bagliysa onblocked gelir, sinirli sure beklenir.
// Neden: Store'suz bir DB'de hicbir veri olamaz, dolayisiyla silmek veri kaybettirmez ve
//        DB'yi versiyon artirmadan (v1'de kalarak) yeniden yaratmayi mumkun kilar.
const deleteDB = (): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) { return; }
      settled = true;
      fn();
    };

    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => settle(resolve);
    request.onerror = () => settle(() => reject(request.error ?? new Error('IndexedDB could not be deleted')));
    request.onblocked = () => {
      // Silme istegi iptal olmaz; engelleyen baglanti kapaninca onsuccess yine gelir.
      setTimeout(() => settle(() => reject(new Error('IndexedDB repair was blocked by another tab'))), BLOCKED_TIMEOUT_MS);
    };
  });

// Ne: Kullanilabilir (store'u kesinlikle var olan) bir DB baglantisi kurar.
// Nasil: Acar; store eksikse DB'yi silip sifirdan yaratir.
// Neden: DB v1'de ama store'suz kaldiginda onupgradeneeded bir daha tetiklenmez ve
//        her transaction "One of the specified object stores was not found" ile patlar.
//        Bu durumdan kullanicidan bir sey istemeden cikabilmek gerekiyor.
const connect = async (): Promise<IDBDatabase> => {
  let db = await rawOpen();

  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.close();
    await deleteDB();
    db = await rawOpen();
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.close();
      throw new Error(`IndexedDB store "${STORE_NAME}" could not be created`);
    }
  }

  // Baska bir sekme silme/upgrade istedi: bu baglantiyi kapatalim ki islem engellenmesin.
  db.onversionchange = () => {
    db.close();
    if (cachedDB === db) { cachedDB = null; }
  };
  db.onclose = () => {
    if (cachedDB === db) { cachedDB = null; }
  };

  return db;
};

// Open or get the cached IndexedDB database
// Not: Es zamanli cagrilarda tek bir acilis istegi paylasilir (openPromise), yoksa ilk acilis
// tamamlanmadan gelen her cagri ayri bir indexedDB.open baslatirdi.
const openDB = (): Promise<IDBDatabase> => {
  if (cachedDB) {
    return Promise.resolve(cachedDB);
  }

  if (!openPromise) {
    openPromise = connect().then(
      (db) => { cachedDB = db; openPromise = null; return db; },
      (err) => { openPromise = null; throw err; }
    );
  }

  return openPromise;
};

const resetConnection = () => {
  if (cachedDB) {
    try { cachedDB.close(); } catch { /* baglanti zaten kapali olabilir */ }
  }
  cachedDB = null;
  openPromise = null;
};

// Helper function to get the object store, retrying once if the connection is stale
const getStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  } catch (e) {
    // Baglanti kapanmis, DB silinmis ya da store eksik olabilir. Baglantiyi kapatip
    // sifirdan kuruyoruz; connect() bozuk DB'yi bu asamada onarir.
    resetConnection();
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }
};

// Function to set a key-value pair in IndexedDB
const set_key = async (key = '', value: any): Promise<void> => {
  const fullKey = LSPREFIX + key;
  if (fallbackActive) { fbSet(fullKey, value); return; }

  let store: IDBObjectStore;
  try {
    store = await getStore('readwrite');
  } catch (e) {
    activateFallback(e);
    fbSet(fullKey, value);
    return;
  }

  const data = { v: value };
  return new Promise<void>((resolve, reject) => {
    const request = store.put(data, fullKey);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
};

// Function to get a value by key from IndexedDB
const get_key = async (key = ''): Promise<any> => {
  const fullKey = LSPREFIX + key;
  if (fallbackActive) { return fbReadOrThrow(fullKey, key); }

  let store: IDBObjectStore;
  try {
    store = await getStore('readonly');
  } catch (e) {
    activateFallback(e);
    return fbReadOrThrow(fullKey, key);
  }

  return new Promise<any>((resolve, reject) => {
    const request = store.get(fullKey);
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
  const fullKey = LSPREFIX + key;
  if (fallbackActive) { fbRemove(fullKey); return; }

  let store: IDBObjectStore;
  try {
    store = await getStore('readwrite');
  } catch (e) {
    activateFallback(e);
    fbRemove(fullKey);
    return;
  }
  store.delete(fullKey);  // Remove the key-value pair
};

// Function to list all keys in IndexedDB that start with a given prefix
const ls_key = async (prefix = ''): Promise<string[]> => {
  const fullPrefix = LSPREFIX + prefix;
  const fbList = () => fbKeys(fullPrefix).map((k) => k.slice(LSPREFIX.length));
  if (fallbackActive) { return fbList(); }

  let store: IDBObjectStore;
  try {
    store = await getStore('readonly');
  } catch (e) {
    activateFallback(e);
    return fbList();
  }

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
