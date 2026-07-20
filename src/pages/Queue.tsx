import { useState, useEffect, useCallback } from "react";
import { api, type Track, type QueueTrack } from "../lib/api";
import { usePlayer, type PlayerTrack } from "../contexts/PlayerContext";

interface QueueState {
  startTrack: Track | null;
  tracks: QueueTrack[];
  constraintsRelaxed: boolean;
  relaxReason: string | null;
  loading: boolean;
  error: string;
}

export default function Queue() {
  const { setQueue, playNext, playPrevious, queue, queueIndex, currentTrack, isPlaying, togglePlay, openPlayer } = usePlayer();

  const [showTrackPicker, setShowTrackPicker] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [queueCount, setQueueCount] = useState(10);

  const [queueState, setQueueState] = useState<QueueState>({
    startTrack: null,
    tracks: [],
    constraintsRelaxed: false,
    relaxReason: null,
    loading: false,
    error: "",
  });

  // Load library when track picker opens
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const data = await api.listTracks({ limit: 200, sort: "title", order: "asc" });
      setLibraryTracks(data.tracks);
    } catch {
      // silently fail
    }
    setLibraryLoading(false);
  }, []);

  useEffect(() => {
    if (showTrackPicker) loadLibrary();
  }, [showTrackPicker, loadLibrary]);

  // Generate queue
  const generateQueue = useCallback(async (trackId: number) => {
    setQueueState(prev => ({ ...prev, loading: true, error: "" }));
    try {
      const result = await api.generateQueue(trackId, queueCount);
      setQueueState({
        startTrack: result.start_track,
        tracks: result.queue,
        constraintsRelaxed: result.constraints_relaxed,
        relaxReason: result.relax_reason,
        loading: false,
        error: "",
      });

      // Load into player queue
      const playerTracks: PlayerTrack[] = result.queue.map(t => ({
        id: t.id,
        title: t.title || t.filename,
        artist: t.artist || "Unknown",
        bpm: t.bpm,
        musical_key: t.musical_key,
        genre: t.genre,
      }));
      setQueue(playerTracks, 0);
      setShowTrackPicker(false);
    } catch (err) {
      setQueueState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to generate queue",
      }));
    }
  }, [queueCount, setQueue]);

  // Shuffle: re-generate with same track
  const handleShuffle = useCallback(() => {
    if (queueState.startTrack) {
      generateQueue(queueState.startTrack.id);
    }
  }, [queueState.startTrack, generateQueue]);

  // Save as playlist
  const handleSaveAsPlaylist = useCallback(async () => {
    if (queueState.tracks.length === 0) return;
    try {
      const pl = await api.createPlaylist(
        `Auto-Queue ${new Date().toLocaleDateString()}`,
        `Auto-generated from "${queueState.startTrack?.title || "unknown"}"`
      );
      for (const t of queueState.tracks) {
        await api.addTrackToPlaylist(pl.id, t.id);
      }
      alert(`Playlist "${pl.name}" created!`);
    } catch {
      alert("Failed to create playlist");
    }
  }, [queueState]);

  // Wire auto-advance
  const handleTrackEnd = useCallback(() => {
    playNext();
  }, [playNext]);

  // Filter library tracks for picker
  const filteredLibrary = searchQuery
    ? libraryTracks.filter(t =>
        (t.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.artist || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : libraryTracks;

  const isQueueActive = queue.length > 0 && queueIndex >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Auto-Queue</h1>
          <p className="mt-1 text-sm text-gray-400">
            AI-powered continuous mix — key &amp; BPM compatible
          </p>
        </div>
        <div className="flex gap-2">
          {isQueueActive && (
            <>
              <button
                onClick={playPrevious}
                disabled={queueIndex <= 0}
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors"
                title="Previous track"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>
              <button
                onClick={togglePlay}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 transition-colors"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                onClick={playNext}
                disabled={queueIndex >= queue.length - 1}
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors"
                title="Next track"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>
              <div className="w-px bg-gray-700 mx-1" />
              <button
                onClick={handleShuffle}
                disabled={queueState.loading}
                className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                title="Re-roll queue"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleSaveAsPlaylist}
                className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                title="Save as playlist"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setQueue([], -1)}
                className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-300 hover:bg-red-900/60 transition-colors"
                title="Clear queue"
              >
                Clear
              </button>
            </>
          )}
          {!isQueueActive && (
            <button
              onClick={() => setShowTrackPicker(true)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
            >
              Start Auto-Queue
            </button>
          )}
        </div>
      </div>

      {/* Constraints relaxed warning */}
      {queueState.constraintsRelaxed && queueState.relaxReason && (
        <div className="rounded-lg border border-amber-600/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
          ⚠️ {queueState.relaxReason}
        </div>
      )}

      {/* Loading state */}
      {queueState.loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-400">Generating queue...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {queueState.error && (
        <div className="rounded-lg border border-red-600/40 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {queueState.error}
        </div>
      )}

      {/* Now playing banner */}
      {currentTrack && isQueueActive && (
        <div className="rounded-xl border border-violet-600/30 bg-violet-900/20 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/30">
              <svg className="h-5 w-5 text-violet-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-gray-400 truncate">{currentTrack.artist}</p>
            </div>
            <span className="text-xs text-gray-500">
              {queueIndex + 1} / {queue.length}
            </span>
          </div>
        </div>
      )}

      {/* Queue list */}
      {isQueueActive && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Queue</h2>
            <span className="text-xs text-gray-500">{queue.length} tracks</span>
          </div>

          <div className="space-y-1">
            {queue.map((track, idx) => {
              const qTrack = queueState.tracks[idx];
              const isCurrent = idx === queueIndex;
              const isPlayed = idx < queueIndex;

              return (
                <div
                  key={`${track.id || idx}-${idx}`}
                  onClick={() => {
                    if (track.id) openPlayer(track);
                  }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                    isCurrent
                      ? "bg-violet-600/20 border border-violet-500/30"
                      : isPlayed
                      ? "bg-gray-800/40 opacity-60"
                      : "bg-gray-800/20 hover:bg-gray-800/40"
                  }`}
                >
                  {/* Position number */}
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-mono font-bold ${
                    isCurrent
                      ? "bg-violet-600 text-white"
                      : isPlayed
                      ? "bg-gray-700 text-gray-500"
                      : "bg-gray-700 text-gray-300"
                  }`}>
                    {isCurrent ? (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isCurrent ? "text-violet-200 font-medium" : "text-gray-200"}`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                  </div>

                  {/* Metadata badges */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {track.bpm && (
                      <span className="rounded bg-gray-700/60 px-1.5 py-0.5 text-[10px] text-gray-300 font-mono">
                        {Math.round(track.bpm)} BPM
                      </span>
                    )}
                    {track.musical_key && (
                      <span className="rounded bg-gray-700/60 px-1.5 py-0.5 text-[10px] text-gray-300 font-mono">
                        {track.musical_key}
                      </span>
                    )}
                    {track.genre && (
                      <span className="rounded bg-gray-700/60 px-1.5 py-0.5 text-[10px] text-gray-400 truncate max-w-[80px]">
                        {track.genre}
                      </span>
                    )}
                  </div>

                  {/* Transition reason (from API) */}
                  {qTrack?.transition_reason && (
                    <div className="hidden lg:block text-[10px] text-gray-500 italic max-w-[200px] truncate">
                      {qTrack.transition_reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isQueueActive && !queueState.loading && !showTrackPicker && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
            <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-300">Start an Auto-Queue</h3>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            Pick a starting track and we'll generate a seamless set based on key compatibility,
            BPM proximity, mood, and energy.
          </p>
          <button
            onClick={() => setShowTrackPicker(true)}
            className="mt-6 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
          >
            Start Auto-Queue
          </button>
        </div>
      )}

      {/* Track picker modal */}
      {showTrackPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowTrackPicker(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[80vh] flex flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Select Starting Track</h2>
                <p className="text-xs text-gray-500 mt-0.5">Choose a track to build the queue from</p>
              </div>
              <button
                onClick={() => setShowTrackPicker(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search + count */}
            <div className="flex items-center gap-3 border-b border-gray-800 px-5 py-3">
              <input
                type="text"
                placeholder="Search library..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
              />
              <select
                value={queueCount}
                onChange={e => setQueueCount(Number(e.target.value))}
                className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {[5, 10, 15, 20, 30].map(n => (
                  <option key={n} value={n}>{n} tracks</option>
                ))}
              </select>
            </div>

            {/* Track list */}
            <div className="flex-1 overflow-y-auto p-2">
              {libraryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                </div>
              ) : filteredLibrary.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  {searchQuery ? "No tracks match your search" : "No tracks in library"}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredLibrary.map(track => (
                    <button
                      key={track.id}
                      onClick={() => generateQueue(track.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-700/50 text-xs text-gray-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{track.title || track.filename}</p>
                        <p className="text-xs text-gray-500 truncate">{track.artist || "Unknown"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {track.bpm && (
                          <span className="rounded bg-gray-700/60 px-1.5 py-0.5 text-[10px] text-gray-400 font-mono">
                            {Math.round(track.bpm)}
                          </span>
                        )}
                        {track.musical_key && (
                          <span className="rounded bg-gray-700/60 px-1.5 py-0.5 text-[10px] text-gray-400 font-mono">
                            {track.musical_key}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
