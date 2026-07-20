import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePlayer } from "./PlayerContext";
import {
  DEFAULT_HOTKEYS,
  resolveBindings,
  loadCustomBindings,
  saveCustomBindings,
  type HotkeyBinding,
} from "../lib/hotkeys";

interface HotkeyContextType {
  /** Current effective bindings (action → key) */
  bindings: Record<string, string>;
  /** All defined hotkey actions with metadata */
  definitions: HotkeyBinding[];
  /** Whether a binding is custom (differs from default) */
  isCustom: (action: string) => boolean;
  /** Remap a hotkey: set a new key for an action. Pass empty string to reset. */
  remap: (action: string, newKey: string) => void;
  /** Reset all bindings to defaults */
  resetAll: () => void;
  /** Whether the player is active (isOpen) — hotkeys only fire when player is open */
  playerActive: boolean;
  /** Volume state (0-1) */
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  /** BPM tap state */
  tapBpm: number | null;
  tapBpmTimestamp: number;
  handleTapBpm: () => void;
}

const HotkeyContext = createContext<HotkeyContextType | null>(null);

const TAP_HISTORY_MAX = 8; // last N taps for BPM calculation
const TAP_WINDOW_MS = 2000; // reset tap history if gap > 2s
const BPM_DISPLAY_MS = 2000; // show tapped BPM for 2 seconds

