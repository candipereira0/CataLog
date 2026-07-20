const API_BASE = "/api";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers: extraHeaders } = options;

  const headers: Record<string, string> = {
    ...extraHeaders,
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }

  return data as T;
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  handle: string | null;
  bio?: string;
  tier: string;
}

export interface Track {
  id: number;
  user_id: number;
  filename: string;
  filepath: string;
  filesize: number;
  duration_ms: number | null;
  bpm: number | null;
  musical_key: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  subgenre: string | null;
  language: string | null;
  country: string | null;
  decade: string | null;
  mood: string | null;
  chord_progression: string | null;
  beat_pattern: string | null;
  rating: number;
  play_count: number;
  metadata_status: string;
  sync_status: string;
  created_at: string;
  tags?: Tag[];
  genres?: string[];
}

export interface Playlist {
  id: number;
  user_id: number;
  name: string;
  description: string;
  is_public: number;
  created_at: string;
  tracks?: Track[];
}

export interface Tag {
  id: number;
  name: string;
  category: string;
  track_count?: number;
}

export interface ExternalTrackSuggestion {
  title: string;
  artist: string;
  appleMusicUrl: string;
  spotifyUrl: string;
  youtubeUrl: string;
}

export interface AITagResult {
  genre: string | null;
  subgenre: string | null;
  mood: string | null;
  language: string | null;
  country: string | null;
  decade: string | null;
  chord_progression: string | null;
  beat_pattern: string | null;
}

export interface GeneratePlaylistResult {
  playlist: Playlist;
  externalSuggestions: ExternalTrackSuggestion[];
}

export interface SearchResult {
  trackId: number;
  title: string;
  artist: string;
  genre: string | null;
  reason: string;
}

export interface SearchResults {
  matches: SearchResult[];
  explanation: string;
}

export interface DiscoveredArtist {
  name: string;
  genres: string[];
  similarity: number;
  reason: string;
}

export interface DiscoverResult {
  artist: string;
  related: DiscoveredArtist[];
}

export interface QueueTrack extends Track {
  transition_reason: string;
}

export interface QueueGenerateResult {
  start_track: Track;
  queue: QueueTrack[];
  count: number;
  requested: number;
  constraints_relaxed: boolean;
  relax_reason: string | null;
}

export interface IdentifyResult {
  identified: boolean;
  track: {
    title: string;
    artist: string;
    album: string | null;
    year: number | null;
    genre: string | null;
    confidence: number;
    spotify_url: string | null;
    apple_music_url: string | null;
    youtube_url: string | null;
    duration_ms: number | null;
    bpm: number | null;
    musical_key: string | null;
  };
  identification_id: number;
  recent_identifications: Array<{
    id: number;
    title: string;
    artist: string;
    album: string | null;
    year: number | null;
    genre: string | null;
    confidence: number;
    added_to_library: number;
    created_at: string;
  }>;
}

