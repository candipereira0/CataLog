// Light Sync Engine — computes light parameters from track metadata

export interface TrackLightInput {
  bpm?: number | null;
  mood?: string | null;
  musical_key?: string | null;
  beat_pattern?: string | null;
  genre?: string | null;
  energy?: number | null; // 1-10
  title?: string;
  artist?: string;
}

export interface LightParams {
  bpm: number;
  energy: number;       // 1-10
  mood: string;
  key: string;
  beatPattern: string;
  colorPalette: string[];
  strobePattern: StrobePattern;
  intensity: number;    // 0-1
}

export interface StrobePattern {
  type: "four-on-the-floor" | "breakbeat" | "syncopated" | "half-time" | "triplet" | "off";
  intervals: number[];  // beat fractions (0-1) within one bar where strobe fires
}

// ─── Mood → Color Palette Mapping ───

const MOOD_PALETTES: Record<string, string[]> = {
  dark:        ["#1a0a2e", "#2d1b4e", "#4a1942", "#6b1d3b", "#8b1e3f"],
  uplifting:   ["#87ceeb", "#4db8ff", "#ffffff", "#ffe066", "#ffd700"],
  hypnotic:    ["#0a3d3d", "#0f5c5c", "#1a8a8a", "#2eb8b8", "#5cd6d6"],
  energetic:   ["#ff0040", "#ff6600", "#ffcc00", "#00ff88", "#0066ff"],
  melancholic: ["#1a1a3e", "#2d2d6b", "#4a4a8a", "#7b7bb4", "#a0a0d0"],
  epic:        ["#ff4500", "#ff8c00", "#ffd700", "#ffffff", "#dc143c"],
  ethereal:    ["#e6e6fa", "#d8bfd8", "#b0c4de", "#ffe4e1", "#f0f8ff"],
  funky:       ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff922b"],
  aggressive:  ["#ff0000", "#cc0000", "#990000", "#ff3333", "#ff6666"],
  chill:       ["#27496d", "#0c7b93", "#00a8cc", "#a2d5f2", "#e3f6f5"],
  romantic:    ["#ff6b9d", "#c44569", "#e66767", "#f8a5c2", "#fce4ec"],
  dreamy:      ["#2d1b69", "#5b2c8e", "#7c3aed", "#a78bfa", "#c4b5fd"],
  tribal:      ["#8b4513", "#a0522d", "#cd853f", "#deb887", "#d2691e"],
  industrial:  ["#2f2f2f", "#4a4a4a", "#808080", "#b0b0b0", "#ff4500"],
  minimal:     ["#0d0d0d", "#1a1a1a", "#333333", "#666666", "#999999"],
  warm:        ["#ff7e67", "#ff9a76", "#feca57", "#ff6b6b", "#ee5a24"],
  cold:        ["#74b9ff", "#a29bfe", "#6c5ce7", "#81ecec", "#00cec9"],
};

// Fallback: map genre keywords to mood
function inferMoodFromGenre(genre: string | null | undefined): string {
  if (!genre) return "energetic";
  const g = genre.toLowerCase();
  if (g.includes("dark") || g.includes("industrial") || g.includes("techno")) return "dark";
  if (g.includes("uplift") || g.includes("trance")) return "uplifting";
  if (g.includes("hypno") || g.includes("psy") || g.includes("ambient")) return "hypnotic";
  if (g.includes("chill") || g.includes("downtempo") || g.includes("lo-fi")) return "chill";
  if (g.includes("funk") || g.includes("disco")) return "funky";
  if (g.includes("melanch") || g.includes("sad")) return "melancholic";
  if (g.includes("epic") || g.includes("orchestral")) return "epic";
  if (g.includes("dream") || g.includes("shoegaze")) return "dreamy";
  if (g.includes("aggressive") || g.includes("hard") || g.includes("metal")) return "aggressive";
  if (g.includes("minimal") || g.includes("micro")) return "minimal";
  if (g.includes("romantic") || g.includes("r&b")) return "romantic";
  if (g.includes("tribal") || g.includes("world")) return "tribal";
  return "energetic";
}

// ─── Beat Pattern → Strobe Detection ───

