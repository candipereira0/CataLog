// Lightweight audio analysis for BPM and key detection.
// Uses onset detection (energy-based) for BPM and a simple chroma estimator for key.
// Reads audio files in small chunks to stay memory-light.
// Deep analysis: vocal detection, instrument estimation, beat pattern, subgenre classification.

import { parseFile } from "music-metadata";
import { classifySubgenres, type AnalysisInput, type InstrumentProfile, type SubgenreSuggestion, type BeatPattern, BEAT_PATTERNS } from "./subgenre-engine";
import { estimateEnergy } from "./camelot";

export interface AnalysisResult {
  bpm: number | null;
  musical_key: string | null;
  duration_ms: number | null;
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
}

export interface DeepAnalysisResult {
  bpm: number | null;
  key: string | null;
  energy: number;
  vocalPresence: boolean;
  vocalGender: string | null;      // "male" | "female" | null
  instruments: InstrumentProfile;
  beatPattern: string | null;
  subgenreSuggestions: SubgenreSuggestion[];
  analyzedAt: string;
}

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Detect BPM using energy-based onset detection on raw PCM data
function detectBPM(samples: Float32Array, sampleRate: number): number | null {
  if (samples.length < sampleRate) return null;

  const hopSize = Math.floor(sampleRate * 0.01); // 10ms hops
  const frameSize = Math.floor(sampleRate * 0.05); // 50ms frames

  const energies: number[] = [];
  for (let i = 0; i < samples.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += samples[i + j] * samples[i + j];
    }
    energies.push(energy / frameSize);
  }

  if (energies.length < 5) return null;

  const onsets: number[] = [];
  const threshold = 1.5;
  let prevEnergy = energies[0];

  for (let i = 1; i < energies.length; i++) {
    const e = energies[i];
    if (e > prevEnergy * threshold && e > 0.001) {
      if (onsets.length === 0 || (i - onsets[onsets.length - 1]) > 10) {
        onsets.push(i);
      }
    }
    prevEnergy = prevEnergy * 0.9 + e * 0.1;
  }

  if (onsets.length < 3) return null;

  const iois: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const ioi = (onsets[i] - onsets[i - 1]) * hopSize / sampleRate;
    if (ioi > 0.1 && ioi < 2.0) {
      iois.push(ioi);
    }
  }

  if (iois.length < 2) return null;

  const bpms = iois.map(ioi => 60 / ioi);
  const sorted = bpms.sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.round(median * 2) / 2;
}

// Simple key detection using chroma features
function detectKey(samples: Float32Array, sampleRate: number): string | null {
  if (samples.length < sampleRate) return null;

  const start = Math.floor(samples.length * 0.3);
  const len = Math.min(sampleRate * 2, samples.length - start);
  if (len < sampleRate * 0.5) return null;

  const segment = samples.slice(start, start + len);
  const chroma = new Array(12).fill(0);
  const fftSize = 2048;
  const hops = Math.floor(segment.length / (fftSize / 2)) - 1;

  for (let h = 0; h < hops && h < 50; h++) {
    const offset = h * (fftSize / 2);
    if (offset + fftSize > segment.length) break;

    for (let note = 0; note < 12; note++) {
      let energy = 0;
      for (let octave = 2; octave <= 6; octave++) {
        const freq = noteToFrequency(note + octave * 12);
        const bin = Math.round(freq * fftSize / sampleRate);
        if (bin > 0 && bin < fftSize) {
          // Simple DFT at this bin
          let re = 0, im = 0;
          for (let n = 0; n < fftSize; n++) {
            const angle = 2 * Math.PI * bin * n / fftSize;
            re += segment[offset + n] * Math.cos(angle);
            im += segment[offset + n] * Math.sin(angle);
          }
          energy += Math.sqrt(re * re + im * im);
        }
      }
      chroma[note] += energy;
    }
  }

  const maxIdx = chroma.indexOf(Math.max(...chroma));
  const noteName = KEY_NAMES[maxIdx];
  const minorThird = (maxIdx + 3) % 12;
  const majorThird = (maxIdx + 4) % 12;
  const mode = chroma[minorThird] > chroma[majorThird] ? 'm' : '';

  return noteName + mode;
}

