// Shared API route handlers used by both server.ts (dev) and serve.ts (prod)

import {
  getDb, getUserFromSession, createSession, deleteSession,
  insertTrack, getTrack, listTracks, updateTrack, deleteTrack as deleteTrackFromDb,
  createPlaylist, listPlaylists, getPlaylist, deletePlaylist,
  addTrackToPlaylist, removeTrackFromPlaylist,
  createTag, listTags, attachTag, detachTag, getTrackTags,
  getGenres, getKeys,
  addTrackGenres, removeTrackGenre, getTrackGenres, getTracksWithGenres,
  createShare, getShareByToken, deleteShare,
  updateTrackSyncStatus, getSyncStatus,
  createPayment, completePayment, getUserPaymentHistory, updateUserTier,
  getCompatibleTracks, incrementPlayCount,
  insertIdentification, markIdentificationAdded, getRecentIdentifications, insertShazamTrack,
  getUserProfile, getFeaturedPlaylists, getRecentActivity, getUserTagCloud,
  checkHandleAvailable, updateUserProfile,
  followUser, unfollowUser, isFollowing, getFollowers, getFollowing,
  getPublicUsers,
  addCollaborator, removeCollaborator, getCollaborators,
  canAccessPlaylist,
  getUserById, getUserByHandle,
  type IdentificationRow,
  // Post & notification helpers
  createPost, getPostsByUser, getFeedPosts, getPostById, deletePost, likePost, unlikePost,
  createNotification, getNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount, getFollowerCount,
  // Tip helpers
  getTipLinks, getAllTipLinks, upsertTipLink, recordTip, getTipsReceived, getTipsGiven, getPlaylistTipCount,
  // Artist helpers
  insertArtistTrack, getArtistTrack, listArtistTracksByUser, listAllPublishedArtistTracks,
  updateArtistTrack, deleteArtistTrack,
  incrementArtistTrackPlayCount, incrementArtistTrackDownloadCount,
  attachArtistTrackTag, detachArtistTrackTag, getArtistTrackTags, getArtistGenres,
  getArtistLinks, upsertArtistLink, deleteArtistLink,
  updateArtistProfile, getUserArtistProfile,
  type ArtistTrackRow, type ArtistLinkRow,
  // Device helpers
  registerDevice, updateDeviceLastSeen, listUserDevices, deleteDevice,
  getDeviceBySession, getDevice,
  createDeviceAction, getPendingActions, completeDeviceAction,
  type DeviceRow, type DeviceActionRow,
  // Venue & Gig helpers
  createVenue, getVenue, listVenues, getUserVenues,
  createGig, getGig, updateGig, deleteGig, getVenueGigs, getUserGigs,
  pushSetlistToVenue,
  type VenueRow, type GigRow,
  // User genre helpers
  getUserGenresByHandle, setUserGenres, searchUsersByGenres,
} from "./db";
import { generateExport, type ExportFormat, EXPORT_CONTENT_TYPES, EXPORT_EXTENSIONS } from "./export";
import { analyzeAudio } from "./analysis";
import { aiTagTrack, aiGeneratePlaylist, aiSearchLibrary, aiSuggestTracks, aiDiscoverArtists, type TrackMetadata, type LibrarySummary } from "./ai";
import { getCompatibleKeys, getKeyDistance, toCamelot, estimateEnergy } from "./camelot";
import { identifyTrack } from "./shazam";
import { getLightParams } from "./light-sync";
import { syncLights, connectBridge, getStatus as getHueStatus } from "./hue";
import { getOscClientCount } from "./osc";
import { addClient, removeClient, broadcastToUser, getPollingEvents, getClientCount, type SyncEvent } from "./sse-manager";
import { getAllGenres, searchGenres, getGenreHierarchy, getSubgenres, suggestFusionGenres } from "./genres";
import { discoverNewGenres, crossReferenceTrack, type DiscoveredGenre, type CrossReferenceResult } from "./genre-crawler";
import { generateDailyChallenge, generateRandomChallenge } from "./inspo";
import { existsSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const UPLOAD_DIR = join(import.meta.dir, "..", "data", "uploads");
const ARTIST_UPLOAD_DIR = join(import.meta.dir, "..", "data", "artist-uploads");
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function getSessionCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

export async function requireAuth(req: Request): Promise<{ userId: number; user: Record<string, unknown>; sessionId: string } | Response> {
  const sessionId = getSessionCookie(req);
  if (!sessionId) return json({ error: "Unauthorized" }, 401);
  const user = await getUserFromSession(sessionId);
  if (!user) {
    const resp = json({ error: "Unauthorized" }, 401);
    resp.headers.set("Set-Cookie", "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return resp;
  }
  // Lightweight: update device last_seen on every authenticated call
  await updateDeviceLastSeen(sessionId);
  return { userId: user.id as number, user, sessionId };
}

async function parseBody(req: Request) {
  return req.json().catch(() => ({}));
}

// ─── Auth Handlers ───

export async function handleAuthRegister(req: Request): Promise<Response> {
  const body = (await parseBody(req)) as { email?: string; password?: string; display_name?: string };
  const { email, password, display_name } = body;
  if (!email || !password) return json({ error: "Email and password are required" }, 400);
  if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
  if (!email.includes("@")) return json({ error: "Invalid email address" }, 400);

  const db = getDb();
  const existing = await db.query("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return json({ error: "Email already registered" }, 409);

  const passwordHash = Bun.password.hashSync(password);
  const displayName = display_name || email.split("@")[0];

  // Auto-generate handle from display_name
  let handle = displayName.toLowerCase().replace(/[^a-z0-9_-]/g, "").replace(/_{2,}/g, "_").replace(/^[_-]+|[_-]+$/g, "").slice(0, 30) || "user";
  // Ensure handle is at least 3 chars
  while (handle.length < 3) handle += "0";
  // If handle is taken, append numbers
  let suffix = 0;
  let candidate = handle;
  while (await db.query("SELECT id FROM users WHERE handle = ?").get(candidate)) {
    suffix++;
    candidate = handle + suffix;
  }
  handle = candidate;

  const result = await db.run(
    "INSERT INTO users (email, password_hash, display_name, handle) VALUES (?, ?, ?, ?)",
    [email, passwordHash, displayName, handle]
  );

  const userId = Number(result.lastInsertRowid);
  const sessionId = await createSession(userId);

  const user = { id: userId, email, display_name: displayName, handle, tier: "free" };
  const resp = json({ user }, 201);
  resp.headers.set("Set-Cookie", `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`);
  return resp;
}

export async function handleAuthLogin(req: Request): Promise<Response> {
  const body = (await parseBody(req)) as { email?: string; password?: string };
  const { email, password } = body;
  if (!email || !password) return json({ error: "Email and password are required" }, 400);

  const db = getDb();
  const row = await db.query(
    "SELECT id, email, password_hash, display_name, handle, tier FROM users WHERE email = ?"
  ).get(email) as { id: number; email: string; password_hash: string; display_name: string; handle: string | null; tier: string } | undefined;
  if (!row) return json({ error: "Invalid email or password" }, 401);

  const valid = Bun.password.verifySync(password, row.password_hash);
  if (!valid) return json({ error: "Invalid email or password" }, 401);

  const sessionId = await createSession(row.id);
  const user = { id: row.id, email: row.email, display_name: row.display_name, handle: row.handle, tier: row.tier };
  const resp = json({ user });
  resp.headers.set("Set-Cookie", `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`);
  return resp;
}

export async function handleAuthLogout(req: Request): Promise<Response> {
  const sessionId = getSessionCookie(req);
  if (sessionId) {
    await deleteSession(sessionId);
  }
  const resp = json({ ok: true });
  resp.headers.set("Set-Cookie", "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  return resp;
}

export async function handleAuthMe(req: Request): Promise<Response> {
  const sessionId = getSessionCookie(req);
  if (!sessionId) return json({ user: null });
  const user = await getUserFromSession(sessionId);
  if (!user) {
    const resp = json({ user: null });
    resp.headers.set("Set-Cookie", "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return resp;
  }
  return json({ user });
}

// ─── Google Auth Handler ───

export async function handleAuthGoogle(req: Request): Promise<Response> {
  const body = (await parseBody(req)) as { credential?: string };
  const { credential } = body;
  if (!credential) return json({ error: "Missing credential" }, 400);

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  let email: string;
  let displayName: string;

  // Mock mode: when GOOGLE_CLIENT_ID is not set
  if (!googleClientId && credential.startsWith("mock-")) {
    const parts = credential.replace("mock-", "").split("|");
    email = parts[0] || "google-demo@catalog.app";
    displayName = parts[1] || email.split("@")[0];
  } else if (googleClientId) {
    // Real: verify the Google ID token
    try {
      const tokenInfoResp = await fetch(
        "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential)
      );
      if (!tokenInfoResp.ok) {
        return json({ error: "Invalid Google token" }, 401);
      }
      const tokenInfo = (await tokenInfoResp.json()) as {
        email?: string;
        email_verified?: string;
        name?: string;
        aud?: string;
      };
      if (tokenInfo.aud !== googleClientId) {
        return json({ error: "Token audience mismatch" }, 401);
      }
      if (!tokenInfo.email || tokenInfo.email_verified !== "true") {
        return json({ error: "Email not verified by Google" }, 401);
      }
      email = tokenInfo.email;
      displayName = tokenInfo.name || email.split("@")[0];
    } catch {
      return json({ error: "Failed to verify Google token" }, 401);
    }
  } else {
    return json({ error: "Google sign-in is not configured. Use demo mode." }, 400);
  }

  const db = getDb();
  let row = await db.query(
    "SELECT id, email, display_name, handle, tier FROM users WHERE email = ?"
  ).get(email) as { id: number; email: string; display_name: string; handle: string | null; tier: string } | undefined;

  if (!row) {
    const randomPassword = crypto.randomUUID();
    const passwordHash = Bun.password.hashSync(randomPassword);
    let handle = displayName.toLowerCase().replace(/[^a-z0-9_-]/g, "").replace(/_{2,}/g, "_").replace(/^[_-]+|[_-]+$/g, "").slice(0, 30) || "user";
    while (handle.length < 3) handle += "0";
    let suffix = 0;
    let candidate = handle;
    while (await db.query("SELECT id FROM users WHERE handle = ?").get(candidate)) {
      suffix++;
      candidate = handle + suffix;
    }
    handle = candidate;
    const result = await db.run(
      "INSERT INTO users (email, password_hash, display_name, handle) VALUES (?, ?, ?, ?)",
      [email, passwordHash, displayName, handle]
    );
    row = {
      id: Number(result.lastInsertRowid),
      email,
      display_name: displayName,
      handle,
      tier: "free",
    };
  }

  const sessionId = await createSession(row.id);
  const user = { id: row.id, email: row.email, display_name: row.display_name, handle: row.handle, tier: row.tier };
  const resp = json({ user });
  resp.headers.set("Set-Cookie", "session=" + sessionId + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + (60 * 60 * 24 * 7));
  return resp;
}

// ─── Apple Auth Handler ───

async function verifyAppleToken(identityToken: string, appleClientId?: string): Promise<{ email?: string; sub?: string } | null> {
  // Mock mode
  if (identityToken.startsWith("mock-")) {
    const parts = identityToken.replace("mock-", "").split("|");
    return {
      email: parts[0] || "apple-demo@catalog.app",
      sub: parts[2] || "mock-apple-sub",
    };
  }

  // Real mode: decode JWT and verify
  try {
    const [headerB64, payloadB64] = identityToken.split(".");
    if (!headerB64 || !payloadB64) return null;

    // Decode payload
    const payloadJson = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    const payload = JSON.parse(payloadJson);

    // Basic validation
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      console.error("Apple token expired");
      return null;
    }
    if (payload.iss !== "https://appleid.apple.com") {
      console.error("Apple token: invalid issuer");
      return null;
    }
    if (appleClientId && payload.aud !== appleClientId) {
      console.error("Apple token: audience mismatch");
      return null;
    }

    // Attempt JWKS signature verification
    try {
      const header = JSON.parse(Buffer.from(headerB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"));
      const kid = header.kid;
      if (kid) {
        const jwksResp = await fetch("https://appleid.apple.com/auth/keys");
        if (jwksResp.ok) {
          const jwks = await jwksResp.json() as { keys: Array<{ kid: string; kty: string; n: string; e: string; use: string; alg: string }> };
          const key = jwks.keys.find(k => k.kid === kid);
          if (key) {
            const jwkKey: JsonWebKey = {
              kty: key.kty,
              n: key.n,
              e: key.e,
              alg: "RS256",
            };
            const cryptoKey = await crypto.subtle.importKey(
              "jwk",
              jwkKey,
              { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
              false,
              ["verify"]
            );
            const msg = new TextEncoder().encode(headerB64 + "." + payloadB64);
            const sigB64 = identityToken.split(".")[2] || "";
            const sigBytes = Uint8Array.from(
              Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64")
            );
            const valid = await crypto.subtle.verify(
              { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
              cryptoKey,
              sigBytes,
              msg
            );
            if (!valid) {
              console.error("Apple JWT signature verification failed");
              return null;
            }
          }
        }
      }
    } catch (verifyErr) {
      console.warn("Apple JWT verification skipped (JWKS error):", verifyErr);
      // Continue with basic validation only
    }

    return {
      email: payload.email,
      sub: payload.sub,
    };
  } catch (err) {
    console.error("Apple token decode error:", err);
    return null;
  }
}

export async function handleAuthApple(req: Request): Promise<Response> {
  const body = (await parseBody(req)) as { identityToken?: string; user?: string; fullName?: string; email?: string };
  const { identityToken, fullName, email: bodyEmail } = body;
  if (!identityToken) return json({ error: "Missing identityToken" }, 400);

  const appleClientId = process.env.APPLE_CLIENT_ID;

  // Verify the token
  const verified = await verifyAppleToken(identityToken, appleClientId);

  let email: string;
  let displayName: string;
  let appleSub: string | null = null;

  if (identityToken.startsWith("mock-")) {
    // Mock mode: parse token directly
    const parts = identityToken.replace("mock-", "").split("|");
    email = parts[0] || "apple-demo@catalog.app";
    displayName = parts[1] || fullName || email.split("@")[0];
    appleSub = parts[2] || "mock-apple-sub";
  } else {
    // Real mode: use verified token data
    if (!verified) {
      return json({ error: "Invalid Apple identity token" }, 401);
    }
    email = bodyEmail || verified.email || "";
    if (!email) {
      return json({ error: "Email not provided by Apple" }, 400);
    }
    displayName = fullName || email.split("@")[0];
    appleSub = verified.sub || null;
  }

  const db = getDb();

  // Look up by email first, then by apple_id
  let row = await db.query(
    "SELECT id, email, display_name, handle, tier FROM users WHERE email = ?"
  ).get(email) as { id: number; email: string; display_name: string; handle: string | null; tier: string } | undefined;

  if (!row && appleSub) {
    row = await db.query(
      "SELECT id, email, display_name, handle, tier FROM users WHERE apple_id = ?"
    ).get(appleSub) as { id: number; email: string; display_name: string; handle: string | null; tier: string } | undefined;
  }

  if (!row) {
    // Create new user
    const randomPassword = crypto.randomUUID();
    const passwordHash = Bun.password.hashSync(randomPassword);
    let handle = displayName.toLowerCase().replace(/[^a-z0-9_-]/g, "").replace(/_{2,}/g, "_").replace(/^[_-]+|[_-]+$/g, "").slice(0, 30) || "user";
    while (handle.length < 3) handle += "0";
    let suffix = 0;
    let candidate = handle;
    while (await db.query("SELECT id FROM users WHERE handle = ?").get(candidate)) {
      suffix++;
      candidate = handle + suffix;
    }
    handle = candidate;

    const result = await db.run(
      "INSERT INTO users (email, password_hash, display_name, handle, apple_id) VALUES (?, ?, ?, ?, ?)",
      [email, passwordHash, displayName, handle, appleSub]
    );
    row = {
      id: Number(result.lastInsertRowid),
      email,
      display_name: displayName,
      handle,
      tier: "free",
    };
  } else if (appleSub) {
    // Update apple_id if not set
    await db.run("UPDATE users SET apple_id = ? WHERE id = ? AND apple_id IS NULL", [appleSub, row.id]);
  }

  const sessionId = await createSession(row.id);
  const user = { id: row.id, email: row.email, display_name: row.display_name, handle: row.handle, tier: row.tier };
  const resp = json({ user });
  resp.headers.set("Set-Cookie", "session=" + sessionId + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + (60 * 60 * 24 * 7));
  return resp;
}


// ─── Track Handlers ───

export async function handleTrackUpload(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "Invalid form data" }, 400);
  }

  const files = formData.getAll("files");
  if (files.length === 0) return json({ error: "No files uploaded" }, 400);

  const results: Record<string, unknown>[] = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;
    if (file.size === 0) continue;
    if (file.size > MAX_FILE_SIZE) {
      results.push({ filename: file.name, error: "File too large (max 100MB)" });
      continue;
    }

    // Create user upload directory
    const userDir = join(UPLOAD_DIR, String(userId));
    if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true });

    // Generate unique filename
    const ext = file.name.split(".").pop() || "mp3";
    const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filepath = join(userDir, uniqueName);

    // Save file
    await Bun.write(filepath, file);

    // Analyze audio
    let metadata_status = 'analyzing';
    let analysisResult: { bpm: number | null; musical_key: string | null; duration_ms: number | null; title?: string; artist?: string; album?: string; year?: number; genre?: string } = { bpm: null, musical_key: null, duration_ms: null };

    try {
      analysisResult = await analyzeAudio(filepath);
      metadata_status = 'complete';
    } catch (err) {
      console.error("Analysis failed for", file.name, err);
      metadata_status = 'failed';
    }

    // Use filename without extension as fallback title
    const fallbackTitle = file.name.replace(/\.[^.]+$/, "");

    // Insert track
    const track = insertTrack({
      user_id: userId,
      filename: file.name,
      filepath,
      filesize: file.size,
      duration_ms: analysisResult.duration_ms,
      bpm: analysisResult.bpm,
      musical_key: analysisResult.musical_key,
      title: analysisResult.title || fallbackTitle,
      artist: analysisResult.artist || null,
      album: analysisResult.album || null,
      year: analysisResult.year || null,
      genre: analysisResult.genre || null,
      metadata_status,
    });

    results.push(track);
  }

  return json({ tracks: results }, 201);
}

// ─── Batch Import Handler (for folder sync) ───

export async function handleTrackImport(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "Invalid form data" }, 400);
  }

  const files = formData.getAll("files");
  const relativePaths = formData.getAll("relative_paths") as string[];

  if (files.length === 0) return json({ error: "No files uploaded" }, 400);

  const db = getDb();
  let imported = 0;
  let skipped = 0;

  // Build a lookup of existing tracks by filename+filesize for dedup
  const existingRows = db.query(
    "SELECT filename, filesize FROM tracks WHERE user_id = ?"
  ).all(userId) as { filename: string; filesize: number }[];
  const existingSet = new Set(
    existingRows.map((r) => `${r.filename}|${r.filesize}`)
  );

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!(file instanceof File)) continue;
    if (file.size === 0) continue;
    if (file.size > MAX_FILE_SIZE) continue;

    // Use the relative path as the filename for dedup, fall back to file.name
    const relPath = relativePaths[i] || file.name;
    const dedupKey = `${relPath}|${file.size}`;

    if (existingSet.has(dedupKey)) {
      skipped++;
      continue;
    }

    // Create user upload directory
    const userDir = join(UPLOAD_DIR, String(userId));
    if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true });

    // Generate unique stored filename
    const ext = (relPath.split(".").pop() || "mp3").toLowerCase();
    const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storedPath = join(userDir, uniqueName);

    // Save file
    await Bun.write(storedPath, file);

    // Analyze audio
    let metadata_status = "analyzing";
    let analysisResult: {
      bpm: number | null;
      musical_key: string | null;
      duration_ms: number | null;
      title?: string;
      artist?: string;
      album?: string;
      year?: number;
      genre?: string;
    } = { bpm: null, musical_key: null, duration_ms: null };

    try {
      analysisResult = await analyzeAudio(storedPath);
      metadata_status = "complete";
    } catch (err) {
      console.error("Analysis failed for", relPath, err);
      metadata_status = "failed";
    }

    const fallbackTitle = basename(relPath).replace(/\.[^.]+$/, "");

    // Insert track — store both the stored path and the reference path
    insertTrack({
      user_id: userId,
      filename: basename(relPath),
      filepath: relPath, // store relative path as reference
      filesize: file.size,
      duration_ms: analysisResult.duration_ms,
      bpm: analysisResult.bpm,
      musical_key: analysisResult.musical_key,
      title: analysisResult.title || fallbackTitle,
      artist: analysisResult.artist || null,
      album: analysisResult.album || null,
      year: analysisResult.year || null,
      genre: analysisResult.genre || null,
      metadata_status,
    });

    existingSet.add(dedupKey);
    imported++;
  }

  return json({ imported, skipped, total: files.length });
}

