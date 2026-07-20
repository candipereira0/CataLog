import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type ThemeVars,
  type ThemePreset,
  THEME_PRESETS,
  getPreset,
} from "../lib/themes";

type ThemeMode = "dark" | "light";
type PresetName = string | null;

interface ThemeContextType {
  mode: ThemeMode;
  preset: PresetName;
  resolvedTheme: ThemeVars;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: PresetName) => void;
  toggleMode: () => void;
  resetToDefault: () => void;
}

const STORAGE_KEY_MODE = "catalog-theme-mode";
const STORAGE_KEY_PRESET = "catalog-theme-preset";

const ThemeContext = createContext<ThemeContextType | null>(null);

/** Apply a ThemeVars object as CSS custom properties on :root */
function applyVars(vars: ThemeVars): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MODE);
      if (stored === "dark" || stored === "light") return stored;
    } catch {}
    // Default to dark
    return "dark";
  });

  const [preset, setPresetState] = useState<PresetName>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PRESET);
      if (stored && THEME_PRESETS.some((p) => p.name === stored)) return stored;
    } catch {}
    return null;
  });

  // Compute the resolved theme vars
  const resolvedTheme = computeResolvedTheme(mode, preset);

  // Apply on mount and when mode/preset changes
  useEffect(() => {
    applyVars(resolvedTheme);
    document.documentElement.setAttribute("data-theme", mode);
  }, [resolvedTheme, mode]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch {}
  }, [mode]);

  useEffect(() => {
    try {
      if (preset) {
        localStorage.setItem(STORAGE_KEY_PRESET, preset);
      } else {
        localStorage.removeItem(STORAGE_KEY_PRESET);
      }
    } catch {}
  }, [preset]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
  }, []);

  const setPreset = useCallback((newPreset: PresetName) => {
    setPresetState(newPreset);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const resetToDefault = useCallback(() => {
    setModeState("dark");
    setPresetState(null);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        preset,
        resolvedTheme,
        setMode,
        setPreset,
        toggleMode,
        resetToDefault,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

/** Compute the final ThemeVars based on mode + preset */
function computeResolvedTheme(
  mode: ThemeMode,
  presetName: PresetName
): ThemeVars {
  if (presetName) {
    const p = getPreset(presetName);
    if (p) {
      return mode === "dark" ? { ...p.dark } : { ...p.light };
    }
  }

  // Fall back to default CataLog themes
  const defaultPreset = getPreset("catalog-dark")!;
  return mode === "dark" ? { ...defaultPreset.dark } : { ...defaultPreset.light };
}
