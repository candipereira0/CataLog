import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import { api, type SearchResult } from "../lib/api";
import { useSyncEvents } from "../lib/sync-client";
import ShazamModal from "./ShazamModal";
import NotificationsDropdown from "./NotificationsDropdown";
import VoiceIndicator from "./VoiceIndicator";

interface NavbarProps {
  onMenuToggle: () => void;
  onTrackSelect?: (trackId: number) => void;
}

export default function Navbar({ onMenuToggle, onTrackSelect }: NavbarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shazamOpen, setShazamOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sync = useSyncEvents();
  const [syncTooltip, setSyncTooltip] = useState(false);

  // AI Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchExplanation, setSearchExplanation] = useState("");
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const results = await api.searchTracks(query.trim());
      setSearchResults(results.matches);
      setSearchExplanation(results.explanation);
      setShowResults(true);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length >= 2) {
      searchTimeout.current = setTimeout(() => doSearch(value), 400);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      doSearch(searchQuery);
    }
    if (e.key === "Escape") {
      setShowResults(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    setSearchQuery("");
    // Dispatch custom event so Library page can open track detail
    window.dispatchEvent(new CustomEvent("catalog:open-track", { detail: { trackId: result.trackId } }));
    if (onTrackSelect) {
      onTrackSelect(result.trackId);
    }
  };

  return (
    <nav className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-800 bg-gray-950/80 px-4 backdrop-blur-md sm:px-6">
      {/* Left: hamburger + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-violet-400">Cata</span>
            <span className="text-white">Log</span>
          </span>
        </Link>
      </div>

      {/* Center: AI search bar */}
      <div className="hidden flex-1 max-w-md mx-8 sm:block">
        <div className="relative" ref={searchRef}>
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
            placeholder='AI Search: "female rapper electro pop", lyrics, BPM...'
            className="input-field pl-10 pr-8 py-2 text-sm"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          )}

          {/* Results dropdown */}
          {showResults && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-80 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                  {searching ? "Searching..." : searchQuery.trim().length < 2 ? "Type at least 2 characters to search" : "No tracks found. Try a broader query."}
                </div>
              ) : (
                <>
                  {searchExplanation && (
                    <div className="border-b border-gray-800 px-4 py-2 text-xs text-violet-400">
                      {searchExplanation}
                    </div>
                  )}
                  {searchResults.map((result) => (
                    <button
                      key={result.trackId}
                      onClick={() => handleResultClick(result)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-800/70 transition-colors border-b border-gray-800/50 last:border-b-0"
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-violet-600/20 text-xs font-medium text-violet-400">
                          ♫
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-200">{result.title}</p>
                        <p className="truncate text-xs text-gray-400">{result.artist}</p>
                        {result.genre && (
                          <span className="mt-1 inline-block rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
                            {result.genre}
                          </span>
                        )}
                      </div>
                      <div className="flex-shrink-0 max-w-[180px]">
                        <p className="text-xs text-gray-500 italic leading-tight">{result.reason}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: user menu */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <NotificationsDropdown />

        {/* Voice commands toggle */}
        <VoiceIndicator
          onOpenShazam={() => setShazamOpen(true)}
        />

        {/* Identify button */}
        <button
          onClick={() => setShazamOpen(true)}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-violet-400 transition-colors"
          aria-label="Identify music"
          title="Identify playing music"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </button>

        {/* Sync status dot */}
        {user && (
          <div className="relative">
            <button
              onClick={() => { setSyncTooltip(!syncTooltip); sync.reconnect(); }}
              onMouseEnter={() => setSyncTooltip(true)}
              onMouseLeave={() => setSyncTooltip(false)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 transition-colors"
              aria-label={`Sync status: ${sync.status}`}
              title={`Sync: ${sync.status}`}
            >
              <span
                className={`block h-2.5 w-2.5 rounded-full ${
                  sync.status === "connected"
                    ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                    : sync.status === "reconnecting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-red-500"
                }`}
              />
            </button>
            {syncTooltip && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-400 shadow-xl z-50">
                <p>
                  {sync.status === "connected"
                    ? `Synced ${sync.lastSyncTime ? Math.floor((Date.now() - sync.lastSyncTime) / 1000) + "s ago" : "just now"}`
                    : sync.status === "reconnecting"
                    ? "Reconnecting..."
                    : "Disconnected"}
                </p>
                {sync.status !== "connected" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); sync.reconnect(); }}
                    className="mt-1 text-violet-400 hover:text-violet-300"
                  >
                    Reconnect
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile search toggle */}
        <button
          className="sm:hidden rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          aria-label="Search"
          onClick={() => {
            // On mobile, the search is in a separate view — focus the input
            const mobileSearch = document.querySelector('.mobile-search-input') as HTMLInputElement;
            if (mobileSearch) mobileSearch.focus();
          }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg p-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors min-h-[44px]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline font-medium">
                {user.display_name}
              </span>
              {user.handle && (
                <span className="hidden sm:inline text-xs text-gray-500">@{user.handle}</span>
              )}
              {user.tier !== "free" && (
                <span className={`hidden sm:inline rounded-full px-2 py-0.5 text-xs font-semibold ${
                  user.tier === "lifetime"
                    ? "bg-amber-900/50 text-amber-400"
                    : "bg-violet-900/50 text-violet-300"
                }`}>
                  {user.tier.toUpperCase()}
                </span>
              )}
              <svg
                className="hidden h-4 w-4 text-gray-500 sm:block"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl">
                <div className="border-b border-gray-700 px-4 py-2">
                  <p className="text-sm font-medium text-gray-200">
                    {user.display_name}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  {user.handle && (
                    <p className="text-xs text-violet-400">@{user.handle}</p>
                  )}
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium $({
                    user.tier === "lifetime"
                      ? "bg-amber-900/50 text-amber-300"
                      : user.tier === "pro"
                      ? "bg-violet-900/50 text-violet-300"
                      : "bg-gray-800 text-gray-400"
                  )}`}>
                    {user.tier.toUpperCase()}
                  </span>
                </div>
                {user.handle && (
                  <Link
                    to={`/@${user.handle}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    My Profile
                  </Link>
                )}
                {user.tier === "free" && (
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-violet-400 hover:bg-gray-800 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Upgrade to Pro
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shazam Modal */}
      <ShazamModal isOpen={shazamOpen} onClose={() => setShazamOpen(false)} />
    </nav>
  );
}
