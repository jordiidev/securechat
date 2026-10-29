import type { Identity } from './identity';

const DATABASE_NAME = 'secure-chat';
const STORE_NAME = 'identity';
const RECORD_KEY = 'current';

interface StoredIdentity extends Identity {
  userId: string;
}

/**
 * Keeps the private key in IndexedDB as a non-extractable CryptoKey,
 * so a page reload does not require the password again but scripts cannot read the key bytes.
 */
export async function saveIdentity(userId: string, identity: Identity): Promise<void> {
  const record: StoredIdentity = { userId, ...identity };
  await run('readwrite', (store) => store.put(record, RECORD_KEY));
}

export async function loadIdentity(userId: string): Promise<Identity | null> {
  const record = await run<StoredIdentity | undefined>('readonly', (store) => store.get(RECORD_KEY));
  if (!record || record.userId !== userId) return null;
  return { privateKey: record.privateKey, publicKey: record.publicKey };
}

export async function clearIdentity(): Promise<void> {
  await run('readwrite', (store) => store.delete(RECORD_KEY));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T = unknown>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = operation(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
