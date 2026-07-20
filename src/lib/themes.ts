export interface ThemePreset {
  name: string;
  label: string;
  description: string;
  /** Swatch colors for the picker preview (3 circles) */
  swatches: [string, string, string];
  /** Light mode overrides */
  light: ThemeVars;
  /** Dark mode overrides */
  dark: ThemeVars;
}

export interface ThemeVars {
  "--color-accent": string;
  "--color-accent-hover": string;
  "--color-accent-20": string;
  "--color-bg-primary": string;
  "--color-bg-secondary": string;
  "--color-bg-card": string;
  "--color-text-primary": string;
  "--color-text-secondary": string;
  "--color-text-muted": string;
  "--color-border": string;
  "--color-border-hover": string;
}

/** Default dark theme (CataLog Dark) — matches existing Tailwind gray-950 palette */
const DEFAULT_DARK: ThemeVars = {
  "--color-accent": "#7c3aed",
  "--color-accent-hover": "#6d28d9",
  "--color-accent-20": "rgba(124, 58, 237, 0.2)",
  "--color-bg-primary": "#030712",
  "--color-bg-secondary": "#1f2937",
  "--color-bg-card": "#111827",
  "--color-text-primary": "#f3f4f6",
  "--color-text-secondary": "#9ca3af",
  "--color-text-muted": "#6b7280",
  "--color-border": "#374151",
  "--color-border-hover": "#4b5563",
};

/** Default light theme (CataLog Light) */
const DEFAULT_LIGHT: ThemeVars = {
  "--color-accent": "#7c3aed",
  "--color-accent-hover": "#6d28d9",
  "--color-accent-20": "rgba(124, 58, 237, 0.15)",
  "--color-bg-primary": "#ffffff",
  "--color-bg-secondary": "#f3f4f6",
  "--color-bg-card": "#f9fafb",
  "--color-text-primary": "#111827",
  "--color-text-secondary": "#4b5563",
  "--color-text-muted": "#9ca3af",
  "--color-border": "#e5e7eb",
  "--color-border-hover": "#d1d5db",
};

/** Pink theme */
const PINK_DARK: ThemeVars = {
  "--color-accent": "#ec4899",
  "--color-accent-hover": "#db2777",
  "--color-accent-20": "rgba(236, 72, 153, 0.2)",
  "--color-bg-primary": "#0f0a0e",
  "--color-bg-secondary": "#1f1820",
  "--color-bg-card": "#181118",
  "--color-text-primary": "#fce7f3",
  "--color-text-secondary": "#f9a8d4",
  "--color-text-muted": "#9d6b85",
  "--color-border": "#3d2a38",
  "--color-border-hover": "#5c3f55",
};

const PINK_LIGHT: ThemeVars = {
  "--color-accent": "#ec4899",
  "--color-accent-hover": "#db2777",
  "--color-accent-20": "rgba(236, 72, 153, 0.15)",
  "--color-bg-primary": "#fef6fa",
  "--color-bg-secondary": "#fce7f3",
  "--color-bg-card": "#fdf2f8",
  "--color-text-primary": "#4a1942",
  "--color-text-secondary": "#9d6b85",
  "--color-text-muted": "#c084a8",
  "--color-border": "#f0c6dd",
  "--color-border-hover": "#e5a4c8",
};

/** Coquette theme */
const COQUETTE_DARK: ThemeVars = {
  "--color-accent": "#f9a8d4",
  "--color-accent-hover": "#f472b6",
  "--color-accent-20": "rgba(249, 168, 212, 0.2)",
  "--color-bg-primary": "#120c10",
  "--color-bg-secondary": "#1f1620",
  "--color-bg-card": "#181118",
  "--color-text-primary": "#fdf2f8",
  "--color-text-secondary": "#f9a8d4",
  "--color-text-muted": "#b88a9e",
  "--color-border": "#3d2d38",
  "--color-border-hover": "#5c4455",
};

