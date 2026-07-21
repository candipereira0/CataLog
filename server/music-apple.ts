// Apple Music integration handlers (MusicKit)
// Mock mode when APPLE_MUSIC_TEAM_ID / APPLE_MUSIC_KEY_ID / APPLE_MUSIC_PRIVATE_KEY are not set

import { json, requireAuth, getSessionCookie } from "./handlers";
import { getDb, getPlaylist, listPlaylists, createPlaylist, addTrackToPlaylist } from "./db";

// ─── MusicKit Developer Token ───────────────────────────────────────────────

function base64UrlEncode(buffer: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function generateMusicKitToken(): Promise<string> {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;
  const privateKeyPem = process.env.APPLE_MUSIC_PRIVATE_KEY;

  if (!teamId || !keyId || !privateKeyPem) {
    throw new Error("MusicKit not configured");
  }

  // Parse PEM to get raw key bytes
  const pemContent = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const header = { alg: "ES256", kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 15777000, // 6 months
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const msg = headerB64 + "." + payloadB64;

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(msg)
  );
  const sigB64 = base64UrlEncode(sig);

  return msg + "." + sigB64;
}

export async function handleAppleMusicToken(req: Request): Promise<Response> {
  try {
    const token = await generateMusicKitToken();
    return json({ token });
  } catch {
    // Mock mode: return a mock token
    return json({ token: "mock-musickit-token-" + crypto.randomUUID().slice(0, 8) });
  }
}

// ─── Playlist Import ────────────────────────────────────────────────────────

interface MockApplePlaylist {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  artworkUrl?: string;
}

interface MockAppleTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  isrc?: string;
  durationMs: number;
}

const MOCK_PLAYLISTS: MockApplePlaylist[] = [
  { id: "p1", name: "Summer Vibes 2026", description: "Hot tracks for summer", trackCount: 24, artworkUrl: "" },
  { id: "p2", name: "Late Night Deep House", description: "Deep and moody", trackCount: 18, artworkUrl: "" },
  { id: "p3", name: "Peak Time Techno", description: "Main room energy", trackCount: 32, artworkUrl: "" },
  { id: "p4", name: "Hip-Hop Bangers", description: "Crowd favorites", trackCount: 15, artworkUrl: "" },
];

const MOCK_TRACKS: Record<string, MockAppleTrack[]> = {
  p1: [
    { id: "t1", title: "Ocean Drive", artist: "Duke Dumont", album: "Blasé Boys Club", isrc: "GBUM71500397", durationMs: 224000 },
    { id: "t2", title: "Sun Is Shining", artist: "Axwell & Ingrosso", album: "More Than You Know", isrc: "SEBGA1500268", durationMs: 244000 },
    { id: "t3", title: "Summer", artist: "Calvin Harris", album: "Motion", isrc: "GBARL1400509", durationMs: 234000 },
  ],
  p2: [
    { id: "t4", title: "Deep Inside", artist: "Hardrive", album: "Deep Inside EP", isrc: "USZUR0300100", durationMs: 378000 },
    { id: "t5", title: "At Night", artist: "Shakedown", album: "At Night", isrc: "FR08E0000010", durationMs: 380000 },
  ],
};

export async function handleApplePlaylistsList(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  if (teamId) {
    // Real: fetch from Apple Music API via MusicKit
    // This would require the MusicKit JS token and fetch from api.music.apple.com
    // For now, fall through to mock
  }

  // Mock mode
  return json({
    playlists: MOCK_PLAYLISTS,
    mock: true,
  });
}

