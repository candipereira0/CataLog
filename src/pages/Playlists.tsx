import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, type Playlist, type Track, type ExternalTrackSuggestion } from "../lib/api";

export default function Playlists() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // AI Generate
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{
    playlist: Playlist;
    externalSuggestions: ExternalTrackSuggestion[];
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Expanded playlist
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedTracks, setExpandedTracks] = useState<Track[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);

  // Add track form
  const [showAddTrack, setShowAddTrack] = useState<number | null>(null);
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // Share modal
  const [shareModal, setShareModal] = useState<Playlist | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Export dropdown
  const [exportOpen, setExportOpen] = useState<number | null>(null);

  // Suggested tracks
  const [suggestingId, setSuggestingId] = useState<number | null>(null);
  const [suggestedTracks, setSuggestedTracks] = useState<ExternalTrackSuggestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Apple Music import
  const [showAppleImport, setShowAppleImport] = useState(false);
  const [applePlaylists, setApplePlaylists] = useState<Array<{ id: string; name: string; description: string; trackCount: number }>>([]);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleImporting, setAppleImporting] = useState<string | null>(null);
  const [appleMsg, setAppleMsg] = useState<string | null>(null);

  // Apple Music export
  const [appleExporting, setAppleExporting] = useState<number | null>(null);
  const [appleExportResult, setAppleExportResult] = useState<{ playlistId: number; matched: number; unmatched: number; url: string } | null>(null);

  // Spotify import
  const [showSpotifyImport, setShowSpotifyImport] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<Array<{ id: string; name: string; description: string; trackCount: number }>>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyImporting, setSpotifyImporting] = useState<string | null>(null);
  const [spotifyMsg, setSpotifyMsg] = useState<string | null>(null);

  // Spotify export
  const [spotifyExporting, setSpotifyExporting] = useState<number | null>(null);
  const [spotifyExportResult, setSpotifyExportResult] = useState<{ playlistId: number; matched: number; unmatched: number; url: string } | null>(null);

  // YouTube export
  const [youtubeExporting, setYoutubeExporting] = useState<number | null>(null);
  const [youtubeExportResult, setYoutubeExportResult] = useState<{ playlistId: number; matchedCount: number; totalCount: number; url: string } | null>(null);

  // YouTube liked import
  const [youtubeLikedImporting, setYoutubeLikedImporting] = useState(false);
  const [youtubeLikedMsg, setYoutubeLikedMsg] = useState<string | null>(null);

  // Share with followers
  const [shareFollowersLoading, setShareFollowersLoading] = useState<number | null>(null);
  const [shareFollowersResult, setShareFollowersResult] = useState<{ playlistId: number; count: number } | null>(null);

  const handleShareWithFollowers = async (playlist: Playlist) => {
    setShareFollowersLoading(playlist.id);
    setShareFollowersResult(null);
    try {
      const result = await api.sharePlaylistWithFollowers(playlist.id);
      setShareFollowersResult({ playlistId: playlist.id, count: result.shared_with });
      setTimeout(() => setShareFollowersResult(null), 4000);
    } catch (err) {
      console.error("Failed to share with followers:", err);
    } finally {
      setShareFollowersLoading(null);
    }
  };

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listPlaylists();
      setPlaylists(data.playlists);
    } catch (err) {
      setError("Failed to load playlists.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createPlaylist(newName.trim(), newDesc.trim() || undefined);
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      await fetchPlaylists();
    } catch (err) {
      console.error("Failed to create playlist:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete playlist "${name}"? This cannot be undone.`)) return;
    try {
      await api.deletePlaylist(id);
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedTracks([]);
      }
      await fetchPlaylists();
    } catch (err) {
      console.error("Failed to delete playlist:", err);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await api.generatePlaylist(aiPrompt.trim());
      setAiResult(result);
      await fetchPlaylists();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiGenerating(false);
    }
  };

  const toggleExpand = async (playlist: Playlist) => {
    if (expandedId === playlist.id) {
      setExpandedId(null);
      setExpandedTracks([]);
      setSuggestedTracks([]);
      setSuggestError(null);
      return;
    }
    setExpandedId(playlist.id);
    setExpandedLoading(true);
    setSuggestedTracks([]);
    setSuggestError(null);
    try {
      const full = await api.getPlaylist(playlist.id);
      setExpandedTracks(full.tracks || []);
    } catch (err) {
      console.error("Failed to load playlist tracks:", err);
    } finally {
      setExpandedLoading(false);
    }
  };

  const openAddTrack = async (playlistId: number) => {
    setShowAddTrack(playlistId === showAddTrack ? null : playlistId);
    if (playlistId !== showAddTrack) {
      setLibraryLoading(true);
      try {
        const data = await api.listTracks({ limit: 200, sort: "title", order: "asc" });
        setLibraryTracks(data.tracks);
      } catch (err) {
        console.error("Failed to load library tracks:", err);
      } finally {
        setLibraryLoading(false);
      }
    }
  };

  const addTrack = async (playlistId: number, trackId: number) => {
    try {
      await api.addTrackToPlaylist(playlistId, trackId);
      if (expandedId === playlistId) {
        const full = await api.getPlaylist(playlistId);
        setExpandedTracks(full.tracks || []);
      }
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId
            ? { ...p, tracks: [...(p.tracks || []), libraryTracks.find((t) => t.id === trackId)!] }
            : p
        )
      );
      setShowAddTrack(null);
    } catch (err) {
      console.error("Failed to add track:", err);
    }
  };

  const removeTrack = async (playlistId: number, trackId: number) => {
    try {
      await api.removeTrackFromPlaylist(playlistId, trackId);
      setExpandedTracks((prev) => prev.filter((t) => t.id !== trackId));
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId
            ? { ...p, tracks: (p.tracks || []).filter((t) => t.id !== trackId) }
            : p
        )
      );
    } catch (err) {
      console.error("Failed to remove track:", err);
    }
  };

  // ─── Share ───
  const openShare = async (playlist: Playlist) => {
    setShareModal(playlist);
    setShareToken(null);
    setShareError(null);
    setCopySuccess(false);
    setShareLoading(true);
    try {
      const result = await api.sharePlaylist(playlist.id);
      setShareToken(result.token);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setShareLoading(false);
    }
  };

  const revokeShare = async () => {
    if (!shareModal) return;
    try {
      await api.revokeShare(shareModal.id);
      setShareToken(null);
      setCopySuccess(false);
    } catch (err) {
      console.error("Failed to revoke share:", err);
    }
  };

  const copyShareLink = () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/api/share/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      // Fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const emailShare = () => {
    if (!shareToken || !shareModal) return;
    const url = `${window.location.origin}/api/share/${shareToken}`;
    const subject = encodeURIComponent(`Check out my playlist: ${shareModal.name}`);
    const body = encodeURIComponent(`I created a playlist on CataLog and wanted to share it with you!\n\n${shareModal.name}\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  // ─── Export ───
  const handleExport = (playlistId: number, format: string) => {
    api.exportPlaylist(playlistId, format);
    setExportOpen(null);
  };

  const handleTrackExport = (trackId: number, format: string) => {
    api.exportTrack(trackId, format);
  };

  const handleSuggest = async (playlistId: number) => {
    setSuggestingId(playlistId);
    setSuggestError(null);
    setSuggestedTracks([]);
    try {
      const result = await api.suggestTracks(playlistId);
      setSuggestedTracks(result.suggestions);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setSuggestingId(null);
    }
  };

  const trackCount = (p: Playlist) => p.tracks?.length ?? 0;

  // ─── Apple Music Import ───
  const handleAppleImportOpen = async () => {
    setShowAppleImport(true);
    setAppleLoading(true);
    setAppleMsg(null);
    try {
      const res = await fetch("/api/music/apple/playlists", { credentials: "include" });
      const data = await res.json();
      setApplePlaylists(data.playlists || []);
    } catch {
      setAppleMsg("Failed to load Apple Music playlists");
    } finally {
      setAppleLoading(false);
    }
  };

  const handleAppleImportPlaylist = async (applePlaylistId: string) => {
    setAppleImporting(applePlaylistId);
    setAppleMsg(null);
    try {
      const res = await fetch(`/api/music/apple/playlists/${applePlaylistId}/import`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setAppleMsg(`Imported "${data.playlist?.name}" with ${data.imported}/${data.total} tracks`);
      loadPlaylists();
    } catch {
      setAppleMsg("Failed to import playlist");
    } finally {
      setAppleImporting(null);
    }
  };

  // ─── Apple Music Export ───
  const handleAppleExport = async (playlistId: number) => {
    setExportOpen(null);
    setAppleExporting(playlistId);
    setAppleExportResult(null);
    try {
      const res = await fetch("/api/music/apple/playlists/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId }),
      });
      const data = await res.json();
      setAppleExportResult({
        playlistId,
        matched: data.matched,
        unmatched: data.unmatched,
        url: data.applePlaylistUrl,
      });
    } catch {
      setAppleMsg("Failed to export to Apple Music");
    } finally {
      setAppleExporting(null);
    }
  };

  // ─── Spotify Import ───
  const handleSpotifyImportOpen = async () => {
    setShowSpotifyImport(true);
    setSpotifyLoading(true);
    setSpotifyMsg(null);
    try {
      const res = await fetch("/api/music/spotify/playlists", { credentials: "include" });
      const data = await res.json();
      setSpotifyPlaylists(data.playlists || []);
    } catch {
      setSpotifyMsg("Failed to load Spotify playlists. Connect Spotify in Settings first.");
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSpotifyImportPlaylist = async (spotifyPlaylistId: string) => {
    setSpotifyImporting(spotifyPlaylistId);
    setSpotifyMsg(null);
    try {
      const res = await fetch(`/api/music/spotify/playlists/${spotifyPlaylistId}/import`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setSpotifyMsg(`Imported "${data.playlist?.id ? `playlist #${data.playlist.id}` : "playlist"}" with ${data.imported + data.matched}/${data.total} tracks`);
      fetchPlaylists();
    } catch {
      setSpotifyMsg("Failed to import playlist");
    } finally {
      setSpotifyImporting(null);
    }
  };

  // ─── Spotify Export ───
  const handleSpotifyExport = async (playlistId: number) => {
    setExportOpen(null);
    setSpotifyExporting(playlistId);
    setSpotifyExportResult(null);
    try {
      const res = await fetch("/api/music/spotify/playlists/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId }),
      });
      const data = await res.json();
      setSpotifyExportResult({
        playlistId,
        matched: data.matched,
        unmatched: data.unmatched,
        url: data.spotifyUrl,
      });
    } catch {
      setSpotifyMsg("Failed to export to Spotify");
    } finally {
      setSpotifyExporting(null);
    }
  };

  // ─── YouTube Export ───
  const handleYouTubeExport = async (playlistId: number) => {
    setExportOpen(null);
    setYoutubeExporting(playlistId);
    setYoutubeExportResult(null);
    try {
      const res = await fetch("/api/music/youtube/playlists/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId }),
      });
      const data = await res.json();
      setYoutubeExportResult({
        playlistId,
        matchedCount: data.matchedCount,
        totalCount: data.totalCount,
        url: data.youtubeUrl,
      });
    } catch {
      setSpotifyMsg("Failed to export to YouTube");
    } finally {
      setYoutubeExporting(null);
    }
  };

  // ─── YouTube Liked Import ───
  const handleYouTubeLikedImport = async () => {
    setYoutubeLikedImporting(true);
    setYoutubeLikedMsg(null);
    try {
      const res = await fetch("/api/music/youtube/liked/import", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setYoutubeLikedMsg(`Imported ${data.imported + data.matched}/${data.total} liked tracks into "YouTube Likes" playlist`);
      fetchPlaylists();
    } catch {
      setYoutubeLikedMsg("Failed to import YouTube liked tracks");
    } finally {
      setYoutubeLikedImporting(false);
      setTimeout(() => setYoutubeLikedMsg(null), 5000);
    }
  };

  // Close export dropdown on outside click
  useEffect(() => {
    if (exportOpen === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".export-dropdown")) {
        setExportOpen(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [exportOpen]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Playlists</h1>
          <p className="mt-1 text-sm text-gray-400">{playlists.length} playlist{playlists.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              setShowAIGenerate(true);
              setAiPrompt("");
              setAiError(null);
              setAiResult(null);
            }}
            className="btn-primary bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-sm min-h-[44px]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden sm:inline ml-2">AI Generate</span>
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm min-h-[44px]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="hidden sm:inline ml-2">New Playlist</span>
          </button>
          <button onClick={handleAppleImportOpen} className="btn-secondary text-sm min-h-[44px]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <span className="hidden sm:inline ml-2">Import from Apple Music</span>
          </button>
          <button onClick={handleSpotifyImportOpen} className="btn-secondary text-sm min-h-[44px]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            <span className="hidden sm:inline ml-2">Import from Spotify</span>
          </button>
          <button
            onClick={handleYouTubeLikedImport}
            disabled={youtubeLikedImporting}
            className="btn-secondary text-sm min-h-[44px]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span className="hidden sm:inline ml-2">
              {youtubeLikedImporting ? "Importing..." : "Import YouTube Likes"}
            </span>
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6">
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 w-full">
              <label className="mb-1 block text-xs text-gray-500">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Playlist"
                className="input-field w-full"
                autoFocus
                required
              />
            </div>
            <div className="flex-1 w-full">
              <label className="mb-1 block text-xs text-gray-500">Description (optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="A great mix..."
                className="input-field w-full"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating || !newName.trim()} className="btn-primary min-h-[44px]">
                {creating ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary min-h-[44px]">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Generate Modal */}
      {showAIGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { if (!aiGenerating) { setShowAIGenerate(false); setAiResult(null); } }}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setShowAIGenerate(false); setAiResult(null); }}
              disabled={aiGenerating}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-2 text-xl font-bold text-white">AI Generate Playlist</h2>
            <p className="mb-6 text-sm text-gray-400">
              Describe the playlist you want and AI will create it from your library.
            </p>

            {!aiResult ? (
              <>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder='e.g. "deep-tech Bollywood for a 2-hour wedding set with even mix of vocal and instrumental"'
                  className="input-field mb-4 min-h-[100px] w-full resize-y"
                  disabled={aiGenerating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleAIGenerate();
                    }
                  }}
                />
                {aiError && (
                  <p className="mb-3 text-sm text-red-400">{aiError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleAIGenerate}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="btn-primary bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
                  >
                    {aiGenerating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowAIGenerate(false)}
                    disabled={aiGenerating}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-3 text-xs text-gray-600">Tip: Press Cmd+Enter to generate quickly.</p>
              </>
            ) : (
              <div>
                <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-900/20 p-4">
                  <p className="text-sm font-medium text-emerald-400">✓ Playlist created!</p>
                  <p className="mt-1 text-sm text-gray-300">
                    <strong>{aiResult.playlist.name}</strong>
                    {aiResult.playlist.description && (
                      <span className="block mt-1 text-xs text-gray-500">{aiResult.playlist.description}</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {aiResult.playlist.tracks?.length || 0} tracks from your library
                  </p>
                </div>

                {aiResult.externalSuggestions.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-medium text-gray-400">
                      💡 Suggested tracks (not in your library)
                    </h3>
                    <div className="space-y-2">
                      {aiResult.externalSuggestions.map((s, i) => (
                        <div key={i} className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                          <p className="text-sm font-medium text-gray-200">{s.title}</p>
                          <p className="text-xs text-gray-500">{s.artist}</p>
                          <div className="mt-2 flex gap-2">
                            <a href={s.appleMusicUrl} target="_blank" rel="noopener noreferrer" className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 transition-colors">Apple Music</a>
                            <a href={s.spotifyUrl} target="_blank" rel="noopener noreferrer" className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 transition-colors">Spotify</a>
                            <a href={s.youtubeUrl} target="_blank" rel="noopener noreferrer" className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 transition-colors">YouTube</a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => { setShowAIGenerate(false); setAiResult(null); }} className="btn-primary">Done</button>
                  <button onClick={() => { setAiResult(null); setAiPrompt(""); setAiError(null); }} className="btn-secondary">Generate Another</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apple Music Import Modal */}
      {showAppleImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAppleImport(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowAppleImport(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-2 text-xl font-bold text-white">Import from Apple Music</h2>
            <p className="mb-4 text-sm text-gray-400">
              Select a playlist to import into your CataLog library.
            </p>

            {appleMsg && (
              <div className="mb-4 rounded-lg bg-green-900/30 border border-green-800 px-4 py-3 text-sm text-green-300">
                {appleMsg}
              </div>
            )}

            {appleLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                <span className="ml-3 text-sm text-gray-400">Loading playlists...</span>
              </div>
            ) : applePlaylists.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No playlists found. Connect Apple Music in Settings first.</p>
            ) : (
              <div className="space-y-2">
                {applePlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-200 truncate">{pl.name}</p>
                      <p className="text-xs text-gray-500">{pl.trackCount} tracks{pl.description ? ` · ${pl.description}` : ""}</p>
                    </div>
                    <button
                      onClick={() => handleAppleImportPlaylist(pl.id)}
                      disabled={appleImporting === pl.id}
                      className="ml-3 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {appleImporting === pl.id ? "Importing..." : "Import"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spotify Import Modal */}
      {showSpotifyImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowSpotifyImport(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowSpotifyImport(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-2 text-xl font-bold text-white">Import from Spotify</h2>
            <p className="mb-4 text-sm text-gray-400">
              Select a playlist to import into your CataLog library.
            </p>

            {spotifyMsg && (
              <div className="mb-4 rounded-lg bg-green-900/30 border border-green-800 px-4 py-3 text-sm text-green-300">
                {spotifyMsg}
              </div>
            )}

            {spotifyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                <span className="ml-3 text-sm text-gray-400">Loading playlists...</span>
              </div>
            ) : spotifyPlaylists.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No playlists found. Connect Spotify in Settings first.</p>
            ) : (
              <div className="space-y-2">
                {spotifyPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-200 truncate">{pl.name}</p>
                      <p className="text-xs text-gray-500">{pl.trackCount} tracks{pl.description ? ` · ${pl.description}` : ""}</p>
                    </div>
                    <button
                      onClick={() => handleSpotifyImportPlaylist(pl.id)}
                      disabled={spotifyImporting === pl.id}
                      className="ml-3 rounded-lg bg-[#1DB954] px-3 py-1.5 text-xs font-medium text-black hover:bg-[#1ed760] transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {spotifyImporting === pl.id ? "Importing..." : "Import"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShareModal(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShareModal(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-2 text-xl font-bold text-white">Share "{shareModal.name}"</h2>
            <p className="mb-4 text-sm text-gray-400">Share this playlist with others.</p>

            {shareLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                <span className="ml-3 text-sm text-gray-400">Generating link...</span>
              </div>
            ) : shareError ? (
              <p className="text-sm text-red-400">{shareError}</p>
            ) : shareToken ? (
              <div className="space-y-4">
                {/* Copy link */}
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Share link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/api/share/${shareToken}`}
                      className="input-field flex-1 py-1.5 text-sm"
                      onFocus={(e) => e.target.select()}
                    />
                    <button onClick={copyShareLink} className="btn-primary py-1.5 text-xs whitespace-nowrap">
                      {copySuccess ? "✓ Copied!" : "Copy link"}
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={emailShare} className="btn-secondary py-2 text-xs justify-center">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </button>
                  <button onClick={() => handleExport(shareModal.id, "text")} className="btn-secondary py-2 text-xs justify-center">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    .txt
                  </button>
                  <button onClick={() => handleExport(shareModal.id, "m3u")} className="btn-secondary py-2 text-xs justify-center">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    .m3u
                  </button>
                </div>

                {/* Revoke */}
                <button onClick={revokeShare} className="w-full text-center text-xs text-red-400 hover:text-red-300 py-1">
                  Revoke share link
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Could not create share link.</p>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="card mb-6 border-red-800 bg-red-900/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Share with followers confirmation */}
      {shareFollowersResult && (
        <div className="card mb-6 border-emerald-800 bg-emerald-900/20 flex items-center gap-2">
          <svg className="h-5 w-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-400">
            Shared with {shareFollowersResult.count} follower{shareFollowersResult.count !== 1 ? "s" : ""}!
          </p>
        </div>
      )}

      {/* YouTube liked import confirmation */}
      {youtubeLikedMsg && (
        <div className="card mb-6 border-red-800/50 bg-red-900/20 flex items-center gap-2">
          <svg className="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <p className="text-sm text-gray-300">{youtubeLikedMsg}</p>
        </div>
      )}

      {/* Tip promotion — encourage DJs to share their tip page */}
      {!loading && playlists.length > 0 && user?.handle && (
        <div className="card mb-6 border-violet-700/30 bg-violet-950/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl flex-shrink-0">💸</span>
            <div>
              <p className="text-sm font-medium text-violet-300">Get tipped for your curation!</p>
              <p className="text-xs text-gray-500">Share your tip page with fans: <span className="text-violet-400 break-all">catalog.app/tip/@{user.handle}</span></p>
            </div>
          </div>
          <a
            href={`/tip/@${user.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary py-1.5 text-xs whitespace-nowrap flex-shrink-0"
          >
            View Tip Page
          </a>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="card flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-400">Loading playlists...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && playlists.length === 0 && (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
            <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">No playlists yet</h2>
          <p className="mt-1 text-sm text-gray-400">Create your first playlist to start organizing.</p>
        </div>
      )}

      {/* Playlist list */}
      {!loading && playlists.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="card flex flex-col">
              {/* Playlist row */}
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => toggleExpand(playlist)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg
                      className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${expandedId === playlist.id ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="min-w-0">
                      <h3 className="font-medium text-gray-200 truncate">{playlist.name}</h3>
                      {playlist.description && (
                        <p className="text-xs text-gray-500 truncate">{playlist.description}</p>
                      )}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-gray-500">{trackCount(playlist)}</span>
                  <span className="hidden text-xs text-gray-600 sm:inline">
                    {new Date(playlist.created_at).toLocaleDateString()}
                  </span>

                  {/* Share button */}
                  <button
                    onClick={() => openShare(playlist)}
                    className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-violet-400 transition-colors"
                    title="Share playlist"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>

                  {/* Share with followers button */}
                  <button
                    onClick={() => handleShareWithFollowers(playlist)}
                    disabled={shareFollowersLoading === playlist.id}
                    className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-emerald-400 transition-colors"
                    title="Share with followers"
                  >
                    {shareFollowersLoading === playlist.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    )}
                  </button>

                  {/* Export dropdown */}
                  <div className="export-dropdown relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setExportOpen(exportOpen === playlist.id ? null : playlist.id); }}
                      className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-emerald-400 transition-colors"
                      title="Export playlist"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    {exportOpen === playlist.id && (
                      <div className="absolute right-0 top-8 z-30 w-44 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl">
                        <button onClick={() => handleExport(playlist.id, "m3u")} className="block w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-800">Export as .m3u</button>
                        <button onClick={() => handleExport(playlist.id, "nml")} className="block w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-800">Export as .nml (Traktor)</button>
                        <button onClick={() => handleExport(playlist.id, "rekordbox")} className="block w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-800">Export as .xml (Rekordbox)</button>
                        <button onClick={() => handleExport(playlist.id, "serato")} className="block w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-800">Export as .crate (Serato)</button>
                        <button onClick={() => handleExport(playlist.id, "text")} className="block w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-800">Export as .txt</button>
                        <div className="border-t border-gray-700 my-1" />
                        <button
                          onClick={() => handleAppleExport(playlist.id)}
                          disabled={appleExporting === playlist.id}
                          className="block w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                        >
                          {appleExporting === playlist.id ? "Exporting..." : "Export to Apple Music"}
                        </button>
                        {appleExportResult && appleExportResult.playlistId === playlist.id && (
                          <div className="px-4 py-2 text-xs text-emerald-400">
                            ✓ {appleExportResult.matched}/{appleExportResult.matched + appleExportResult.unmatched} matched
                          </div>
                        )}
                        <button
                          onClick={() => handleSpotifyExport(playlist.id)}
                          disabled={spotifyExporting === playlist.id}
                          className="block w-full px-4 py-2 text-left text-xs text-green-300 hover:bg-gray-800 disabled:opacity-50"
                        >
                          {spotifyExporting === playlist.id ? "Exporting..." : "Export to Spotify"}
                        </button>
                        {spotifyExportResult && spotifyExportResult.playlistId === playlist.id && (
                          <div className="px-4 py-2 text-xs text-green-400">
                            ✓ {spotifyExportResult.matched}/{spotifyExportResult.matched + spotifyExportResult.unmatched} matched
                          </div>
                        )}
                        <button
                          onClick={() => handleYouTubeExport(playlist.id)}
                          disabled={youtubeExporting === playlist.id}
                          className="block w-full px-4 py-2 text-left text-xs text-red-300 hover:bg-gray-800 disabled:opacity-50"
                        >
                          {youtubeExporting === playlist.id ? "Exporting..." : "Export to YouTube"}
                        </button>
                        {youtubeExportResult && youtubeExportResult.playlistId === playlist.id && (
                          <div className="px-4 py-2 text-xs text-red-400">
                            ✓ {youtubeExportResult.matchedCount}/{youtubeExportResult.totalCount} matched
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(playlist.id, playlist.name)}
                    className="rounded p-1 text-gray-600 hover:bg-gray-800 hover:text-red-400 transition-colors"
                    title="Delete playlist"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded tracks */}
              {expandedId === playlist.id && (
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {expandedTracks.length} track{expandedTracks.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => openAddTrack(playlist.id)}
                      className="text-xs text-violet-400 hover:text-violet-300"
                    >
                      + Add track
                    </button>
                  </div>

                  {/* Add track selector */}
                  {showAddTrack === playlist.id && (
                    <div className="mb-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                      {libraryLoading ? (
                        <p className="text-xs text-gray-500">Loading library...</p>
                      ) : libraryTracks.length === 0 ? (
                        <p className="text-xs text-gray-500">No tracks in library. Upload tracks first.</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {libraryTracks
                            .filter((t) => !expandedTracks.some((et) => et.id === t.id))
                            .map((track) => (
                              <button
                                key={track.id}
                                onClick={() => addTrack(playlist.id, track.id)}
                                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700"
                              >
                                <span>
                                  {track.artist ? `${track.artist} — ` : ""}{track.title || track.filename}
                                </span>
                                <span className="text-violet-400">+</span>
                              </button>
                            ))}
                          {libraryTracks.filter((t) => !expandedTracks.some((et) => et.id === t.id)).length === 0 && (
                            <p className="text-xs text-gray-500">All library tracks are already in this playlist.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Track list */}
                  {expandedLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                      <span className="ml-2 text-xs text-gray-400">Loading tracks...</span>
                    </div>
                  ) : expandedTracks.length === 0 ? (
                    <p className="py-4 text-center text-xs text-gray-500">No tracks in this playlist.</p>
                  ) : (
                    <div className="space-y-1">
                      {expandedTracks.map((track, i) => (
                        <div
                          key={track.id}
                          className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-800/50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-gray-600 w-5">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm text-gray-200">{track.title || track.filename}</p>
                              <p className="truncate text-xs text-gray-500">{track.artist || "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Export individual track */}
                            <button
                              onClick={() => handleTrackExport(track.id, "m3u")}
                              className="text-gray-600 hover:text-emerald-400 transition-colors p-1"
                              title="Export track as M3U"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => removeTrack(playlist.id, track.id)}
                              className="text-gray-600 hover:text-red-400 transition-colors p-1"
                              title="Remove track"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggested Tracks Section */}
                  {expandedTracks.length > 0 && (
                    <div className="mt-4 border-t border-gray-700 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-400">
                          💡 Suggested Tracks
                        </h4>
                        {suggestedTracks.length === 0 && suggestingId !== playlist.id && (
                          <button
                            onClick={() => handleSuggest(playlist.id)}
                            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            Get suggestions
                          </button>
                        )}
                        {suggestingId === playlist.id && (
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                            <span className="text-xs text-gray-500">Analyzing...</span>
                          </div>
                        )}
                      </div>

                      {suggestError && (
                        <p className="mb-3 text-xs text-red-400">{suggestError}</p>
                      )}

                      {suggestedTracks.length > 0 && (
                        <div className="space-y-2">
                          {suggestedTracks.map((s, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded-lg border border-gray-700/60 bg-gray-800/30 px-3 py-2.5 opacity-80 hover:opacity-100 transition-opacity"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm text-gray-300">{s.title}</p>
                                  <span className="inline-block rounded-full bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                                    external
                                  </span>
                                </div>
                                <p className="truncate text-xs text-gray-500">{s.artist}</p>
                              </div>
                              <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                                <a
                                  href={s.appleMusicUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded bg-gray-700/60 p-1.5 text-gray-400 hover:bg-red-600/30 hover:text-red-400 transition-colors"
                                  title="Apple Music"
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.63-1.11 1.76-1.82 2.96-1.85 1.36-.03 2.67.93 3.5.93.83 0 2.43-1.15 4.1-.98.7.03 2.66.28 3.91 2.13-.1.06-2.33 1.37-2.3 4.07.03 3.27 2.88 4.35 2.93 4.36-.03.07-.46 1.57-1.52 3.11"/>
                                  </svg>
                                </a>
                                <a
                                  href={s.spotifyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded bg-gray-700/60 p-1.5 text-gray-400 hover:bg-green-600/30 hover:text-green-400 transition-colors"
                                  title="Spotify"
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                  </svg>
                                </a>
                                <a
                                  href={s.youtubeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded bg-gray-700/60 p-1.5 text-gray-400 hover:bg-red-700/30 hover:text-red-400 transition-colors"
                                  title="YouTube"
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                  </svg>
                                </a>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => handleSuggest(playlist.id)}
                            className="w-full text-center text-xs text-gray-500 hover:text-violet-400 py-1 transition-colors"
                          >
                            Refresh suggestions
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