// Extract metadata and perform analysis
export async function analyzeAudio(filepath: string): Promise<AnalysisResult> {
  const result: AnalysisResult = {
    bpm: null,
    musical_key: null,
    duration_ms: null,
  };

  try {
    const meta = await parseFile(filepath, {
      duration: true,
      skipCovers: true,
      skipPostHeaders: true,
    });

    result.duration_ms = meta.format.duration ? Math.round(meta.format.duration * 1000) : null;

    const common = meta.common;
    if (common.title) result.title = common.title;
    if (common.artist) result.artist = common.artist;
    if (common.album) result.album = common.album;
    if (common.year) result.year = common.year;
    if (common.genre && common.genre.length > 0) result.genre = common.genre[0];

    if (common.bpm) result.bpm = common.bpm;

    if (common.key) result.musical_key = common.key;

    // If no BPM or key from tags, try basic audio analysis
    if (!result.bpm || !result.musical_key) {
      try {
        const a = await basicAnalysis(filepath);
        if (!result.bpm && a.bpm) result.bpm = a.bpm;
        if (!result.musical_key && a.musical_key) result.musical_key = a.musical_key;
      } catch { /* ok */ }
    }
  } catch {
    // Try basic analysis as fallback
    try {
      const a = await basicAnalysis(filepath);
      result.bpm = a.bpm;
      result.musical_key = a.musical_key;
    } catch { /* give up */ }
  }

  return result;
}

async function basicAnalysis(filepath: string): Promise<{ bpm: number | null; musical_key: string | null }> {
  try {
    const file = Bun.file(filepath);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Check for WAV file
    if (bytes.length > 44 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      const view = new DataView(bytes.buffer);
      const sampleRate = view.getUint32(24, true);
      const numChannels = view.getUint16(22, true);
      const bitsPerSample = view.getUint16(34, true);

      let dataOffset = 36;
      while (dataOffset < bytes.length - 8) {
        const chunkId = String.fromCharCode(bytes[dataOffset], bytes[dataOffset+1], bytes[dataOffset+2], bytes[dataOffset+3]);
        const chunkSize = view.getUint32(dataOffset + 4, true);
        if (chunkId === 'data') {
          dataOffset += 8;
          break;
        }
        dataOffset += 8 + chunkSize;
      }

      if (dataOffset < bytes.length && sampleRate > 0) {
        const bytesPerSample = bitsPerSample / 8;
        const maxSamples = Math.floor((bytes.length - dataOffset) / (bytesPerSample * numChannels));
        const capSamples = Math.min(maxSamples, sampleRate * 30);
        const samples = new Float32Array(capSamples);

        let si = 0;
        for (let i = dataOffset; i < bytes.length && si < capSamples; i += bytesPerSample * numChannels) {
          let sample = 0;
          if (bitsPerSample === 16) {
            sample = view.getInt16(i, true);
          } else if (bitsPerSample === 8) {
            sample = (bytes[i] - 128) * 256;
          } else if (bitsPerSample === 24) {
            sample = (bytes[i] | (bytes[i+1] << 8) | (bytes[i+2] << 16));
            if (sample & 0x800000) sample |= ~0xFFFFFF;
          } else if (bitsPerSample === 32) {
            sample = view.getInt32(i, true) >> 16;
          }
          samples[si++] = sample / 32768;
        }

        return {
          bpm: detectBPM(samples, sampleRate),
          musical_key: detectKey(samples, sampleRate),
        };
      }
    }

    return { bpm: null, musical_key: null };
  } catch {
    return { bpm: null, musical_key: null };
  }
}

// ─── Deep Analysis ──────────────────────────────────────────────────────

