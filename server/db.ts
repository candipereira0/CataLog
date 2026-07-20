// Database adapter: PG (Vercel production) or SQLite (local dev).
// Uses top-level await to initialize PG at module load time.
// Functions return raw values for SQLite, Promises for PG.
// Handlers use 'await' uniformly — it works for both.

const USE_PG = !!process.env.DATABASE_URL;

// ─── PG initialization (top-level await) ──────────────────────────────
let _pg: any = null;
if (USE_PG) {
  _pg = await import("./db-pg");
  await _pg.migrate();
  await _pg.seed();
}

// ─── SQLite implementation ─────────────────────────────────────────────
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const MODULE_DIR = (() => {
  try { return (import.meta as any).dir; } catch {
    return dirname(fileURLToPath(import.meta.url));
  }
})();
const DATA_DIR = process.env.CATALOG_DATA_DIR || join(MODULE_DIR, "..", "data");
const DB_PATH = join(DATA_DIR, "catalog.db");

let sqliteDb: any = null;

function getSqliteCtor(): any {
  try { return require("bun:sqlite").Database; } catch {
    const B = require("better-sqlite3").default || require("better-sqlite3");
    return class {
      private db: any;
      constructor(path: string) { this.db = new B(path); }
      exec(sql: string) { return this.db.exec(sql); }
      query(sql: string) {
        const s = this.db.prepare(sql);
        return { get: (...p: any[]) => s.get(...p), all: (...p: any[]) => s.all(...p), run: (...p: any[]) => s.run(...p), values: (...p: any[]) => { try { return s.values(...p); } catch { return s.raw().all(...p); } } };
      }
      run(sql: string, params: any[] = []) { return this.db.prepare(sql).run(...params); }
    };
  }
}

