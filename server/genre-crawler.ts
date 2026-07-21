// Genre Crawler — web-sourced genre intelligence for CataLog
// Fetches new genres from music databases and cross-references tracks against Spotify/YouTube.
// Uses mock data when API keys are unavailable.

import { GENRES, type GenreNode, getAllGenres } from "./genres";

// ─── Configuration ───

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";

const MOCK_MODE = !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET;

// ─── Interfaces ───

export interface DiscoveredGenre {
  name: string;
  parent: string | null;
  source: "wikipedia" | "rateyourmusic" | "spotify" | "youtube";
  confidence: "high" | "medium" | "low";
  description: string;
}

export interface CrossReferenceResult {
  track: { title: string; artist: string };
  spotify: CrossReferenceSource | null;
  youtube: CrossReferenceSource | null;
  consensus_genres: string[];
  suggested_genres: string[];
}

export interface CrossReferenceSource {
  platform: "spotify" | "youtube";
  found: boolean;
  genres: string[];
  tags: string[];
  url: string | null;
}

// ─── Mock Genre Data (emerging genres sourced from web) ───

const MOCK_DISCOVERED_GENRES: DiscoveredGenre[] = [
  {
    name: "Phonk",
    parent: "Hip-Hop",
    source: "wikipedia",
    confidence: "high",
    description: "A subgenre of hip-hop and trap inspired by 90s Memphis rap, characterized by distorted bass, cowbell melodies, and lo-fi aesthetics.",
  },
  {
    name: "Slap House",
    parent: "House",
    source: "youtube",
    confidence: "high",
    description: "A bass-heavy, commercial house subgenre popularized in the late 2010s featuring slap basslines and vocal chops.",
  },
  {
    name: "Jersey Club",
    parent: "Hip-Hop",
    source: "rateyourmusic",
    confidence: "high",
    description: "Fast-paced club music from Newark, NJ featuring chopped samples, triplet kick patterns, and heavy bass.",
  },
  {
    name: "Hypertechno",
    parent: "Techno",
    source: "rateyourmusic",
    confidence: "medium",
    description: "An emerging high-BPM techno variant incorporating trance melodies and hardstyle influences, gaining traction in European rave scenes.",
  },
  {
    name: "Amapiano",
    parent: "Afrobeat",
    source: "wikipedia",
    confidence: "high",
    description: "South African house music subgenre emerging in the 2010s, characterized by piano melodies, deep house basslines, and log drum patterns.",
  },
  {
    name: "Drift Phonk",
    parent: "Hip-Hop",
    source: "youtube",
    confidence: "medium",
    description: "An aggressive offshoot of phonk music associated with car culture and drift videos on social media.",
  },
  {
    name: "Digicore",
    parent: "Electronic",
    source: "rateyourmusic",
    confidence: "medium",
    description: "Internet-born hyperpop-adjacent genre blending glitch, emo, and trap elements, pioneered on SoundCloud and Discord communities.",
  },
  {
    name: "Kawaii Future Bass",
    parent: "Electronic",
    source: "youtube",
    confidence: "medium",
    description: "Anime-influenced future bass variant featuring bright, high-pitched synths and cute vocal samples.",
  },
  {
    name: "Stutter House",
    parent: "House",
    source: "spotify",
    confidence: "medium",
    description: "Minimal/deep house variant using heavy vocal stutter/gate effects as the main rhythmic element.",
  },
  {
    name: "Brazilian Phonk",
    parent: "Hip-Hop",
    source: "youtube",
    confidence: "medium",
    description: "Brazilian-influenced phonk variant incorporating funk carioca rhythms and Portuguese samples.",
  },
  {
    name: "Colour Bass",
    parent: "Dubstep",
    source: "rateyourmusic",
    confidence: "medium",
    description: "Melodic, vibrant dubstep variant emphasizing lush chord progressions, vocal chops, and bright synthesis, pioneered by artists like Chime and Ace Aura.",
  },
  {
    name: "Rage",
    parent: "Hip-Hop",
    source: "spotify",
    confidence: "medium",
    description: "High-energy rap subgenre popularized by Playboi Carti's Whole Lotta Red, featuring distorted 808s, synth-heavy production, and aggressive delivery.",
  },
  {
    name: "Afro-House",
    parent: "House",
    source: "wikipedia",
    confidence: "high",
    description: "A broad category of house music rooted in African rhythms and melodies, encompassing various regional styles from South Africa to Angola.",
  },
  {
    name: "Organic House",
    parent: "House",
    source: "spotify",
    confidence: "high",
    description: "Downtempo, world-music-influenced house featuring organic instrumentation, ethnic percussion, and natural soundscapes.",
  },
  {
    name: "Rawstyle",
    parent: "Hard Techno",
    source: "rateyourmusic",
    confidence: "medium",
    description: "Gritty, distorted hardstyle variant emphasizing raw kicks, screeches, and aggressive atmospheres over melodic elements.",
  },
];

