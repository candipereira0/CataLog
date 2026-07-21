// Postgres database adapter for Vercel production.
// Mirrors the SQLite schema and query interface from db.ts.
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required for PG adapter");

let sqlFn: any = null;

function getSql(): any {
  if (!sqlFn) {
    sqlFn = neon(DATABASE_URL!);
  }
  return sqlFn;
}

// Simple ? → $N conversion
function pgSql(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

// ─── Types ─────────────────────────────────────────────────────────────
export interface IdentificationRow {
  id: number; user_id: number; audio_hash: string; title: string;
  artist: string; album: string; genre: string; added_to_library: number;
  created_at: string;
}
export interface ArtistTrackRow {
  id: number; user_id: number; title: string; artist: string; album: string;
  genre: string; bpm: number; key: string; duration: number; file_path: string;
  file_size: number; mime_type: string; plays: number; downloads: number;
  is_published: number; created_at: string; updated_at: string;
}
export interface ArtistLinkRow {
  id: number; user_id: number; platform: string; url: string; label: string;
  created_at: string;
}
export interface DeviceRow {
  id: number; user_id: number; device_name: string; device_type: string;
  session_token: string; last_seen: string; created_at: string;
}
export interface DeviceActionRow {
  id: number; device_id: number; action_type: string; payload: string;
  status: string; created_at: string; completed_at: string;
}
export interface VenueRow {
  id: number; name: string; address: string; capacity: number;
  light_system_type: string; light_system_config: string;
  owner_user_id: number; created_at: string;
}
export interface GigRow {
  id: number; venue_id: number; dj_user_id: number; title: string; theme: string;
  date: string; start_time: string; end_time: string;
  setlist_playlist_id: number; status: string; created_at: string;
}
export interface TrackRow {
  id: number; user_id: number; filename: string; title: string | null;
  artist: string | null; album: string | null; genre: string | null;
  bpm: number | null; key: string | null; duration: number | null;
  file_path: string | null; file_size: number | null; mime_type: string | null;
  energy: number; plays: number; synced: number;
  created_at: string; updated_at: string;
}

// ─── PG Query wrapper (mimics SQLite .query().get()/.all()) ────────────
class PgQuery {
  private sqlFn: any;
  constructor(sqlFn: any, private querySql: string) { this.sqlFn = sqlFn; }
  async get(...params: any[]): Promise<any> {
    const r = await this.sqlFn.query(pgSql(this.querySql), params);
    return r.rows[0] ?? null;
  }
  async all(...params: any[]): Promise<any[]> {
    const r = await this.sqlFn.query(pgSql(this.querySql), params);
    return r.rows;
  }
}

// PG Database object (returned by getDb, mimics SQLite interface)
class PgDb {
  constructor(sqlFn: any) { this.sqlFn = sqlFn; }
  query(sql: string) { return new PgQuery(this.sqlFn, sql); }
  async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number }> {
    const result = await this.sqlFn.query(pgSql(sql), params);
    // If it was an INSERT, try to get the returned id
    const upperSql = sql.trim().toUpperCase();
    if (upperSql.startsWith("INSERT")) {
      // Try to extract RETURNING id
      const retMatch = sql.match(/RETURNING\s+(\w+)/i);
      if (retMatch && result.rows.length > 0) {
        return { lastInsertRowid: Number(result.rows[0][retMatch[1].toLowerCase()]) };
      }
      return { lastInsertRowid: 0 };
    }
    return { lastInsertRowid: 0 };
  }
  async exec(sql: string): Promise<void> {
    const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await this.sqlFn.query(stmt);
    }
  }
  // Used for SELECT last_insert_rowid() emulation
  async getLastInsertId(table: string): Promise<number> {
    // PG doesn't have last_insert_rowid; use currval
    // But we use RETURNING in run() instead, so this is a fallback
    const r = await this.sqlFn.query(`SELECT last_value FROM ${table}_id_seq`);
    return r.rows[0]?.last_value ?? 0;
  }
}

let dbInstance: PgDb | null = null;

export function getDb(): PgDb {
  if (!dbInstance) {
    dbInstance = new PgDb(getSql());
  }
  return dbInstance;
}

// ─── Helpers ───────────────────────────────────────────────────────────
function rowOrNull(r: any) { return r ?? null; }
function now() { return new Date().toISOString(); }
function uuid() { return crypto.randomUUID(); }

