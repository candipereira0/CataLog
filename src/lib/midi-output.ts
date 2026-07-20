// Web MIDI API Wrapper — MIDI Clock Output for light sync
// Uses navigator.requestMIDIAccess() (Chromium-based browsers).
// Handles permissions gracefully and falls back to a simulated mode.

import { moodToMidiNote } from "../../server/light-sync";

// ─── Types ───

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}

export interface MidiStatus {
  available: boolean;
  connected: boolean;
  outputs: MidiDevice[];
  selectedOutputId: string | null;
  clockRunning: boolean;
  currentBpm: number;
  mock: boolean;
}

// ─── State ───

let midiAccess: MIDIAccess | null = null;
let midiOutput: MIDIOutput | null = null;
let selectedOutputId: string | null = null;
let clockInterval: ReturnType<typeof setInterval> | null = null;
let clockPulseCount = 0;
let currentBpm = 120;
let isClockRunning = false;
let isMockMode = false;

// MIDI message helpers
const MIDI_CLOCK = 0xF8;
const MIDI_START = 0xFA;
const MIDI_CONTINUE = 0xFB;
const MIDI_STOP = 0xFC;
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CC = 0xB0;

// ─── Listeners ───

type StatusListener = (status: MidiStatus) => void;
const statusListeners: Set<StatusListener> = new Set();

function notifyListeners(): void {
  const status = getStatus();
  for (const listener of statusListeners) {
    try { listener(status); } catch {}
  }
}

export function onMidiStatusChange(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}

// ─── Init ───

export async function initializeMidi(): Promise<MidiStatus> {
  try {
    if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) {
      console.log("[MIDI] Web MIDI API not available — using mock mode");
      isMockMode = true;
      notifyListeners();
      return getStatus();
    }

    midiAccess = await navigator.requestMIDIAccess();

    // Listen for device changes
    midiAccess.onstatechange = () => {
      notifyListeners();
    };

    console.log("[MIDI] Access granted, outputs:", midiAccess.outputs.size);
    notifyListeners();
    return getStatus();
  } catch (err) {
    console.warn("[MIDI] Access denied or error:", err);
    isMockMode = true;
    notifyListeners();
    return getStatus();
  }
}

// ─── Get Outputs ───

export function getOutputs(): MidiDevice[] {
  if (!midiAccess) return [];
  const devices: MidiDevice[] = [];
  for (const output of midiAccess.outputs.values()) {
    devices.push({
      id: output.id,
      name: output.name ?? "Unknown",
      manufacturer: output.manufacturer ?? "",
    });
  }
  return devices;
}

// ─── Connect to Output ───

export function connectOutput(outputId: string): boolean {
  if (isMockMode) {
    selectedOutputId = outputId;
    console.log(`[MIDI Mock] Connected to output: ${outputId}`);
    notifyListeners();
    return true;
  }

  if (!midiAccess) return false;

  const output = midiAccess.outputs.get(outputId);
  if (!output) {
    console.warn(`[MIDI] Output not found: ${outputId}`);
    return false;
  }

  midiOutput = output;
  selectedOutputId = outputId;
  console.log(`[MIDI] Connected to: ${output.name}`);
  notifyListeners();
  return true;
}

// ─── Disconnect ───

export function disconnectOutput(): void {
  stopClock();
  midiOutput = null;
  selectedOutputId = null;
  notifyListeners();
}

// ─── Send MIDI Message ───

function sendMidi(data: number[]): void {
  if (isMockMode) {
    // In mock, just log
    return;
  }
  if (!midiOutput) return;
  try {
    midiOutput.send(new Uint8Array(data));
  } catch (err) {
    console.warn("[MIDI] Send error:", err);
  }
}

// ─── Clock ───

export function startClock(bpm?: number): void {
  if (bpm != null) currentBpm = bpm;
  stopClock();

  isClockRunning = true;

  // Send MIDI Start
  sendMidi([MIDI_START]);
  clockPulseCount = 0;

  if (isMockMode) {
    console.log(`[MIDI Mock] Clock started at ${currentBpm} BPM`);
    notifyListeners();
    return;
  }

  // 24 pulses per quarter note
  const intervalMs = (60 / currentBpm / 24) * 1000;

  clockInterval = setInterval(() => {
    sendMidi([MIDI_CLOCK]);
    clockPulseCount++;
  }, intervalMs);

  notifyListeners();
}

export function stopClock(): void {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  sendMidi([MIDI_STOP]);
  isClockRunning = false;
  clockPulseCount = 0;

  if (isMockMode) {
    console.log("[MIDI Mock] Clock stopped");
  }

  notifyListeners();
}

export function setBpm(bpm: number): void {
  currentBpm = bpm;
  if (isClockRunning) {
    // Restart clock at new BPM
    startClock(bpm);
  }
  notifyListeners();
}

// ─── Light Scene Triggers ───

export function triggerMoodScene(mood: string, velocity = 100): void {
  const note = moodToMidiNote(mood);
  // Note On
  sendMidi([NOTE_ON, note, Math.min(127, velocity)]);
  // Hold briefly, then note off
  setTimeout(() => {
    sendMidi([NOTE_OFF, note, 0]);
  }, 100);
}

export function triggerStrobe(rate: number): void {
  // Use CC 20 for strobe rate (0-127 mapping)
  const ccValue = Math.min(127, Math.round(rate * 12.7)); // 0-10 Hz → 0-127
  sendMidi([CC, 20, ccValue]);
}

export function setIntensity(value: number): void {
  // CC 21 for intensity (0-127)
  sendMidi([CC, 21, Math.min(127, Math.round(value * 127))]);
}

export function setColorPalette(r: number, g: number, b: number): void {
  // CC 22-24 for RGB
  sendMidi([CC, 22, Math.round(r)]);
  sendMidi([CC, 23, Math.round(g)]);
  sendMidi([CC, 24, Math.round(b)]);
}

// ─── Status ───

export function getStatus(): MidiStatus {
  return {
    available: midiAccess !== null && !isMockMode,
    connected: midiOutput !== null || (isMockMode && selectedOutputId !== null),
    outputs: getOutputs(),
    selectedOutputId,
    clockRunning: isClockRunning,
    currentBpm,
    mock: isMockMode,
  };
}

// ─── Test / Demo ───

export function testLights(): void {
  if (isMockMode) {
    console.log("[MIDI Mock] Testing lights — cycling through moods");
    const moods = ["dark", "uplifting", "hypnotic", "energetic", "chill"];
    moods.forEach((mood, i) => {
      setTimeout(() => {
        console.log(`[MIDI Mock] Scene: ${mood} → note ${moodToMidiNote(mood)}`);
        triggerMoodScene(mood);
      }, i * 500);
    });
    return;
  }

  // Quick test: cycle through moods
  const moods = ["dark", "uplifting", "hypnotic", "energetic", "chill"];
  moods.forEach((mood, i) => {
    setTimeout(() => triggerMoodScene(mood), i * 500);
  });

  // Start clock briefly
  startClock(128);
  setTimeout(() => stopClock(), 3000);
}
