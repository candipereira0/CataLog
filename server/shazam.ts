// Shazam-style audio recognition — wraps AudD.io or ACRCloud, with mock mode fallback.

export interface RecognitionResult {
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  genre: string | null;
  confidence: number; // 0–100
  spotify_url: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  duration_ms: number | null;
  bpm: number | null;
  musical_key: string | null;
}

/** Mock track pool — ~15 realistic tracks across genres */
const MOCK_POOL: RecognitionResult[] = [
  {
    title: "Strobe",
    artist: "deadmau5",
    album: "For Lack of a Better Name",
    year: 2009,
    genre: "Progressive House",
    confidence: 92,
    spotify_url: "https://open.spotify.com/track/3HwbIbxCS8JroSxKoP8Mja",
    apple_music_url: "https://music.apple.com/us/album/strobe/330526785",
    youtube_url: "https://www.youtube.com/watch?v=tKi9Z-f6qX4",
    duration_ms: 632000,
    bpm: 128,
    musical_key: "4A",
  },
  {
    title: "Sandstorm",
    artist: "Darude",
    album: "Before the Storm",
    year: 1999,
    genre: "Trance",
    confidence: 88,
    spotify_url: "https://open.spotify.com/track/3XNoIok7Wm3uwgFG2YfU5p",
    apple_music_url: "https://music.apple.com/us/album/sandstorm/300267879",
    youtube_url: "https://www.youtube.com/watch?v=y6120QOlsfU",
    duration_ms: 446000,
    bpm: 136,
    musical_key: "6A",
  },
  {
    title: "Lose Yourself",
    artist: "Eminem",
    album: "8 Mile Soundtrack",
    year: 2002,
    genre: "Hip-Hop",
    confidence: 95,
    spotify_url: "https://open.spotify.com/track/5Z01UMMf7V1o0MzF86s6WJ",
    apple_music_url: "https://music.apple.com/us/album/lose-yourself/1436094872",
    youtube_url: "https://www.youtube.com/watch?v=_Yhyp-_hX2s",
    duration_ms: 326000,
    bpm: 86,
    musical_key: "7A",
  },
  {
    title: "Get Lucky",
    artist: "Daft Punk ft. Pharrell Williams",
    album: "Random Access Memories",
    year: 2013,
    genre: "Disco / Funk",
    confidence: 90,
    spotify_url: "https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof",
    apple_music_url: "https://music.apple.com/us/album/get-lucky/617154241",
    youtube_url: "https://www.youtube.com/watch?v=5NV6Rdv1a3I",
    duration_ms: 369000,
    bpm: 116,
    musical_key: "10A",
  },
  {
    title: "Breathe",
    artist: "The Prodigy",
    album: "The Fat of the Land",
    year: 1997,
    genre: "Big Beat / Electronic",
    confidence: 87,
    spotify_url: "https://open.spotify.com/track/5oPUBUzrAnwYvDiZ4rzZ3F",
    apple_music_url: "https://music.apple.com/us/album/breathe/300914678",
    youtube_url: "https://www.youtube.com/watch?v=6_PAHbqq-o4",
    duration_ms: 338000,
    bpm: 130,
    musical_key: "4A",
  },
  {
    title: "Blue Monday",
    artist: "New Order",
    album: "Power, Corruption & Lies",
    year: 1983,
    genre: "Synth-Pop / New Wave",
    confidence: 85,
    spotify_url: "https://open.spotify.com/track/6hHxZg2sYQhJMTqPje2RyD",
    apple_music_url: "https://music.apple.com/us/album/blue-monday/214230458",
    youtube_url: "https://www.youtube.com/watch?v=ftJZomwDhxQ",
    duration_ms: 445000,
    bpm: 130,
    musical_key: "7A",
  },
  {
    title: "Nights",
    artist: "Frank Ocean",
    album: "Blonde",
    year: 2016,
    genre: "R&B / Alternative",
    confidence: 91,
    spotify_url: "https://open.spotify.com/track/7eqoqGkKwgOaWNNHx90uEZ",
    apple_music_url: "https://music.apple.com/us/album/nights/1146195596",
    youtube_url: "https://www.youtube.com/watch?v=r4l9bFqgMaQ",
    duration_ms: 307000,
    bpm: 88,
    musical_key: "3A",
  },
  {
    title: "Opus",
    artist: "Eric Prydz",
    album: "Opus",
    year: 2016,
    genre: "Progressive House",
    confidence: 93,
    spotify_url: "https://open.spotify.com/track/4pKmwSNDIaOJIPMjP1yIau",
    apple_music_url: "https://music.apple.com/us/album/opus/1082642816",
    youtube_url: "https://www.youtube.com/watch?v=iRA82xLsb_w",
    duration_ms: 543000,
    bpm: 128,
    musical_key: "6A",
  },
  {
    title: "Paper Planes",
    artist: "M.I.A.",
    album: "Kala",
    year: 2007,
    genre: "Alternative / Electronic",
    confidence: 84,
    spotify_url: "https://open.spotify.com/track/1ixBwogBi1x60o1JKNV17a",
    apple_music_url: "https://music.apple.com/us/album/paper-planes/260619640",
    youtube_url: "https://www.youtube.com/watch?v=ewRjZoRtu0Y",
    duration_ms: 204000,
    bpm: 86,
    musical_key: "8A",
  },
  {
    title: "Levels",
    artist: "Avicii",
    album: "True",
    year: 2011,
    genre: "Progressive House / EDM",
    confidence: 94,
    spotify_url: "https://open.spotify.com/track/3yZH7LZVEh8xhQODHifPnY",
    apple_music_url: "https://music.apple.com/us/album/levels/1440752737",
    youtube_url: "https://www.youtube.com/watch?v=_ovdm2yX4MA",
    duration_ms: 199000,
    bpm: 126,
    musical_key: "1A",
  },
  {
    title: "Innerbloom",
    artist: "RÜFÜS DU SOL",
    album: "Bloom",
    year: 2016,
    genre: "Deep House / Indie Dance",
    confidence: 89,
    spotify_url: "https://open.spotify.com/track/5GJvj3SBWpLUfFTAiBxDuu",
    apple_music_url: "https://music.apple.com/us/album/innerbloom/1071145620",
    youtube_url: "https://www.youtube.com/watch?v=3PTEz4ZxYfQ",
    duration_ms: 569000,
    bpm: 122,
    musical_key: "4A",
  },
  {
    title: "Royals",
    artist: "Lorde",
    album: "Pure Heroine",
    year: 2013,
    genre: "Indie Pop",
    confidence: 86,
    spotify_url: "https://open.spotify.com/track/2dLLR6qlu5hvJCAgkQdlt7",
    apple_music_url: "https://music.apple.com/us/album/royals/1440815797",
    youtube_url: "https://www.youtube.com/watch?v=nlcIKh6sBtc",
    duration_ms: 189000,
    bpm: 85,
    musical_key: "8A",
  },
  {
    title: "Reckoner",
    artist: "Radiohead",
    album: "In Rainbows",
    year: 2007,
    genre: "Alternative Rock",
    confidence: 82,
    spotify_url: "https://open.spotify.com/track/5K0IRpdxHFLu2pMuybbHnN",
    apple_music_url: "https://music.apple.com/us/album/reckoner/1109714937",
    youtube_url: "https://www.youtube.com/watch?v=D2yC6O-7ES0",
    duration_ms: 292000,
    bpm: 104,
    musical_key: "5A",
  },
  {
    title: "One More Time",
    artist: "Daft Punk",
    album: "Discovery",
    year: 2000,
    genre: "French House",
    confidence: 91,
    spotify_url: "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV",
    apple_music_url: "https://music.apple.com/us/album/one-more-time/1436095892",
    youtube_url: "https://www.youtube.com/watch?v=FGBhQbmPwH8",
    duration_ms: 321000,
    bpm: 123,
    musical_key: "9A",
  },
  {
    title: "Chemicals",
    artist: "SG Lewis",
    album: "Dusk",
    year: 2018,
    genre: "Synthwave / Electronic",
    confidence: 83,
    spotify_url: "https://open.spotify.com/track/7tMf9Gv2Kj2rj4E8HjXSBJ",
    apple_music_url: null,
    youtube_url: "https://www.youtube.com/watch?v=t_FulC3QQaA",
    duration_ms: 263000,
    bpm: 114,
    musical_key: "2A",
  },
];

