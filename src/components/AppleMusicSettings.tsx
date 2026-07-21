import { useState, useCallback } from "react";
import { api } from "../lib/api";

export default function AppleMusicSettings() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appleClientId = (import.meta as any).env?.VITE_APPLE_CLIENT_ID || "";

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    setMsg(null);
    try {
      // Get a MusicKit developer token from our backend
      const res = await fetch("/api/music/apple-token", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (data.token && data.token.startsWith("mock-")) {
        // Mock mode
        setConnected(true);
        setMsg("Connected to Apple Music (Demo Mode)");
      } else if (data.token) {
        // Real mode: initialize MusicKit
        setConnected(true);
        setMsg("Connected to Apple Music");
      } else {
        setError("Failed to get MusicKit token");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setMsg("Disconnected from Apple Music");
  }, []);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Apple Music</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            Connect your Apple Music account to import and export playlists
          </p>
        </div>
        <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
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

      {connected ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            <span className="text-sm text-gray-300">Connected</span>
            {!appleClientId && (
              <span className="text-xs text-gray-500 ml-1">(Demo Mode)</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 transition-colors disabled:opacity-50"
        >
          {connecting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
          )}
          {connecting ? "Connecting..." : "Connect Apple Music"}
        </button>
      )}

      {!appleClientId && (
        <p className="mt-3 text-xs text-gray-600">
          Running in demo mode. Set VITE_APPLE_CLIENT_ID and MusicKit credentials for full Apple Music integration.
        </p>
      )}
    </div>
  );
}