export function handleTrackList(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const genresRaw = url.searchParams.get("genres");
  const opts = {
    userId: auth.userId,
    page: parseInt(url.searchParams.get("page") || "1"),
    limit: parseInt(url.searchParams.get("limit") || "50"),
    sort: url.searchParams.get("sort") || "created_at",
    order: (url.searchParams.get("order") || "desc") as 'asc' | 'desc',
    genre: url.searchParams.get("genre") || undefined,
    genres: genresRaw ? genresRaw.split(",").map(g => g.trim()).filter(Boolean) : undefined,
    key: url.searchParams.get("key") || undefined,
    bpmMin: url.searchParams.get("bpm_min") ? parseFloat(url.searchParams.get("bpm_min")!) : undefined,
    bpmMax: url.searchParams.get("bpm_max") ? parseFloat(url.searchParams.get("bpm_max")!) : undefined,
    search: url.searchParams.get("search") || undefined,
  };

  const { tracks, total } = listTracks(opts);
  return json({ tracks, total, page: opts.page, limit: opts.limit });
}

export function handleTrackGet(req: Request, id: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const track = getTrack(parseInt(id), auth.userId);
  if (!track) return json({ error: "Track not found" }, 404);

  // Get tags and multi-genres for this track
  const tags = getTrackTags(track.id, auth.userId);
  const genres = getTrackGenres(track.id);
  return json({ ...track, tags, genres });
}

export async function handleTrackUpdate(req: Request, id: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req);
  const track = updateTrack(parseInt(id), auth.userId, body as Record<string, unknown>);
  if (!track) return json({ error: "Track not found" }, 404);
  return json(track);
}

