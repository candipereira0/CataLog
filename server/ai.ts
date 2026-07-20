// AI module for CataLog — handles LLM calls for auto-tagging and playlist generation.
// Falls back to mock/demo mode when no API key is configured.

export interface TrackMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  bpm: number | null;
  musical_key: string | null;
  duration_ms: number | null;
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

export interface LibrarySummary {
  totalTracks: number;
  topGenres: string[];
  topArtists: string[];
  bpmRange: { min: number; max: number } | null;
  keys: string[];
}

export interface ExternalTrackSuggestion {
  title: string;
  artist: string;
  appleMusicUrl: string;
  spotifyUrl: string;
  youtubeUrl: string;
}

export interface AIPlaylistResult {
  name: string;
  description: string;
  trackIds: number[];       // IDs from user's library
  externalSuggestions: ExternalTrackSuggestion[];
}

function isConfigured(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
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

// ─── Mock / demo implementations ───

const SUBGENRE_MAP: Record<string, string[]> = {
  "house": ["deep house", "tech house", "progressive house", "soulful house", "afro house"],
  "techno": ["melodic techno", "peak time", "hypnotic techno", "industrial techno"],
  "drum and bass": ["liquid", "neurofunk", "jump up", "minimal dnb"],
  "trance": ["uplifting", "progressive trance", "psytrance", "vocal trance"],
  "hip-hop": ["boom bap", "trap", "conscious", "drill"],
  "pop": ["synth-pop", "dance-pop", "indie pop", "electropop"],
  "rock": ["indie rock", "alternative", "post-punk", "garage rock"],
  "electronic": ["downtempo", "ambient", "idm", "glitch"],
  "latin": ["reggaeton", "latin house", "bachata", "salsa"],
  "jazz": ["bebop", "nu jazz", "jazz fusion", "acid jazz"],
  "ambient": ["dark ambient", "drone", "space music", "ethereal"],
};

const MOODS_BY_GENRE: Record<string, string[]> = {
  "house": ["uplifting", "groovy", "hypnotic", "euphoric", "deep"],
  "techno": ["dark", "driving", "hypnotic", "industrial", "relentless"],
  "drum and bass": ["energetic", "aggressive", "atmospheric", "rolling"],
  "trance": ["euphoric", "uplifting", "epic", "emotional", "dreamy"],
  "hip-hop": ["gritty", "confident", "laid-back", "aggressive"],
  "pop": ["upbeat", "catchy", "bright", "playful"],
  "ambient": ["calm", "ethereal", "meditative", "spacious"],
};

const MOODS_FALLBACK = ["dark", "uplifting", "hypnotic", "energetic", "laid-back", "euphoric", "moody", "bright", "aggressive", "melancholic"];

const CHORD_PROGRESSIONS = [
  "I-V-vi-IV", "vi-IV-I-V", "I-IV-V", "ii-V-I",
  "I-vi-IV-V", "vi-V-IV-III", "i-VI-III-VII", "i-iv-v",
];

const BEAT_PATTERNS = [
  "four-on-the-floor", "breakbeat", "808 with clap", "trap hi-hats",
  "half-time", "dembow", "shuffle groove", "straight 8ths",
];

function mockAITag(track: TrackMetadata): AITagResult {
  // Deterministic-ish mock based on track metadata
  const seed = (track.title || "") + (track.artist || "") + (track.genre || "");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;

  const rng = (max: number) => Math.abs((hash = ((hash * 1103515245) + 12345) & 0x7fffffff)) % max;

  const genre = track.genre?.toLowerCase() || "";
  const genreKey = Object.keys(SUBGENRE_MAP).find(g => genre.includes(g));
  const subgenres = genreKey ? SUBGENRE_MAP[genreKey] : ["deep", "progressive", "minimal"];
  const moods = genreKey ? (MOODS_BY_GENRE[genreKey] || MOODS_FALLBACK) : MOODS_FALLBACK;

  // Guess decade from BPM or year
  let decade: string | null = null;
  if (track.year) {
    const d = Math.floor(track.year / 10) * 10;
    decade = `${d}s`;
  } else if (track.bpm) {
    // Heuristic: certain BPM ranges correlate with eras
    if (track.bpm < 115) decade = "2010s";
    else if (track.bpm < 130) decade = "2020s";
    else decade = "2010s";
  }

  return {
    genre: track.genre || null,
    subgenre: subgenres[rng(subgenres.length)],
    mood: moods[rng(moods.length)],
    language: track.title && /[^\x00-\x7F]/.test(track.title) ? "Various" : "English",
    country: null,
    decade,
    chord_progression: CHORD_PROGRESSIONS[rng(CHORD_PROGRESSIONS.length)],
    beat_pattern: BEAT_PATTERNS[rng(BEAT_PATTERNS.length)],
  };
}

function mockAIPlaylist(
  prompt: string,
  library: LibrarySummary
): AIPlaylistResult {
  const promptLower = prompt.toLowerCase();

  // Pick a playlist name from the prompt
  const nameWords = prompt.split(" ").slice(0, 5).join(" ");
  const name = `AI: ${nameWords.charAt(0).toUpperCase() + nameWords.slice(1)}`;

  // Build description
  const description = `Generated playlist based on prompt: "${prompt}". Library: ${library.totalTracks} tracks across ${library.topGenres.length} genres.`;

  // Pick matching genre filters from library
  const matchingGenres = library.topGenres.filter(g =>
    promptLower.includes(g.toLowerCase())
  );

  // Build external suggestions
  const externalSuggestions: ExternalTrackSuggestion[] = [];
  if (promptLower.includes("bollywood") || promptLower.includes("indian")) {
    externalSuggestions.push({
      title: "Mundian To Bach Ke",
      artist: "Panjabi MC",
      appleMusicUrl: "https://music.apple.com/search?term=Panjabi+MC+Mundian",
      spotifyUrl: "https://open.spotify.com/search/Panjabi%20MC%20Mundian",
      youtubeUrl: "https://www.youtube.com/results?search_query=Panjabi+MC+Mundian+To+Bach+Ke",
    });
  }
  if (promptLower.includes("deep") || promptLower.includes("tech")) {
    externalSuggestions.push({
      title: "Deep State",
      artist: "Boris Brejcha",
      appleMusicUrl: "https://music.apple.com/search?term=Boris+Brejcha+Deep+State",
      spotifyUrl: "https://open.spotify.com/search/Boris%20Brejcha%20Deep%20State",
      youtubeUrl: "https://www.youtube.com/results?search_query=Boris+Brejcha+Deep+State",
    });
  }
  if (promptLower.includes("wedding") || promptLower.includes("party")) {
    externalSuggestions.push({
      title: "Get Lucky",
      artist: "Daft Punk ft. Pharrell Williams",
      appleMusicUrl: "https://music.apple.com/search?term=Daft+Punk+Get+Lucky",
      spotifyUrl: "https://open.spotify.com/search/Daft%20Punk%20Get%20Lucky",
      youtubeUrl: "https://www.youtube.com/results?search_query=Daft+Punk+Get+Lucky",
    });
  }
  // Always add at least one suggestion
  if (externalSuggestions.length === 0) {
    externalSuggestions.push({
      title: "Turn Down For What",
      artist: "DJ Snake & Lil Jon",
      appleMusicUrl: "https://music.apple.com/search?term=DJ+Snake+Turn+Down+For+What",
      spotifyUrl: "https://open.spotify.com/search/DJ%20Snake%20Turn%20Down%20For%20What",
      youtubeUrl: "https://www.youtube.com/results?search_query=DJ+Snake+Turn+Down+For+What",
    });
  }

  return {
    name,
    description,
    trackIds: [], // Will be filled by handler from DB query
    externalSuggestions,
  };
}

// ─── AI Search (mock) ───

interface SearchableTrack {
  id: number;
  title: string | null;
  artist: string | null;
  genre: string | null;
  subgenre: string | null;
  mood: string | null;
  language: string | null;
  album: string | null;
}

function mockSearchLibrary(query: string, tracks: SearchableTrack[]): SearchResults {
  const queryLower = query.toLowerCase();
  const matches: SearchResult[] = [];

  // Extract meaningful keywords from the query
  const keywords = queryLower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !["the", "and", "for", "that", "with", "this", "from", "like"].includes(w));

  // Also check for quoted phrases
  const quotedPhrases = [...queryLower.matchAll(/"([^"]+)"|'([^']+)'/g)].map(m => (m[1] || m[2]).toLowerCase());

  for (const track of tracks) {
    let score = 0;
    const reasons: string[] = [];

    const titleLower = (track.title || "").toLowerCase();
    const artistLower = (track.artist || "").toLowerCase();
    const genreLower = (track.genre || "").toLowerCase();
    const subgenreLower = (track.subgenre || "").toLowerCase();
    const moodLower = (track.mood || "").toLowerCase();
    const languageLower = (track.language || "").toLowerCase();
    const albumLower = (track.album || "").toLowerCase();

    // Check quoted phrases first (exact matches)
    for (const phrase of quotedPhrases) {
      if (titleLower.includes(phrase)) {
        score += 5;
        reasons.push(`title contains "${phrase}"`);
      }
      if (artistLower.includes(phrase)) {
        score += 3;
        reasons.push(`artist contains "${phrase}"`);
      }
    }

    // Check keywords against all fields
    for (const kw of keywords) {
      // Title match (highest weight)
      if (titleLower.includes(kw)) {
        score += 3;
        if (!reasons.some(r => r.includes("title"))) reasons.push(`title matches "${kw}"`);
      }
      // Artist match
      if (artistLower.includes(kw)) {
        score += 2;
        if (!reasons.some(r => r.includes("artist"))) reasons.push(`artist matches "${kw}"`);
      }
      // Genre match
      if (genreLower.includes(kw) || subgenreLower.includes(kw)) {
        score += 2;
        if (!reasons.some(r => r.includes("genre"))) reasons.push(`${genreLower.includes(kw) ? "genre" : "subgenre"} "${kw}"`);
      }
      // Mood match
      if (moodLower.includes(kw)) {
        score += 1;
        if (!reasons.some(r => r.includes("mood"))) reasons.push(`mood "${kw}"`);
      }
      // Language match
      if (languageLower.includes(kw)) {
        score += 1;
        if (!reasons.some(r => r.includes("language"))) reasons.push(`language "${kw}"`);
      }
    }

    // Semantic heuristics for common query patterns
    if (queryLower.includes("female") || queryLower.includes("woman")) {
      // Heuristic: check for common female artist indicators in name
      // This is a simple mock — in real mode LLM would handle this
      if (artistLower.match(/\b(she|her|miss|ms\.|mrs\.|lady|queen|girl)\b/)) {
        score += 2;
        reasons.push("female artist indicator");
      }
    }

    if (queryLower.includes("electro") || queryLower.includes("electronic")) {
      if (genreLower.includes("electro") || genreLower.includes("electronic") || subgenreLower.includes("electro")) {
        score += 2;
        reasons.push("electro/electronic genre match");
      }
    }

    if (queryLower.includes("pop")) {
      if (genreLower.includes("pop") || subgenreLower.includes("pop")) {
        score += 2;
        reasons.push("pop genre match");
      }
    }

    // "rapper" → hip-hop, rap genres
    if (queryLower.includes("rap")) {
      if (genreLower.includes("rap") || genreLower.includes("hip-hop") || genreLower.includes("hip hop")) {
        score += 3;
        reasons.push("rap/hip-hop genre match");
      }
    }

    if (score > 0) {
      matches.push({
        trackId: track.id,
        title: track.title || "Unknown",
        artist: track.artist || "Unknown",
        genre: track.genre,
        reason: reasons.join("; ") || "keyword match",
      });
    }
  }

  // Sort by score descending, limit to top 15
  matches.sort((a, b) => {
    const scoreA = a.reason.split("; ").length;
    const scoreB = b.reason.split("; ").length;
    return scoreB - scoreA;
  });

  const topMatches = matches.slice(0, 15);

  return {
    matches: topMatches,
    explanation: topMatches.length > 0
      ? `Found ${topMatches.length} tracks matching "${query}"`
      : `No tracks found matching "${query}". Try broader terms or check your library.`,
  };
}

