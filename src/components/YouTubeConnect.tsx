import { useState, useEffect, useCallback } from "react";

interface YouTubeStatus {
  connected: boolean;
  channelName: string | null;
  subscriberCount: number | null;
  mock: boolean;
}

interface YouTubeConnectProps {
  onStatusChange?: (connected: boolean) => void;
}

export default function YouTubeConnect({ onStatusChange }: YouTubeConnectProps) {
  const [status, setStatus] = useState<YouTubeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/music/youtube/status", { credentials: "include" });
      const data = await res.json();
      setStatus(data);
      onStatusChange?.(data.connected);
    } catch {
      setStatus({ connected: false, channelName: null, subscriberCount: null, mock: true });
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Listen for OAuth callback message
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "youtube-connected" && event.data?.success) {
        fetchStatus();
        setMsg("Connected to YouTube!");
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
      const res = await fetch("/api/music/youtube/auth-url", { credentials: "include" });
      const data = await res.json();

      if (data.url) {
        if (data.mock) {
          // Mock mode — just call callback directly
          const cbRes = await fetch(data.url, { credentials: "include" });
          if (cbRes.ok) {
            await fetchStatus();
            setMsg("Connected to YouTube (Demo Mode)");
            setTimeout(() => setMsg(null), 4000);
          }
        } else {
          // Real mode — open popup for OAuth
          const popup = window.open(
            data.url,
            "youtube-connect",
            "width=600,height=700,left=" + (window.screenX + (window.innerWidth - 600) / 2) + ",top=" + (window.screenY + (window.innerHeight - 700) / 2),
          );
          if (!popup) {
            setError("Please allow popups for YouTube login");
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
      await fetch("/api/music/youtube/disconnect", { method: "POST", credentials: "include" });
      setStatus({ connected: false, channelName: null, subscriberCount: null, mock: false });
      setMsg("Disconnected from YouTube");
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
            <h3 className="text-lg font-semibold text-white">YouTube</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Connect your YouTube account to export playlists and import liked tracks
            </p>
          </div>
        </div>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent mx-auto" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">YouTube</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            Connect your YouTube account to export playlists and import liked tracks
          </p>
        </div>
        <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
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
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            <span className="text-sm text-gray-300">Connected</span>
            {status.mock && (
              <span className="text-xs text-gray-500 ml-1">(Demo Mode)</span>
            )}
          </div>
          {status.channelName && (
            <p className="mb-1 text-xs text-gray-500">
              Channel: {status.channelName}
            </p>
          )}
          {status.subscriberCount != null && status.subscriberCount > 0 && (
            <p className="mb-3 text-xs text-gray-500">
              Subscribers: {status.subscriberCount.toLocaleString()}
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
          className="flex items-center gap-2 rounded-lg bg-[#FF0000] px-4 py-2 text-sm font-medium text-white hover:bg-[#CC0000] transition-colors disabled:opacity-50"
        >
          {connecting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          )}
          {connecting ? "Connecting..." : "Connect YouTube"}
        </button>
      )}
    </div>
  );
}