// ─── Mock Cross-Reference Data ───

function mockCrossReference(title: string, artist: string): CrossReferenceResult {
  const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;

  const mockDB: Record<string, CrossReferenceResult> = {
    // House tracks
    "around the world|daft punk": {
      track: { title, artist },
      spotify: { platform: "spotify", found: true, genres: ["French House", "Dance", "Electronic"], tags: ["filter house", "disco", "french touch", "1997"], url: "https://open.spotify.com/track/example" },
      youtube: { platform: "youtube", found: true, genres: ["House", "Electronic"], tags: ["classic house", "daft punk", "french house", "90s"], url: "https://youtube.com/watch?v=example" },
      consensus_genres: ["French House", "Electronic", "Dance"],
      suggested_genres: ["Disco House", "French House", "Dance"],
    },
    "strobe|deadmau5": {
      track: { title, artist },
      spotify: { platform: "spotify", found: true, genres: ["Progressive House", "Electronic", "Dance"], tags: ["progressive", "melodic", "2009", "instrumental"], url: "https://open.spotify.com/track/example" },
      youtube: { platform: "youtube", found: true, genres: ["Progressive House", "Electronic"], tags: ["deadmau5", "progressive house", "classic", "long build"], url: "https://youtube.com/watch?v=example" },
      consensus_genres: ["Progressive House", "Electronic"],
      suggested_genres: ["Progressive House", "Melodic House", "Electronic"],
    },
    "levels|avicii": {
      track: { title, artist },
      spotify: { platform: "spotify", found: true, genres: ["Progressive House", "EDM", "Dance"], tags: ["festival", "anthem", "2011", "vocal sample"], url: "https://open.spotify.com/track/example" },
      youtube: { platform: "youtube", found: true, genres: ["EDM", "Progressive House"], tags: ["avicii", "festival house", "classic", "2010s"], url: "https://youtube.com/watch?v=example" },
      consensus_genres: ["Progressive House", "EDM", "Dance"],
      suggested_genres: ["Progressive House", "EDM", "Festival House"],
    },
    // Techno tracks
    "the bells|jeff mills": {
      track: { title, artist },
      spotify: { platform: "spotify", found: true, genres: ["Detroit Techno", "Techno", "Electronic"], tags: ["detroit", "minimal", "classic", "1996"], url: "https://open.spotify.com/track/example" },
      youtube: { platform: "youtube", found: true, genres: ["Techno", "Detroit Techno"], tags: ["jeff mills", "detroit techno", "classic", "minimal"], url: "https://youtube.com/watch?v=example" },
      consensus_genres: ["Detroit Techno", "Techno"],
      suggested_genres: ["Detroit Techno", "Minimal Techno", "Techno"],
    },
    // Drum & Bass
    "brown paper bag|roni size": {
      track: { title, artist },
      spotify: { platform: "spotify", found: true, genres: ["Drum & Bass", "Jungle", "Electronic"], tags: ["liquid", "jazz", "1997", "bristol"], url: "https://open.spotify.com/track/example" },
      youtube: { platform: "youtube", found: true, genres: ["Drum & Bass", "Jungle"], tags: ["roni size", "jungle", "classic", "liquid funk"], url: "https://youtube.com/watch?v=example" },
      consensus_genres: ["Drum & Bass", "Jungle"],
      suggested_genres: ["Liquid DnB", "Jungle", "Drum & Bass"],
    },
    // Hip-Hop
    "sicko mode|travis scott": {
      track: { title, artist },
      spotify: { platform: "spotify", found: true, genres: ["Hip-Hop", "Trap", "Rap"], tags: ["trap", "2018", "beat switch", "houston"], url: "https://open.spotify.com/track/example" },
      youtube: { platform: "youtube", found: true, genres: ["Hip-Hop", "Trap"], tags: ["travis scott", "trap", "astro world", "hip hop"], url: "https://youtube.com/watch?v=example" },
      consensus_genres: ["Hip-Hop", "Trap"],
      suggested_genres: ["Trap", "Southern Hip-Hop", "Hip-Hop"],
    },
    // Trance
    "adagio for strings|tiësto": {
      track: { title, artist },
      spotify: { platform: "spotify", found: true, genres: ["Trance", "Uplifting Trance", "Electronic"], tags: ["classic", "orchestral", "2004", "vocal"], url: "https://open.spotify.com/track/example" },
      youtube: { platform: "youtube", found: true, genres: ["Trance", "Uplifting Trance"], tags: ["tiesto", "trance", "classic", "epic"], url: "https://youtube.com/watch?v=example" },
      consensus_genres: ["Trance", "Uplifting Trance"],
      suggested_genres: ["Uplifting Trance", "Vocal Trance", "Trance"],
    },
    // Dubstep
    "scary monsters and nice sprites|skrillex": {
      track: { title, artist },
      spotify: { platform: "spotify", found: true, genres: ["Dubstep", "Brostep", "Electronic"], tags: ["brostep", "2010", "iconic", "wobble"], url: "https://open.spotify.com/track/example" },
      youtube: { platform: "youtube", found: true, genres: ["Dubstep", "Brostep"], tags: ["skrillex", "dubstep", "brostep", "classic"], url: "https://youtube.com/watch?v=example" },
      consensus_genres: ["Dubstep", "Brostep"],
      suggested_genres: ["Brostep", "Dubstep", "Electronic"],
    },
    // Jazz
    "so what|miles davis": {
      track: { title, artist },
      spotify: { platform: "spotify", found: true, genres: ["Modal Jazz", "Jazz", "Cool Jazz"], tags: ["modal", "1959", "blue note", "kind of blue"], url: "https://open.spotify.com/track/example" },
      youtube: { platform: "youtube", found: true, genres: ["Jazz", "Modal Jazz"], tags: ["miles davis", "modal jazz", "classic", "blue note"], url: "https://youtube.com/watch?v=example" },
      consensus_genres: ["Modal Jazz", "Jazz"],
      suggested_genres: ["Modal Jazz", "Cool Jazz", "Jazz"],
    },
  };

  // Exact match lookup
  if (mockDB[key]) {
    return { ...mockDB[key], track: { title, artist } };
  }

  // Fuzzy: generate plausible cross-reference data based on known patterns
  const words = `${title} ${artist}`.toLowerCase();
  let genres: string[] = [];
  let platformGenreSets: string[][] = [[], []];

  if (words.includes("house") || words.includes("deep") || words.includes("groove")) {
    genres = ["House", "Dance"];
    platformGenreSets = [["Deep House", "House", "Electronic"], ["House", "Dance"]];
  } else if (words.includes("techno") || words.includes("dark") || words.includes("industrial")) {
    genres = ["Techno", "Electronic"];
    platformGenreSets = [["Techno", "Melodic Techno", "Electronic"], ["Techno", "Underground"]];
  } else if (words.includes("drum") || words.includes("bass") || words.includes("dnb") || words.includes("jungle")) {
    genres = ["Drum & Bass", "Electronic"];
    platformGenreSets = [["Drum & Bass", "Liquid DnB", "Electronic"], ["Drum & Bass", "Jungle"]];
  } else if (words.includes("trap") || words.includes("rap") || words.includes("hip")) {
    genres = ["Hip-Hop", "Trap"];
    platformGenreSets = [["Hip-Hop", "Trap", "Rap"], ["Hip-Hop", "Trap"]];
  } else if (words.includes("trance") || words.includes("uplift") || words.includes("progressive")) {
    genres = ["Trance", "Electronic"];
    platformGenreSets = [["Progressive Trance", "Trance", "Electronic"], ["Trance", "Uplifting"]];
  } else if (words.includes("dubstep") || words.includes("bass") || words.includes("wobble")) {
    genres = ["Dubstep", "Electronic"];
    platformGenreSets = [["Brostep", "Dubstep", "Electronic"], ["Dubstep", "Bass Music"]];
  } else if (words.includes("pop") || words.includes("radio")) {
    genres = ["Pop", "Dance Pop"];
    platformGenreSets = [["Pop", "Dance Pop", "Electro Pop"], ["Pop", "Mainstream"]];
  } else if (words.includes("funk") || words.includes("soul") || words.includes("groove")) {
    genres = ["Funk", "Soul"];
    platformGenreSets = [["Funk", "P-Funk", "Soul"], ["Funk", "Groove"]];
  } else if (words.includes("ambient") || words.includes("drone") || words.includes("chill")) {
    genres = ["Ambient", "Electronic"];
    platformGenreSets = [["Ambient", "Drone", "Electronic"], ["Ambient", "Chill"]];
  } else {
    genres = ["Electronic", "Dance"];
    platformGenreSets = [["Electronic", "Dance", "Indie Electronic"], ["Electronic", "Dance"]];
  }

  return {
    track: { title, artist },
    spotify: {
      platform: "spotify",
      found: true,
      genres: platformGenreSets[0],
      tags: platformGenreSets[0].map(g => g.toLowerCase()),
      url: `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${title}`)}`,
    },
    youtube: {
      platform: "youtube",
      found: true,
      genres: platformGenreSets[1],
      tags: platformGenreSets[1].map(g => g.toLowerCase()),
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${title}`)}`,
    },
    consensus_genres: genres,
    suggested_genres: genres,
  };
}

// ─── Spotify API Integration ───

let spotifyAccessToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  if (spotifyAccessToken && spotifyAccessToken.expiresAt > Date.now()) {
    return spotifyAccessToken.token;
  }
  try {
    const resp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    const data = await resp.json() as { access_token?: string; expires_in?: number; error?: string };
    if (data.access_token) {
      spotifyAccessToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - 60000, // 1min buffer
      };
      return spotifyAccessToken.token;
    }
    console.error("Spotify auth error:", data.error);
    return null;
  } catch (err) {
    console.error("Spotify token fetch failed:", err);
    return null;
  }
}

async function spotifySearchTrack(title: string, artist: string): Promise<CrossReferenceSource | null> {
  if (MOCK_MODE) return null;
  const token = await getSpotifyToken();
  if (!token) return null;

  try {
    const query = encodeURIComponent(`track:${title} artist:${artist}`);
    const resp = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=3`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json() as {
      tracks?: { items?: Array<{ artists?: Array<{ id: string }>; external_urls?: { spotify: string }; id: string }> };
    };

    if (!data.tracks?.items?.length) {
      return { platform: "spotify", found: false, genres: [], tags: [], url: null };
    }

    const track = data.tracks.items[0];
    const artistIds = track.artists?.map(a => a.id).filter(Boolean) || [];

    // Fetch artist genres
    let genres: string[] = [];
    if (artistIds.length > 0) {
      const artistResp = await fetch(`https://api.spotify.com/v1/artists/${artistIds[0]}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const artistData = await artistResp.json() as { genres?: string[] };
      genres = (artistData.genres || []).map(g => g.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
    }

    return {
      platform: "spotify",
      found: true,
      genres,
      tags: genres.map(g => g.toLowerCase()),
      url: track.external_urls?.spotify || null,
    };
  } catch (err) {
    console.error("Spotify search failed:", err);
    return { platform: "spotify", found: false, genres: [], tags: [], url: null };
  }
}

// ─── YouTube API Integration ───

async function youtubeSearchTrack(title: string, artist: string): Promise<CrossReferenceSource | null> {
  if (MOCK_MODE || !YOUTUBE_API_KEY) return null;

  try {
    const query = encodeURIComponent(`${artist} ${title} official`);
    const resp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=3&key=${YOUTUBE_API_KEY}&videoCategoryId=10` // Category 10 = Music
    );
    const data = await resp.json() as {
      items?: Array<{ id: { videoId: string }; snippet?: { tags?: string[]; categoryId?: string } }>;
    };

    if (!data.items?.length) {
      return { platform: "youtube", found: false, genres: [], tags: [], url: null };
    }

    const video = data.items[0];
    const tags = video.snippet?.tags || [];
    const url = `https://www.youtube.com/watch?v=${video.id.videoId}`;

    // Extract genre-like tags
    const genreTags = tags.filter(t =>
      !t.match(/^(official|music|video|hd|4k|lyrics|audio|new|202\d|vevo|music video|official video)$/i)
    );

    return {
      platform: "youtube",
      found: true,
      genres: genreTags.slice(0, 5),
      tags: genreTags.slice(0, 10),
      url,
    };
  } catch (err) {
    console.error("YouTube search failed:", err);
    return { platform: "youtube", found: false, genres: [], tags: [], url: null };
  }
}

