import { useState, useEffect, useRef, useCallback } from "react";
import { api, type GenreNode } from "../lib/api";

interface GenrePickerProps {
  selected: string[];
  onChange: (genres: string[]) => void;
  compact?: boolean;
  placeholder?: string;
}

export default function GenrePicker({ selected, onChange, compact = false, placeholder = "Search genres..." }: GenrePickerProps) {
  const [hierarchy, setHierarchy] = useState<GenreNode[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [fusionSuggestions, setFusionSuggestions] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load genre tree on mount
  useEffect(() => {
    api.getGenreTree().then(d => setHierarchy(d.hierarchy)).catch(() => {});
  }, []);

  // Fetch fusion suggestions when selected changes
  useEffect(() => {
    if (selected.length >= 2) {
      api.getFusionSuggestions(selected).then(d => setFusionSuggestions(d.fusions)).catch(() => {});
    } else {
      setFusionSuggestions([]);
    }
  }, [selected]);

  // Search genres
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.searchGenres(search.trim()).then(d => setResults(d.results)).catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleGenre = useCallback((genre: string) => {
    if (selected.includes(genre)) {
      onChange(selected.filter(g => g !== genre));
    } else {
      onChange([...selected, genre]);
    }
  }, [selected, onChange]);

  const removeGenre = (genre: string) => {
    onChange(selected.filter(g => g !== genre));
  };

  // Build search results from hierarchy when search is empty
  const flatList: { name: string; isSub: boolean; parent?: string }[] = [];
  if (!search.trim()) {
    for (const g of hierarchy) {
      flatList.push({ name: g.name, isSub: false });
      for (const sub of g.subgenres) {
        flatList.push({ name: sub, isSub: true, parent: g.name });
      }
    }
  }

  const displayItems = search.trim()
    ? results.map(r => ({ name: r, isSub: false }))
    : flatList;

  return (
    <div ref={containerRef} className="relative">
      {/* Selected badges + input */}
      <div
        className={`flex flex-wrap items-center gap-1 cursor-text border border-gray-700 bg-gray-900 rounded-lg px-2 py-1.5 min-h-[36px] ${
          compact ? "text-xs" : "text-sm"
        }`}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {selected.map(g => (
          <span
            key={g}
            className="inline-flex items-center gap-0.5 bg-violet-600/30 text-violet-300 rounded-md px-2 py-0.5 text-xs"
          >
            {g}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeGenre(g); }}
              className="hover:text-white ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length > 0 ? "" : placeholder}
          className={`bg-transparent border-none outline-none text-gray-200 flex-1 min-w-[80px] ${
            compact ? "text-xs" : "text-sm"
          }`}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className={`absolute z-50 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden ${
          compact ? "max-h-48" : "max-h-64"
        } w-full`}>
          <div className="overflow-y-auto max-h-60">
            {/* Fusion suggestions at top */}
            {fusionSuggestions.length > 0 && (
              <div className="border-b border-gray-800">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500">Suggested Fusions</div>
                {fusionSuggestions.map(name => (
                  <button
                    key={`fusion-${name}`}
                    type="button"
                    onClick={() => toggleGenre(name)}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors ${
                      selected.includes(name) ? "bg-violet-600/20 text-violet-300" : "text-gray-300"
                    }`}
                  >
                    <span className="text-amber-400 text-xs">⚡</span>
                    {name}
                    {selected.includes(name) && <span className="ml-auto text-violet-400">✓</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Genre list */}
            {displayItems.length === 0 && search.trim() && (
              <div className="px-3 py-2 text-gray-500 text-sm">No genres found</div>
            )}
            {displayItems.map(({ name, isSub, parent }) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleGenre(name)}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors ${
                  selected.includes(name) ? "bg-violet-600/20 text-violet-300" : "text-gray-300"
                }`}
              >
                {isSub ? (
                  <>
                    <span className="text-gray-600 w-4">↳</span>
                    <span className={selected.includes(name) ? "" : "text-gray-400"}>
                      {name}
                      {parent && <span className="text-gray-600 ml-1 text-xs">{parent}</span>}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-violet-500 w-4 text-xs">■</span>
                    <span className="font-medium">{name}</span>
                  </>
                )}
                {selected.includes(name) && <span className="ml-auto text-violet-400">✓</span>}
              </button>
            ))}
          </div>

          {/* Show all button */}
          {displayItems.length > 0 && (
            <div className="border-t border-gray-800 px-3 py-1.5 text-xs text-gray-500">
              {displayItems.length} genres · Click to {search.trim() ? "add" : "toggle"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