export function handleTrackDelete(req: Request, id: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const deleted = deleteTrackFromDb(parseInt(id), auth.userId);
  if (!deleted) return json({ error: "Track not found" }, 404);
  return json({ ok: true });
}

// ─── Genre Handlers ───

export function handleGenres(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const hierarchy = getGenreHierarchy();
  const userGenres = getGenres(auth.userId);
  return json({ hierarchy, genres: userGenres });
}

export function handleGenreSearch(req: Request): Response {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  if (!q.trim()) return json({ results: getAllGenres() });
  return json({ results: searchGenres(q) });
}

export function handleGenreTree(req: Request): Response {
  return json({ hierarchy: getGenreHierarchy() });
}

export function handleGenreFusionSuggest(req: Request): Response {
  const url = new URL(req.url);
  const selected = url.searchParams.get("selected") || "";
  const sel = selected ? selected.split(",").map(s => s.trim()).filter(Boolean) : [];
  return json({ fusions: suggestFusionGenres(sel) });
}

export function handleGenreSubgenres(req: Request, parent: string): Response {
  return json({ parent, subgenres: getSubgenres(parent) });
}

// ─── Track Multi-Genre Handlers ───

export async function handleTrackAddGenres(req: Request, id: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const track = getTrack(parseInt(id), auth.userId);
  if (!track) return json({ error: "Track not found" }, 404);

  const body = await parseBody(req) as { genres?: string[] };
  if (!body.genres || body.genres.length === 0) return json({ error: "genres array required" }, 400);

  addTrackGenres(parseInt(id), body.genres);
  const genres = getTrackGenres(parseInt(id));
  return json({ genres });
}

export function handleTrackGetGenres(req: Request, id: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const track = getTrack(parseInt(id), auth.userId);
  if (!track) return json({ error: "Track not found" }, 404);

  return json({ genres: getTrackGenres(parseInt(id)) });
}

export function handleTrackRemoveGenre(req: Request, id: string, genre: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const track = getTrack(parseInt(id), auth.userId);
  if (!track) return json({ error: "Track not found" }, 404);

  const removed = removeTrackGenre(parseInt(id), decodeURIComponent(genre));
  if (!removed) return json({ error: "Genre not found on track" }, 404);
  return json({ ok: true, genres: getTrackGenres(parseInt(id)) });
}

export function handleKeys(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  return json({ keys: getKeys(auth.userId) });
}

// ─── Playlist Handlers ───

export function handlePlaylistList(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  return json({ playlists: listPlaylists(auth.userId) });
}

export async function handlePlaylistCreate(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req) as { name?: string; description?: string; is_collaborative?: boolean };
  if (!body.name) return json({ error: "Name is required" }, 400);
  const pl = createPlaylist(auth.userId, body.name, body.description, body.is_collaborative);

  // Broadcast to other devices
  const device = getDeviceBySession(auth.sessionId);
  broadcastToUser(auth.userId, {
    type: "playlist_created",
    payload: { playlist: pl },
    timestamp: new Date().toISOString(),
    sourceDeviceId: device?.id ?? undefined,
  }, device?.id);

  return json(pl, 201);
}

export function handlePlaylistGet(req: Request, id: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const pl = getPlaylist(parseInt(id), auth.userId);
  if (!pl) return json({ error: "Playlist not found" }, 404);
  return json(pl);
}

export function handlePlaylistDelete(req: Request, id: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const playlistId = parseInt(id);
  const deleted = deletePlaylist(playlistId, auth.userId);
  if (!deleted) return json({ error: "Playlist not found" }, 404);

  // Broadcast to other devices
  const device = getDeviceBySession(auth.sessionId);
  broadcastToUser(auth.userId, {
    type: "playlist_deleted",
    payload: { playlistId },
    timestamp: new Date().toISOString(),
    sourceDeviceId: device?.id ?? undefined,
  }, device?.id);

  return json({ ok: true });
}

export async function handlePlaylistAddTrack(req: Request, playlistId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req) as { track_id?: number };
  if (!body.track_id) return json({ error: "track_id is required" }, 400);
  const ok = addTrackToPlaylist(parseInt(playlistId), body.track_id, auth.userId);
  if (!ok) return json({ error: "Playlist or track not found" }, 404);

  // Broadcast to other devices
  const device = getDeviceBySession(auth.sessionId);
  const track = getTrack(body.track_id, auth.userId);
  broadcastToUser(auth.userId, {
    type: "track_added",
    payload: { playlistId: parseInt(playlistId), trackId: body.track_id, track },
    timestamp: new Date().toISOString(),
    sourceDeviceId: device?.id ?? undefined,
  }, device?.id);

  return json({ ok: true }, 201);
}

export async function handlePlaylistRemoveTrack(req: Request, playlistId: string, trackId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const ok = removeTrackFromPlaylist(parseInt(playlistId), parseInt(trackId), auth.userId);
  if (!ok) return json({ error: "Playlist not found" }, 404);

  // Broadcast to other devices
  const device = getDeviceBySession(auth.sessionId);
  broadcastToUser(auth.userId, {
    type: "track_removed",
    payload: { playlistId: parseInt(playlistId), trackId: parseInt(trackId) },
    timestamp: new Date().toISOString(),
    sourceDeviceId: device?.id ?? undefined,
  }, device?.id);

  return json({ ok: true });
}

// ─── Tag Handlers ───

export function handleTagList(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  return json({ tags: listTags(auth.userId) });
}

export async function handleTagCreate(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req) as { name?: string; category?: string };
  if (!body.name) return json({ error: "Name is required" }, 400);
  const tag = createTag(body.name, body.category);
  return json(tag, 201);
}

export async function handleTrackAttachTag(req: Request, trackId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req) as { tag_id?: number; tag_name?: string };
  let tagId = body.tag_id;
  if (!tagId && body.tag_name) {
    const tag = createTag(body.tag_name);
    tagId = tag.id;
  }
  if (!tagId) return json({ error: "tag_id or tag_name is required" }, 400);
  const ok = attachTag(parseInt(trackId), tagId, auth.userId);
  if (!ok) return json({ error: "Track not found" }, 404);
  return json({ ok: true }, 201);
}

export async function handleTrackDetachTag(req: Request, trackId: string, tagId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const ok = detachTag(parseInt(trackId), parseInt(tagId), auth.userId);
  if (!ok) return json({ error: "Track not found" }, 404);
  return json({ ok: true });
}

// ─── AI Handlers ───

export async function handleTrackAITag(req: Request, id: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const track = getTrack(parseInt(id), auth.userId);
  if (!track) return json({ error: "Track not found" }, 404);

  const metadata: TrackMetadata = {
    title: track.title,
    artist: track.artist,
    album: track.album,
    year: track.year,
    genre: track.genre,
    bpm: track.bpm,
    musical_key: track.musical_key,
    duration_ms: track.duration_ms,
  };

  try {
    const tags = await aiTagTrack(metadata);
    // Save to DB
    updateTrack(parseInt(id), auth.userId, {
      genre: tags.genre,
      subgenre: tags.subgenre,
      mood: tags.mood,
      language: tags.language,
      country: tags.country,
      decade: tags.decade,
      chord_progression: tags.chord_progression,
      beat_pattern: tags.beat_pattern,
    });
    // Also populate multi-genres from AI tags
    const aiGenres: string[] = [];
    if (tags.genre) aiGenres.push(tags.genre);
    if (tags.subgenre) aiGenres.push(tags.subgenre);
    if (aiGenres.length > 0) {
      addTrackGenres(parseInt(id), aiGenres);
    }
    const updated = getTrack(parseInt(id), auth.userId);
    const multiGenres = getTrackGenres(parseInt(id));
    return json({ track: updated, tags, genres: multiGenres });
  } catch (err) {
    console.error("AI tagging failed:", err);
    return json({ error: "AI tagging failed" }, 500);
  }
}

export async function handlePlaylistGenerate(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as { prompt?: string };
  if (!body.prompt?.trim()) return json({ error: "Prompt is required" }, 400);

  // Build library summary
  const db = getDb();
  const totalTracks = (db.query("SELECT COUNT(*) as c FROM tracks WHERE user_id = ?").get(auth.userId) as { c: number }).c;

  const topGenres = (db.query(
    "SELECT genre, COUNT(*) as c FROM tracks WHERE user_id = ? AND genre IS NOT NULL AND genre != '' GROUP BY genre ORDER BY c DESC LIMIT 10"
  ).all(auth.userId) as { genre: string; c: number }[]).map(r => r.genre);

  const topArtists = (db.query(
    "SELECT artist, COUNT(*) as c FROM tracks WHERE user_id = ? AND artist IS NOT NULL AND artist != '' GROUP BY artist ORDER BY c DESC LIMIT 10"
  ).all(auth.userId) as { artist: string; c: number }[]).map(r => r.artist);

  const bpmStats = db.query(
    "SELECT MIN(bpm) as minBpm, MAX(bpm) as maxBpm FROM tracks WHERE user_id = ? AND bpm IS NOT NULL"
  ).get(auth.userId) as { minBpm: number | null; maxBpm: number | null } | undefined;

  const keys = (db.query(
    "SELECT DISTINCT musical_key FROM tracks WHERE user_id = ? AND musical_key IS NOT NULL AND musical_key != '' ORDER BY musical_key"
  ).all(auth.userId) as { musical_key: string }[]).map(r => r.musical_key);

  const library: LibrarySummary = {
    totalTracks,
    topGenres,
    topArtists,
    bpmRange: bpmStats && bpmStats.minBpm != null ? { min: bpmStats.minBpm, max: bpmStats.maxBpm! } : null,
    keys,
  };

  try {
    const result = await aiGeneratePlaylist(body.prompt.trim(), library);

    // Query matching tracks from the user's library
    // Simple matching: find tracks in the top genres, within reasonable BPM range
    let matchingTracks: { id: number }[] = [];
    const promptLower = body.prompt.trim().toLowerCase();

    // Try to find tracks that match genre keywords in the prompt
    const matchingGenres = topGenres.filter(g => promptLower.includes(g.toLowerCase()));
    if (matchingGenres.length > 0) {
      const placeholders = matchingGenres.map(() => "?").join(",");
      matchingTracks = db.query(
        `SELECT id FROM tracks WHERE user_id = ? AND genre IN (${placeholders}) ORDER BY RANDOM() LIMIT 30`
      ).all(auth.userId, ...matchingGenres) as { id: number }[];
    }

    // If no genre matches, pick tracks from top genres
    if (matchingTracks.length === 0 && topGenres.length > 0) {
      const placeholders = topGenres.slice(0, 3).map(() => "?").join(",");
      matchingTracks = db.query(
        `SELECT id FROM tracks WHERE user_id = ? AND genre IN (${placeholders}) ORDER BY RANDOM() LIMIT 30`
      ).all(auth.userId, ...topGenres.slice(0, 3)) as { id: number }[];
    }

    // Fallback: just get some tracks
    if (matchingTracks.length === 0) {
      matchingTracks = db.query(
        "SELECT id FROM tracks WHERE user_id = ? ORDER BY RANDOM() LIMIT 30"
      ).all(auth.userId) as { id: number }[];
    }

    const trackIds = matchingTracks.map(t => t.id);

    // Create the playlist
    const pl = createPlaylist(auth.userId, result.name, result.description);

    // Add tracks to playlist
    for (let i = 0; i < trackIds.length; i++) {
      addTrackToPlaylist(pl.id, trackIds[i], auth.userId);
    }

    // Get the full playlist
    const fullPlaylist = getPlaylist(pl.id, auth.userId);

    return json({
      playlist: fullPlaylist,
      externalSuggestions: result.externalSuggestions,
    }, 201);
  } catch (err) {
    console.error("Playlist generation failed:", err);
    return json({ error: "Playlist generation failed" }, 500);
  }
}

