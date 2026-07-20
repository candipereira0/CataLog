// Comprehensive genre database for CataLog
// Seeded from musicgenreslist.com-style categories with DJ-focused subgenres

export interface GenreNode {
  name: string;
  parent_id: string | null;
  subgenres: string[];
}

export const GENRES: GenreNode[] = [
  {
    name: "House",
    parent_id: null,
    subgenres: [
      "Deep House", "Tech House", "Progressive House", "Afro House",
      "Bass House", "Tropical House", "Future House", "Soulful House",
      "Funky House", "Jackin House", "Minimal House", "Melodic House",
      "Organic House", "Disco House", "Vocal House", "Acid House",
    ],
  },
  {
    name: "Techno",
    parent_id: null,
    subgenres: [
      "Minimal Techno", "Melodic Techno", "Industrial Techno", "Detroit Techno",
      "Dub Techno", "Peak Time Techno", "Raw Techno", "Hypnotic Techno",
      "Acid Techno", "Hard Techno", "Deep Techno", "Ambient Techno",
    ],
  },
  {
    name: "Trance",
    parent_id: null,
    subgenres: [
      "Uplifting Trance", "Progressive Trance", "Psytrance", "Vocal Trance",
      "Tech Trance", "Hard Trance", "Goa Trance", "Melodic Trance",
      "Euphoric Trance", "Dream Trance", "Deep Trance",
    ],
  },
  {
    name: "Drum & Bass",
    parent_id: null,
    subgenres: [
      "Liquid DnB", "Neurofunk", "Jungle", "Techstep",
      "Jump Up", "Darkstep", "Atmospheric DnB", "Dancefloor DnB",
      "Halftime", "Minimal DnB", "Ragga Jungle",
    ],
  },
  {
    name: "Hip-Hop",
    parent_id: null,
    subgenres: [
      "Trap", "Boom Bap", "Conscious Hip-Hop", "Gangsta Rap",
      "East Coast", "West Coast", "Southern Hip-Hop", "Drill",
      "Lo-Fi Hip-Hop", "Jazz Rap", "Instrumental Hip-Hop",
    ],
  },
  {
    name: "R&B",
    parent_id: null,
    subgenres: [
      "Contemporary R&B", "Neo-Soul", "Alternative R&B", "Quiet Storm",
      "Funk R&B", "Progressive R&B", "PBR&B", "New Jack Swing",
    ],
  },
  {
    name: "Pop",
    parent_id: null,
    subgenres: [
      "Synth Pop", "Electro Pop", "Dance Pop", "Indie Pop",
      "Art Pop", "Dream Pop", "Chamber Pop", "Power Pop",
      "Alt-Pop", "Hyperpop", "Bedroom Pop",
    ],
  },
  {
    name: "Rock",
    parent_id: null,
    subgenres: [
      "Alternative Rock", "Indie Rock", "Psychedelic Rock", "Progressive Rock",
      "Garage Rock", "Post-Rock", "Hard Rock", "Stoner Rock",
      "Math Rock", "Noise Rock", "Experimental Rock",
    ],
  },
  {
    name: "Jazz",
    parent_id: null,
    subgenres: [
      "Bebop", "Cool Jazz", "Modal Jazz", "Free Jazz",
      "Jazz Fusion", "Latin Jazz", "Smooth Jazz", "Acid Jazz",
      "Nu Jazz", "Electro Jazz", "Spiritual Jazz",
    ],
  },
  {
    name: "Blues",
    parent_id: null,
    subgenres: [
      "Delta Blues", "Chicago Blues", "Texas Blues", "Electric Blues",
      "Jump Blues", "Piedmont Blues", "Country Blues",
    ],
  },
  {
    name: "Funk",
    parent_id: null,
    subgenres: [
      "P-Funk", "Boogie", "G-Funk", "Funk Rock",
      "Afrobeat Funk", "Deep Funk", "Electro Funk", "Jazz Funk",
    ],
  },
  {
    name: "Soul",
    parent_id: null,
    subgenres: [
      "Motown", "Philly Soul", "Northern Soul", "Southern Soul",
      "Psychedelic Soul", "Blue-Eyed Soul", "Neo-Soul",
    ],
  },
  {
    name: "Disco",
    parent_id: null,
    subgenres: [
      "Italo Disco", "Nu Disco", "Space Disco", "Euro Disco",
      "Post-Disco", "Boogie Disco", "Cosmic Disco",
    ],
  },
  {
    name: "Reggae",
    parent_id: null,
    subgenres: [
      "Roots Reggae", "Dancehall", "Lover's Rock", "Rocksteady",
      "Ska", "Reggaeton", "Digital Dancehall", "Reggae Fusion",
    ],
  },
  {
    name: "Dub",
    parent_id: null,
    subgenres: [
      "Dub Techno", "Dubstep", "Ambient Dub", "Roots Dub",
      "Electronic Dub", "Psydub", "Steppers",
    ],
  },
  {
    name: "Ambient",
    parent_id: null,
    subgenres: [
      "Dark Ambient", "Drone", "Space Ambient", "New Age",
      "Ambient House", "Ambient Techno", "Cinematic Ambient",
    ],
  },
  {
    name: "Breakbeat",
    parent_id: null,
    subgenres: [
      "Big Beat", "Florida Breaks", "Funky Breaks", "Nu Skool Breaks",
      "Progressive Breaks", "Electro Breaks", "Chemical Breaks",
    ],
  },
  {
    name: "Garage",
    parent_id: null,
    subgenres: [
      "UK Garage", "2-Step Garage", "Speed Garage", "Future Garage",
      "Garage House", "Breakstep",
    ],
  },
  {
    name: "Dubstep",
    parent_id: null,
    subgenres: [
      "Brostep", "Deep Dubstep", "Riddim", "Melodic Dubstep",
      "Post-Dubstep", "Chillstep", "Dungeon Dubstep",
    ],
  },
  {
    name: "Trap",
    parent_id: null,
    subgenres: [
      "EDM Trap", "Hybrid Trap", "Future Bass", "Wave Trap",
      "Hard Trap", "Heaven Trap",
    ],
  },
  {
    name: "Latin",
    parent_id: null,
    subgenres: [
      "Salsa", "Bachata", "Merengue", "Cumbia",
      "Bossa Nova", "Samba", "Tango", "Latin Jazz",
      "Reggaeton", "Dembow", "Latin House", "Moombahton",
    ],
  },
  {
    name: "Afrobeat",
    parent_id: null,
    subgenres: [
      "Afrobeats", "Afro House", "Afro Tech", "Afro Pop",
      "Highlife", "Afro Fusion", "Amapiano", "Kwaito",
      "Afro-Cuban", "Gnawa",
    ],
  },
  {
    name: "K-Pop",
    parent_id: null,
    subgenres: [
      "K-R&B", "K-Hip-Hop", "K-Ballad", "K-EDM",
      "K-Indie", "K-Rock",
    ],
  },
  {
    name: "J-Pop",
    parent_id: null,
    subgenres: [
      "City Pop", "J-Rock", "Shibuya-Kei", "Anime Music",
      "J-Electro", "J-Rap", "J-Fusion",
    ],
  },
  {
    name: "Classical",
    parent_id: null,
    subgenres: [
      "Baroque", "Romantic", "Classical Era", "Modern Classical",
      "Minimalism", "Opera", "Chamber Music", "Symphonic",
      "Contemporary Classical", "Neo-Classical",
    ],
  },
  {
    name: "Folk",
    parent_id: null,
    subgenres: [
      "Indie Folk", "Americana", "Celtic Folk", "Nordic Folk",
      "Neo-Folk", "Folk Rock", "Psychedelic Folk", "World Folk",
    ],
  },
  {
    name: "Country",
    parent_id: null,
    subgenres: [
      "Classic Country", "Outlaw Country", "Country Pop", "Alt-Country",
      "Bluegrass", "Honky Tonk", "Americana", "Country Rock",
    ],
  },
  {
    name: "Metal",
    parent_id: null,
    subgenres: [
      "Heavy Metal", "Thrash Metal", "Death Metal", "Black Metal",
      "Progressive Metal", "Power Metal", "Doom Metal", "Nu Metal",
      "Metalcore", "Djent", "Industrial Metal", "Symphonic Metal",
    ],
  },
  {
    name: "Punk",
    parent_id: null,
    subgenres: [
      "Hardcore Punk", "Post-Punk", "Pop Punk", "Ska Punk",
      "Crust Punk", "Anarcho Punk", "Oi!", "Emo",
      "Punk Rock", "Garage Punk",
    ],
  },
  {
    name: "Indie",
    parent_id: null,
    subgenres: [
      "Indie Rock", "Indie Pop", "Indie Folk", "Lo-Fi Indie",
      "Shoegaze", "Twee Pop", "Slowcore", "Jangle Pop",
    ],
  },
  {
    name: "Electronic",
    parent_id: null,
    subgenres: [
      "IDM", "Chillwave", "Synthwave", "Vaporwave",
      "Glitch", "Trip-Hop", "Downtempo", "Electronica",
      "Experimental Electronic", "Witch House", "Footwork", "Juke",
    ],
  },
  {
    name: "Experimental",
    parent_id: null,
    subgenres: [
      "Avant-Garde", "Sound Collage", "Musique Concrète", "Industrial",
      "Noise", "Field Recording", "Plunderphonics", "Microsound",
    ],
  },

  // ─── Fusion Genres ───
  {
    name: "Hip House",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Alternative Hip-Hop",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Jazz House",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Tech Trance",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Disco House",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Afro Tech",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Latin Tech",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Deep Tech",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Melodic House & Techno",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Soulful House",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Funky House",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Indie Dance",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Nu Disco",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Electro Pop",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "Synth Pop",
    parent_id: null,
    subgenres: [],
  },
  {
    name: "G-Funk",
    parent_id: null,
    subgenres: [],
  },
];

