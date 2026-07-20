import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";

export interface PlayerTrack {
  id?: number;
  title: string;
  artist: string;
  audioSrc?: string;   // URL for real audio, or undefined for demo tones
  bpm?: number | null;
  musical_key?: string | null;
  genre?: string | null;
}

interface PlayerState {
  isOpen: boolean;
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  openPlayer: (track: PlayerTrack) => void;
  closePlayer: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setAudioRef: (ref: HTMLAudioElement | null) => void;
  playDemo: (type: "bass" | "pad" | "lead" | "beat") => void;
  // Queue support
  queue: PlayerTrack[];
  queueIndex: number;
  addToQueue: (tracks: PlayerTrack[]) => void;
  clearQueue: () => void;
  playNext: () => void;
  playPrevious: () => void;
  setQueue: (tracks: PlayerTrack[], startIndex?: number) => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

// Demo tone generator using Web Audio API
function playDemoSound(type: "bass" | "pad" | "lead" | "beat"): {
  audioCtx: AudioContext;
  sourceNodes: OscillatorNode[];
  gainNode: GainNode;
} | null {
  try {
    const audioCtx = new AudioContext();
    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

    const sourceNodes: OscillatorNode[] = [];

    switch (type) {
      case "bass": {
        // Sub-bass sine wave
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(55, audioCtx.currentTime); // A1
        osc.connect(gainNode);
        osc.start();
        sourceNodes.push(osc);

        // Slight pitch glide
        osc.frequency.linearRampToValueAtTime(52, audioCtx.currentTime + 5);
      } break;

      case "lead": {
        // Sawtooth lead with filter sweep
        const osc = audioCtx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        osc.connect(gainNode);
        osc.start();
        sourceNodes.push(osc);

        // Melodic pattern
        [440, 523, 659, 784, 659, 523].forEach((freq, i) => {
          const t = audioCtx.currentTime + i * 0.3;
          osc.frequency.setValueAtTime(freq, t);
        });
      } break;

      case "pad": {
        // Rich pad with detuned square waves
        [220, 277, 330].forEach((freq) => {
          const osc = audioCtx.createOscillator();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          const subGain = audioCtx.createGain();
          subGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
          subGain.connect(gainNode);
          osc.connect(subGain);
          osc.start();
          sourceNodes.push(osc);
        });
      } break;

      case "beat": {
        // Simple beat-like pattern using noise bursts
        const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

        // Kick-like low pulse
        [0, 0.5, 1, 1.5].forEach((offset) => {
          const kick = audioCtx.createOscillator();
          kick.type = "triangle";
          kick.frequency.setValueAtTime(150, audioCtx.currentTime + offset);
          kick.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + offset + 0.15);
          const kickGain = audioCtx.createGain();
          kickGain.gain.setValueAtTime(0.5, audioCtx.currentTime + offset);
          kickGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + offset + 0.2);
          kickGain.connect(gainNode);
          kick.connect(kickGain);
          kick.start(audioCtx.currentTime + offset);
          kick.stop(audioCtx.currentTime + offset + 0.2);
        });

        // Hi-hat-like noise
        [0.25, 0.75, 1.25, 1.75].forEach((offset) => {
          const hihat = audioCtx.createBufferSource();
          hihat.buffer = noiseBuffer;
          const hhGain = audioCtx.createGain();
          hhGain.gain.setValueAtTime(0.15, audioCtx.currentTime + offset);
          hhGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + offset + 0.05);
          hhGain.connect(gainNode);
          hihat.connect(hhGain);
          hihat.start(audioCtx.currentTime + offset);
        });
      } break;
    }

    return { audioCtx, sourceNodes, gainNode };
  } catch (e) {
    console.error("Demo sound failed:", e);
    return null;
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const demoRef = useRef<{ audioCtx: AudioContext; sourceNodes: OscillatorNode[]; gainNode: GainNode } | null>(null);
  const animFrameRef = useRef<number>(0);

  // Queue state
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const onTrackEndRef = useRef<(() => void) | null>(null);

  const stopDemo = useCallback(() => {
    if (demoRef.current) {
      try {
        demoRef.current.sourceNodes.forEach(n => { try { n.stop(); } catch {} });
        demoRef.current.audioCtx.close();
      } catch {}
      demoRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    stopDemo();
  }, [stopDemo]);

  // Auto-advance callback (set externally)
  const setOnTrackEnd = useCallback((cb: (() => void) | null) => {
    onTrackEndRef.current = cb;
  }, []);

  const openPlayer = useCallback((track: PlayerTrack) => {
    stopAudio();
    setIsOpen(true);
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(10); // default demo length
    setIsPlaying(false);
  }, [stopAudio]);

  const closePlayer = useCallback(() => {
    stopAudio();
    setIsOpen(false);
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [stopAudio]);

  const setAudioRef = useCallback((ref: HTMLAudioElement | null) => {
    audioRef.current = ref;
    if (ref) {
      ref.ontimeupdate = () => setCurrentTime(ref.currentTime);
      ref.onloadedmetadata = () => setDuration(ref.duration);
      ref.onended = () => {
        setIsPlaying(false);
        // Auto-advance: call the callback
        if (onTrackEndRef.current) {
          onTrackEndRef.current();
        }
      };
      ref.onplay = () => setIsPlaying(true);
      ref.onpause = () => setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    // If it's a demo track (no audioSrc), manage demo playback
    if (currentTrack && !currentTrack.audioSrc) {
      if (isPlaying) {
        stopDemo();
        setIsPlaying(false);
      } else {
        // Determine demo type from track title hints
        let type: "bass" | "pad" | "lead" | "beat" = "lead";
        const t = currentTrack.title.toLowerCase();
        if (t.includes("bass") || t.includes("dark")) type = "bass";
        else if (t.includes("pad") || t.includes("ambient")) type = "pad";
        else if (t.includes("beat") || t.includes("groove")) type = "beat";

        stopDemo();
        const result = playDemoSound(type);
        if (result) {
          demoRef.current = result;

          // Animate progress
          const startTime = performance.now();
          const anim = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            setCurrentTime(elapsed);
            if (elapsed < 10) {
              animFrameRef.current = requestAnimationFrame(anim);
            } else {
              setIsPlaying(false);
              stopDemo();
            }
          };
          animFrameRef.current = requestAnimationFrame(anim);
          setIsPlaying(true);
        }
      }
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [currentTrack, isPlaying, stopDemo]);

  const seek = useCallback((time: number) => {
    if (currentTrack && !currentTrack.audioSrc) {
      // Can't seek demo sounds meaningfully, but update display
      setCurrentTime(Math.min(time, 10));
      return;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, [currentTrack]);

  const playDemo = useCallback((type: "bass" | "pad" | "lead" | "beat") => {
    stopAudio();
    setIsOpen(true);
    setCurrentTrack({
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Demo`,
      artist: "CataLog",
    });
    setCurrentTime(0);
    setDuration(10);
    setIsPlaying(false);

    // Auto-play the demo
    setTimeout(() => {
      const result = playDemoSound(type);
      if (result) {
        demoRef.current = result;
        const startTime = performance.now();
        const anim = () => {
          const elapsed = (performance.now() - startTime) / 1000;
          setCurrentTime(elapsed);
          if (elapsed < 10) {
            animFrameRef.current = requestAnimationFrame(anim);
          } else {
            setIsPlaying(false);
            stopDemo();
          }
        };
        animFrameRef.current = requestAnimationFrame(anim);
        setIsPlaying(true);
      }
    }, 50);
  }, [stopAudio, stopDemo]);

  // ─── Queue management ───

  const setQueueFn = useCallback((tracks: PlayerTrack[], startIndex?: number) => {
    setQueue(tracks);
    const idx = startIndex ?? (tracks.length > 0 ? 0 : -1);
    setQueueIndex(idx);
    if (tracks.length > 0 && idx >= 0 && idx < tracks.length) {
      openPlayer(tracks[idx]);
    }
  }, [openPlayer]);

  const addToQueue = useCallback((tracks: PlayerTrack[]) => {
    setQueue(prev => [...prev, ...tracks]);
    // If no track is playing, start the first
    if (queueIndex < 0 && tracks.length > 0) {
      setQueueIndex(0);
      openPlayer(tracks[0]);
    }
  }, [queueIndex, openPlayer]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(-1);
    closePlayer();
  }, [closePlayer]);

  const playNext = useCallback(() => {
    if (queue.length === 0 || queueIndex >= queue.length - 1) return;
    const nextIdx = queueIndex + 1;
    setQueueIndex(nextIdx);
    openPlayer(queue[nextIdx]);
  }, [queue, queueIndex, openPlayer]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0 || queueIndex <= 0) return;
    const prevIdx = queueIndex - 1;
    setQueueIndex(prevIdx);
    openPlayer(queue[prevIdx]);
  }, [queue, queueIndex, openPlayer]);

  return (
    <PlayerContext.Provider
      value={{
        isOpen, currentTrack, isPlaying, currentTime, duration,
        openPlayer, closePlayer, togglePlay, seek, setAudioRef, playDemo,
        queue, queueIndex,
        addToQueue, clearQueue, playNext, playPrevious,
        setQueue: setQueueFn,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