/** Mock pool: pick 1 weighted by confidence — returns a copy with fresh random confidence */
export function getMockResult(): RecognitionResult {
  const totalWeight = MOCK_POOL.reduce((s, t) => s + t.confidence, 0);
  let rand = Math.random() * totalWeight;
  for (const track of MOCK_POOL) {
    rand -= track.confidence;
    if (rand <= 0) {
      // Return a fresh copy with slightly varied confidence
      return { ...track, confidence: Math.min(100, track.confidence + Math.floor(Math.random() * 8) - 4) };
    }
  }
  return { ...MOCK_POOL[0], confidence: MOCK_POOL[0].confidence };
}

/**
 * Identify a track from an audio blob.
 * Uses AudD.io if AUDD_API_KEY is set, otherwise falls back to mock mode.
 */
export async function identifyTrack(audioBlob: Blob): Promise<RecognitionResult | null> {
  const auddKey = process.env.AUDD_API_KEY;
  const acrAccessKey = process.env.ACRCLOUD_ACCESS_KEY;

  if (auddKey) {
    return await identifyWithAudD(audioBlob, auddKey);
  }

  if (acrAccessKey) {
    return await identifyWithACR(audioBlob, acrAccessKey, process.env.ACRCLOUD_ACCESS_SECRET || "");
  }

  // Mock mode — simulate processing delay, then return mock result
  console.log("[shazam] No recognition API key — using mock mode");
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 2000));
  return getMockResult();
}

