import { useState } from "react";
import { api, type Playlist } from "../lib/api";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  playlists: Playlist[];
}

type PostType = "status" | "gig" | "playlist_share" | "track_share";

export default function CreatePostModal({ isOpen, onClose, onCreated, playlists }: CreatePostModalProps) {
  const [postType, setPostType] = useState<PostType>("status");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [gigDate, setGigDate] = useState("");
  const [gigVenue, setGigVenue] = useState("");
  const [gigLocation, setGigLocation] = useState("");
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setPostType("status");
    setTitle("");
    setBody("");
    setGigDate("");
    setGigVenue("");
    setGigLocation("");
    setPlaylistId(null);
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createPost({
        type: postType,
        title: title || undefined,
        body: body || undefined,
        gig_date: postType === "gig" ? gigDate || undefined : undefined,
        gig_venue: postType === "gig" ? gigVenue || undefined : undefined,
        gig_location: postType === "gig" ? gigLocation || undefined : undefined,
        playlist_id: postType === "playlist_share" ? playlistId || undefined : undefined,
      });
      setSuccess(true);
      onCreated();
      setTimeout(() => {
        reset();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const types: { value: PostType; icon: string; label: string }[] = [
    { value: "status", icon: "💬", label: "Status" },
    { value: "gig", icon: "🎤", label: "Gig" },
    { value: "playlist_share", icon: "🎵", label: "Playlist Share" },
    { value: "track_share", icon: "🎧", label: "Track Share" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => { reset(); onClose(); }}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="mb-4 text-xl font-bold text-white">Create Post</h2>

        {success ? (
          <div className="rounded-lg border border-emerald-800 bg-emerald-900/20 p-4 text-center">
            <p className="text-emerald-400 font-medium">✓ Post created!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type selector */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">Post type</label>
              <div className="flex gap-2 flex-wrap">
                {types.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setPostType(t.value)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      postType === t.value
                        ? "border-violet-500 bg-violet-600/20 text-violet-300"
                        : "border-gray-700 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            {postType !== "status" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={postType === "gig" ? "Gig name..." : "Post title..."}
                  className="input-field w-full"
                  required
                />
              </div>
            )}

            {/* Body */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                {postType === "status" ? "What's on your mind?" : "Message"}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={postType === "status" ? "Share an update with your followers..." : "Add a message..."}
                className="input-field w-full min-h-[80px] resize-y"
                rows={3}
                required={postType === "status"}
              />
            </div>

            {/* Gig fields */}
            {postType === "gig" && (
              <div className="space-y-3 rounded-lg border border-gray-700/50 bg-gray-800/30 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={gigDate}
                    onChange={(e) => setGigDate(e.target.value)}
                    className="input-field w-full text-gray-200"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Venue</label>
                  <input
                    type="text"
                    value={gigVenue}
                    onChange={(e) => setGigVenue(e.target.value)}
                    placeholder="Club name..."
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Location (address)</label>
                  <input
                    type="text"
                    value={gigLocation}
                    onChange={(e) => setGigLocation(e.target.value)}
                    placeholder="123 Main St, City..."
                    className="input-field w-full"
                  />
                </div>
              </div>
            )}

            {/* Playlist selector */}
            {postType === "playlist_share" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Playlist</label>
                {playlists.length === 0 ? (
                  <p className="text-sm text-gray-500">No playlists yet. Create one first.</p>
                ) : (
                  <select
                    value={playlistId ?? ""}
                    onChange={(e) => setPlaylistId(e.target.value ? parseInt(e.target.value) : null)}
                    className="input-field w-full"
                    required
                  >
                    <option value="">Select a playlist...</option>
                    {playlists.map((pl) => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-800 bg-red-900/20 p-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || (postType === "playlist_share" && !playlistId)}
                className="btn-primary flex-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Posting...
                  </span>
                ) : (
                  "Post"
                )}
              </button>
              <button type="button" onClick={() => { reset(); onClose(); }} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