// ─── AI Suggest Tracks (mock) ───

const MOCK_SUGGESTIONS_POOL = [
  { title: "Strobe", artist: "deadmau5", genre: "Progressive House" },
  { title: "Opus", artist: "Eric Prydz", genre: "Progressive House" },
  { title: "Sandstorm", artist: "Darude", genre: "Trance" },
  { title: "Levels", artist: "Avicii", genre: "Progressive House" },
  { title: "Titanium", artist: "David Guetta ft. Sia", genre: "Dance" },
  { title: "Animals", artist: "Martin Garrix", genre: "Big Room" },
  { title: "In The Air", artist: "Mord Fustang", genre: "Electro House" },
  { title: "Adieu", artist: "Tchami", genre: "Future House" },
  { title: "Cola", artist: "CamelPhat & Elderbrook", genre: "Deep House" },
  { title: "Losing It", artist: "FISHER", genre: "Tech House" },
  { title: "Goosebumps", artist: "HVME", genre: "Deep House" },
  { title: "Pursuit of Happiness", artist: "Kid Cudi (Steve Aoki Remix)", genre: "Electro" },
  { title: "Transmission", artist: "Eelke Kleijn", genre: "Melodic Techno" },
  { title: "Marea (We've Lost Dancing)", artist: "Fred again.. & The Blessed Madonna", genre: "House" },
  { title: "Innerbloom", artist: "RÜFÜS DU SOL", genre: "Deep House" },
  { title: "Gosh", artist: "Jamie xx", genre: "Electronic" },
  { title: "Hyperreal", artist: "Flume ft. Kučka", genre: "Future Bass" },
  { title: "Faded", artist: "ZHU", genre: "Deep House" },
  { title: "Miracle", artist: "Calvin Harris & Ellie Goulding", genre: "Trance" },
  { title: "Turn On The Lights again..", artist: "Fred again.. & Swedish House Mafia", genre: "House" },
];

