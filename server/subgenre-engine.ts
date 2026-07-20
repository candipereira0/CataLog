// Subgenre classification rule engine for CataLog.
// Maps BPM ranges, beat patterns, instrument profiles, and vocal presence to subgenres
// using the 48-genre + 200-subgenre hierarchy from genres.ts

import { getAllGenres, getGenre, getSubgenres, type GenreNode } from "./genres";

export interface InstrumentProfile {
  kick: number;         // 0-1 confidence
  snare: number;
  hihat: number;
  bass: number;
  synth: number;
  piano: number;
  guitar: number;
  strings: number;
  brass: number;
}

export interface AnalysisInput {
  bpm: number | null;
  key: string | null;
  energy: number;
  vocalPresence: boolean;
  vocalGender: string | null;    // "male" | "female" | null
  instruments: InstrumentProfile;
  beatPattern: string | null;    // "four-on-the-floor" | "breakbeat" | "half-time" | "swing" | "trap" | "reggaeton" | "dubstep" | null
}

export interface SubgenreSuggestion {
  subgenre: string;
  parentGenre: string;
  confidence: number;   // 0-100
  reasons: string[];
}

// ─── Beat pattern detection helpers ───
// (Used by analysis.ts at runtime; also referenced here for classification)

export const BEAT_PATTERNS = [
  "four-on-the-floor",
  "breakbeat",
  "half-time",
  "swing",
  "trap",
  "reggaeton",
  "dubstep",
] as const;

export type BeatPattern = typeof BEAT_PATTERNS[number];

// ─── Classification Rule ───
interface ClassificationRule {
  subgenre: string;
  parentGenre: string;
  bpmMin: number | null;
  bpmMax: number | null;
  beatPatterns: string[];        // any match
  requiredInstruments: string[];  // must have ALL (threshold > 0.3)
  forbiddenInstruments: string[]; // must NOT have (threshold > 0.3)
  vocalRequired: boolean | null;  // true=must have vocals, false=must be instrumental, null=don't care
  vocalGenderHint: string | null; // "male" or "female" preference
  energyMin: number;
  energyMax: number;
  keyHint: string | null;        // Major/minor preference ("major", "minor")
  bonusInstruments: string[];    // boost confidence if present
  description: string;
}