/**
 * Perform deep audio analysis on a track file.
 * Extends the basic analysis with vocal detection, instrument estimation,
 * beat pattern analysis, and subgenre classification.
 */
export async function deepAnalyze(filepath: string, existingBpm?: number | null, existingKey?: string | null): Promise<DeepAnalysisResult> {
  // First get basic analysis for BPM/key if not provided
  let bpm = existingBpm ?? null;
  let key = existingKey ?? null;

  if (!bpm || !key) {
    try {
      const meta = await parseFile(filepath, {
        duration: true,
        skipCovers: true,
        skipPostHeaders: true,
      });
      if (!bpm && meta.common.bpm) bpm = meta.common.bpm;
      if (!key && meta.common.key) key = meta.common.key;
    } catch { /* ok */ }
  }

  // Read file as raw PCM for deep analysis
  let samples: Float32Array | null = null;
  let sampleRate = 0;

  try {
    const file = Bun.file(filepath);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length > 44 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      const view = new DataView(bytes.buffer);
      sampleRate = view.getUint32(24, true);
      const numChannels = view.getUint16(22, true);
      const bitsPerSample = view.getUint16(34, true);

      let dataOffset = 36;
      while (dataOffset < bytes.length - 8) {
        const chunkId = String.fromCharCode(bytes[dataOffset], bytes[dataOffset+1], bytes[dataOffset+2], bytes[dataOffset+3]);
        const chunkSize = view.getUint32(dataOffset + 4, true);
        if (chunkId === 'data') {
          dataOffset += 8;
          break;
        }
        dataOffset += 8 + chunkSize;
      }

      if (dataOffset < bytes.length && sampleRate > 0) {
        const bytesPerSample = bitsPerSample / 8;
        const maxSamples = Math.floor((bytes.length - dataOffset) / (bytesPerSample * numChannels));
        const capSamples = Math.min(maxSamples, sampleRate * 60); // up to 60 seconds
        samples = new Float32Array(capSamples);

        let si = 0;
        for (let i = dataOffset; i < bytes.length && si < capSamples; i += bytesPerSample * numChannels) {
          let sample = 0;
          if (bitsPerSample === 16) {
            sample = view.getInt16(i, true);
          } else if (bitsPerSample === 8) {
            sample = (bytes[i] - 128) * 256;
          } else if (bitsPerSample === 24) {
            sample = (bytes[i] | (bytes[i+1] << 8) | (bytes[i+2] << 16));
            if (sample & 0x800000) sample |= ~0xFFFFFF;
          } else if (bitsPerSample === 32) {
            sample = view.getInt32(i, true) >> 16;
          }
          samples[si++] = sample / 32768;
        }
      }
    }
  } catch { /* can't read PCM */ }

  // Run analysis components
  const vocalPresence = samples ? detectVocalPresence(samples, sampleRate) : false;
  const vocalGender = vocalPresence && samples ? detectVocalGender(samples, sampleRate) : null;
  const instruments = samples ? estimateInstruments(samples, sampleRate) : defaultInstruments();
  const beatPattern = samples ? detectBeatPattern(samples, sampleRate, bpm) : null;

  // Energy from BPM
  const energy = estimateEnergy(bpm || 120);

  // Subgenre classification
  const analysisInput: AnalysisInput = {
    bpm,
    key,
    energy,
    vocalPresence,
    vocalGender,
    instruments,
    beatPattern,
  };
  const subgenreSuggestions = classifySubgenres(analysisInput);

  return {
    bpm,
    key,
    energy,
    vocalPresence,
    vocalGender,
    instruments,
    beatPattern,
    subgenreSuggestions,
    analyzedAt: new Date().toISOString(),
  };
}

