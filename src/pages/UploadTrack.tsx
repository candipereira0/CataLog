import { useState, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api, type ArtistTrack } from "../lib/api";

export default function UploadTrack() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState((user as Record<string, unknown> | null)?.["artist_name"] as string || (user as Record<string, unknown> | null)?.["display_name"] as string || "");
  const [genre, setGenre] = useState("");
  const [subgenre, setSubgenre] = useState("");
  const [bpm, setBpm] = useState("");
  const [musicalKey, setMusicalKey] = useState("");
  const [description, setDescription] = useState("");
  const [priceCents, setPriceCents] = useState("0");
  const [isPublished, setIsPublished] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedTrack, setUploadedTrack] = useState<ArtistTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!audioFile) {
      setError("Please select an audio file");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("title", title || audioFile.name.replace(/\.[^.]+$/, ""));
    formData.append("artist_name", artistName);
    if (genre) formData.append("genre", genre);
    if (subgenre) formData.append("subgenre", subgenre);
    if (bpm) formData.append("bpm", bpm);
    if (musicalKey) formData.append("musical_key", musicalKey);
    if (description) formData.append("description", description);
    formData.append("price_cents", priceCents || "0");
    formData.append("is_published", isPublished ? "true" : "false");
    if (coverFile) formData.append("cover_art", coverFile);

    // Simulate progress since fetch doesn't support upload progress easily
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await api.uploadArtistTrack(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadedTrack(result.track);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setTitle("");
    setArtistName((user as Record<string, unknown> | null)?.["artist_name"] as string || (user as Record<string, unknown> | null)?.["display_name"] as string || "");
    setGenre("");
    setSubgenre("");
    setBpm("");
    setMusicalKey("");
    setDescription("");
    setPriceCents("0");
    setIsPublished(false);
    setAudioFile(null);
    setCoverFile(null);
    setUploadedTrack(null);
    setUploadProgress(0);
    setError(null);
    if (audioRef.current) audioRef.current.value = "";
    if (coverRef.current) coverRef.current.value = "";
  };

  const genres = [
    "House", "Techno", "Trance", "Drum & Bass", "Dubstep", "Hip-Hop",
    "R&B", "Pop", "Rock", "Jazz", "Funk", "Soul", "Disco", "Afrobeat",
    "Amapiano", "Latin", "Reggaeton", "Dancehall", "Garage", "Breaks",
    "Ambient", "Downtempo", "Lo-Fi", "Electronic", "Other",
  ];

  const keys = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Upload Track</h1>
        <p className="mt-1 text-sm text-gray-400">Share your music with the CataLog community.</p>
      </div>

      {uploadedTrack ? (
        <div className="card">
          <div className="mb-4 flex items-center gap-3 text-emerald-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold">Track uploaded successfully!</span>
          </div>

          <div className="mb-4 flex items-center gap-4">
            {uploadedTrack.cover_art_url ? (
              <img
                src={`/api/artist/tracks/${uploadedTrack.id}/stream`}
                className="h-16 w-16 rounded-lg object-cover bg-gray-700"
                alt="Cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-violet-600/20">
                <svg className="h-8 w-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-white">{uploadedTrack.title}</p>
              <p className="text-sm text-gray-400">{uploadedTrack.artist_name}</p>
              {uploadedTrack.genre && (
                <span className="mt-1 inline-block rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  {uploadedTrack.genre}{uploadedTrack.bpm ? ` · ${Math.round(uploadedTrack.bpm)} BPM` : ""}
                </span>
              )}
            </div>
          </div>

          {/* Preview player */}
          <div className="mb-4">
            <audio
              controls
              className="w-full"
              src={api.getArtistTrackStreamUrl(uploadedTrack.id)}
              style={{ height: 40 }}
            />
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="btn-primary text-sm">
              Upload Another
            </button>
            <button
              onClick={() => navigate(`/@${(user as Record<string, unknown> | null)?.["handle"]}`)}
              className="btn-secondary text-sm"
            >
              View Profile
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-5">
          {/* Audio file */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Audio File <span className="text-red-400">*</span>
            </label>
            <input
              ref={audioRef}
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="input-field w-full cursor-pointer file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-violet-500"
              required
            />
            {audioFile && (
              <p className="mt-1 text-xs text-gray-500">
                {(audioFile.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Title */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={audioFile?.name.replace(/\.[^.]+$/, "") || "Track title"}
                className="input-field w-full"
              />
            </div>

            {/* Artist name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Artist Name</label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Your artist name"
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Genre */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Select genre...</option>
                {genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* BPM */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">BPM</label>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                placeholder="e.g. 128"
                min="20"
                max="300"
                step="0.1"
                className="input-field w-full"
              />
            </div>

            {/* Key */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Key</label>
              <select
                value={musicalKey}
                onChange={(e) => setMusicalKey(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Select key...</option>
                {keys.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell listeners about this track..."
              className="input-field w-full min-h-[80px] resize-y"
              maxLength={1000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Price */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Price</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={priceCents}
                  onChange={(e) => setPriceCents(e.target.value)}
                  min="0"
                  step="100"
                  className="input-field w-32"
                />
                <span className="text-sm text-gray-400">cents (0 = free)</span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {priceCents === "0" || !priceCents
                  ? "Free download"
                  : `$${(parseInt(priceCents) / 100).toFixed(2)}`}
              </p>
            </div>

            {/* Cover art */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Cover Art</label>
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="input-field w-full cursor-pointer file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-gray-200 hover:file:bg-gray-600"
              />
            </div>
          </div>

          {/* Publish toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                isPublished ? "bg-violet-600" : "bg-gray-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                  isPublished ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-300">
                {isPublished ? "Publish immediately" : "Save as draft"}
              </p>
              <p className="text-xs text-gray-500">
                {isPublished ? "Track will appear on your profile and in Music discovery." : "Only you can see it until you publish."}
              </p>
            </div>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-gray-400">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !audioFile}
            className="btn-primary"
          >
            {uploading ? "Uploading..." : "Upload Track"}
          </button>
        </form>
      )}
    </div>
  );
}
