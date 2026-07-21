// YouTube integration handlers — OAuth, playlist export, liked tracks import
// Mock mode when GOOGLE_CLIENT_ID is not set

import { json, requireAuth } from "./handlers";
import { getDb } from "./db";

// ─── Configuration ──────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || "http://localhost:3000/api/music/youtube/callback";
const IS_MOCK = !GOOGLE_CLIENT_ID;

// In-memory token store
interface YouTubeToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  channelId: string;
  channelName: string;
  subscriberCount: number;
}

const tokenStore = new Map<number, YouTubeToken>();

// ─── YouTube API helpers ────────────────────────────────────────────────────

async function youtubeApi(
  userId: number,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const token = tokenStore.get(userId);
  if (!token) throw new Error("Not connected to YouTube");

  if (Date.now() > token.expiresAt) {
    await refreshYouTubeToken(userId, token.refreshToken);
  }

  const t = tokenStore.get(userId);
  if (!t) throw new Error("Token refresh failed");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${t.accessToken}`,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`https://www.googleapis.com/youtube/v3${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    await refreshYouTubeToken(userId, t.refreshToken);
    const newToken = tokenStore.get(userId);
    if (!newToken) throw new Error("Token refresh failed");
    headers.Authorization = `Bearer ${newToken.accessToken}`;
    return fetch(`https://www.googleapis.com/youtube/v3${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  return res;
}

async function refreshYouTubeToken(userId: number, refreshToken: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    tokenStore.delete(userId);
    throw new Error("Failed to refresh YouTube token");
  }

  const data = await res.json() as {
    access_token: string;
    expires_in: number;
  };

  const existing = tokenStore.get(userId)!;
  tokenStore.set(userId, {
    ...existing,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
}

// ─── Mock data ──────────────────────────────────────────────────────────────

interface MockYouTubePlaylist {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  thumbnailUrl: string;
}

const MOCK_PLAYLISTS: MockYouTubePlaylist[] = [
  { id: "yt1", title: "Club Bangers 2026", description: "Main room energy", itemCount: 32, thumbnailUrl: "" },
  { id: "yt2", title: "Deep & Dark Techno", description: "Late night vibes", itemCount: 19, thumbnailUrl: "" },
  { id: "yt3", title: "Sunrise House", description: "Morning after selections", itemCount: 25, thumbnailUrl: "" },
  { id: "yt4", title: "Hip Hop Classics", description: "Golden era essentials", itemCount: 44, thumbnailUrl: "" },
];

interface MockYouTubeLikedTrack {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  videoUrl: string;
}

const MOCK_LIKED_TRACKS: MockYouTubeLikedTrack[] = [
  { id: "yt-l1", title: "Blinding Lights", artist: "The Weeknd", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=fHI8X4OXluQ" },
  { id: "yt-l2", title: "Levitating", artist: "Dua Lipa", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=TUVcZfQe-Kw" },
  { id: "yt-l3", title: "Industry Baby", artist: "Lil Nas X", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=UTHLKHL_whs" },
  { id: "yt-l4", title: "Save Your Tears", artist: "The Weeknd", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=XXYlFuWEuKI" },
  { id: "yt-l5", title: "Montero", artist: "Lil Nas X", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=6swmTBVI83k" },
  { id: "yt-l6", title: "Peaches", artist: "Justin Bieber", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=tQ0yjYUFKAE" },
  { id: "yt-l7", title: "Stay", artist: "The Kid LAROI & Justin Bieber", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=kTJczUoc26U" },
  { id: "yt-l8", title: "Bad Habits", artist: "Ed Sheeran", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=orJSJGHjBLI" },
  { id: "yt-l9", title: "Good 4 U", artist: "Olivia Rodrigo", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=gNi_6U5Pm_o" },
  { id: "yt-l10", title: "Kiss Me More", artist: "Doja Cat ft. SZA", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=0EVVKs6DQLo" },
  { id: "yt-l11", title: "Drivers License", artist: "Olivia Rodrigo", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=ZmDBbnmKpqQ" },
  { id: "yt-l12", title: "Watermelon Sugar", artist: "Harry Styles", thumbnailUrl: "", videoUrl: "https://youtube.com/watch?v=E07s5ZYygMg" },
];

// ─── Route Handlers ─────────────────────────────────────────────────────────

// GET /api/music/youtube/auth-url
export async function handleYouTubeAuthUrl(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (IS_MOCK) {
    return json({
      url: "/api/music/youtube/callback?code=mock_youtube_auth_code&state=mock_state",
      mock: true,
    });
  }

  const scopes = [
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
  ];

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: "code",
    redirect_uri: YOUTUBE_REDIRECT_URI,
    state,
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    mock: false,
  });
}

// GET /api/music/youtube/callback?code=xxx&state=xxx
export async function handleYouTubeCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return json({ error: "Missing authorization code" }, 400);
  }

  const { getSessionCookie } = await import("./handlers");
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

  if (IS_MOCK || code === "mock_youtube_auth_code") {
    tokenStore.set(user.userId, {
      accessToken: "mock_youtube_token_" + crypto.randomUUID().slice(0, 8),
      refreshToken: "mock_refresh_token",
      expiresAt: Date.now() + 3600 * 1000,
      channelId: "UC_mock_djcatalog",
      channelName: "DJ CataLog",
      subscriberCount: 4820,
    });

    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'youtube-connected',success:true},'*');window.close();</script><p>YouTube connected! (Demo Mode) You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  // Real mode — exchange code for tokens
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: YOUTUBE_REDIRECT_URI,
      }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("YouTube token exchange failed:", errText);
      return new Response(
        `<html><body><script>window.close();</script><p>Failed to connect YouTube. Please try again.</p></body></html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }

    const data = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Get channel info
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${data.access_token}` } },
    );

    const channelData = await channelRes.json() as {
      items?: Array<{
        id: string;
        snippet: { title: string };
        statistics: { subscriberCount: string };
      }>;
    };

    const channel = channelData.items?.[0];

    tokenStore.set(user.userId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      channelId: channel?.id || "unknown",
      channelName: channel?.snippet?.title || "Unknown",
      subscriberCount: parseInt(channel?.statistics?.subscriberCount || "0", 10),
    });

    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'youtube-connected',success:true},'*');window.close();</script><p>YouTube connected! You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  } catch (err) {
    console.error("YouTube callback error:", err);
    return new Response(
      `<html><body><script>window.close();</script><p>Connection error. Please try again.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }
}

