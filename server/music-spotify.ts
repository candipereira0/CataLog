// Spotify integration handlers — OAuth, playlist import/export
// Mock mode when SPOTIFY_CLIENT_ID is not set

import { json, requireAuth, getSessionCookie } from "./handlers";
import { getDb } from "./db";
import { matchSpotifyToCatalog, type SpotifyTrackRef, type CatalogTrackRef } from "./track-match";

// ─── Configuration ──────────────────────────────────────────────────────────

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/api/music/spotify/callback";
const IS_MOCK = !SPOTIFY_CLIENT_ID;

// In-memory token store (per-user, sessions table or in-memory for dev)
// Production would use DB, but for demo/mock this is fine
interface SpotifyToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  spotifyUserId: string;
  spotifyDisplayName?: string;
}

const tokenStore = new Map<number, SpotifyToken>();

// ─── Spotify API helpers ────────────────────────────────────────────────────

async function spotifyApi(
  userId: number,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const token = tokenStore.get(userId);
  if (!token) throw new Error("Not connected to Spotify");

  // Refresh if expired
  if (Date.now() > token.expiresAt) {
    await refreshSpotifyToken(userId, token.refreshToken);
  }

  const t = tokenStore.get(userId);
  if (!t) throw new Error("Token refresh failed");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${t.accessToken}`,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    // Token expired — refresh and retry
    await refreshSpotifyToken(userId, t.refreshToken);
    const newToken = tokenStore.get(userId);
    if (!newToken) throw new Error("Token refresh failed");
    headers.Authorization = `Bearer ${newToken.accessToken}`;
    return fetch(`https://api.spotify.com/v1${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  return res;
}

async function refreshSpotifyToken(userId: number, refreshToken: string): Promise<void> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    tokenStore.delete(userId);
    throw new Error("Failed to refresh Spotify token");
  }

  const data = await res.json() as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  const existing = tokenStore.get(userId)!;
  tokenStore.set(userId, {
    ...existing,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshToken: data.refresh_token || existing.refreshToken,
  });
}

// ─── Mock data ──────────────────────────────────────────────────────────────

interface MockSpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  imageUrl: string;
  owner: string;
}

const MOCK_PLAYLISTS: MockSpotifyPlaylist[] = [
  { id: "sp1", name: "Summer Vibes 2026", description: "Hot tracks for pool parties", trackCount: 28, imageUrl: "", owner: "DJ CataLog" },
  { id: "sp2", name: "Late Night Deep House", description: "Deep, moody, atmospheric", trackCount: 22, imageUrl: "", owner: "DJ CataLog" },
  { id: "sp3", name: "Peak Time Techno", description: "Main room destroyers", trackCount: 35, imageUrl: "", owner: "DJ CataLog" },
  { id: "sp4", name: "Hip-Hop & RnB Gems", description: "Crowd-pleasing favorites", trackCount: 18, imageUrl: "", owner: "DJ CataLog" },
  { id: "sp5", name: "Afro House Journey", description: "Percussive and soulful", trackCount: 24, imageUrl: "", owner: "DJ CataLog" },
];

interface MockSpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  isrc?: string;
  durationMs: number;
  url?: string;
}

const MOCK_TRACKS: Record<string, MockSpotifyTrack[]> = {
  sp1: [
    { id: "spt1", title: "Ocean Drive", artist: "Duke Dumont", album: "Blasé Boys Club", isrc: "GBUM71500397", durationMs: 224000 },
    { id: "spt2", title: "Sun Is Shining", artist: "Axwell & Ingrosso", album: "More Than You Know", isrc: "SEBGA1500268", durationMs: 244000 },
    { id: "spt3", title: "Summer", artist: "Calvin Harris", album: "Motion", isrc: "GBARL1400509", durationMs: 234000 },
    { id: "spt4", title: "My Love", artist: "Route 94", album: "My Love", isrc: "GBUM71400695", durationMs: 262000 },
  ],
  sp2: [
    { id: "spt5", title: "Deep Inside", artist: "Hardrive", album: "Deep Inside EP", isrc: "USZUR0300100", durationMs: 378000 },
    { id: "spt6", title: "At Night", artist: "Shakedown", album: "At Night", isrc: "FR08E0000010", durationMs: 380000 },
    { id: "spt7", title: "Need U (100%)", artist: "Duke Dumont", album: "Need U (100%)", isrc: "GBUM71302331", durationMs: 234000 },
  ],
  sp3: [
    { id: "spt8", title: "Rave", artist: "Sam Paganini", album: "Rave", isrc: "DEQ121428138", durationMs: 414000 },
    { id: "spt9", title: "Photon", artist: "Deetron", album: "Photon", isrc: "CH6141200010", durationMs: 375000 },
    { id: "spt10", title: "Flash", artist: "Green Velvet", album: "Flash", isrc: "USCJ81300193", durationMs: 330000 },
  ],
  sp4: [
    { id: "spt11", title: "God's Plan", artist: "Drake", album: "Scorpion", isrc: "USCM51800001", durationMs: 199000 },
    { id: "spt12", title: "SICKO MODE", artist: "Travis Scott", album: "ASTROWORLD", isrc: "USSM11806167", durationMs: 312000 },
  ],
  sp5: [
    { id: "spt13", title: "Pheli War", artist: "Black Coffee", album: "Pieces Of Me", isrc: "ZAC031500001", durationMs: 356000 },
    { id: "spt14", title: "Kuar", artist: "Enoo Napa", album: "Kuar", isrc: "ZAC031900001", durationMs: 420000 },
  ],
};