/** Re-analyze with feedback: accepted or rejected subgenre suggestions adjust future results */
export async function deepAnalyzeWithFeedback(
  filepath: string,
  existingBpm: number | null,
  existingKey: string | null,
  acceptedSubgenres: string[],
  rejectedSubgenres: string[],
): Promise<DeepAnalysisResult> {
  const result = await deepAnalyze(filepath, existingBpm, existingKey);

  // Record feedback
  const { recordSubgenreFeedback } = await import("./subgenre-engine");
  for (const s of acceptedSubgenres) recordSubgenreFeedback(s, true);
  for (const s of rejectedSubgenres) recordSubgenreFeedback(s, false);

  return result;
}

// ─── Instrument Estimation ─────────────────────────────────────────────

function defaultInstruments(): InstrumentProfile {
  return { kick: 0, snare: 0, hihat: 0, bass: 0, synth: 0, piano: 0, guitar: 0, strings: 0, brass: 0 };
}

/**
 * Estimate instrument presence by analyzing frequency bands in the audio.
 * Simplified approach using spectral energy in instrument-characteristic bands.
 */
function estimateInstruments(samples: Float32Array, sampleRate: number): InstrumentProfile {
  // Take a representative segment from the middle
  const start = Math.floor(samples.length * 0.2);
  const len = Math.min(sampleRate * 5, samples.length - start);
  if (len < sampleRate * 0.5) return defaultInstruments();
  const segment = samples.slice(start, start + len);

  // Compute average spectrum via simple FFT-sized chunks
  const fftSize = 2048;
  const hops = Math.min(30, Math.floor(segment.length / (fftSize / 2)) - 1);
  if (hops < 1) return defaultInstruments();

  // Accumulate magnitude spectrum
  const spectrum = new Array(fftSize / 2).fill(0);
  for (let h = 0; h < hops; h++) {
    const offset = h * (fftSize / 2);
    if (offset + fftSize > segment.length) break;
    // Simple DFT for representative bins
    for (let bin = 1; bin < fftSize / 2; bin++) {
      const freq = bin * sampleRate / fftSize;
      let re = 0, im = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = 2 * Math.PI * bin * n / fftSize;
        re += segment[offset + n] * Math.cos(angle);
        im += segment[offset + n] * Math.sin(angle);
      }
      spectrum[bin] += Math.sqrt(re * re + im * im);
    }
  }

  // Normalize spectrum
  const maxVal = Math.max(...spectrum, 0.001);
  for (let i = 0; i < spectrum.length; i++) spectrum[i] /= maxVal;

  // Instrument frequency ranges (in Hz)
  const bands: Record<string, [number, number]> = {
    kick: [50, 120],
    snare: [150, 400],
    hihat: [5000, 16000],
    bass: [60, 250],
    synth: [120, 8000],
    piano: [80, 7000],
    guitar: [80, 5000],
    strings: [200, 4000],
    brass: [200, 3000],
  };

  const result = defaultInstruments();
  for (const [inst, [low, high]] of Object.entries(bands)) {
    const lowBin = Math.floor(low * fftSize / sampleRate);
    const highBin = Math.min(Math.floor(high * fftSize / sampleRate), spectrum.length - 1);
    if (lowBin >= highBin) continue;

    let energy = 0;
    for (let b = lowBin; b <= highBin; b++) {
      energy += spectrum[b];
    }
    const avg = energy / (highBin - lowBin + 1);
    // Map to 0-1 with a sigmoid-like scaling
    (result as any)[inst] = Math.min(1, Math.max(0, avg * 1.5));
  }

  return result;
}

// ─── Vocal Detection ───────────────────────────────────────────────────

/**
 * Detect vocal presence by analyzing mid-range spectral energy variability.
 * Vocals typically concentrate in 300Hz-3kHz and have high temporal variation.
 */