export const api = {
  // Auth
  register: (email: string, password: string, display_name?: string) =>
    request<{ user: User }>("/auth/register", {
      method: "POST",
      body: { email, password, display_name },
    }),

  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  me: () => request<{ user: User | null }>("/auth/me"),

  // Tracks
  uploadTracks: (files: FileList | File[]) => {
    const formData = new FormData();
    const fileArray = files instanceof FileList ? Array.from(files) : files;
    fileArray.forEach((f) => formData.append("files", f));
    return request<{ tracks: Track[] }>("/tracks/upload", {
      method: "POST",
      body: formData,
    });
  },

  importTracks: (formData: FormData) => {
    return request<{ imported: number; skipped: number; total?: number }>("/tracks/import", {
      method: "POST",
      body: formData,
    });
  },

  listTracks: (params?: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: "asc" | "desc";
    genre?: string;
    genres?: string[];
    key?: string;
    bpm_min?: number;
    bpm_max?: number;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          if (k === "genres" && Array.isArray(v)) {
            searchParams.set(k, v.join(","));
          } else {
            searchParams.set(k, String(v));
          }
        }
      });
    }
    const qs = searchParams.toString();
    return request<{ tracks: Track[]; total: number; page: number; limit: number }>(
      `/tracks${qs ? `?${qs}` : ""}`
    );
  },

  getTrack: (id: number) => request<Track>(`/tracks/${id}`),

  updateTrack: (id: number, fields: Partial<Track>) =>
    request<Track>(`/tracks/${id}`, {
      method: "PATCH",
      body: fields,
    }),

  deleteTrack: (id: number) =>
    request<{ ok: boolean }>(`/tracks/${id}`, { method: "DELETE" }),

  getGenres: () => request<{ genres: string[]; hierarchy: GenreNode[] }>("/tracks/genres"),

  getKeys: () => request<{ keys: string[] }>("/tracks/keys"),

  // Genre system
  getGenreTree: () => request<{ hierarchy: GenreNode[] }>("/genres"),

  searchGenres: (q: string) => request<{ results: string[] }>(`/genres/search?q=${encodeURIComponent(q)}`),

  getFusionSuggestions: (selected: string[]) =>
    request<{ fusions: string[] }>(`/genres/fusions?selected=${encodeURIComponent(selected.join(","))}`),

  getGenreSubgenres: (parent: string) =>
    request<{ parent: string; subgenres: string[] }>(`/genres/${encodeURIComponent(parent)}/subgenres`),

  // Track multi-genre management
  addTrackGenres: (trackId: number, genres: string[]) =>
    request<{ genres: string[] }>(`/tracks/${trackId}/genres`, {
      method: "POST",
      body: { genres },
    }),

  getTrackGenres: (trackId: number) =>
    request<{ genres: string[] }>(`/tracks/${trackId}/genres`),

  removeTrackGenre: (trackId: number, genre: string) =>
    request<{ ok: boolean; genres: string[] }>(`/tracks/${trackId}/genres/${encodeURIComponent(genre)}`, {
      method: "DELETE",
    }),

  // Playlists
  listPlaylists: () => request<{ playlists: Playlist[] }>("/playlists"),

  createPlaylist: (name: string, description?: string) =>
    request<Playlist>("/playlists", {
      method: "POST",
      body: { name, description },
    }),

  getPlaylist: (id: number) => request<Playlist>(`/playlists/${id}`),

  deletePlaylist: (id: number) =>
    request<{ ok: boolean }>(`/playlists/${id}`, { method: "DELETE" }),

  addTrackToPlaylist: (playlistId: number, trackId: number) =>
    request<{ ok: boolean }>(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: { track_id: trackId },
    }),

  removeTrackFromPlaylist: (playlistId: number, trackId: number) =>
    request<{ ok: boolean }>(`/playlists/${playlistId}/tracks/${trackId}`, {
      method: "DELETE",
    }),

  // Tags
  listTags: () => request<{ tags: Tag[] }>("/tags"),

  createTag: (name: string, category?: string) =>
    request<Tag>("/tags", {
      method: "POST",
      body: { name, category },
    }),

  deleteTag: (id: number) =>
    request<{ ok: boolean }>(`/tags/${id}`, { method: "DELETE" }),

  getTracksByTag: (tagId: number) =>
    request<{ tracks: Track[] }>(`/tags/${tagId}/tracks`),

  attachTag: (trackId: number, tagId?: number, tagName?: string) =>
    request<{ ok: boolean }>(`/tracks/${trackId}/tags`, {
      method: "POST",
      body: { tag_id: tagId, tag_name: tagName },
    }),

  detachTag: (trackId: number, tagId: number) =>
    request<{ ok: boolean }>(`/tracks/${trackId}/tags/${tagId}`, {
      method: "DELETE",
    }),

  // AI
  aiTagTrack: (trackId: number) =>
    request<{ track: Track; tags: AITagResult }>(`/tracks/${trackId}/ai-tag`, {
      method: "POST",
    }),

  generatePlaylist: (prompt: string) =>
    request<GeneratePlaylistResult>("/playlists/generate", {
      method: "POST",
      body: { prompt },
    }),

  searchTracks: (query: string) =>
    request<SearchResults>("/tracks/search", {
      method: "POST",
      body: { query },
    }),

  suggestTracks: (playlistId: number) =>
    request<{ suggestions: ExternalTrackSuggestion[] }>(`/playlists/${playlistId}/suggest`, {
      method: "POST",
    }),

  // Sharing
  sharePlaylist: (playlistId: number) =>
    request<{ token: string; url: string }>(`/playlists/${playlistId}/share`, {
      method: "POST",
    }),

  getSharedPlaylist: (token: string) =>
    request<{
      name: string;
      description: string;
      createdBy: string;
      createdAt: string;
      tracks: Track[];
    }>(`/share/${token}`),

  revokeShare: (playlistId: number) =>
    request<{ ok: boolean }>(`/playlists/${playlistId}/share`, {
      method: "DELETE",
    }),

  // Export — returns a download URL that triggers file download
  exportPlaylist: (playlistId: number, format: string) => {
    // Direct download via anchor — no json parsing
    const a = document.createElement("a");
    a.href = `${API_BASE}/playlists/${playlistId}/export?format=${format}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return Promise.resolve();
  },

  exportTrack: (trackId: number, format: string) => {
    const a = document.createElement("a");
    a.href = `${API_BASE}/tracks/${trackId}/export?format=${format}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return Promise.resolve();
  },

  // Sync
  syncTrack: (trackId: number) =>
    request<{ ok: boolean; sync_status: string }>(`/tracks/${trackId}/sync`, {
      method: "POST",
    }),

  downloadTrack: (trackId: number) =>
    request<{ ok: boolean; sync_status: string }>(`/tracks/${trackId}/download`, {
      method: "POST",
    }),

  getSyncStatus: () =>
    request<{ local: number; syncing: number; cloud: number; pending_download: number }>("/sync/status"),

  // Discover
  discoverArtists: (artist: string) =>
    request<DiscoverResult>("/discover/artists", {
      method: "POST",
      body: { artist },
    }),

  // Payments
  createCheckout: (productType: string) =>
    request<{ url: string; mock?: boolean }>("/payments/create-checkout", {
      method: "POST",
      body: { product_type: productType },
    }),

  paymentSuccess: (sessionId: string) =>
    request<{ ok: boolean; tier: string }>(`/payments/success?session=${encodeURIComponent(sessionId)}`),

  paymentHistory: () =>
    request<{ payments: Array<{ id: number; product_type: string; status: string; amount_cents: number; created_at: string }> }>("/payments/history"),

  // Queue
  generateQueue: (trackId: number, count?: number) =>
    request<QueueGenerateResult>("/queue/generate", {
      method: "POST",
      body: { track_id: trackId, count },
    }),

  // Shazam / Identification
  identifyTrack: async (audioBlob: Blob): Promise<IdentifyResult> => {
    const res = await fetch(`${API_BASE}/shazam/identify`, {
      method: "POST",
      headers: { "Content-Type": audioBlob.type || "audio/webm" },
      body: audioBlob,
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || "Recognition failed");
    }
    return data as IdentifyResult;
  },

  addIdentifiedToLibrary: (track: {
    title: string;
    artist: string;
    album?: string | null;
    year?: number | null;
    genre?: string | null;
    confidence?: number;
    bpm?: number | null;
    musical_key?: string | null;
    duration_ms?: number | null;
    ident_id?: number;
  }) => {
    return request<{ track: Track; ok: boolean }>("/shazam/identify?action=add_to_library", {
      method: "POST",
      body: {
        title: track.title,
        artist: track.artist,
        album: track.album ?? null,
        year: track.year ?? null,
        genre: track.genre ?? null,
        confidence: track.confidence ?? 0,
        bpm: track.bpm ?? null,
        musical_key: track.musical_key ?? null,
        duration_ms: track.duration_ms ?? null,
        ident_id: track.ident_id,
      },
    });
  },

  getIdentificationHistory: () => {
    return request<{ identifications: IdentifyResult["recent_identifications"] }>("/shazam/history");
  },

  // ─── Profile / Users ───
  checkHandle: (handle: string) =>
    request<{ available: boolean; error?: string }>(`/users/check-handle?handle=${encodeURIComponent(handle)}`),

  getUserProfile: (handle: string) =>
    request<{
      profile: {
        id: number;
        display_name: string;
        handle: string | null;
        bio: string;
        tier: string;
        created_at: string;
        track_count: number;
        playlist_count: number;
        follower_count: number;
        following_count: number;
      };
      featured_playlists: Playlist[];
      recent_activity: Track[];
      tag_cloud: Tag[];
      is_following: boolean;
    }>(`/users/${encodeURIComponent(handle)}`),

  updateProfile: (fields: { handle?: string; display_name?: string; bio?: string; city?: string; show_in_matches?: boolean }) =>
    request<{ user: User }>("/users/me", {
      method: "PATCH",
      body: fields,
    }),

  discoverUsers: () =>
    request<{ users: Array<{ id: number; display_name: string; handle: string | null; bio: string; tier: string; playlist_count: number; follower_count: number }> }>("/users/discover"),

  // ─── User Genres ───
  getUserGenres: (handle: string) =>
    request<{ genres: Array<{ genre_name: string; type: "specialize" | "interest" }> }>(`/users/${encodeURIComponent(handle)}/genres`),

  updateMyGenres: (genres: Array<{ name: string; type: string }>) =>
    request<{ genres: Array<{ genre_name: string; type: string }> }>("/users/me/genres", {
      method: "PUT",
      body: { genres },
    }),

  searchUsersByGenres: (genres: string[]) =>
    request<{ users: Array<{ id: number; display_name: string; handle: string | null; bio: string; tier: string; genres: string[] }> }>(`/users/search?genres=${encodeURIComponent(genres.join(","))}`),

  // ─── DJ Matches ───
  getMatches: (userId: number, limit?: number) =>
    request<{ matches: DJMatch[] }>(`/users/${userId}/matches${limit ? `?limit=${limit}` : ""}`),

  // ─── Inspo ───
  getDailyChallenge: () =>
    request<{ challenge: { type: string; prompt: string; description: string; date: string } }>("/inspo/daily"),

  getRandomChallenge: () =>
    request<{ challenge: { type: string; prompt: string; description: string; date: string } }>("/inspo/random"),

  // ─── Follow ───
  followUser: (userId: number) =>
    request<{ ok: boolean }>(`/users/${userId}/follow`, { method: "POST" }),

  unfollowUser: (userId: number) =>
    request<{ ok: boolean }>(`/users/${userId}/follow`, { method: "DELETE" }),

  getFollowers: (userId: number) =>
    request<{ followers: Array<{ id: number; display_name: string; handle: string | null }> }>(`/users/${userId}/followers`),

  getFollowing: (userId: number) =>
    request<{ following: Array<{ id: number; display_name: string; handle: string | null }> }>(`/users/${userId}/following`),

  // ─── Collaborators ───
  addCollaborator: (playlistId: number, userId: number) =>
    request<{ ok: boolean }>(`/playlists/${playlistId}/collaborators`, {
      method: "POST",
      body: { user_id: userId },
    }),

  removeCollaborator: (playlistId: number, userId: number) =>
    request<{ ok: boolean }>(`/playlists/${playlistId}/collaborators/${userId}`, {
      method: "DELETE",
    }),

  getCollaborators: (playlistId: number) =>
    request<{ collaborators: Array<{ id: number; display_name: string; handle: string | null }> }>(`/playlists/${playlistId}/collaborators`),

  // ─── Posts ───
  createPost: (data: {
    type: string; title?: string; body?: string;
    gig_date?: string; gig_venue?: string; gig_location?: string;
    playlist_id?: number; track_id?: number;
  }) =>
    request<{ post: Post }>("/posts", { method: "POST", body: data }),

  getPosts: (userId: number, page = 1) =>
    request<{ posts: Post[] }>(`/posts?user_id=${userId}&page=${page}`),

  getFeed: (page = 1) =>
    request<{ posts: Post[] }>(`/feed?page=${page}`),

  likePost: (postId: number) =>
    request<{ ok: boolean }>(`/posts/${postId}/like`, { method: "POST" }),

  unlikePost: (postId: number) =>
    request<{ ok: boolean }>(`/posts/${postId}/like`, { method: "DELETE" }),

  deletePost: (postId: number) =>
    request<{ ok: boolean }>(`/posts/${postId}`, { method: "DELETE" }),

  // ─── Notifications ───
  getNotifications: () =>
    request<{ notifications: NotificationItem[]; unread_count: number }>("/notifications"),

  markNotificationRead: (notifId: number) =>
    request<{ ok: boolean }>(`/notifications/${notifId}/read`, { method: "POST" }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),

  // ─── Share with Followers ───
  sharePlaylistWithFollowers: (playlistId: number, message?: string) =>
    request<{ post: Post; shared_with: number }>(`/playlists/${playlistId}/share-followers`, {
      method: "POST",
      body: { message },
    }),

  // ─── Light Sync ───
  getLightStatus: () =>
    request<{
      midi: { available: boolean; connected: boolean; outputs: number };
      hue: { connected: boolean; mock: boolean; bridgeIp?: string; lightCount: number; lastSync: number | null };
      osc: { clients: number };
    }>("/lights/status"),

  getLightParams: (trackId: number) =>
    request<{ params: import("../../server/light-sync").LightParams }>(`/lights/params?track_id=${trackId}`),

  connectHue: () =>
    request<{ connected: boolean; mock: boolean; linkButton?: boolean }>("/lights/hue/connect", {
      method: "POST",
    }),

  syncHue: (mood: string, energy: number) =>
    request<{
      success: boolean;
      lightsUpdated: number;
      colors: Array<{ r: number; g: number; b: number }>;
      brightness: number;
      mock: boolean;
    }>("/lights/hue/sync", {
      method: "POST",
      body: { mood, energy },
    }),

  // ─── Tips ───
  getMyTipLinks: () =>
    request<{ tip_links: TipLink[] }>("/users/me/tip-links"),

  updateMyTipLinks: (links: Array<{ platform: string; handle: string; is_active: boolean }>) =>
    request<{ tip_links: TipLink[] }>("/users/me/tip-links", {
      method: "PUT",
      body: { links },
    }),

  getPublicTipLinks: (userIdOrHandle: string) =>
    request<{ user: { id: number; display_name: string; handle: string | null }; tip_links: TipLink[] }>(
      `/users/${encodeURIComponent(userIdOrHandle)}/tip-links`
    ),

  recordTip: (data: { to_user_id: number; platform?: string; amount_cents?: number; playlist_id?: number }) =>
    request<{ tip: TipReceived }>("/tips", {
      method: "POST",
      body: data,
    }),

  getTipsReceived: () =>
    request<{ tips: TipReceived[] }>("/tips/received"),

  getTipsGiven: () =>
    request<{ tips: TipReceived[] }>("/tips/given"),

  // ─── Artist Tracks ───
  uploadArtistTrack: (formData: FormData) =>
    request<{ track: ArtistTrack }>("/artist/tracks", {
      method: "POST",
      body: formData,
    }),

  listArtistTracks: (publishedOnly?: boolean) => {
    const qs = publishedOnly ? "?published_only=true" : "";
    return request<{ tracks: ArtistTrack[] }>(`/artist/tracks${qs}`);
  },

  getArtistTracksByUser: (handle: string) =>
    request<{ tracks: ArtistTrack[] }>(`/users/${encodeURIComponent(handle)}/tracks`),

  getArtistTrack: (id: number) =>
    request<ArtistTrack>(`/artist/tracks/${id}`),

  updateArtistTrack: (id: number, fields: Partial<ArtistTrack>) =>
    request<ArtistTrack>(`/artist/tracks/${id}`, {
      method: "PATCH",
      body: fields,
    }),

  deleteArtistTrack: (id: number) =>
    request<{ ok: boolean }>(`/artist/tracks/${id}`, { method: "DELETE" }),

  getArtistTrackStreamUrl: (id: number) => `/api/artist/tracks/${id}/stream`,

  downloadArtistTrack: (id: number) =>
    request<{ ok: boolean; download_count: number }>(`/artist/tracks/${id}/download`, { method: "POST" }),

  addArtistTrackToLibrary: (id: number) =>
    request<{ track: Track; ok: boolean }>(`/artist/tracks/${id}/add-to-library`, { method: "POST" }),

  browseArtistTracks: (params?: {
    genre?: string;
    bpm_min?: number;
    bpm_max?: number;
    price?: 'free' | 'paid';
    sort?: string;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          searchParams.set(k, String(v));
        }
      });
    }
    const qs = searchParams.toString();
    return request<{ tracks: ArtistTrackBrowse[]; total: number; genres: string[]; limit: number; offset: number }>(
      `/artist/tracks/browse${qs ? `?${qs}` : ""}`
    );
  },

  // ─── Artist Profile ───
  getArtistProfile: () =>
    request<{ profile: { is_artist: number; artist_name: string } | null; links: ArtistLink[] }>("/artist/profile"),

  updateArtistProfile: (data: {
    is_artist?: boolean;
    artist_name?: string;
    links?: Array<{ platform: string; url: string }>;
  }) =>
    request<{ profile: { is_artist: number; artist_name: string } | null; links: ArtistLink[] }>("/artist/profile", {
      method: "PUT",
      body: data,
    }),

  // ─── Device & Sync ───
  registerDevice: () =>
    request<{ device: DeviceInfo }>("/devices/register", { method: "POST" }),

  listDevices: () =>
    request<{ devices: DeviceInfo[] }>("/devices"),

  deleteDevice: (deviceId: number) =>
    request<{ ok: boolean }>(`/devices/${deviceId}`, { method: "DELETE" }),

  pushPlaylistToDevice: (deviceId: number, playlistId: number) =>
    request<{ ok: boolean; action_id: number }>(`/devices/${deviceId}/push-playlist`, {
      method: "POST",
      body: { playlist_id: playlistId },
    }),

  getDeviceActions: (deviceId: number) =>
    request<{ actions: DeviceAction[] }>(`/devices/${deviceId}/actions`),

  completeDeviceAction: (actionId: number) =>
      request<{ ok: boolean }>(`/device-actions/${actionId}/complete`, { method: "POST" }),

  // ─── Venues ───
  createVenue: (data: {
      name: string;
      address?: string;
      city?: string;
      website?: string;
      equipment?: string[];
      light_system_type?: string;
  }) =>
      request<{ venue: Venue }>("/venues", {
          method: "POST",
          body: { ...data, equipment_json: JSON.stringify(data.equipment || []) },
      }),

  listVenues: () => request<{ venues: Venue[] }>("/venues"),

  getUserVenues: () => request<{ venues: Venue[] }>("/venues/mine"),

  getVenue: (id: number) => request<{ venue: Venue }>(`/venues/${id}`),

  // ─── Gigs ───
  createGig: (venueId: number, data: {
      title: string;
      theme?: string;
      date: string;
      start_time?: string;
      end_time?: string;
      setlist_playlist_id?: number | null;
  }) =>
      request<{ gig: Gig }>(`/venues/${venueId}/gigs`, {
          method: "POST",
          body: data,
      }),

  getVenueGigs: (venueId: number) =>
      request<{ gigs: Gig[] }>(`/venues/${venueId}/gigs`),

  getUserGigs: () => request<{ gigs: Gig[] }>("/gigs/mine"),

  updateGig: (gigId: number, fields: Partial<Gig>) =>
      request<{ gig: Gig }>(`/gigs/${gigId}`, {
          method: "PATCH",
          body: fields,
      }),

  pushSetlist: (gigId: number) =>
      request<{
          gig: Gig;
          venue: Venue;
          trackCount: number;
          lightParams: Array<{ trackId: number; title: string; artist: string; bpm: number; energy: number }>;
      }>(`/gigs/${gigId}/push`, { method: "POST" }),

  deleteGig: (gigId: number) =>
      request<{ ok: boolean }>(`/gigs/${gigId}`, { method: "DELETE" }),

  // ─── Deep Audio Analysis ───
  analyzeTrack: (trackId: number, feedback?: { accepted?: string[]; rejected?: string[] }) =>
    request<{ analysis: DeepAnalysisResult }>(`/tracks/${trackId}/analyze`, {
      method: "POST",
      body: feedback || {},
    }),

  getTrackAnalysis: (trackId: number) =>
    request<{ analysis: DeepAnalysisResult | null; cached: boolean }>(`/tracks/${trackId}/analysis`),
  };