export function HotkeyProvider({ children }: { children: ReactNode }) {
  const player = usePlayer();

  // Custom bindings from localStorage
  const [customBindings, setCustomBindings] = useState<Record<string, string>>(
    loadCustomBindings
  );

  // Volume state
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("catalog-volume");
      return stored ? parseFloat(stored) : 1.0;
    } catch {
      return 1.0;
    }
  });
  const [muted, setMuted] = useState(false);

  // BPM tap state
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [tapBpmTimestamp, setTapBpmTimestamp] = useState(0);
  const tapHistoryRef = useRef<number[]>([]);
  const tapBpmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve effective bindings
  const bindings = resolveBindings(customBindings);

  // Save volume to localStorage
  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    try {
      localStorage.setItem("catalog-volume", String(clamped));
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  // Apply volume to active audio element
  useEffect(() => {
    const audioEl = document.querySelector("audio");
    if (audioEl) {
      audioEl.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // BPM tap handler
  const handleTapBpm = useCallback(() => {
    const now = Date.now();
    const history = tapHistoryRef.current;

    // Reset if last tap was too long ago
    if (history.length > 0 && now - history[history.length - 1] > TAP_WINDOW_MS) {
      history.length = 0;
    }

    history.push(now);
    if (history.length > TAP_HISTORY_MAX) {
      history.shift();
    }

    // Calculate BPM from intervals
    if (history.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < history.length; i++) {
        totalInterval += history[i] - history[i - 1];
      }
      const avgInterval = totalInterval / (history.length - 1);
      const bpm = Math.round(60000 / avgInterval);
      setTapBpm(bpm);
      setTapBpmTimestamp(now);
    } else {
      // First tap — just show a visual indicator
      setTapBpm(null);
      setTapBpmTimestamp(now);
    }

    // Auto-clear after 2s
    if (tapBpmTimerRef.current) clearTimeout(tapBpmTimerRef.current);
    tapBpmTimerRef.current = setTimeout(() => {
      setTapBpm(null);
    }, BPM_DISPLAY_MS);
  }, []);

  // Remap a hotkey
  const remap = useCallback((action: string, newKey: string) => {
    setCustomBindings((prev) => {
      const next = { ...prev };
      if (newKey === "") {
        delete next[action];
      } else {
        next[action] = newKey;
      }
      saveCustomBindings(next);
      return next;
    });
  }, []);

  // Reset all
  const resetAll = useCallback(() => {
    setCustomBindings({});
    try {
      localStorage.removeItem("catalog-hotkey-bindings");
    } catch {}
  }, []);

  // Check if a binding is custom
  const isCustom = useCallback(
    (action: string) => {
      return action in customBindings && customBindings[action] !== "";
    },
    [customBindings]
  );

  // ─── Keyboard event listener ───
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in input/textarea/select/contenteditable
      // Exception: Escape key always works
      if (e.key !== "Escape") {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        const isInput =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          (e.target as HTMLElement)?.isContentEditable;
        if (isInput) return;
      }

      // Don't fire with modifier keys (except shift for some keys)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;
      // Build a reverse lookup: key → action
      const keyToAction: Record<string, string> = {};
      for (const [action, boundKey] of Object.entries(bindings)) {
        if (!keyToAction[boundKey]) {
          keyToAction[boundKey] = action;
        }
      }

      const action = keyToAction[key];
      if (!action) return;

      e.preventDefault();

      // ─── Dispatch actions ───
      switch (action) {
        // Playback
        case "Play / Pause":
          player.togglePlay();
          break;
        case "Seek backward 5s":
          player.seek(Math.max(0, player.currentTime - 5));
          break;
        case "Seek forward 5s":
          player.seek(Math.min(player.duration, player.currentTime + 5));
          break;

        // Navigation
        case "Next track":
          if (player.queue.length > 0) player.playNext();
          break;
        case "Previous track":
          if (player.queue.length > 0) player.playPrevious();
          break;

        // Loop
        case "Toggle loop":
          player.toggleLoop();
          break;
        case "Set loop to 1 bar":
          player.setLoop(1);
          break;
        case "Set loop to 2 bars":
          player.setLoop(2);
          break;
        case "Set loop to 4 bars":
          player.setLoop(4);
          break;
        case "Set loop to 8 bars":
          player.setLoop(8);
          break;

        // Cue
        case "Set cue point":
          player.setCuePoint(-1); // -1 = next available slot
          break;
        case "Jump to cue 0":
          player.jumpToCue(0);
          break;
        case "Jump to cue 3":
          player.jumpToCue(3);
          break;
        case "Jump to cue 5":
          player.jumpToCue(5);
          break;
        case "Jump to cue 6":
          player.jumpToCue(6);
          break;
        case "Jump to cue 7":
          player.jumpToCue(7);
          break;
        case "Jump to cue 9":
          player.jumpToCue(9);
          break;

        // Volume
        case "Decrease volume 5%":
          setVolume(volume - 0.05);
          break;
        case "Increase volume 5%":
          setVolume(volume + 0.05);
          break;
        case "Mute / Unmute":
          toggleMute();
          break;

        // System
        case "Tap BPM":
          handleTapBpm();
          break;
        case "Toggle Gig Night mode": {
          // Dispatch a custom event that GigNight or Layout can listen to
          window.dispatchEvent(new CustomEvent("catalog:toggle-gig-night"));
          break;
        }
        case "Close modals / Exit gig mode":
          window.dispatchEvent(new CustomEvent("catalog:escape"));
          break;
        case "Toggle Shazam modal":
          window.dispatchEvent(new CustomEvent("catalog:toggle-shazam"));
          break;
        case "Focus search bar":
          window.dispatchEvent(new CustomEvent("catalog:focus-search"));
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings, player, volume, setVolume, toggleMute, handleTapBpm]);

  return (
    <HotkeyContext.Provider
      value={{
        bindings,
        definitions: DEFAULT_HOTKEYS,
        isCustom,
        remap,
        resetAll,
        playerActive: player.isOpen,
        volume,
        setVolume,
        muted,
        toggleMute,
        tapBpm,
        tapBpmTimestamp,
        handleTapBpm,
      }}
    >
      {children}
    </HotkeyContext.Provider>
  );
}

export function useHotkeys() {
  const ctx = useContext(HotkeyContext);
  if (!ctx) throw new Error("useHotkeys must be used within HotkeyProvider");
  return ctx;
}
