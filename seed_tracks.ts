import { getDb } from "./server/db";

const db = getDb();

const tracks = [
  { filename: "deep_house_groove.mp3", title: "Deep House Groove", artist: "DJ Pulse", album: "Warm Up Sessions", genre: "Deep House", bpm: 122, key: "8A", duration: 360, file_path: "/data/uploads/1/deep_house_groove.mp3", file_size: 15000000, mime_type: "audio/mpeg", energy: 6 },
  { filename: "sunset_rhythm.mp3", title: "Sunset Rhythm", artist: "Solar Waves", album: "Island Vibes", genre: "Deep House", bpm: 124, key: "5A", duration: 420, file_path: "/data/uploads/1/sunset_rhythm.mp3", file_size: 16000000, mime_type: "audio/mpeg", energy: 7 },
  { filename: "basement_vibes.mp3", title: "Basement Vibes", artist: "Underground Collective", album: "Late Night Sessions", genre: "House", bpm: 126, key: "3A", duration: 380, file_path: "/data/uploads/1/basement_vibes.mp3", file_size: 14000000, mime_type: "audio/mpeg", energy: 8 },
  { filename: "ocean_drive.mp3", title: "Ocean Drive", artist: "Coastal Beats", album: "Summer Mix 2025", genre: "Deep House", bpm: 123, key: "6A", duration: 340, file_path: "/data/uploads/1/ocean_drive.mp3", file_size: 13000000, mime_type: "audio/mpeg", energy: 5 },
  { filename: "warehouse_jack.mp3", title: "Warehouse Jack", artist: "Jack Trax", album: "Raw Cuts Vol 3", genre: "House", bpm: 128, key: "1A", duration: 400, file_path: "/data/uploads/1/warehouse_jack.mp3", file_size: 17000000, mime_type: "audio/mpeg", energy: 9 },
  { filename: "morning_dew.mp3", title: "Morning Dew", artist: "Ambient Souls", album: "Dawn Breaks", genre: "Deep House", bpm: 120, key: "7A", duration: 450, file_path: "/data/uploads/1/morning_dew.mp3", file_size: 18000000, mime_type: "audio/mpeg", energy: 4 },
  { filename: "club_night.mp3", title: "Club Night", artist: "Neon Lights", album: "After Dark", genre: "House", bpm: 130, key: "2A", duration: 320, file_path: "/data/uploads/1/club_night.mp3", file_size: 12000000, mime_type: "audio/mpeg", energy: 9 },
  { filename: "chill_lounge.mp3", title: "Chill Lounge", artist: "Velvet Sofa", album: "Lounge Sessions", genre: "Deep House", bpm: 118, key: "4A", duration: 480, file_path: "/data/uploads/1/chill_lounge.mp3", file_size: 19000000, mime_type: "audio/mpeg", energy: 3 },
];

for (const t of tracks) {
  db.run(
    "INSERT INTO tracks (user_id, filename, title, artist, album, genre, bpm, key, duration, file_path, file_size, mime_type, energy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [1, t.filename, t.title, t.artist, t.album, t.genre, t.bpm, t.key, t.duration, t.file_path, t.file_size, t.mime_type, t.energy]
  );
  console.log(`Inserted: ${t.title}`);
}

console.log("Done seeding tracks!");
