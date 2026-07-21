import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePlayer } from "../contexts/PlayerContext";
import { api, type Playlist, type Track, type Tag, type ArtistTrack, type DJMatch } from "../lib/api";

interface ProfileData {
  id: number;
  display_name: string;
  handle: string | null;
  bio: string;
  tier: string;
  created_at: string;
  track_count: number;
  playlist_count: number;
  follower_count: number;
  following_count: number;
  is_artist?: number;
  artist_name?: string;
}

export default function Profile() {
  const { handle } = useParams<{ handle: string }>();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<Playlist[]>([]);
  const [recentActivity, setRecentActivity] = useState<Track[]>([]);
  const [tagCloud, setTagCloud] = useState<Tag[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  // Genre tags
  const [userGenres, setUserGenres] = useState<Array<{ genre_name: string; type: "specialize" | "interest" }>>([]);
  const [editingGenres, setEditingGenres] = useState(false);
  const [genreInput, setGenreInput] = useState("");
  const [genreType, setGenreType] = useState<"specialize" | "interest">("interest");

  // Artist tracks
  const [artistTracks, setArtistTracks] = useState<ArtistTrack[]>([]);
  const [artistTracksLoading, setArtistTracksLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"activity" | "music">("activity");

  // DJ Matches
  const [matches, setMatches] = useState<DJMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  const player = usePlayer();

  const fetchProfile = useCallback(async () => {
    if (!handle) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUserProfile(handle);
      setProfile(data.profile);
      setFeaturedPlaylists(data.featured_playlists);
      setRecentActivity(data.recent_activity);
      setTagCloud(data.tag_cloud);
      setIsFollowing(data.is_following);
      // Fetch genre tags
      api.getUserGenres(handle).then(g => setUserGenres(g.genres)).catch(() => {});
      // Fetch DJ matches
      setMatchesLoading(true);
      api.getMatches(data.profile.id, 3).then(m => setMatches(m.matches)).catch(() => {}).finally(() => setMatchesLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Fetch artist tracks when profile loads and user is an artist
  useEffect(() => {
    if (!profile || !profile.is_artist || !handle) return;
    setArtistTracksLoading(true);
    api.getArtistTracksByUser(handle)
      .then((data) => setArtistTracks(data.tracks))
      .catch(() => {})
      .finally(() => setArtistTracksLoading(false));
  }, [profile, handle]);

  const handleFollow = async () => {
    if (!profile || !currentUser) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(profile.id);
        setIsFollowing(false);
        setProfile((prev) => prev ? { ...prev, follower_count: prev.follower_count - 1 } : prev);
      } else {
        await api.followUser(profile.id);
        setIsFollowing(true);
        setProfile((prev) => prev ? { ...prev, follower_count: prev.follower_count + 1 } : prev);
      }
    } catch (err) {
      console.error("Follow error:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleAddGenre = () => {
    const name = genreInput.trim();
    if (!name) return;
    if (userGenres.some(g => g.genre_name.toLowerCase() === name.toLowerCase())) return;
    setUserGenres(prev => [...prev, { genre_name: name, type: genreType }]);
    setGenreInput("");
  };

  const handleRemoveGenre = (name: string) => {
    setUserGenres(prev => prev.filter(g => g.genre_name !== name));
  };

  const handleSaveGenres = async () => {
    try {
      const result = await api.updateMyGenres(userGenres.map(g => ({ name: g.genre_name, type: g.type })));
      setUserGenres(result.genres);
      setEditingGenres(false);
    } catch (err) {
      console.error("Save genres error:", err);
    }
  };

  const genreBadgeCls = (type: string) => {
    return type === "specialize"
      ? "bg-violet-900/40 text-violet-300 border-violet-700"
      : "bg-emerald-900/40 text-emerald-300 border-emerald-700";
  };

  const tierBadge = (tier: string) => {
    if (tier === "lifetime") return { label: "LIFETIME", cls: "bg-amber-900/50 text-amber-300 border-amber-700" };
    if (tier === "pro") return { label: "PRO", cls: "bg-violet-900/50 text-violet-300 border-violet-700" };
    return { label: "FREE", cls: "bg-gray-800 text-gray-400 border-gray-700" };
  };

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-950 px-4">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
          <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">User not found</h1>
        <p className="mt-2 text-gray-400">{error || "This profile doesn't exist."}</p>
        <Link to="/" className="btn-primary mt-6">Back to CataLog</Link>
      </div>
    );
  }

  const tier = tierBadge(profile.tier);
  const joinDate = new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long" });

  return (
    <div className="min-h-dvh bg-gray-950">
      {/* Minimal navbar */}
      <nav className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-800 bg-gray-950/80 px-4 backdrop-blur-md sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-violet-400">Cata</span>
            <span className="text-white">Log</span>
          </span>
        </Link>
        {currentUser ? (
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Dashboard
          </Link>
        ) : (
          <Link to="/login" className="btn-primary py-1.5 text-xs">Sign in</Link>
        )}
      </nav>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="card mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-2xl sm:text-3xl font-bold text-white self-center sm:self-auto">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{profile.display_name}</h1>
                <p className="text-base sm:text-lg text-violet-400">@{profile.handle}</p>
                {profile.bio && <p className="mt-2 text-sm text-gray-400">{profile.bio}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tier.cls}`}>
                    {tier.label}
                  </span>
                  <span className="text-xs text-gray-500">Joined {joinDate}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              {currentUser && !isOwnProfile && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`btn-primary whitespace-nowrap min-h-[44px] ${isFollowing ? "bg-gray-700 hover:bg-gray-600" : ""}`}
                >
                  {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
                </button>
              )}
              {currentUser && !isOwnProfile && profile.handle && (
                <a
                  href={`/tip/@${profile.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary whitespace-nowrap text-xs flex items-center gap-1 min-h-[44px]"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tip DJ
                </a>
              )}
              {isOwnProfile && (
                <Link to="/settings" className="btn-secondary text-xs whitespace-nowrap min-h-[44px]">Edit Profile</Link>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Tracks", value: profile.track_count },
            { label: "Playlists", value: profile.playlist_count },
            { label: "Followers", value: profile.follower_count },
            { label: "Following", value: profile.following_count },
          ].map((stat) => (
            <div key={stat.label} className="card flex flex-col items-center py-4">
              <span className="text-2xl font-bold text-white">{stat.value}</span>
              <span className="text-xs text-gray-500">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs — only show if artist */}
            {profile.is_artist ? (
              <div className="flex border-b border-gray-800">
                <button
                  onClick={() => setActiveTab("activity")}
                  className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "activity"
                      ? "border-violet-500 text-violet-400"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Activity
                </button>
                <button
                  onClick={() => setActiveTab("music")}
                  className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "music"
                      ? "border-violet-500 text-violet-400"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Music ({artistTracks.length})
                </button>
              </div>
            ) : null}

            {activeTab === "activity" ? (
              <>
                {/* Featured Playlists */}
                {featuredPlaylists.length > 0 && (
                  <div className="card">
                    <h2 className="mb-4 text-lg font-semibold text-gray-200">Featured Playlists</h2>
                    <div className="space-y-3">
                      {featuredPlaylists.map((pl) => (
                        <div key={pl.id} className="flex items-center gap-3 rounded-lg border border-gray-700/50 bg-gray-800/30 p-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-600/20">
                            <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-200">{pl.name}</p>
                            {pl.description && <p className="truncate text-xs text-gray-500">{pl.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                <div className="card">
                  <h2 className="mb-4 text-lg font-semibold text-gray-200">Recent Activity</h2>
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-gray-500">No tracks yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {recentActivity.map((track) => (
                        <div key={track.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-800/50">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-200">{track.title || track.filename}</p>
                            <p className="truncate text-xs text-gray-500">{track.artist || "—"}</p>
                          </div>
                          <div className="flex-shrink-0 text-xs text-gray-600">
                            {track.genre && <span className="mr-2">{track.genre}</span>}
                            {track.bpm && <span>{Math.round(track.bpm)} BPM</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Music tab */
              <div className="card">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-200">Artist Tracks</h2>
                  {isOwnProfile && (
                    <Link to="/artist/upload" className="btn-primary py-1 text-xs">
                      Upload Track
                    </Link>
                  )}
                </div>

                {artistTracksLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                  </div>
                ) : artistTracks.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No tracks published yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {artistTracks.map((track) => (
                      <div key={track.id} className="flex items-center gap-4 rounded-lg border border-gray-700/50 bg-gray-800/30 p-3">
                        {/* Cover art */}
                        {track.cover_art_url ? (
                          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-700">
                            <div className="flex h-full w-full items-center justify-center text-gray-600">
                              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-violet-600/20">
                            <svg className="h-6 w-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>
                        )}

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-200">{track.title}</p>
                          <p className="truncate text-xs text-gray-500">{track.artist_name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                            {track.genre && <span>{track.genre}</span>}
                            {track.bpm && <span>{Math.round(track.bpm)} BPM</span>}
                            {track.musical_key && <span>{track.musical_key}</span>}
                            <span>{track.play_count} plays</span>
                            <span>{track.download_count} downloads</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => player?.openPlayer({
                              title: track.title,
                              artist: track.artist_name,
                              audioSrc: api.getArtistTrackStreamUrl(track.id),
                              bpm: track.bpm,
                              musical_key: track.musical_key,
                              genre: track.genre,
                            })}
                            className="btn-secondary py-1.5 text-xs"
                          >
                            Preview
                          </button>
                          {track.price_cents === 0 ? (
                            <button
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = api.getArtistTrackStreamUrl(track.id);
                                a.download = `${track.artist_name} - ${track.title}.mp3`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="btn-secondary py-1.5 text-xs"
                            >
                              Download
                            </button>
                          ) : (
                            <button className="btn-primary py-1.5 text-xs">
                              Buy (${(track.price_cents / 100).toFixed(2)})
                            </button>
                          )}
                          {currentUser && !isOwnProfile && (
                            <button
                              onClick={async () => {
                                try { await api.addArtistTrackToLibrary(track.id); }
                                catch {}
                              }}
                              className="btn-secondary py-1.5 text-xs"
                            >
                              + Library
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar: Tag Cloud + Similar DJs */}
          <div className="space-y-6">
            {tagCloud.length > 0 && (
              <div className="card">
                <h2 className="mb-4 text-lg font-semibold text-gray-200">Top Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {tagCloud.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-block rounded-full bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-violet-600/20 hover:text-violet-400 transition-colors cursor-default"
                    >
                      {tag.name}
                      {tag.track_count ? (
                        <span className="ml-1 text-gray-600">×{tag.track_count}</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Similar DJs */}
            {!isOwnProfile && (
              <div className="card">
                <h2 className="mb-4 text-lg font-semibold text-gray-200">Similar DJs</h2>
                {matchesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                  </div>
                ) : matches.length === 0 ? (
                  <p className="text-sm text-gray-500">No similar DJs found. This DJ may not have genre tags set up.</p>
                ) : (
                  <div className="space-y-3">
                    {matches.slice(0, 3).map((match) => (
                      <Link
                        key={match.id}
                        to={`/@${match.handle}`}
                        className="block rounded-lg border border-gray-700/50 bg-gray-800/30 p-3 hover:border-violet-700/50 hover:bg-violet-950/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-600/30 text-sm font-bold text-violet-300">
                            {match.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-200">{match.display_name}</p>
                            <p className="truncate text-xs text-gray-500">@{match.handle}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span className="rounded-full bg-violet-900/40 px-2 py-0.5 text-[10px] text-violet-300">
                                {match.shared_genre_count} shared {match.shared_genre_count === 1 ? "genre" : "genres"}
                              </span>
                              {match.same_city && match.city && (
                                <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-300">
                                  📍 {match.city}
                                </span>
                              )}
                            </div>
                            {match.shared_genres.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {match.shared_genres.slice(0, 3).map((g) => (
                                  <span key={g} className="text-[10px] text-gray-600">{g}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                    {matches.length > 3 && (
                      <Link
                        to={`/@${profile.handle}?tab=matches`}
                        className="block text-center text-xs text-violet-400 hover:text-violet-300 transition-colors py-1"
                      >
                        View {matches.length - 3} more →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