function mockSuggestTracks(
  tracks: SearchableTrack[],
  count: number
): ExternalTrackSuggestion[] {
  // Analyze the playlist's genres and pick complementary suggestions
  const genreCounts: Record<string, number> = {};
  for (const t of tracks) {
    const g = (t.genre || "").toLowerCase();
    if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
  }

  // Pick top genres
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  // Find suggestions that match the top genres, or just random
  const relevant = MOCK_SUGGESTIONS_POOL.filter(s => {
    const sg = s.genre.toLowerCase();
    return topGenres.some(tg => sg.includes(tg) || tg.includes(sg));
  });

  const pool = relevant.length >= count ? relevant : [...relevant, ...MOCK_SUGGESTIONS_POOL];
  const shuffled = pool.sort(() => Math.random() - 0.5);

  return shuffled.slice(0, count).map(s => {
    const query = encodeURIComponent(`${s.artist} ${s.title}`);
    return {
      title: s.title,
      artist: s.artist,
      appleMusicUrl: `https://music.apple.com/search?term=${encodeURIComponent(s.artist + " " + s.title)}`,
      spotifyUrl: `https://open.spotify.com/search/${query}`,
      youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(s.artist + "+" + s.title)}`,
    };
  });
}

// ─── Real LLM implementations ───

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("No API key configured — use mock mode instead");
  }

  if (process.env.OPENAI_API_KEY) {
    // OpenAI-compatible API
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${err}`);
    }

    const json = await res.json() as { choices: { message: { content: string } }[] };
    return json.choices[0].message.content;
  }

  // Anthropic
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }

  const json = await res.json() as { content: { text: string }[] };
  return json.content[0].text;
}

