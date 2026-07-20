import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

// ─── Types ───

export interface InspoChallenge {
  type: string;
  prompt: string;
  description: string;
  date: string;
}

interface AcceptedChallenge {
  type: string;
  prompt: string;
  description: string;
  date: string;
  acceptedAt: string;
}

// ─── Constants ───

const STORAGE_KEY = "catalog_inspo_history";

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  track_of_the_day: "Track of the Day",
  mood: "Mood",
  genre_warmup: "Genre Warmup",
  bpm_challenge: "BPM Challenge",
  decade: "Decade",
  themed: "Themed Set",
};

const CHALLENGE_TYPE_COLORS: Record<string, string> = {
  track_of_the_day: "bg-blue-600/20 text-blue-300 border-blue-600/30",
  mood: "bg-purple-600/20 text-purple-300 border-purple-600/30",
  genre_warmup: "bg-green-600/20 text-green-300 border-green-600/30",
  bpm_challenge: "bg-orange-600/20 text-orange-300 border-orange-600/30",
  decade: "bg-pink-600/20 text-pink-300 border-pink-600/30",
  themed: "bg-violet-600/20 text-violet-300 border-violet-600/30",
};

// ─── Helpers ───

function loadHistory(): AcceptedChallenge[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToHistory(challenge: InspoChallenge) {
  const history = loadHistory();
  // Don't duplicate if already accepted today
  const exists = history.some(
    (h) => h.date === challenge.date && h.type === challenge.type
  );
  if (!exists) {
    history.unshift({
      ...challenge,
      acceptedAt: new Date().toISOString(),
    });
    // Keep only last 20
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
  }
}

function getTypeLabel(type: string): string {
  return CHALLENGE_TYPE_LABELS[type] || type.replace(/_/g, " ");
}

function getTypeColor(type: string): string {
  return CHALLENGE_TYPE_COLORS[type] || "bg-gray-600/20 text-gray-300 border-gray-600/30";
}

function getTypeEmoji(type: string): string {
  switch (type) {
    case "track_of_the_day":
      return "🎵";
    case "mood":
      return "🎭";
    case "genre_warmup":
      return "🎸";
    case "bpm_challenge":
      return "⏱️";
    case "decade":
      return "📻";
    case "themed":
      return "🎪";
    default:
      return "✨";
  }
}

// ─── Component ───

export default function Inspo() {
  const navigate = useNavigate();
  const [daily, setDaily] = useState<InspoChallenge | null>(null);
  const [random, setRandom] = useState<InspoChallenge | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AcceptedChallenge[]>(loadHistory);
  const [accepted, setAccepted] = useState(false);
  const [sharedToFeed, setSharedToFeed] = useState(false);
  const [postedChallenge, setPostedChallenge] = useState<string | null>(null);

  // ── Fetch daily challenge ──
  useEffect(() => {
    setLoadingDaily(true);
    setError(null);
    api
      .getDailyChallenge()
      .then((data) => {
        setDaily(data.challenge);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load challenge");
      })
      .finally(() => setLoadingDaily(false));
  }, []);

  // ── Fetch random challenge ──
  const fetchRandom = useCallback(async () => {
    setLoadingRandom(true);
    setAccepted(false);
    setSharedToFeed(false);
    setPostedChallenge(null);
    try {
      const data = await api.getRandomChallenge();
      setRandom(data.challenge);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load random challenge");
    } finally {
      setLoadingRandom(false);
    }
  }, []);

  // Determine which challenge to show (random overrides daily)
  const challenge = random || daily;

  // ── Accept Challenge ──
  const handleAccept = useCallback(() => {
    if (!challenge) return;
    saveToHistory(challenge);
    setHistory(loadHistory());
    setAccepted(true);
  }, [challenge]);

  // ── Share to Feed ──
  const handleShareToFeed = useCallback(async () => {
    if (!challenge) return;
    const challengeKey = `${challenge.type}-${challenge.date}`;
    if (postedChallenge === challengeKey) return; // already posted
    try {
      await api.createPost({
        type: "inspo_challenge",
        title: `Accepted the ${getTypeLabel(challenge.type)} challenge`,
        body: challenge.prompt,
      });
      setSharedToFeed(true);
      setPostedChallenge(challengeKey);
    } catch {
      // Non-blocking — post creation may fail silently
    }
  }, [challenge, postedChallenge]);

  // ── Navigate to playlist generator ──
  const handleGoToPlaylists = useCallback(() => {
    if (!challenge) return;
    const encoded = encodeURIComponent(challenge.prompt);
    navigate(`/playlists?prompt=${encoded}`);
  }, [challenge, navigate]);

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          💡 Inspo Corner
        </h1>
        <p className="mt-2 text-base text-gray-400">
          Daily creative challenges to spark your next set
        </p>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="card mb-6 border-red-800 bg-red-900/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ── Daily Challenge Card ── */}
      {loadingDaily ? (
        <div className="card mb-6 flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-400">Loading today's challenge...</span>
        </div>
      ) : challenge ? (
        <div className="card mb-6 overflow-hidden border-gray-700 bg-gradient-to-br from-gray-900 via-gray-900 to-violet-950/30">
          {/* Badge + Date */}
          <div className="mb-4 flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${getTypeColor(challenge.type)}`}
            >
              {getTypeEmoji(challenge.type)} {getTypeLabel(challenge.type)}
            </span>
            <span className="text-xs text-gray-500">
              {challenge.date}
            </span>
          </div>

          {/* Challenge prompt */}
          <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">
            {challenge.prompt}
          </h2>
          <p className="mb-6 text-sm text-gray-400">
            {challenge.description}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {!accepted ? (
              <button
                onClick={handleAccept}
                className="btn-primary text-base px-6"
              >
                🎯 Accept Challenge
              </button>
            ) : (
              <>
                <button
                  onClick={handleGoToPlaylists}
                  className="btn-primary text-base px-6"
                >
                  🚀 Build Playlist
                </button>
                {!sharedToFeed ? (
                  <button
                    onClick={handleShareToFeed}
                    className="btn-secondary text-base px-6"
                  >
                    📢 Share to Feed
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-4 py-2.5 text-sm font-medium text-emerald-400">
                    ✅ Shared to feed
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Surprise Me ── */}
      <div className="mb-8 text-center">
        <button
          onClick={fetchRandom}
          disabled={loadingRandom}
          className="btn-secondary text-base px-8 py-3 disabled:opacity-50"
        >
          {loadingRandom ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              Loading...
            </>
          ) : (
            <>
              🎲 Surprise Me
            </>
          )}
        </button>
        {random && !loadingRandom && (
          <p className="mt-2 text-xs text-gray-500">
            Got a random challenge — accept it above or spin again!
          </p>
        )}
      </div>

      {/* ── Previous Challenges ── */}
      <div className="card">
        <h3 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
          📋 Previous Challenges
        </h3>

        {history.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No challenges accepted yet. Accept your first challenge above!
          </p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 10).map((item, idx) => (
              <div
                key={item.acceptedAt + idx}
                className="flex items-start justify-between gap-4 rounded-lg border border-gray-800 bg-gray-800/40 p-4 transition-colors hover:bg-gray-800/70"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getTypeColor(item.type)}`}
                    >
                      {getTypeEmoji(item.type)} {getTypeLabel(item.type)}
                    </span>
                    <span className="text-[11px] text-gray-600">
                      {new Date(item.acceptedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {item.prompt}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const encoded = encodeURIComponent(item.prompt);
                    navigate(`/playlists?prompt=${encoded}`);
                  }}
                  className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-600/10 transition-colors whitespace-nowrap"
                >
                  Try Again
                </button>
              </div>
            ))}
          </div>
        )}

        {history.length > 10 && (
          <p className="mt-3 text-xs text-gray-600 text-center">
            Showing last 10 of {history.length} accepted challenges
          </p>
        )}
      </div>
    </div>
  );
}