// ─── Migration ─────────────────────────────────────────────────────────
export async function migrate(): Promise<void> {
  const p = getSql();
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      handle TEXT UNIQUE,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      tier TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL DEFAULT NOW(),
      updated_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tracks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      title TEXT,
      artist TEXT,
      album TEXT,
      genre TEXT,
      bpm DOUBLE PRECISION,
      key TEXT,
      duration DOUBLE PRECISION,
      file_path TEXT,
      file_size INTEGER,
      mime_type TEXT,
      energy DOUBLE PRECISION DEFAULT 5,
      plays INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT NOW(),
      updated_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS track_tags (
      track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (track_id, tag_id)
    );
    CREATE TABLE IF NOT EXISTS playlists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_public INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT NOW(),
      updated_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL DEFAULT NOW(),
      PRIMARY KEY (playlist_id, track_id)
    );
    CREATE TABLE IF NOT EXISTS shares (
      id SERIAL PRIMARY KEY,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT NOW(),
      expires_at TEXT
    );
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_session_id TEXT UNIQUE,
      amount DOUBLE PRECISION,
      currency TEXT DEFAULT 'usd',
      status TEXT DEFAULT 'pending',
      tier TEXT,
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS identifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      audio_hash TEXT,
      title TEXT,
      artist TEXT,
      album TEXT,
      genre TEXT,
      added_to_library INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS follows (
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id)
    );
    CREATE TABLE IF NOT EXISTS playlist_collaborators (
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'editor',
      created_at TEXT NOT NULL DEFAULT NOW(),
      PRIMARY KEY (playlist_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
      track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tip_links (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      label TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tips (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      message TEXT DEFAULT '',
      playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS artist_tracks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      bpm DOUBLE PRECISION,
      key TEXT,
      duration DOUBLE PRECISION,
      file_path TEXT,
      file_size INTEGER,
      mime_type TEXT,
      plays INTEGER DEFAULT 0,
      downloads INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT NOW(),
      updated_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS artist_track_tags (
      track_id INTEGER NOT NULL REFERENCES artist_tracks(id) ON DELETE CASCADE,
      tag_name TEXT NOT NULL,
      PRIMARY KEY (track_id, tag_name)
    );
    CREATE TABLE IF NOT EXISTS artist_links (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      label TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS artist_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      artist_name TEXT,
      bio TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      location TEXT DEFAULT '',
      website TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT NOW(),
      updated_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS devices (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_name TEXT NOT NULL,
      device_type TEXT DEFAULT 'browser',
      session_token TEXT,
      last_seen TEXT NOT NULL DEFAULT NOW(),
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS device_actions (
      id SERIAL PRIMARY KEY,
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL,
      payload TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT NOW(),
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS venues (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      capacity INTEGER DEFAULT 0,
      light_system_type TEXT DEFAULT 'none',
      light_system_config TEXT DEFAULT '{}',
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS venue_gigs (
      id SERIAL PRIMARY KEY,
      venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      dj_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      theme TEXT DEFAULT '',
      date TEXT NOT NULL,
      start_time TEXT DEFAULT '',
      end_time TEXT DEFAULT '',
      setlist_playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'scheduled',
      created_at TEXT NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_genres (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      genre TEXT NOT NULL,
      PRIMARY KEY (user_id, genre)
    );
    CREATE TABLE IF NOT EXISTS track_genres (
      track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      genre TEXT NOT NULL,
      PRIMARY KEY (track_id, genre)
    );
  `);
}

// ─── Seed demo user ────────────────────────────────────────────────────
export async function seed(): Promise<void> {
  const d = getDb();
  const existing = await d.query("SELECT id FROM users").all();
  if (existing.length === 0) {
    const passwordHash = await Bun.password.hash("password123");
    await d.run(
      "INSERT INTO users (email, password_hash, display_name, handle, tier) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ["demo@catalog.app", passwordHash, "Demo DJ", "demo", "pro"]
    );
    console.log("[pg] Seeded demo user: demo@catalog.app / password123");
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────
export async function getUserFromSession(token: string) {
  const d = getDb();
  const row = await d.query(
    "SELECT s.user_id, u.email, u.display_name, u.handle, u.tier FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > $2"
  ).get(token, now());
  return row ? { userId: row.user_id, email: row.email, displayName: row.display_name, handle: row.handle, tier: row.tier } : null;
}

export async function createSession(userId: number) {
  const d = getDb();
  const token = uuid();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await d.run("INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)", [userId, token, expires]);
  return token;
}

export async function deleteSession(token: string) {
  const d = getDb();
  await d.run("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function getUserById(id: number) {
  const d = getDb();
  return rowOrNull(await d.query("SELECT id, email, display_name, handle, bio, avatar_url, tier FROM users WHERE id = $1").get(id));
}

export async function getUserByHandle(handle: string) {
  const d = getDb();
  return rowOrNull(await d.query("SELECT id, email, display_name, handle, bio, avatar_url, tier FROM users WHERE handle = $1").get(handle));
}

// ─── Tracks ────────────────────────────────────────────────────────────
export async function insertTrack(data: any) {
  const d = getDb();
  const r = await d.run(
    "INSERT INTO tracks (user_id, filename, title, artist, album, genre, bpm, key, duration, file_path, file_size, mime_type, energy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id",
    [data.userId, data.filename, data.title || null, data.artist || null, data.album || null, data.genre || null, data.bpm || null, data.key || null, data.duration || null, data.file_path || null, data.file_size || null, data.mime_type || null, data.energy || 5]
  );
  return d.query("SELECT * FROM tracks WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function getTrack(id: number) {
  return rowOrNull(await getDb().query("SELECT * FROM tracks WHERE id = $1").get(id));
}

export async function listTracks(userId: number, opts?: { genre?: string; search?: string; offset?: number; limit?: number }) {
  const d = getDb();
  let sql = "SELECT * FROM tracks WHERE user_id = $1";
  const params: any[] = [userId];
  let idx = 1;
  if (opts?.genre) { idx++; sql += ` AND genre = $${idx}`; params.push(opts.genre); }
  if (opts?.search) { idx++; sql += ` AND (title LIKE $${idx} OR artist LIKE $${idx} OR album LIKE $${idx})`; const s = `%${opts.search}%`; params.push(s); }
  sql += " ORDER BY created_at DESC";
  if (opts?.limit) { idx++; sql += ` LIMIT $${idx}`; params.push(opts.limit); }
  if (opts?.offset) { idx++; sql += ` OFFSET $${idx}`; params.push(opts.offset); }
  return d.query(sql).all(...params);
}

export async function updateTrack(id: number, data: any) {
  const d = getDb();
  const sets: string[] = []; const vals: any[] = []; let idx = 0;
  for (const k of ["title","artist","album","genre","bpm","key","duration","file_path","file_size","mime_type","energy"]) {
    if (data[k] !== undefined) { idx++; sets.push(`${k}=$${idx}`); vals.push(data[k]); }
  }
  if (sets.length) { idx++; sets.push(`updated_at=$${idx}`); vals.push(now()); idx++; vals.push(id); await d.run(`UPDATE tracks SET ${sets.join(",")} WHERE id=$${idx}`, vals); }
  return d.query("SELECT * FROM tracks WHERE id = $1").get(id);
}

export async function deleteTrack(id: number) {
  await getDb().run("DELETE FROM tracks WHERE id = $1", [id]);
}

export async function incrementPlayCount(id: number) {
  await getDb().run("UPDATE tracks SET plays = plays + 1 WHERE id = $1", [id]);
}

export async function updateTrackSyncStatus(id: number, synced: number) {
  await getDb().run("UPDATE tracks SET synced = $1 WHERE id = $2", [synced, id]);
}

export async function getSyncStatus(userId: number) {
  const d = getDb();
  const total = (await d.query("SELECT COUNT(*) as c FROM tracks WHERE user_id = $1").get(userId) as any).c;
  const synced = (await d.query("SELECT COUNT(*) as c FROM tracks WHERE user_id = $1 AND synced = 1").get(userId) as any).c;
  return { total, synced };
}

export async function getCompatibleTracks(userId: number, bpm: number, key: string, limit: number = 10) {
  const d = getDb();
  return d.query("SELECT * FROM tracks WHERE user_id = $1 AND bpm BETWEEN $2 AND $3 ORDER BY ABS(bpm - $4) LIMIT $5")
    .all(userId, bpm - 5, bpm + 5, bpm, limit);
}

// ─── Genres & Keys ─────────────────────────────────────────────────────
export async function getGenres() {
  const rows = await getDb().query("SELECT DISTINCT genre FROM tracks WHERE genre IS NOT NULL AND genre != ''").all();
  return rows.map((r: any) => r.genre);
}

export async function getKeys() {
  const rows = await getDb().query("SELECT DISTINCT key FROM tracks WHERE key IS NOT NULL AND key != ''").all();
  return rows.map((r: any) => r.key);
}

export async function addTrackGenres(trackId: number, genres: string[]) {
  const d = getDb();
  for (const g of genres) {
    try { await d.run("INSERT INTO track_genres (track_id, genre) VALUES ($1, $2) ON CONFLICT DO NOTHING", [trackId, g]); } catch {}
  }
}

export async function removeTrackGenre(trackId: number, genre: string) {
  await getDb().run("DELETE FROM track_genres WHERE track_id = $1 AND genre = $2", [trackId, genre]);
}

export async function getTrackGenres(trackId: number) {
  return ((await getDb().query("SELECT genre FROM track_genres WHERE track_id = $1").all(trackId)) as any[]).map((r: any) => r.genre);
}

export async function getTracksWithGenres(userId: number, genres: string[]) {
  if (!genres.length) return [];
  const d = getDb();
  const ph = genres.map((_, i) => `$${i + 2}`).join(",");
  return d.query(`SELECT DISTINCT t.* FROM tracks t JOIN track_genres tg ON tg.track_id = t.id WHERE t.user_id = $1 AND tg.genre IN (${ph})`).all(userId, ...genres);
}

// ─── Tags ──────────────────────────────────────────────────────────────
export async function createTag(userId: number, name: string) {
  const d = getDb();
  const r = await d.run("INSERT INTO tags (user_id, name) VALUES ($1, $2) RETURNING id", [userId, name]);
  return d.query("SELECT * FROM tags WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function listTags(userId: number) {
  return getDb().query("SELECT * FROM tags WHERE user_id = $1 ORDER BY name").all(userId);
}

export async function attachTag(trackId: number, tagId: number) {
  try { await getDb().run("INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [trackId, tagId]); } catch {}
}

export async function detachTag(trackId: number, tagId: number) {
  await getDb().run("DELETE FROM track_tags WHERE track_id = $1 AND tag_id = $2", [trackId, tagId]);
}

export async function getTrackTags(trackId: number) {
  return getDb().query("SELECT t.* FROM tags t JOIN track_tags tt ON tt.tag_id = t.id WHERE tt.track_id = $1").all(trackId);
}

// ─── Playlists ─────────────────────────────────────────────────────────
export async function createPlaylist(userId: number, name: string, description: string = "", isPublic: number = 0) {
  const d = getDb();
  const r = await d.run("INSERT INTO playlists (user_id, name, description, is_public) VALUES ($1, $2, $3, $4) RETURNING id", [userId, name, description, isPublic]);
  return d.query("SELECT * FROM playlists WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function listPlaylists(userId: number) {
  return getDb().query("SELECT * FROM playlists WHERE user_id = $1 ORDER BY updated_at DESC").all(userId);
}

export async function getPlaylist(id: number) {
  return rowOrNull(await getDb().query("SELECT * FROM playlists WHERE id = $1").get(id));
}

export async function deletePlaylist(id: number) {
  await getDb().run("DELETE FROM playlists WHERE id = $1", [id]);
}

export async function addTrackToPlaylist(playlistId: number, trackId: number, position?: number) {
  const d = getDb();
  const posRow = await d.query("SELECT COALESCE(MAX(position),0)+1 as p FROM playlist_tracks WHERE playlist_id = $1").get(playlistId) as any;
  const pos = position ?? (posRow?.p ?? 1);
  try { await d.run("INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [playlistId, trackId, pos]); } catch {}
  await d.run("UPDATE playlists SET updated_at = $1 WHERE id = $2", [now(), playlistId]);
}

export async function removeTrackFromPlaylist(playlistId: number, trackId: number) {
  await getDb().run("DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2", [playlistId, trackId]);
}

export async function canAccessPlaylist(playlistId: number, userId: number) {
  const p = await getPlaylist(playlistId);
  if (!p) return false;
  if (p.user_id === userId) return true;
  if (p.is_public) return true;
  const collab = await getDb().query("SELECT 1 FROM playlist_collaborators WHERE playlist_id = $1 AND user_id = $2").get(playlistId, userId);
  return !!collab;
}

// ─── Shares ────────────────────────────────────────────────────────────
export async function createShare(playlistId: number) {
  const d = getDb();
  const token = uuid();
  await d.run("INSERT INTO shares (playlist_id, token) VALUES ($1, $2)", [playlistId, token]);
  return d.query("SELECT * FROM shares WHERE token = $1").get(token);
}

export async function getShareByToken(token: string) {
  return rowOrNull(await getDb().query("SELECT * FROM shares WHERE token = $1").get(token));
}

export async function deleteShare(playlistId: number) {
  await getDb().run("DELETE FROM shares WHERE playlist_id = $1", [playlistId]);
}

// ─── Payments ──────────────────────────────────────────────────────────
export async function createPayment(userId: number, sessionId: string, amount: number, tier: string) {
  const d = getDb();
  await d.run("INSERT INTO payments (user_id, stripe_session_id, amount, status, tier) VALUES ($1, $2, $3, 'pending', $4)", [userId, sessionId, amount, tier]);
  return d.query("SELECT * FROM payments WHERE stripe_session_id = $1").get(sessionId);
}

export async function completePayment(sessionId: string) {
  const d = getDb();
  await d.run("UPDATE payments SET status = 'completed' WHERE stripe_session_id = $1", [sessionId]);
  const p = await d.query("SELECT * FROM payments WHERE stripe_session_id = $1").get(sessionId) as any;
  if (p?.tier) await d.run("UPDATE users SET tier = $1 WHERE id = $2", [p.tier, p.user_id]);
  return p;
}

export async function getUserPaymentHistory(userId: number) {
  return getDb().query("SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC").all(userId);
}

export async function updateUserTier(userId: number, tier: string) {
  await getDb().run("UPDATE users SET tier = $1 WHERE id = $2", [tier, userId]);
}

// ─── Identifications ──────────────────────────────────────────────────
export async function insertIdentification(userId: number, audioHash: string, title: string, artist: string, album: string, genre: string) {
  const d = getDb();
  const r = await d.run("INSERT INTO identifications (user_id, audio_hash, title, artist, album, genre) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [userId, audioHash, title, artist, album, genre]);
  return d.query("SELECT * FROM identifications WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function markIdentificationAdded(id: number) {
  await getDb().run("UPDATE identifications SET added_to_library = 1 WHERE id = $1", [id]);
}

export async function getRecentIdentifications(userId: number, limit: number = 20) {
  return getDb().query("SELECT * FROM identifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2").all(userId, limit);
}

export async function insertShazamTrack(userId: number, title: string, artist: string, album: string, genre: string) {
  const d = getDb();
  const r = await d.run("INSERT INTO tracks (user_id, filename, title, artist, album, genre) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [userId, title, title, artist, album, genre]);
  return d.query("SELECT * FROM tracks WHERE id = $1").get(Number(r.lastInsertRowid));
}

// ─── Profile / Users ───────────────────────────────────────────────────
export async function getUserProfile(userId: number) {
  const d = getDb();
  const u = await d.query("SELECT id, email, display_name, handle, bio, avatar_url, tier, created_at FROM users WHERE id = $1").get(userId);
  if (!u) return null;
  const followers = (await d.query("SELECT COUNT(*) as c FROM follows WHERE following_id = $1").get(userId) as any).c;
  const following = (await d.query("SELECT COUNT(*) as c FROM follows WHERE follower_id = $1").get(userId) as any).c;
  return { ...u, followerCount: followers, followingCount: following };
}

export async function getFeaturedPlaylists() {
  return getDb().query("SELECT * FROM playlists WHERE is_public = 1 ORDER BY updated_at DESC LIMIT 10").all();
}

export async function getRecentActivity(userId: number) {
  return getDb().query("SELECT * FROM tracks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10").all(userId);
}

export async function getUserTagCloud(userId: number) {
  return getDb().query("SELECT t.name, COUNT(*) as cnt FROM tags t JOIN track_tags tt ON tt.tag_id = t.id JOIN tracks tr ON tr.id = tt.track_id WHERE tr.user_id = $1 GROUP BY t.name ORDER BY cnt DESC LIMIT 20").all(userId);
}

export async function checkHandleAvailable(handle: string) {
  const r = await getDb().query("SELECT 1 FROM users WHERE handle = $1").get(handle);
  return !r;
}

export async function updateUserProfile(userId: number, data: any) {
  const d = getDb();
  const sets: string[] = []; const vals: any[] = []; let idx = 0;
  for (const k of ["display_name","bio","avatar_url","handle"]) {
    if (data[k] !== undefined) { idx++; sets.push(`${k}=$${idx}`); vals.push(data[k]); }
  }
  if (sets.length) { idx++; sets.push(`updated_at=$${idx}`); vals.push(now()); idx++; vals.push(userId); await d.run(`UPDATE users SET ${sets.join(",")} WHERE id=$${idx}`, vals); }
  return d.query("SELECT id, email, display_name, handle, bio, avatar_url, tier FROM users WHERE id = $1").get(userId);
}

export async function getPublicUsers(limit: number = 50, offset: number = 0) {
  return getDb().query("SELECT id, display_name, handle, bio, avatar_url FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2").all(limit, offset);
}

// ─── Follows ───────────────────────────────────────────────────────────
export async function followUser(followerId: number, followingId: number) {
  try { await getDb().run("INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [followerId, followingId]); return true; } catch { return false; }
}

export async function unfollowUser(followerId: number, followingId: number) {
  await getDb().run("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [followerId, followingId]);
}

export async function isFollowing(followerId: number, followingId: number) {
  return !!(await getDb().query("SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2").get(followerId, followingId));
}

export async function getFollowers(userId: number) {
  return getDb().query("SELECT u.id, u.display_name, u.handle, u.avatar_url FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.following_id = $1").all(userId);
}

export async function getFollowing(userId: number) {
  return getDb().query("SELECT u.id, u.display_name, u.handle, u.avatar_url FROM follows f JOIN users u ON u.id = f.following_id WHERE f.follower_id = $1").all(userId);
}

export async function getFollowerCount(userId: number) {
  return (await getDb().query("SELECT COUNT(*) as c FROM follows WHERE following_id = $1").get(userId) as any).c;
}

// ─── Collaborators ─────────────────────────────────────────────────────
export async function addCollaborator(playlistId: number, userId: number, role: string = "editor") {
  try { await getDb().run("INSERT INTO playlist_collaborators (playlist_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [playlistId, userId, role]); } catch {}
}

export async function removeCollaborator(playlistId: number, userId: number) {
  await getDb().run("DELETE FROM playlist_collaborators WHERE playlist_id = $1 AND user_id = $2", [playlistId, userId]);
}

export async function getCollaborators(playlistId: number) {
  return getDb().query("SELECT u.id, u.display_name, u.handle, u.avatar_url, pc.role FROM playlist_collaborators pc JOIN users u ON u.id = pc.user_id WHERE pc.playlist_id = $1").all(playlistId);
}

// ─── Posts ─────────────────────────────────────────────────────────────
export async function createPost(userId: number, content: string, playlistId?: number, trackId?: number) {
  const d = getDb();
  const r = await d.run("INSERT INTO posts (user_id, content, playlist_id, track_id) VALUES ($1, $2, $3, $4) RETURNING id", [userId, content, playlistId || null, trackId || null]);
  return d.query("SELECT * FROM posts WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function getPostsByUser(userId: number) {
  return getDb().query("SELECT p.*, u.display_name, u.handle, u.avatar_url FROM posts p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1 ORDER BY p.created_at DESC").all(userId);
}

export async function getFeedPosts(userId: number, limit: number = 50) {
  return getDb().query("SELECT p.*, u.display_name, u.handle, u.avatar_url FROM posts p JOIN users u ON u.id = p.user_id WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1) OR p.user_id = $2 ORDER BY p.created_at DESC LIMIT $3").all(userId, userId, limit);
}

export async function getPostById(id: number) {
  return rowOrNull(await getDb().query("SELECT p.*, u.display_name, u.handle, u.avatar_url FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = $1").get(id));
}

export async function deletePost(id: number, userId: number) {
  await getDb().run("DELETE FROM posts WHERE id = $1 AND user_id = $2", [id, userId]);
}

export async function likePost(postId: number, userId: number) {
  try { await getDb().run("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [postId, userId]); } catch {}
}

export async function unlikePost(postId: number, userId: number) {
  await getDb().run("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", [postId, userId]);
}

// ─── Notifications ─────────────────────────────────────────────────────
export async function createNotification(userId: number, type: string, message: string, data?: any) {
  const d = getDb();
  const r = await d.run("INSERT INTO notifications (user_id, type, message, data) VALUES ($1, $2, $3, $4) RETURNING id", [userId, type, message, data ? JSON.stringify(data) : null]);
  return d.query("SELECT * FROM notifications WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function getNotifications(userId: number) {
  return getDb().query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50").all(userId);
}

export async function markNotificationRead(id: number) {
  await getDb().run("UPDATE notifications SET is_read = 1 WHERE id = $1", [id]);
}

export async function markAllNotificationsRead(userId: number) {
  await getDb().run("UPDATE notifications SET is_read = 1 WHERE user_id = $1", [userId]);
}

export async function getUnreadNotificationCount(userId: number) {
  return (await getDb().query("SELECT COUNT(*) as c FROM notifications WHERE user_id = $1 AND is_read = 0").get(userId) as any).c;
}

// ─── Tips ──────────────────────────────────────────────────────────────
export async function getTipLinks(userId: number) {
  return getDb().query("SELECT * FROM tip_links WHERE user_id = $1").all(userId);
}

export async function getAllTipLinks(userId: number) { return getTipLinks(userId); }

export async function upsertTipLink(userId: number, platform: string, url: string, label: string = "") {
  const d = getDb();
  const existing = await d.query("SELECT id FROM tip_links WHERE user_id = $1 AND platform = $2").get(userId, platform) as any;
  if (existing) { await d.run("UPDATE tip_links SET url = $1, label = $2 WHERE id = $3", [url, label, existing.id]); }
  else { await d.run("INSERT INTO tip_links (user_id, platform, url, label) VALUES ($1, $2, $3, $4)", [userId, platform, url, label]); }
}

export async function recordTip(fromUserId: number | null, toUserId: number, amount: number, message: string = "", playlistId?: number) {
  const d = getDb();
  const r = await d.run("INSERT INTO tips (from_user_id, to_user_id, amount, message, playlist_id) VALUES ($1, $2, $3, $4, $5) RETURNING id", [fromUserId, toUserId, amount, message, playlistId || null]);
  return d.query("SELECT * FROM tips WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function getTipsReceived(userId: number) {
  return getDb().query("SELECT t.*, u.display_name as from_name, u.handle as from_handle FROM tips t LEFT JOIN users u ON u.id = t.from_user_id WHERE t.to_user_id = $1 ORDER BY t.created_at DESC").all(userId);
}

export async function getTipsGiven(userId: number) {
  return getDb().query("SELECT t.*, u.display_name as to_name, u.handle as to_handle FROM tips t JOIN users u ON u.id = t.to_user_id WHERE t.from_user_id = $1 ORDER BY t.created_at DESC").all(userId);
}

export async function getPlaylistTipCount(playlistId: number) {
  return (await getDb().query("SELECT COUNT(*) as c FROM tips WHERE playlist_id = $1").get(playlistId) as any).c;
}

// ─── Artist Tracks ─────────────────────────────────────────────────────
export async function insertArtistTrack(data: any) {
  const d = getDb();
  const r = await d.run(
    "INSERT INTO artist_tracks (user_id, title, artist, album, genre, bpm, key, duration, file_path, file_size, mime_type, is_published) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
    [data.userId, data.title, data.artist, data.album||"", data.genre||"", data.bpm||null, data.key||null, data.duration||null, data.file_path||null, data.file_size||null, data.mime_type||null, data.isPublished||0]
  );
  return getArtistTrack(Number(r.lastInsertRowid));
}

export async function getArtistTrack(id: number) {
  return rowOrNull(await getDb().query("SELECT * FROM artist_tracks WHERE id = $1").get(id));
}

export async function listArtistTracksByUser(userId: number) {
  return getDb().query("SELECT * FROM artist_tracks WHERE user_id = $1 ORDER BY created_at DESC").all(userId);
}

export async function listAllPublishedArtistTracks() {
  return getDb().query("SELECT * FROM artist_tracks WHERE is_published = 1 ORDER BY created_at DESC").all();
}

export async function updateArtistTrack(id: number, data: any) {
  const d = getDb();
  const sets: string[] = []; const vals: any[] = []; let idx = 0;
  for (const k of ["title","artist","album","genre","bpm","key","duration","file_path","file_size","mime_type","is_published"]) {
    if (data[k] !== undefined) { idx++; sets.push(`${k}=$${idx}`); vals.push(data[k]); }
  }
  if (sets.length) { idx++; sets.push(`updated_at=$${idx}`); vals.push(now()); idx++; vals.push(id); await d.run(`UPDATE artist_tracks SET ${sets.join(",")} WHERE id=$${idx}`, vals); }
  return getArtistTrack(id);
}

export async function deleteArtistTrack(id: number) {
  await getDb().run("DELETE FROM artist_tracks WHERE id = $1", [id]);
}

export async function incrementArtistTrackPlayCount(id: number) {
  await getDb().run("UPDATE artist_tracks SET plays = plays + 1 WHERE id = $1", [id]);
}

export async function incrementArtistTrackDownloadCount(id: number) {
  await getDb().run("UPDATE artist_tracks SET downloads = downloads + 1 WHERE id = $1", [id]);
}

export async function attachArtistTrackTag(trackId: number, tagName: string) {
  try { await getDb().run("INSERT INTO artist_track_tags (track_id, tag_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [trackId, tagName]); } catch {}
}

export async function detachArtistTrackTag(trackId: number, tagName: string) {
  await getDb().run("DELETE FROM artist_track_tags WHERE track_id = $1 AND tag_name = $2", [trackId, tagName]);
}

export async function getArtistTrackTags(trackId: number) {
  return ((await getDb().query("SELECT tag_name FROM artist_track_tags WHERE track_id = $1").all(trackId)) as any[]).map((r:any)=>r.tag_name);
}

export async function getArtistGenres() {
  return ((await getDb().query("SELECT DISTINCT genre FROM artist_tracks WHERE genre IS NOT NULL AND genre != ''").all()) as any[]).map((r:any)=>r.genre);
}

export async function getArtistLinks(userId: number) {
  return getDb().query("SELECT * FROM artist_links WHERE user_id = $1").all(userId);
}

export async function upsertArtistLink(userId: number, platform: string, url: string, label: string = "") {
  const d = getDb();
  const ex = await d.query("SELECT id FROM artist_links WHERE user_id = $1 AND platform = $2").get(userId, platform) as any;
  if (ex) { await d.run("UPDATE artist_links SET url = $1, label = $2 WHERE id = $3", [url, label, ex.id]); }
  else { await d.run("INSERT INTO artist_links (user_id, platform, url, label) VALUES ($1, $2, $3, $4)", [userId, platform, url, label]); }
}

export async function deleteArtistLink(id: number) {
  await getDb().run("DELETE FROM artist_links WHERE id = $1", [id]);
}

export async function updateArtistProfile(userId: number, data: any) {
  const d = getDb();
  const ex = await d.query("SELECT user_id FROM artist_profiles WHERE user_id = $1").get(userId);
  if (ex) {
    await d.run("UPDATE artist_profiles SET artist_name=$1, bio=$2, genre=$3, location=$4, website=$5, updated_at=$6 WHERE user_id=$7", [data.artist_name||null, data.bio||"", data.genre||"", data.location||"", data.website||"", now(), userId]);
  } else {
    await d.run("INSERT INTO artist_profiles (user_id, artist_name, bio, genre, location, website) VALUES ($1, $2, $3, $4, $5, $6)", [userId, data.artist_name||null, data.bio||"", data.genre||"", data.location||"", data.website||""]);
  }
  return getUserArtistProfile(userId);
}

export async function getUserArtistProfile(userId: number) {
  return rowOrNull(await getDb().query("SELECT * FROM artist_profiles WHERE user_id = $1").get(userId));
}

// ─── Devices ───────────────────────────────────────────────────────────
export async function registerDevice(userId: number, deviceName: string, deviceType: string = "browser") {
  const d = getDb();
  const token = uuid();
  const r = await d.run("INSERT INTO devices (user_id, device_name, device_type, session_token) VALUES ($1, $2, $3, $4) RETURNING id", [userId, deviceName, deviceType, token]);
  return d.query("SELECT * FROM devices WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function listUserDevices(userId: number) {
  return getDb().query("SELECT * FROM devices WHERE user_id = $1 ORDER BY last_seen DESC").all(userId);
}

export async function deleteDevice(id: number) {
  await getDb().run("DELETE FROM devices WHERE id = $1", [id]);
}

export async function getDevice(id: number) {
  return rowOrNull(await getDb().query("SELECT * FROM devices WHERE id = $1").get(id));
}

export async function getDeviceBySession(token: string) {
  return rowOrNull(await getDb().query("SELECT * FROM devices WHERE session_token = $1").get(token));
}

export async function createDeviceAction(deviceId: number, actionType: string, payload: any = {}) {
  const d = getDb();
  const r = await d.run("INSERT INTO device_actions (device_id, action_type, payload) VALUES ($1, $2, $3) RETURNING id", [deviceId, actionType, JSON.stringify(payload)]);
  return d.query("SELECT * FROM device_actions WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function getPendingActions(deviceId: number) {
  return getDb().query("SELECT * FROM device_actions WHERE device_id = $1 AND status = 'pending'").all(deviceId);
}

export async function completeDeviceAction(id: number) {
  await getDb().run("UPDATE device_actions SET status = 'completed', completed_at = $1 WHERE id = $2", [now(), id]);
}

// ─── Venues & Gigs ─────────────────────────────────────────────────────
export async function createVenue(data: any) {
  const d = getDb();
  const r = await d.run("INSERT INTO venues (name, address, capacity, light_system_type, light_system_config, owner_user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [data.name, data.address||"", data.capacity||0, data.light_system_type||"none", data.light_system_config||"{}", data.owner_user_id]);
  return d.query("SELECT * FROM venues WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function getVenue(id: number) {
  return rowOrNull(await getDb().query("SELECT * FROM venues WHERE id = $1").get(id));
}

export async function listVenues() {
  return getDb().query("SELECT * FROM venues ORDER BY name").all();
}

export async function getUserVenues(userId: number) {
  return getDb().query("SELECT * FROM venues WHERE owner_user_id = $1 ORDER BY name").all(userId);
}

export async function createGig(data: any) {
  const d = getDb();
  const r = await d.run("INSERT INTO venue_gigs (venue_id, dj_user_id, title, theme, date, start_time, end_time, setlist_playlist_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    [data.venue_id, data.dj_user_id, data.title, data.theme||"", data.date, data.start_time||"", data.end_time||"", data.setlist_playlist_id||null]);
  return d.query("SELECT * FROM venue_gigs WHERE id = $1").get(Number(r.lastInsertRowid));
}

export async function getGig(id: number) {
  return rowOrNull(await getDb().query("SELECT * FROM venue_gigs WHERE id = $1").get(id));
}

export async function updateGig(id: number, userId: number, fields: Record<string, unknown>) {
  const d = getDb();
  const allowed = ["title","theme","date","start_time","end_time","setlist_playlist_id","status"];
  const sets: string[] = []; const vals: any[] = []; let idx = 0;
  for (const [k,v] of Object.entries(fields)) { if (allowed.includes(k)) { idx++; sets.push(`${k}=$${idx}`); vals.push(v); } }
  if (!sets.length) return undefined;
  idx++; vals.push(id); idx++; vals.push(userId);
  await d.run(`UPDATE venue_gigs SET ${sets.join(",")} WHERE id=$${idx-1} AND dj_user_id=$${idx}`, vals);
  return d.query("SELECT * FROM venue_gigs WHERE id = $1 AND dj_user_id = $2").get(id, userId);
}

export async function deleteGig(id: number, userId: number) {
  await getDb().run("DELETE FROM venue_gigs WHERE id = $1 AND dj_user_id = $2", [id, userId]);
}

export async function getVenueGigs(venueId: number, userId?: number) {
  if (userId) return getDb().query("SELECT * FROM venue_gigs WHERE venue_id = $1 AND dj_user_id = $2 ORDER BY date ASC, start_time ASC").all(venueId, userId);
  return getDb().query("SELECT * FROM venue_gigs WHERE venue_id = $1 ORDER BY date ASC, start_time ASC").all(venueId);
}

export async function getUserGigs(userId: number) {
  return getDb().query("SELECT * FROM venue_gigs WHERE dj_user_id = $1 ORDER BY date ASC, start_time ASC").all(userId);
}

export async function pushSetlistToVenue(gigId: number, userId: number) {
  const d = getDb();
  const gig = await d.query("SELECT * FROM venue_gigs WHERE id = $1 AND dj_user_id = $2").get(gigId, userId);
  if (!gig) return null;
  const venue = await d.query("SELECT * FROM venues WHERE id = $1").get(gig.venue_id);
  if (!venue) return null;
  let trackCount = 0;
  const lightParams: any[] = [];
  if (gig.setlist_playlist_id) {
    const tracks = await d.query("SELECT t.* FROM tracks t JOIN playlist_tracks pt ON pt.track_id = t.id WHERE pt.playlist_id = $1 ORDER BY pt.position").all(gig.setlist_playlist_id);
    trackCount = tracks.length;
    for (const t of tracks as any[]) {
      lightParams.push({ trackId: t.id, title: t.title||t.filename, artist: t.artist||"Unknown", bpm: t.bpm??120, energy: t.energy??5 });
    }
  }
  if (venue.light_system_type !== "none" && gig.status === "scheduled") {
    await d.run("UPDATE venue_gigs SET status = 'confirmed' WHERE id = $1", [gigId]);
  }
  return { gig, venue, trackCount, lightParams };
}

// ─── User Genres ───────────────────────────────────────────────────────
export async function getUserGenresByHandle(handle: string) {
  const user = await getDb().query("SELECT id FROM users WHERE handle = $1").get(handle) as any;
  if (!user) return [];
  return ((await getDb().query("SELECT genre FROM user_genres WHERE user_id = $1").all(user.id)) as any[]).map((r:any)=>r.genre);
}

export async function setUserGenres(userId: number, genres: string[]) {
  const d = getDb();
  await d.run("DELETE FROM user_genres WHERE user_id = $1", [userId]);
  for (const g of genres) { await d.run("INSERT INTO user_genres (user_id, genre) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, g]); }
}

export async function searchUsersByGenres(genres: string[]) {
  if (!genres.length) return [];
  const ph = genres.map((_, i) => `$${i + 1}`).join(",");
  return getDb().query(`SELECT DISTINCT u.id, u.display_name, u.handle, u.avatar_url, u.bio FROM users u JOIN user_genres ug ON ug.user_id = u.id WHERE ug.genre IN (${ph}) LIMIT 50`).all(...genres);
}

// ─── DJ Matches ────────────────────────────────────────────────────────
export async function getDJMatches(userId: number, limit: number = 20) {
  const d = getDb();
  const myGenres = ((await d.query("SELECT genre FROM user_genres WHERE user_id = $1").all(userId)) as any[]).map((r:any) => r.genre);
  if (!myGenres.length) {
    return d.query("SELECT id, display_name, handle, avatar_url, bio FROM users WHERE id != $1 ORDER BY RANDOM() LIMIT $2").all(userId, limit);
  }
  const ph = myGenres.map((_, i) => `$${i + 2}`).join(",");
  return d.query(`SELECT u.id, u.display_name, u.handle, u.avatar_url, u.bio, COUNT(*) as common_genres FROM users u JOIN user_genres ug ON ug.user_id = u.id WHERE u.id != $1 AND ug.genre IN (${ph}) GROUP BY u.id ORDER BY common_genres DESC LIMIT $${myGenres.length + 2}`).all(userId, ...myGenres, limit);
}

// ─── updateDeviceLastSeen ──────────────────────────────────────────────
export async function updateDeviceLastSeen(sessionOrId: string | number) {
  const d = getDb();
  if (typeof sessionOrId === "string") {
    await d.run("UPDATE devices SET last_seen = $1 WHERE session_token = $2", [now(), sessionOrId]);
  } else {
    await d.run("UPDATE devices SET last_seen = $1 WHERE id = $2", [now(), sessionOrId]);
  }
}