export async function aiTagTrack(track: TrackMetadata): Promise<AITagResult> {
  if (!isConfigured()) {
    return mockAITag(track);
  }

  const systemPrompt = `You are a music metadata expert. Given a track's basic information, return hyper-specific tags as JSON.
Include only: genre, subgenre, mood, language, country, decade, chord_progression, beat_pattern.
Be specific and accurate. If unsure about a field, set it to null.
Return only valid JSON, no explanation.`;

  const userPrompt = `Analyze this track:
- Title: ${track.title || "Unknown"}
- Artist: ${track.artist || "Unknown"}
- Album: ${track.album || "Unknown"}
- Year: ${track.year || "Unknown"}
- Genre: ${track.genre || "Unknown"}
- BPM: ${track.bpm || "Unknown"}
- Key: ${track.musical_key || "Unknown"}

Return JSON:
{
  "genre": "refined genre or null",
  "subgenre": "specific subgenre or null",
  "mood": "mood descriptor or null",
  "language": "language or Instrumental/null",
  "country": "origin country or null",
  "decade": "like 2020s or null",
  "chord_progression": "like I-V-vi-IV or null",
  "beat_pattern": "like four-on-the-floor or null"
}`;

  const response = await callLLM(systemPrompt, userPrompt);
  try {
    const json = JSON.parse(response.trim().replace(/^```json\s*/, "").replace(/```\s*$/, ""));
    return {
      genre: json.genre || null,
      subgenre: json.subgenre || null,
      mood: json.mood || null,
      language: json.language || null,
      country: json.country || null,
      decade: json.decade || null,
      chord_progression: json.chord_progression || null,
      beat_pattern: json.beat_pattern || null,
    };
  } catch {
    // If parsing fails, fall back to mock
    console.warn("Failed to parse LLM response, falling back to mock:", response.slice(0, 200));
    return mockAITag(track);
  }
}

export async function aiGeneratePlaylist(
  prompt: string,
  library: LibrarySummary
): Promise<AIPlaylistResult> {
  if (!isConfigured()) {
    return mockAIPlaylist(prompt, library);
  }

  const systemPrompt = `You are a DJ playlist curator. Given a user's natural-language prompt and a summary of their music library, suggest a playlist.
Return JSON with: name (string), description (string), genreFilters (array of genre strings to match in library), bpmRange ({min,max} or null), keyPreferences (array of preferred keys, or empty), and externalSuggestions (array of {title, artist, appleMusicUrl, spotifyUrl, youtubeUrl} for tracks the user might not have).
Return only valid JSON, no explanation.`;

  const userPrompt = `User prompt: "${prompt}"

Library summary:
- Total tracks: ${library.totalTracks}
- Top genres: ${library.topGenres.join(", ") || "none"}
- Top artists: ${library.topArtists.join(", ") || "none"}
- BPM range: ${library.bpmRange ? `${library.bpmRange.min} to ${library.bpmRange.max}` : "unknown"}
- Keys available: ${library.keys.join(", ") || "unknown"}

Return JSON:
{
  "name": "playlist name",
  "description": "short description",
  "genreFilters": ["genre1", "genre2"],
  "bpmRange": {"min": 120, "max": 130} or null,
  "keyPreferences": ["Am", "Cm"],
  "externalSuggestions": [{"title":"...", "artist":"...", "appleMusicUrl":"...", "spotifyUrl":"...", "youtubeUrl":"..."}]
}`;

  const response = await callLLM(systemPrompt, userPrompt);
  try {
    const json = JSON.parse(response.trim().replace(/^```json\s*/, "").replace(/```\s*$/, ""));
    return {
      name: json.name || "AI Generated Playlist",
      description: json.description || "",
      trackIds: [], // filled by handler
      externalSuggestions: (json.externalSuggestions || []).map((s: Record<string, string>) => ({
        title: s.title || "Unknown",
        artist: s.artist || "Unknown",
        appleMusicUrl: s.appleMusicUrl || `https://music.apple.com/search?term=${encodeURIComponent(s.title || "")}`,
        spotifyUrl: s.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(s.title || "")}`,
        youtubeUrl: s.youtubeUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent((s.title || "") + " " + (s.artist || ""))}`,
      })),
    };
  } catch {
    console.warn("Failed to parse LLM response, falling back to mock:", response.slice(0, 200));
    return mockAIPlaylist(prompt, library);
  }
}