const COQUETTE_LIGHT: ThemeVars = {
  "--color-accent": "#db2777",
  "--color-accent-hover": "#be185d",
  "--color-accent-20": "rgba(219, 39, 119, 0.12)",
  "--color-bg-primary": "#fffafc",
  "--color-bg-secondary": "#fef2f7",
  "--color-bg-card": "#fdf2f8",
  "--color-text-primary": "#3d1a30",
  "--color-text-secondary": "#b88a9e",
  "--color-text-muted": "#d4a8be",
  "--color-border": "#f0c6dd",
  "--color-border-hover": "#e5a4c8",
};

/** Aesthetic (vaporwave-inspired) */
const AESTHETIC_DARK: ThemeVars = {
  "--color-accent": "#06b6d4",
  "--color-accent-hover": "#0891b2",
  "--color-accent-20": "rgba(6, 182, 212, 0.2)",
  "--color-bg-primary": "#0a1014",
  "--color-bg-secondary": "#131f2a",
  "--color-bg-card": "#0e1820",
  "--color-text-primary": "#cffafe",
  "--color-text-secondary": "#67e8f9",
  "--color-text-muted": "#5e8a9e",
  "--color-border": "#1e3a4a",
  "--color-border-hover": "#2d566b",
};

const AESTHETIC_LIGHT: ThemeVars = {
  "--color-accent": "#06b6d4",
  "--color-accent-hover": "#0891b2",
  "--color-accent-20": "rgba(6, 182, 212, 0.12)",
  "--color-bg-primary": "#f0fafa",
  "--color-bg-secondary": "#e0f5f9",
  "--color-bg-card": "#ecfeff",
  "--color-text-primary": "#164e63",
  "--color-text-secondary": "#0e7490",
  "--color-text-muted": "#67a8b8",
  "--color-border": "#c5e8f0",
  "--color-border-hover": "#a5dbe8",
};

/** Grunge */
const GRUNGE_DARK: ThemeVars = {
  "--color-accent": "#b45309",
  "--color-accent-hover": "#92400e",
  "--color-accent-20": "rgba(180, 83, 9, 0.2)",
  "--color-bg-primary": "#120d08",
  "--color-bg-secondary": "#1f180f",
  "--color-bg-card": "#18120a",
  "--color-text-primary": "#fef3c7",
  "--color-text-secondary": "#fcd34d",
  "--color-text-muted": "#a68a56",
  "--color-border": "#3d2f1a",
  "--color-border-hover": "#5c4728",
};

const GRUNGE_LIGHT: ThemeVars = {
  "--color-accent": "#b45309",
  "--color-accent-hover": "#92400e",
  "--color-accent-20": "rgba(180, 83, 9, 0.1)",
  "--color-bg-primary": "#fefbf5",
  "--color-bg-secondary": "#fef3c7",
  "--color-bg-card": "#fffbeb",
  "--color-text-primary": "#431407",
  "--color-text-secondary": "#a68a56",
  "--color-text-muted": "#c4a87a",
  "--color-border": "#e8d5a3",
  "--color-border-hover": "#d4bc7e",
};

/** Midnight */
const MIDNIGHT_DARK: ThemeVars = {
  "--color-accent": "#3b82f6",
  "--color-accent-hover": "#2563eb",
  "--color-accent-20": "rgba(59, 130, 246, 0.2)",
  "--color-bg-primary": "#070b18",
  "--color-bg-secondary": "#111c36",
  "--color-bg-card": "#0c1428",
  "--color-text-primary": "#dbeafe",
  "--color-text-secondary": "#93bbfd",
  "--color-text-muted": "#5b7aaa",
  "--color-border": "#1e3058",
  "--color-border-hover": "#2d4880",
};

const MIDNIGHT_LIGHT: ThemeVars = {
  "--color-accent": "#3b82f6",
  "--color-accent-hover": "#2563eb",
  "--color-accent-20": "rgba(59, 130, 246, 0.12)",
  "--color-bg-primary": "#f5f8fe",
  "--color-bg-secondary": "#e8effd",
  "--color-bg-card": "#eff6ff",
  "--color-text-primary": "#1e3a5f",
  "--color-text-secondary": "#3b6cb4",
  "--color-text-muted": "#7b9ec4",
  "--color-border": "#c5d5f0",
  "--color-border-hover": "#a0bde0",
};