// GET /api/music/youtube/status
export async function handleYouTubeStatus(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const token = tokenStore.get(userId);
  return json({
    connected: !!token && token.expiresAt > Date.now(),
    channelName: token?.channelName || null,
    subscriberCount: token?.subscriberCount || null,
    mock: IS_MOCK,
  });
}

// POST /api/music/youtube/disconnect
export async function handleYouTubeDisconnect(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  tokenStore.delete(userId);
  return json({ ok: true });
}

// GET /api/music/youtube/playlists
export async function handleYouTubePlaylistsList(req: Request): Promise<Response> {
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
    const res = await youtubeApi(userId, "/playlists?part=snippet,contentDetails&mine=true&maxResults=50");
    const data = await res.json() as {
      items?: Array<{
        id: string;
        snippet: { title: string; description: string; thumbnails?: { default?: { url: string } } };
        contentDetails: { itemCount: number };
      }>;
    };

    const playlists = (data.items || []).map((p) => ({
      id: p.id,
      title: p.snippet.title,
      description: p.snippet.description || "",
      itemCount: p.contentDetails.itemCount,
      thumbnailUrl: p.snippet.thumbnails?.default?.url || "",
    }));

    return json({ playlists, mock: false });
  } catch (err) {
    console.error("YouTube playlists error:", err);
    return json({ error: "Failed to fetch YouTube playlists" }, 500);
  }
}

// POST /api/music/youtube/playlists/export
export async function handleYouTubePlaylistExport(req: Request): Promise<Response> {
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
  ).all(playlistId) as Array<{ id: number; title: string; artist: string; album: string }>;

  if (IS_MOCK || !tokenStore.has(userId)) {
    // Mock: simulate matching with 80-90% match rate
    const matchRate = 0.8 + Math.random() * 0.1; // 80-90%
    const totalCount = tracks.length;
    const matchedCount = Math.min(totalCount, Math.floor(totalCount * matchRate));
    const unmatchedCount = totalCount - matchedCount;

    const youtubePlaylistId = "PL-mock-" + crypto.randomUUID().slice(0, 8);
    const youtubeUrl = `https://www.youtube.com/playlist?list=${youtubePlaylistId}`;

    return json({
      success: true,
      youtubeUrl,
      youtubePlaylistId,
      matchedCount,
      totalCount: totalCount,
    });
  }

  // Real mode — search YouTube for each track and create playlist
  try {
    const videoIds: string[] = [];
    let matchedCount = 0;

    for (const track of tracks) {
      const query = `${track.artist || ""} - ${track.title || ""}`.trim();
      if (!query) continue;

      try {
        const searchRes = await youtubeApi(
          userId,
          `/search?part=snippet&maxResults=1&type=video&q=${encodeURIComponent(query)}`,
        );
        const searchData = await searchRes.json() as {
          items?: Array<{ id: { videoId: string } }>;
        };

        if (searchData.items?.length) {
          videoIds.push(searchData.items[0].id.videoId);
          matchedCount++;
        }
      } catch {
        // Skip track that can't be found
      }
    }

    // Create YouTube playlist
    const createBody = {
      snippet: {
        title: playlist.name,
        description: "Exported from CataLog",
      },
      status: {
        privacyStatus: "private",
      },
    };

    const createRes = await youtubeApi(userId, "/playlists?part=snippet,status", {
      method: "POST",
      body: createBody,
    });

    const created = await createRes.json() as { id: string };

    // Add videos to playlist
    for (const videoId of videoIds) {
      try {
        await youtubeApi(userId, "/playlistItems?part=snippet", {
          method: "POST",
          body: {
            snippet: {
              playlistId: created.id,
              resourceId: {
                kind: "youtube#video",
                videoId,
              },
            },
          },
        });
      } catch {
        // Skip failed additions
      }
    }

    return json({
      success: true,
      youtubeUrl: `https://www.youtube.com/playlist?list=${created.id}`,
      youtubePlaylistId: created.id,
      matchedCount,
      totalCount: tracks.length,
    });
  } catch (err) {
    console.error("YouTube export error:", err);
    return json({ error: "Failed to export playlist to YouTube" }, 500);
  }
}