// Flattened list: every genre + every subgenre as a unique string
// Subgenres are linked to their parent, fusion genres stand alone
let _flatList: string[] | null = null;
let _nameMap: Map<string, GenreNode> | null = null;
let _subgenreMap: Map<string, GenreNode> | null = null;

function buildCaches() {
  if (_flatList) return;

  _flatList = [];
  _nameMap = new Map();
  _subgenreMap = new Map();

  for (const g of GENRES) {
    _nameMap.set(g.name.toLowerCase(), g);
    _flatList.push(g.name);
    for (const sub of g.subgenres) {
      _nameMap.set(sub.toLowerCase(), g);
      _flatList.push(sub);
      // Map subgenre name to its parent genre node
      _subgenreMap.set(sub.toLowerCase(), g);
    }
  }
}

/** Find a genre node by name (case-insensitive) */
export function getGenre(name: string): GenreNode | undefined {
  buildCaches();
  return _nameMap!.get(name.toLowerCase());
}

/** Get all subgenres of a parent genre */
export function getSubgenres(parentName: string): string[] {
  buildCaches();
  const node = _nameMap!.get(parentName.toLowerCase());
  if (!node) {
    // Check if it's a subgenre itself
    const parent = _subgenreMap!.get(parentName.toLowerCase());
    return parent ? [parentName] : [];
  }
  return node.subgenres;
}