function detectVocalPresence(samples: Float32Array, sampleRate: number): boolean {
  const start = Math.floor(samples.length * 0.15);
  const len = Math.min(sampleRate * 10, samples.length - start);
  if (len < sampleRate) return false;
  const segment = samples.slice(start, start + len);

  const fftSize = 2048;
  const hopSize = fftSize / 2;
  const numFrames = Math.min(40, Math.floor((segment.length - fftSize) / hopSize));

  // Compute energy in vocal band (300-3000 Hz) per frame
  const vocalBandLow = Math.floor(300 * fftSize / sampleRate);
  const vocalBandHigh = Math.floor(3000 * fftSize / sampleRate);
  const vocalEnergies: number[] = [];

  // Also compute energy in non-vocal band for ratio
  const nonVocalBandHigh = Math.floor(8000 * fftSize / sampleRate);

  let maxVocalEnergy = 0;
  let totalEnergy = 0;
  let frameCount = 0;

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize;
    if (offset + fftSize > segment.length) break;

    let vocalEnergy = 0;
    let fullEnergy = 0;

    for (let bin = vocalBandLow; bin <= vocalBandHigh; bin++) {
      let re = 0, im = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = 2 * Math.PI * bin * n / fftSize;
        re += segment[offset + n] * Math.cos(angle);
        im += segment[offset + n] * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im);
      vocalEnergy += mag;
      fullEnergy += mag;
    }

    for (let bin = vocalBandHigh + 1; bin <= nonVocalBandHigh; bin++) {
      let re = 0, im = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = 2 * Math.PI * bin * n / fftSize;
        re += segment[offset + n] * Math.cos(angle);
        im += segment[offset + n] * Math.sin(angle);
      }
      fullEnergy += Math.sqrt(re * re + im * im);
    }

    vocalEnergies.push(vocalEnergy);
    maxVocalEnergy = Math.max(maxVocalEnergy, vocalEnergy);
    totalEnergy += fullEnergy;
    frameCount++;
  }

  if (frameCount < 5 || totalEnergy < 0.001) return false;

  // Heuristic: vocals have high variability in mid-range energy
  // and vocal band energy is a significant portion of total
  const avgVocalEnergy = vocalEnergies.reduce((a, b) => a + b, 0) / frameCount;
  let variance = 0;
  for (const e of vocalEnergies) {
    variance += (e - avgVocalEnergy) ** 2;
  }
  variance /= frameCount;

  const vocalVariability = Math.sqrt(variance) / Math.max(avgVocalEnergy, 0.001);
  const vocalRatio = avgVocalEnergy / Math.max(totalEnergy / frameCount, 0.001);

  // High variability + moderate ratio suggests vocals
  return vocalVariability > 0.3 && vocalRatio > 0.15;
}

// ─── Vocal Gender Detection ────────────────────────────────────────────

/**
 * Simple heuristic: male voices have fundamental ~85-180Hz,
 * female voices have fundamental ~165-255Hz.
 * Analyze strongest pitch in vocal range.
 */
