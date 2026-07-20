// Camelot Wheel utilities for harmonic mixing
// Wheel: 1A–12A (minor), 1B–12B (major), wraps around 12→1

const STANDARD_TO_CAMELOT: Record<string, string> = {
  "Abm": "1A", "B": "1B",
  "Ebm": "2A", "F#": "2B",
  "Bbm": "3A", "Db": "3B",
  "Fm": "4A", "Ab": "4B",
  "Cm": "5A", "Eb": "5B",
  "Gm": "6A", "Bb": "6B",
  "Dm": "7A", "F": "7B",
  "Am": "8A", "C": "8B",
  "Em": "9A", "G": "9B",
  "Bm": "10A", "D": "10B",
  "F#m": "11A", "A": "11B",
  "Dbm": "12A", "E": "12B",
  // Enharmonic equivalents
  "G#m": "1A",
  "D#m": "2A", "Gb": "2B",
  "A#m": "3A", "C#": "3B",
  "G#": "4B",
  "C#m": "12A",
  "F#": "2B",
};

const CAMELOT_TO_STANDARD: Record<string, string> = {};
for (const [standard, camelot] of Object.entries(STANDARD_TO_CAMELOT)) {
  if (!CAMELOT_TO_STANDARD[camelot]) {
    CAMELOT_TO_STANDARD[camelot] = standard;
  }
}

export function toCamelot(key: string | null | undefined): string | null {
  if (!key) return null;
  const trimmed = key.trim();

  // Already Camelot notation (e.g., "1A", "12B")
  const camelotMatch = trimmed.match(/^(\d{1,2})([AB])$/i);
  if (camelotMatch) {
    const num = parseInt(camelotMatch[1]);
    const letter = camelotMatch[2].toUpperCase();
    if (num >= 1 && num <= 12) return `${num}${letter}`;
    return null;
  }

  // Try standard notation
  return STANDARD_TO_CAMELOT[trimmed] || null;
}

function parseCamelot(key: string): { num: number; letter: "A" | "B" } | null {
  const match = key.trim().match(/^(\d{1,2})([AB])$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  if (num < 1 || num > 12) return null;
  return { num, letter: match[2].toUpperCase() as "A" | "B" };
}

function wrapNum(n: number): number {
  return ((n - 1 + 12) % 12) + 1;
}

/**
 * Returns all Camelot keys compatible with the given key:
 * - Same key (+0)
 * - +1 on the wheel
 * - -1 on the wheel
 * - Relative major/minor (same number, opposite letter)
 */
export function getCompatibleKeys(key: string): string[] {
  const camelot = toCamelot(key);
  if (!camelot) return [];

  const parsed = parseCamelot(camelot);
  if (!parsed) return [];

  const { num, letter } = parsed;
  const oppositeLetter = letter === "A" ? "B" : "A";

  const compatible = [
    `${num}${letter}`,           // same
    `${wrapNum(num + 1)}${letter}`,  // +1
    `${wrapNum(num - 1)}${letter}`,  // -1
    `${num}${oppositeLetter}`,   // relative major/minor
  ];

  return [...new Set(compatible)];
}

/**
 * Returns the harmonic distance on the Camelot wheel (0-6).
 * 0 = same key, 1 = adjacent, 2 = two steps, etc.
 * 6 = opposite side of the wheel (worst compatibility).
 */
export function getKeyDistance(key1: string, key2: string): number {
  const c1 = toCamelot(key1);
  const c2 = toCamelot(key2);
  if (!c1 || !c2) return 6;

  const p1 = parseCamelot(c1);
  const p2 = parseCamelot(c2);
  if (!p1 || !p2) return 6;

  // Same key = distance 0
  if (p1.num === p2.num && p1.letter === p2.letter) return 0;

  // Relative major/minor = distance 1
  if (p1.num === p2.num && p1.letter !== p2.letter) return 1;

  // Adjacent on same side (+1 or -1) = distance 1
  if (p1.letter === p2.letter) {
    const diff = Math.abs(p1.num - p2.num);
    if (diff === 1 || diff === 11) return 1; // 11 means wrap: 12→1
  }

  // Compute shortest distance on wheel (treating A/B as separate rings)
  // This is a simplified distance measure
  const ringDist = Math.min(
    Math.abs(p1.num - p2.num),
    12 - Math.abs(p1.num - p2.num)
  );

  if (p1.letter === p2.letter) {
    return Math.min(ringDist, 6);
  }

  // Different letters: add 1 for crossing rings
  return Math.min(ringDist + 1, 6);
}

/**
 * Convert a Camelot key back to standard notation.
 */
export function camelotToStandard(camelotKey: string): string | null {
  const trimmed = camelotKey.trim().toUpperCase();
  return CAMELOT_TO_STANDARD[trimmed] || null;
}

/**
 * Estimate energy level from BPM.
 * Returns 1-10, defaulting to 5 if no BPM available.
 */
export function estimateEnergy(bpm: number | null | undefined): number {
  if (!bpm) return 5;
  if (bpm < 60) return 1;
  if (bpm < 80) return 2;
  if (bpm < 100) return 3;
  if (bpm < 110) return 4;
  if (bpm < 120) return 5;
  if (bpm < 130) return 6;
  if (bpm < 140) return 7;
  if (bpm < 155) return 8;
  if (bpm < 170) return 9;
  return 10;
}