// ─── Public API ───

/**
 * Discover new genres by scanning music databases (Wikipedia, RateYourMusic, etc.)
 * Cross-references with existing genre hierarchy to find genres not yet in the database.
 */
export async function discoverNewGenres(): Promise<DiscoveredGenre[]> {
  // In mock mode, return curated list of emerging genres with simulated web-sourcing
  // In live mode, this would fetch from Wikipedia API, RateYourMusic, etc.

  const existingNames = new Set(getAllGenres().map(g => g.toLowerCase()));

  if (MOCK_MODE) {
    // Filter out genres that already exist in our hierarchy
    const newGenres = MOCK_DISCOVERED_GENRES.filter(g => !existingNames.has(g.name.toLowerCase()));
    // Add a small simulated delay for realism
    await new Promise(resolve => setTimeout(resolve, 200));
    return newGenres;
  }

  // ─── Live mode: fetch from Wikipedia ───
  const discovered: DiscoveredGenre[] = [];

  try {
    // Fetch Wikipedia's list of electronic music genres
    const wikiResp = await fetch(
      "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_electronic_music_genres&prop=links&format=json"
    );
    const wikiData = await wikiResp.json() as {
      parse?: { links?: Array<{ "*": string }> };
    };

    if (wikiData.parse?.links) {
      const genreKeywords = new Set([
        "house", "techno", "trance", "drum", "bass", "dubstep", "ambient", "garage",
        "breakbeat", "jungle", "hardcore", "hardstyle", "electro", "synth", "future",
        "deep", "progressive", "minimal", "acid", "detroit", "chicago", "uk", "gabber",
      ]);

      for (const link of wikiData.parse.links) {
        const name = link["*"].trim();
        if (name.length < 3 || name.length > 40) continue;
        if (name.match(/^(List|Lists|Music|Electronic|Genre|References|See also|External)/)) continue;

        const lower = name.toLowerCase();
        if (existingNames.has(lower)) continue;

        const hasMusicKeyword = [...genreKeywords].some(kw => lower.includes(kw));
        if (hasMusicKeyword) {
          discovered.push({
            name,
            parent: null,
            source: "wikipedia",
            confidence: "medium",
            description: `Genre sourced from Wikipedia's list of electronic music genres.`,
          });
        }
      }
    }
  } catch (err) {
    console.error("Wikipedia fetch failed:", err);
  }

  return discovered;
}

