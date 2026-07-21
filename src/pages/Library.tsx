import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, type Track, type Tag } from "../lib/api";
import GenrePicker from "../components/GenrePicker";
import {
  isFileSystemAccessSupported,
  pickDirectory,
  scanDirectory,
  importFiles,
  type ScannedFile,
  getSyncFolderInfo,
  storeSyncFolderInfo,
  clearSyncFolderInfo,
} from "../lib/folder-scanner";

function formatDuration(ms: number | null): string {
  if (!ms) return "--:--";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StarRating({ rating, onChange, size = "sm" }: { rating: number; onChange?: (r: number) => void; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i)}
          className={`${sizeClass} ${onChange ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform ${i <= rating ? "text-amber-400" : "text-gray-600"}`}
        >
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </span>
  );
}

export default function Library() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [aiTagLoading, setAiTagLoading] = useState(false);
  const [aiTagError, setAiTagError] = useState<string | null>(null);
  const [crossRefLoading, setCrossRefLoading] = useState(false);
  const [crossRefResult, setCrossRefResult] = useState<{
    spotify: { genres: string[]; tags: string[]; url: string | null } | null;
    youtube: { genres: string[]; tags: string[]; url: string | null } | null;
    consensus_genres: string[];
    suggested_genres: string[];
  } | null>(null);
  const [crossRefError, setCrossRefError] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ genre?: string; genres?: string[]; key?: string; bpm_min?: number; bpm_max?: number }>({});
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folder sync state
  const [syncFolderName, setSyncFolderName] = useState<string | null>(
    () => getSyncFolderInfo()?.folderName ?? null
  );
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ found: 0, currentPath: "" });
  const [importProgress, setImportProgress] = useState({ processed: 0, total: 0 });
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [newTracksCount, setNewTracksCount] = useState(0);

  // Tier gating
  const [showTierGate, setShowTierGate] = useState(false);
  const [tierGateMessage, setTierGateMessage] = useState("");
  const isFreeTier = user?.tier === "free";

  // Sync state
  const [syncStatus, setSyncStatus] = useState<{ local: number; syncing: number; cloud: number; pending_download: number } | null>(null);
  const [syncLoading, setSyncLoading] = useState<Record<number, boolean>>({});

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listTracks({ page, sort, order, limit: 50, ...filters });
      setTracks(data.tracks);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch tracks:", err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, filters]);

  const fetchFilters = useCallback(async () => {
    try {
      const [g, k] = await Promise.all([api.getGenres(), api.getKeys()]);
      setGenres(g.genres);
      setKeys(k.keys);
    } catch {}
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const s = await api.getSyncStatus();
      setSyncStatus(s);
    } catch {}
  }, []);

  useEffect(() => { fetchTracks(); }, [fetchTracks]);
  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchSyncStatus(); }, [fetchSyncStatus]);

  // Listen for search result clicks from Navbar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trackId: number };
      if (detail?.trackId) {
        api.getTrack(detail.trackId).then(setSelectedTrack).catch(console.error);
      }
    };
    window.addEventListener("catalog:open-track", handler);
    return () => window.removeEventListener("catalog:open-track", handler);
  }, []);

  // Auto-watch: periodic re-scan when user is on the Library page
  useEffect(() => {
    if (!syncFolderName) return;

    // Poll every 5 minutes
    syncIntervalRef.current = setInterval(() => {
      handleReScan(true);
    }, 5 * 60 * 1000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [syncFolderName]);

  const handleSort = (col: string) => {
    if (sort === col) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(col);
      setOrder(col === "created_at" ? "desc" : "asc");
    }
    setPage(1);
  };

  const handleUpload = async (files: FileList | File[]) => {
    if (files.length === 0) return;

    // Tier gating: free users limited to 500 tracks
    if (isFreeTier && total + files.length > 500) {
      setTierGateMessage(`You've reached the 500-track limit on the Free plan. Upgrade to Pro for unlimited tracks.`);
      setShowTierGate(true);
      return;
    }

    setUploading(true);
    try {
      await api.uploadTracks(files);
      await fetchTracks();
      await fetchFilters();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // ─── Folder Sync ───

  const handleSyncFolder = async () => {
    if (!isFileSystemAccessSupported()) {
      alert("Folder sync requires Chrome or Edge. You can still drag-and-drop individual files below.");
      return;
    }

    try {
      setScanning(true);
      setScanProgress({ found: 0, currentPath: "" });

      const dirHandle = await pickDirectory();
      const folderName = dirHandle.name;

      // Scan the directory
      const scannedFiles = await scanDirectory(dirHandle, (found, currentPath) => {
        setScanProgress({ found, currentPath });
      });

      if (scannedFiles.length === 0) {
        alert("No audio files found in this folder.");
        setScanning(false);
        return;
      }

      // Import files in batches
      setImportProgress({ processed: 0, total: scannedFiles.length });

      const result = await importFiles(scannedFiles, (processed, total) => {
        setImportProgress({ processed, total });
      });

      // Store sync folder info
      storeSyncFolderInfo({
        folderName,
        syncedAt: Date.now(),
        trackCount: result.imported,
      });
      setSyncFolderName(folderName);

      await fetchTracks();
      await fetchFilters();
    } catch (err) {
      console.error("Folder sync failed:", err);
      const msg = err instanceof Error ? err.message : "Folder sync failed";
      if (msg.includes("not supported") || msg.includes("permission")) {
        alert(msg);
      } else {
        alert("Folder sync failed. Please try again.");
      }
    } finally {
      setScanning(false);
    }
  };

  const handleReScan = async (isAutoPoll = false) => {
    if (!isFileSystemAccessSupported()) return;

    try {
      // We need to re-pick the directory since handles aren't persistent
      const dirHandle = await pickDirectory();
      const folderName = dirHandle.name;

      setScanning(true);
      setScanProgress({ found: 0, currentPath: "" });

      const scannedFiles = await scanDirectory(dirHandle, (found, currentPath) => {
        setScanProgress({ found, currentPath });
      });

      if (scannedFiles.length === 0) {
        setScanning(false);
        return;
      }

      setImportProgress({ processed: 0, total: scannedFiles.length });
      const result = await importFiles(scannedFiles, (processed, total) => {
        setImportProgress({ processed, total });
      });

      storeSyncFolderInfo({
        folderName,
        syncedAt: Date.now(),
        trackCount: result.imported,
      });
      setSyncFolderName(folderName);

      if (result.imported > 0) {
        if (isAutoPoll) {
          setNewTracksCount((prev) => prev + result.imported);
          setSyncNotification(`${result.imported} new tracks found in your music folder`);
        }
        await fetchTracks();
        await fetchFilters();
      }
    } catch (err) {
      if (!isAutoPoll) {
        console.error("Re-scan failed:", err);
      }
    } finally {
      setScanning(false);
    }
  };

  const handleChangeFolder = () => {
    clearSyncFolderInfo();
    setSyncFolderName(null);
    setNewTracksCount(0);
    setSyncNotification(null);
  };

  const handleDismissNotification = () => {
    setSyncNotification(null);
    setNewTracksCount(0);
  };

  // ─── Track Operations ───

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this track?")) return;
    try {
      await api.deleteTrack(id);
      if (selectedTrack?.id === id) setSelectedTrack(null);
      await fetchTracks();
      await fetchFilters();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleRating = async (trackId: number, rating: number) => {
    try {
      await api.updateTrack(trackId, { rating });
      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, rating } : t)));
      if (selectedTrack?.id === trackId) {
        setSelectedTrack((prev) => prev ? { ...prev, rating } : null);
      }
    } catch {}
  };

  const openDetail = async (track: Track) => {
    setCrossRefResult(null);
    setCrossRefError(null);
    try {
      const full = await api.getTrack(track.id);
      setSelectedTrack(full);
    } catch {
      setSelectedTrack(track);
    }
  };

  function updateField(field: string, value: string | number | null) {
    if (!selectedTrack) return;
    const val = value === "" ? null : value;
    api.updateTrack(selectedTrack.id, { [field]: val }).then((updated) => {
      setSelectedTrack(updated);
      setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }).catch(console.error);
  }

  function refreshDetail() {
    if (!selectedTrack) return;
    api.getTrack(selectedTrack.id).then(setSelectedTrack).catch(console.error);
  }

  const handleAddGenres = async (trackId: number, genres: string[]) => {
    try {
      const res = await api.addTrackGenres(trackId, genres);
      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, genres: res.genres } : t)));
      if (selectedTrack?.id === trackId) {
        setSelectedTrack((prev) => prev ? { ...prev, genres: res.genres } : null);
      }
    } catch (err) {
      console.error("Failed to add genres:", err);
    }
  };

  const handleRemoveGenre = async (trackId: number, genre: string) => {
    try {
      const res = await api.removeTrackGenre(trackId, genre);
      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, genres: res.genres } : t)));
      if (selectedTrack?.id === trackId) {
        setSelectedTrack((prev) => prev ? { ...prev, genres: res.genres } : null);
      }
    } catch (err) {
      console.error("Failed to remove genre:", err);
    }
  };

  async function handleDetachTag(trackId: number, tagId: number) {
    try {
      await api.detachTag(trackId, tagId);
      refreshDetail();
    } catch {}
  }

  async function handleAITag() {
    if (!selectedTrack) return;

    if (isFreeTier) {
      setTierGateMessage("Free plan includes 3 AI prompts per month. Upgrade to Pro for unlimited AI tagging and playlist generation.");
      setShowTierGate(true);
      return;
    }

    setAiTagLoading(true);
    setAiTagError(null);
    try {
      const result = await api.aiTagTrack(selectedTrack.id);
      setSelectedTrack(result.track);
      setTracks((prev) => prev.map((t) => (t.id === result.track.id ? result.track : t)));
    } catch (err) {
      setAiTagError(err instanceof Error ? err.message : "AI tagging failed");
    } finally {
      setAiTagLoading(false);
    }
  }

  async function handleCrossRef() {
    if (!selectedTrack) return;
    if (!selectedTrack.title || !selectedTrack.artist) {
      setCrossRefError("Track must have both title and artist for cross-referencing.");
      return;
    }

    setCrossRefLoading(true);
    setCrossRefError(null);
    setCrossRefResult(null);
    try {
      const result = await api.crossReferenceTrack(selectedTrack.title, selectedTrack.artist);
      setCrossRefResult(result);
    } catch (err) {
      setCrossRefError(err instanceof Error ? err.message : "Cross-reference failed");
    } finally {
      setCrossRefLoading(false);
    }
  }

  async function handleSyncToCloud(trackId: number) {
    setSyncLoading((prev) => ({ ...prev, [trackId]: true }));
    try {
      await api.syncTrack(trackId);
      setSelectedTrack((prev) => prev ? { ...prev, sync_status: "cloud" } : null);
      setTracks((prev) => prev.map((t) => t.id === trackId ? { ...t, sync_status: "cloud" } : t));
      await fetchSyncStatus();
    } catch {
      console.error("Sync failed");
    } finally {
      setSyncLoading((prev) => ({ ...prev, [trackId]: false }));
    }
  }

  async function handleDownloadFromCloud(trackId: number) {
    setSyncLoading((prev) => ({ ...prev, [trackId]: true }));
    try {
      await api.downloadTrack(trackId);
      setSelectedTrack((prev) => prev ? { ...prev, sync_status: "pending_download" } : null);
      setTracks((prev) => prev.map((t) => t.id === trackId ? { ...t, sync_status: "pending_download" } : t));
      await fetchSyncStatus();
    } catch {
      console.error("Download failed");
    } finally {
      setSyncLoading((prev) => ({ ...prev, [trackId]: false }));
    }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sort !== col) return <span className="text-gray-600 ml-1">↕</span>;
    return <span className="text-violet-400 ml-1">{order === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Library</h1>
          <p className="mt-1 text-sm text-gray-400">
            {total} tracks
            {isFreeTier && <span className="ml-2 text-violet-400">· Free tier: {total}/500</span>}
          </p>
          {syncFolderName && (
            <p className="mt-1 text-xs text-gray-500">
              Synced folder: <span className="text-gray-400">/{syncFolderName}/</span>
              {" "}
              <button
                onClick={handleChangeFolder}
                className="text-violet-400 hover:text-violet-300 underline"
              >
                Change folder
              </button>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Folder button */}
          {!syncFolderName ? (
            <button
              onClick={handleSyncFolder}
              disabled={scanning}
              className="btn-primary bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
            >
              {scanning ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Scanning...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Sync Folder
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => handleReScan(false)}
              disabled={scanning}
              className="btn-secondary"
            >
              {scanning ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                  Re-scanning...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-scan
                </>
              )}
            </button>
          )}

          {/* Upload (drag-drop) fallback */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary"
            title="Import individual files"
          >
            {uploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Import Files
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*"
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Tier gate banner */}
      {showTierGate && (
        <div className="mb-4 rounded-lg border border-violet-700 bg-violet-950/30 p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-600/30 mt-0.5">
              <svg className="h-4 w-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-violet-300">Upgrade to Pro</p>
              <p className="text-sm text-gray-400">{tierGateMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowTierGate(false)}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              Dismiss
            </button>
            <a
              href="/settings"
              className="btn-primary py-1.5 text-xs"
            >
              View Plans
            </a>
          </div>
        </div>
      )}

      {/* Sync notification for auto-watch */}
      {syncNotification && (
        <div className="mb-4 rounded-lg border border-emerald-700 bg-emerald-950/30 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600/30">
              <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-300">{syncNotification}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchTracks(); handleDismissNotification(); }}
              className="btn-primary py-1.5 text-xs"
            >
              Refresh
            </button>
            <button
              onClick={handleDismissNotification}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Scanning Progress Modal */}
      {scanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">
              {importProgress.total > 0 ? "Importing tracks..." : "Scanning your music folder..."}
            </h2>

            {importProgress.total === 0 ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                  <p className="text-gray-400 text-sm">
                    Found {scanProgress.found} tracks so far...
                  </p>
                </div>
                {scanProgress.currentPath && (
                  <p className="text-xs text-gray-500 truncate">
                    {scanProgress.currentPath}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>{importProgress.processed} of {importProgress.total} tracks</span>
                    <span>{Math.round((importProgress.processed / importProgress.total) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-300"
                      style={{ width: `${(importProgress.processed / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Importing and analyzing track metadata...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-56">
          <GenrePicker
            selected={filters.genres || []}
            onChange={(genres) => { setFilters({ ...filters, genres: genres.length > 0 ? genres : undefined }); setPage(1); }}
            compact
            placeholder="Filter genres..."
          />
        </div>
        <select
          value={filters.key || ""}
          onChange={(e) => { setFilters({ ...filters, key: e.target.value || undefined }); setPage(1); }}
          className="input-field w-auto py-1.5 text-sm"
        >
          <option value="">All keys</option>
          {keys.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input
          type="number"
          placeholder="Min BPM"
          value={filters.bpm_min ?? ""}
          onChange={(e) => setFilters({ ...filters, bpm_min: e.target.value ? Number(e.target.value) : undefined })}
          className="input-field w-24 py-1.5 text-sm"
        />
        <input
          type="number"
          placeholder="Max BPM"
          value={filters.bpm_max ?? ""}
          onChange={(e) => setFilters({ ...filters, bpm_max: e.target.value ? Number(e.target.value) : undefined })}
          className="input-field w-24 py-1.5 text-sm"
        />
        <button
          onClick={() => { setFilters({}); setPage(1); setSort("created_at"); setOrder("desc"); }}
          className="text-sm text-gray-400 hover:text-gray-200"
        >
          Clear filters
        </button>
      </div>

      {/* Drag-and-drop zone — kept as fallback for individual file imports */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-4 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${dragOver ? "border-violet-500 bg-violet-500/10" : "border-gray-700 bg-gray-900/50"}`}
      >
        <p className="text-sm text-gray-500">
          Drop individual audio files here to import them
          {!isFileSystemAccessSupported() && (
            <span className="block mt-1 text-xs text-gray-600">
              Folder sync requires Chrome or Edge. You can still drag-and-drop individual files.
            </span>
          )}
        </p>
      </div>

      {/* Track table */}
      <div className="card overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-gray-300" onClick={() => handleSort("title")}>
                  Title <SortIcon col="title" />
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-gray-300 hidden md:table-cell" onClick={() => handleSort("artist")}>
                  Artist <SortIcon col="artist" />
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-gray-300 hidden lg:table-cell" onClick={() => handleSort("bpm")}>
                  BPM <SortIcon col="bpm" />
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-gray-300 hidden lg:table-cell" onClick={() => handleSort("musical_key")}>
                  Key <SortIcon col="musical_key" />
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-gray-300 hidden md:table-cell" onClick={() => handleSort("genre")}>
                  Genre <SortIcon col="genre" />
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-gray-300 hidden sm:table-cell" onClick={() => handleSort("duration_ms")}>
                  Duration <SortIcon col="duration_ms" />
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-gray-300" onClick={() => handleSort("rating")}>
                  Rating <SortIcon col="rating" />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : tracks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No tracks found. Sync a music folder or import files to get started!
                  </td>
                </tr>
              ) : (
                tracks.map((track, i) => (
                  <tr
                    key={track.id}
                    onClick={() => openDetail(track)}
                    className={`border-b border-gray-800/50 cursor-pointer transition-colors hover:bg-gray-800/50 ${selectedTrack?.id === track.id ? "bg-violet-600/10" : ""}`}
                  >
                    <td className="px-4 py-3 text-gray-600">{(page - 1) * 50 + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-200">{track.title || track.filename}</div>
                      <div className="text-xs text-gray-500 md:hidden">{track.artist || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{track.artist || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{track.bpm ? Math.round(track.bpm) : "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {track.musical_key ? (
                        <span className="inline-block rounded bg-violet-600/20 px-1.5 py-0.5 text-xs font-medium text-violet-300">
                          {track.musical_key}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                      <div className="flex flex-wrap gap-0.5 max-w-[160px]">
                        {track.genre && (
                          <span className="inline-block rounded bg-violet-600/20 px-1.5 py-0.5 text-xs text-violet-300">{track.genre}</span>
                        )}
                        {track.genres ? track.genres.filter(g => g !== track.genre).slice(0, 2).map(g => (
                          <span key={g} className="inline-block rounded bg-gray-700/50 px-1.5 py-0.5 text-xs text-gray-400">{g}</span>
                        )) : null}
                        {track.genres && track.genres.length > 3 && (
                          <span className="text-xs text-gray-600">+{track.genres.length - 3}</span>
                        )}
                        {!track.genre && (!track.genres || track.genres.length === 0) && "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{formatDuration(track.duration_ms)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StarRating rating={track.rating} onChange={(r) => handleRating(track.id, r)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
            <span className="text-sm text-gray-500">
              Page {page} of {Math.ceil(total / 50)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-secondary py-1.5 text-xs"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * 50 >= total}
                className="btn-secondary py-1.5 text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTrack(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setSelectedTrack(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-6 text-xl font-bold text-white">Track Details</h2>

            {/* Source file path */}
            {selectedTrack.filepath && !selectedTrack.filepath.startsWith("/") && !selectedTrack.filepath.includes("data/uploads") && (
              <div className="mb-4 rounded-lg bg-gray-800/50 px-3 py-2">
                <p className="text-xs text-gray-500">Source</p>
                <p className="text-sm text-gray-400 break-all">
                  {syncFolderName ? `/${syncFolderName}/` : ""}{selectedTrack.filepath}
                </p>
              </div>
            )}

            {/* Metadata display */}
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Title" value={selectedTrack.title} onChange={(v) => updateField("title", v)} />
              <DetailField label="Artist" value={selectedTrack.artist} onChange={(v) => updateField("artist", v)} />
              <DetailField label="Album" value={selectedTrack.album} onChange={(v) => updateField("album", v)} />
              <div>
                <label className="mb-1 block text-xs text-gray-500">Genres</label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {selectedTrack.genre && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-violet-600/30 px-2 py-0.5 text-xs text-violet-300">
                      {selectedTrack.genre}
                    </span>
                  )}
                  {(selectedTrack as Track & { genres?: string[] }).genres?.filter(g => g !== selectedTrack.genre).map(g => (
                    <span
                      key={g}
                      className="inline-flex items-center gap-0.5 rounded bg-gray-700/50 px-2 py-0.5 text-xs text-gray-400 cursor-pointer hover:bg-red-700/30 hover:text-red-300"
                      onClick={() => handleRemoveGenre(selectedTrack.id, g)}
                      title="Click to remove"
                    >
                      {g} ×
                    </span>
                  ))}
                  {!selectedTrack.genre && (!(selectedTrack as Track & { genres?: string[] }).genres || (selectedTrack as Track & { genres?: string[] }).genres!.length === 0) && (
                    <span className="text-xs text-gray-600">No genres</span>
                  )}
                </div>
                <GenrePicker
                  selected={(selectedTrack as Track & { genres?: string[] }).genres || (selectedTrack.genre ? [selectedTrack.genre] : [])}
                  onChange={(genres) => handleAddGenres(selectedTrack.id, genres)}
                  compact
                  placeholder="Add genres..."
                />
              </div>
              <DetailField label="Subgenre" value={selectedTrack.subgenre} onChange={(v) => updateField("subgenre", v)} />
              <DetailField label="Year" value={selectedTrack.year} onChange={(v) => updateField("year", v)} type="number" />
              <DetailField label="BPM" value={selectedTrack.bpm} onChange={(v) => updateField("bpm", v)} type="number" />
              <DetailField label="Key" value={selectedTrack.musical_key} onChange={(v) => updateField("musical_key", v)} />
              <DetailField label="Mood" value={selectedTrack.mood} onChange={(v) => updateField("mood", v)} />
              <DetailField label="Language" value={selectedTrack.language} onChange={(v) => updateField("language", v)} />
              <DetailField label="Country" value={selectedTrack.country} onChange={(v) => updateField("country", v)} />
              <DetailField label="Decade" value={selectedTrack.decade} onChange={(v) => updateField("decade", v)} />
              <DetailField label="Chord Progression" value={selectedTrack.chord_progression} onChange={(v) => updateField("chord_progression", v)} />
              <DetailField label="Beat Pattern" value={selectedTrack.beat_pattern} onChange={(v) => updateField("beat_pattern", v)} />
            </div>

            {/* Rating and stats */}
            <div className="mt-4 flex items-center gap-6 border-t border-gray-800 pt-4">
              <div>
                <p className="mb-1 text-xs text-gray-500">Rating</p>
                <StarRating rating={selectedTrack.rating} onChange={(r) => { handleRating(selectedTrack.id, r); }} size="lg" />
              </div>
              <div>
                <p className="mb-1 text-xs text-gray-500">Play count</p>
                <p className="text-sm text-gray-300">{selectedTrack.play_count}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-gray-500">Duration</p>
                <p className="text-sm text-gray-300">{formatDuration(selectedTrack.duration_ms)}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-gray-500">Size</p>
                <p className="text-sm text-gray-300">{formatFileSize(selectedTrack.filesize)}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-gray-500">Status</p>
                <p className={`text-sm ${selectedTrack.metadata_status === "complete" ? "text-emerald-400" : selectedTrack.metadata_status === "failed" ? "text-red-400" : "text-amber-400"}`}>
                  {selectedTrack.metadata_status}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs text-gray-500">Sync</p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  selectedTrack.sync_status === "cloud" ? "bg-blue-600/20 text-blue-400" :
                  selectedTrack.sync_status === "syncing" ? "bg-amber-600/20 text-amber-400" :
                  selectedTrack.sync_status === "pending_download" ? "bg-purple-600/20 text-purple-400" :
                  "bg-gray-700 text-gray-400"
                }`}>
                  {selectedTrack.sync_status === "cloud" ? (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  )}
                  {selectedTrack.sync_status || "local"}
                </span>
              </div>
            </div>

            {/* Tags */}
            <div className="mt-4 border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">Tags</p>
                <AddTagButton trackId={selectedTrack.id} onAdded={() => refreshDetail()} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedTrack.tags && selectedTrack.tags.length > 0 ? (
                  selectedTrack.tags.map((tag) => (
                    <span key={tag.id} className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300">
                      {tag.name}
                      <button onClick={() => handleDetachTag(selectedTrack.id, tag.id)} className="ml-1 text-gray-500 hover:text-red-400">×</button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-600">No tags</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-800 pt-4">
              <button
                onClick={handleAITag}
                disabled={aiTagLoading}
                className="btn-primary bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
              >
                {aiTagLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Tag
                  </>
                )}
              </button>

              {/* Cross-Reference Button */}
              <button
                onClick={handleCrossRef}
                disabled={crossRefLoading}
                className="btn-secondary bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-emerald-700/40 hover:border-emerald-500/60 text-emerald-300"
                title="Cross-reference track against Spotify and YouTube for genre tags"
              >
                {crossRefLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Cross-Reference
                  </>
                )}
              </button>

              {/* Sync buttons */}
              {selectedTrack.sync_status !== "cloud" && selectedTrack.sync_status !== "syncing" && (
                <button
                  onClick={() => handleSyncToCloud(selectedTrack.id)}
                  disabled={syncLoading[selectedTrack.id]}
                  className="btn-secondary"
                  title="Store in cloud"
                >
                  {syncLoading[selectedTrack.id] ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                  )}
                  Store in Cloud
                </button>
              )}

              {selectedTrack.sync_status === "cloud" && (
                <button
                  onClick={() => handleDownloadFromCloud(selectedTrack.id)}
                  disabled={syncLoading[selectedTrack.id]}
                  className="btn-secondary"
                  title="Download to local"
                >
                  {syncLoading[selectedTrack.id] ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  Download
                </button>
              )}

              {selectedTrack.sync_status === "syncing" && (
                <span className="inline-flex items-center gap-2 rounded bg-amber-600/10 px-3 py-2 text-xs text-amber-400">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  Syncing...
                </span>
              )}

              <button
                onClick={() => handleDelete(selectedTrack.id)}
                className="btn-secondary text-red-400 hover:text-red-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
            {aiTagError && (
              <p className="mt-2 text-xs text-red-400">{aiTagError}</p>
            )}
            {crossRefError && (
              <p className="mt-2 text-xs text-red-400">{crossRefError}</p>
            )}
            {crossRefResult && (
              <div className="mt-4 border-t border-gray-800 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-300">Cross-Reference Results</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Spotify */}
                  {crossRefResult.spotify && (
                    <div className="rounded-lg border border-emerald-700/30 bg-emerald-900/10 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded bg-emerald-600/30 px-2 py-0.5 text-xs font-medium text-emerald-300">Spotify</span>
                        {crossRefResult.spotify.found ? (
                          <span className="text-xs text-emerald-400">Found</span>
                        ) : (
                          <span className="text-xs text-amber-400">Not found</span>
                        )}
                      </div>
                      {crossRefResult.spotify.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {crossRefResult.spotify.genres.map(g => (
                            <span key={g} className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{g}</span>
                          ))}
                        </div>
                      )}
                      {crossRefResult.spotify.url && (
                        <a href={crossRefResult.spotify.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-emerald-400 hover:text-emerald-300">
                          Open in Spotify ↗
                        </a>
                      )}
                    </div>
                  )}
                  {/* YouTube */}
                  {crossRefResult.youtube && (
                    <div className="rounded-lg border border-red-700/30 bg-red-900/10 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded bg-red-600/30 px-2 py-0.5 text-xs font-medium text-red-300">YouTube</span>
                        {crossRefResult.youtube.found ? (
                          <span className="text-xs text-red-400">Found</span>
                        ) : (
                          <span className="text-xs text-amber-400">Not found</span>
                        )}
                      </div>
                      {crossRefResult.youtube.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {crossRefResult.youtube.genres.map(g => (
                            <span key={g} className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{g}</span>
                          ))}
                        </div>
                      )}
                      {crossRefResult.youtube.url && (
                        <a href={crossRefResult.youtube.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-red-400 hover:text-red-300">
                          Open in YouTube ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
                {/* Consensus genres */}
                {crossRefResult.consensus_genres.length > 0 && (
                  <div className="mt-3 rounded-lg border border-violet-700/30 bg-violet-900/10 p-3">
                    <span className="mb-2 block text-xs font-medium text-violet-300">Consensus Genres</span>
                    <div className="flex flex-wrap gap-1">
                      {crossRefResult.consensus_genres.map(g => (
                        <span key={g} className="rounded bg-violet-600/30 px-2 py-0.5 text-xs text-violet-200">{g}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Suggested genres */}
                {crossRefResult.suggested_genres.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-700/30 bg-amber-900/10 p-3">
                    <span className="mb-2 block text-xs font-medium text-amber-300">Suggested to Add</span>
                    <div className="flex flex-wrap gap-1">
                      {crossRefResult.suggested_genres.map(g => (
                        <span key={g} className="rounded bg-amber-600/30 px-2 py-0.5 text-xs text-amber-200">{g}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function DetailField({
  label, value, onChange, type = "text",
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string) => void;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value != null ? String(value) : "");

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      {editing ? (
        <input
          type={type}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => { onChange(val); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") { onChange(val); setEditing(false); } }}
          className="input-field py-1.5 text-sm"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-left text-sm text-gray-300 hover:text-gray-100 min-h-[1.5rem]"
        >
          {value != null ? String(value) : <span className="text-gray-600">—</span>}
        </button>
      )}
    </div>
  );
}

function AddTagButton({ trackId, onAdded }: { trackId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");

  const loadTags = async () => {
    try {
      const data = await api.listTags();
      setAllTags(data.tags);
    } catch {}
  };

  const handleOpen = () => {
    setOpen(!open);
    if (!open) loadTags();
  };

  const attachExisting = async (tagId: number) => {
    try {
      await api.attachTag(trackId, tagId);
      onAdded();
      setOpen(false);
    } catch {}
  };

  const createAndAttach = async () => {
    if (!newTagName.trim()) return;
    try {
      await api.attachTag(trackId, undefined, newTagName.trim());
      onAdded();
      setOpen(false);
      setNewTagName("");
    } catch {}
  };

  return (
    <div className="relative">
      <button onClick={handleOpen} className="text-xs text-violet-400 hover:text-violet-300">
        + Add tag
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-20 w-56 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl">
          <div className="mb-2 flex gap-1">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag..."
              className="input-field py-1 text-xs flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") createAndAttach(); }}
            />
            <button onClick={createAndAttach} className="btn-primary py-1 px-2 text-xs">Add</button>
          </div>
          {allTags.length > 0 && (
            <div className="max-h-32 overflow-y-auto">
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => attachExisting(tag.id)}
                  className="block w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 rounded"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
