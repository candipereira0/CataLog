import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePlayer } from "../contexts/PlayerContext";
import VoiceIndicator from "../components/VoiceIndicator";
import {
  GENRE_PRESETS,
  mapGenreToPreset,
  getMoodColor,
  getBackdropLabel,
  type BackdropPreset,
} from "../lib/gig-backdrops";

// ─── Types ───

type BackdropSource =
  | { type: "preset"; id: string }
  | { type: "upload"; dataUrl: string }
  | { type: "url"; url: string };

// ─── LocalStorage helpers ───

const STORAGE_KEY_PREFIX = "gig-backdrop-";

function saveUploadedBackdrop(dataUrl: string) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + "upload", dataUrl);
  } catch {
    // quota exceeded — silently ignore
  }
}

function loadUploadedBackdrop(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + "upload");
  } catch {
    return null;
  }
}

function saveCustomUrl(url: string) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + "customurl", url);
  } catch {}
}

function loadCustomUrl(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + "customurl");
  } catch {
    return null;
  }
}

// ─── BPM to beat interval ───

function bpmToMs(bpm: number | null | undefined): number {
  const safe = bpm && bpm > 0 ? bpm : 120;
  return (60 / safe) * 1000;
}

// ─── Audio Visualizer (full-width canvas) ───

