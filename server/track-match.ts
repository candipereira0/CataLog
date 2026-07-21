// Track matching utility — shared between Spotify/Apple Music integrations
// Matches CataLog tracks to external service tracks and vice versa.

import { getDb } from "./db";

export interface MatchResult {
  matched: boolean;
  confidence: number; // 0-1
  externalId: string | null;
  externalUrl: string | null;
  matchMethod: "isrc" | "title_artist" | "none";
  externalTitle?: string;
  externalArtist?: string;
}

export interface SpotifyTrackRef {
  id: string;
  title: string;
  artist: string;
  album: string;
  isrc?: string;
  durationMs: number;
  url?: string;
}

export interface CatalogTrackRef {
  id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  filename: string;
}

// ─── Match CataLog track → Spotify ──────────────────────────────────────────

export function matchCatalogToSpotify(
  track: CatalogTrackRef,
  spotifySearchFn: (query: string, type: "isrc" | "track") => Promise<SpotifyTrackRef[]>,
): Promise<MatchResult> {
  return matchTrackToExternal(track, spotifySearchFn);
}

// ─── Match Spotify track → CataLog ─────────────────────────────────────────

export async function matchSpotifyToCatalog(
  spotifyTrack: SpotifyTrackRef,
  userId: number,
): Promise<MatchResult> {
  const db = getDb();

  // Try ISRC first
  if (spotifyTrack.isrc) {
    // We check tracks with matching title+artist first, ISRC is secondary
    // since we don't store ISRC in the DB yet — check by title+artist.
    const byTitle = await db.query(
      "SELECT id, title, artist FROM tracks WHERE user_id = ? AND title = ? AND artist = ?",
    ).get(userId, spotifyTrack.title, spotifyTrack.artist) as CatalogTrackRef | undefined;

    if (byTitle) {
      return {
        matched: true,
        confidence: 0.95,
        externalId: spotifyTrack.id,
        externalUrl: spotifyTrack.url || null,
        matchMethod: "title_artist",
        externalTitle: spotifyTrack.title,
        externalArtist: spotifyTrack.artist,
      };
    }

    // Try fuzzy by title
    const byTitleFuzzy = await db.query(
      "SELECT id, title, artist FROM tracks WHERE user_id = ? AND title LIKE ?",
    ).get(userId, `%${spotifyTrack.title}%`) as CatalogTrackRef | undefined;

    if (byTitleFuzzy) {
      return {
        matched: true,
        confidence: 0.7,
        externalId: spotifyTrack.id,
        externalUrl: spotifyTrack.url || null,
        matchMethod: "title_artist",
        externalTitle: spotifyTrack.title,
        externalArtist: spotifyTrack.artist,
      };
    }
  }

  // Try title + artist
  const byTitleArtist = await db.query(
    "SELECT id, title, artist FROM tracks WHERE user_id = ? AND (title = ? OR artist = ?)",
  ).get(userId, spotifyTrack.title, spotifyTrack.artist) as CatalogTrackRef | undefined;

  if (byTitleArtist) {
    return {
      matched: true,
      confidence: 0.6,
      externalId: spotifyTrack.id,
      externalUrl: spotifyTrack.url || null,
      matchMethod: "title_artist",
      externalTitle: spotifyTrack.title,
      externalArtist: spotifyTrack.artist,
    };
  }

  return {
    matched: false,
    confidence: 0,
    externalId: spotifyTrack.id,
    externalUrl: spotifyTrack.url || null,
    matchMethod: "none",
    externalTitle: spotifyTrack.title,
    externalArtist: spotifyTrack.artist,
  };
}

// ─── Generic external matching ──────────────────────────────────────────────

async function matchTrackToExternal(
  track: CatalogTrackRef,
  searchFn: (query: string, type: "isrc" | "track") => Promise<SpotifyTrackRef[]>,
): Promise<MatchResult> {
  const title = track.title || track.filename;
  const artist = track.artist || "";

  // Strategy 1: Search by title + artist
  const query = artist ? `${title} ${artist}` : title;
  let results = await searchFn(query, "track");

  if (results.length > 0) {
    // Find best match — exact title+artist match
    const exactMatch = results.find(
      (r) =>
        r.title.toLowerCase() === title.toLowerCase() &&
        r.artist.toLowerCase() === artist.toLowerCase(),
    );

    if (exactMatch) {
      return {
        matched: true,
        confidence: 0.9,
        externalId: exactMatch.id,
        externalUrl: exactMatch.url || `https://open.spotify.com/track/${exactMatch.id}`,
        matchMethod: "title_artist",
        externalTitle: exactMatch.title,
        externalArtist: exactMatch.artist,
      };
    }

    // Partial match — title contains
    const partialMatch = results.find((r) =>
      r.title.toLowerCase().includes(title.toLowerCase()),
    );

    if (partialMatch) {
      return {
        matched: true,
        confidence: 0.65,
        externalId: partialMatch.id,
        externalUrl: partialMatch.url || `https://open.spotify.com/track/${partialMatch.id}`,
        matchMethod: "title_artist",
        externalTitle: partialMatch.title,
        externalArtist: partialMatch.artist,
      };
    }

    // First result as fallback
    return {
      matched: true,
      confidence: 0.4,
      externalId: results[0].id,
      externalUrl: results[0].url || `https://open.spotify.com/track/${results[0].id}`,
      matchMethod: "title_artist",
      externalTitle: results[0].title,
      externalArtist: results[0].artist,
    };
  }

  return {
    matched: false,
    confidence: 0,
    externalId: null,
    externalUrl: null,
    matchMethod: "none",
  };
}

// ─── Batch matching ─────────────────────────────────────────────────────────

export async function batchMatchCatalogToSpotify(
  tracks: CatalogTrackRef[],
  searchFn: (query: string, type: "isrc" | "track") => Promise<SpotifyTrackRef[]>,
): Promise<Map<number, MatchResult>> {
  const results = new Map<number, MatchResult>();
  for (const track of tracks) {
    results.set(track.id, await matchCatalogToSpotify(track, searchFn));
  }
  return results;
}

export function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/\(feat\..*?\)/gi, "")
    .replace(/\(ft\..*?\)/gi, "")
    .replace(/\(with.*?\)/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
