const DB_NAME = 'edooqoo-public-placement';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

interface StoredRecording {
  questionId: string;
  blob: Blob;
  expiresAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser cannot save local recordings.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'questionId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local recording storage.'));
    request.onblocked = () => reject(new Error('Local recording storage is blocked by another tab.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Local recording operation failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local recording operation was interrupted.'));
    });
  } finally {
    database.close();
  }
}

export async function savePublicPlacementRecording(
  questionId: string,
  blob: Blob,
  expiresAt: number,
): Promise<string> {
  if (!blob.size) throw new Error('The recording is empty.');
  await withStore('readwrite', (store) => store.put({ questionId, blob, expiresAt } satisfies StoredRecording));
  return URL.createObjectURL(blob);
}

export async function loadPublicPlacementRecordings(now: number = Date.now()): Promise<Record<string, string>> {
  const recordings = await withStore('readonly', (store) => store.getAll() as IDBRequest<StoredRecording[]>);
  const urls: Record<string, string> = {};
  for (const recording of recordings) {
    if (!recording || typeof recording.questionId !== 'string' || !(recording.blob instanceof Blob)) continue;
    if (!Number.isFinite(recording.expiresAt) || recording.expiresAt <= now) {
      await deletePublicPlacementRecording(recording.questionId);
      continue;
    }
    urls[recording.questionId] = URL.createObjectURL(recording.blob);
  }
  return urls;
}

export async function deletePublicPlacementRecording(questionId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(questionId));
}

export async function clearPublicPlacementRecordings(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}