/** Get all genre names as a flat sorted list */
export function getAllGenres(): string[] {
  buildCaches();
  return [...new Set(_flatList!)].sort();
}

/** Search genres by case-insensitive substring match */
export function searchGenres(query: string): string[] {
  buildCaches();
  const q = query.toLowerCase();
  return _flatList!.filter(g => g.toLowerCase().includes(q));
}

/** Get full genre tree with parent-child structure */
export function getGenreHierarchy(): GenreNode[] {
  return GENRES.map(g => ({ ...g, subgenres: [...g.subgenres] }));
}

/** Check if a name is a parent (top-level) genre */
export function isParentGenre(name: string): boolean {
  buildCaches();
  const node = _nameMap!.get(name.toLowerCase());
  return node !== undefined && node.parent_id === null && node.subgenres.length > 0;
}

/** Get the parent genre name for a subgenre */
export function getParentGenre(subgenreName: string): string | undefined {
  buildCaches();
  const parent = _subgenreMap!.get(subgenreName.toLowerCase());
  return parent?.name;
}

/** Suggest fusion genres based on selected genre combination */
export function suggestFusionGenres(selected: string[]): string[] {
  if (selected.length < 2) return [];
  const lower = selected.map(s => s.toLowerCase());
  const fusions: string[] = [];

  // Define known fusion rules
  const fusionRules: Array<{ result: string; parents: string[] }> = [
    { result: "Hip House", parents: ["hip-hop", "house"] },
    { result: "Hip House", parents: ["house", "hip-hop"] },
    { result: "Alternative Hip-Hop", parents: ["alternative", "hip-hop"] },
    { result: "Jazz House", parents: ["jazz", "house"] },
    { result: "Tech Trance", parents: ["techno", "trance"] },
    { result: "Disco House", parents: ["disco", "house"] },
    { result: "Afro Tech", parents: ["afrobeat", "techno"] },
    { result: "Latin Tech", parents: ["latin", "techno"] },
    { result: "Deep Tech", parents: ["deep house", "techno"] },
    { result: "Deep Tech", parents: ["techno", "deep house"] },
    { result: "Melodic House & Techno", parents: ["melodic house", "melodic techno"] },
    { result: "Soulful House", parents: ["soul", "house"] },
    { result: "Funky House", parents: ["funk", "house"] },
    { result: "Indie Dance", parents: ["indie", "electronic"] },
    { result: "Indie Dance", parents: ["indie", "house"] },
    { result: "Nu Disco", parents: ["disco", "electronic"] },
    { result: "Nu Disco", parents: ["disco", "house"] },
    { result: "Electro Pop", parents: ["electronic", "pop"] },
    { result: "Synth Pop", parents: ["pop", "electronic"] },
    { result: "G-Funk", parents: ["funk", "hip-hop"] },
  ];

  for (const rule of fusionRules) {
    const allMatch = rule.parents.every(p =>
      lower.some(s => s === p || getParentGenre(s)?.toLowerCase() === p)
    );
    if (allMatch && !fusions.includes(rule.result) && !lower.includes(rule.result.toLowerCase())) {
      fusions.push(rule.result);
    }
  }

  return fusions;
}