// ─── Mock search function ───────────────────────────────────────────────────

function mockSearchSpotify(query: string, _type: "isrc" | "track"): SpotifyTrackRef[] {
  const allTracks: SpotifyTrackRef[] = [];
  for (const tracks of Object.values(MOCK_TRACKS)) {
    for (const t of tracks) {
      allTracks.push({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        isrc: t.isrc,
        durationMs: t.durationMs,
        url: `https://open.spotify.com/track/${t.id}`,
      });
    }
  }

  // Simple substring matching
  const q = query.toLowerCase();
  return allTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.isrc && t.isrc.toLowerCase().includes(q)),
  );
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

// GET /api/music/spotify/auth-url
export async function handleSpotifyAuthUrl(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (IS_MOCK) {
    return json({
      url: "/api/music/spotify/callback?code=mock_auth_code&state=mock_state",
      mock: true,
    });
  }

  const scopes = [
    "playlist-read-private",
    "playlist-modify-private",
    "playlist-modify-public",
    "user-library-read",
  ];

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
    scope: scopes.join(" "),
  });

  return json({
    url: `https://accounts.spotify.com/authorize?${params.toString()}`,
    mock: false,
  });
}

// GET /api/music/spotify/callback?code=xxx&state=xxx
export async function handleSpotifyCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return json({ error: "Missing authorization code" }, 400);
  }

  // Get user from session
  const sessionId = getSessionCookie(req);
  if (!sessionId) {
    return new Response(
      `<html><body><script>window.close();</script><p>Please log in first and try again.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  const user = await (await import("./db")).getUserFromSession(sessionId);
  if (!user) {
    return new Response(
      `<html><body><script>window.close();</script><p>Session expired. Please log in again.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  if (IS_MOCK || code === "mock_auth_code") {
    // Mock mode — store mock token
    tokenStore.set(user.userId, {
      accessToken: "mock_spotify_token_" + crypto.randomUUID().slice(0, 8),
      refreshToken: "mock_refresh_token",
      expiresAt: Date.now() + 3600 * 1000,
      spotifyUserId: "mock_spotify_user_" + crypto.randomUUID().slice(0, 8),
      spotifyDisplayName: user.displayName || "CataLog DJ",
    });

    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'spotify-connected',success:true},'*');window.close();</script><p>Spotify connected! (Demo Mode) You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  // Real mode — exchange code for tokens
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Spotify token exchange failed:", errText);
      return new Response(
        `<html><body><script>window.close();</script><p>Failed to connect Spotify. Please try again.</p></body></html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }

    const data = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Get user profile
    const profileRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    const profile = await profileRes.json() as { id: string; display_name?: string };

    tokenStore.set(user.userId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      spotifyUserId: profile.id,
      spotifyDisplayName: profile.display_name,
    });

    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'spotify-connected',success:true},'*');window.close();</script><p>Spotify connected! You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  } catch (err) {
    console.error("Spotify callback error:", err);
    return new Response(
      `<html><body><script>window.close();</script><p>Connection error. Please try again.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }
}

// GET /api/music/spotify/status
export async function handleSpotifyStatus(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const token = tokenStore.get(userId);
  return json({
    connected: !!token && token.expiresAt > Date.now(),
    spotifyUserId: token?.spotifyUserId || null,
    displayName: token?.spotifyDisplayName || null,
    mock: IS_MOCK,
  });
}

// POST /api/music/spotify/disconnect
export async function handleSpotifyDisconnect(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  tokenStore.delete(userId);
  return json({ ok: true });
}

