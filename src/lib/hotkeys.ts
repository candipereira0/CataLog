/**
 * Hotkey definitions for CataLog — global DJ performance shortcuts.
 * These are the default bindings. Users can customize them in Settings.
 */

export interface HotkeyBinding {
  /** The physical key value (from KeyboardEvent.key) */
  key: string;
  /** Human-readable action description */
  action: string;
  /** Category for grouping in Settings UI */
  category: "playback" | "loop" | "cue" | "volume" | "navigation" | "system";
}

export const DEFAULT_HOTKEYS: HotkeyBinding[] = [
  // ─── Playback ───
  { key: " ", action: "Play / Pause", category: "playback" },
  { key: "ArrowLeft", action: "Seek backward 5s", category: "playback" },
  { key: "ArrowRight", action: "Seek forward 5s", category: "playback" },

  // ─── Navigation ───
  { key: "n", action: "Next track", category: "navigation" },
  { key: "p", action: "Previous track", category: "navigation" },

  // ─── Loop ───
  { key: "l", action: "Toggle loop", category: "loop" },
  { key: "1", action: "Set loop to 1 bar", category: "loop" },
  { key: "2", action: "Set loop to 2 bars", category: "loop" },
  { key: "4", action: "Set loop to 4 bars", category: "loop" },
  { key: "8", action: "Set loop to 8 bars", category: "loop" },

  // ─── Cue ───
  { key: "c", action: "Set cue point", category: "cue" },
  { key: "0", action: "Jump to cue 0", category: "cue" },
  { key: "3", action: "Jump to cue 3", category: "cue" },
  { key: "5", action: "Jump to cue 5", category: "cue" },
  { key: "6", action: "Jump to cue 6", category: "cue" },
  { key: "7", action: "Jump to cue 7", category: "cue" },
  { key: "9", action: "Jump to cue 9", category: "cue" },

  // ─── Volume ───
  { key: "[", action: "Decrease volume 5%", category: "volume" },
  { key: "]", action: "Increase volume 5%", category: "volume" },
  { key: "m", action: "Mute / Unmute", category: "volume" },

  // ─── System / Navigation ───
  { key: "t", action: "Tap BPM", category: "system" },
  { key: "f", action: "Toggle Gig Night mode", category: "system" },
  { key: "g", action: "Toggle Gig Night mode", category: "system" },
  { key: "Escape", action: "Close modals / Exit gig mode", category: "system" },
  { key: "s", action: "Toggle Shazam modal", category: "system" },
  { key: "/", action: "Focus search bar", category: "system" },
];

/**
 * Map from action string → default key.
 * Used to look up what key was originally assigned to an action.
 */
export function getDefaultKeyMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const hk of DEFAULT_HOTKEYS) {
    // Only set the first occurrence (skip duplicates like F/G for Gig Night)
    if (!map[hk.action]) {
      map[hk.action] = hk.key;
    }
  }
  return map;
}

/**
 * Storage key for custom hotkey bindings in localStorage.
 */
export const HOTKEY_STORAGE_KEY = "catalog-hotkey-bindings";

/**
 * Load custom bindings from localStorage.
 * Returns a record mapping action → key.
 */
export function loadCustomBindings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(HOTKEY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as Record<string, string>;
      }
    }
  } catch {}
  return {};
}

/**
 * Save custom bindings to localStorage.
 */
export function saveCustomBindings(bindings: Record<string, string>): void {
  try {
    localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(bindings));
  } catch {}
}

/**
 * Given custom bindings and defaults, resolve the effective key for each action.
 */
export function resolveBindings(
  custom: Record<string, string>
): Record<string, string> {
  const defaults = getDefaultKeyMap();
  const merged: Record<string, string> = { ...defaults };
  for (const [action, key] of Object.entries(custom)) {
    if (key && key.trim()) {
      merged[action] = key;
    }
  }
  return merged;
}
