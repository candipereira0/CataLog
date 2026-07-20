// Sync client for cross-device real-time sync.
// Uses SSE (EventSource) with polling fallback.
// Provides a React-friendly hook and event emitter.

import type { SyncEvent, DeviceInfo } from "./api";

const API_BASE = "/api";

type SyncEventHandler = (event: SyncEvent) => void;

class SyncClient {
  private eventSource: EventSource | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private handlers = new Set<SyncEventHandler>();
  private _status: "connected" | "reconnecting" | "disconnected" = "disconnected";
  private _lastSyncTime: number = 0;
  private _deviceId: number | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private statusListeners = new Set<(status: string) => void>();
  private useSSE = true; // Set to false to force polling

  get status() { return this._status; }
  get lastSyncTime() { return this._lastSyncTime; }
  get deviceId() { return this._deviceId; }

  onEvent(handler: SyncEventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  onStatusChange(handler: (status: string) => void): () => void {
    this.statusListeners.add(handler);
    return () => { this.statusListeners.delete(handler); };
  }

  private setStatus(s: "connected" | "reconnecting" | "disconnected") {
    if (this._status !== s) {
      this._status = s;
      this.statusListeners.forEach(h => h(s));
    }
  }

  private emit(event: SyncEvent) {
    this._lastSyncTime = Date.now();
    this.handlers.forEach(h => {
      try { h(event); } catch { /* ignore handler errors */ }
    });
  }

  connect() {
    if (this.useSSE) {
      this.connectSSE();
    } else {
      this.startPolling();
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.setStatus("disconnected");
  }

  private connectSSE() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.setStatus("reconnecting");

    try {
      this.eventSource = new EventSource(`${API_BASE}/sync/stream`, { withCredentials: true });

      this.eventSource.onopen = () => {
        this.setStatus("connected");
        this.reconnectDelay = 1000;
      };

      this.eventSource.onmessage = (e) => {
        try {
          const event: SyncEvent = JSON.parse(e.data);
          if (event.type === "connected" && event.payload) {
            const p = event.payload as { deviceId?: number };
            if (p.deviceId) this._deviceId = p.deviceId;
          }
          this.emit(event);
        } catch {
          // Ignore parse errors from keep-alive pings
        }
      };

      this.eventSource.onerror = () => {
        this.setStatus("reconnecting");
        this.eventSource?.close();
        this.eventSource = null;
        // Exponential backoff reconnect
        setTimeout(() => {
          if (this.useSSE) this.connectSSE();
        }, this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      };
    } catch {
      // SSE not supported, fall back to polling
      this.useSSE = false;
      this.startPolling();
    }
  }

  private startPolling() {
    if (this.pollTimer) return;
    this.setStatus("reconnecting");

    // Initial poll
    this.poll();

    // Poll every 5 seconds
    this.pollTimer = setInterval(() => this.poll(), 5000);
  }

  private async poll() {
    try {
      const since = this._lastSyncTime || Date.now() - 60000;
      const res = await fetch(`${API_BASE}/sync/poll?since=${since}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          // Not authenticated, stop polling
          this.disconnect();
          return;
        }
        this.setStatus("reconnecting");
        return;
      }
      const data = await res.json() as { events: SyncEvent[]; deviceId: number | null };
      this.setStatus("connected");
      if (data.deviceId) this._deviceId = data.deviceId;

      for (const event of data.events) {
        this.emit(event);
      }
    } catch {
      this.setStatus("reconnecting");
    }
  }

  forceSSE() {
    this.useSSE = true;
    this.disconnect();
    this.connect();
  }

  forcePolling() {
    this.useSSE = false;
    this.disconnect();
    this.connect();
  }
}

// Singleton instance
let _syncClient: SyncClient | null = null;
export function getSyncClient(): SyncClient {
  if (!_syncClient) {
    _syncClient = new SyncClient();
  }
  return _syncClient;
}

// React hook for sync events
import { useState, useEffect, useCallback } from "react";

export function useSyncEvents() {
  const [status, setStatus] = useState<string>("disconnected");
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [deviceId, setDeviceId] = useState<number | null>(null);

  useEffect(() => {
    const client = getSyncClient();
    setStatus(client.status);
    setLastSyncTime(client.lastSyncTime);
    setDeviceId(client.deviceId);

    const unsubStatus = client.onStatusChange(setStatus);
    const unsubEvent = client.onEvent(() => {
      setLastSyncTime(Date.now());
      setDeviceId(client.deviceId);
    });

    // Auto-connect if not already
    if (client.status === "disconnected") {
      client.connect();
    }

    return () => {
      unsubStatus();
      unsubEvent();
    };
  }, []);

  const reconnect = useCallback(() => {
    const client = getSyncClient();
    client.disconnect();
    client.connect();
  }, []);

  return { status, lastSyncTime, deviceId, reconnect };
}

// Helper to listen for specific event types and invoke a callback
export function useSyncEventListener(
  eventType: string,
  callback: (payload: unknown) => void,
  deps: unknown[] = []
) {
  useEffect(() => {
    const client = getSyncClient();
    const unsub = client.onEvent((event) => {
      if (event.type === eventType) {
        callback(event.payload);
      }
    });
    return unsub;
  }, [eventType, ...deps]);
}