// ─── Exported: AI Library Search ───

export async function aiSearchLibrary(
  query: string,
  tracks: SearchableTrack[]
): Promise<SearchResults> {
  if (!isConfigured()) {
    return mockSearchLibrary(query, tracks);
  }

  const systemPrompt = `You are a music search engine. Given a natural language query and a list of tracks, find the most relevant matches.
The query might describe a sound ("female rapper with electro pop feel"), lyrics ("that song that goes 'we found love'"), or genre/mood combinations.
Return JSON with: matches (array of {trackId: number, reason: string}) and explanation (string summarizing results).
Only include tracks that genuinely match. Return only valid JSON, no explanation.`;

  const trackSummaries = tracks.map(t =>
    `[${t.id}] ${t.title || "?"} - ${t.artist || "?"} (genre: ${t.genre || "?"}, subgenre: ${t.subgenre || "?"}, mood: ${t.mood || "?"}, language: ${t.language || "?"})`
  ).join("\n");

  const userPrompt = `Query: "${query}"

Library tracks:
${trackSummaries}

Return JSON:
{
  "matches": [{"trackId": number, "reason": "why this matches"}],
  "explanation": "summary of results"
}`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    const json = JSON.parse(response.trim().replace(/^```json\s*/, "").replace(/```\s*$/, ""));
    const matches: SearchResult[] = (json.matches || []).map((m: { trackId: number; reason: string }) => {
      const track = tracks.find(t => t.id === m.trackId);
      return {
        trackId: m.trackId,
        title: track?.title || "Unknown",
        artist: track?.artist || "Unknown",
        genre: track?.genre || null,
        reason: m.reason || "LLM match",
      };
    });
    return {
      matches: matches.slice(0, 15),
      explanation: json.explanation || `Found ${matches.length} matches for "${query}"`,
    };
  } catch {
    console.warn("LLM search failed, falling back to mock");
    return mockSearchLibrary(query, tracks);
  }
}

// ─── Export: Discover Artists ───

export interface DiscoveredArtist {
  name: string;
  genres: string[];
  similarity: number;
  reason: string;
}

