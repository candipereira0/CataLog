import { useState, useEffect, useCallback, useRef } from "react";
import type { LightParams, StrobePattern } from "../../server/light-sync";
import {
  initializeMidi, connectOutput, disconnectOutput,
  startClock, stopClock, setBpm, triggerMoodScene, testLights as midiTestLights,
  getStatus as getMidiStatus, onMidiStatusChange,
  type MidiDevice, type MidiStatus,
} from "../lib/midi-output";
import { api } from "../lib/api";

// ─── Types ───

type LightConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface LightState {
  midi: LightConnectionStatus;
  hue: LightConnectionStatus;
  osc: LightConnectionStatus;
  enabled: boolean;
}

// ─── Color Palette Swatch ───

function ColorSwatches({ palette, intensity }: { palette: string[]; intensity: number }) {
  return (
    <div className="flex items-center gap-1">
      {palette.map((color, i) => (
        <div
          key={i}
          className="h-5 w-5 rounded-full border border-white/10 shadow-inner transition-all duration-500"
          style={{
            backgroundColor: color,
            opacity: i === 0 ? intensity : Math.max(0.3, intensity - i * 0.15),
            transform: `scale(${1 - i * 0.05})`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Intensity Bar ───

function IntensityBar({ intensity, children }: { intensity: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 via-orange-500 to-yellow-400 transition-all duration-300"
          style={{ width: `${intensity * 100}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-400">
        {Math.round(intensity * 100)}%
      </span>
      {children}
    </div>
  );
}

// ─── Strobe Pattern Indicator ───

function StrobePatternDisplay({ pattern, bpm }: { pattern: StrobePattern; bpm: number }) {
  const [beatPhase, setBeatPhase] = useState(0);

  useEffect(() => {
    if (bpm <= 0) return;
    const beatInterval = (60 / bpm) * 1000;
    const interval = setInterval(() => {
      setBeatPhase(p => (p + 1) % 4);
    }, beatInterval / 4); // 16th note resolution
    return () => clearInterval(interval);
  }, [bpm]);

  const barDivisions = 16;
  const strobePositions = pattern.intervals.map(i => Math.round(i * barDivisions) % barDivisions);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">Strobe: {pattern.type}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: barDivisions }, (_, i) => {
          const isStrobe = strobePositions.includes(i);
          const isBeat = i % 4 === 0;
          const isCurrent = i === (beatPhase % barDivisions);
          return (
            <div
              key={i}
              className={`h-3 flex-1 rounded-sm transition-colors duration-75 ${
                isStrobe && isCurrent
                  ? "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.6)]"
                  : isStrobe
                  ? "bg-orange-500"
                  : isBeat
                  ? "bg-gray-600"
                  : "bg-gray-800"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Panel ───

interface LightSyncPanelProps {
  trackId?: number;
  currentBpm?: number | null;
  currentMood?: string | null;
  currentEnergy?: number | null;
}

export default function LightSyncPanel({
  trackId,
  currentBpm,
  currentMood,
  currentEnergy,
}: LightSyncPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [midiStatus, setMidiStatus] = useState<MidiStatus>({
    available: false, connected: false, outputs: [], selectedOutputId: null,
    clockRunning: false, currentBpm: 120, mock: true,
  });
  const [hueStatus, setHueStatus] = useState<LightConnectionStatus>("disconnected");
  const [oscStatus, setOscStatus] = useState<LightConnectionStatus>("disconnected");
  const [lightParams, setLightParams] = useState<LightParams | null>(null);
  const [loading, setLoading] = useState(false);
  const [testRunning, setTestRunning] = useState<Record<string, boolean>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const statusListenerCleanup = useRef<(() => void) | null>(null);

  // ─── Initialize MIDI ───

  useEffect(() => {
    initializeMidi().then(status => setMidiStatus(status));
    statusListenerCleanup.current = onMidiStatusChange(setMidiStatus);

    return () => {
      statusListenerCleanup.current?.();
      stopClock();
      disconnectOutput();
      wsRef.current?.close();
    };
  }, []);

  // ─── Load Light Params ───

  const loadLightParams = useCallback(async () => {
    if (!trackId) return;
    setLoading(true);
    try {
      const data = await api.getLightParams(trackId);
      setLightParams(data.params);
    } catch (err) {
      console.warn("Failed to load light params:", err);
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    if (enabled && trackId) {
      loadLightParams();
    }
  }, [enabled, trackId, loadLightParams]);

  // ─── Compute local params when no trackId ───

  useEffect(() => {
    if (!trackId && enabled && currentBpm) {
      // Placeholder params
      setLightParams({
        bpm: currentBpm ?? 120,
        energy: currentEnergy ?? 5,
        mood: currentMood ?? "energetic",
        key: "C",
        beatPattern: "four-on-the-floor",
        colorPalette: ["#ff0040", "#ff6600", "#ffcc00", "#00ff88", "#0066ff"],
        strobePattern: { type: "four-on-the-floor", intervals: [0, 0.25, 0.5, 0.75] },
        intensity: (currentEnergy ?? 5) / 10,
      });
    }
  }, [trackId, enabled, currentBpm, currentMood, currentEnergy]);

  // ─── Local BPM tracking ───

  useEffect(() => {
    if (lightParams && enabled && midiStatus.clockRunning) {
      setBpm(lightParams.bpm);
    }
  }, [lightParams?.bpm, enabled, midiStatus.clockRunning]);

  // ─── Sync to Hue ───

  const syncHue = useCallback(async (mood: string, energy: number) => {
    try {
      const result = await api.syncHue(mood, energy);
      if (result.success) {
        setHueStatus("connected");
      }
    } catch {
      setHueStatus("error");
    }
  }, []);

  // ─── Connect Hue ───

  const connectHue = useCallback(async () => {
    setHueStatus("connecting");
    try {
      const result = await api.connectHue();
      setHueStatus(result.connected ? "connected" : "error");
    } catch {
      setHueStatus("error");
    }
  }, []);

  // ─── OSC WebSocket ───

  const connectOsc = useCallback(() => {
    setOscStatus("connecting");
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/osc`);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setOscStatus("connected");
        wsRef.current = ws;
      };

      ws.onclose = () => {
        setOscStatus("disconnected");
        wsRef.current = null;
      };

      ws.onerror = () => {
        setOscStatus("error");
        wsRef.current = null;
      };

      ws.onmessage = (event) => {
        // OSC binary messages — could parse and display, but for now just confirm receipt
      };
    } catch {
      setOscStatus("error");
    }
  }, []);

  const disconnectOsc = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setOscStatus("disconnected");
  }, []);

  // ─── MIDI Output Selection ───

  const handleMidiOutputChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const outputId = e.target.value;
    if (!outputId) {
      disconnectOutput();
      return;
    }
    connectOutput(outputId);
  }, []);

  // ─── Toggle Clock ───

  const toggleClock = useCallback(() => {
    if (midiStatus.clockRunning) {
      stopClock();
    } else {
      startClock(lightParams?.bpm ?? currentBpm ?? 120);
    }
  }, [midiStatus.clockRunning, lightParams, currentBpm]);

  // ─── Send Scene via MIDI ───

  const sendMidiScene = useCallback(() => {
    if (lightParams) {
      triggerMoodScene(lightParams.mood);
    }
  }, [lightParams]);

  // ─── Test Functions ───

  const runTest = useCallback(async (type: string) => {
    setTestRunning(prev => ({ ...prev, [type]: true }));

    switch (type) {
      case "midi":
        midiTestLights();
        break;
      case "hue":
        try {
          const mood = lightParams?.mood ?? "energetic";
          const energy = lightParams?.energy ?? 5;
          await syncHue(mood, energy);
        } catch {}
        break;
      case "osc":
        // Send via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && lightParams) {
          // Simple JSON OSC-like message
          wsRef.current.send(JSON.stringify({
            type: "osc",
            address: "/light/color",
            args: lightParams.colorPalette.slice(0, 3),
          }));
          wsRef.current.send(JSON.stringify({
            type: "osc",
            address: "/light/bpm",
            args: [lightParams.bpm],
          }));
        }
        break;
    }

    setTimeout(() => {
      setTestRunning(prev => ({ ...prev, [type]: false }));
    }, 2000);
  }, [lightParams, syncHue]);

  // ─── Simulated color animation ───

  const [simBeat, setSimBeat] = useState(0);
  useEffect(() => {
    if (!enabled || !lightParams) return;
    const interval = setInterval(() => {
      setSimBeat(p => (p + 1) % 4);
    }, (60 / (lightParams.bpm || 120)) * 1000 / 4);
    return () => clearInterval(interval);
  }, [enabled, lightParams]);

  // ─── Render ───

  if (!expanded) {
    return (
      <div className="flex items-center gap-3 border-t border-gray-800 px-4 py-2">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 text-xs text-gray-400 transition-colors hover:text-violet-400"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Light Sync
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-800 bg-gray-950/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className="text-sm font-medium text-white">Light Sync</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Enable Toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-[11px] text-gray-400">
              {enabled ? "On" : "Off"}
            </span>
            <button
              onClick={() => setEnabled(e => !e)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                enabled ? "bg-violet-600" : "bg-gray-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  enabled ? "left-4" : "left-0.5"
                }`}
              />
            </button>
          </label>

          <button
            onClick={() => setExpanded(false)}
            className="text-gray-500 hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {enabled && (
        <div className="space-y-3 px-4 pb-4">
          {/* Current Light Parameters */}
          {lightParams && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-gray-500">Now Syncing</span>
                <span className="text-xs tabular-nums text-gray-400">{lightParams.bpm} BPM</span>
              </div>

              <div className="mb-3">
                <ColorSwatches palette={lightParams.colorPalette} intensity={lightParams.intensity} />
              </div>

              <div className="mb-3">
                <IntensityBar intensity={lightParams.intensity}>
                  <span className="ml-1 text-[10px] text-gray-500">
                    {lightParams.mood} / E{lightParams.energy}
                  </span>
                </IntensityBar>
              </div>

              <StrobePatternDisplay pattern={lightParams.strobePattern} bpm={lightParams.bpm} />

              {/* Simulated light pulse */}
              <div className="mt-2 flex justify-center">
                <div
                  className="h-2 w-2 rounded-full transition-all duration-75"
                  style={{
                    backgroundColor: lightParams.colorPalette[simBeat % lightParams.colorPalette.length],
                    opacity: simBeat % 4 === 0 ? 1 : 0.3,
                    transform: `scale(${simBeat % 4 === 0 ? 1.8 : 1})`,
                    boxShadow: simBeat % 4 === 0
                      ? `0 0 10px ${lightParams.colorPalette[simBeat % lightParams.colorPalette.length]}`
                      : "none",
                  }}
                />
              </div>
            </div>
          )}

          {/* MIDI Section */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${
                  midiStatus.connected ? "bg-green-500" : midiStatus.available ? "bg-yellow-500" : "bg-gray-600"
                }`} />
                <span className="text-xs font-medium text-gray-300">MIDI Clock</span>
                {midiStatus.mock && (
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[9px] text-gray-500">Simulated</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => runTest("midi")}
                  disabled={testRunning.midi}
                  className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400 transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                  {testRunning.midi ? "Testing..." : "Test"}
                </button>
              </div>
            </div>

            {midiStatus.outputs.length > 0 && (
              <div className="mt-2">
                <select
                  onChange={handleMidiOutputChange}
                  value={midiStatus.selectedOutputId ?? ""}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
                >
                  <option value="">Select MIDI Output...</option>
                  {midiStatus.outputs.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {midiStatus.connected && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={toggleClock}
                  className={`rounded px-3 py-1 text-[10px] font-medium transition-colors ${
                    midiStatus.clockRunning
                      ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                      : "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                  }`}
                >
                  {midiStatus.clockRunning ? "Stop Clock" : "Start Clock"}
                </button>
                <button
                  onClick={sendMidiScene}
                  className="rounded bg-violet-600/20 px-3 py-1 text-[10px] text-violet-400 hover:bg-violet-600/30"
                >
                  Send Scene
                </button>
                <span className="text-[9px] tabular-nums text-gray-500">
                  {midiStatus.currentBpm} BPM
                </span>
              </div>
            )}
          </div>

          {/* Philips Hue Section */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${
                  hueStatus === "connected" ? "bg-green-500"
                  : hueStatus === "connecting" ? "bg-yellow-500 animate-pulse"
                  : hueStatus === "error" ? "bg-red-500"
                  : "bg-gray-600"
                }`} />
                <span className="text-xs font-medium text-gray-300">Philips Hue</span>
              </div>

              <div className="flex items-center gap-2">
                {hueStatus !== "connected" && (
                  <button
                    onClick={connectHue}
                    disabled={hueStatus === "connecting"}
                    className="rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-400 transition-colors hover:bg-blue-600/30 disabled:opacity-50"
                  >
                    {hueStatus === "connecting" ? "Connecting..." : "Connect"}
                  </button>
                )}
                <button
                  onClick={() => runTest("hue")}
                  disabled={testRunning.hue}
                  className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400 transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                  {testRunning.hue ? "Testing..." : "Test"}
                </button>
              </div>
            </div>

            <p className="mt-1 text-[10px] text-gray-500">
              {hueStatus === "connected"
                ? "Connected — syncing colors & brightness"
                : hueStatus === "error"
                ? "Connection failed — check bridge"
                : "Connect to your Hue bridge for room lighting sync"}
            </p>
          </div>

          {/* OSC Section */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${
                  oscStatus === "connected" ? "bg-green-500"
                  : oscStatus === "connecting" ? "bg-yellow-500 animate-pulse"
                  : oscStatus === "error" ? "bg-red-500"
                  : "bg-gray-600"
                }`} />
                <span className="text-xs font-medium text-gray-300">OSC (QLC+/Resolume)</span>
              </div>

              <div className="flex items-center gap-2">
                {oscStatus === "connected" ? (
                  <button
                    onClick={disconnectOsc}
                    className="rounded bg-red-600/20 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-600/30"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={connectOsc}
                    disabled={oscStatus === "connecting"}
                    className="rounded bg-green-600/20 px-2 py-0.5 text-[10px] text-green-400 hover:bg-green-600/30 disabled:opacity-50"
                  >
                    {oscStatus === "connecting" ? "Connecting..." : "Connect"}
                  </button>
                )}
                <button
                  onClick={() => runTest("osc")}
                  disabled={testRunning.osc || oscStatus !== "connected"}
                  className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400 transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                  {testRunning.osc ? "Testing..." : "Test"}
                </button>
              </div>
            </div>

            <p className="mt-1 text-[10px] text-gray-500">
              {oscStatus === "connected"
                ? `WebSocket streaming to /ws/osc`
                : oscStatus === "error"
                ? "WebSocket connection failed"
                : "Connect via WebSocket to send OSC commands to lighting software"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