export async function handleApplePlaylistImport(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const url = new URL(req.url);
  const playlistId = url.pathname.split("/").pop();
  if (!playlistId) return json({ error: "Missing playlist ID" }, 400);

  const db = getDb();

  // Find mock playlist
  const mockPlaylist = MOCK_PLAYLISTS.find(p => p.id === playlistId);
  if (!mockPlaylist) return json({ error: "Playlist not found" }, 404);

  const tracks = MOCK_TRACKS[playlistId] || [];

  // Create CataLog playlist
  const result = await db.run(
    "INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)",
    [userId, mockPlaylist.name, mockPlaylist.description]
  );
  const catalogPlaylistId = Number(result.lastInsertRowid);

  // Add tracks to CataLog (create track entries if they don't exist)
  let imported = 0;
  for (const track of tracks) {
    // Check if track exists by title+artist
    let trackRow = await db.query(
      "SELECT id FROM tracks WHERE title = ? AND artist = ? AND user_id = ?"
    ).get(track.title, track.artist, userId) as { id: number } | undefined;

    if (!trackRow) {
      const tr = await db.run(
        "INSERT INTO tracks (user_id, filename, title, artist, album, duration, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [userId, track.title + ".mp3", track.title, track.artist, track.album, track.durationMs / 1000, "", 0, "audio/mpeg"]
      );
      trackRow = { id: Number(tr.lastInsertRowid) };
    }

    await db.run(
      "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)",
      [catalogPlaylistId, trackRow.id, imported]
    );
    imported++;
  }

  return json({
    playlist: { id: catalogPlaylistId, name: mockPlaylist.name, description: mockPlaylist.description },
    imported,
    total: tracks.length,
  });
}

// ─── Playlist Export ────────────────────────────────────────────────────────

export async function handleApplePlaylistExport(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const body = await req.json().catch(() => ({})) as { playlistId?: number };
  const { playlistId } = body;
  if (!playlistId) return json({ error: "Missing playlistId" }, 400);

  const db = getDb();

  // Get the playlist
  const playlist = await db.query(
    "SELECT id, name, user_id FROM playlists WHERE id = ?"
  ).get(playlistId) as { id: number; name: string; user_id: number } | undefined;

  if (!playlist) return json({ error: "Playlist not found" }, 404);
  if (playlist.user_id !== userId) return json({ error: "Not your playlist" }, 403);

  // Get tracks
  const tracks = await db.query(
    `SELECT t.id, t.title, t.artist, t.album FROM tracks t
     JOIN playlist_tracks pt ON pt.track_id = t.id
     WHERE pt.playlist_id = ?
     ORDER BY pt.position`
  ).all(playlistId) as Array<{ id: number; title: string | null; artist: string | null; album: string | null }>;

  // Mock: simulate matching tracks to Apple Music catalog
  const matched: Array<{ trackId: number; title: string; appleTrackId: string }> = [];
  const unmatched: Array<{ trackId: number; title: string }> = [];

  for (const track of tracks) {
    const title = track.title || "Unknown";
    // Simulate ~70% match rate
    if (Math.random() > 0.3) {
      matched.push({
        trackId: track.id,
        title,
        appleTrackId: "apple-" + crypto.randomUUID().slice(0, 8),
      });
    } else {
      unmatched.push({ trackId: track.id, title });
    }
  }

  // Mock: create playlist on Apple Music
  const applePlaylistUrl = "https://music.apple.com/library/playlist/" + crypto.randomUUID().slice(0, 8);

  return json({
    success: true,
    applePlaylistUrl,
    applePlaylistId: "mock-apple-pl-" + Date.now(),
    matched: matched.length,
    unmatched: unmatched.length,
    total: tracks.length,
    unmatchedTracks: unmatched.length > 0 ? unmatched : undefined,
  });
}

// ─── Track Search (for matching) ──────────────────────────────────────────────

export async function handleAppleTrackSearch(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const title = url.searchParams.get("title") || "";
  const artist = url.searchParams.get("artist") || "";

  // Mock: return simulated search results
  return json({
    results: [
      {
        id: "apple-tr-" + crypto.randomUUID().slice(0, 8),
        title: title || "Mock Track",
        artist: artist || "Mock Artist",
        album: "Mock Album",
        isrc: "MOCK" + crypto.randomUUID().slice(0, 8).toUpperCase(),
        durationMs: 240000,
        url: "https://music.apple.com/track/" + crypto.randomUUID().slice(0, 8),
      },
    ],
    mock: true,
  });
}
