export interface BackdropPreset {
  id: string;
  label: string;
  style: React.CSSProperties;
  description: string;
}

export const GENRE_PRESETS: BackdropPreset[] = [
  {
    id: "techno-industrial",
    label: "Techno / Industrial",
    description: "Dark mechanical grid pattern",
    style: {
      background: `
        linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%),
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(200, 50, 50, 0.08) 2px,
          rgba(200, 50, 50, 0.08) 4px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 2px,
          rgba(200, 50, 50, 0.05) 2px,
          rgba(200, 50, 50, 0.05) 4px
        )
      `,
      backgroundColor: "#0a0a0f",
    },
  },
  {
    id: "house-warm",
    label: "House / Warm",
    description: "Warm orange-red gradient",
    style: {
      background: `
        radial-gradient(ellipse at 30% 50%, rgba(255, 120, 40, 0.25) 0%, transparent 60%),
        radial-gradient(ellipse at 70% 50%, rgba(255, 60, 30, 0.20) 0%, transparent 60%),
        linear-gradient(180deg, #1a0a05 0%, #2d1408 30%, #1f0c04 60%, #0d0502 100%)
      `,
      backgroundColor: "#1a0a05",
    },
  },
  {
    id: "hiphop-urban",
    label: "Hip-Hop / Urban",
    description: "Dark purple with gold accents",
    style: {
      background: `
        radial-gradient(circle at 20% 80%, rgba(218, 165, 32, 0.12) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(138, 43, 226, 0.20) 0%, transparent 50%),
        linear-gradient(160deg, #0d0015 0%, #1a0a2e 40%, #0f0520 70%, #0a0010 100%)
      `,
      backgroundColor: "#0d0015",
    },
  },
  {
    id: "trance-ethereal",
    label: "Trance / Ethereal",
    description: "Blue-purple cosmic gradient",
    style: {
      background: `
        radial-gradient(ellipse at 50% 30%, rgba(100, 180, 255, 0.20) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 70%, rgba(160, 80, 255, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 60%, rgba(80, 200, 255, 0.12) 0%, transparent 50%),
        linear-gradient(180deg, #050520 0%, #0a1040 30%, #061030 60%, #030818 100%)
      `,
      backgroundColor: "#050520",
    },
  },
  {
    id: "dnb-energetic",
    label: "Drum & Bass / Energetic",
    description: "Fast-cycling green-blue",
    style: {
      background: `
        repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 10px,
          rgba(0, 255, 136, 0.04) 10px,
          rgba(0, 255, 136, 0.04) 20px
        ),
        radial-gradient(ellipse at 30% 50%, rgba(0, 200, 100, 0.18) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 30%, rgba(0, 180, 220, 0.15) 0%, transparent 50%),
        linear-gradient(180deg, #001510 0%, #002820 40%, #001a12 70%, #000a08 100%)
      `,
      backgroundColor: "#001510",
    },
  },
  {
    id: "lofi-chill",
    label: "Lo-Fi / Chill",
    description: "Warm sunset pastels",
    style: {
      background: `
        radial-gradient(ellipse at 50% 90%, rgba(255, 180, 140, 0.22) 0%, transparent 50%),
        radial-gradient(ellipse at 30% 40%, rgba(255, 140, 180, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 30%, rgba(180, 160, 255, 0.12) 0%, transparent 50%),
        linear-gradient(180deg, #1a1218 0%, #2a1a20 30%, #1f1418 60%, #120e12 100%)
      `,
      backgroundColor: "#1a1218",
    },
  },
];

export const CUSTOM_UPLOAD_PRESET: BackdropPreset = {
  id: "custom-upload",
  label: "Custom Upload",
  description: "Your own image",
  style: {},
};

export const CUSTOM_URL_PRESET: BackdropPreset = {
  id: "custom-url",
  label: "Custom URL",
  description: "Image from URL",
  style: {},
};

export function getBackdropById(id: string): BackdropPreset | undefined {
  if (id === "custom-upload" || id === "custom-url") return undefined;
  return GENRE_PRESETS.find((p) => p.id === id);
}

export function getBackdropLabel(id: string): string {
  const preset = GENRE_PRESETS.find((p) => p.id === id);
  if (preset) return preset.label;
  if (id === "custom-upload") return "Custom Upload";
  if (id === "custom-url") return "Custom URL";
  return "Unknown";
}

// Map genres/tags to preset IDs with fuzzy matching
export function mapGenreToPreset(genre: string | null | undefined): string {
  if (!genre) return "house-warm";
  const g = genre.toLowerCase();
  if (g.includes("techno") || g.includes("industrial") || g.includes("hard")) return "techno-industrial";
  if (g.includes("house") || g.includes("disco") || g.includes("funk") || g.includes("soulful")) return "house-warm";
  if (g.includes("hip") || g.includes("rap") || g.includes("rnb") || g.includes("trap") || g.includes("urban")) return "hiphop-urban";
  if (g.includes("trance") || g.includes("ambient") || g.includes("progressive") || g.includes("ethereal")) return "trance-ethereal";
  if (g.includes("drum") || g.includes("bass") || g.includes("dnb") || g.includes("jungle") || g.includes("break")) return "dnb-energetic";
  if (g.includes("lo-fi") || g.includes("lofi") || g.includes("chill") || g.includes("downtempo")) return "lofi-chill";
  return "house-warm";
}

// Mood-based color for overlay
export function getMoodColor(genre: string | null | undefined): string {
  if (!genre) return "rgba(124, 58, 237, 0.15)";
  const g = genre.toLowerCase();
  if (g.includes("techno") || g.includes("industrial")) return "rgba(200, 50, 50, 0.15)";
  if (g.includes("house") || g.includes("disco")) return "rgba(255, 140, 40, 0.15)";
  if (g.includes("hip") || g.includes("rap") || g.includes("trap")) return "rgba(218, 165, 32, 0.15)";
  if (g.includes("trance") || g.includes("ambient")) return "rgba(100, 180, 255, 0.15)";
  if (g.includes("drum") || g.includes("bass") || g.includes("dnb")) return "rgba(0, 200, 100, 0.15)";
  if (g.includes("lo-fi") || g.includes("lofi") || g.includes("chill")) return "rgba(255, 180, 140, 0.15)";
  return "rgba(124, 58, 237, 0.15)";
}
