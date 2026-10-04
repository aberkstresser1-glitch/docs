export type CachedDocument = {
  id: string;
  title: string;
  templateKey: string;
  status: string;
  updatedAt: string;
  finalizedAt?: string | null;
  pdfFileId?: string | null;
};

type CachedFile = {
  id: string;
  blob: Blob;
  mimeType: string;
  updatedAt: string;
};

const DB_NAME = "docs-offline";
const DB_VERSION = 1;
const DOCUMENTS_STORE = "documents";
const FILES_STORE = "files";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(DOCUMENTS_STORE)) {
        database.createObjectStore(DOCUMENTS_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(FILES_STORE)) {
        database.createObjectStore(FILES_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function cacheDocument(document: CachedDocument) {
  const database = await openDatabase();
  const transaction = database.transaction(DOCUMENTS_STORE, "readwrite");
  transaction.objectStore(DOCUMENTS_STORE).put(document);
  await complete(transaction);
  database.close();
}

export async function listCachedDocuments(): Promise<CachedDocument[]> {
  const database = await openDatabase();
  const transaction = database.transaction(DOCUMENTS_STORE, "readonly");
  const request = transaction.objectStore(DOCUMENTS_STORE).getAll();

  const records = await new Promise<CachedDocument[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as CachedDocument[]);
    request.onerror = () => reject(request.error);
  });

  await complete(transaction);
  database.close();

  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function cachePdf(id: string, blob: Blob) {
  const database = await openDatabase();
  const transaction = database.transaction(FILES_STORE, "readwrite");

  const file: CachedFile = {
    id,
    blob,
    mimeType: blob.type || "application/pdf",
    updatedAt: new Date().toISOString(),
  };

  transaction.objectStore(FILES_STORE).put(file);
  await complete(transaction);
  database.close();
}

export async function getCachedPdf(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const transaction = database.transaction(FILES_STORE, "readonly");
  const request = transaction.objectStore(FILES_STORE).get(id);

  const file = await new Promise<CachedFile | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as CachedFile | undefined);
    request.onerror = () => reject(request.error);
  });

  await complete(transaction);
  database.close();

  return file?.blob ?? null;
}