// ─── Rule Database ───
// Ordered by specificity (most specific rules first)
const RULES: ClassificationRule[] = [
  // ─── Techno ───
  {
    subgenre: "Melodic Techno", parentGenre: "Techno",
    bpmMin: 120, bpmMax: 132, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["synth", "kick", "bass"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 4, energyMax: 8, keyHint: "minor",
    bonusInstruments: ["piano", "strings"],
    description: "Melodic, atmospheric techno with lush synths and emotional progressions",
  },
  {
    subgenre: "Peak Time Techno", parentGenre: "Techno",
    bpmMin: 128, bpmMax: 138, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "synth"], forbiddenInstruments: ["guitar", "piano", "brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 7, energyMax: 10, keyHint: null,
    bonusInstruments: ["hihat"],
    description: "Driving, high-energy techno for peak dancefloor moments",
  },
  {
    subgenre: "Minimal Techno", parentGenre: "Techno",
    bpmMin: 122, bpmMax: 132, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "hihat"], forbiddenInstruments: ["guitar", "brass", "piano"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 2, energyMax: 6, keyHint: null,
    bonusInstruments: [],
    description: "Stripped-back, hypnotic techno with minimal elements",
  },
  {
    subgenre: "Industrial Techno", parentGenre: "Techno",
    bpmMin: 128, bpmMax: 145, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "synth"], forbiddenInstruments: ["piano", "strings"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 7, energyMax: 10, keyHint: null,
    bonusInstruments: ["hihat"],
    description: "Hard, distorted, dark techno with industrial textures",
  },
  {
    subgenre: "Dub Techno", parentGenre: "Techno",
    bpmMin: 118, bpmMax: 128, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 2, energyMax: 5, keyHint: "minor",
    bonusInstruments: ["synth"],
    description: "Deep, dub-influenced techno with echo and reverb",
  },
  {
    subgenre: "Detroit Techno", parentGenre: "Techno",
    bpmMin: 125, bpmMax: 138, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "synth"], forbiddenInstruments: ["guitar"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 4, energyMax: 8, keyHint: null,
    bonusInstruments: ["strings", "piano"],
    description: "Classic Detroit sound — soulful, melodic techno",
  },
  {
    subgenre: "Deep Techno", parentGenre: "Techno",
    bpmMin: 118, bpmMax: 128, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 2, energyMax: 5, keyHint: null,
    bonusInstruments: ["synth"],
    description: "Deep, hypnotic techno with atmospheric textures",
  },

  // ─── House ───
  {
    subgenre: "Deep House", parentGenre: "House",
    bpmMin: 118, bpmMax: 128, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass", "hihat"], forbiddenInstruments: ["brass"],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 3, energyMax: 7, keyHint: null,
    bonusInstruments: ["piano", "synth"],
    description: "Deep, soulful house with warm basslines and jazzy elements",
  },
  {
    subgenre: "Tech House", parentGenre: "House",
    bpmMin: 123, bpmMax: 130, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass", "hihat"], forbiddenInstruments: ["guitar", "strings"],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 5, energyMax: 9, keyHint: null,
    bonusInstruments: ["synth"],
    description: "Groove-driven house with techno elements",
  },
  {
    subgenre: "Soulful House", parentGenre: "House",
    bpmMin: 118, bpmMax: 126, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass", "hihat"], forbiddenInstruments: [],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 4, energyMax: 8, keyHint: null,
    bonusInstruments: ["piano", "strings"],
    description: "Emotive house with soulful vocals and warm instrumentation",
  },
  {
    subgenre: "Funky House", parentGenre: "House",
    bpmMin: 122, bpmMax: 130, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass", "hihat"], forbiddenInstruments: [],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 5, energyMax: 9, keyHint: null,
    bonusInstruments: ["guitar", "brass"],
    description: "Upbeat house with funk-inspired basslines and brass",
  },
  {
    subgenre: "Vocal House", parentGenre: "House",
    bpmMin: 120, bpmMax: 130, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass"], forbiddenInstruments: [],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 5, energyMax: 9, keyHint: null,
    bonusInstruments: ["piano"],
    description: "House music centered around vocal performances",
  },
  {
    subgenre: "Acid House", parentGenre: "House",
    bpmMin: 120, bpmMax: 130, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "synth", "bass"], forbiddenInstruments: ["guitar", "strings", "piano"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 6, energyMax: 9, keyHint: null,
    bonusInstruments: ["hihat"],
    description: "Squelchy acid house with the Roland TB-303 sound",
  },
  {
    subgenre: "Progressive House", parentGenre: "House",
    bpmMin: 122, bpmMax: 130, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass", "synth"], forbiddenInstruments: ["brass"],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 4, energyMax: 8, keyHint: null,
    bonusInstruments: ["strings", "piano"],
    description: "Building, evolving house with layered progressions",
  },
  {
    subgenre: "Afro House", parentGenre: "House",
    bpmMin: 118, bpmMax: 126, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass"], forbiddenInstruments: [],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 4, energyMax: 8, keyHint: null,
    bonusInstruments: ["hihat"],
    description: "African-influenced house with tribal percussion and rhythms",
  },

  // ─── Drum & Bass ───
  {
    subgenre: "Liquid DnB", parentGenre: "Drum & Bass",
    bpmMin: 170, bpmMax: 180, beatPatterns: ["breakbeat"],
    requiredInstruments: ["bass", "kick", "snare"], forbiddenInstruments: ["brass"],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["piano", "strings", "synth"],
    description: "Smooth, melodic drum & bass with atmospheric textures",
  },
  {
    subgenre: "Neurofunk", parentGenre: "Drum & Bass",
    bpmMin: 170, bpmMax: 180, beatPatterns: ["breakbeat"],
    requiredInstruments: ["bass", "kick", "snare", "synth"], forbiddenInstruments: ["piano", "strings", "guitar"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 8, energyMax: 10, keyHint: "minor",
    bonusInstruments: ["hihat"],
    description: "Dark, technical DnB with complex basslines and sci-fi aesthetics",
  },
  {
    subgenre: "Jungle", parentGenre: "Drum & Bass",
    bpmMin: 160, bpmMax: 175, beatPatterns: ["breakbeat"],
    requiredInstruments: ["kick", "snare", "bass"], forbiddenInstruments: ["piano"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 6, energyMax: 9, keyHint: null,
    bonusInstruments: ["hihat"],
    description: "Classic jungle with chopped amens and deep sub-bass",
  },

  // ─── Trance ───
  {
    subgenre: "Uplifting Trance", parentGenre: "Trance",
    bpmMin: 132, bpmMax: 142, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "synth", "bass"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: null, vocalGenderHint: "female",
    energyMin: 7, energyMax: 10, keyHint: "minor",
    bonusInstruments: ["strings", "piano"],
    description: "Euphoric trance with soaring melodies and emotional breakdowns",
  },
  {
    subgenre: "Progressive Trance", parentGenre: "Trance",
    bpmMin: 126, bpmMax: 136, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "synth", "bass"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["strings"],
    description: "Slow-building trance with layered progressive elements",
  },
  {
    subgenre: "Psytrance", parentGenre: "Trance",
    bpmMin: 138, bpmMax: 150, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass", "synth"], forbiddenInstruments: ["guitar", "piano", "strings"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 8, energyMax: 10, keyHint: null,
    bonusInstruments: ["hihat"],
    description: "Fast, psychedelic trance with rolling basslines",
  },
  {
    subgenre: "Vocal Trance", parentGenre: "Trance",
    bpmMin: 130, bpmMax: 140, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "synth", "bass"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 6, energyMax: 9, keyHint: null,
    bonusInstruments: ["strings", "piano"],
    description: "Trance with prominent vocal performances",
  },

  // ─── Dubstep ───
  {
    subgenre: "Brostep", parentGenre: "Dubstep",
    bpmMin: 138, bpmMax: 150, beatPatterns: ["dubstep", "half-time"],
    requiredInstruments: ["kick", "snare", "bass", "synth"], forbiddenInstruments: ["piano", "strings", "guitar"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 8, energyMax: 10, keyHint: "minor",
    bonusInstruments: ["hihat"],
    description: "Aggressive, mid-range-heavy dubstep with intense bass drops",
  },
  {
    subgenre: "Deep Dubstep", parentGenre: "Dubstep",
    bpmMin: 135, bpmMax: 145, beatPatterns: ["dubstep", "half-time"],
    requiredInstruments: ["kick", "bass"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 3, energyMax: 6, keyHint: "minor",
    bonusInstruments: ["synth"],
    description: "Deep, meditative dubstep with spacious sub-bass",
  },

  // ─── Breakbeat ───
  {
    subgenre: "Big Beat", parentGenre: "Breakbeat",
    bpmMin: 110, bpmMax: 135, beatPatterns: ["breakbeat"],
    requiredInstruments: ["kick", "snare", "bass"], forbiddenInstruments: [],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 6, energyMax: 9, keyHint: null,
    bonusInstruments: ["synth", "guitar"],
    description: "Big, anthemic breakbeat with rock and electronic influences",
  },
  {
    subgenre: "Progressive Breaks", parentGenre: "Breakbeat",
    bpmMin: 125, bpmMax: 135, beatPatterns: ["breakbeat"],
    requiredInstruments: ["kick", "bass", "synth"], forbiddenInstruments: ["brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["strings", "piano"],
    description: "Atmospheric, evolving breakbeat with progressive house influence",
  },

  // ─── Trap ───
  {
    subgenre: "EDM Trap", parentGenre: "Trap",
    bpmMin: 130, bpmMax: 155, beatPatterns: ["trap", "half-time"],
    requiredInstruments: ["kick", "snare", "bass", "hihat"], forbiddenInstruments: ["guitar", "piano"],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 7, energyMax: 10, keyHint: "minor",
    bonusInstruments: ["synth", "brass"],
    description: "High-energy trap with EDM drops and festival-ready builds",
  },
  {
    subgenre: "Hybrid Trap", parentGenre: "Trap",
    bpmMin: 140, bpmMax: 160, beatPatterns: ["trap", "dubstep"],
    requiredInstruments: ["kick", "snare", "bass", "synth"], forbiddenInstruments: ["piano", "strings"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 8, energyMax: 10, keyHint: "minor",
    bonusInstruments: ["hihat"],
    description: "Trap mixed with dubstep growls and aggressive sound design",
  },

  // ─── Hip-Hop ───
  {
    subgenre: "Boom Bap", parentGenre: "Hip-Hop",
    bpmMin: 80, bpmMax: 100, beatPatterns: ["breakbeat", "swing"],
    requiredInstruments: ["kick", "snare", "bass"], forbiddenInstruments: ["synth"],
    vocalRequired: true, vocalGenderHint: "male",
    energyMin: 3, energyMax: 7, keyHint: null,
    bonusInstruments: ["hihat", "piano"],
    description: "Classic East Coast hip-hop with hard-hitting drums",
  },
  {
    subgenre: "Trap", parentGenre: "Hip-Hop",
    bpmMin: 65, bpmMax: 85, beatPatterns: ["trap", "half-time"],
    requiredInstruments: ["kick", "hihat", "bass"], forbiddenInstruments: ["guitar", "strings"],
    vocalRequired: true, vocalGenderHint: "male",
    energyMin: 4, energyMax: 8, keyHint: "minor",
    bonusInstruments: ["snare", "synth"],
    description: "Modern hip-hop trap with 808s and rolling hi-hats",
  },
  {
    subgenre: "Lo-Fi Hip-Hop", parentGenre: "Hip-Hop",
    bpmMin: 70, bpmMax: 95, beatPatterns: ["swing", "breakbeat"],
    requiredInstruments: ["kick", "snare"], forbiddenInstruments: ["brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 1, energyMax: 4, keyHint: null,
    bonusInstruments: ["piano", "guitar"],
    description: "Chill, study-friendly beats with warm, dusty textures",
  },

  // ─── Reggae/Dancehall ───
  {
    subgenre: "Dancehall", parentGenre: "Reggae",
    bpmMin: 90, bpmMax: 110, beatPatterns: ["reggaeton"],
    requiredInstruments: ["kick", "bass"], forbiddenInstruments: ["synth", "guitar"],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["hihat", "snare"],
    description: "Energetic Jamaican dancehall rhythms",
  },
  {
    subgenre: "Reggaeton", parentGenre: "Latin",
    bpmMin: 88, bpmMax: 100, beatPatterns: ["reggaeton"],
    requiredInstruments: ["kick", "snare", "bass"], forbiddenInstruments: [],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["synth", "hihat"],
    description: "Latin urban reggaeton with dembow rhythm",
  },

  // ─── Garage ───
  {
    subgenre: "UK Garage", parentGenre: "Garage",
    bpmMin: 128, bpmMax: 138, beatPatterns: ["swing", "breakbeat"],
    requiredInstruments: ["kick", "snare", "bass", "hihat"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["synth"],
    description: "Classic UK garage with shuffled drums and bass-heavy grooves",
  },
  {
    subgenre: "2-Step Garage", parentGenre: "Garage",
    bpmMin: 128, bpmMax: 138, beatPatterns: ["swing", "breakbeat"],
    requiredInstruments: ["kick", "snare", "bass", "hihat"], forbiddenInstruments: [],  // typo intentional, matches data
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["synth"],
    description: "Vocal-driven UK garage with shuffled 2-step rhythms",
  },

  // ─── Disco / Nu Disco ───
  {
    subgenre: "Nu Disco", parentGenre: "Disco",
    bpmMin: 110, bpmMax: 125, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass", "hihat"], forbiddenInstruments: [],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 4, energyMax: 8, keyHint: null,
    bonusInstruments: ["guitar", "strings", "brass", "piano"],
    description: "Modern disco with vintage instrumentation and house sensibilities",
  },

  // ─── Ambient ───
  {
    subgenre: "Space Ambient", parentGenre: "Ambient",
    bpmMin: null, bpmMax: null, beatPatterns: [],
    requiredInstruments: ["synth"], forbiddenInstruments: ["kick", "snare", "brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 1, energyMax: 3, keyHint: null,
    bonusInstruments: ["strings", "piano"],
    description: "Ethereal, cosmic ambient with vast soundscapes",
  },
  {
    subgenre: "Ambient Techno", parentGenre: "Ambient",
    bpmMin: 110, bpmMax: 130, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "synth"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 2, energyMax: 5, keyHint: null,
    bonusInstruments: ["strings"],
    description: "Techno-infused ambient with gentle pulses",
  },

  // ─── Electronic (other) ───
  {
    subgenre: "Synthwave", parentGenre: "Electronic",
    bpmMin: 80, bpmMax: 120, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["synth", "kick"], forbiddenInstruments: ["brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 4, energyMax: 8, keyHint: null,
    bonusInstruments: ["bass", "hihat"],
    description: "80s-inspired synth music with retro aesthetics",
  },
  {
    subgenre: "Trip-Hop", parentGenre: "Electronic",
    bpmMin: 70, bpmMax: 100, beatPatterns: ["breakbeat", "half-time"],
    requiredInstruments: ["kick", "bass"], forbiddenInstruments: [],
    vocalRequired: null, vocalGenderHint: "female",
    energyMin: 2, energyMax: 5, keyHint: "minor",
    bonusInstruments: ["synth", "strings", "piano"],
    description: "Dark, moody downtempo with hip-hop beats",
  },
  {
    subgenre: "IDM", parentGenre: "Electronic",
    bpmMin: null, bpmMax: null, beatPatterns: ["breakbeat"],
    requiredInstruments: ["synth"], forbiddenInstruments: ["guitar", "brass"],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 2, energyMax: 7, keyHint: null,
    bonusInstruments: ["piano", "strings"],
    description: "Experimental, cerebral electronic music",
  },

  // ─── R&B ───
  {
    subgenre: "Contemporary R&B", parentGenre: "R&B",
    bpmMin: 60, bpmMax: 100, beatPatterns: ["half-time", "trap", "swing"],
    requiredInstruments: ["kick", "bass"], forbiddenInstruments: [],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 2, energyMax: 6, keyHint: null,
    bonusInstruments: ["piano", "synth", "hihat"],
    description: "Modern R&B with smooth production and soulful vocals",
  },
  {
    subgenre: "Neo-Soul", parentGenre: "R&B",
    bpmMin: 60, bpmMax: 95, beatPatterns: ["swing", "half-time"],
    requiredInstruments: ["kick", "bass"], forbiddenInstruments: [],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 2, energyMax: 5, keyHint: null,
    bonusInstruments: ["piano", "guitar", "strings"],
    description: "Soulful, organic R&B with jazz influences",
  },

  // ─── Funk ───
  {
    subgenre: "P-Funk", parentGenre: "Funk",
    bpmMin: 90, bpmMax: 115, beatPatterns: ["swing"],
    requiredInstruments: ["kick", "bass", "guitar"], forbiddenInstruments: [],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["brass", "synth", "hihat"],
    description: "Parliament-Funkadelic style funk with psychedelic grooves",
  },
  {
    subgenre: "Electro Funk", parentGenre: "Funk",
    bpmMin: 105, bpmMax: 125, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["kick", "bass", "synth"], forbiddenInstruments: ["guitar"],
    vocalRequired: null, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["hihat"],
    description: "Funk fused with electronic production and vocoders",
  },

  // ─── Jazz ───
  {
    subgenre: "Jazz Fusion", parentGenre: "Jazz",
    bpmMin: null, bpmMax: null, beatPatterns: ["swing"],
    requiredInstruments: ["piano", "bass"], forbiddenInstruments: [],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 3, energyMax: 8, keyHint: null,
    bonusInstruments: ["guitar", "brass", "strings", "synth"],
    description: "Jazz mixed with rock, funk, and electronic elements",
  },
  {
    subgenre: "Nu Jazz", parentGenre: "Jazz",
    bpmMin: null, bpmMax: null, beatPatterns: ["breakbeat", "swing"],
    requiredInstruments: ["piano", "bass"], forbiddenInstruments: [],
    vocalRequired: false, vocalGenderHint: null,
    energyMin: 3, energyMax: 7, keyHint: null,
    bonusInstruments: ["synth", "hihat", "strings"],
    description: "Modern jazz with electronic production and beats",
  },

  // ─── Pop ───
  {
    subgenre: "Synth Pop", parentGenre: "Pop",
    bpmMin: 100, bpmMax: 130, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["synth", "kick", "bass"], forbiddenInstruments: ["brass"],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 5, energyMax: 8, keyHint: null,
    bonusInstruments: ["hihat"],
    description: "Pop music driven by synthesizers with catchy hooks",
  },
  {
    subgenre: "Electro Pop", parentGenre: "Pop",
    bpmMin: 110, bpmMax: 135, beatPatterns: ["four-on-the-floor"],
    requiredInstruments: ["synth", "kick", "bass", "hihat"], forbiddenInstruments: ["brass"],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 6, energyMax: 9, keyHint: null,
    bonusInstruments: ["guitar"],
    description: "Electronic pop with danceable beats and bright production",
  },
  {
    subgenre: "Hyperpop", parentGenre: "Pop",
    bpmMin: 130, bpmMax: 180, beatPatterns: ["four-on-the-floor", "breakbeat", "trap"],
    requiredInstruments: ["synth", "kick", "bass"], forbiddenInstruments: ["strings", "brass"],
    vocalRequired: true, vocalGenderHint: null,
    energyMin: 8, energyMax: 10, keyHint: null,
    bonusInstruments: ["hihat"],
    description: "Maximalist, distorted pop with pitched vocals and extreme production",
  },
];

// ─── Classification Engine ───

function instrumentName(key: string): string {
  const names: Record<string, string> = {
    kick: "Kick drum", snare: "Snare", hihat: "Hi-hats",
    bass: "Bass", synth: "Synthesizer", piano: "Piano",
    guitar: "Guitar", strings: "Strings", brass: "Brass",
  };
  return names[key] || key;
}

function isMajorKey(key: string | null): boolean | null {
  if (!key) return null;
  return !key.includes("m") || key.includes("maj");
}

/** Classify a track into subgenre suggestions based on BPM, key, instruments, beat pattern, and vocal presence */
export function classifySubgenres(input: AnalysisInput): SubgenreSuggestion[] {
  const results: Array<{ rule: ClassificationRule; score: number; reasons: string[] }> = [];

  for (const rule of RULES) {
    const reasons: string[] = [];
    let score = 0;
    let disqualify = false;

    // BPM check
    if (rule.bpmMin !== null && rule.bpmMax !== null && input.bpm !== null) {
      if (input.bpm >= rule.bpmMin && input.bpm <= rule.bpmMax) {
        score += 20;
        reasons.push(`BPM ${input.bpm} in range ${rule.bpmMin}-${rule.bpmMax}`);
      } else if (input.bpm >= rule.bpmMin * 0.85 && input.bpm <= rule.bpmMax * 1.15) {
        score += 8;
        reasons.push(`BPM ${input.bpm} near range ${rule.bpmMin}-${rule.bpmMax}`);
      } else {
        // BPM far out of range — not disqualified but low score
      }
    } else {
      score += 10; // no BPM constraint
    }

    // Beat pattern check
    if (rule.beatPatterns.length > 0) {
      if (input.beatPattern && rule.beatPatterns.includes(input.beatPattern)) {
        score += 25;
        reasons.push(`Beat pattern: ${input.beatPattern}`);
      } else if (input.beatPattern) {
        // Wrong beat pattern — heavy penalty
        score -= 10;
      }
    }

    // Required instruments
    let allRequired = true;
    for (const inst of rule.requiredInstruments) {
      const val = (input.instruments as any)[inst] || 0;
      if (val < 0.3) {
        allRequired = false;
        break;
      }
    }
    if (!allRequired) {
      disqualify = true;
    } else if (rule.requiredInstruments.length > 0) {
      score += rule.requiredInstruments.length * 8;
      reasons.push(`Instruments: ${rule.requiredInstruments.map(instrumentName).join(", ")}`);
    }

    // Forbidden instruments
    for (const inst of rule.forbiddenInstruments) {
      const val = (input.instruments as any)[inst] || 0;
      if (val > 0.3) {
        score -= 12;
        reasons.push(`Unexpected: ${instrumentName(inst)}`);
      }
    }

    // Vocal check
    if (rule.vocalRequired === true && !input.vocalPresence) {
      disqualify = true;
    } else if (rule.vocalRequired === false && input.vocalPresence) {
      disqualify = true;
    } else if (rule.vocalRequired === true && input.vocalPresence) {
      score += 10;
      reasons.push("Vocals present");
    } else if (rule.vocalRequired === false && !input.vocalPresence) {
      score += 10;
      reasons.push("Instrumental");
    }

    // Vocal gender hint
    if (rule.vocalGenderHint && input.vocalGender === rule.vocalGenderHint) {
      score += 5;
      reasons.push(`${rule.vocalGenderHint} vocals`);
    }

    // Energy check
    if (input.energy >= rule.energyMin && input.energy <= rule.energyMax) {
      score += 10;
    } else {
      const energyCenter = (rule.energyMin + rule.energyMax) / 2;
      const energyDist = Math.abs(input.energy - energyCenter);
      if (energyDist <= 3) score += 4;
    }

    // Key hint
    if (rule.keyHint) {
      const major = isMajorKey(input.key);
      if ((rule.keyHint === "major" && major === true) || (rule.keyHint === "minor" && major === false)) {
        score += 5;
        reasons.push(`${rule.keyHint} key`);
      }
    }

    // Bonus instruments
    for (const inst of rule.bonusInstruments) {
      const val = (input.instruments as any)[inst] || 0;
      if (val > 0.3) {
        score += 5;
        reasons.push(`Feature: ${instrumentName(inst)}`);
      }
    }

    if (!disqualify && score > 0) {
      results.push({ rule, score, reasons });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Normalize to confidence percentages, top 5
  const top = results.slice(0, 5);
  const maxScore = top.length > 0 ? Math.max(...top.map(r => r.score)) : 1;

  return top.map(r => ({
    subgenre: r.rule.subgenre,
    parentGenre: r.rule.parentGenre,
    confidence: Math.min(100, Math.round((r.score / Math.max(maxScore, 30)) * 100)),
    reasons: r.reasons,
  }));
}

/** Get metadata about a subgenre for display */
export function getSubgenreInfo(subgenreName: string): {
  description: string;
  typicalBpm: string;
  parentGenre: string;
} | null {
  const rule = RULES.find(r => r.subgenre === subgenreName);
  if (!rule) return null;
  return {
    description: rule.description,
    typicalBpm: rule.bpmMin && rule.bpmMax ? `${rule.bpmMin}-${rule.bpmMax}` : "Variable",
    parentGenre: rule.parentGenre,
  };
}

/** Apply user feedback — adjust future classifications */
// Stored in-memory for the session; in production, store in DB
const userFeedback: Map<string, { upvotes: number; downvotes: number }> = new Map();

export function recordSubgenreFeedback(subgenre: string, accepted: boolean): void {
  const current = userFeedback.get(subgenre) || { upvotes: 0, downvotes: 0 };
  if (accepted) {
    current.upvotes++;
  } else {
    current.downvotes++;
  }
  userFeedback.set(subgenre, current);
}

export function getSubgenreFeedbackStats(): Array<{
  subgenre: string;
  upvotes: number;
  downvotes: number;
  acceptanceRate: number;
}> {
  const results: Array<{ subgenre: string; upvotes: number; downvotes: number; acceptanceRate: number }> = [];
  for (const [subgenre, stats] of userFeedback) {
    const total = stats.upvotes + stats.downvotes;
    results.push({
      subgenre,
      upvotes: stats.upvotes,
      downvotes: stats.downvotes,
      acceptanceRate: total > 0 ? Math.round((stats.upvotes / total) * 100) : 0,
    });
  }
  return results;
}