// Mock similarity maps — maps artist name (lowercase) to related artists
const DISCOVER_MAP: Record<string, DiscoveredArtist[]> = {
  "daft punk": [
    { name: "Justice", genres: ["French House", "Electro"], similarity: 92, reason: "French touch pioneers with similar filtered disco sound" },
    { name: "Kavinsky", genres: ["Synthwave", "Electro"], similarity: 85, reason: "French electro artist with cinematic synth-driven production" },
    { name: "Gesaffelstein", genres: ["Industrial Techno", "Dark Electro"], similarity: 78, reason: "Dark, driving French electronic with heavy beats" },
    { name: "SebastiAn", genres: ["Electro House", "French Electro"], similarity: 82, reason: "Edits and remixes pioneer, same French electro scene" },
    { name: "Breakbot", genres: ["Nu Disco", "French House"], similarity: 80, reason: "Funk-driven French house with disco influences" },
    { name: "Cassius", genres: ["French House", "Dance"], similarity: 88, reason: "Foundational French touch act, filtered house sound" },
    { name: "Alan Braxe", genres: ["French House", "Disco"], similarity: 84, reason: "French house producer with similar filtered disco aesthetic" },
    { name: "Busy P", genres: ["French Electro", "Ed Banger"], similarity: 76, reason: "Ed Banger label founder, managed Daft Punk" },
    { name: "Mr. Oizo", genres: ["Experimental Electro", "French House"], similarity: 70, reason: "Fellow Ed Banger artist, quirky electronic production" },
    { name: "Modjo", genres: ["French House", "Nu Disco"], similarity: 75, reason: "Classic French touch sound with guitar-driven house" },
  ],
  "justice": [
    { name: "Daft Punk", genres: ["French House", "Electronic"], similarity: 92, reason: "French touch pioneers, major influence on Justice's sound" },
    { name: "SebastiAn", genres: ["Electro House", "French Electro"], similarity: 90, reason: "Ed Banger labelmate, similarly distorted electro sound" },
    { name: "Gesaffelstein", genres: ["Industrial Techno", "Dark Electro"], similarity: 83, reason: "Dark, aggressive electronic production style" },
    { name: "Boys Noize", genres: ["Electro", "Techno"], similarity: 78, reason: "Heavy electro production with rock-influenced edge" },
    { name: "Digitalism", genres: ["Electro House", "Indie Dance"], similarity: 75, reason: "Similar crossover between electro and indie dance" },
    { name: "Soulwax", genres: ["Electronic", "Rock"], similarity: 74, reason: "Rock-meets-electronic crossover, similar energetic style" },
    { name: "Mr. Oizo", genres: ["Experimental Electro", "French House"], similarity: 77, reason: "Ed Banger labelmate, experimental electro approach" },
    { name: "Kavinsky", genres: ["Synthwave", "Electro"], similarity: 72, reason: "French electro, retro synth-driven sound" },
  ],
  "deadmau5": [
    { name: "Eric Prydz", genres: ["Progressive House", "Tech House"], similarity: 88, reason: "Master of progressive house melodies and big buildups" },
    { name: "Wolfgang Gartner", genres: ["Electro House", "Complextro"], similarity: 82, reason: "Complex electro house production, similar energy" },
    { name: "Kaskade", genres: ["Progressive House", "Vocal House"], similarity: 80, reason: "Collaborated frequently, complementary melodic house style" },
    { name: "Feed Me", genres: ["Electro House", "Dubstep"], similarity: 78, reason: "Detailed, technical electronic production" },
    { name: "Mord Fustang", genres: ["Electro House", "Complextro"], similarity: 76, reason: "Intricate electro/complextro sound from similar era" },
    { name: "Pryda", genres: ["Progressive House", "Melodic Techno"], similarity: 85, reason: "Eric Prydz alias, epic progressive journeys" },
    { name: "Skrillex", genres: ["Dubstep", "Electronic"], similarity: 65, reason: "Collaborated on production, different genre but shared audience" },
    { name: "Madeon", genres: ["Electro Pop", "Nu Disco"], similarity: 70, reason: "Detailed melodic production with pop sensibilities" },
  ],
  "aphex twin": [
    { name: "Boards of Canada", genres: ["IDM", "Ambient"], similarity: 88, reason: "Warp labelmate, iconic IDM with nostalgic textures" },
    { name: "Squarepusher", genres: ["IDM", "Drum and Bass"], similarity: 85, reason: "Experimental electronic, genre-bending with complex rhythms" },
    { name: "Autechre", genres: ["IDM", "Experimental"], similarity: 82, reason: "Abstract electronic experimentation from same era" },
    { name: "μ-Ziq", genres: ["IDM", "Breakbeat"], similarity: 78, reason: "Warp/Planet Mu artist, playful IDM experimentation" },
    { name: "Plaid", genres: ["IDM", "Downtempo"], similarity: 75, reason: "Melodic IDM with intricate programming" },
    { name: "Flying Lotus", genres: ["Experimental", "Hip-Hop"], similarity: 70, reason: "Genre-bending electronic with jazz and hip-hop influences" },
    { name: "Venetian Snares", genres: ["Breakcore", "IDM"], similarity: 72, reason: "Complex rhythmic experimentation in electronic music" },
    { name: "Four Tet", genres: ["Electronic", "Folktronica"], similarity: 66, reason: "Eclectic electronic approach with organic textures" },
  ],
  "burial": [
    { name: "Four Tet", genres: ["Electronic", "Folktronica"], similarity: 82, reason: "Collaborated with Burial, similar atmospheric textures" },
    { name: "Mount Kimbie", genres: ["Post-Dubstep", "Electronic"], similarity: 80, reason: "Atmospheric UK bass music, similar moody aesthetic" },
    { name: "James Blake", genres: ["Post-Dubstep", "Soul"], similarity: 78, reason: "Minimal, atmospheric production with soulful elements" },
    { name: "Jamie xx", genres: ["Electronic", "UK Garage"], similarity: 76, reason: "Atmospheric UK electronic with garage influences" },
    { name: "The xx", genres: ["Indie", "Electronic"], similarity: 74, reason: "Minimal, atmospheric sound with similar emotional depth" },
    { name: "Zomby", genres: ["UK Garage", "Dubstep"], similarity: 73, reason: "Dark, atmospheric UK bass music" },
    { name: "Thom Yorke", genres: ["Electronic", "Alternative"], similarity: 65, reason: "Collaborated on tracks, similar melancholic electronic feel" },
    { name: "Massive Attack", genres: ["Trip-Hop", "Electronic"], similarity: 68, reason: "Dark, atmospheric urban soundscapes" },
  ],
  "flume": [
    { name: "What So Not", genres: ["Future Bass", "Trap"], similarity: 85, reason: "Former duo partner, shared future bass sound" },
    { name: "ODESZA", genres: ["Chillwave", "Future Bass"], similarity: 82, reason: "Lush, melodic electronic with vocal chops" },
    { name: "RÜFÜS DU SOL", genres: ["Deep House", "Alternative"], similarity: 78, reason: "Atmospheric electronic with emotive vocals" },
    { name: "Porter Robinson", genres: ["Electro Pop", "Synthpop"], similarity: 76, reason: "Detailed electronic production with emotional depth" },
    { name: "Cashmere Cat", genres: ["Future Bass", "R&B"], similarity: 80, reason: "Glitchy future bass with pop sensibilities" },
    { name: "Mura Masa", genres: ["Electronic", "Pop"], similarity: 77, reason: "Genre-blending electronic pop production" },
    { name: "Alison Wonderland", genres: ["Future Bass", "Trap"], similarity: 74, reason: "Fellow Australian electronic artist, similar audience" },
    { name: "Quiet Bison", genres: ["Future Bass", "Experimental"], similarity: 72, reason: "Directly inspired by Flume's production style" },
  ],
  "carl cox": [
    { name: "Adam Beyer", genres: ["Techno", "Peak Time"], similarity: 85, reason: "Driving, peak-time techno with groove" },
    { name: "Sven Väth", genres: ["Techno", "Minimal"], similarity: 82, reason: "Techno pioneer with eclectic, journey-driven sets" },
    { name: "Richie Hawtin", genres: ["Minimal Techno", "Techno"], similarity: 80, reason: "Innovative techno with minimal aesthetics" },
    { name: "Nicole Moudaber", genres: ["Techno", "Tech House"], similarity: 78, reason: "Dark, driving techno and tech house" },
    { name: "Joseph Capriati", genres: ["Techno", "Tech House"], similarity: 76, reason: "Modern techno sound with Italian groove" },
    { name: "Loco Dice", genres: ["Tech House", "Techno"], similarity: 74, reason: "Groovy tech house and techno selections" },
    { name: "Marco Carola", genres: ["Tech House", "Minimal"], similarity: 75, reason: "Long-running techno/house DJ with Rolling Stone party" },
    { name: "Charlotte de Witte", genres: ["Techno", "Acid"], similarity: 70, reason: "Modern peak-time techno with acid influences" },
  ],
  "bad bunny": [
    { name: "J Balvin", genres: ["Reggaeton", "Latin Pop"], similarity: 88, reason: "Global Latin trap/reggaeton star" },
    { name: "Rauw Alejandro", genres: ["Reggaeton", "Latin Pop"], similarity: 84, reason: "Contemporary reggaeton with R&B influences" },
    { name: "Ozuna", genres: ["Reggaeton", "Latin Trap"], similarity: 82, reason: "Latin trap/reggaeton crossover success" },
    { name: "Jhayco", genres: ["Reggaeton", "Latin Trap"], similarity: 80, reason: "Frequent collaborator, similar Latin trap sound" },
    { name: "Anuel AA", genres: ["Latin Trap", "Reggaeton"], similarity: 78, reason: "Latin trap pioneer, similar street aesthetic" },
    { name: "Sech", genres: ["Reggaeton", "Latin"], similarity: 76, reason: "Panamanian reggaeton with romantic style" },
    { name: "Karol G", genres: ["Reggaeton", "Latin Pop"], similarity: 75, reason: "Leading female voice in Latin urban music" },
    { name: "Myke Towers", genres: ["Latin Trap", "Reggaeton"], similarity: 74, reason: "Lyrical Latin trap artist, frequent collaborator" },
  ],
  "chemical brothers": [
    { name: "The Prodigy", genres: ["Big Beat", "Electronic"], similarity: 90, reason: "Big beat pioneer, explosive electronic energy" },
    { name: "Fatboy Slim", genres: ["Big Beat", "House"], similarity: 88, reason: "Big beat legend, sample-heavy dance music" },
    { name: "The Crystal Method", genres: ["Big Beat", "Electronic"], similarity: 84, reason: "American big beat duo, similar 90s electronic sound" },
    { name: "Orbital", genres: ["Techno", "Electronic"], similarity: 80, reason: "Classic UK electronic duo with melodic sensibility" },
    { name: "Underworld", genres: ["Progressive House", "Techno"], similarity: 78, reason: "UK electronic pioneers, epic live performances" },
    { name: "Basement Jaxx", genres: ["House", "UK Garage"], similarity: 76, reason: "Fun, genre-blending house music duo" },
    { name: "Leftfield", genres: ["Progressive House", "Electronic"], similarity: 75, reason: "Deep, bass-heavy UK electronic from same era" },
    { name: "Groove Armada", genres: ["House", "Downtempo"], similarity: 72, reason: "Eclectic UK electronic duo, similar crossover appeal" },
  ],
};

