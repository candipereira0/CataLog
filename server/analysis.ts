// Lightweight audio analysis for BPM and key detection.
// Uses onset detection (energy-based) for BPM and a simple chroma estimator for key.
// Reads audio files in small chunks to stay memory-light.

import { parseFile } from "music-metadata";

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
