// DJ Software Export Generators: M3U, NML (Traktor), Rekordbox XML, Serato
import type { TrackRow } from "./db";

interface PlaylistExport {
  name: string;
  tracks: TrackRow[];
}

// ─── M3U ───
export function generateM3U(playlist: PlaylistExport): string {
  const lines = ["#EXTM3U"];
  for (const track of playlist.tracks) {
    const duration = track.duration_ms ? Math.round(track.duration_ms / 1000) : -1;
    const artist = track.artist || "Unknown Artist";
    const title = track.title || track.filename;
    lines.push(`#EXTINF:${duration},${artist} - ${title}`);
    lines.push(track.filepath);
  }
  return lines.join("\n");
}

// ─── NML (Traktor) ───
export function generateNML(playlist: PlaylistExport): string {
  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const now = new Date().toISOString();
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  lines.push('<NML VERSION="19">');
  lines.push("  <HEAD COMPANY=\"www.native-instruments.com\" PROGRAM=\"Traktor\"/>");
  lines.push("  <MUSICFOLDERS/>");

  // COLLECTION entries
  lines.push("  <COLLECTION ENTRIES=\"" + playlist.tracks.length + "\">");
  for (const track of playlist.tracks) {
    const title = escapeXml(track.title || track.filename);
    const artist = escapeXml(track.artist || "");
    const album = escapeXml(track.album || "");
    const genre = escapeXml(track.genre || "");
    const key = track.musical_key ? ` MUSICAL_KEY="${escapeXml(track.musical_key)}"` : "";
    const bpm = track.bpm ? ` BPM="${track.bpm}"` : "";
    const dur = track.duration_ms ? ` DURATION="${Math.round(track.duration_ms / 1000)}"` : "";
    lines.push(
      `    <ENTRY TITLE="${title}" ARTIST="${artist}"` +
      ` ALBUM="${album}" GENRE="${genre}"` +
      `${key}${bpm}${dur}>` +
      `      <LOCATION DIR="/:${escapeXml(track.filepath)}:" FILE="${escapeXml(track.filename)}"/>` +
      `    </ENTRY>`
    );
  }
  lines.push("  </COLLECTION>");

  // PLAYLISTS
  lines.push("  <PLAYLISTS>");
  const escapedName = escapeXml(playlist.name);
  lines.push(`    <NODE TYPE="PLAYLIST" NAME="${escapedName}">`);
  lines.push(`      <PLAYLIST ENTRIES="${playlist.tracks.length}" TYPE="LIST">`);
  for (const track of playlist.tracks) {
    const title = escapeXml(track.title || track.filename);
    const artist = escapeXml(track.artist || "");
    lines.push(`        <ENTRY PRIMARYKEY="Title">${title}</ENTRY>`);
  }
  lines.push("      </PLAYLIST>");
  lines.push("    </NODE>");
  lines.push("  </PLAYLISTS>");
  lines.push("</NML>");
  return lines.join("\n");
}

// ─── Rekordbox XML ───
export function generateRekordboxXML(playlist: PlaylistExport): string {
  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<DJ_PLAYLISTS Version="1.0.0">');

  // PRODUCT info
  lines.push('  <PRODUCT Name="CataLog" Version="1.0.0" Company="CataLog"/>');

  // COLLECTION
  lines.push(`  <COLLECTION Entries="${playlist.tracks.length}">`);
  for (let i = 0; i < playlist.tracks.length; i++) {
    const track = playlist.tracks[i];
    const title = escapeXml(track.title || track.filename);
    const artist = escapeXml(track.artist || "");
    const album = escapeXml(track.album || "");
    const genre = escapeXml(track.genre || "");
    const key = track.musical_key ? ` Tonality="${escapeXml(track.musical_key)}"` : "";
    const bpm = track.bpm ? ` AverageBpm="${Math.round(track.bpm * 100)}"` : "";
    const dur = track.duration_ms ? ` Duration="${Math.round(track.duration_ms / 1000)}"` : "";
    const year = track.year ? ` Year="${track.year}"` : "";
    lines.push(
      `    <TRACK TrackID="${i + 1}" Name="${title}" Artist="${artist}"` +
      ` Album="${album}" Genre="${genre}" Kind="MP3 File"` +
      `${key}${bpm}${dur}${year}/>`
    );
  }
  lines.push("  </COLLECTION>");

  // PLAYLISTS
  const escapedName = escapeXml(playlist.name);
  lines.push("  <PLAYLISTS>");
  lines.push(`    <NODE Type="0" Name="ROOT" Count="1">`);
  lines.push(`      <NODE Name="${escapedName}" Type="1" KeyType="0" Entries="${playlist.tracks.length}">`);
  for (let i = 0; i < playlist.tracks.length; i++) {
    lines.push(`        <TRACK Key="${i + 1}"/>`);
  }
  lines.push("      </NODE>");
  lines.push("    </NODE>");
  lines.push("  </PLAYLISTS>");
  lines.push("</DJ_PLAYLISTS>");
  return lines.join("\n");
}

// ─── Text Tracklist ───
export function generateTextTracklist(playlist: PlaylistExport): string {
  const lines = [`# ${playlist.name}`, ""];
  for (const track of playlist.tracks) {
    const artist = track.artist || "Unknown Artist";
    const title = track.title || track.filename;
    lines.push(`${artist} - ${title}`);
  }
  return lines.join("\n");
}

// ─── Serato Subcrate (text-based export) ───
export function generateSeratoCrate(playlist: PlaylistExport): string {
  // Serato crate format: vrsn header + otrk entries
  const lines = ["vrsn", "1.0", ""];
  lines.push("osrt", `"${playlist.name}"`, "");
  for (const track of playlist.tracks) {
    const artist = track.artist || "";
    const title = track.title || track.filename;
    lines.push("otrk", `"${artist}\t${title}"`);
  }
  return lines.join("\n");
}

// ─── Format helpers ───
export type ExportFormat = "m3u" | "nml" | "rekordbox" | "serato" | "text";

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  m3u: "audio/x-mpegurl",
  nml: "application/xml",
  rekordbox: "application/xml",
  serato: "text/plain",
  text: "text/plain",
};

export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  m3u: ".m3u",
  nml: ".nml",
  rekordbox: ".xml",
  serato: ".crate",
  text: ".txt",
};

export function generateExport(playlist: PlaylistExport, format: ExportFormat): string {
  switch (format) {
    case "m3u": return generateM3U(playlist);
    case "nml": return generateNML(playlist);
    case "rekordbox": return generateRekordboxXML(playlist);
    case "serato": return generateSeratoCrate(playlist);
    case "text": return generateTextTracklist(playlist);
    default: throw new Error(`Unknown format: ${format}`);
  }
}