function AudioVisualizer({
  isPlaying,
  bpm,
  className,
}: {
  isPlaying: boolean;
  bpm: number | null | undefined;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const barCount = 64;
    const barWidth = (rect.width / barCount) * 0.8;
    const gap = (rect.width / barCount) * 0.2;
    const midY = rect.height / 2;
    let phase = 0;

    const draw = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      for (let i = 0; i < barCount; i++) {
        let amplitude: number;
        if (isPlaying) {
          const t = phase + i * 0.2;
          amplitude =
            Math.abs(Math.sin(t * 2.0) * 0.6 + Math.sin(t * 4.3) * 0.25 + Math.sin(t * 7.1 + i * 0.5) * 0.15);
          amplitude = Math.min(1, amplitude * 1.3);
        } else {
          amplitude = Math.abs(Math.sin(i * 0.4) * 0.2 + Math.sin(i * 0.7) * 0.1);
        }

        const maxH = rect.height * 0.42;
        const minH = 4;
        const h = Math.max(minH, amplitude * maxH);
        const x = i * (barWidth + gap) + gap / 2;
        const y = midY - h / 2;

        const hue = 260 + i * 8;
        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, `hsla(${hue}, 70%, 65%, 0.9)`);
        gradient.addColorStop(0.5, `hsla(${hue + 20}, 80%, 55%, 0.8)`);
        gradient.addColorStop(1, `hsla(${hue}, 70%, 45%, 0.6)`);

        ctx.fillStyle = gradient;
        const radius = Math.min(barWidth / 2, 3);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, y + h - radius);
        ctx.quadraticCurveTo(x + barWidth, y + h, x + barWidth - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();
      }

      if (isPlaying) {
        phase += 0.12;
        frameRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full ${className ?? "h-32"}`}
    />
  );
}

// ─── Control Bar Component ───

function ControlBar({
  onExit,
  currentBackdropLabel,
  onCycleBackdrop,
  showVisualizer,
  setShowVisualizer,
  showGlow,
  setShowGlow,
  backdropOpacity,
  setBackdropOpacity,
  onUploadImage,
  onCustomUrl,
  isPlaying,
  onTogglePlay,
  onNext,
}: {
  onExit: () => void;
  currentBackdropLabel: string;
  onCycleBackdrop: () => void;
  showVisualizer: boolean;
  setShowVisualizer: (v: boolean) => void;
  showGlow: boolean;
  setShowGlow: (v: boolean) => void;
  backdropOpacity: number;
  setBackdropOpacity: (v: number) => void;
  onUploadImage: () => void;
  onCustomUrl: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-gray-950/80 px-4 py-2.5 backdrop-blur-md border border-gray-800/50">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Next */}
      <button
        onClick={onNext}
        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
        aria-label="Next track"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>

      <div className="h-5 w-px bg-gray-700" />

      {/* Backdrop label + cycle */}
      <button
        onClick={onCycleBackdrop}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700/50 hover:text-white"
        title="Cycle backdrop"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {currentBackdropLabel}
      </button>

      {/* Upload image */}
      <button
        onClick={handleUploadClick}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700/50 hover:text-white"
        title="Upload custom image"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Upload
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onUploadImage}
      />

      {/* Custom URL */}
      <button
        onClick={onCustomUrl}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700/50 hover:text-white"
        title="Image from URL"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        URL
      </button>

      <div className="h-5 w-px bg-gray-700" />

      {/* Toggle visualizer */}
      <button
        onClick={() => setShowVisualizer(!showVisualizer)}
        className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
          showVisualizer
            ? "bg-violet-600/30 text-violet-300"
            : "text-gray-400 hover:bg-gray-700/50 hover:text-white"
        }`}
        title="Toggle visualizer"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </button>

      {/* Toggle glow */}
      <button
        onClick={() => setShowGlow(!showGlow)}
        className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
          showGlow
            ? "bg-violet-600/30 text-violet-300"
            : "text-gray-400 hover:bg-gray-700/50 hover:text-white"
        }`}
        title="Toggle glow"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>

      {/* Backdrop opacity slider */}
      <div className="flex items-center gap-1.5">
        <svg className="h-3 w-3 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2V4a8 8 0 100 16z" />
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={backdropOpacity}
          onChange={(e) => setBackdropOpacity(parseFloat(e.target.value))}
          className="h-1 w-16 cursor-pointer appearance-none rounded bg-gray-700 accent-violet-500"
          title="Backdrop opacity"
        />
      </div>

      <div className="h-5 w-px bg-gray-700" />

      {/* Voice commands — hidden control for hands-free operation */}
      <VoiceIndicator variant="icon" className="p-1" />

      <div className="h-5 w-px bg-gray-700" />

      {/* Exit */}
      <button
        onClick={onExit}
        className="flex items-center gap-1 rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-600/40"
        title="Exit Gig Mode"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Exit
      </button>
    </div>
  );
}

// ─── Main GigNight Component ───

export default function GigNight() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    queue,
    queueIndex,
    playNext,
  } = usePlayer();

  // State
  const [backdropSource, setBackdropSource] = useState<BackdropSource>(() => {
    const uploaded = loadUploadedBackdrop();
    if (uploaded) return { type: "upload", dataUrl: uploaded };
    const customUrl = loadCustomUrl();
    if (customUrl) return { type: "url", url: customUrl };
    const genrePresetId = mapGenreToPreset(currentTrack?.genre);
    return { type: "preset", id: genrePresetId };
  });

  const [showVisualizer, setShowVisualizer] = useState(true);
  const [showGlow, setShowGlow] = useState(true);
  const [backdropOpacity, setBackdropOpacity] = useState(0.6);
  const [showControls, setShowControls] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [prevTrackId, setPrevTrackId] = useState<number | undefined>(currentTrack?.id);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (mouseMoveTimeoutRef.current) clearTimeout(mouseMoveTimeoutRef.current);
    mouseMoveTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Show controls initially for 3 seconds
  useEffect(() => {
    setShowControls(true);
    const t = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Track transition effect
  useEffect(() => {
    const trackId = currentTrack?.id;
    if (trackId !== prevTrackId && prevTrackId !== undefined) {
      setTransitioning(true);
      const t = setTimeout(() => setTransitioning(false), 800);
      // Auto-update backdrop to match genre
      if (backdropSource.type === "preset") {
        const newPreset = mapGenreToPreset(currentTrack?.genre);
        setBackdropSource({ type: "preset", id: newPreset });
      }
      return () => clearTimeout(t);
    }
    setPrevTrackId(trackId);
  }, [currentTrack?.id]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (mouseMoveTimeoutRef.current) clearTimeout(mouseMoveTimeoutRef.current);
    };
  }, []);

  // Auto-advance: when currentTrack is null but queue exists, or track ended callback
  useEffect(() => {
    if (!currentTrack && queue.length > 0 && queueIndex < queue.length - 1) {
      playNext();
    }
  }, [currentTrack, queue, queueIndex, playNext]);

  // ─── Derived values ───

  const presetId = backdropSource.type === "preset" ? backdropSource.id : null;
  const preset = presetId ? GENRE_PRESETS.find((p) => p.id === presetId) : undefined;

  const beatMs = bpmToMs(currentTrack?.bpm);
  const beatIntervalS = beatMs / 1000;

  const moodColor = getMoodColor(currentTrack?.genre);

  const currentBackdropLabel = getBackdropLabel(
    backdropSource.type === "preset"
      ? backdropSource.id
      : backdropSource.type === "upload"
        ? "custom-upload"
        : "custom-url"
  );

  const upcomingTrack = queue.length > queueIndex + 1 ? queue[queueIndex + 1] : null;

  // ─── Handlers ───

  const handleExit = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleCycleBackdrop = useCallback(() => {
    if (backdropSource.type === "preset") {
      const presets = GENRE_PRESETS;
      const currentIdx = presets.findIndex((p) => p.id === backdropSource.id);
      const nextIdx = (currentIdx + 1) % presets.length;
      setBackdropSource({ type: "preset", id: presets[nextIdx].id });
    } else {
      // If custom, cycle back to first preset
      setBackdropSource({ type: "preset", id: GENRE_PRESETS[0].id });
    }
  }, [backdropSource]);

  const handleUploadImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be under 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setBackdropSource({ type: "upload", dataUrl });
        saveUploadedBackdrop(dataUrl);
      };
      reader.readAsDataURL(file);

      // Reset input
      e.target.value = "";
    },
    []
  );

  const handleCustomUrl = useCallback(() => {
    const url = window.prompt("Enter image URL:");
    if (!url) return;
    // Basic validation
    try {
      new URL(url);
    } catch {
      alert("Invalid URL");
      return;
    }
    setBackdropSource({ type: "url", url });
    saveCustomUrl(url);
  }, []);

  const handleNext = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      playNext();
      setTimeout(() => setTransitioning(false), 100);
    }, 300);
  }, [playNext]);

  // ─── Backdrop style ───

  const backdropStyle: React.CSSProperties = useMemo(() => {
    if (backdropSource.type === "upload") {
      return {
        backgroundImage: `url(${backdropSource.dataUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: backdropOpacity,
      };
    }
    if (backdropSource.type === "url") {
      return {
        backgroundImage: `url(${backdropSource.url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: backdropOpacity,
      };
    }
    // preset
    if (preset) {
      return {
        ...preset.style,
        opacity: backdropOpacity,
      };
    }
    return {};
  }, [backdropSource, preset, backdropOpacity]);

  // ─── Render ───

  if (!currentTrack) {
    return (
      <div className="fixed inset-0 z-50 flex h-dvh w-dvw items-center justify-center bg-gray-950">
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <p className="mt-4 text-gray-400">No track playing</p>
          <p className="text-sm text-gray-600">Add tracks to the queue to start Gig Mode</p>
          <button
            onClick={handleExit}
            className="mt-6 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex h-dvh w-dvw flex-col overflow-hidden bg-gray-950"
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
    >
      {/* ── Backdrop layer ── */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-in-out"
        style={backdropStyle}
      />

      {/* ── Mood color overlay ── */}
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{ backgroundColor: moodColor }}
      />

      {/* ── Content layer ── */}
      <div
        className={`relative flex flex-1 flex-col items-center justify-center px-6 transition-opacity duration-500 ${
          transitioning ? "opacity-30" : "opacity-100"
        }`}
      >
        {/* Glow effect around track title */}
        {showGlow && (
          <div
            className="absolute left-1/2 top-1/2 h-64 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/20 blur-3xl"
            style={{
              animation: `gig-glow-pulse ${beatIntervalS * 4}s ease-in-out infinite`,
            }}
          />
        )}

        {/* Now Playing */}
        <div className="relative z-10 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-violet-400/80">
            Now Playing
          </p>
          <h1
            className="max-w-2xl text-4xl font-bold text-white drop-shadow-lg sm:text-5xl lg:text-6xl"
            style={{
              textShadow: showGlow
                ? "0 0 40px rgba(124,58,237,0.5), 0 0 80px rgba(124,58,237,0.25)"
                : undefined,
            }}
          >
            {currentTrack.title}
          </h1>
          <p className="mt-3 text-xl font-medium text-gray-300 sm:text-2xl">
            {currentTrack.artist}
          </p>

          {/* Metadata badges */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {currentTrack.bpm && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {currentTrack.bpm} BPM
              </span>
            )}
            {currentTrack.musical_key && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                {currentTrack.musical_key}
              </span>
            )}
            {currentTrack.genre && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/30 px-3 py-1 text-xs font-medium text-violet-200 backdrop-blur">
                {currentTrack.genre}
              </span>
            )}
          </div>
        </div>

        {/* Audio Visualizer */}
        {showVisualizer && (
          <div className="absolute bottom-1/4 left-0 right-0 px-8">
            <AudioVisualizer
              isPlaying={isPlaying}
              bpm={currentTrack.bpm}
              className="h-28 opacity-60 sm:h-36"
            />
          </div>
        )}

        {/* Up Next preview */}
        {upcomingTrack && (
          <div className="absolute bottom-28 left-6 max-w-xs rounded-lg bg-white/5 px-4 py-2.5 backdrop-blur border border-white/10">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Up Next</p>
            <p className="truncate text-sm font-medium text-white">{upcomingTrack.title}</p>
            <p className="truncate text-xs text-gray-400">{upcomingTrack.artist}</p>
          </div>
        )}

        {/* QR Code for Tips */}
        <div className="absolute bottom-28 right-6">
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
            <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Tip the DJ → Scan QR
            </p>
            <div className="rounded-lg bg-white p-2">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                  `${window.location.origin}/tip/@${user?.handle || "dj"}`
                )}`}
                width={120}
                height={120}
                alt="Tip QR Code"
                className="block"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Control Bar ── */}
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 transition-all duration-300 ${
          showControls
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <ControlBar
          onExit={handleExit}
          currentBackdropLabel={currentBackdropLabel}
          onCycleBackdrop={handleCycleBackdrop}
          showVisualizer={showVisualizer}
          setShowVisualizer={setShowVisualizer}
          showGlow={showGlow}
          setShowGlow={setShowGlow}
          backdropOpacity={backdropOpacity}
          setBackdropOpacity={setBackdropOpacity}
          onUploadImage={handleUploadImage}
          onCustomUrl={handleCustomUrl}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onNext={handleNext}
        />
      </div>

      {/* ── Keyframes for glow pulse ── */}
      <style>{`
        @keyframes gig-glow-pulse {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
