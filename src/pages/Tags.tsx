import { useState, useEffect, useCallback } from "react";
import { api, type Tag, type Track } from "../lib/api";

const TAG_CATEGORIES = ["venue", "timing", "component", "mood", "custom"] as const;

export default function Tags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("custom");
  const [creating, setCreating] = useState(false);

  // Expanded tag → tracks
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tagTracks, setTagTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listTags();
      setTags(data.tags);
    } catch (err) {
      setError("Failed to load tags.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createTag(newName.trim(), newCategory);
      setNewName("");
      setNewCategory("custom");
      setShowCreate(false);
      await fetchTags();
    } catch (err) {
      console.error("Failed to create tag:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete tag "${name}"? It will be removed from all tracks.`)) return;
    try {
      await api.deleteTag(id);
      if (expandedId === id) {
        setExpandedId(null);
        setTagTracks([]);
      }
      await fetchTags();
    } catch (err) {
      console.error("Failed to delete tag:", err);
    }
  };

  const toggleExpand = async (tag: Tag) => {
    if (expandedId === tag.id) {
      setExpandedId(null);
      setTagTracks([]);
      return;
    }
    setExpandedId(tag.id);
    setTracksLoading(true);
    try {
      const data = await api.getTracksByTag(tag.id);
      setTagTracks(data.tracks);
    } catch (err) {
      console.error("Failed to load tracks for tag:", err);
      setTagTracks([]);
    } finally {
      setTracksLoading(false);
    }
  };

  const categoryBadge = (cat: string) => {
    const colors: Record<string, string> = {
      venue: "bg-blue-600/20 text-blue-300",
      timing: "bg-amber-600/20 text-amber-300",
      component: "bg-emerald-600/20 text-emerald-300",
      mood: "bg-pink-600/20 text-pink-300",
      custom: "bg-gray-600/20 text-gray-300",
    };
    return colors[cat] || colors.custom;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Tags</h1>
          <p className="mt-1 text-sm text-gray-400">{tags.length} tag{tags.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Tag
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6">
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. peak-hour, warm-up, vocals"
                className="input-field"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="input-field py-2.5"
              >
                {TAG_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating || !newName.trim()} className="btn-primary">
                {creating ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="card mb-6 border-red-800 bg-red-900/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="card flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-400">Loading tags...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tags.length === 0 && (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
            <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">No tags yet</h2>
          <p className="mt-1 text-sm text-gray-400">Create tags to categorize your tracks by venue, mood, timing, and more.</p>
        </div>
      )}

      {/* Tag list */}
      {!loading && tags.length > 0 && (
        <div className="space-y-3">
          {tags.map((tag) => (
            <div key={tag.id} className="card">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleExpand(tag)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`h-4 w-4 text-gray-500 transition-transform ${expandedId === tag.id ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-gray-200">{tag.name}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadge(tag.category)}`}>
                      {tag.category}
                    </span>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {tag.track_count ?? 0} track{(tag.track_count ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => handleDelete(tag.id, tag.name)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                    title="Delete tag"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded tracks */}
              {expandedId === tag.id && (
                <div className="mt-4 border-t border-gray-800 pt-4">
                  {tracksLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                      <span className="ml-2 text-xs text-gray-400">Loading tracks...</span>
                    </div>
                  ) : tagTracks.length === 0 ? (
                    <p className="py-4 text-center text-xs text-gray-500">No tracks with this tag.</p>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500">
                        {tagTracks.length} track{tagTracks.length !== 1 ? "s" : ""}
                      </span>
                      {tagTracks.map((track, i) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-800/50"
                        >
                          <span className="text-xs text-gray-600 w-5">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-200">{track.title || track.filename}</p>
                            <p className="truncate text-xs text-gray-500">
                              {[track.artist, track.genre, track.bpm ? `${Math.round(track.bpm)} BPM` : null]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
