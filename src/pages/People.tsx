import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface DiscoverUser {
  id: number;
  display_name: string;
  handle: string | null;
  bio: string;
  tier: string;
  playlist_count: number;
  follower_count: number;
}

export default function People() {
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .discoverUsers()
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  const tierBadge = (tier: string) => {
    if (tier === "lifetime") return "bg-amber-900/50 text-amber-300 border border-amber-700";
    if (tier === "pro") return "bg-violet-900/50 text-violet-300 border border-violet-700";
    return "bg-gray-800 text-gray-400 border border-gray-700";
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">People</h1>
        <p className="mt-1 text-sm text-gray-400">Discover CataLog users with the most public playlists.</p>
      </div>

      {loading && (
        <div className="card flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-400">Loading...</span>
        </div>
      )}

      {error && (
        <div className="card mb-6 border-red-800 bg-red-900/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
            <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">No users yet</h2>
          <p className="mt-1 text-sm text-gray-400">Be the first to set a handle and share public playlists!</p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <Link
              key={u.id}
              to={`/@${u.handle}`}
              className="card group transition-all duration-200 hover:border-violet-700 hover:shadow-lg hover:shadow-violet-500/5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-lg font-bold text-white">
                  {u.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-200 group-hover:text-violet-300 transition-colors">
                    {u.display_name}
                  </p>
                  <p className="truncate text-sm text-violet-400">@{u.handle}</p>
                  {u.bio && (
                    <p className="mt-1 truncate text-xs text-gray-500">{u.bio}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <span className="text-xs text-gray-500">
                  <span className="font-medium text-gray-300">{u.playlist_count}</span> playlists
                </span>
                <span className="text-xs text-gray-500">
                  <span className="font-medium text-gray-300">{u.follower_count}</span> followers
                </span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${tierBadge(u.tier)}`}>
                  {u.tier.toUpperCase()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