// ─── Additional Types ───

export interface Post {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  gig_date: string | null;
  gig_venue: string | null;
  gig_location: string | null;
  playlist_id: number | null;
  track_id: number | null;
  created_at: string;
  author_handle: string | null;
  author_name: string;
  like_count: number;
  liked_by_me: number;
  playlist_name?: string;
  playlist_track_count?: number;
  track_title?: string;
  track_artist?: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  type: string;
  actor_id: number | null;
  post_id: number | null;
  read: number;
  created_at: string;
  actor_handle: string | null;
  actor_name: string;
}

export interface TipLink {
  id: number;
  user_id: number;
  platform: string;
  handle_or_url: string;
  is_active: number;
  created_at: string;
}

export interface TipReceived {
  id: number;
  from_user_id: number | null;
  to_user_id: number;
  amount_cents: number | null;
  platform: string | null;
  playlist_id: number | null;
  created_at: string;
  from_handle?: string | null;
  from_name?: string | null;
  to_handle?: string | null;
  to_name?: string | null;
}

export interface ArtistTrack {
  id: number;
  user_id: number;
  title: string;
  artist_name: string;
  genre: string | null;
  subgenre: string | null;
  bpm: number | null;
  musical_key: string | null;
  description: string;
  file_url: string;
  cover_art_url: string | null;
  price_cents: number;
  is_published: number;
  play_count: number;
  download_count: number;
  created_at: string;
  tags?: Tag[];
}

