import { getDb } from "./db";

export interface DailyChallenge {
  type: string;
  prompt: string;
  description: string;
  date: string;
}

const CHALLENGE_POOLS = {
  trackOfTheDay: {
    type: "track_of_the_day",
    description: "Build a 3-track mix starting with a random track from your library",
    generate: (db: ReturnType<typeof getDb>): string | null => {
      const row = db.query(
        "SELECT title, artist FROM tracks ORDER BY RANDOM() LIMIT 1"
      ).get() as { title: string | null; artist: string | null } | undefined;
      if (!row) return null;
      const label = [row.artist, row.title].filter(Boolean).join(" - ") || "an unknown track";
      return `Build a 3-track mix starting with: ${label}`;
    },
  },
  mood: {
    type: "mood",
    description: "Create a 5-track set matching a mood",
    generate: (): string => {
      const moods = ["mellow", "high energy", "dark", "uplifting", "dreamy", "aggressive", "hypnotic", "euphoric"];
      const mood = moods[Math.floor(Math.random() * moods.length)];
      return `Create a 5-track ${mood} set`;
    },
  },
  genreWarmup: {
    type: "genre_warmup",
    description: "Create a genre warmup set",
    generate: (): string => {
      const genres = ["deep house", "techno", "lo-fi", "drum and bass", "trance", "disco", "funk", "ambient", "UK garage", "minimal"];
      const genre = genres[Math.floor(Math.random() * genres.length)];
      return `Create a ${genre} warmup set`;
    },
  },
  bpmChallenge: {
    type: "bpm_challenge",
    description: "Build a set with a specific BPM range",
    generate: (): string => {
      const starts = [70, 80, 90, 100, 110, 120];
      const start = starts[Math.floor(Math.random() * starts.length)];
      const end = start + 40;
      return `Build a set that starts at ${start} BPM and ends at ${end} BPM`;
    },
  },
  decade: {
    type: "decade",
    description: "Create a decade-themed classics set",
    generate: (): string => {
      const decades = ["70s", "80s", "90s", "00s", "2010s"];
      const decade = decades[Math.floor(Math.random() * decades.length)];
      return `Create a ${decade} classics set`;
    },
  },
  themed: {
    type: "themed",
    description: "Build a themed set",
    generate: (): string => {
      const themes = ["sunset", "sunrise", "after-hours", "peak-time", "warehouse", "rooftop", "beach", "road trip"];
      const theme = themes[Math.floor(Math.random() * themes.length)];
      return `Build a ${theme} set`;
    },
  },
};

const POOL_KEYS = Object.keys(CHALLENGE_POOLS) as (keyof typeof CHALLENGE_POOLS)[];

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function hashDateToPoolIndex(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = ((hash << 5) - hash) + dateKey.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % POOL_KEYS.length;
}

export function generateDailyChallenge(): DailyChallenge | null {
  const db = getDb();
  const dateKey = getDateKey();
  const poolIndex = hashDateToPoolIndex(dateKey);
  const poolKey = POOL_KEYS[poolIndex];
  const pool = CHALLENGE_POOLS[poolKey];

  const prompt = pool.generate(db as ReturnType<typeof getDb>);
  if (!prompt) {
    // Fallback to a non-library challenge
    const fallbackKeys = POOL_KEYS.filter(k => k !== "trackOfTheDay");
    const fallbackKey = fallbackKeys[Math.floor(Math.random() * fallbackKeys.length)];
    const fallbackPool = CHALLENGE_POOLS[fallbackKey];
    return {
      type: fallbackPool.type,
      prompt: fallbackPool.generate(db as ReturnType<typeof getDb>) || "Create a 3-track mix",
      description: fallbackPool.description,
      date: dateKey,
    };
  }

  return {
    type: pool.type,
    prompt,
    description: pool.description,
    date: dateKey,
  };
}

export function generateRandomChallenge(): DailyChallenge {
  const db = getDb();
  const poolKey = POOL_KEYS[Math.floor(Math.random() * POOL_KEYS.length)];
  const pool = CHALLENGE_POOLS[poolKey];
  const prompt = pool.generate(db as ReturnType<typeof getDb>);

  if (!prompt) {
    // Fallback
    const fallbackKeys = POOL_KEYS.filter(k => k !== "trackOfTheDay");
    const fallbackKey = fallbackKeys[Math.floor(Math.random() * fallbackKeys.length)];
    const fallbackPool = CHALLENGE_POOLS[fallbackKey];
    return {
      type: fallbackPool.type,
      prompt: fallbackPool.generate(db as ReturnType<typeof getDb>) || "Create a 3-track mix",
      description: fallbackPool.description,
      date: getDateKey(),
    };
  }

  return {
    type: pool.type,
    prompt,
    description: pool.description,
    date: getDateKey(),
  };
}
