import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Player from "./Player";
import Library from "../pages/Library";
import Discover from "../pages/Discover";
import Music from "../pages/Music";
import UploadTrack from "../pages/UploadTrack";
import Playlists from "../pages/Playlists";
import Queue from "../pages/Queue";
import Tags from "../pages/Tags";
import Settings from "../pages/Settings";
import People from "../pages/People";
import Feed from "../pages/Feed";
import GigNight from "../pages/GigNight";
import Venues from "../pages/Venues";
import VenueDetail from "../pages/VenueDetail";
import MyGigs from "../pages/MyGigs";
import Inspo from "../pages/Inspo";
import { useNetworkStatus, useIsStandalone } from "../hooks/useNetworkStatus";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { state, wasOffline } = useNetworkStatus();
  const isStandalone = useIsStandalone();
  const { isInstallable, promptInstall } = useInstallPrompt();

  const [showOnlineBanner, setShowOnlineBanner] = useState(false);
  const onlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global keyboard shortcut: F or G to toggle Gig Night mode
  useKeyboardShortcut([
    {
      key: "f",
      handler: () => navigate("/gig"),
    },
    {
      key: "g",
      handler: () => navigate("/gig"),
    },
  ]);

  // Show "back online" banner briefly when connectivity returns
  useEffect(() => {
    if (state === "reconnecting") {
      setShowOnlineBanner(true);
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
      onlineTimerRef.current = setTimeout(() => {
        setShowOnlineBanner(false);
      }, 5000);
    }
    return () => {
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
    };
  }, [state]);

  const handleInstall = useCallback(async () => {
    await promptInstall();
  }, [promptInstall]);

  const isOffline = state === "offline";

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Offline banner — slide-down animation */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOffline ? "max-h-12 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex items-center justify-center gap-2 bg-amber-600 px-4 py-2.5 text-sm font-medium text-white">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.464 8.464a5 5 0 000 7.072M5.636 5.636a9 9 0 000 12.728" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
          You are offline. Showing cached data.
        </div>
      </div>

      {/* Back online banner — green, auto-dismiss */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showOnlineBanner && !isOffline ? "max-h-12 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          You're back online!
        </div>
      </div>

      {/* Install banner — shows when installable and not standalone */}
      {isInstallable && !isStandalone && (
        <div className="flex items-center justify-between gap-3 bg-violet-600/90 px-4 py-2.5 text-sm font-medium text-white backdrop-blur">
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Install CataLog for offline access
          </span>
          <button
            onClick={handleInstall}
            className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-violet-600 transition-colors hover:bg-gray-100"
          >
            Install
          </button>
        </div>
      )}

      <div className="flex flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/music" element={<Music />} />
            <Route path="/artist/upload" element={<UploadTrack />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/gig" element={<GigNight />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/people" element={<People />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/venues/:id" element={<VenueDetail />} />
            <Route path="/gigs" element={<MyGigs />} />
            <Route path="/inspo" element={<Inspo />} />
          </Routes>
        </main>
      </div>

      {/* Global player */}
      <Player />
    </div>
  );
}