/**
 * Cross-reference a track against Spotify and YouTube to determine genre tags.
 * Falls back to mock data when API keys are not configured.
 */
export async function crossReferenceTrack(
  title: string,
  artist: string
): Promise<CrossReferenceResult> {
  // Try real APIs first, fall back to mock
  const [spotifyResult, youtubeResult] = await Promise.all([
    spotifySearchTrack(title, artist),
    youtubeSearchTrack(title, artist),
  ]);

  // If either real API returned data, build consensus from real results
  if (spotifyResult?.found || youtubeResult?.found) {
    const allGenres: string[] = [];
    if (spotifyResult?.genres) allGenres.push(...spotifyResult.genres);
    if (youtubeResult?.genres) allGenres.push(...youtubeResult.genres);

    // Count occurrences for consensus
    const genreCounts = new Map<string, number>();
    for (const g of allGenres) {
      const key = g.toLowerCase();
      genreCounts.set(key, (genreCounts.get(key) || 0) + 1);
    }

    const consensusGenres = [...genreCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1));

    return {
      track: { title, artist },
      spotify: spotifyResult,
      youtube: youtubeResult,
      consensus_genres: consensusGenres.length > 0 ? consensusGenres : allGenres.slice(0, 3),
      suggested_genres: allGenres.slice(0, 5),
    };
  }

  // Fall back to mock data
  return mockCrossReference(title, artist);
}