function detectStrobePattern(beatPattern: string | null | undefined, bpm: number): StrobePattern {
  if (!beatPattern) {
    // Default: four-on-the-floor for electronic genres, off otherwise
    return { type: "four-on-the-floor", intervals: [0, 0.25, 0.5, 0.75] };
  }
  const bp = beatPattern.toLowerCase();

  if (bp.includes("four-on-the-floor") || bp.includes("4/4") || bp.includes("four on the floor")) {
    return { type: "four-on-the-floor", intervals: [0, 0.25, 0.5, 0.75] };
  }
  if (bp.includes("breakbeat") || bp.includes("break")) {
    return { type: "breakbeat", intervals: [0, 0.1875, 0.375, 0.5, 0.6875, 0.875] };
  }
  if (bp.includes("half-time") || bp.includes("halftime")) {
    return { type: "half-time", intervals: [0, 0.5] };
  }
  if (bp.includes("triplet") || bp.includes("shuffle")) {
    return { type: "triplet", intervals: [0, 0.333, 0.667] };
  }
  if (bp.includes("syncopated") || bp.includes("syncopation")) {
    return { type: "syncopated", intervals: [0, 0.125, 0.375, 0.625, 0.75] };
  }
  // Auto-detect based on BPM
  if (bpm < 80) {
    return { type: "half-time", intervals: [0, 0.5] };
  }
  if (bpm > 150) {
    return { type: "four-on-the-floor", intervals: [0, 0.25, 0.5, 0.75] };
  }
  return { type: "four-on-the-floor", intervals: [0, 0.25, 0.5, 0.75] };
}

// ─── Energy Estimation ───

function estimateEnergy(track: TrackLightInput): number {
  if (track.energy != null && track.energy >= 1 && track.energy <= 10) {
    return track.energy;
  }
  // Infer from BPM
  if (track.bpm) {
    if (track.bpm > 160) return 9;
    if (track.bpm > 140) return 8;
    if (track.bpm > 125) return 7;
    if (track.bpm > 110) return 6;
    if (track.bpm > 90) return 5;
    if (track.bpm > 70) return 4;
    return 3;
  }
  return 5; // default middle energy
}

// ─── Main Function ───

export function getLightParams(track: TrackLightInput): LightParams {
  const bpm = track.bpm ?? 120;
  const energy = estimateEnergy(track);
  const mood = track.mood || inferMoodFromGenre(track.genre);
  const key = track.musical_key ?? "C";
  const beatPattern = track.beat_pattern ?? "four-on-the-floor";

  // Normalize mood key for palette lookup
  const moodKey = Object.keys(MOOD_PALETTES).find(k =>
    mood.toLowerCase().includes(k) || k.includes(mood.toLowerCase())
  ) || "energetic";

  const colorPalette = MOOD_PALETTES[moodKey] || MOOD_PALETTES.energetic;
  const strobePattern = detectStrobePattern(beatPattern, bpm);
  const intensity = Math.max(0.1, Math.min(1.0, energy / 10));

  return {
    bpm,
    energy,
    mood: moodKey,
    key,
    beatPattern,
    colorPalette,
    strobePattern,
    intensity,
  };
}

// ─── Mood → MIDI Note Mapping (for triggering light scenes) ───

export function moodToMidiNote(mood: string): number {
  const map: Record<string, number> = {
    dark:        36, // C2 - deep, ominous
    uplifting:   60, // C4 - bright center
    hypnotic:    48, // C3 - trance-inducing
    energetic:   64, // E4 - high energy
    melancholic: 40, // E2 - somber
    epic:        72, // C5 - grand
    ethereal:    76, // E5 - airy
    funky:       55, // G3 - groovy
    aggressive:  38, // D2 - punchy
    chill:       52, // E3 - relaxed
    romantic:    65, // F4 - warm
    dreamy:      67, // G4 - floating
    tribal:      45, // A2 - earthy
    industrial:  42, // F#2 - mechanical
    minimal:     50, // D3 - sparse
    warm:        59, // B3 - cozy
    cold:        54, // F#3 - icy
  };
  return map[mood] ?? 60;
}

// ─── OSC Message Generation ───

export interface OscLightMessage {
  address: string;
  args: (number | string | number[])[];
}

export function getOscMessages(params: LightParams): OscLightMessage[] {
  const messages: OscLightMessage[] = [];

  // BPM
  messages.push({ address: "/light/bpm", args: [params.bpm] });

  // Intensity
  messages.push({ address: "/light/intensity", args: [params.intensity] });

  // Color — send first three palette colors as RGB
  const rgb = hexToRgb(params.colorPalette[0]);
  messages.push({
    address: "/light/color",
    args: [rgb.r / 255, rgb.g / 255, rgb.b / 255],
  });

  // Strobe rate (in Hz)
  const strobeHz = (params.bpm / 60) * params.strobePattern.intervals.length;
  messages.push({ address: "/light/strobe", args: [strobeHz] });

  // Mood as string
  messages.push({ address: "/light/mood", args: [params.mood] });

  return messages;
}

// ─── Helpers ───

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Interpolate between two palettes (for mood transitions)
export function interpolatePalette(paletteA: string[], paletteB: string[], t: number): string[] {
  return paletteA.map((hexA, i) => {
    const hexB = paletteB[i] || paletteB[paletteB.length - 1];
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const r = a.r + (b.r - a.r) * t;
    const g = a.g + (b.g - a.g) * t;
    const bl = a.b + (b.b - a.b) * t;
    return rgbToHex(r, g, bl);
  });
}