/** Forest */
const FOREST_DARK: ThemeVars = {
  "--color-accent": "#10b981",
  "--color-accent-hover": "#059669",
  "--color-accent-20": "rgba(16, 185, 129, 0.2)",
  "--color-bg-primary": "#080f0a",
  "--color-bg-secondary": "#121f16",
  "--color-bg-card": "#0d1810",
  "--color-text-primary": "#d1fae5",
  "--color-text-secondary": "#6ee7b7",
  "--color-text-muted": "#4d8c6e",
  "--color-border": "#1e3a2a",
  "--color-border-hover": "#2d5640",
};

const FOREST_LIGHT: ThemeVars = {
  "--color-accent": "#10b981",
  "--color-accent-hover": "#059669",
  "--color-accent-20": "rgba(16, 185, 129, 0.12)",
  "--color-bg-primary": "#f6fdf8",
  "--color-bg-secondary": "#e6f7ee",
  "--color-bg-card": "#ecfdf5",
  "--color-text-primary": "#064e3b",
  "--color-text-secondary": "#287d5e",
  "--color-text-muted": "#6ba88e",
  "--color-border": "#c0e8d4",
  "--color-border-hover": "#9ddcc0",
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: "catalog-dark",
    label: "CataLog Dark",
    description: "Default violet-on-dark palette",
    swatches: ["#7c3aed", "#030712", "#111827"],
    dark: DEFAULT_DARK,
    light: DEFAULT_LIGHT,
  },
  {
    name: "catalog-light",
    label: "CataLog Light",
    description: "Clean white/violet palette",
    swatches: ["#7c3aed", "#ffffff", "#f3f4f6"],
    dark: DEFAULT_DARK, // when toggled to dark, use default dark
    light: DEFAULT_LIGHT,
  },
  {
    name: "pink",
    label: "Pink",
    description: "Bold pink with warm undertones",
    swatches: ["#ec4899", "#0f0a0e", "#fef6fa"],
    dark: PINK_DARK,
    light: PINK_LIGHT,
  },
  {
    name: "coquette",
    label: "Coquette",
    description: "Soft rose and cream, delicate",
    swatches: ["#f9a8d4", "#120c10", "#fffafc"],
    dark: COQUETTE_DARK,
    light: COQUETTE_LIGHT,
  },
  {
    name: "aesthetic",
    label: "Aesthetic",
    description: "Teal/cyan vaporwave vibes",
    swatches: ["#06b6d4", "#0a1014", "#f0fafa"],
    dark: AESTHETIC_DARK,
    light: AESTHETIC_LIGHT,
  },
  {
    name: "grunge",
    label: "Grunge",
    description: "Earthy amber, rough textures",
    swatches: ["#b45309", "#120d08", "#fefbf5"],
    dark: GRUNGE_DARK,
    light: GRUNGE_LIGHT,
  },
  {
    name: "midnight",
    label: "Midnight",
    description: "Deep blue, minimal and clean",
    swatches: ["#3b82f6", "#070b18", "#f5f8fe"],
    dark: MIDNIGHT_DARK,
    light: MIDNIGHT_LIGHT,
  },
  {
    name: "forest",
    label: "Forest",
    description: "Emerald green, earthy tones",
    swatches: ["#10b981", "#080f0a", "#f6fdf8"],
    dark: FOREST_DARK,
    light: FOREST_LIGHT,
  },
];

/** Look up a preset by name */
export function getPreset(name: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.name === name);
}

/** Get the default dark theme vars */
export function getDefaultDark(): ThemeVars {
  return DEFAULT_DARK;
}

/** Get the default light theme vars */
export function getDefaultLight(): ThemeVars {
  return DEFAULT_LIGHT;
}