// ─── Share Handlers ───

export function handleShareCreate(req: Request, playlistId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const result = createShare(parseInt(playlistId), auth.userId);
  if (!result) return json({ error: "Playlist not found" }, 404);
  return json({ token: result.token, url: `/share/${result.token}` }, 201);
}

export function handleShareGet(req: Request, token: string): Response {
  const share = getShareByToken(token);
  if (!share) return json({ error: "Share link not found" }, 404);

  const db = getDb();
  const pl = db.query("SELECT * FROM playlists WHERE id = ?").get(share.playlist_id) as { id: number; name: string; description: string; user_id: number; created_at: string } | undefined;
  if (!pl) return json({ error: "Playlist not found" }, 404);

  const user = db.query("SELECT display_name FROM users WHERE id = ?").get(pl.user_id) as { display_name: string } | undefined;

  const tracks = db.query(
    `SELECT t.id, t.title, t.artist, t.album, t.genre, t.bpm, t.musical_key, t.duration_ms, t.year
     FROM tracks t
     JOIN playlist_tracks pt ON pt.track_id = t.id
     WHERE pt.playlist_id = ?
     ORDER BY pt.position`
  ).all(pl.id);

  return json({
    name: pl.name,
    description: pl.description,
    createdBy: user?.display_name || "Unknown",
    createdAt: pl.created_at,
    tracks,
  });
}

export function handleShareDelete(req: Request, playlistId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const deleted = deleteShare(parseInt(playlistId), auth.userId);
  if (!deleted) return json({ ok: false });
  return json({ ok: true });
}

// ─── Export Handlers ───

export function handlePlaylistExport(req: Request, playlistId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") as ExportFormat | null;
  if (!format || !["m3u", "nml", "rekordbox", "serato", "text"].includes(format)) {
    return json({ error: "Invalid or missing format. Use: m3u, nml, rekordbox, serato, text" }, 400);
  }

  const playlist = getPlaylist(parseInt(playlistId), auth.userId);
  if (!playlist) return json({ error: "Playlist not found" }, 404);

  const content = generateExport({ name: playlist.name, tracks: playlist.tracks }, format);
  const ext = EXPORT_EXTENSIONS[format];
  const contentType = EXPORT_CONTENT_TYPES[format];
  const filename = `${playlist.name.replace(/[^a-zA-Z0-9_-]/g, "_")}${ext}`;

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function handleTrackExport(req: Request, trackId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") as ExportFormat | null;
  if (!format || !["m3u", "text"].includes(format)) {
    return json({ error: "Track export supports: m3u, text" }, 400);
  }

  const track = getTrack(parseInt(trackId), auth.userId);
  if (!track) return json({ error: "Track not found" }, 404);

  const playlist = { name: track.title || track.filename, tracks: [track] };
  const content = generateExport(playlist, format);
  const ext = EXPORT_EXTENSIONS[format];
  const ct = EXPORT_CONTENT_TYPES[format];

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": `${ct}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${(track.title || track.filename).replace(/[^a-zA-Z0-9_-]/g, "_")}${ext}"`,
    },
  });
}

// ─── Sync Handlers ───

export function handleTrackSync(req: Request, trackId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const ok = updateTrackSyncStatus(parseInt(trackId), auth.userId, "cloud");
  if (!ok) return json({ error: "Track not found" }, 404);
  return json({ ok: true, sync_status: "cloud" });
}

export function handleTrackDownload(req: Request, trackId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const ok = updateTrackSyncStatus(parseInt(trackId), auth.userId, "pending_download");
  if (!ok) return json({ error: "Track not found" }, 404);
  return json({ ok: true, sync_status: "pending_download" });
}

export function handleSyncStatus(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const status = getSyncStatus(auth.userId);
  return json(status);
}

// ─── Device Handlers ───

export function handleDeviceRegister(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  // Parse User-Agent to determine device type and name
  const ua = req.headers.get("user-agent") || "";
  const deviceType = detectDeviceType(ua);
  const deviceName = generateDeviceName(ua, deviceType);

  const device = registerDevice(auth.userId, deviceName, deviceType, auth.sessionId);
  return json({ device }, 201);
}

export function handleDeviceList(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const devices = listUserDevices(auth.userId);
  // Mark which one is current
  const devicesWithCurrent = devices.map(d => ({
    ...d,
    is_current: d.session_id === auth.sessionId,
  }));
  return json({ devices: devicesWithCurrent });
}

export function handleDeviceDelete(req: Request, deviceId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const ok = deleteDevice(parseInt(deviceId), auth.userId);
  if (!ok) return json({ error: "Device not found" }, 404);
  return json({ ok: true });
}

export function handleDeviceActions(req: Request, deviceId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  // Verify this device belongs to the user
  const device = getDeviceBySession(auth.sessionId);
  if (!device || device.id !== parseInt(deviceId)) {
    // Also check if the device belongs to the user at all
    const targetDevice = getDevice(parseInt(deviceId));
    if (!targetDevice || targetDevice.user_id !== auth.userId) {
      return json({ error: "Device not found" }, 404);
    }
    // Still allow listing other device's actions
  }

  const actions = getPendingActions(parseInt(deviceId));
  return json({ actions });
}

export function handleDeviceActionComplete(req: Request, actionId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  completeDeviceAction(parseInt(actionId));
  return json({ ok: true });
}

// ─── Sync Stream (SSE + Polling) Handlers ───

export function handleSyncStream(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const device = getDeviceBySession(auth.sessionId);
  const deviceId = device?.id ?? null;

  let controller: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
      addClient(auth.userId, controller, deviceId);

      // Send initial connection event
      const encoder = new TextEncoder();
      const connectEvent: SyncEvent = {
        type: "connected",
        payload: { deviceId, deviceName: device?.device_name, connectedClients: getClientCount(auth.userId) },
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectEvent)}\n\n`));

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Store interval reference for cleanup
      (req as Record<string, unknown>)._ssePingInterval = pingInterval;
    },
    cancel() {
      removeClient(auth.userId, controller);
      const interval = (req as Record<string, unknown>)._ssePingInterval as ReturnType<typeof setInterval> | undefined;
      if (interval) clearInterval(interval);
    },
  });

  // Cleanup on disconnect
  const closeHandler = () => {
    removeClient(auth.userId, controller!);
    const interval = (req as Record<string, unknown>)._ssePingInterval as ReturnType<typeof setInterval> | undefined;
    if (interval) clearInterval(interval);
  };
  req.signal?.addEventListener("abort", closeHandler);

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function handleSyncPoll(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? parseInt(sinceParam) : Date.now() - 60000;

  const events = getPollingEvents(auth.userId, since);
  const device = getDeviceBySession(auth.sessionId);

  return json({
    events,
    serverTime: Date.now(),
    deviceId: device?.id ?? null,
    connectedClients: getClientCount(auth.userId),
  });
}

// ─── Remote Download / Push Playlist ───

export async function handlePushPlaylist(req: Request, deviceId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: { playlist_id?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "playlist_id is required" }, 400);
  }

  const playlistId = body.playlist_id;
  if (!playlistId) return json({ error: "playlist_id is required" }, 400);

  // Verify the device belongs to the same user
  const targetDevice = getDevice(parseInt(deviceId));
  if (!targetDevice || targetDevice.user_id !== auth.userId) {
    return json({ error: "Device not found" }, 404);
  }

  // Don't push to self
  const currentDevice = getDeviceBySession(auth.sessionId);
  if (currentDevice && currentDevice.id === parseInt(deviceId)) {
    return json({ error: "Cannot push to current device" }, 400);
  }

  // Verify the playlist belongs to the user
  const playlist = getPlaylist(playlistId, auth.userId);
  if (!playlist) return json({ error: "Playlist not found" }, 404);

  // Create a pending action for the target device
  const action = createDeviceAction(parseInt(deviceId), "download_playlist", {
    playlist_id: playlistId,
    playlist_name: playlist.name,
    from_device: currentDevice?.device_name || "another device",
  });

  // Broadcast to target device via SSE
  const syncEvent: SyncEvent = {
    type: "push_playlist",
    payload: {
      actionId: action.id,
      playlistId,
      playlistName: playlist.name,
      fromDeviceName: currentDevice?.device_name || "another device",
    },
    timestamp: new Date().toISOString(),
  };
  broadcastToUser(auth.userId, syncEvent);

  return json({ ok: true, action_id: action.id });
}

// ─── Device detection helpers ───

function detectDeviceType(ua: string): string {
  const uaLower = ua.toLowerCase();
  if (uaLower.includes("ipad") || uaLower.includes("tablet")) return "tablet";
  if (uaLower.includes("iphone") || uaLower.includes("android") || uaLower.includes("mobile")) return "phone";
  return "desktop";
}

function generateDeviceName(ua: string, deviceType: string): string {
  const uaLower = ua.toLowerCase();
  let browser = "";
  if (uaLower.includes("firefox")) browser = "Firefox";
  else if (uaLower.includes("edg")) browser = "Edge";
  else if (uaLower.includes("chrome")) browser = "Chrome";
  else if (uaLower.includes("safari")) browser = "Safari";
  else browser = "Browser";

  let os = "";
  if (uaLower.includes("windows")) os = "Windows";
  else if (uaLower.includes("mac os") || uaLower.includes("macintosh")) os = "macOS";
  else if (uaLower.includes("linux") || uaLower.includes("x11")) os = "Linux";
  else if (uaLower.includes("iphone") || uaLower.includes("ipad")) os = "iOS";
  else if (uaLower.includes("android")) os = "Android";
  else os = "Unknown OS";

  return `${browser} on ${os}`;
}

// ─── AI Track Search Handler ───

export async function handleTrackSearch(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as { query?: string };
  if (!body.query?.trim()) return json({ error: "Query is required" }, 400);

  const db = getDb();
  const tracks = db.query(
    `SELECT id, title, artist, genre, subgenre, mood, language, album 
     FROM tracks WHERE user_id = ? 
     LIMIT 500`
  ).all(auth.userId) as {
    id: number; title: string | null; artist: string | null;
    genre: string | null; subgenre: string | null;
    mood: string | null; language: string | null; album: string | null;
  }[];

  try {
    const results = await aiSearchLibrary(body.query.trim(), tracks);
    return json(results);
  } catch (err) {
    console.error("AI search failed:", err);
    return json({ error: "Search failed" }, 500);
  }
}

// ─── Playlist Suggest Handler ───

export async function handlePlaylistSuggest(req: Request, playlistId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const playlist = getPlaylist(parseInt(playlistId), auth.userId);
  if (!playlist) return json({ error: "Playlist not found" }, 404);

  const tracks = (playlist.tracks || []) as {
    id: number; title: string | null; artist: string | null;
    genre: string | null; subgenre: string | null;
    mood: string | null; language: string | null; album: string | null;
  }[];

  if (tracks.length === 0) {
    return json({ suggestions: [] });
  }

  try {
    const suggestions = await aiSuggestTracks(tracks, 6);
    return json({ suggestions });
  } catch (err) {
    console.error("AI suggestions failed:", err);
    return json({ error: "Suggestions failed" }, 500);
  }
}

// ─── Discover Handler ───