// Default fallback artists when no specific map exists
const DEFAULT_DISCOVER: DiscoveredArtist[] = [
  { name: "Similar Artist A", genres: ["Electronic", "Dance"], similarity: 75, reason: "Genre overlap — similar style and production approach" },
  { name: "Similar Artist B", genres: ["Electronic", "Dance"], similarity: 70, reason: "Genre overlap — shared audience and scene" },
  { name: "Similar Artist C", genres: ["Electronic", "Dance"], similarity: 65, reason: "Genre overlap — related subgenre" },
  { name: "Similar Artist D", genres: ["Electronic", "Dance"], similarity: 60, reason: "Genre overlap — similar era" },
  { name: "Similar Artist E", genres: ["Electronic", "Dance"], similarity: 55, reason: "Genre overlap — related influences" },
  { name: "Similar Artist F", genres: ["Electronic", "Dance"], similarity: 50, reason: "Genre overlap — overlapping fanbase" },
  { name: "Similar Artist G", genres: ["Electronic", "Dance"], similarity: 45, reason: "Genre overlap — tangentially related" },
  { name: "Similar Artist H", genres: ["Electronic", "Dance"], similarity: 40, reason: "Genre overlap — same broader genre family" },
];

export async function aiDiscoverArtists(artist: string): Promise<DiscoveredArtist[]> {
  const query = artist.toLowerCase().trim();

  // Check for exact match first
  if (DISCOVER_MAP[query]) {
    return DISCOVER_MAP[query];
  }

  // Check partial matches
  for (const [key, artists] of Object.entries(DISCOVER_MAP)) {
    if (key.includes(query) || query.includes(key)) {
      return artists;
    }
  }

  // For LLM-configured mode, use the real API
  if (isConfigured()) {
    try {
      const systemPrompt = `You are a music discovery expert. Given an artist name, return a list of related artists with genres, a similarity score (0-100), and a reason why they are similar.
Return only valid JSON, no explanation.`;
      const userPrompt = `Artist: "${artist}"
Return JSON:
{
  "artists": [
    {"name": "Related Artist", "genres": ["Genre1", "Genre2"], "similarity": 85, "reason": "Short reason they are similar"}
  ]
}
Include 8 artists. Order by similarity descending.`;
      const response = await callLLM(systemPrompt, userPrompt);
      const json = JSON.parse(response.trim().replace(/^```json\s*/, "").replace(/```\s*$/, ""));
      return json.artists || [];
    } catch (err) {
      console.warn("LLM discover failed, falling back to default:", err);
    }
  }

  // Fallback: return default set but rename with the query context
  return DEFAULT_DISCOVER.map((a, i) => ({
    ...a,
    name: `${artist} (Related ${i + 1})`,
    reason: `May be similar to ${artist} in style or genre`,
  }));
}