export interface ArtistTrackBrowse extends ArtistTrack {
  user_display_name: string;
  user_handle: string | null;
}

export interface ArtistLink {
  id: number;
  user_id: number;
  platform: string;
  url: string;
  created_at: string;
}

export interface DeviceInfo {
  id: number;
  user_id: number;
  device_name: string;
  device_type: string;
  session_id: string;
  last_seen: string;
  created_at: string;
  is_current?: boolean;
}

export interface DeviceAction {
  id: number;
  device_id: number;
  action_type: string;
  payload_json: string;
  status: string;
  created_at: string;
}

export interface SyncEvent {
  type: string;
  payload: unknown;
  timestamp: string;
  sourceDeviceId?: number;
}

export interface Venue {
  id: number;
  name: string;
  address: string;
  city: string;
  website: string;
  owner_user_id: number;
  equipment_json: string;
  light_system_type: string;
  created_at: string;
  /** Parsed equipment array (from equipment_json) */
  equipment?: string[];
}

export interface Gig {
  id: number;
  venue_id: number;
  dj_user_id: number;
  title: string;
  theme: string;
  date: string;
  start_time: string;
  end_time: string;
  setlist_playlist_id: number | null;
  status: string;
  created_at: string;
  /** Joined venue name (added client-side or by API) */
  venue_name?: string;
}

export interface GenreNode {
  name: string;
  parent_id: string | null;
  subgenres: string[];
}

export interface DJMatch {
  id: number;
  display_name: string;
  handle: string | null;
  city: string;
  genres: string[];
  shared_genres: string[];
  shared_genre_count: number;
  same_city: boolean;
  score: number;
}

export interface InspoChallenge {
  type: string;
  prompt: string;
  description: string;
  date: string;
}

export interface DeepAnalysisResult {
  bpm: number | null;
  key: string | null;
  energy: number;
  vocalPresence: boolean;
  vocalGender: string | null;
  instruments: {
    kick: number;
    snare: number;
    hihat: number;
    bass: number;
    synth: number;
    piano: number;
    guitar: number;
    strings: number;
    brass: number;
  };
  beatPattern: string | null;
  subgenreSuggestions: Array<{
    subgenre: string;
    parentGenre: string;
    confidence: number;
    reasons: string[];
  }>;
  analyzedAt: string;
}