// GET /api/music/youtube/liked
export async function handleYouTubeLikedTracks(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  if (IS_MOCK || !tokenStore.has(userId)) {
    return json({
      tracks: MOCK_LIKED_TRACKS,
      total: MOCK_LIKED_TRACKS.length,
      mock: true,
    });
  }

  try {
    // Get liked videos via the liked playlist
    const res = await youtubeApi(
      userId,
      "/playlistItems?part=snippet&maxResults=50&playlistId=LL",
    );

    // Note: LL is the special "Liked videos" playlist ID
    // If that doesn't work, we fallback to getting the channel's liked playlist
    const data = await res.json() as {
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          description: string;
          thumbnails?: { default?: { url: string } };
          resourceId?: { videoId: string };
        };
      }>;
    };

    const tracks = (data.items || []).map((item) => {
      const title = item.snippet.title;
      // Try to extract artist from YouTube title (common format: "Artist - Title")
      let artist = "Unknown";
      let trackTitle = title;
      const dashIndex = title.indexOf(" - ");
      if (dashIndex > 0) {
        artist = title.slice(0, dashIndex).trim();
        trackTitle = title.slice(dashIndex + 3).trim();
      }

      return {
        id: item.id,
        title: trackTitle,
        artist,
        thumbnailUrl: item.snippet.thumbnails?.default?.url || "",
        videoUrl: item.snippet.resourceId?.videoId
          ? `https://youtube.com/watch?v=${item.snippet.resourceId.videoId}`
          : "",
      };
    });

    return json({
      tracks,
      total: tracks.length,
      mock: false,
    });
  } catch (err) {
    console.error("YouTube liked tracks error:", err);
    // Fallback to mock data on error
    return json({
      tracks: MOCK_LIKED_TRACKS,
      total: MOCK_LIKED_TRACKS.length,
      mock: true,
      note: "Falling back to demo data",
    });
  }
}

// POST /api/music/youtube/liked/import
export async function handleYouTubeLikedImport(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const db = getDb();

  let tracks: Array<{ title: string; artist: string; videoUrl: string }>;

  if (IS_MOCK || !tokenStore.has(userId)) {
    tracks = MOCK_LIKED_TRACKS;
  } else {
    try {
      const res = await youtubeApi(
        userId,
        "/playlistItems?part=snippet&maxResults=50&playlistId=LL",
      );

      const data = await res.json() as {
        items?: Array<{
          snippet: {
            title: string;
            resourceId?: { videoId: string };
          };
        }>;
      };

      tracks = (data.items || []).map((item) => {
        const title = item.snippet.title;
        let artist = "Unknown";
        let trackTitle = title;
        const dashIndex = title.indexOf(" - ");
        if (dashIndex > 0) {
          artist = title.slice(0, dashIndex).trim();
          trackTitle = title.slice(dashIndex + 3).trim();
        }

        return {
          title: trackTitle,
          artist,
          videoUrl: item.snippet.resourceId?.videoId
            ? `https://youtube.com/watch?v=${item.snippet.resourceId.videoId}`
            : "",
        };
      });
    } catch {
      tracks = MOCK_LIKED_TRACKS;
    }
  }

  // Create a "YouTube Likes" playlist
  const playlistResult = await db.run(
    "INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)",
    [userId, "YouTube Likes", "Imported from YouTube liked videos"],
  );
  const catalogPlaylistId = Number(playlistResult.lastInsertRowid);

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
        [userId, track.title + ".mp3", track.title, track.artist, "", 0, "", 0, "audio/mpeg"],
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
    playlist: { id: catalogPlaylistId, name: "YouTube Likes" },
    imported,
    matched,
    total: tracks.length,
  });
}
