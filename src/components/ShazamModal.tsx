import { useState, useEffect, useRef, useCallback } from "react";
import { startCapture, type CaptureState } from "../lib/audio-capture";
import { api, type IdentifyResult } from "../lib/api";

type ModalState = "idle" | "listening" | "processing" | "identified" | "not-found" | "error" | "denied" | "added";

interface ShazamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShazamModal({ isOpen, onClose }: ShazamModalProps) {
  const [state, setState] = useState<ModalState>("idle");
  const [captureMsg, setCaptureMsg] = useState("");
  const [result, setResult] = useState<IdentifyResult["track"] | null>(null);
  const [identId, setIdentId] = useState<number | null>(null);
  const [recents, setRecents] = useState<IdentifyResult["recent_identifications"]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const stopFn = useRef<(() => Promise<Blob | null>) | null>(null);
  const abortFn = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortFn.current) abortFn.current();
    stopFn.current = null;
    abortFn.current = null;
    setState("idle");
    setCaptureMsg("");
    setResult(null);
    setIdentId(null);
    setErrorMsg("");
  }, []);

  // Start listening when modal opens
  useEffect(() => {
    if (!isOpen) {
      reset();
      return;
    }

    reset();
    setState("listening");

    const capture = startCapture((s: CaptureState) => {
      setCaptureMsg(s.message);
      if (s.status === "denied") setState("denied");
      if (s.status === "error") {
        setErrorMsg(s.message);
        setState("error");
      }
    });

    stopFn.current = capture.stop;
    abortFn.current = capture.abort;

    // Auto-stop after 12 seconds
    timerRef.current = setTimeout(() => {
      stopAndIdentify();
    }, 12000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortFn.current) abortFn.current();
    };
  }, [isOpen]);

  const stopAndIdentify = async () => {
    if (!stopFn.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState("processing");
    setCaptureMsg("Identifying track...");

    const blob = await stopFn.current();
    stopFn.current = null;

    if (!blob) {
      setState("error");
      setErrorMsg("No audio captured. Please try again.");
      return;
    }

    try {
      const data = await api.identifyTrack(blob);
      if (data.identified) {
        setResult(data.track);
        setIdentId(data.identification_id);
        setRecents(data.recent_identifications || []);
        setState("identified");
      } else {
        setState("not-found");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Recognition failed";
      if (msg.includes("Could not identify")) {
        setState("not-found");
      } else {
        setState("error");
        setErrorMsg(msg);
      }
    }
  };

  const handleStopClick = () => {
    stopAndIdentify();
  };

  const handleAddToLibrary = async () => {
    if (!result) return;
    try {
      await api.addIdentifiedToLibrary({
        title: result.title,
        artist: result.artist,
        album: result.album,
        year: result.year,
        genre: result.genre,
        confidence: result.confidence,
        bpm: result.bpm,
        musical_key: result.musical_key,
        duration_ms: result.duration_ms,
        ident_id: identId ?? undefined,
      });
      setState("added");
      // Close after brief delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add to library");
      setState("error");
    }
  };

  const handleTryAgain = () => {
    reset();
    setState("listening");
    const capture = startCapture((s: CaptureState) => {
      setCaptureMsg(s.message);
      if (s.status === "denied") setState("denied");
      if (s.status === "error") {
        setErrorMsg(s.message);
        setState("error");
      }
    });
    stopFn.current = capture.stop;
    abortFn.current = capture.abort;
    timerRef.current = setTimeout(() => {
      stopAndIdentify();
    }, 12000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={state === "idle" || state === "denied" || state === "error" || state === "not-found" || state === "identified" || state === "added" ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl bg-gray-900/95 border border-gray-800 shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 rounded-full p-2 text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="px-6 py-10 flex flex-col items-center text-center">
          {/* State: Idle / Listening / Processing */}
          {(state === "idle" || state === "listening" || state === "processing") && (
            <>
              {/* Pulsing mic icon */}
              <div className="relative mb-8">
                <div
                  className={`absolute inset-0 rounded-full bg-violet-500/30 ${
                    state === "listening" ? "animate-ping" : ""
                  }`}
                  style={{ width: 96, height: 96, margin: "auto" }}
                />
                <div
                  className={`relative flex h-24 w-24 items-center justify-center rounded-full ${
                    state === "listening"
                      ? "bg-violet-600 animate-pulse"
                      : state === "processing"
                        ? "bg-violet-700"
                        : "bg-gray-800"
                  }`}
                >
                  <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </div>
              </div>

              {/* Waveform bars animation */}
              {state === "listening" && (
                <div className="flex items-end gap-1 h-10 mb-4">
                  {[0.5, 0.8, 0.3, 1.0, 0.6, 0.9, 0.4, 0.7].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-full bg-violet-500"
                      style={{
                        height: `${h * 40}px`,
                        animation: `waveform-bar ${0.5 + h * 0.4}s ease-in-out ${i * 0.1}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              )}

              <p className="text-lg font-semibold text-gray-100 mb-1">
                {state === "idle" ? "Ready" : state === "listening" ? "Listening..." : "Processing..."}
              </p>
              <p className="text-sm text-gray-400">{captureMsg || "Hold your phone near the music"}</p>

              {state === "listening" && (
                <button
                  onClick={handleStopClick}
                  className="mt-6 btn-primary bg-violet-600 hover:bg-violet-500"
                >
                  Identify Now
                </button>
              )}

              {state === "processing" && (
                <div className="mt-6 h-1 w-48 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full animate-pulse"
                    style={{ width: "60%" }}
                  />
                </div>
              )}
            </>
          )}

          {/* State: Identified */}
          {state === "identified" && result && (
            <>
              {/* Album art placeholder */}
              <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-900/30">
                <svg className="h-14 w-14 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-white mb-1">{result.title}</h2>
              <p className="text-base text-gray-300 mb-1">{result.artist}</p>
              {result.album && <p className="text-sm text-gray-500 mb-1">{result.album}{result.year ? ` • ${result.year}` : ""}</p>}
              <div className="flex flex-wrap justify-center gap-2 mt-2 mb-4">
                {result.genre && (
                  <span className="rounded-full bg-violet-900/40 border border-violet-700/30 px-2.5 py-0.5 text-xs text-violet-300">
                    {result.genre}
                  </span>
                )}
                {result.bpm && (
                  <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400">
                    {result.bpm} BPM
                  </span>
                )}
                {result.musical_key && (
                  <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400">
                    Key: {result.musical_key}
                  </span>
                )}
                <span className="rounded-full bg-emerald-900/40 border border-emerald-700/30 px-2.5 py-0.5 text-xs text-emerald-400">
                  {result.confidence}% match
                </span>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={handleAddToLibrary}
                  className="btn-primary whitespace-nowrap"
                >
                  Add to Library
                </button>
                {result.spotify_url && (
                  <a
                    href={result.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary whitespace-nowrap"
                  >
                    Spotify
                  </a>
                )}
                {result.apple_music_url && (
                  <a
                    href={result.apple_music_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary whitespace-nowrap"
                  >
                    Apple Music
                  </a>
                )}
                {result.youtube_url && (
                  <a
                    href={result.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary whitespace-nowrap"
                  >
                    YouTube
                  </a>
                )}
              </div>

              <button
                onClick={handleTryAgain}
                className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Identify another track
              </button>
            </>
          )}

          {/* State: Added confirmation */}
          {state === "added" && (
            <>
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-900/30">
                <svg className="h-10 w-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Added to Library!</h2>
              <p className="text-sm text-gray-400">🔍 Identified — track metadata saved</p>
            </>
          )}

          {/* State: Not Found */}
          {state === "not-found" && (
            <>
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-900/30">
                <svg className="h-10 w-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No Match Found</h2>
              <p className="text-sm text-gray-400 mb-6">
                We couldn't identify this track. Try moving closer to the speaker or capturing a clearer section.
              </p>
              <button onClick={handleTryAgain} className="btn-primary">
                Try Again
              </button>
            </>
          )}

          {/* State: Denied */}
          {state === "denied" && (
            <>
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-900/30">
                <svg className="h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Microphone Access Needed</h2>
              <p className="text-sm text-gray-400 mb-6">
                Please allow microphone access in your browser settings to use the identify feature.
              </p>
            </>
          )}

          {/* State: Error */}
          {state === "error" && (
            <>
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-900/30">
                <svg className="h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Something Went Wrong</h2>
              <p className="text-sm text-gray-400 mb-6">{errorMsg || "An unexpected error occurred."}</p>
              <button onClick={handleTryAgain} className="btn-primary">
                Try Again
              </button>
            </>
          )}
        </div>

        {/* Recent identifications panel */}
        {recents.length > 0 && (state === "identified" || state === "not-found") && (
          <div className="border-t border-gray-800 px-6 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Recent Identifications
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {recents.map((r) => (
                <div key={r.id} className="flex items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gray-800">
                    <svg className="h-4 w-4 text-violet-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-gray-200 font-medium">{r.title}</p>
                    <p className="truncate text-gray-500 text-xs">{r.artist}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {r.added_to_library ? (
                      <span className="text-xs text-emerald-400">✓ Added</span>
                    ) : (
                      <span className="text-xs text-gray-600">{Math.round(r.confidence)}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Waveform animation keyframes */}
      <style>{`
        @keyframes waveform-bar {
          0% { height: 4px; }
          100% { height: var(--h, 40px); }
        }
      `}</style>
    </div>
  );
}
