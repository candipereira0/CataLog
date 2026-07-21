import { useState, useCallback } from "react";
import { usePlayer } from "../contexts/PlayerContext";
import { api } from "../lib/api";

interface DiscoveredArtist {
  name: string;
  genres: string[];
  similarity: number;
  reason: string;
}

interface DiscoverResult {
  artist: string;
  related: DiscoveredArtist[];
}

// Color palette for genre groups
const GENRE_COLORS: Record<string, string> = {
  "french house": "#8b5cf6",
  "electro": "#f59e0b",
  "synthwave": "#ec4899",
  "industrial techno": "#6b7280",
  "electro house": "#f97316",
  "nu disco": "#10b981",
  "dance": "#06b6d4",
  "disco": "#84cc16",
  "experimental electro": "#a855f7",
  "electronic": "#6366f1",
  "progressive house": "#3b82f6",
  "tech house": "#14b8a6",
  "complextro": "#f43f5e",
  "dubstep": "#8b5cf6",
  "idm": "#a78bfa",
  "ambient": "#22d3ee",
  "drum and bass": "#ef4444",
  "experimental": "#c084fc",
  "breakbeat": "#fb923c",
  "downtempo": "#2dd4bf",
  "post-dubstep": "#64748b",
  "uk garage": "#fbbf24",
  "soul": "#f472b6",
  "indie": "#a3e635",
  "alternative": "#e879f9",
  "future bass": "#38bdf8",
  "trap": "#fb7185",
  "chillwave": "#818cf8",
  "deep house": "#2dd4bf",
  "techno": "#6b7280",
  "minimal": "#d4d4d8",
  "minimal techno": "#9ca3af",
  "big beat": "#eab308",
  "house": "#f59e0b",
  "reggaeton": "#ef4444",
  "latin pop": "#ec4899",
  "latin trap": "#f97316",
  "latin": "#dc2626",
  "acid": "#a3e635",
  "peak time": "#f43f5e",
  "trip-hop": "#818cf8",
  "folktronica": "#34d399",
};

