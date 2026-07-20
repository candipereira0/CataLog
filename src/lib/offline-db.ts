// IndexedDB cache for offline track metadata, playlists, and tags browsing
// Uses LRU eviction: keeps the most recently viewed 100 tracks

import type { Track } from "./api";

interface CachedTrack {
  id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  subgenre: string | null;
  bpm: number | null;
  musical_key: string | null;
  duration_ms: number | null;
  filesize: number;
  filename: string;
  year: number | null;
  rating: number;
  metadata_status: string;
  cachedAt: number;
}

interface CachedPlaylist {
  id: number;
  name: string;
  description: string | null;
  trackCount: number;
  cachedAt: number;
}

interface CachedTag {
  id: number;
  name: string;
  color: string | null;
  cachedAt: number;
}

const DB_NAME = "catalog-offline";
const DB_VERSION = 2;
const TRACK_STORE = "tracks";
const PLAYLIST_STORE = "playlists";
const TAG_STORE = "tags";
const META_STORE = "meta";
const MAX_TRACKS = 100;
const MAX_PLAYLISTS = 50;
const MAX_TAGS = 200;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TRACK_STORE)) {
          db.createObjectStore(TRACK_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(PLAYLIST_STORE)) {
          db.createObjectStore(PLAYLIST_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(TAG_STORE)) {
          db.createObjectStore(TAG_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("DB blocked"));
    } catch {
      reject(new Error("IndexedDB unavailable"));
    }
  });
}

// ─── Track caching (LRU: keep most recent MAX_TRACKS) ───

export async function cacheTrack(track: Track): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(TRACK_STORE, "readwrite");
    const store = tx.objectStore(TRACK_STORE);
    const cached: CachedTrack = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre,
      subgenre: track.subgenre,
      bpm: track.bpm,
      musical_key: track.musical_key,
      duration_ms: track.duration_ms,
      filesize: track.filesize,
      filename: track.filename,
      year: track.year,
      rating: track.rating,
      metadata_status: track.metadata_status,
      cachedAt: Date.now(),
    };
    store.put(cached);
    await txComplete(tx);

    // Evict oldest if over limit
    await evictOldest(store, db, MAX_TRACKS);
    db.close();
  } catch {
    // IndexedDB not available (private browsing, etc.)
  }
}

export async function cacheTracks(tracks: Track[]): Promise<void> {
  for (const track of tracks) {
    await cacheTrack(track);
  }
}

export async function getCachedTrack(id: number): Promise<CachedTrack | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(TRACK_STORE, "readonly");
    const store = tx.objectStore(TRACK_STORE);
    const result = await new Promise<CachedTrack | undefined>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result ?? null;
  } catch {
    return null;
  }
}

export async function getCachedTracks(): Promise<CachedTrack[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(TRACK_STORE, "readonly");
    const store = tx.objectStore(TRACK_STORE);
    const result = await new Promise<CachedTrack[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result.sort((a, b) => b.cachedAt - a.cachedAt);
  } catch {
    return [];
  }
}

// ─── Playlist caching ───

export async function cachePlaylist(playlist: {
  id: number;
  name: string;
  description: string | null;
  trackCount: number;
}): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE, "readwrite");
    const store = tx.objectStore(PLAYLIST_STORE);
    const cached: CachedPlaylist = {
      ...playlist,
      cachedAt: Date.now(),
    };
    store.put(cached);
    await txComplete(tx);
    await evictOldest(store, db, MAX_PLAYLISTS);
    db.close();
  } catch {}
}

export async function getCachedPlaylists(): Promise<CachedPlaylist[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE, "readonly");
    const store = tx.objectStore(PLAYLIST_STORE);
    const result = await new Promise<CachedPlaylist[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result.sort((a, b) => b.cachedAt - a.cachedAt);
  } catch {
    return [];
  }
}

// ─── Tag caching ───

export async function cacheTags(tags: Array<{ id: number; name: string; color: string | null }>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(TAG_STORE, "readwrite");
    const store = tx.objectStore(TAG_STORE);
    for (const tag of tags) {
      store.put({ ...tag, cachedAt: Date.now() });
    }
    await txComplete(tx);
    await evictOldest(store, db, MAX_TAGS);
    db.close();
  } catch {}
}

export async function getCachedTags(): Promise<CachedTag[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(TAG_STORE, "readonly");
    const store = tx.objectStore(TAG_STORE);
    const result = await new Promise<CachedTag[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return [];
  }
}

// ─── Meta: last-sync timestamp ───

export async function getLastSyncTime(): Promise<number | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const result = await new Promise<{ value: number } | undefined>((resolve, reject) => {
      const req = store.get("lastSync");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result?.value ?? null;
  } catch {
    return null;
  }
}

export async function setLastSyncTime(ts: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    store.put({ key: "lastSync", value: ts });
    await txComplete(tx);
    db.close();
  } catch {}
}

// ─── Utility ───

async function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

async function evictOldest(
  store: IDBObjectStore,
  db: IDBDatabase,
  max: number
): Promise<void> {
  const countReq = store.count();
  const count = await new Promise<number>((resolve, reject) => {
    countReq.onsuccess = () => resolve(countReq.result);
    countReq.onerror = () => reject(countReq.error);
  });

  if (count <= max) return;

  // Get all keys sorted by cachedAt, delete oldest
  const all = await new Promise<CachedTrack[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const toDelete = all
    .sort((a, b) => a.cachedAt - b.cachedAt)
    .slice(0, count - max);

  const tx = db.transaction(store.name, "readwrite");
  const writeStore = tx.objectStore(store.name);
  for (const item of toDelete) {
    writeStore.delete(item.id);
  }
  await txComplete(tx);
}

export async function isOnline(): Promise<boolean> {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export async function getCacheStats(): Promise<{
  tracks: number;
  playlists: number;
  tags: number;
  lastSync: number | null;
}> {
  const [tracks, playlists, tags, lastSync] = await Promise.all([
    getCachedTracks(),
    getCachedPlaylists(),
    getCachedTags(),
    getLastSyncTime(),
  ]);
  return {
    tracks: tracks.length,
    playlists: playlists.length,
    tags: tags.length,
    lastSync,
  };
}

// ─── Directory handle storage (for folder sync) ───

interface StoredFolderInfo {
  folderName: string;
  syncedAt: number;
}

const DIR_STORE = "catalog-sync-folder";

export function storeDirectoryInfo(folderName: string): void {
  try {
    const data: StoredFolderInfo = { folderName, syncedAt: Date.now() };
    localStorage.setItem(DIR_STORE, JSON.stringify(data));
  } catch {}
}

export function getStoredDirectoryInfo(): StoredFolderInfo | null {
  try {
    const raw = localStorage.getItem(DIR_STORE);
    if (!raw) return null;
    return JSON.parse(raw) as StoredFolderInfo;
  } catch {
    return null;
  }
}

export function clearDirectoryInfo(): void {
  try {
    localStorage.removeItem(DIR_STORE);
  } catch {}
}