function initSqlite(): any {
  if (!sqliteDb) {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const Ctor = getSqliteCtor();
    sqliteDb = new Ctor(DB_PATH);
    sqliteDb.exec("PRAGMA journal_mode=WAL");
    sqliteDb.exec("PRAGMA foreign_keys=ON");
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL DEFAULT '', handle TEXT UNIQUE, bio TEXT DEFAULT '', avatar_url TEXT DEFAULT '', tier TEXT NOT NULL DEFAULT 'free', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, filename TEXT NOT NULL, title TEXT, artist TEXT, album TEXT, genre TEXT, bpm REAL, key TEXT, duration REAL, file_path TEXT, file_size INTEGER, mime_type TEXT, energy REAL DEFAULT 5, plays INTEGER DEFAULT 0, synced INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS track_tags (track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (track_id, tag_id));
      CREATE TABLE IF NOT EXISTS playlists (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT DEFAULT '', is_public INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS playlist_tracks (playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE, track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, position INTEGER NOT NULL DEFAULT 0, added_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (playlist_id, track_id));
      CREATE TABLE IF NOT EXISTS shares (id INTEGER PRIMARY KEY AUTOINCREMENT, playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT);
      CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, stripe_session_id TEXT UNIQUE, amount REAL, currency TEXT DEFAULT 'usd', status TEXT DEFAULT 'pending', tier TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS identifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, audio_hash TEXT, title TEXT, artist TEXT, album TEXT, genre TEXT, added_to_library INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS follows (follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (follower_id, following_id));
      CREATE TABLE IF NOT EXISTS playlist_collaborators (playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT DEFAULT 'editor', created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (playlist_id, user_id));
      CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL, track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS post_likes (post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (post_id, user_id));
      CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, message TEXT NOT NULL, data TEXT, is_read INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS tip_links (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, platform TEXT NOT NULL, url TEXT NOT NULL, label TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS tips (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount REAL NOT NULL DEFAULT 0, message TEXT DEFAULT '', playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS artist_tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, artist TEXT NOT NULL, album TEXT DEFAULT '', genre TEXT DEFAULT '', bpm REAL, key TEXT, duration REAL, file_path TEXT, file_size INTEGER, mime_type TEXT, plays INTEGER DEFAULT 0, downloads INTEGER DEFAULT 0, is_published INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS artist_track_tags (track_id INTEGER NOT NULL REFERENCES artist_tracks(id) ON DELETE CASCADE, tag_name TEXT NOT NULL, PRIMARY KEY (track_id, tag_name));
      CREATE TABLE IF NOT EXISTS artist_links (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, platform TEXT NOT NULL, url TEXT NOT NULL, label TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS artist_profiles (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, artist_name TEXT, bio TEXT DEFAULT '', genre TEXT DEFAULT '', location TEXT DEFAULT '', website TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS devices (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, device_name TEXT NOT NULL, device_type TEXT DEFAULT 'browser', session_token TEXT, last_seen TEXT NOT NULL DEFAULT (datetime('now')), created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS device_actions (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE, action_type TEXT NOT NULL, payload TEXT DEFAULT '{}', status TEXT DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT);
      CREATE TABLE IF NOT EXISTS venues (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT DEFAULT '', capacity INTEGER DEFAULT 0, light_system_type TEXT DEFAULT 'none', light_system_config TEXT DEFAULT '{}', owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS venue_gigs (id INTEGER PRIMARY KEY AUTOINCREMENT, venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE, dj_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, theme TEXT DEFAULT '', date TEXT NOT NULL, start_time TEXT DEFAULT '', end_time TEXT DEFAULT '', setlist_playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL, status TEXT DEFAULT 'scheduled', created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS user_genres (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, genre TEXT NOT NULL, PRIMARY KEY (user_id, genre));
      CREATE TABLE IF NOT EXISTS track_genres (track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, genre TEXT NOT NULL, PRIMARY KEY (track_id, genre));
    `);
  }
  return sqliteDb;
}

// ─── Types ─────────────────────────────────────────────────────────────
export interface IdentificationRow { id: number; user_id: number; audio_hash: string; title: string; artist: string; album: string; genre: string; added_to_library: number; created_at: string; }
export interface ArtistTrackRow { id: number; user_id: number; title: string; artist: string; album: string; genre: string; bpm: number; key: string; duration: number; file_path: string; file_size: number; mime_type: string; plays: number; downloads: number; is_published: number; created_at: string; updated_at: string; }
export interface ArtistLinkRow { id: number; user_id: number; platform: string; url: string; label: string; created_at: string; }
export interface DeviceRow { id: number; user_id: number; device_name: string; device_type: string; session_token: string; last_seen: string; created_at: string; }
export interface DeviceActionRow { id: number; device_id: number; action_type: string; payload: string; status: string; created_at: string; completed_at: string; }
export interface VenueRow { id: number; name: string; address: string; capacity: number; light_system_type: string; light_system_config: string; owner_user_id: number; created_at: string; }
export interface GigRow { id: number; venue_id: number; dj_user_id: number; title: string; theme: string; date: string; start_time: string; end_time: string; setlist_playlist_id: number; status: string; created_at: string; }
export interface TrackRow { id: number; user_id: number; filename: string; title: string | null; artist: string | null; album: string | null; genre: string | null; bpm: number | null; key: string | null; duration: number | null; file_path: string | null; file_size: number | null; mime_type: string | null; energy: number; plays: number; synced: number; created_at: string; updated_at: string; }

// ─── Helpers ───────────────────────────────────────────────────────────
function rowOrNull(r: any) { return r ?? null; }
function now() { return new Date().toISOString(); }
function uuid() { return crypto.randomUUID(); }

// ─── getDb ─────────────────────────────────────────────────────────────
export function getDb(): any {
  if (USE_PG) return _pg.getDb();
  return initSqlite();
}

// ═══════════════════════════════════════════════════════════════════════
// PROXIED FUNCTIONS: returns value for SQLite, Promise for PG.
// Callers can safely use 'await' — it works for both.
// ═══════════════════════════════════════════════════════════════════════

function m(fnName: string, ...args: any[]): any {
  if (USE_PG) return (_pg as any)[fnName](...args);
  return null; // fallthrough to SQLite impl
}

// ─── Auth ──────────────────────────────────────────────────────────────
export function getUserFromSession(token: string) {
  if (USE_PG) return _pg.getUserFromSession(token);
  const d = initSqlite();
  const row = d.query("SELECT s.user_id, u.email, u.display_name, u.handle, u.tier FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?").get(token, now());
  return row ? { userId: row.user_id, email: row.email, displayName: row.display_name, handle: row.handle, tier: row.tier } : null;
}
export function createSession(userId: number) {
  if (USE_PG) return _pg.createSession(userId);
  const d = initSqlite();
  const token = uuid();
  const expires = new Date(Date.now() + 7*24*60*60*1000).toISOString();
  d.run("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)", [userId, token, expires]);
  return token;
}
export function deleteSession(token: string) {
  if (USE_PG) return _pg.deleteSession(token);
  initSqlite().run("DELETE FROM sessions WHERE token = ?", [token]);
}
export function getUserById(id: number) {
  if (USE_PG) return _pg.getUserById(id);
  return rowOrNull(initSqlite().query("SELECT id, email, display_name, handle, bio, avatar_url, tier FROM users WHERE id = ?").get(id));
}
export function getUserByHandle(handle: string) {
  if (USE_PG) return _pg.getUserByHandle(handle);
  return rowOrNull(initSqlite().query("SELECT id, email, display_name, handle, bio, avatar_url, tier FROM users WHERE handle = ?").get(handle));
}

// ─── Tracks ────────────────────────────────────────────────────────────
export function insertTrack(data: any) { if (USE_PG) return _pg.insertTrack(data); const d=initSqlite(); const r=d.run("INSERT INTO tracks (user_id,filename,title,artist,album,genre,bpm,key,duration,file_path,file_size,mime_type,energy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",[data.userId,data.filename,data.title||null,data.artist||null,data.album||null,data.genre||null,data.bpm||null,data.key||null,data.duration||null,data.file_path||null,data.file_size||null,data.mime_type||null,data.energy||5]); return d.query("SELECT * FROM tracks WHERE id=?").get(Number(r.lastInsertRowid)); }
export function getTrack(id: number) { if (USE_PG) return _pg.getTrack(id); return rowOrNull(initSqlite().query("SELECT * FROM tracks WHERE id=?").get(id)); }
export function listTracks(userId: number, opts?: any) { if (USE_PG) return _pg.listTracks(userId,opts); const d=initSqlite(); let sql="SELECT * FROM tracks WHERE user_id=?"; const p:any[]=[userId]; if(opts?.genre){sql+=" AND genre=?";p.push(opts.genre)} if(opts?.search){sql+=" AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)";const s=`%${opts.search}%`;p.push(s,s,s)} sql+=" ORDER BY created_at DESC"; if(opts?.limit){sql+=" LIMIT ?";p.push(opts.limit)} if(opts?.offset){sql+=" OFFSET ?";p.push(opts.offset)} return d.query(sql).all(...p); }
export function updateTrack(id: number, data: any) { if (USE_PG) return _pg.updateTrack(id,data); const d=initSqlite(); const s:string[]=[]; const v:any[]=[]; for(const k of["title","artist","album","genre","bpm","key","duration","file_path","file_size","mime_type","energy"]){if(data[k]!==undefined){s.push(`${k}=?`);v.push(data[k])}} if(s.length){s.push("updated_at=?");v.push(now());v.push(id);d.run(`UPDATE tracks SET ${s.join(",")} WHERE id=?`,v)} return d.query("SELECT * FROM tracks WHERE id=?").get(id); }
export function deleteTrack(id: number) { if (USE_PG) return _pg.deleteTrack(id); initSqlite().run("DELETE FROM tracks WHERE id=?",[id]); }
export function incrementPlayCount(id: number) { if (USE_PG) return _pg.incrementPlayCount(id); initSqlite().run("UPDATE tracks SET plays=plays+1 WHERE id=?",[id]); }
export function updateTrackSyncStatus(id: number, synced: number) { if (USE_PG) return _pg.updateTrackSyncStatus(id,synced); initSqlite().run("UPDATE tracks SET synced=? WHERE id=?",[synced,id]); }
export function getSyncStatus(userId: number) { if (USE_PG) return _pg.getSyncStatus(userId); const d=initSqlite(); const total=(d.query("SELECT COUNT(*) as c FROM tracks WHERE user_id=?").get(userId) as any).c; const synced=(d.query("SELECT COUNT(*) as c FROM tracks WHERE user_id=? AND synced=1").get(userId) as any).c; return {total,synced}; }
export function getCompatibleTracks(userId: number, bpm: number, key: string, limit=10) { if (USE_PG) return _pg.getCompatibleTracks(userId,bpm,key,limit); return initSqlite().query("SELECT * FROM tracks WHERE user_id=? AND bpm BETWEEN ? AND ? ORDER BY ABS(bpm-?) LIMIT ?").all(userId,bpm-5,bpm+5,bpm,limit); }
export function getGenres() { if (USE_PG) return _pg.getGenres(); return initSqlite().query("SELECT DISTINCT genre FROM tracks WHERE genre IS NOT NULL AND genre!=''").all().map((r:any)=>r.genre); }
export function getKeys() { if (USE_PG) return _pg.getKeys(); return initSqlite().query("SELECT DISTINCT key FROM tracks WHERE key IS NOT NULL AND key!=''").all().map((r:any)=>r.key); }
export function addTrackGenres(trackId: number, genres: string[]) { if (USE_PG) return _pg.addTrackGenres(trackId,genres); const d=initSqlite(); for(const g of genres) try{d.run("INSERT OR IGNORE INTO track_genres (track_id,genre) VALUES (?,?)",[trackId,g])}catch{} }
export function removeTrackGenre(trackId: number, genre: string) { if (USE_PG) return _pg.removeTrackGenre(trackId,genre); initSqlite().run("DELETE FROM track_genres WHERE track_id=? AND genre=?",[trackId,genre]); }
export function getTrackGenres(trackId: number) { if (USE_PG) return _pg.getTrackGenres(trackId); return (initSqlite().query("SELECT genre FROM track_genres WHERE track_id=?").all(trackId) as any[]).map((r:any)=>r.genre); }
export function getTracksWithGenres(userId: number, genres: string[]) { if (USE_PG) return _pg.getTracksWithGenres(userId,genres); if(!genres.length) return[]; const ph=genres.map(()=>"?").join(","); return initSqlite().query(`SELECT DISTINCT t.* FROM tracks t JOIN track_genres tg ON tg.track_id=t.id WHERE t.user_id=? AND tg.genre IN (${ph})`).all(userId,...genres); }

// ─── Tags ──────────────────────────────────────────────────────────────
export function createTag(userId: number, name: string) { if (USE_PG) return _pg.createTag(userId,name); const d=initSqlite(); d.run("INSERT INTO tags (user_id,name) VALUES (?,?)",[userId,name]); return d.query("SELECT * FROM tags WHERE id=?").get(Number((d.run("SELECT last_insert_rowid()") as any))); }
export function listTags(userId: number) { if (USE_PG) return _pg.listTags(userId); return initSqlite().query("SELECT * FROM tags WHERE user_id=? ORDER BY name").all(userId); }
export function attachTag(trackId: number, tagId: number) { if (USE_PG) return _pg.attachTag(trackId,tagId); try{initSqlite().run("INSERT OR IGNORE INTO track_tags (track_id,tag_id) VALUES (?,?)",[trackId,tagId])}catch{} }
export function detachTag(trackId: number, tagId: number) { if (USE_PG) return _pg.detachTag(trackId,tagId); initSqlite().run("DELETE FROM track_tags WHERE track_id=? AND tag_id=?",[trackId,tagId]); }
export function getTrackTags(trackId: number) { if (USE_PG) return _pg.getTrackTags(trackId); return initSqlite().query("SELECT t.* FROM tags t JOIN track_tags tt ON tt.tag_id=t.id WHERE tt.track_id=?").all(trackId); }

// ─── Playlists ─────────────────────────────────────────────────────────
export function createPlaylist(userId: number, name: string, desc="", isPub=0) { if (USE_PG) return _pg.createPlaylist(userId,name,desc,isPub); const d=initSqlite(); d.run("INSERT INTO playlists (user_id,name,description,is_public) VALUES (?,?,?,?)",[userId,name,desc,isPub]); return d.query("SELECT * FROM playlists WHERE id=?").get(Number((d.run("SELECT last_insert_rowid()") as any))); }
export function listPlaylists(userId: number) { if (USE_PG) return _pg.listPlaylists(userId); return initSqlite().query("SELECT * FROM playlists WHERE user_id=? ORDER BY updated_at DESC").all(userId); }
export function getPlaylist(id: number) { if (USE_PG) return _pg.getPlaylist(id); return rowOrNull(initSqlite().query("SELECT * FROM playlists WHERE id=?").get(id)); }
export function deletePlaylist(id: number) { if (USE_PG) return _pg.deletePlaylist(id); initSqlite().run("DELETE FROM playlists WHERE id=?",[id]); }
export function addTrackToPlaylist(plId: number, trId: number, pos?: number) { if (USE_PG) return _pg.addTrackToPlaylist(plId,trId,pos); const d=initSqlite(); const p=pos??((d.query("SELECT COALESCE(MAX(position),0)+1 as p FROM playlist_tracks WHERE playlist_id=?").get(plId) as any)?.p??1); try{d.run("INSERT OR IGNORE INTO playlist_tracks (playlist_id,track_id,position) VALUES (?,?,?)",[plId,trId,p])}catch{} d.run("UPDATE playlists SET updated_at=? WHERE id=?",[now(),plId]); }
export function removeTrackFromPlaylist(plId: number, trId: number) { if (USE_PG) return _pg.removeTrackFromPlaylist(plId,trId); initSqlite().run("DELETE FROM playlist_tracks WHERE playlist_id=? AND track_id=?",[plId,trId]); }
export function canAccessPlaylist(plId: number, userId: number) { if (USE_PG) return _pg.canAccessPlaylist(plId,userId); const p=initSqlite().query("SELECT * FROM playlists WHERE id=?").get(plId); if(!p) return false; if(p.user_id===userId) return true; if(p.is_public) return true; return !!initSqlite().query("SELECT 1 FROM playlist_collaborators WHERE playlist_id=? AND user_id=?").get(plId,userId); }

// ─── Shares ────────────────────────────────────────────────────────────
export function createShare(plId: number) { if (USE_PG) return _pg.createShare(plId); const d=initSqlite(); const t=uuid(); d.run("INSERT INTO shares (playlist_id,token) VALUES (?,?)",[plId,t]); return d.query("SELECT * FROM shares WHERE token=?").get(t); }
export function getShareByToken(token: string) { if (USE_PG) return _pg.getShareByToken(token); return rowOrNull(initSqlite().query("SELECT * FROM shares WHERE token=?").get(token)); }
export function deleteShare(plId: number) { if (USE_PG) return _pg.deleteShare(plId); initSqlite().run("DELETE FROM shares WHERE playlist_id=?",[plId]); }

// ─── Payments ──────────────────────────────────────────────────────────
export function createPayment(userId: number, sid: string, amt: number, tier: string) { if (USE_PG) return _pg.createPayment(userId,sid,amt,tier); const d=initSqlite(); d.run("INSERT INTO payments (user_id,stripe_session_id,amount,status,tier) VALUES (?,?,?,'pending',?)",[userId,sid,amt,tier]); return d.query("SELECT * FROM payments WHERE stripe_session_id=?").get(sid); }
export function completePayment(sid: string) { if (USE_PG) return _pg.completePayment(sid); const d=initSqlite(); d.run("UPDATE payments SET status='completed' WHERE stripe_session_id=?",[sid]); const p=d.query("SELECT * FROM payments WHERE stripe_session_id=?").get(sid) as any; if(p?.tier) d.run("UPDATE users SET tier=? WHERE id=?",[p.tier,p.user_id]); return p; }
export function getUserPaymentHistory(userId: number) { if (USE_PG) return _pg.getUserPaymentHistory(userId); return initSqlite().query("SELECT * FROM payments WHERE user_id=? ORDER BY created_at DESC").all(userId); }
export function updateUserTier(userId: number, tier: string) { if (USE_PG) return _pg.updateUserTier(userId,tier); initSqlite().run("UPDATE users SET tier=? WHERE id=?",[tier,userId]); }

// ─── Identifications ──────────────────────────────────────────────────
export function insertIdentification(userId: number, hash: string, title: string, artist: string, album: string, genre: string) { if (USE_PG) return _pg.insertIdentification(userId,hash,title,artist,album,genre); const d=initSqlite(); d.run("INSERT INTO identifications (user_id,audio_hash,title,artist,album,genre) VALUES (?,?,?,?,?,?)",[userId,hash,title,artist,album,genre]); return d.query("SELECT * FROM identifications WHERE id=?").get(Number((d.run("SELECT last_insert_rowid()") as any))); }
export function markIdentificationAdded(id: number) { if (USE_PG) return _pg.markIdentificationAdded(id); initSqlite().run("UPDATE identifications SET added_to_library=1 WHERE id=?",[id]); }
export function getRecentIdentifications(userId: number, limit=20) { if (USE_PG) return _pg.getRecentIdentifications(userId,limit); return initSqlite().query("SELECT * FROM identifications WHERE user_id=? ORDER BY created_at DESC LIMIT ?").all(userId,limit); }
export function insertShazamTrack(userId: number, title: string, artist: string, album: string, genre: string) { if (USE_PG) return _pg.insertShazamTrack(userId,title,artist,album,genre); const d=initSqlite(); d.run("INSERT INTO tracks (user_id,filename,title,artist,album,genre) VALUES (?,?,?,?,?,?)",[userId,title,title,artist,album,genre]); return d.query("SELECT * FROM tracks WHERE id=?").get(Number((d.run("SELECT last_insert_rowid()") as any))); }

// ─── Profile / Users ───────────────────────────────────────────────────
export function getUserProfile(userId: number) { if (USE_PG) return _pg.getUserProfile(userId); const d=initSqlite(); const u=d.query("SELECT id,email,display_name,handle,bio,avatar_url,tier,created_at FROM users WHERE id=?").get(userId); if(!u) return null; const followers=(d.query("SELECT COUNT(*) as c FROM follows WHERE following_id=?").get(userId) as any).c; const following=(d.query("SELECT COUNT(*) as c FROM follows WHERE follower_id=?").get(userId) as any).c; return {...u,followerCount:followers,followingCount:following}; }
export function getFeaturedPlaylists() { if (USE_PG) return _pg.getFeaturedPlaylists(); return initSqlite().query("SELECT * FROM playlists WHERE is_public=1 ORDER BY updated_at DESC LIMIT 10").all(); }
export function getRecentActivity(userId: number) { if (USE_PG) return _pg.getRecentActivity(userId); return initSqlite().query("SELECT * FROM tracks WHERE user_id=? ORDER BY created_at DESC LIMIT 10").all(userId); }
export function getUserTagCloud(userId: number) { if (USE_PG) return _pg.getUserTagCloud(userId); return initSqlite().query("SELECT t.name, COUNT(*) as cnt FROM tags t JOIN track_tags tt ON tt.tag_id=t.id JOIN tracks tr ON tr.id=tt.track_id WHERE tr.user_id=? GROUP BY t.name ORDER BY cnt DESC LIMIT 20").all(userId); }
export function checkHandleAvailable(handle: string) { if (USE_PG) return _pg.checkHandleAvailable(handle); return !initSqlite().query("SELECT 1 FROM users WHERE handle=?").get(handle); }
export function updateUserProfile(userId: number, data: any) { if (USE_PG) return _pg.updateUserProfile(userId,data); const d=initSqlite(); const s:string[]=[]; const v:any[]=[]; for(const k of["display_name","bio","avatar_url","handle"]){if(data[k]!==undefined){s.push(`${k}=?`);v.push(data[k])}} if(s.length){s.push("updated_at=?");v.push(now());v.push(userId);d.run(`UPDATE users SET ${s.join(",")} WHERE id=?`,v)} return d.query("SELECT id,email,display_name,handle,bio,avatar_url,tier FROM users WHERE id=?").get(userId); }
export function getPublicUsers(limit=50, offset=0) { if (USE_PG) return _pg.getPublicUsers(limit,offset); return initSqlite().query("SELECT id,display_name,handle,bio,avatar_url FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit,offset); }

// ─── Follows ───────────────────────────────────────────────────────────
export function followUser(fid: number, tid: number) { if (USE_PG) return _pg.followUser(fid,tid); try{initSqlite().run("INSERT OR IGNORE INTO follows (follower_id,following_id) VALUES (?,?)",[fid,tid]);return true}catch{return false} }
export function unfollowUser(fid: number, tid: number) { if (USE_PG) return _pg.unfollowUser(fid,tid); initSqlite().run("DELETE FROM follows WHERE follower_id=? AND following_id=?",[fid,tid]); }
export function isFollowing(fid: number, tid: number) { if (USE_PG) return _pg.isFollowing(fid,tid); return !!initSqlite().query("SELECT 1 FROM follows WHERE follower_id=? AND following_id=?").get(fid,tid); }
export function getFollowers(userId: number) { if (USE_PG) return _pg.getFollowers(userId); return initSqlite().query("SELECT u.id,u.display_name,u.handle,u.avatar_url FROM follows f JOIN users u ON u.id=f.follower_id WHERE f.following_id=?").all(userId); }
export function getFollowing(userId: number) { if (USE_PG) return _pg.getFollowing(userId); return initSqlite().query("SELECT u.id,u.display_name,u.handle,u.avatar_url FROM follows f JOIN users u ON u.id=f.following_id WHERE f.follower_id=?").all(userId); }
export function getFollowerCount(userId: number) { if (USE_PG) return _pg.getFollowerCount(userId); return (initSqlite().query("SELECT COUNT(*) as c FROM follows WHERE following_id=?").get(userId) as any).c; }

// ─── Collaborators ─────────────────────────────────────────────────────
export function addCollaborator(plId: number, userId: number, role="editor") { if (USE_PG) return _pg.addCollaborator(plId,userId,role); try{initSqlite().run("INSERT OR IGNORE INTO playlist_collaborators (playlist_id,user_id,role) VALUES (?,?,?)",[plId,userId,role])}catch{} }
export function removeCollaborator(plId: number, userId: number) { if (USE_PG) return _pg.removeCollaborator(plId,userId); initSqlite().run("DELETE FROM playlist_collaborators WHERE playlist_id=? AND user_id=?",[plId,userId]); }
export function getCollaborators(plId: number) { if (USE_PG) return _pg.getCollaborators(plId); return initSqlite().query("SELECT u.id,u.display_name,u.handle,u.avatar_url,pc.role FROM playlist_collaborators pc JOIN users u ON u.id=pc.user_id WHERE pc.playlist_id=?").all(plId); }

// ─── Posts ─────────────────────────────────────────────────────────────
export function createPost(userId: number, content: string, plId?: number, trId?: number) { if (USE_PG) return _pg.createPost(userId,content,plId,trId); const d=initSqlite(); d.run("INSERT INTO posts (user_id,content,playlist_id,track_id) VALUES (?,?,?,?)",[userId,content,plId||null,trId||null]); return d.query("SELECT * FROM posts WHERE id=?").get(Number((d.run("SELECT last_insert_rowid()") as any))); }
export function getPostsByUser(userId: number) { if (USE_PG) return _pg.getPostsByUser(userId); return initSqlite().query("SELECT p.*,u.display_name,u.handle,u.avatar_url FROM posts p JOIN users u ON u.id=p.user_id WHERE p.user_id=? ORDER BY p.created_at DESC").all(userId); }
export function getFeedPosts(userId: number, limit=50) { if (USE_PG) return _pg.getFeedPosts(userId,limit); return initSqlite().query("SELECT p.*,u.display_name,u.handle,u.avatar_url FROM posts p JOIN users u ON u.id=p.user_id WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id=?) OR p.user_id=? ORDER BY p.created_at DESC LIMIT ?").all(userId,userId,limit); }
export function getPostById(id: number) { if (USE_PG) return _pg.getPostById(id); return rowOrNull(initSqlite().query("SELECT p.*,u.display_name,u.handle,u.avatar_url FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?").get(id)); }
export function deletePost(id: number, userId: number) { if (USE_PG) return _pg.deletePost(id,userId); initSqlite().run("DELETE FROM posts WHERE id=? AND user_id=?",[id,userId]); }
export function likePost(pid: number, uid: number) { if (USE_PG) return _pg.likePost(pid,uid); try{initSqlite().run("INSERT OR IGNORE INTO post_likes (post_id,user_id) VALUES (?,?)",[pid,uid])}catch{} }
export function unlikePost(pid: number, uid: number) { if (USE_PG) return _pg.unlikePost(pid,uid); initSqlite().run("DELETE FROM post_likes WHERE post_id=? AND user_id=?",[pid,uid]); }

// ─── Notifications ─────────────────────────────────────────────────────
export function createNotification(userId: number, type: string, message: string, data?: any) { if (USE_PG) return _pg.createNotification(userId,type,message,data); const d=initSqlite(); d.run("INSERT INTO notifications (user_id,type,message,data) VALUES (?,?,?,?)",[userId,type,message,data?JSON.stringify(data):null]); return d.query("SELECT * FROM notifications WHERE id=?").get(Number((d.run("SELECT last_insert_rowid()") as any))); }
export function getNotifications(userId: number) { if (USE_PG) return _pg.getNotifications(userId); return initSqlite().query("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50").all(userId); }
export function markNotificationRead(id: number) { if (USE_PG) return _pg.markNotificationRead(id); initSqlite().run("UPDATE notifications SET is_read=1 WHERE id=?",[id]); }
export function markAllNotificationsRead(userId: number) { if (USE_PG) return _pg.markAllNotificationsRead(userId); initSqlite().run("UPDATE notifications SET is_read=1 WHERE user_id=?",[userId]); }
export function getUnreadNotificationCount(userId: number) { if (USE_PG) return _pg.getUnreadNotificationCount(userId); return (initSqlite().query("SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0").get(userId) as any).c; }

// ─── Tips ──────────────────────────────────────────────────────────────
export function getTipLinks(userId: number) { if (USE_PG) return _pg.getTipLinks(userId); return initSqlite().query("SELECT * FROM tip_links WHERE user_id=?").all(userId); }
export function getAllTipLinks(userId: number) { if (USE_PG) return _pg.getAllTipLinks(userId); return getTipLinks(userId); }
export function upsertTipLink(userId: number, platform: string, url: string, label="") { if (USE_PG) return _pg.upsertTipLink(userId,platform,url,label); const d=initSqlite(); const ex=d.query("SELECT id FROM tip_links WHERE user_id=? AND platform=?").get(userId,platform); if(ex){d.run("UPDATE tip_links SET url=?,label=? WHERE id=?",[url,label,(ex as any).id])}else{d.run("INSERT INTO tip_links (user_id,platform,url,label) VALUES (?,?,?,?)",[userId,platform,url,label])} }
export function recordTip(from: number|null, to: number, amount: number, msg="", plId?: number) { if (USE_PG) return _pg.recordTip(from,to,amount,msg,plId); const d=initSqlite(); d.run("INSERT INTO tips (from_user_id,to_user_id,amount,message,playlist_id) VALUES (?,?,?,?,?)",[from,to,amount,msg,plId||null]); return d.query("SELECT * FROM tips WHERE id=?").get(Number((d.run("SELECT last_insert_rowid()") as any))); }
export function getTipsReceived(userId: number) { if (USE_PG) return _pg.getTipsReceived(userId); return initSqlite().query("SELECT t.*,u.display_name as from_name,u.handle as from_handle FROM tips t LEFT JOIN users u ON u.id=t.from_user_id WHERE t.to_user_id=? ORDER BY t.created_at DESC").all(userId); }
export function getTipsGiven(userId: number) { if (USE_PG) return _pg.getTipsGiven(userId); return initSqlite().query("SELECT t.*,u.display_name as to_name,u.handle as to_handle FROM tips t JOIN users u ON u.id=t.to_user_id WHERE t.from_user_id=? ORDER BY t.created_at DESC").all(userId); }
export function getPlaylistTipCount(plId: number) { if (USE_PG) return _pg.getPlaylistTipCount(plId); return (initSqlite().query("SELECT COUNT(*) as c FROM tips WHERE playlist_id=?").get(plId) as any).c; }

// ─── Artist Tracks ─────────────────────────────────────────────────────
export function insertArtistTrack(data: any) { if (USE_PG) return _pg.insertArtistTrack(data); const d=initSqlite(); const r=d.run("INSERT INTO artist_tracks (user_id,title,artist,album,genre,bpm,key,duration,file_path,file_size,mime_type,is_published) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",[data.userId,data.title,data.artist,data.album||"",data.genre||"",data.bpm||null,data.key||null,data.duration||null,data.file_path||null,data.file_size||null,data.mime_type||null,data.isPublished||0]); return d.query("SELECT * FROM artist_tracks WHERE id=?").get(Number(r.lastInsertRowid)); }
export function getArtistTrack(id: number) { if (USE_PG) return _pg.getArtistTrack(id); return rowOrNull(initSqlite().query("SELECT * FROM artist_tracks WHERE id=?").get(id)); }
export function listArtistTracksByUser(userId: number) { if (USE_PG) return _pg.listArtistTracksByUser(userId); return initSqlite().query("SELECT * FROM artist_tracks WHERE user_id=? ORDER BY created_at DESC").all(userId); }
export function listAllPublishedArtistTracks() { if (USE_PG) return _pg.listAllPublishedArtistTracks(); return initSqlite().query("SELECT * FROM artist_tracks WHERE is_published=1 ORDER BY created_at DESC").all(); }
export function updateArtistTrack(id: number, data: any) { if (USE_PG) return _pg.updateArtistTrack(id,data); const d=initSqlite(); const s:string[]=[]; const v:any[]=[]; for(const k of["title","artist","album","genre","bpm","key","duration","file_path","file_size","mime_type","is_published"]){if(data[k]!==undefined){s.push(`${k}=?`);v.push(data[k])}} if(s.length){s.push("updated_at=?");v.push(now());v.push(id);d.run(`UPDATE artist_tracks SET ${s.join(",")} WHERE id=?`,v)} return d.query("SELECT * FROM artist_tracks WHERE id=?").get(id); }
export function deleteArtistTrack(id: number) { if (USE_PG) return _pg.deleteArtistTrack(id); initSqlite().run("DELETE FROM artist_tracks WHERE id=?",[id]); }
export function incrementArtistTrackPlayCount(id: number) { if (USE_PG) return _pg.incrementArtistTrackPlayCount(id); initSqlite().run("UPDATE artist_tracks SET plays=plays+1 WHERE id=?",[id]); }
export function incrementArtistTrackDownloadCount(id: number) { if (USE_PG) return _pg.incrementArtistTrackDownloadCount(id); initSqlite().run("UPDATE artist_tracks SET downloads=downloads+1 WHERE id=?",[id]); }
export function attachArtistTrackTag(tid: number, tag: string) { if (USE_PG) return _pg.attachArtistTrackTag(tid,tag); try{initSqlite().run("INSERT OR IGNORE INTO artist_track_tags (track_id,tag_name) VALUES (?,?)",[tid,tag])}catch{} }
export function detachArtistTrackTag(tid: number, tag: string) { if (USE_PG) return _pg.detachArtistTrackTag(tid,tag); initSqlite().run("DELETE FROM artist_track_tags WHERE track_id=? AND tag_name=?",[tid,tag]); }
export function getArtistTrackTags(tid: number) { if (USE_PG) return _pg.getArtistTrackTags(tid); return (initSqlite().query("SELECT tag_name FROM artist_track_tags WHERE track_id=?").all(tid) as any[]).map((r:any)=>r.tag_name); }
export function getArtistGenres() { if (USE_PG) return _pg.getArtistGenres(); return (initSqlite().query("SELECT DISTINCT genre FROM artist_tracks WHERE genre IS NOT NULL AND genre!=''").all() as any[]).map((r:any)=>r.genre); }
export function getArtistLinks(userId: number) { if (USE_PG) return _pg.getArtistLinks(userId); return initSqlite().query("SELECT * FROM artist_links WHERE user_id=?").all(userId); }
export function upsertArtistLink(userId: number, platform: string, url: string, label="") { if (USE_PG) return _pg.upsertArtistLink(userId,platform,url,label); const d=initSqlite(); const ex=d.query("SELECT id FROM artist_links WHERE user_id=? AND platform=?").get(userId,platform); if(ex){d.run("UPDATE artist_links SET url=?,label=? WHERE id=?",[url,label,(ex as any).id])}else{d.run("INSERT INTO artist_links (user_id,platform,url,label) VALUES (?,?,?,?)",[userId,platform,url,label])} }
export function deleteArtistLink(id: number) { if (USE_PG) return _pg.deleteArtistLink(id); initSqlite().run("DELETE FROM artist_links WHERE id=?",[id]); }
export function updateArtistProfile(userId: number, data: any) { if (USE_PG) return _pg.updateArtistProfile(userId,data); const d=initSqlite(); const ex=d.query("SELECT user_id FROM artist_profiles WHERE user_id=?").get(userId); if(ex){d.run("UPDATE artist_profiles SET artist_name=?,bio=?,genre=?,location=?,website=?,updated_at=? WHERE user_id=?",[data.artist_name||null,data.bio||"",data.genre||"",data.location||"",data.website||"",now(),userId])}else{d.run("INSERT INTO artist_profiles (user_id,artist_name,bio,genre,location,website) VALUES (?,?,?,?,?,?)",[userId,data.artist_name||null,data.bio||"",data.genre||"",data.location||"",data.website||""])} return getUserArtistProfile(userId); }
export function getUserArtistProfile(userId: number) { if (USE_PG) return _pg.getUserArtistProfile(userId); return rowOrNull(initSqlite().query("SELECT * FROM artist_profiles WHERE user_id=?").get(userId)); }

// ─── Devices ───────────────────────────────────────────────────────────
export function registerDevice(userId: number, name: string, type="browser") { if (USE_PG) return _pg.registerDevice(userId,name,type); const d=initSqlite(); const t=uuid(); d.run("INSERT INTO devices (user_id,device_name,device_type,session_token) VALUES (?,?,?,?)",[userId,name,type,t]); return d.query("SELECT * FROM devices WHERE id=?").get(Number((d.run("SELECT last_insert_rowid()") as any))); }
export function listUserDevices(userId: number) { if (USE_PG) return _pg.listUserDevices(userId); return initSqlite().query("SELECT * FROM devices WHERE user_id=? ORDER BY last_seen DESC").all(userId); }
export function deleteDevice(id: number) { if (USE_PG) return _pg.deleteDevice(id); initSqlite().run("DELETE FROM devices WHERE id=?",[id]); }
export function getDevice(id: number) { if (USE_PG) return _pg.getDevice(id); return rowOrNull(initSqlite().query("SELECT * FROM devices WHERE id=?").get(id)); }
export function getDeviceBySession(token: string) { if (USE_PG) return _pg.getDeviceBySession(token); return rowOrNull(initSqlite().query("SELECT * FROM devices WHERE session_token=?").get(token)); }
export function createDeviceAction(devId: number, actionType: string, payload: any={}) { if (USE_PG) return _pg.createDeviceAction(devId,actionType,payload); const d=initSqlite(); d.run("INSERT INTO device_actions (device_id,action_type,payload) VALUES (?,?,?)",[devId,actionType,JSON.stringify(payload)]); return d.query("SELECT * FROM device_actions WHERE id=?").get(Number((d.run("SELECT last_insert_rowid()") as any))); }
export function getPendingActions(devId: number) { if (USE_PG) return _pg.getPendingActions(devId); return initSqlite().query("SELECT * FROM device_actions WHERE device_id=? AND status='pending'").all(devId); }
export function completeDeviceAction(id: number) { if (USE_PG) return _pg.completeDeviceAction(id); initSqlite().run("UPDATE device_actions SET status='completed',completed_at=? WHERE id=?",[now(),id]); }

// ─── Venues & Gigs ─────────────────────────────────────────────────────
export function createVenue(data: any) { if (USE_PG) return _pg.createVenue(data); const d=initSqlite(); const r=d.run("INSERT INTO venues (name,address,capacity,light_system_type,light_system_config,owner_user_id) VALUES (?,?,?,?,?,?)",[data.name,data.address||"",data.capacity||0,data.light_system_type||"none",data.light_system_config||"{}",data.owner_user_id]); return d.query("SELECT * FROM venues WHERE id=?").get(Number(r.lastInsertRowid)); }
export function getVenue(id: number) { if (USE_PG) return _pg.getVenue(id); return rowOrNull(initSqlite().query("SELECT * FROM venues WHERE id=?").get(id)); }
export function listVenues() { if (USE_PG) return _pg.listVenues(); return initSqlite().query("SELECT * FROM venues ORDER BY name").all(); }
export function getUserVenues(userId: number) { if (USE_PG) return _pg.getUserVenues(userId); return initSqlite().query("SELECT * FROM venues WHERE owner_user_id=? ORDER BY name").all(userId); }
export function createGig(data: any) { if (USE_PG) return _pg.createGig(data); const d=initSqlite(); const r=d.run("INSERT INTO venue_gigs (venue_id,dj_user_id,title,theme,date,start_time,end_time,setlist_playlist_id) VALUES (?,?,?,?,?,?,?,?)",[data.venue_id,data.dj_user_id,data.title,data.theme||"",data.date,data.start_time||"",data.end_time||"",data.setlist_playlist_id||null]); return d.query("SELECT * FROM venue_gigs WHERE id=?").get(Number(r.lastInsertRowid)); }
export function getGig(id: number) { if (USE_PG) return _pg.getGig(id); return rowOrNull(initSqlite().query("SELECT * FROM venue_gigs WHERE id=?").get(id)); }
export function updateGig(id: number, userId: number, fields: Record<string,unknown>) { if (USE_PG) return _pg.updateGig(id,userId,fields); const d=initSqlite(); const allowed=["title","theme","date","start_time","end_time","setlist_playlist_id","status"]; const s:string[]=[]; const v:any[]=[]; for(const[k,val] of Object.entries(fields)){if(allowed.includes(k)){s.push(`${k}=?`);v.push(val)}} if(!s.length) return undefined; v.push(id,userId); d.run(`UPDATE venue_gigs SET ${s.join(",")} WHERE id=? AND dj_user_id=?`,v); return d.query("SELECT * FROM venue_gigs WHERE id=? AND dj_user_id=?").get(id,userId); }
export function deleteGig(id: number, userId: number) { if (USE_PG) return _pg.deleteGig(id,userId); initSqlite().run("DELETE FROM venue_gigs WHERE id=? AND dj_user_id=?",[id,userId]); }
export function getVenueGigs(venueId: number, userId?: number) { if (USE_PG) return _pg.getVenueGigs(venueId,userId); if(userId) return initSqlite().query("SELECT * FROM venue_gigs WHERE venue_id=? AND dj_user_id=? ORDER BY date ASC, start_time ASC").all(venueId,userId); return initSqlite().query("SELECT * FROM venue_gigs WHERE venue_id=? ORDER BY date ASC, start_time ASC").all(venueId); }
export function getUserGigs(userId: number) { if (USE_PG) return _pg.getUserGigs(userId); return initSqlite().query("SELECT * FROM venue_gigs WHERE dj_user_id=? ORDER BY date ASC, start_time ASC").all(userId); }
export function pushSetlistToVenue(gigId: number, userId: number) { if (USE_PG) return _pg.pushSetlistToVenue(gigId,userId); const d=initSqlite(); const gig=d.query("SELECT * FROM venue_gigs WHERE id=? AND dj_user_id=?").get(gigId,userId); if(!gig) return null; const venue=d.query("SELECT * FROM venues WHERE id=?").get(gig.venue_id); if(!venue) return null; let tc=0; const lp:any[]=[]; if(gig.setlist_playlist_id){const tracks=d.query("SELECT t.* FROM tracks t JOIN playlist_tracks pt ON pt.track_id=t.id WHERE pt.playlist_id=? ORDER BY pt.position").all(gig.setlist_playlist_id); tc=tracks.length; for(const t of tracks as any[]){lp.push({trackId:t.id,title:t.title||t.filename,artist:t.artist||"Unknown",bpm:t.bpm??120,energy:t.energy??5})}} if(venue.light_system_type!=="none"&&gig.status==="scheduled"){d.run("UPDATE venue_gigs SET status='confirmed' WHERE id=?",[gigId])} return {gig,venue,trackCount:tc,lightParams:lp}; }

// ─── User Genres ───────────────────────────────────────────────────────
export function getUserGenresByHandle(handle: string) { if (USE_PG) return _pg.getUserGenresByHandle(handle); const user=initSqlite().query("SELECT id FROM users WHERE handle=?").get(handle) as any; if(!user) return[]; return (initSqlite().query("SELECT genre FROM user_genres WHERE user_id=?").all(user.id) as any[]).map((r:any)=>r.genre); }
export function setUserGenres(userId: number, genres: string[]) { if (USE_PG) return _pg.setUserGenres(userId,genres); const d=initSqlite(); d.run("DELETE FROM user_genres WHERE user_id=?",[userId]); for(const g of genres) d.run("INSERT OR IGNORE INTO user_genres (user_id,genre) VALUES (?,?)",[userId,g]); }
export function searchUsersByGenres(genres: string[]) { if (USE_PG) return _pg.searchUsersByGenres(genres); if(!genres.length) return[]; const ph=genres.map(()=>"?").join(","); return initSqlite().query(`SELECT DISTINCT u.id,u.display_name,u.handle,u.avatar_url,u.bio FROM users u JOIN user_genres ug ON ug.user_id=u.id WHERE ug.genre IN (${ph}) LIMIT 50`).all(...genres); }

// ─── DJ Matches ────────────────────────────────────────────────────────
export function getDJMatches(userId: number, limit=20) { if (USE_PG) return _pg.getDJMatches(userId,limit); const d=initSqlite(); const myGenres=(d.query("SELECT genre FROM user_genres WHERE user_id=?").all(userId) as any[]).map((r:any)=>r.genre); if(!myGenres.length) return d.query("SELECT id,display_name,handle,avatar_url,bio FROM users WHERE id!=? ORDER BY RANDOM() LIMIT ?").all(userId,limit); const ph=myGenres.map(()=>"?").join(","); return d.query(`SELECT u.id,u.display_name,u.handle,u.avatar_url,u.bio,COUNT(*) as common_genres FROM users u JOIN user_genres ug ON ug.user_id=u.id WHERE u.id!=? AND ug.genre IN (${ph}) GROUP BY u.id ORDER BY common_genres DESC LIMIT ?`).all(userId,...myGenres,limit); }

// ─── updateDeviceLastSeen ──────────────────────────────────────────────
export function updateDeviceLastSeen(sessionOrId: string|number) { if (USE_PG) return _pg.updateDeviceLastSeen(sessionOrId); const d=initSqlite(); if(typeof sessionOrId==="string"){d.run("UPDATE devices SET last_seen=? WHERE session_token=?",[now(),sessionOrId])}else{d.run("UPDATE devices SET last_seen=? WHERE id=?",[now(),sessionOrId])} }