export async function handleDiscoverArtists(req: Request): Promise<Response> {
  const body = await parseBody(req) as { artist?: string };
  if (!body.artist?.trim()) return json({ error: "Artist name is required" }, 400);

  try {
    const artists = await aiDiscoverArtists(body.artist.trim());
    return json({ artist: body.artist.trim(), related: artists });
  } catch (err) {
    console.error("Discover artists failed:", err);
    return json({ error: "Discovery failed" }, 500);
  }
}

// ─── Queue Handler ───

export async function handleQueueGenerate(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as { track_id?: number; count?: number; seed?: number };
  if (!body.track_id) return json({ error: "track_id is required" }, 400);

  const count = Math.min(body.count || 10, 50);
  const startTrack = getTrack(body.track_id, auth.userId);
  if (!startTrack) return json({ error: "Track not found" }, 404);

  // Build queue iteratively
  const queue: (typeof startTrack & { transition_reason: string })[] = [];
  const usedIds = new Set<number>([startTrack.id]);
  let currentTrack = startTrack;
  let constraintsRelaxed = false;
  let relaxReason = "";

  for (let i = 0; i < count; i++) {
    const currentBpm = currentTrack.bpm || 120;
    const currentCamelot = toCamelot(currentTrack.musical_key);
    const currentEnergy = currentTrack.energy || estimateEnergy(currentBpm);

    // Get compatible keys
    const compatibleKeys = currentCamelot
      ? getCompatibleKeys(currentCamelot).map(ck => {
          // Match both Camelot and standard notation in DB
          return ck;
        })
      : [];

    // BPM range: ±8% primary, relax to ±15% if needed
    let bpmMin = currentBpm * 0.92;
    let bpmMax = currentBpm * 1.08;

    // Try to find compatible tracks
    let candidates = getCompatibleTracks({
      userId: auth.userId,
      bpmMin,
      bpmMax,
      compatibleKeys,
      excludeTrackId: currentTrack.id,
      excludeRecentlyPlayedMinutes: 120,
      limit: 30,
    });

    // Filter out already-used tracks
    candidates = candidates.filter(t => !usedIds.has(t.id));

    // Relax BPM if no candidates
    if (candidates.length === 0) {
      bpmMin = currentBpm * 0.85;
      bpmMax = currentBpm * 1.15;
      constraintsRelaxed = true;
      relaxReason = "BPM range relaxed to ±15%";

      candidates = getCompatibleTracks({
        userId: auth.userId,
        bpmMin,
        bpmMax,
        compatibleKeys,
        excludeTrackId: currentTrack.id,
        excludeRecentlyPlayedMinutes: 120,
        limit: 30,
      });
      candidates = candidates.filter(t => !usedIds.has(t.id));
    }

    // Relax key compatibility if still no candidates
    if (candidates.length === 0) {
      constraintsRelaxed = true;
      relaxReason = "Key and BPM constraints relaxed";

      candidates = getCompatibleTracks({
        userId: auth.userId,
        bpmMin,
        bpmMax,
        compatibleKeys: [], // no key restriction
        excludeTrackId: currentTrack.id,
        excludeRecentlyPlayedMinutes: 120,
        limit: 30,
      });
      candidates = candidates.filter(t => !usedIds.has(t.id));
    }

    // Fallback: any track
    if (candidates.length === 0) {
      constraintsRelaxed = true;
      relaxReason = "All constraints relaxed — picking any available track";

      const db = getDb();
      candidates = db.query(
        `SELECT * FROM tracks WHERE user_id = ? AND id NOT IN (${[...usedIds, currentTrack.id].map(() => "?").join(",")}) ORDER BY RANDOM() LIMIT 30`
      ).all(auth.userId, ...usedIds, currentTrack.id) as typeof candidates;
    }

    if (candidates.length === 0) break;

    // Score and pick the best candidate
    const scored = candidates.map(t => {
      let score = 0;
      const tBpm = t.bpm || 120;
      const tEnergy = t.energy || estimateEnergy(tBpm);
      const tCamelot = toCamelot(t.musical_key);

      // BPM proximity (closer is better)
      const bpmDiff = Math.abs(tBpm - currentBpm);
      score += Math.max(0, 10 - bpmDiff);

      // Key compatibility
      if (currentCamelot && tCamelot) {
        const dist = getKeyDistance(currentTrack.musical_key || "", t.musical_key || "");
        score += (6 - dist) * 3; // 0 distance = +18, 6 = +0
      }

      // Energy similarity (closer is better)
      const energyDiff = Math.abs(tEnergy - currentEnergy);
      score += Math.max(0, 5 - energyDiff) * 2;

      // Same genre bonus
      if (currentTrack.genre && t.genre && currentTrack.genre.toLowerCase() === t.genre.toLowerCase()) {
        score += 5;
      }

      // Same mood bonus
      if (currentTrack.mood && t.mood && currentTrack.mood.toLowerCase() === t.mood.toLowerCase()) {
        score += 3;
      }

      return { track: t, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Pick from top candidates with some randomness
    const topN = Math.min(5, scored.length);
    const pick = scored[Math.floor(Math.random() * topN)];

    const nextTrack = pick.track;
    usedIds.add(nextTrack.id);

    // Build transition reason
    const nextCamelot = toCamelot(nextTrack.musical_key);
    const reasonParts: string[] = [];

    if (currentCamelot && nextCamelot) {
      const dist = getKeyDistance(currentTrack.musical_key || "", nextTrack.musical_key || "");
      if (dist === 0) {
        reasonParts.push(`Key-compatible (${currentCamelot} → ${nextCamelot})`);
      } else if (dist === 1) {
        reasonParts.push(`Harmonic mix (${currentCamelot} → ${nextCamelot})`);
      } else {
        reasonParts.push(`Key: ${currentCamelot} → ${nextCamelot} (distance ${dist})`);
      }
    }

    if (currentBpm && nextTrack.bpm) {
      reasonParts.push(`BPM ${Math.round(currentBpm)}→${Math.round(nextTrack.bpm)}`);
    }

    if (currentTrack.genre && nextTrack.genre && currentTrack.genre.toLowerCase() === nextTrack.genre.toLowerCase()) {
      reasonParts.push(`Same genre: ${nextTrack.genre}`);
    }

    queue.push({
      ...nextTrack,
      transition_reason: reasonParts.join(", ") || "Fallback selection",
    });

    currentTrack = nextTrack;
  }

  return json({
    start_track: startTrack,
    queue,
    count: queue.length,
    requested: count,
    constraints_relaxed: constraintsRelaxed,
    relax_reason: constraintsRelaxed ? relaxReason : null,
  });
}

// ─── Payment Handlers ───

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const MOCK_MODE = !STRIPE_SECRET_KEY;

const PRICING: Record<string, { amount_cents: number; label: string }> = {
  pro_monthly: { amount_cents: 1200, label: "Pro Monthly" },
  pro_yearly: { amount_cents: 9900, label: "Pro Yearly" },
  lifetime: { amount_cents: 29900, label: "Lifetime" },
};

export async function handlePaymentCreateCheckout(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const body = await parseBody(req) as { product_type?: string };
  const productType = body.product_type;
  if (!productType || !PRICING[productType]) {
    return json({ error: "Invalid product type. Must be pro_monthly, pro_yearly, or lifetime." }, 400);
  }

  const { amount_cents } = PRICING[productType];

  if (MOCK_MODE) {
    // Mock payment flow for development
    const sessionId = `mock_${crypto.randomUUID()}`;
    createPayment(userId, sessionId, productType, amount_cents);
    const mockUrl = `/api/payments/mock-checkout?session=${encodeURIComponent(sessionId)}`;
    return json({ url: mockUrl, mock: true });
  }

  // Real Stripe flow
  try {
    const baseUrl = process.env.PUBLIC_URL || "http://localhost:3000";
    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": PRICING[productType].label,
        "line_items[0][price_data][unit_amount]": String(amount_cents),
        "line_items[0][quantity]": "1",
        mode: productType === "lifetime" ? "payment" : "subscription",
        "success_url": `${baseUrl}/?payment=success&session={CHECKOUT_SESSION_ID}`,
        "cancel_url": `${baseUrl}/?payment=cancelled`,
        "metadata[user_id]": String(userId),
        "metadata[product_type]": productType,
      }),
    });

    const sessionData = await stripeResp.json() as { id?: string; url?: string; error?: { message: string } };
    if (!stripeResp.ok || !sessionData.id) {
      console.error("Stripe error:", sessionData);
      return json({ error: sessionData.error?.message || "Failed to create checkout session" }, 500);
    }

    createPayment(userId, sessionData.id, productType, amount_cents);
    return json({ url: sessionData.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return json({ error: "Payment service unavailable" }, 500);
  }
}

export async function handlePaymentSuccess(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session");

  if (!sessionId) {
    return json({ error: "Missing session ID" }, 400);
  }

  // If it's a Stripe session, verify with Stripe first
  if (!sessionId.startsWith("mock_") && STRIPE_SECRET_KEY) {
    try {
      const stripeResp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` },
      });
      const sessionData = await stripeResp.json() as { payment_status?: string };
      if (sessionData.payment_status !== "paid" && sessionData.payment_status !== "no_payment_required") {
        return json({ error: "Payment not confirmed" }, 400);
      }
    } catch (err) {
      console.error("Stripe verification error:", err);
    }
  }

  const result = completePayment(sessionId);
  if (!result) {
    return json({ error: "Payment not found or already completed" }, 404);
  }

  return json({ ok: true, tier: result.productType === "lifetime" ? "lifetime" : "pro" });
}

export async function handlePaymentWebhook(req: Request): Promise<Response> {
  // In mock mode, this is a no-op (mock checkout handles completion directly)
  if (MOCK_MODE) {
    return json({ received: true });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return json({ error: "Webhook not configured" }, 500);
  }

  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return json({ error: "Missing signature" }, 400);

    const body = await req.text();

    // For now, parse the event body manually (Stripe SDK would verify signature)
    const event = JSON.parse(body) as { type: string; data: { object: { id: string; payment_status: string; metadata?: { user_id?: string; product_type?: string } } } };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        // Create payment record if it doesn't exist and complete it
        const db = getDb();
        const existing = db.query("SELECT id, status FROM payments WHERE stripe_session_id = ?").get(session.id) as { id: number; status: string } | undefined;
        if (!existing) {
          const productType = session.metadata?.product_type || "pro_monthly";
          const userId = Number(session.metadata?.user_id || 0);
          if (userId > 0) {
            const amountCents = PRICING[productType]?.amount_cents || 1200;
            createPayment(userId, session.id, productType, amountCents);
          }
        }
        completePayment(session.id);
      }
    }

    return json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return json({ error: "Webhook processing failed" }, 400);
  }
}

export async function handleMockCheckout(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session");

  if (!sessionId || !sessionId.startsWith("mock_")) {
    return new Response(
      `<!DOCTYPE html><html><head><title>Checkout</title><meta charset="utf-8"><style>
        body { font-family: system-ui; background: #0f0f17; color: #e0e0e0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 16px; padding: 48px; text-align: center; max-width: 420px; }
        h2 { color: #a78bfa; margin: 0 0 8px; } p { color: #888; margin: 0 0 24px; }
      </style></head><body><div class="card"><h2>Invalid session</h2><p>This mock checkout session is not valid.</p></div></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
    );
  }

  const result = completePayment(sessionId);
  const status = result ? "success" : "already_processed";

  return new Response(
    `<!DOCTYPE html><html><head><title>Mock Checkout — CataLog</title><meta charset="utf-8"><style>
      body { font-family: system-ui; background: #0f0f17; color: #e0e0e0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 16px; padding: 48px; text-align: center; max-width: 420px; }
      .check { width: 64px; height: 64px; border-radius: 50%; background: #7c3aed20; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
      .check svg { width: 32px; height: 32px; color: #a78bfa; }
      h2 { color: #a78bfa; margin: 0 0 8px; font-size: 1.5rem; }
      p { color: #888; margin: 0 0 24px; }
      .btn { display: inline-block; background: #7c3aed; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      .btn:hover { background: #6d28d9; }
    </style></head><body><div class="card">
      <div class="check"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>
      <h2>${status === "success" ? "Payment Successful!" : "Already Processed"}</h2>
      <p>${status === "success" ? "Your account has been upgraded. Welcome to CataLog Pro!" : "This payment was already processed."}</p>
      <a href="/" class="btn">Go to CataLog</a>
    </div>
    <script>setTimeout(function(){ window.location.href = '/'; }, 3000);</script></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function handlePaymentHistory(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const history = getUserPaymentHistory(auth.userId);
  return json({ payments: history });
}

// ─── Shazam / Identify Handler ───

export async function handleShazamIdentify(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  // Check action query param first — determines whether we parse JSON or blob
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "add_to_library") {
    // Add a previously identified track to the library (JSON body)
    const body = await req.json().catch(() => ({})) as {
      title?: string; artist?: string; album?: string; year?: number;
      genre?: string; confidence?: number; bpm?: number; musical_key?: string;
      duration_ms?: number; ident_id?: number;
    };
    if (!body.title || !body.artist) {
      return json({ error: "title and artist are required" }, 400);
    }

    const track = insertShazamTrack(userId, {
      title: body.title,
      artist: body.artist,
      album: body.album ?? null,
      year: body.year ?? null,
      genre: body.genre ?? null,
      bpm: body.bpm ?? null,
      musical_key: body.musical_key ?? null,
      duration_ms: body.duration_ms ?? null,
    });

    // Mark identification as added
    if (body.ident_id) {
      markIdentificationAdded(body.ident_id, userId);
    }

    return json({ track, ok: true }, 201);
  }

  // Default: identify audio (blob body)
  let blob: Blob;
  try {
    blob = await req.blob();
  } catch {
    return json({ error: "Invalid audio data" }, 400);
  }

  if (blob.size === 0) {
    return json({ error: "No audio data received" }, 400);
  }

  const result = await identifyTrack(blob);

  if (!result) {
    return json({ error: "Could not identify track. Try again or move closer to the speaker." }, 404);
  }

  // Record identification
  const ident = insertIdentification(userId, {
    title: result.title,
    artist: result.artist,
    album: result.album,
    year: result.year,
    genre: result.genre,
    confidence: result.confidence,
  });

  // Return recent identifications alongside the result
  const recents = getRecentIdentifications(userId, 5);

  return json({
    identified: true,
    track: result,
    identification_id: ident.id,
    recent_identifications: recents,
  });
}

export async function handleShazamHistory(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const recents = getRecentIdentifications(auth.userId, 10);
  return json({ identifications: recents });
}

// ─── Profile / Handle Handlers ───

export function handleCheckHandle(req: Request): Response {
  const url = new URL(req.url);
  const handle = url.searchParams.get("handle");
  if (!handle) return json({ error: "handle param required" }, 400);

  // Validate format
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(handle)) {
    return json({ available: false, error: "Handle must be 3-30 alphanumeric chars, underscores, or hyphens" });
  }

  const auth = requireAuth(req);
  const excludeId = auth instanceof Response ? undefined : auth.userId;
  const available = checkHandleAvailable(handle, excludeId);
  return json({ available });
}

export function handleGetUserProfile(req: Request, handle: string): Response {
  const auth = requireAuth(req);
  const viewerId = auth instanceof Response ? undefined : auth.userId;

  const profile = getUserProfile(handle);
  if (!profile) return json({ error: "User not found" }, 404);

  const featuredPlaylists = getFeaturedPlaylists(profile.id);
  const recentActivity = getRecentActivity(profile.id, 10);
  const tagCloud = getUserTagCloud(profile.id);

  let is_following = false;
  if (viewerId) {
    is_following = isFollowing(viewerId, profile.id);
  }

  return json({
    profile,
    featured_playlists: featuredPlaylists,
    recent_activity: recentActivity,
    tag_cloud: tagCloud,
    is_following,
  });
}

export function handleUserDiscover(req: Request): Response {
  const users = getPublicUsers(20);
  return json({ users });
}

export async function handleUpdateProfile(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as { handle?: string; display_name?: string; bio?: string };

  if (body.handle !== undefined) {
    // Validate format
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(body.handle)) {
      return json({ error: "Handle must be 3-30 alphanumeric chars, underscores, or hyphens" }, 400);
    }
    if (!checkHandleAvailable(body.handle, auth.userId)) {
      return json({ error: "Handle is already taken" }, 409);
    }
  }

  const user = updateUserProfile(auth.userId, body);
  if (!user) return json({ error: "No fields to update" }, 400);
  return json({ user });
}

// ─── Follow Handlers ───

export function handleFollowUser(req: Request, userId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const targetId = parseInt(userId);
  if (isNaN(targetId)) return json({ error: "Invalid user ID" }, 400);

  const target = getUserById(targetId);
  if (!target) return json({ error: "User not found" }, 404);

  const ok = followUser(auth.userId, targetId);
  if (!ok) return json({ error: "Cannot follow yourself or already following" }, 400);

  // Create notification for the followed user
  if (auth.userId !== targetId) {
    createNotification({ user_id: targetId, type: 'new_follower', actor_id: auth.userId });
  }

  return json({ ok: true }, 201);
}

export function handleUnfollowUser(req: Request, userId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const targetId = parseInt(userId);
  if (isNaN(targetId)) return json({ error: "Invalid user ID" }, 400);

  const ok = unfollowUser(auth.userId, targetId);
  if (!ok) return json({ error: "Not following this user" }, 404);
  return json({ ok: true });
}

export function handleGetFollowers(req: Request, userId: string): Response {
  const targetId = parseInt(userId);
  if (isNaN(targetId)) return json({ error: "Invalid user ID" }, 400);

  const followers = getFollowers(targetId);
  return json({ followers });
}

export function handleGetFollowing(req: Request, userId: string): Response {
  const targetId = parseInt(userId);
  if (isNaN(targetId)) return json({ error: "Invalid user ID" }, 400);

  const following = getFollowing(targetId);
  return json({ following });
}

// ─── Collaborator Handlers ───

export async function handleAddCollaborator(req: Request, playlistId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as { user_id?: number };
  if (!body.user_id) return json({ error: "user_id is required" }, 400);

  const ok = addCollaborator(parseInt(playlistId), body.user_id, auth.userId);
  if (!ok) return json({ error: "Playlist not found or not the owner" }, 404);
  return json({ ok: true }, 201);
}

export async function handleRemoveCollaborator(req: Request, playlistId: string, userId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const ok = removeCollaborator(parseInt(playlistId), parseInt(userId), auth.userId);
  if (!ok) return json({ error: "Playlist not found or not the owner" }, 404);
  return json({ ok: true });
}

export function handleGetCollaborators(req: Request, playlistId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const collabs = getCollaborators(parseInt(playlistId));
  return json({ collaborators: collabs });
}

// ─── Post Handlers ───

export async function handleCreatePost(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as {
    type?: string; title?: string; body?: string;
    gig_date?: string; gig_venue?: string; gig_location?: string;
    playlist_id?: number; track_id?: number;
  };

  if (!body.type || !['gig', 'playlist_share', 'track_share', 'status'].includes(body.type)) {
    return json({ error: "Invalid post type" }, 400);
  }

  const post = createPost(auth.userId, {
    type: body.type,
    title: body.title,
    body: body.body,
    gig_date: body.gig_date,
    gig_venue: body.gig_venue,
    gig_location: body.gig_location,
    playlist_id: body.playlist_id,
    track_id: body.track_id,
  });

  // Notify followers about the new post
  const followers = getFollowers(auth.userId);
  for (const follower of followers) {
    createNotification({
      user_id: follower.id,
      type: 'new_post',
      actor_id: auth.userId,
      post_id: post.id,
    });
  }

  return json({ post }, 201);
}

export function handleGetPosts(req: Request): Response {
  const url = new URL(req.url);
  const userIdStr = url.searchParams.get("user_id");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
  const offset = (page - 1) * limit;

  if (userIdStr) {
    const targetId = parseInt(userIdStr);
    if (isNaN(targetId)) return json({ error: "Invalid user_id" }, 400);
    const posts = getPostsByUser(targetId, limit, offset);
    return json({ posts });
  }

  return json({ error: "user_id is required" }, 400);
}

export function handleGetFeed(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
  const offset = (page - 1) * limit;

  const posts = getFeedPosts(auth.userId, limit, offset);
  return json({ posts });
}

export function handleLikePost(req: Request, postId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const pId = parseInt(postId);
  if (isNaN(pId)) return json({ error: "Invalid post ID" }, 400);

  const post = getPostById(pId);
  if (!post) return json({ error: "Post not found" }, 404);

  const ok = likePost(pId, auth.userId);
  if (!ok) return json({ ok: true }); // Already liked

  // Notify post author
  if (post.user_id !== auth.userId) {
    createNotification({
      user_id: post.user_id,
      type: 'post_liked',
      actor_id: auth.userId,
      post_id: pId,
    });
  }

  return json({ ok: true }, 201);
}

export function handleUnlikePost(req: Request, postId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const pId = parseInt(postId);
  if (isNaN(pId)) return json({ error: "Invalid post ID" }, 400);

  unlikePost(pId, auth.userId);
  return json({ ok: true });
}

export function handleDeletePost(req: Request, postId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const pId = parseInt(postId);
  if (isNaN(pId)) return json({ error: "Invalid post ID" }, 400);

  const ok = deletePost(pId, auth.userId);
  if (!ok) return json({ error: "Post not found or not yours" }, 404);
  return json({ ok: true });
}

// ─── Notification Handlers ───

export function handleGetNotifications(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const notifs = getNotifications(auth.userId);
  const unreadCount = getUnreadNotificationCount(auth.userId);
  return json({ notifications: notifs, unread_count: unreadCount });
}

export function handleMarkNotificationRead(req: Request, notifId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const nId = parseInt(notifId);
  if (isNaN(nId)) return json({ error: "Invalid notification ID" }, 400);

  markNotificationRead(nId, auth.userId);
  return json({ ok: true });
}

export function handleMarkAllNotificationsRead(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  markAllNotificationsRead(auth.userId);
  return json({ ok: true });
}

// ─── Share with Followers ───

export async function handlePlaylistShareFollowers(req: Request, playlistId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const plId = parseInt(playlistId);
  if (isNaN(plId)) return json({ error: "Invalid playlist ID" }, 400);

  const pl = getPlaylist(plId, auth.userId);
  if (!pl) return json({ error: "Playlist not found" }, 404);

  const body = await parseBody(req) as { message?: string };
  const message = body.message || `Check out my playlist: ${pl.name}`;

  const post = createPost(auth.userId, {
    type: 'playlist_share',
    title: pl.name,
    body: message,
    playlist_id: plId,
  });

  // Notify followers about the shared playlist
  const followers = getFollowers(auth.userId);
  const followerCount = followers.length;
  for (const follower of followers) {
    createNotification({
      user_id: follower.id,
      type: 'playlist_shared',
      actor_id: auth.userId,
      post_id: post.id,
    });
  }

  return json({ post, shared_with: followerCount }, 201);
}

// ─── Light Sync Handlers ───

export async function handleLightStatus(_req: Request): Promise<Response> {
  const hue = getHueStatus();
  return json({
    midi: {
      available: true,  // client-side only, so always report available
      connected: false, // client-side
      outputs: 0,
    },
    hue: {
      connected: hue.connected,
      mock: hue.mock,
      bridgeIp: hue.bridgeIp,
      lightCount: hue.lightCount,
      lastSync: hue.lastSync,
    },
    osc: {
      clients: getOscClientCount(),
    },
  });
}

export async function handleLightParams(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const trackId = url.searchParams.get("track_id");
  if (!trackId) return json({ error: "track_id required" }, 400);

  const track = getTrack(Number(trackId));
  if (!track) return json({ error: "Track not found" }, 404);

  const params = getLightParams({
    bpm: track.bpm,
    mood: track.mood,
    musical_key: track.musical_key,
    beat_pattern: track.beat_pattern,
    genre: track.genre,
    title: track.title,
    artist: track.artist,
  });

  return json({ params });
}

export async function handleHueConnect(_req: Request): Promise<Response> {
  const result = await connectBridge();
  return json(result);
}

export async function handleHueSync(req: Request): Promise<Response> {
  let body: { mood?: string; energy?: number; track_id?: number } = {};
  try { body = await req.json(); } catch {}

  const mood = body.mood ?? "energetic";
  const energy = body.energy ?? 5;

  // If track_id provided, get full params
  if (body.track_id) {
    const track = getTrack(body.track_id);
    if (track) {
      const result = await syncLights(mood, energy, {
        bpm: track.bpm,
        mood: track.mood,
        musical_key: track.musical_key,
        beat_pattern: track.beat_pattern,
        genre: track.genre,
        title: track.title,
        artist: track.artist,
      });
      return json(result);
    }
  }

  const result = await syncLights(mood, energy);
  return json(result);
}

// ─── Tip Link Handlers ───

export async function handleGetPublicTipLinks(req: Request, handleOrId: string): Promise<Response> {
  // Accept both handle and numeric ID
  const db = getDb();
  let user: { id: number; display_name: string; handle: string | null } | undefined;

  if (/^\d+$/.test(handleOrId)) {
    user = getUserById(parseInt(handleOrId));
  } else {
    user = getUserByHandle(handleOrId);
  }

  if (!user) return json({ error: "User not found" }, 404);

  const links = getTipLinks(user.id);
  return json({
    user: { id: user.id, display_name: user.display_name, handle: user.handle },
    tip_links: links,
  });
}

export async function handleGetMyTipLinks(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const links = getAllTipLinks(auth.userId);
  return json({ tip_links: links });
}

export async function handleUpdateMyTipLinks(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as { links?: Array<{ platform: string; handle: string; is_active: boolean }> };
  if (!body.links || !Array.isArray(body.links)) {
    return json({ error: "links array required" }, 400);
  }

  const validPlatforms = ['venmo', 'cashapp', 'zelle', 'paypal', 'stripe'];
  for (const link of body.links) {
    if (!validPlatforms.includes(link.platform)) {
      return json({ error: `Invalid platform: ${link.platform}` }, 400);
    }
    upsertTipLink(auth.userId, link.platform, link.handle, link.is_active);
  }

  const links = getAllTipLinks(auth.userId);
  return json({ tip_links: links });
}

export async function handleRecordTip(req: Request): Promise<Response> {
  const body = await parseBody(req) as {
    to_user_id?: number;
    platform?: string;
    amount_cents?: number;
    playlist_id?: number;
  };

  if (!body.to_user_id) return json({ error: "to_user_id required" }, 400);

  // Get current user if authenticated, otherwise anonymous
  let fromUserId: number | null = null;
  const sessionId = getSessionCookie(req);
  if (sessionId) {
    const user = await getUserFromSession(sessionId);
    if (user) fromUserId = user.id as number;
  }

  const tip = recordTip({
    to_user_id: body.to_user_id,
    from_user_id: fromUserId,
    platform: body.platform,
    amount_cents: body.amount_cents,
    playlist_id: body.playlist_id,
  });

  return json({ tip }, 201);
}

export async function handleGetTipsReceived(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const tips = getTipsReceived(auth.userId);
  return json({ tips });
}

export async function handleGetTipsGiven(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const tips = getTipsGiven(auth.userId);
  return json({ tips });
}

export async function handleTipLandingPage(req: Request, handle: string): Promise<Response> {
  const db = getDb();
  const user = getUserByHandle(handle);
  if (!user) {
    return new Response(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not Found — CataLog Tips</title><style>body{font-family:system-ui,sans-serif;background:#030712;color:#f1f5f9;display:flex;align-items:center;justify-content:center;height:100dvh;margin:0}div{text-align:center}h1{font-size:1.5rem;color:#cbd5e1}p{color:#64748b}a{color:#7c3aed}</style></head><body><div><h1>DJ Not Found</h1><p>This DJ hasn't set up their tip page yet.</p><a href="/">Back to CataLog</a></div></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const links = getTipLinks(user.id);
  const djName = user.display_name || user.handle || "DJ";
  const djHandle = user.handle || "";

  // Build button HTML for each active platform
  const platformButtons: string[] = [];
  for (const link of links) {
    let href = "#";
    let label = "";
    let color = "";
    let icon = "";

    switch (link.platform) {
      case "venmo":
        href = `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(link.handle_or_url)}&amount=0&note=${encodeURIComponent(`Tip for ${djName}`)}`;
        label = "Tip on Venmo";
        color = "#008CFF";
        icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19.5 5.25l-6.17 14.22c-.18.42-.63.52-1.02.36l-3.63-1.52-2.11 2.34c-.27.3-.78.21-.87-.15l-1.72-7.2-3.48-3.6c-.33-.33-.15-.87.3-.96l18.54-5.28c.45-.12.84.27.72.72l-2.56 9.07h.02z"/></svg>`;
        break;
      case "cashapp":
        href = `https://cash.app/${encodeURIComponent(link.handle_or_url.replace(/^\$/, ""))}`;
        label = "Tip on Cash App";
        color = "#00D632";
        icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><rect x="2" y="4" width="20" height="16" rx="2"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="white">$</text></svg>`;
        break;
      case "zelle":
        href = "#";
        label = `Send via Zelle: ${link.handle_or_url}`;
        color = "#6D28D9";
        icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
        break;
      case "paypal":
        href = `https://paypal.me/${encodeURIComponent(link.handle_or_url.replace(/^https?:\/\/paypal\.me\//, ""))}`;
        label = "Tip via PayPal";
        color = "#003087";
        icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M7.5 4.5h5.4c2.7 0 4.8 1.8 4.8 4.5s-2.1 4.5-4.8 4.5H9.3l-.9 6H5.1l2.4-15z"/><path d="M14.1 13.5c3.3 0 5.7-2.1 5.7-5.1 0-.6-.3-1.2-.6-1.8"/></svg>`;
        break;
      default:
        href = `https://${link.handle_or_url}`;
        label = `Tip via ${link.platform}`;
        color = "#6366f1";
        icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z"/><path d="M12 6v6l4 2"/></svg>`;
        break;
    }

    const isZelle = link.platform === "zelle";
    platformButtons.push(`
      <a href="${isZelle ? "#" : href}" 
         class="tip-btn" 
         style="background:${color};${isZelle ? "cursor:default;" : ""}"
         ${isZelle ? 'onclick="navigator.clipboard.writeText(\'' + link.handle_or_url + '\').then(()=>this.innerText=\'Copied!\').catch(()=>{})" title="Click to copy"' : ""}>
        ${icon}
        <span>${label}</span>
      </a>
    `);
  }

  const buttonsHtml = platformButtons.join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Tip ${djName} — CataLog</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #030712;
      color: #f1f5f9;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 32px;
      font-weight: bold;
      color: white;
    }
    h1 { font-size: 1.5rem; margin-bottom: 4px; }
    .handle { color: #a78bfa; font-size: 0.9rem; margin-bottom: 24px; }
    .tip-buttons { display: flex; flex-direction: column; gap: 12px; }
    .tip-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 20px;
      border-radius: 14px;
      font-size: 1rem;
      font-weight: 600;
      color: white;
      text-decoration: none;
      transition: transform 0.15s, opacity 0.15s;
    }
    .tip-btn:active { transform: scale(0.98); opacity: 0.9; }
    .powered {
      margin-top: 24px;
      font-size: 0.75rem;
      color: #4b5563;
    }
    .powered a { color: #7c3aed; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="avatar">${djName.charAt(0).toUpperCase()}</div>
    <h1>Support ${djName}</h1>
    <p class="handle">@${djHandle}</p>
    <div class="tip-buttons">
      ${buttonsHtml}
    </div>
    <p class="powered">Powered by <a href="/">CataLog</a></p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ─── Artist Track Handlers ───

export async function handleArtistTrackUpload(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const { userId, user } = auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "Invalid form data" }, 400);
  }

  const audioFile = formData.get("audio");
  if (!audioFile || !(audioFile instanceof File)) return json({ error: "Audio file is required" }, 400);
  if (audioFile.size === 0) return json({ error: "Empty audio file" }, 400);
  if (audioFile.size > MAX_FILE_SIZE) return json({ error: "File too large (max 100MB)" }, 400);

  const title = (formData.get("title") as string) || audioFile.name.replace(/\.[^.]+$/, "");
  const artistName = (formData.get("artist_name") as string) || (user as Record<string, unknown>).display_name as string || "";
  const genre = formData.get("genre") as string || null;
  const subgenre = formData.get("subgenre") as string || null;
  const bpmStr = formData.get("bpm") as string;
  const bpm = bpmStr ? parseFloat(bpmStr) : null;
  const musicalKey = formData.get("musical_key") as string || null;
  const description = (formData.get("description") as string) || "";
  const priceStr = formData.get("price_cents") as string;
  const priceCents = priceStr ? parseInt(priceStr) : 0;
  const isPublished = formData.get("is_published") === "true" ? 1 : 0;

  // Create user upload directory
  const userDir = join(ARTIST_UPLOAD_DIR, String(userId));
  if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true });

  // Save audio file
  const audioExt = audioFile.name.split(".").pop() || "mp3";
  const audioUniqueName = `track-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${audioExt}`;
  const audioPath = join(userDir, audioUniqueName);
  await Bun.write(audioPath, audioFile);

  // Save cover art if provided
  let coverArtPath: string | null = null;
  const coverArt = formData.get("cover_art");
  if (coverArt && coverArt instanceof File && coverArt.size > 0) {
    const imgExt = coverArt.name.split(".").pop() || "jpg";
    const coverUniqueName = `cover-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${imgExt}`;
    coverArtPath = join(userDir, coverUniqueName);
    await Bun.write(coverArtPath, coverArt);
  }

  const track = insertArtistTrack({
    user_id: userId,
    title,
    artist_name: artistName,
    genre,
    subgenre,
    bpm,
    musical_key: musicalKey,
    description,
    file_url: audioPath,
    cover_art_url: coverArtPath,
    price_cents: priceCents,
    is_published: isPublished,
  });

  // Handle tags
  const tagNames = formData.getAll("tags") as string[];
  for (const tagName of tagNames) {
    if (tagName) {
      const tag = createTag(tagName);
      attachArtistTrackTag(track.id, tag.id);
    }
  }

  return json({ track }, 201);
}

