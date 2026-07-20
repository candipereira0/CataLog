import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePlayer } from "../contexts/PlayerContext";
import { api, type ArtistTrackBrowse } from "../lib/api";

export default function Music() {
  const { user } = useAuth();
  const player = usePlayer();

  const [tracks, setTracks] = useState<ArtistTrackBrowse[]>([]);
  const [total, setTotal] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterGenre, setFilterGenre] = useState("");
  const [filterBpmMin, setFilterBpmMin] = useState("");
  const [filterBpmMax, setFilterBpmMax] = useState("");
  const [filterPrice, setFilterPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const limit = 50;

  const [previewTrack, setPreviewTrack] = useState<ArtistTrackBrowse | null>(null);
  const [addToLibraryMsg, setAddToLibraryMsg] = useState<string | null>(null);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.browseArtistTracks({
        genre: filterGenre || undefined,
        bpm_min: filterBpmMin ? parseFloat(filterBpmMin) : undefined,
        bpm_max: filterBpmMax ? parseFloat(filterBpmMax) : undefined,
        price: (filterPrice as 'free' | 'paid') || undefined,
        sort,
        limit,
        offset: page * limit,
      });
      setTracks(result.tracks);
      setTotal(result.total);
      if (result.genres && page === 0) setGenres(result.genres);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracks");
    } finally {
      setLoading(false);
    }
  }, [filterGenre, filterBpmMin, filterBpmMax, filterPrice, sort, page]);

  useEffect(() => { fetchTracks(); }, [fetchTracks]);

  const handlePreview = (track: ArtistTrackBrowse) => {
    setPreviewTrack(track);
    player?.openPlayer({
      title: track.title,
      artist: track.artist_name,
      audioSrc: api.getArtistTrackStreamUrl(track.id),
      bpm: track.bpm,
      musical_key: track.musical_key,
      genre: track.genre,
    });
  };

  const handleAddToLibrary = async (track: ArtistTrackBrowse) => {
    if (!user) return;
    try {
      await api.addArtistTrackToLibrary(track.id);
      setAddToLibraryMsg(`"${track.title}" added to your library!`);
      setTimeout(() => setAddToLibraryMsg(null), 3000);
    } catch (err) {
      setAddToLibraryMsg(err instanceof Error ? err.message : "Failed to add track");
      setTimeout(() => setAddToLibraryMsg(null), 3000);
    }
  };

  const handleDownload = async (track: ArtistTrackBrowse) => {
    try {
      await api.downloadArtistTrack(track.id);
      // Trigger actual download
      const a = document.createElement("a");
      a.href = api.getArtistTrackStreamUrl(track.id);
      a.download = `${track.artist_name} - ${track.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && tracks.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Music</h1>
        <p className="mt-1 text-sm text-gray-400">Discover tracks from CataLog artists.</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Genre</label>
            <select
              value={filterGenre}
              onChange={(e) => { setFilterGenre(e.target.value); setPage(0); }}
              className="input-field w-full text-sm"
            >
              <option value="">All genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">BPM Min</label>
            <input
              type="number"
              value={filterBpmMin}
              onChange={(e) => { setFilterBpmMin(e.target.value); setPage(0); }}
              placeholder="Any"
              min="20"
              max="300"
              className="input-field w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">BPM Max</label>
            <input
              type="number"
              value={filterBpmMax}
              onChange={(e) => { setFilterBpmMax(e.target.value); setPage(0); }}
              placeholder="Any"
              min="20"
              max="300"
              className="input-field w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Price</label>
            <select
              value={filterPrice}
              onChange={(e) => { setFilterPrice(e.target.value); setPage(0); }}
              className="input-field w-full text-sm"
            >
              <option value="">All</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Sort</label>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(0); }}
              className="input-field w-full text-sm"
            >
              <option value="newest">Newest</option>
              <option value="most_played">Most Played</option>
              <option value="most_downloaded">Most Downloaded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add to library message */}
      {addToLibraryMsg && (
        <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-900/20 p-3">
          <p className="text-sm text-emerald-400">{addToLibraryMsg}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Track grid */}
      {tracks.length === 0 ? (
        <div className="card py-12 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-gray-500">No tracks found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tracks.map((track) => (
            <div key={track.id} className="card group flex flex-col">
              {/* Cover art */}
              <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg bg-gray-800">
                {track.cover_art_url ? (
                  <img
                    src={`/api/artist/tracks/${track.id}/stream`}
                    alt={track.title}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.classList.add('flex', 'items-center', 'justify-center');
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <svg className="h-16 w-16 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
                {/* Play overlay */}
                <button
                  onClick={() => handlePreview(track)}
                  className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/90 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Info */}
              <div className="flex-1">
                <h3 className="truncate text-sm font-semibold text-white">{track.title}</h3>
                <p className="truncate text-xs text-gray-400">{track.artist_name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {track.genre && (
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{track.genre}</span>
                  )}
                  {track.bpm && (
                    <span className="text-xs text-gray-500">{Math.round(track.bpm)} BPM</span>
                  )}
                  {track.musical_key && (
                    <span className="text-xs text-gray-500">{track.musical_key}</span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
                  <span title="Plays">{track.play_count} plays</span>
                  <span title="Downloads">{track.download_count} downloads</span>
                </div>
              </div>

              {/* User link */}
              {track.user_handle && (
                <Link
                  to={`/@${track.user_handle}`}
                  className="mt-2 block truncate text-xs text-violet-400 hover:text-violet-300"
                >
                  @{track.user_handle}
                </Link>
              )}

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handlePreview(track)}
                  className="btn-secondary flex-1 py-1.5 text-xs"
                >
                  Preview
                </button>
                {track.price_cents === 0 ? (
                  <button
                    onClick={() => handleDownload(track)}
                    className="btn-secondary flex-1 py-1.5 text-xs"
                  >
                    Download
                  </button>
                ) : (
                  <button className="btn-primary flex-1 py-1.5 text-xs">
                    Buy (${(track.price_cents / 100).toFixed(2)})
                  </button>
                )}
              </div>
              {user && (
                <button
                  onClick={() => handleAddToLibrary(track)}
                  className="mt-2 w-full rounded-lg border border-gray-700 py-1.5 text-xs text-gray-400 hover:border-violet-700 hover:text-violet-400 transition-colors"
                >
                  + Add to Library
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
