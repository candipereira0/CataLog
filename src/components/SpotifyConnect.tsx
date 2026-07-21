import { useState, useEffect, useCallback } from "react";

interface SpotifyStatus {
  connected: boolean;
  spotifyUserId: string | null;
  displayName: string | null;
  mock: boolean;
}

interface SpotifyConnectProps {
  /** Called when connection status changes */
  onStatusChange?: (connected: boolean) => void;
}

export default function SpotifyConnect({ onStatusChange }: SpotifyConnectProps) {
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/music/spotify/status", { credentials: "include" });
      const data = await res.json();
      setStatus(data);
      onStatusChange?.(data.connected);
    } catch {
      setStatus({ connected: false, spotifyUserId: null, displayName: null, mock: true });
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Listen for OAuth callback message
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "spotify-connected" && event.data?.success) {
        fetchStatus();
        setMsg("Connected to Spotify!");
        setTimeout(() => setMsg(null), 4000);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchStatus]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/music/spotify/auth-url", { credentials: "include" });
      const data = await res.json();

      if (data.url) {
        if (data.mock) {
          // Mock mode — just call callback directly
          const cbRes = await fetch(data.url, { credentials: "include" });
          if (cbRes.ok) {
            await fetchStatus();
            setMsg("Connected to Spotify (Demo Mode)");
            setTimeout(() => setMsg(null), 4000);
          }
        } else {
          // Real mode — open popup for OAuth
          const popup = window.open(
            data.url,
            "spotify-connect",
            "width=600,height=700,left=" + (window.screenX + (window.innerWidth - 600) / 2) + ",top=" + (window.screenY + (window.innerHeight - 700) / 2),
          );
          if (!popup) {
            setError("Please allow popups for Spotify login");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [fetchStatus]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await fetch("/api/music/spotify/disconnect", { method: "POST", credentials: "include" });
      setStatus({ connected: false, spotifyUserId: null, displayName: null, mock: false });
      setMsg("Disconnected from Spotify");
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Spotify</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Connect your Spotify account to import and export playlists
            </p>
          </div>
        </div>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent mx-auto" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Spotify</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            Connect your Spotify account to import and export playlists
          </p>
        </div>
        <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      </div>

      {msg && (
        <div className="mb-3 rounded-lg bg-green-900/30 border border-green-800 px-4 py-2 text-sm text-green-300">
          {msg}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-red-900/30 border border-red-800 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {status?.connected ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            <span className="text-sm text-gray-300">Connected</span>
            {status.mock && (
              <span className="text-xs text-gray-500 ml-1">(Demo Mode)</span>
            )}
          </div>
          {status.displayName && (
            <p className="mb-3 text-xs text-gray-500">
              Spotify account: {status.displayName}
            </p>
          )}
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center gap-2 rounded-lg bg-[#1DB954] px-4 py-2 text-sm font-medium text-black hover:bg-[#1ed760] transition-colors disabled:opacity-50"
        >
          {connecting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          )}
          {connecting ? "Connecting..." : "Connect Spotify"}
        </button>
      )}
    </div>
  );
}