export function handleArtistTrackList(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const publishedOnly = url.searchParams.get("published_only") === "true";
  const tracks = listArtistTracksByUser(auth.userId, publishedOnly);

  // Attach tags
  const tracksWithTags = tracks.map(t => {
    const tags = getArtistTrackTags(t.id);
    return { ...t, tags };
  });

  return json({ tracks: tracksWithTags });
}

export function handleArtistTracksByUser(req: Request, handle: string): Response {
  const user = getUserByHandle(handle);
  if (!user) return json({ error: "User not found" }, 404);
  if (!user.is_artist) return json({ tracks: [] });

  const tracks = listArtistTracksByUser(user.id, true);
  const tracksWithTags = tracks.map(t => {
    const tags = getArtistTrackTags(t.id);
    return { ...t, tags };
  });

  return json({ tracks: tracksWithTags });
}

export function handleArtistTrackGet(req: Request, trackId: string): Response {
  const track = getArtistTrack(parseInt(trackId));
  if (!track) return json({ error: "Track not found" }, 404);
  const tags = getArtistTrackTags(track.id);
  return json({ ...track, tags });
}

export async function handleArtistTrackUpdate(req: Request, trackId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req);
  const track = updateArtistTrack(parseInt(trackId), auth.userId, body as Record<string, unknown>);
  if (!track) return json({ error: "Track not found" }, 404);
  return json(track);
}

