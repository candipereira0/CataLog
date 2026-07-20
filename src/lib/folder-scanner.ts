// Folder scanning via File System Access API
// Recursively walks a directory tree, finding audio files for import

const AUDIO_EXTENSIONS = new Set([
  ".mp3", ".wav", ".flac", ".aiff", ".ogg", ".m4a", ".aac", ".mp4",
]);

export interface ScannedFile {
  file: File;
  relativePath: string;
  filesize: number;
}

export interface SyncFolderInfo {
  folderName: string;
  syncedAt: number;
  trackCount: number;
}

export function isAudioFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

const SYNC_FOLDER_KEY = "catalog-sync-folder";

/** Store sync folder metadata in localStorage (handles persist across sessions) */
export function storeSyncFolderInfo(info: SyncFolderInfo): void {
  try {
    localStorage.setItem(SYNC_FOLDER_KEY, JSON.stringify(info));
  } catch {
    // localStorage not available
  }
}

/** Retrieve previously stored sync folder info */
export function getSyncFolderInfo(): SyncFolderInfo | null {
  try {
    const raw = localStorage.getItem(SYNC_FOLDER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncFolderInfo;
  } catch {
    return null;
  }
}

/** Remove stored sync folder info */
export function clearSyncFolderInfo(): void {
  try {
    localStorage.removeItem(SYNC_FOLDER_KEY);
  } catch {}
}

/**
 * Check if the File System Access API is available in this browser.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/**
 * Open a directory picker and return the handle.
 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error("File System Access API is not supported in this browser");
  }
  const handle = await window.showDirectoryPicker({ mode: "read" });
  // Verify we have read permission
  const permission =
    (await handle.queryPermission({ mode: "read" })) === "granted" ||
    (await handle.requestPermission({ mode: "read" })) === "granted";
  if (!permission) {
    throw new Error("Read permission was denied for the selected folder");
  }
  return handle;
}

/**
 * Recursively scan a directory handle for audio files.
 * Calls onProgress periodically with the count found so far.
 */
export async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  onProgress?: (found: number, currentPath: string) => void
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];
  let found = 0;

  async function walk(
    dirHandle: FileSystemDirectoryHandle,
    pathPrefix: string
  ): Promise<void> {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === "file" && isAudioFile(name)) {
        const fileHandle = entry as FileSystemFileHandle;
        try {
          const file = await fileHandle.getFile();
          const relativePath = pathPrefix ? `${pathPrefix}/${name}` : name;
          results.push({
            file,
            relativePath,
            filesize: file.size,
          });
          found++;
          onProgress?.(found, relativePath);
        } catch {
          // Skip files we can't read
        }
      } else if (entry.kind === "directory") {
        const subDir = entry as FileSystemDirectoryHandle;
        const subPath = pathPrefix ? `${pathPrefix}/${name}` : name;
        await walk(subDir, subPath);
      }
    }
  }

  await walk(handle, "");
  return results;
}

/**
 * Import scanned files to the server in batches.
 * Sends files via FormData to the import endpoint.
 * Calls onBatchComplete with progress after each batch.
 */
export async function importFiles(
  files: ScannedFile[],
  onBatchComplete?: (imported: number, total: number) => void
): Promise<{ imported: number; skipped: number; total: number }> {
  const BATCH_SIZE = 20;
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const formData = new FormData();

    for (const sf of batch) {
      formData.append("files", sf.file, sf.relativePath);
      // Append relative path as a separate field so the server can store it
      formData.append("relative_paths", sf.relativePath);
    }

    const res = await fetch("/api/tracks/import", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Import failed" }));
      throw new Error((err as { error?: string }).error || "Import failed");
    }

    const data = (await res.json()) as { imported: number; skipped: number };
    imported += data.imported;
    skipped += data.skipped;
    onBatchComplete?.(imported + skipped, files.length);
  }

  return { imported, skipped, total: files.length };
}
