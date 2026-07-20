import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, type Gig, type GeneratePlaylistResult } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    scheduled: "bg-blue-600/20 text-blue-300",
    confirmed: "bg-emerald-600/20 text-emerald-300",
    completed: "bg-gray-600/20 text-gray-300",
    cancelled: "bg-red-600/20 text-red-300",
  };
  return colors[status] || colors.scheduled;
}

export default function MyGigs() {
  const { user } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate setlist state
  const [generatingGigId, setGeneratingGigId] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPrompt, setShowAiPrompt] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<GeneratePlaylistResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Push state
  const [pushingGigId, setPushingGigId] = useState<number | null>(null);
  const [pushResult, setPushResult] = useState<{
    trackCount: number;
    venueName: string;
  } | null>(null);

  const fetchGigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUserGigs();
      // Fetch venue names for each gig
      const gigsWithVenues = await Promise.all(
        data.gigs.map(async (gig) => {
          try {
            const venueData = await api.getVenue(gig.venue_id);
            return { ...gig, venue_name: venueData.venue.name };
          } catch {
            return { ...gig, venue_name: `Venue #${gig.venue_id}` };
          }
        })
      );
      setGigs(gigsWithVenues);
    } catch (err) {
      setError("Failed to load gigs.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGigs(); }, [fetchGigs]);

  const handleGenerateSetlist = async (gig: Gig) => {
    if (!gig.theme) {
      setShowAiPrompt(gig.id);
      return;
    }
    setGeneratingGigId(gig.id);
    setAiResult(null);
    setAiError(null);
    try {
      const prompt = `Create a ${gig.theme} DJ setlist for a gig at ${gig.venue_name || "a venue"}. ${gig.title}`;
      const result = await api.generatePlaylist(prompt);
      setAiResult(result);
      // Update the gig with the setlist
      await api.updateGig(gig.id, { setlist_playlist_id: result.playlist.id });
      await fetchGigs();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingGigId(null);
    }
  };

  const handleCustomPrompt = async (gigId: number) => {
    if (!aiPrompt.trim()) return;
    setShowAiPrompt(null);
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await api.generatePlaylist(aiPrompt.trim());
      setAiResult(result);
      await api.updateGig(gigId, { setlist_playlist_id: result.playlist.id });
      await fetchGigs();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiLoading(false);
      setAiPrompt("");
    }
  };

  const handlePushSetlist = async (gigId: number) => {
    setPushingGigId(gigId);
    setPushResult(null);
    try {
      const result = await api.pushSetlist(gigId);
      setPushResult({
        trackCount: result.trackCount,
        venueName: result.venue.name,
      });
      await fetchGigs();
    } catch (err) {
      console.error("Push failed:", err);
    } finally {
      setPushingGigId(null);
    }
  };

  const handleDeleteGig = async (gig: Gig) => {
    if (!confirm(`Delete gig "${gig.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteGig(gig.id);
      await fetchGigs();
    } catch (err) {
      console.error("Failed to delete gig:", err);
    }
  };

  const upcoming = gigs.filter((g) => g.status !== "completed" && g.status !== "cancelled");
  const past = gigs.filter((g) => g.status === "completed" || g.status === "cancelled");

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">My Gigs</h1>
          <p className="mt-1 text-sm text-gray-400">
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <Link to="/venues" className="btn-primary">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Find Venues
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="card mb-6 border-red-800 bg-red-900/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-400">Loading gigs...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && gigs.length === 0 && (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
            <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">No upcoming gigs</h2>
          <p className="mt-1 text-sm text-gray-400">
            Browse venues and book your next gig to get started.
          </p>
          <Link to="/venues" className="btn-primary mt-4">
            Browse Venues
          </Link>
        </div>
      )}

      {/* AI Prompt Modal (inline) */}
      {showAiPrompt !== null && (
        <div className="card mb-6 border-violet-800 bg-violet-900/20">
          <h3 className="mb-3 text-base font-semibold text-white">Generate Setlist</h3>
          <p className="mb-3 text-sm text-gray-400">
            Describe the kind of setlist you want — moods, genres, energy level, tracks to include or avoid.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Deep tech warm-up with melodic elements, 120-125 BPM"
              className="input-field flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomPrompt(showAiPrompt);
              }}
            />
            <button
              onClick={() => handleCustomPrompt(showAiPrompt)}
              disabled={aiLoading || !aiPrompt.trim()}
              className="btn-primary"
            >
              {aiLoading ? "Generating..." : "Generate"}
            </button>
            <button
              onClick={() => { setShowAiPrompt(null); setAiPrompt(""); }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
          {aiError && <p className="mt-2 text-sm text-red-400">{aiError}</p>}
          {aiResult && (
            <div className="mt-4 rounded-lg bg-gray-800/50 p-4">
              <p className="text-sm font-medium text-emerald-400">
                ✓ Playlist "{aiResult.playlist.name}" created with {aiResult.externalSuggestions.length} suggestions!
              </p>
              <Link to="/playlists" className="mt-2 inline-block text-sm text-violet-400 hover:underline">
                View Playlists →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Push result toast */}
      {pushResult && (
        <div className="card mb-6 border-emerald-800 bg-emerald-900/20">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-emerald-300">
                Setlist pushed to {pushResult.venueName}!
              </p>
              <p className="text-xs text-emerald-400/70">
                {pushResult.trackCount} tracks synced with venue lighting system.
              </p>
            </div>
            <button
              onClick={() => setPushResult(null)}
              className="ml-auto text-gray-500 hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Upcoming gigs */}
      {!loading && upcoming.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-white">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map((gig) => (
              <div key={gig.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{gig.title}</h3>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(gig.status)}`}>
                        {gig.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                      <Link to={`/venues/${gig.venue_id}`} className="font-medium text-violet-400 hover:underline">
                        {gig.venue_name || `Venue #${gig.venue_id}`}
                      </Link>
                      <span>{formatDate(gig.date)}</span>
                      {gig.start_time && (
                        <span>
                          {formatTime(gig.start_time)}
                          {gig.end_time ? ` – ${formatTime(gig.end_time)}` : ""}
                        </span>
                      )}
                    </div>
                    {gig.theme && (
                      <p className="mt-1 text-sm text-gray-500">Theme: {gig.theme}</p>
                    )}
                    {gig.setlist_playlist_id && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-300">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Setlist ready
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleGenerateSetlist(gig)}
                      disabled={generatingGigId === gig.id}
                      className="btn-secondary text-xs"
                    >
                      {generatingGigId === gig.id ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Generate Setlist
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handlePushSetlist(gig.id)}
                      disabled={pushingGigId === gig.id || !gig.setlist_playlist_id}
                      className="btn-primary text-xs"
                      title={!gig.setlist_playlist_id ? "Generate a setlist first" : "Push setlist to venue"}
                    >
                      {pushingGigId === gig.id ? (
                        "Pushing..."
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Push to Venue
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteGig(gig)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="Delete gig"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past gigs */}
      {!loading && past.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-500">Past</h2>
          <div className="space-y-3 opacity-60">
            {past.map((gig) => (
              <div key={gig.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-400 line-through">{gig.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                      <Link to={`/venues/${gig.venue_id}`} className="hover:underline">
                        {gig.venue_name || `Venue #${gig.venue_id}`}
                      </Link>
                      <span>{formatDate(gig.date)}</span>
                    </div>
                  </div>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(gig.status)}`}>
                    {gig.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