// GET /api/music/spotify/playlists
export async function handleSpotifyPlaylistsList(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  if (IS_MOCK || !tokenStore.has(userId)) {
    return json({
      playlists: MOCK_PLAYLISTS,
      mock: true,
    });
  }

  try {
    const res = await spotifyApi(userId, "/me/playlists?limit=50");
    const data = await res.json() as {
      items: Array<{
        id: string;
        name: string;
        description: string;
        tracks: { total: number };
        images: Array<{ url: string }>;
        owner: { display_name?: string };
      }>;
    };

    const playlists = data.items.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      trackCount: p.tracks.total,
      imageUrl: p.images?.[0]?.url || "",
      owner: p.owner?.display_name || "Unknown",
    }));

    return json({ playlists, mock: false });
  } catch (err) {
    console.error("Spotify playlists error:", err);
    return json({ error: "Failed to fetch Spotify playlists" }, 500);
  }
}

// POST /api/music/spotify/playlists/:id/import
export async function handleSpotifyPlaylistImport(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const playlistId = pathParts[pathParts.indexOf("spotify") + 2]; // /api/music/spotify/playlists/:id/import
  if (!playlistId) return json({ error: "Missing playlist ID" }, 400);

  const db = getDb();

  // Find mock or real playlist
  const mockPlaylist = MOCK_PLAYLISTS.find((p) => p.id === playlistId);
  let tracks: SpotifyTrackRef[];

  if (IS_MOCK || !tokenStore.has(userId)) {
    if (!mockPlaylist) return json({ error: "Playlist not found" }, 404);
    tracks = (MOCK_TRACKS[playlistId] || []).map((t) => ({ ...t, url: `https://open.spotify.com/track/${t.id}` }));
  } else {
    try {
      const res = await spotifyApi(userId, `/playlists/${playlistId}/tracks?limit=100`);
      const data = await res.json() as {
        items: Array<{
          track: {
            id: string;
            name: string;
            artists: Array<{ name: string }>;
            album: { name: string };
            external_ids?: { isrc?: string };
            duration_ms: number;
            external_urls?: { spotify: string };
          };
        }>;
      };

      const playlistInfoRes = await spotifyApi(userId, `/playlists/${playlistId}`);
      const playlistInfo = await playlistInfoRes.json() as { name: string; description: string };

      tracks = data.items.map((item) => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(", "),
        album: item.track.album.name,
        isrc: item.track.external_ids?.isrc,
        durationMs: item.track.duration_ms,
        url: item.track.external_urls?.spotify || `https://open.spotify.com/track/${item.track.id}`,
      }));

      // Use real playlist name
      if (!mockPlaylist) {
        const tempName = playlistInfo.name;
        const tempDesc = playlistInfo.description || "";
        const result = await db.run(
          "INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)",
          [userId, tempName, tempDesc],
        );
        const catalogPlaylistId = Number(result.lastInsertRowid);
        return importTracksToCatalog(db, userId, catalogPlaylistId, tracks);
      }
    } catch (err) {
      console.error("Spotify import error:", err);
      return json({ error: "Failed to import playlist from Spotify" }, 500);
    }
  }

  // Mock path or having found mock playlist
  const playlistName = mockPlaylist?.name || "Imported Playlist";
  const playlistDesc = mockPlaylist?.description || "";

  const result = await db.run(
    "INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)",
    [userId, playlistName, playlistDesc],
  );
  const catalogPlaylistId = Number(result.lastInsertRowid);

  return importTracksToCatalog(db, userId, catalogPlaylistId, tracks);
}

async function importTracksToCatalog(
  db: any,
  userId: number,
  catalogPlaylistId: number,
  tracks: SpotifyTrackRef[],
): Promise<Response> {
  let imported = 0;
  let matched = 0;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];

    // Check if track exists by title + artist
    let trackRow = await db.query(
      "SELECT id FROM tracks WHERE title = ? AND artist = ? AND user_id = ?",
    ).get(track.title, track.artist, userId) as { id: number } | undefined;

    if (!trackRow) {
      const tr = await db.run(
        "INSERT INTO tracks (user_id, filename, title, artist, album, duration, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [userId, track.title + ".mp3", track.title, track.artist, track.album, track.durationMs / 1000, "", 0, "audio/mpeg"],
      );
      trackRow = { id: Number(tr.lastInsertRowid) };
      imported++;
    } else {
      matched++;
    }

    await db.run(
      "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)",
      [catalogPlaylistId, trackRow.id, i],
    );
  }

  return json({
    playlist: { id: catalogPlaylistId },
    imported,
    matched,
    total: tracks.length,
  });
}

