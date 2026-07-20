import { useRef, useEffect, useCallback, useState } from "react";
import { usePlayer } from "../contexts/PlayerContext";
import LightSyncPanel from "./LightSyncPanel";
import VoiceIndicator from "./VoiceIndicator";

// Simple waveform visualizer using Canvas
function Waveform({ isPlaying }: { isPlaying: boolean }) {
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

    const barCount = 40;
    const barWidth = rect.width / barCount;
    const midY = rect.height / 2;

    let phase = 0;

    const draw = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      const barHeight = rect.height * 0.05;
      for (let i = 0; i < barCount; i++) {
        let amplitude: number;
        if (isPlaying) {
          // Animated waveform
          const t = phase + i * 0.3;
          amplitude = Math.abs(Math.sin(t * 2.5) * 0.7 + Math.sin(t * 5.3) * 0.3);
          // Randomize slightly for movement
          amplitude = (amplitude + Math.sin(phase * 3.7 + i) * 0.2) / 1.2;
        } else {
          // Static waveform
          amplitude = Math.abs(Math.sin(i * 0.5) * 0.3 + Math.sin(i * 0.8) * 0.15);
        }

        const h = Math.max(barHeight, amplitude * (rect.height * 0.45));
        const x = i * barWidth + 1;
        const y = midY - h / 2;

        // Gradient color
        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, "#a78bfa");
        gradient.addColorStop(1, "#7c3aed");
        ctx.fillStyle = gradient;

        // Rounded bars
        ctx.beginPath();
        const radius = Math.min(barWidth / 2 - 1, 2);
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius - 2, y);
        ctx.quadraticCurveTo(x + barWidth - 2, y, x + barWidth - 2, y + radius);
        ctx.lineTo(x + barWidth - 2, y + h - radius);
        ctx.quadraticCurveTo(x + barWidth - 2, y + h, x + barWidth - radius - 2, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();
      }

      if (isPlaying) {
        phase += 0.15;
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
      className="h-full w-full"
    />
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Player() {
  const {
    isOpen, currentTrack, isPlaying, currentTime, duration,
    closePlayer, togglePlay, seek,
  } = usePlayer();

  const progressRef = useRef<HTMLDivElement>(null);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || duration <= 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seek(ratio * duration);
    },
    [duration, seek]
  );

  if (!isOpen || !currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-gray-950/95 backdrop-blur-md">
      {/* Progress bar */}
      <div
        ref={progressRef}
        className="group h-1 w-full cursor-pointer bg-gray-800"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-violet-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{currentTrack.title}</p>
          <p className="truncate text-xs text-gray-400">{currentTrack.artist}</p>
        </div>

        {/* Waveform */}
        <div className="hidden h-10 w-48 flex-shrink-0 sm:block">
          <Waveform isPlaying={isPlaying} />
        </div>

        {/* Time display */}
        <span className="hidden text-xs tabular-nums text-gray-400 sm:inline">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Voice commands toggle */}
          <VoiceIndicator variant="icon" className="p-1" />

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500"
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

          {/* Close */}
          <button
            onClick={closePlayer}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
            aria-label="Close player"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Light Sync Panel */}
      <LightSyncPanel
        trackId={currentTrack.id}
        currentBpm={currentTrack.bpm}
        currentMood={currentTrack.genre}
        currentEnergy={5}
      />
    </div>
  );
}