export function handleArtistTrackDelete(req: Request, trackId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const deleted = deleteArtistTrack(parseInt(trackId), auth.userId);
  if (!deleted) return json({ error: "Track not found" }, 404);
  return json({ ok: true });
}

export function handleArtistTrackStream(req: Request, trackId: string): Response {
  const track = getArtistTrack(parseInt(trackId));
  if (!track) return json({ error: "Track not found" }, 404);

  const file = Bun.file(track.file_url);
  if (!file.exists()) return json({ error: "File not found" }, 404);

  // Increment play count
  incrementArtistTrackPlayCount(parseInt(trackId));

  const rangeHeader = req.headers.get("range");
  const fileSize = file.size;

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    return new Response(file.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
      },
    });
  }

  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
    },
  });
}

export function handleArtistTrackDownload(req: Request, trackId: string): Response {
  const track = getArtistTrack(parseInt(trackId));
  if (!track) return json({ error: "Track not found" }, 404);

  incrementArtistTrackDownloadCount(parseInt(trackId));
  return json({ ok: true, download_count: track.download_count + 1 });
}

export async function handleArtistTrackAddToLibrary(req: Request, trackId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const track = getArtistTrack(parseInt(trackId));
  if (!track) return json({ error: "Track not found" }, 404);

  // Copy the artist track into the user's personal library
  const db = getDb();
  const { existsSync: fexists } = require("node:fs");

  // Check if the file exists and copy it to the user's library
  if (!fexists(track.file_url)) return json({ error: "Source file not found" }, 404);

  const userDir = join(UPLOAD_DIR, String(auth.userId));
  if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true });

  const ext = track.file_url.split(".").pop() || "mp3";
  const uniqueName = `imported-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const destPath = join(userDir, uniqueName);

  // Copy file
  const srcFile = Bun.file(track.file_url);
  await Bun.write(destPath, srcFile);

  // Insert into regular tracks table
  const newTrack = insertTrack({
    user_id: auth.userId,
    filename: `${track.artist_name} - ${track.title}.${ext}`,
    filepath: destPath,
    filesize: srcFile.size,
    duration_ms: null,
    bpm: track.bpm,
    musical_key: track.musical_key,
    title: track.title,
    artist: track.artist_name,
    album: null,
    year: null,
    genre: track.genre,
    metadata_status: 'complete',
  });

  return json({ track: newTrack, ok: true }, 201);
}

export function handleArtistTracksBrowse(req: Request): Response {
  const url = new URL(req.url);
  const opts = {
    genre: url.searchParams.get("genre") || undefined,
    bpmMin: url.searchParams.get("bpm_min") ? parseFloat(url.searchParams.get("bpm_min")!) : undefined,
    bpmMax: url.searchParams.get("bpm_max") ? parseFloat(url.searchParams.get("bpm_max")!) : undefined,
    priceFilter: (url.searchParams.get("price") as 'free' | 'paid') || undefined,
    sort: (url.searchParams.get("sort") as 'newest' | 'most_played' | 'most_downloaded') || 'newest',
    limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : 50,
    offset: url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!) : 0,
  };

  const { tracks, total } = listAllPublishedArtistTracks(opts);

  // Attach tags and user info
  const tracksWithExtras = tracks.map(t => {
    const db = getDb();
    const user = db.query("SELECT display_name, handle FROM users WHERE id = ?").get(t.user_id) as { display_name: string; handle: string | null } | undefined;
    const tags = getArtistTrackTags(t.id);
    return { ...t, tags, user_display_name: user?.display_name || "Unknown", user_handle: user?.handle || null };
  });

  const genres = getArtistGenres();

  return json({ tracks: tracksWithExtras, total, genres, limit: opts.limit, offset: opts.offset });
}

// ─── Artist Profile / Settings Handlers ───

export async function handleArtistProfileUpdate(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as {
    is_artist?: boolean;
    artist_name?: string;
    links?: Array<{ platform: string; url: string }>;
  };

  if (body.is_artist !== undefined || body.artist_name !== undefined) {
    updateArtistProfile(auth.userId, {
      is_artist: body.is_artist,
      artist_name: body.artist_name,
    });
  }

  if (body.links && Array.isArray(body.links)) {
    for (const link of body.links) {
      if (link.url) {
        upsertArtistLink(auth.userId, link.platform, link.url);
      } else {
        deleteArtistLink(auth.userId, link.platform);
      }
    }
  }

  const profile = getUserArtistProfile(auth.userId);
  const links = getArtistLinks(auth.userId);

  return json({ profile, links });
}

export function handleArtistProfileGet(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const profile = getUserArtistProfile(auth.userId);
  const links = getArtistLinks(auth.userId);

  return json({ profile, links });
}

// also need to include is_artist and artist_name in handleGetUserProfile response
// the existing handleGetUserProfile already returns profile data that now includes those fields

// ─── Venue Handlers ───

export async function handleCreateVenue(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as {
    name?: string;
    address?: string;
    city?: string;
    website?: string;
    equipment_json?: string;
    light_system_type?: string;
  };

  if (!body.name || !body.name.trim()) return json({ error: "Venue name is required" }, 400);

  const venue = createVenue({
    name: body.name.trim(),
    address: body.address,
    city: body.city,
    website: body.website,
    owner_user_id: auth.userId,
    equipment_json: body.equipment_json,
    light_system_type: body.light_system_type,
  });

  return json({ venue }, 201);
}

export function handleListVenues(_req: Request): Response {
  const venues = listVenues();
  return json({ venues });
}

export function handleUserVenues(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const venues = getUserVenues(auth.userId);
  return json({ venues });
}

export function handleGetVenue(_req: Request, id: string): Response {
  const venue = getVenue(parseInt(id));
  if (!venue) return json({ error: "Venue not found" }, 404);
  return json({ venue });
}

// ─── Gig Handlers ───

export async function handleCreateGig(req: Request, venueId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const venue = getVenue(parseInt(venueId));
  if (!venue) return json({ error: "Venue not found" }, 404);

  const body = await parseBody(req) as {
    title?: string;
    theme?: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    setlist_playlist_id?: number;
  };

  if (!body.title || !body.title.trim()) return json({ error: "Gig title is required" }, 400);
  if (!body.date) return json({ error: "Gig date is required" }, 400);

  const gig = createGig({
    venue_id: parseInt(venueId),
    dj_user_id: auth.userId,
    title: body.title.trim(),
    theme: body.theme,
    date: body.date,
    start_time: body.start_time,
    end_time: body.end_time,
    setlist_playlist_id: body.setlist_playlist_id ?? null,
  });

  return json({ gig }, 201);
}

export function handleGetVenueGigs(_req: Request, venueId: string): Response {
  const gigs = getVenueGigs(parseInt(venueId));
  return json({ gigs });
}

export function handleUserGigs(req: Request): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  const gigs = getUserGigs(auth.userId);
  return json({ gigs });
}

export async function handleUpdateGig(req: Request, gigId: string): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req);
  const gig = updateGig(parseInt(gigId), auth.userId, body as Record<string, unknown>);
  if (!gig) return json({ error: "Gig not found" }, 404);
  return json({ gig });
}

export function handlePushSetlist(req: Request, gigId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const result = pushSetlistToVenue(parseInt(gigId), auth.userId);
  if (!result) return json({ error: "Gig not found" }, 404);

  return json({
    gig: result.gig,
    venue: result.venue,
    track_count: result.trackCount,
    light_params: result.lightParams,
  });
}

export function handleDeleteGig(req: Request, gigId: string): Response {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const deleted = deleteGig(parseInt(gigId), auth.userId);
  if (!deleted) return json({ error: "Gig not found" }, 404);
  return json({ ok: true });
}

// ─── User Genre Handlers ───

export function handleGetUserGenres(req: Request, handle: string): Response {
  const genres = getUserGenresByHandle(handle);
  return json({ genres });
}

export async function handleUpdateMyGenres(req: Request): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await parseBody(req) as { genres?: { name: string; type: string }[] };
  if (!body.genres || !Array.isArray(body.genres)) {
    return json({ error: "genres array is required" }, 400);
  }

  for (const g of body.genres) {
    if (!g.name || typeof g.name !== "string") {
      return json({ error: "Each genre must have a name" }, 400);
    }
    if (g.type !== "specialize" && g.type !== "interest") {
      return json({ error: "Genre type must be 'specialize' or 'interest'" }, 400);
    }
  }

  const genres = setUserGenres(auth.userId, body.genres);
  return json({ genres });
}

export function handleSearchUsersByGenres(req: Request): Response {
  const url = new URL(req.url);
  const genresParam = url.searchParams.get("genres");
  if (!genresParam) return json({ users: [] });

  const genreNames = genresParam.split(",").map(g => g.trim()).filter(Boolean);
  const users = searchUsersByGenres(genreNames);
  return json({ users });
}

// ─── Inspo Handlers ───

export function handleInspoDaily(req: Request): Response {
  const challenge = generateDailyChallenge();
  if (!challenge) return json({ error: "No tracks in library for daily challenge" }, 404);
  return json({ challenge });
}

export function handleInspoRandom(req: Request): Response {
  const challenge = generateRandomChallenge();
  return json({ challenge });
}

// ─── Genre Discovery & Cross-Reference Handlers ───

export async function handleGenreDiscover(req: Request): Promise<Response> {
  const discovered = await discoverNewGenres();
  return json({
    discovered,
    count: discovered.length,
    message: discovered.length > 0
      ? `Found ${discovered.length} new genre(s) not in the existing hierarchy.`
      : "No new genres discovered. Existing hierarchy is comprehensive.",
  });
}

export async function handleTrackCrossReference(req: Request): Promise<Response> {
  const body = await parseBody(req) as { title?: string; artist?: string };
  if (!body.title?.trim() || !body.artist?.trim()) {
    return json({ error: "title and artist are required" }, 400);
  }

  const result = await crossReferenceTrack(body.title.trim(), body.artist.trim());
  return json(result);
}