// SVG visualization component
function ArtistMap({
  centerArtist,
  related,
  selectedArtist,
  onSelect,
}: {
  centerArtist: string;
  related: DiscoveredArtist[];
  selectedArtist: DiscoveredArtist | null;
  onSelect: (a: DiscoveredArtist) => void;
}) {
  const svgW = 700;
  const svgH = 550;
  const cx = svgW / 2;
  const cy = svgH / 2 + 20;
  const maxRadius = Math.min(svgW, svgH) * 0.38;

  // Sort by similarity descending
  const sorted = [...related].sort((a, b) => b.similarity - a.similarity);

  // Calculate positions — closer = higher similarity = closer to center
  const nodes = sorted.map((artist, i) => {
    // Higher similarity → closer to center (smaller radius)
    const distRatio = 0.35 + (1 - artist.similarity / 100) * 0.65;
    const radius = maxRadius * distRatio;

    // Spread evenly around the circle with some jitter
    const angleCount = sorted.length;
    const baseAngle = (i / angleCount) * Math.PI * 2 - Math.PI / 2;
    const jitter = (Math.sin(i * 2.7) * 0.2); // small deterministic jitter
    const angle = baseAngle + jitter;

    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    // Node size proportional to similarity
    const nodeR = 20 + (artist.similarity / 100) * 22;

    // Color based on primary genre
    const primaryGenre = artist.genres[0]?.toLowerCase() || "";
    let color = "#6366f1";
    for (const [key, c] of Object.entries(GENRE_COLORS)) {
      if (primaryGenre.includes(key) || key.includes(primaryGenre)) {
        color = c;
        break;
      }
    }

    return { artist, x, y, nodeR, color, distRatio };
  });

  // Center node
  const centerR = 35;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="h-full w-full"
      style={{ maxHeight: "65vh" }}
    >
      {/* Connection lines */}
      {nodes.map((node) => {
        const dx = node.x - cx;
        const dy = node.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / dist;
        const uy = dy / dist;

        return (
          <line
            key={`line-${node.artist.name}`}
            x1={cx + ux * centerR}
            y1={cy + uy * centerR}
            x2={node.x - ux * node.nodeR}
            y2={node.y - uy * node.nodeR}
            stroke={node.color}
            strokeOpacity={0.2 + (node.artist.similarity / 100) * 0.4}
            strokeWidth={1 + (node.artist.similarity / 100) * 2}
          />
        );
      })}

      {/* Center node */}
      <circle cx={cx} cy={cy} r={centerR} fill="#8b5cf6" stroke="#a78bfa" strokeWidth={3} className="cursor-pointer" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white text-sm font-bold"
        style={{ fontSize: "13px" }}
      >
        {centerArtist.length > 12 ? centerArtist.slice(0, 11) + "…" : centerArtist}
      </text>

      {/* Glow for center */}
      <circle cx={cx} cy={cy} r={centerR + 8} fill="none" stroke="#8b5cf6" strokeWidth={2} strokeOpacity={0.4}>
        <animate attributeName="r" from={centerR + 8} to={centerR + 16} dur="2s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" from={0.4} to={0} dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Surrounding nodes */}
      {nodes.map((node) => {
        const isSelected = selectedArtist?.name === node.artist.name;
        const name = node.artist.name.length > 14
          ? node.artist.name.slice(0, 13) + "…"
          : node.artist.name;

        return (
          <g
            key={node.artist.name}
            className="cursor-pointer transition-transform hover:scale-110"
            style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            onClick={() => onSelect(node.artist)}
          >
            {/* Outer ring when selected */}
            {isSelected && (
              <circle cx={node.x} cy={node.y} r={node.nodeR + 6} fill="none" stroke="#a78bfa" strokeWidth={2} />
            )}

            <circle
              cx={node.x}
              cy={node.y}
              r={node.nodeR}
              fill={node.color}
              fillOpacity={isSelected ? 1 : 0.85}
              stroke={isSelected ? "#fff" : node.color}
              strokeWidth={isSelected ? 2 : 1}
              strokeOpacity={isSelected ? 0.8 : 0.3}
            />

            {/* Similarity label */}
            <text
              x={node.x}
              y={node.y - 3}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white font-bold"
              style={{ fontSize: "12px" }}
            >
              {node.artist.similarity}
            </text>
            <text
              x={node.x}
              y={node.y + 10}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white/70"
              style={{ fontSize: "9px" }}
            >
              %
            </text>

            {/* Artist name below node */}
            <text
              x={node.x}
              y={node.y + node.nodeR + 16}
              textAnchor="middle"
              className="fill-gray-300"
              style={{ fontSize: "11px", fontWeight: isSelected ? 600 : 400 }}
            >
              {name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Discover() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<DiscoveredArtist | null>(null);

  const { openPlayer } = usePlayer();

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setSelectedArtist(null);

    try {
      const res = await api.discoverArtists(q);
      setResult(res);
    } catch (err) {
      setError((err as Error).message || "Discovery failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handlePreview = useCallback(() => {
    if (!selectedArtist) return;

    // Determine demo type from genres
    let demoType: "bass" | "pad" | "lead" | "beat" = "lead";
    const genres = selectedArtist.genres.map(g => g.toLowerCase()).join(" ");
    if (genres.includes("techno") || genres.includes("bass") || genres.includes("dark")) {
      demoType = "bass";
    } else if (genres.includes("ambient") || genres.includes("downtempo") || genres.includes("chill")) {
      demoType = "pad";
    } else if (genres.includes("beat") || genres.includes("drum") || genres.includes("groove")) {
      demoType = "beat";
    }

    openPlayer({
      title: selectedArtist.name,
      artist: selectedArtist.genres.slice(0, 2).join(", "),
    });

    // Trigger demo playback via a small trick — we'll use the player's playDemo
    // Actually the openPlayer doesn't auto-play by design. Let's just open and user clicks play.
    // But better to auto-play: use a timeout to let the state settle
    setTimeout(() => {
      const btn = document.querySelector('[aria-label="Play"]') as HTMLButtonElement;
      if (btn) btn.click();
    }, 100);
  }, [selectedArtist, openPlayer]);

  return (
    <div className="mx-auto max-w-5xl px-0 sm:px-0">
      <h1 className="mb-2 text-2xl font-bold text-white">Discovery Mode</h1>
      <p className="mb-6 text-gray-400 text-sm sm:text-base">
        Explore artist similarity maps — click any node to learn more and preview
      </p>

      {/* Search bar */}
      <div className="mb-6 flex gap-2 sm:gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search an artist (e.g., Daft Punk, Deadmau5...)"
            className="w-full rounded-lg border border-gray-700 bg-gray-900 py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-sm"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-violet-600 px-4 sm:px-6 py-3 font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50 text-sm min-h-[44px]"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "Discover"
          )}
        </button>
      </div>

      {/* Quick suggestions */}
      <div className="mb-6 flex flex-wrap gap-2">
        {["Daft Punk", "Deadmau5", "Burial", "Justice", "Flume", "Carl Cox", "Bad Bunny", "Chemical Brothers", "Aphex Twin"].map(
          (artist) => (
            <button
              key={artist}
              onClick={() => { setQuery(artist); }}
              className="rounded-full border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-violet-500 hover:text-violet-300"
            >
              {artist}
            </button>
          )
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Visualization */}
      {result && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50">
          <div className="flex flex-col lg:flex-row">
            {/* Map */}
            <div className="flex-1 p-4">
              <ArtistMap
                centerArtist={result.artist}
                related={result.related}
                selectedArtist={selectedArtist}
                onSelect={setSelectedArtist}
              />
            </div>

            {/* Side panel — artist info */}
            <div className="border-t border-gray-800 p-4 lg:w-72 lg:border-l lg:border-t-0 lg:flex-shrink-0">
              {selectedArtist ? (
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedArtist.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedArtist.genres.map((g) => (
                      <span key={g} className="rounded-full bg-violet-600/20 px-2 py-0.5 text-xs text-violet-300">
                        {g}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-gray-400">{selectedArtist.reason}</p>

                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-2xl font-bold text-violet-400">
                      {selectedArtist.similarity}%
                    </span>
                    <span className="text-xs text-gray-500">similarity</span>
                  </div>

                  {/* Preview button */}
                  <button
                    onClick={handlePreview}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Preview Sound
                  </button>

                  {/* Mini legend */}
                  <p className="mt-2 text-xs text-gray-600">
                    Demo preview — hear a generated tone matching the genre
                  </p>
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500">
                  <svg className="mx-auto mb-3 h-10 w-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  Click any artist node to see details and preview
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="rounded-xl border border-dashed border-gray-800 p-8 sm:p-16 text-center">
          <svg className="mx-auto mb-4 h-12 sm:h-16 w-12 sm:w-16 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-base sm:text-lg text-gray-500">
            Search for an artist to explore their musical universe
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Try Daft Punk, Burial, Deadmau5, or any artist above
          </p>
        </div>
      )}
    </div>
  );
}