// POST /api/music/spotify/playlists/export
export async function handleSpotifyPlaylistExport(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const body = await req.json().catch(() => ({})) as { playlistId?: number };
  const { playlistId } = body;
  if (!playlistId) return json({ error: "Missing playlistId" }, 400);

  const db = getDb();

  // Get playlist
  const playlist = await db.query(
    "SELECT id, name, user_id FROM playlists WHERE id = ?",
  ).get(playlistId) as { id: number; name: string; user_id: number } | undefined;

  if (!playlist) return json({ error: "Playlist not found" }, 404);
  if (playlist.user_id !== userId) return json({ error: "Not your playlist" }, 403);

  // Get tracks
  const tracks = await db.query(
    `SELECT t.id, t.title, t.artist, t.album FROM tracks t
     JOIN playlist_tracks pt ON pt.track_id = t.id
     WHERE pt.playlist_id = ?
     ORDER BY pt.position`,
  ).all(playlistId) as CatalogTrackRef[];

  if (IS_MOCK || !tokenStore.has(userId)) {
    // Mock: simulate matching
    const matched: Array<{ trackId: number; title: string; spotifyTrackId: string }> = [];
    const unmatched: Array<{ trackId: number; title: string }> = [];

    for (const track of tracks) {
      const title = track.title || "Unknown";
      if (Math.random() > 0.3) {
        matched.push({
          trackId: track.id,
          title,
          spotifyTrackId: "spotify-mock-" + crypto.randomUUID().slice(0, 8),
        });
      } else {
        unmatched.push({ trackId: track.id, title });
      }
    }

    const spotifyUrl = "https://open.spotify.com/playlist/" + crypto.randomUUID().slice(0, 8);

    return json({
      success: true,
      spotifyUrl,
      spotifyPlaylistId: "mock-sp-pl-" + Date.now(),
      matched: matched.length,
      unmatched: unmatched.length,
      total: tracks.length,
    });
  }

  // Real mode — search Spotify for each track and create playlist
  try {
    // Search for tracks on Spotify
    const spotifyTrackIds: string[] = [];
    const matched: Array<{ trackId: number; title: string; spotifyTrackId: string }> = [];
    const unmatched: Array<{ trackId: number; title: string }> = [];

    for (const track of tracks) {
      const query = track.artist
        ? `track:${track.title} artist:${track.artist}`
        : `track:${track.title}`;

      try {
        const res = await spotifyApi(
          userId,
          `/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
        );
        const data = await res.json() as {
          tracks: { items: Array<{ id: string }> };
        };

        if (data.tracks?.items?.length > 0) {
          const spotifyId = data.tracks.items[0].id;
          spotifyTrackIds.push(spotifyId);
          matched.push({ trackId: track.id, title: track.title || "Unknown", spotifyTrackId: spotifyId });
        } else {
          unmatched.push({ trackId: track.id, title: track.title || "Unknown" });
        }
      } catch {
        unmatched.push({ trackId: track.id, title: track.title || "Unknown" });
      }
    }

    // Create Spotify playlist
    const createRes = await spotifyApi(userId, "/me/playlists", {
      method: "POST",
      body: {
        name: playlist.name,
        description: "Exported from CataLog",
        public: false,
      },
    });

    const created = await createRes.json() as { id: string; external_urls: { spotify: string } };

    // Add tracks
    if (spotifyTrackIds.length > 0) {
      await spotifyApi(userId, `/playlists/${created.id}/tracks`, {
        method: "POST",
        body: { uris: spotifyTrackIds.map((id) => `spotify:track:${id}`) },
      });
    }

    return json({
      success: true,
      spotifyUrl: created.external_urls.spotify,
      spotifyPlaylistId: created.id,
      matched: matched.length,
      unmatched: unmatched.length,
      total: tracks.length,
    });
  } catch (err) {
    console.error("Spotify export error:", err);
    return json({ error: "Failed to export playlist to Spotify" }, 500);
  }
}

// GET /api/music/spotify/search?q=xxx
export async function handleSpotifyTrackSearch(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const type = (url.searchParams.get("type") as "isrc" | "track") || "track";

  if (IS_MOCK || !tokenStore.has(userId)) {
    const results = mockSearchSpotify(q, type);
    return json({ results, mock: true });
  }

  try {
    const searchQuery = type === "isrc" ? `isrc:${q}` : q;
    const res = await spotifyApi(
      userId,
      `/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5`,
    );
    const data = await res.json() as {
      tracks: {
        items: Array<{
          id: string;
          name: string;
          artists: Array<{ name: string }>;
          album: { name: string };
          external_ids?: { isrc?: string };
          duration_ms: number;
          external_urls: { spotify: string };
        }>;
      };
    };

    const results: SpotifyTrackRef[] = data.tracks.items.map((item) => ({
      id: item.id,
      title: item.name,
      artist: item.artists.map((a) => a.name).join(", "),
      album: item.album.name,
      isrc: item.external_ids?.isrc,
      durationMs: item.duration_ms,
      url: item.external_urls.spotify,
    }));

    return json({ results, mock: false });
  } catch (err) {
    console.error("Spotify search error:", err);
    return json({ results: [], mock: false, error: "Search failed" });
  }
}