// ─── Exported: AI Suggest Tracks ───

export async function aiSuggestTracks(
  tracks: SearchableTrack[],
  count: number = 6
): Promise<ExternalTrackSuggestion[]> {
  if (!isConfigured()) {
    return mockSuggestTracks(tracks, count);
  }

  const systemPrompt = `You are a DJ music recommender. Given a playlist's tracks, suggest ${count} complementary tracks the user might not have.
Return an array of external track suggestions with title, artist, and streaming URLs.
Use these URL patterns:
- Apple Music: https://music.apple.com/search?term={artist}+{title}
- Spotify: https://open.spotify.com/search/{artist}%20{title}
- YouTube: https://www.youtube.com/results?search_query={artist}+{title}
Return only valid JSON, no explanation.`;

  const trackSummaries = tracks.map(t =>
    `- ${t.title || "?"} by ${t.artist || "?"} [genre: ${t.genre || "?"}]`
  ).join("\n");

  const userPrompt = `Playlist tracks:
${trackSummaries}

Suggest ${count} complementary tracks. Return JSON:
{
  "suggestions": [{"title": "...", "artist": "...", "appleMusicUrl": "...", "spotifyUrl": "...", "youtubeUrl": "..."}]
}`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    const json = JSON.parse(response.trim().replace(/^```json\s*/, "").replace(/```\s*$/, ""));
    return (json.suggestions || []).map((s: Record<string, string>) => ({
      title: s.title || "Unknown",
      artist: s.artist || "Unknown",
      appleMusicUrl: s.appleMusicUrl || `https://music.apple.com/search?term=${encodeURIComponent((s.artist || "") + " " + (s.title || ""))}`,
      spotifyUrl: s.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent((s.artist || "") + " " + (s.title || ""))}`,
      youtubeUrl: s.youtubeUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent((s.artist || "") + "+" + (s.title || ""))}`,
    }));
  } catch {
    console.warn("LLM suggestions failed, falling back to mock");
    return mockSuggestTracks(tracks, count);
  }
}
