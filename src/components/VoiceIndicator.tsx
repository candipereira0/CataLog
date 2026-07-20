import { useState, useRef, useEffect, useCallback } from "react";
import {
  VoiceCommandEngine,
  isVoiceSupported,
  showToast,
  type VoiceState,
  type VoiceActionsConfig,
} from "../lib/voice-commands";
import { usePlayer } from "../contexts/PlayerContext";
import { useHotkeys } from "../contexts/HotkeyContext";

// ─── Inline styles for pulsing animation ───
const pulseKeyframes = `
@keyframes voice-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(139, 92, 246, 0); }
}
@keyframes voice-pulse-active {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
}
@keyframes voice-pulse-error {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}
.voice-btn-pulse {
  animation: voice-pulse 2s infinite;
}
.voice-btn-pulse-active {
  animation: voice-pulse-active 1.5s infinite;
}
.voice-btn-pulse-error {
  animation: voice-pulse-error 0.8s infinite;
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out;
}
`;

// Inject styles once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const style = document.createElement("style");
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ─── Props ───

interface VoiceIndicatorProps {
  /** Size variant: "button" for compact toggles, "icon" for standalone */
  variant?: "button" | "icon";
  /** Custom class name */
  className?: string;
  /** Show label next to the mic button */
  showLabel?: boolean;
  /** Called when AI search should be triggered */
  onAISearch?: (query: string) => void;
  /** Called when Shazam modal should open */
  onOpenShazam?: () => void;
}

// ─── Shared engine singleton ───

let engineInstance: VoiceCommandEngine | null = null;

function getEngine(
  actions: VoiceActionsConfig,
  onState: (s: VoiceState) => void
): VoiceCommandEngine {
  if (engineInstance) {
    engineInstance.destroy();
  }
  engineInstance = new VoiceCommandEngine(actions, onState);
  return engineInstance;
}

// ─── Component ───

export default function VoiceIndicator({
  variant = "button",
  className = "",
  showLabel = false,
  onAISearch,
  onOpenShazam,
}: VoiceIndicatorProps) {
  const player = usePlayer();
  const hotkeys = useHotkeys();

  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceState["status"]>("idle");
  const [flash, setFlash] = useState<"none" | "success" | "error">("none");
  const engineRef = useRef<VoiceCommandEngine | null>(null);

  // Inject styles
  useEffect(() => {
    injectStyles();
  }, []);

  // Listen for global toggle event (Ctrl+Shift+V)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "V") {
        e.preventDefault();
        setVoiceOn((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus search handler
  const focusSearch = useCallback(
    (query?: string) => {
      window.dispatchEvent(
        new CustomEvent("catalog:focus-search", { detail: { query } })
      );
    },
    []
  );

  // Start/stop engine based on voiceOn
  useEffect(() => {
    if (voiceOn) {
      const engine = getEngine(
        {
          togglePlay: () => player.togglePlay(),
          playNext: () => player.playNext(),
          playPrevious: () => player.playPrevious(),
          setLoop: (bars: number) => {
            // Player doesn't have setLoop directly — dispatch custom event
            window.dispatchEvent(
              new CustomEvent("catalog:set-loop", { detail: { bars } })
            );
          },
          toggleLoop: () => {
            window.dispatchEvent(new CustomEvent("catalog:toggle-loop"));
          },
          setCue: (slot: number) => {
            window.dispatchEvent(
              new CustomEvent("catalog:set-cue", { detail: { slot } })
            );
          },
          jumpToCue: (slot: number) => {
            window.dispatchEvent(
              new CustomEvent("catalog:jump-to-cue", { detail: { slot } })
            );
          },
          volumeUp: () => hotkeys.setVolume(Math.min(1, hotkeys.volume + 0.05)),
          volumeDown: () => hotkeys.setVolume(Math.max(0, hotkeys.volume - 0.05)),
          toggleMute: () => hotkeys.toggleMute(),
          toggleGigMode: () => {
            window.dispatchEvent(new CustomEvent("catalog:toggle-gig-night"));
          },
          focusSearch: (query?: string) => focusSearch(query),
          openShazam: () => {
            if (onOpenShazam) {
              onOpenShazam();
            } else {
              window.dispatchEvent(new CustomEvent("catalog:toggle-shazam"));
            }
          },
          showToast: (message: string) => showToast(message),
          onAISearch: onAISearch
            ? (query: string) => onAISearch(query)
            : (query: string) => {
                focusSearch(query);
              },
        },
        (state: VoiceState) => {
          setVoiceStatus(state.status);
          setFlash(state.flash);
        }
      );
      engineRef.current = engine;
      engine.start();
    } else {
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
      setVoiceStatus("idle");
      setFlash("none");
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, [voiceOn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
        engineInstance = null;
      }
    };
  }, []);

  // Check browser support
  const supported = isVoiceSupported();

  // If unsupported and variant is button, hide entirely? Or show disabled?
  // In Navbar/Player we want to hide; in Settings we might want to show info
  if (!supported) {
    return null;
  }

  // Status indicator
  const isActive = voiceOn && voiceStatus === "listening";
  const isError = voiceStatus === "error" || voiceStatus === "denied";

  let pulseClass = "voice-btn-pulse";
  if (isActive) pulseClass = "voice-btn-pulse-active";
  if (isError) pulseClass = "voice-btn-pulse-error";

  let iconColor = "text-gray-400";
  if (isActive) iconColor = "text-green-400";
  if (isError) iconColor = "text-red-400";
  if (flash === "success") iconColor = "text-green-400";
  if (flash === "error") iconColor = "text-red-400";

  const handleToggle = () => {
    if (voiceStatus === "denied") {
      showToast("Microphone access denied. Please allow mic in browser settings.");
      return;
    }
    setVoiceOn((prev) => !prev);
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className={`group relative flex items-center gap-1.5 rounded-lg p-2 transition-colors ${
          isActive
            ? "bg-green-600/20 text-green-400"
            : isError
              ? "bg-red-600/20 text-red-400"
              : voiceOn
                ? "bg-violet-600/20 text-violet-400"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
        } ${className}`}
        aria-label={voiceOn ? "Disable voice commands" : "Enable voice commands"}
        title={`Voice commands (Ctrl+Shift+V) — ${voiceOn ? "ON" : "OFF"}`}
      >
        <div
          className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
            isActive
              ? "bg-green-600/20"
              : voiceOn
                ? "bg-violet-600/20"
                : "bg-transparent"
          } ${!isActive && !voiceOn ? "" : pulseClass}`}
        >
          {/* Mic icon */}
          {voiceOn ? (
            <svg
              className={`h-4 w-4 ${iconColor}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-gray-400 group-hover:text-gray-200"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              {/* Slash for OFF state */}
              <line
                x1="2"
                y1="2"
                x2="22"
                y2="22"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          )}

          {/* Status dot */}
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
          )}
          {isError && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
          )}
        </div>

        {/* Label */}
        {showLabel && (
          <span
            className={`text-xs font-medium ${
              isActive
                ? "text-green-400"
                : voiceOn
                  ? "text-violet-400"
                  : "text-gray-400"
            }`}
          >
            {voiceOn ? (isActive ? "Listening" : "ON") : "Voice"}
          </span>
        )}
      </button>
    </>
  );
}
