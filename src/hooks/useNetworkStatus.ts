import { useState, useEffect, useCallback } from "react";

type NetworkState = "online" | "offline" | "reconnecting";

interface NetworkStatus {
  isOnline: boolean;
  state: NetworkState;
  wasOffline: boolean;
}

/**
 * Hook that tracks network connectivity with debounced state transitions.
 * - "online": navigator.onLine is true and stable
 * - "offline": navigator.onLine is false
 * - "reconnecting": just came back online (transitions to "online" after 2s)
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [state, setState] = useState<NetworkState>(
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline"
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      setState("reconnecting");

      // After 2 seconds stable connection, transition to "online"
      reconnectTimer = setTimeout(() => {
        setState("online");
      }, 2000);
    };

    const handleOffline = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      setIsOnline(false);
      setState("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { isOnline, state, wasOffline };
}

/**
 * Returns whether the app is running in standalone (installed PWA) mode.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      const mq = window.matchMedia("(display-mode: standalone)");
      setStandalone(mq.matches || (window.navigator as { standalone?: boolean }).standalone === true);
    };
    check();

    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, []);

  return standalone;
}