async function identifyWithAudD(blob: Blob, apiKey: string): Promise<RecognitionResult | null> {
  try {
    const formData = new FormData();
    formData.append("file", blob, "recording.wav");
    formData.append("api_token", apiKey);
    formData.append("return", "spotify,apple_music,musicbrainz");

    const res = await fetch("https://api.audd.io/", {
      method: "POST",
      body: formData,
    });

    const data = (await res.json()) as {
      status: string;
      result?: {
        title: string;
        artist: string;
        album?: string;
        release_date?: string;
        song_link?: string;
        spotify?: { album?: { name?: string }; external_urls?: { spotify?: string } };
        apple_music?: { url?: string };
        musicbrainz?: Array<{ bpm?: number; key?: string; length?: number }>;
        timecode?: string;
      } | null;
    };

    if (data.status !== "success" || !data.result) {
      console.log("[shazam] AudD returned no match:", data.status);
      return null;
    }

    const r = data.result;

    return {
      title: r.title,
      artist: r.artist,
      album: r.album || r.spotify?.album?.name || null,
      year: r.release_date ? parseInt(r.release_date.slice(0, 4)) : null,
      genre: null,
      confidence: 90,
      spotify_url: r.spotify?.external_urls?.spotify || null,
      apple_music_url: r.apple_music?.url || null,
      youtube_url: r.song_link || null,
      duration_ms: r.musicbrainz?.[0]?.length ? r.musicbrainz[0].length : null,
      bpm: r.musicbrainz?.[0]?.bpm || null,
      musical_key: r.musicbrainz?.[0]?.key || null,
    };
  } catch (err) {
    console.error("[shazam] AudD API error:", err);
    return null;
  }
}

async function identifyWithACR(
  blob: Blob,
  accessKey: string,
  accessSecret: string
): Promise<RecognitionResult | null> {
  try {
    // ACRCloud requires a timestamp and signature
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `${timestamp}\n${accessSecret}`;
    // Use Bun's crypto for HMAC-SHA1
    const encoder = new TextEncoder();
    const keyData = encoder.encode(accessSecret);
    const messageData = encoder.encode(stringToSign);

    const hmacKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );

    const sigBuffer = await crypto.subtle.sign("HMAC", hmacKey, messageData);
    const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    const formData = new FormData();
    formData.append("sample", blob, "recording.wav");
    formData.append("access_key", accessKey);
    formData.append("data_type", "audio");
    formData.append("signature", signature);
    formData.append("signature_version", "1");
    formData.append("timestamp", String(timestamp));

    const res = await fetch("https://identify-eu-west-1.acrcloud.com/v1/identify", {
      method: "POST",
      body: formData,
    });

    const data = (await res.json()) as {
      status: { code: number; msg: string };
      metadata?: {
        music?: Array<{
          title: string;
          artists?: Array<{ name: string }>;
          album?: { name?: string };
          release_date?: string;
          genres?: Array<{ name: string }>;
          external_metadata?: {
            spotify?: { track?: { id?: string } };
            youtube?: { vid?: string };
          };
          duration_ms?: number;
          bpm?: number;
          key?: string;
        }>;
      };
    };

    if (data.status.code !== 0 || !data.metadata?.music?.length) {
      console.log("[shazam] ACRCloud returned no match:", data.status.msg);
      return null;
    }

    const r = data.metadata.music[0];

    return {
      title: r.title,
      artist: r.artists?.map((a) => a.name).join(", ") || "Unknown",
      album: r.album?.name || null,
      year: r.release_date ? parseInt(r.release_date.slice(0, 4)) : null,
      genre: r.genres?.[0]?.name || null,
      confidence: 90,
      spotify_url: r.external_metadata?.spotify?.track?.id
        ? `https://open.spotify.com/track/${r.external_metadata.spotify.track.id}`
        : null,
      apple_music_url: null,
      youtube_url: r.external_metadata?.youtube?.vid
        ? `https://www.youtube.com/watch?v=${r.external_metadata.youtube.vid}`
        : null,
      duration_ms: r.duration_ms || null,
      bpm: r.bpm || null,
      musical_key: r.key || null,
    };
  } catch (err) {
    console.error("[shazam] ACRCloud API error:", err);
    return null;
  }
}
