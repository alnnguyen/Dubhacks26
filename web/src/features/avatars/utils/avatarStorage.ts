import type { AvatarConfig } from '../types/avatar';
import { normalizeAvatarConfig } from './avatarConfig';

/**
 * Local-only persistence. The small config goes to localStorage; the processed
 * face image (a PNG blob) goes to IndexedDB so localStorage never holds base64.
 */

const CONFIG_KEY = 'jsd.avatar.v1';
const DB_NAME = 'jsd-avatar';
const STORE = 'faces';

export function loadAvatarConfig(): AvatarConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return normalizeAvatarConfig(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeAvatarConfig(null);
  }
}

export function saveAvatarConfig(config: AvatarConfig): boolean {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(normalizeAvatarConfig(config)));
    return true;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function newFaceId() {
  return `face-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveFaceImage(id: string, image: Blob): Promise<void> {
  await withStore('readwrite', (store) => store.put(image, id));
}

/** The stored face, or null if it is missing or storage is unavailable. */
export async function loadFaceImage(id: string): Promise<Blob | null> {
  try {
    const value = await withStore<unknown>('readonly', (store) => store.get(id));
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

export async function deleteFaceImage(id: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(id));
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