function detectVocalGender(samples: Float32Array, sampleRate: number): "male" | "female" | null {
  const start = Math.floor(samples.length * 0.15);
  const len = Math.min(sampleRate * 5, samples.length - start);
  if (len < sampleRate) return null;
  const segment = samples.slice(start, start + len);

  // Simple autocorrelation-based pitch detection
  const minLag = Math.floor(sampleRate / 300);  // ~300 Hz max
  const maxLag = Math.floor(sampleRate / 70);    // ~70 Hz min
  if (maxLag <= minLag) return null;

  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const maxN = Math.min(segment.length - lag, sampleRate);
    for (let i = 0; i < maxN; i++) {
      corr += segment[i] * segment[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0) return null;

  const pitch = sampleRate / bestLag;

  // Classification thresholds
  // Male: ~85-180 Hz (avg ~130)
  // Female: ~165-255 Hz (avg ~200)
  if (pitch < 160) return "male";
  if (pitch >= 160 && pitch < 300) return "female";
  return null;
}

// ─── Beat Pattern Detection ────────────────────────────────────────────

/**
 * Detect the beat pattern by analyzing rhythmic emphasis.
 * Uses energy envelope analysis at beat intervals.
 */
function detectBeatPattern(samples: Float32Array, sampleRate: number, bpm: number | null): string | null {
  if (!bpm || bpm <= 0 || samples.length < sampleRate * 2) return null;

  const beatInterval = 60 / bpm; // seconds per beat
  const beatSamples = Math.floor(beatInterval * sampleRate);

  // Compute energy envelope
  const hopSize = Math.floor(sampleRate * 0.002); // 2ms hops for fine resolution
  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
  const start = Math.floor(samples.length * 0.1);
  const end = Math.min(samples.length * 0.9, start + sampleRate * 30);

  const envelope: number[] = [];
  for (let i = start; i < end - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += samples[i + j] * samples[i + j];
    }
    envelope.push(energy / frameSize);
  }

  if (envelope.length < 100) return null;

  // Analyze beat positions
  // Find peaks in envelope and classify by their spacing pattern
  const peaks: number[] = [];
  const smoothedEnvelope: number[] = [];
  // Smooth
  const smoothWindow = 5;
  for (let i = smoothWindow; i < envelope.length - smoothWindow; i++) {
    let sum = 0;
    for (let j = -smoothWindow; j <= smoothWindow; j++) sum += envelope[i + j];
    smoothedEnvelope.push(sum / (2 * smoothWindow + 1));
  }

  // Find peaks
  for (let i = 1; i < smoothedEnvelope.length - 1; i++) {
    if (smoothedEnvelope[i] > smoothedEnvelope[i-1] && smoothedEnvelope[i] > smoothedEnvelope[i+1]) {
      const threshold = Math.max(...smoothedEnvelope) * 0.3;
      if (smoothedEnvelope[i] > threshold) {
        peaks.push(i);
      }
    }
  }

  if (peaks.length < 4) return null;

  // Calculate inter-peak intervals
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  // Expected interval in envelope samples for one beat
  const expectedInterval = (beatInterval / (hopSize / sampleRate));
  const expectedSwing = expectedInterval / 2;  // swung 8th note

  // Classify pattern
  // Count how many intervals match expected values
  let fourOnFloor = 0;
  let breakbeatHits = 0;
  let halftimeHits = 0;
  let swingHits = 0;
  let total = 0;

  for (const iv of intervals) {
    total++;
    const ratio = iv / expectedInterval;

    if (ratio > 0.75 && ratio < 1.25) {
      fourOnFloor++;
    } else if (ratio > 0.4 && ratio < 0.65) {
      breakbeatHits++;
    } else if (ratio > 1.8 && ratio < 2.2) {
      halftimeHits++;
    } else if (ratio > 0.3 && ratio < 0.7) {
      swingHits++;
    }
  }

  const pctFourOnFloor = fourOnFloor / total;
  const pctBreakbeat = breakbeatHits / total;
  const pctHalftime = halftimeHits / total;

  // Classification
  if (bpm >= 135 && bpm <= 150 && (pctHalftime > 0.3 || (pctBreakbeat > 0.2 && pctFourOnFloor < 0.3))) {
    return "dubstep";
  }
  if (bpm <= 110 && pctHalftime > 0.2 && pctFourOnFloor < 0.2) {
    return "trap";
  }
  if (bpm >= 160 && pctBreakbeat > 0.15) {
    return "breakbeat";
  }
  if (pctBreakbeat > 0.25 && bpm > 100) {
    return "breakbeat";
  }
  if (pctHalftime > 0.3 && pctFourOnFloor < 0.2) {
    return "half-time";
  }
  if (swingHits / total > 0.3 && pctFourOnFloor < 0.3) {
    return "swing";
  }
  if (bpm >= 88 && bpm <= 110 && pctFourOnFloor > 0.3 && pctBreakbeat < 0.15) {
    return "reggaeton";
  }
  if (pctFourOnFloor > 0.4) {
    return "four-on-the-floor";
  }

  return null;
}
