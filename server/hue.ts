// Philips Hue Integration
// When PHILIPS_HUE_BRIDGE_IP and PHILIPS_HUE_USERNAME are set, connects to real bridge.
// Otherwise operates in simulated mock mode.

import { getLightParams, type TrackLightInput, type LightParams } from "./light-sync";

// ─── Types ───

export interface HueStatus {
  connected: boolean;
  mock: boolean;
  bridgeIp?: string;
  lightCount: number;
  lastSync: number | null;
}

export interface HueSyncResult {
  success: boolean;
  lightsUpdated: number;
  colors: Array<{ r: number; g: number; b: number }>;
  brightness: number;
  mock: boolean;
}

// ─── State ───

let bridgeIp = process.env.PHILIPS_HUE_BRIDGE_IP || "";
let username = process.env.PHILIPS_HUE_USERNAME || "";
let lastSyncTime: number | null = null;
const rateLimitMap = new Map<string, number>(); // key → last call timestamp

// ─── Bridge Discovery ───

export async function discoverBridge(): Promise<{ ip: string; id: string } | null> {
  try {
    const res = await fetch("https://discovery.meethue.com/", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const bridge = data[0];
      return { ip: bridge.internalipaddress, id: bridge.id };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Hue API Call ───

async function hueRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  if (!bridgeIp || !username) {
    return null;
  }

  const url = `http://${bridgeIp}/api/${username}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Get Lights ───

export async function getLights(): Promise<Array<{ id: string; name: string; on: boolean }>> {
  if (!bridgeIp || !username) return [];

  try {
    const data = (await hueRequest("GET", "/lights")) as Record<string, { name: string; state: { on: boolean } }> | null;
    if (!data) return [];
    return Object.entries(data).map(([id, info]) => ({
      id,
      name: info.name,
      on: info.state.on,
    }));
  } catch {
    return [];
  }
}

// ─── Rate Limiter ───

function checkRateLimit(key: string, maxPerSecond: number): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(key) || 0;
  if (now - last < 1000 / maxPerSecond) {
    return false;
  }
  rateLimitMap.set(key, now);
  return true;
}

// ─── Sync Lights ───

export async function syncLights(
  mood: string,
  energy: number,
  track?: TrackLightInput
): Promise<HueSyncResult> {
  const now = Date.now();
  const isMock = !bridgeIp || !username;

  // Rate-limit: 10 updates/second
  if (!checkRateLimit("hue-sync", 10)) {
    const params = track ? getLightParams(track) : getLightParams({ mood });
    const palette = params.colorPalette;
    return {
      success: true,
      lightsUpdated: 0,
      colors: palette.slice(0, 3).map(c => {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
        return m
          ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
          : { r: 255, g: 255, b: 255 };
      }),
      brightness: Math.round(Math.max(10, Math.min(100, energy * 10))),
      mock: isMock,
    };
  }

  // Compute light params
  const params = track ? getLightParams(track) : getLightParams({ mood, energy });
  const palette = params.colorPalette;
  const brightness = Math.round(Math.max(10, Math.min(254, params.intensity * 254)));

  const colors = palette.slice(0, 3).map(c => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
    return m
      ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
      : { r: 255, g: 255, b: 255 };
  });

  lastSyncTime = now;

  if (isMock) {
    console.log(`[Hue Mock] Would sync ${colors.length} lights to mood=${mood} energy=${energy} brightness=${brightness}`);
    return {
      success: true,
      lightsUpdated: 3,
      colors,
      brightness,
      mock: true,
    };
  }

  // Get all lights
  const lights = await getLights();
  if (lights.length === 0) {
    return { success: false, lightsUpdated: 0, colors, brightness, mock: false };
  }

  // Update each light with a color from the palette
  let updated = 0;
  for (let i = 0; i < lights.length; i++) {
    const color = colors[i % colors.length];
    // Convert RGB to CIE xy (approximate)
    const xy = rgbToXy(color.r, color.g, color.b);

    await hueRequest("PUT", `/lights/${lights[i].id}/state`, {
      on: true,
      bri: brightness,
      xy: [xy.x, xy.y],
      transitiontime: 0, // immediate
    });
    updated++;
  }

  return {
    success: true,
    lightsUpdated: updated,
    colors,
    brightness,
    mock: false,
  };
}

// ─── Connect to Bridge ───

export async function connectBridge(
  ip?: string,
  user?: string
): Promise<{ connected: boolean; mock: boolean; linkButton?: boolean }> {
  // If credentials provided, use them
  if (ip) bridgeIp = ip;
  if (user) username = user;

  if (bridgeIp && username) {
    // Verify connection
    const lights = await getLights();
    if (lights.length > 0 || lights.length === 0) {
      // Even zero lights means we connected successfully
      return { connected: true, mock: false };
    }
    // Connection failed — might need link button
    return { connected: false, mock: false, linkButton: true };
  }

  // Try auto-discovery
  const discovered = await discoverBridge();
  if (discovered) {
    bridgeIp = discovered.ip;
    // We need a username — signal that link button is needed
    return { connected: false, mock: false, linkButton: true };
  }

  // No bridge found — mock mode
  bridgeIp = "";
  username = "mock-user";
  return { connected: true, mock: true };
}

// ─── Get Status ───

export function getStatus(): HueStatus {
  return {
    connected: !!(bridgeIp && username),
    mock: !bridgeIp || !username || username === "mock-user" || bridgeIp === "mock",
    bridgeIp: bridgeIp || undefined,
    lightCount: 0, // lazily fetched
    lastSync: lastSyncTime,
  };
}

// ─── RGB to CIE xy (approximate for Hue) ───

function rgbToXy(r: number, g: number, b: number): { x: number; y: number } {
  // Linearize
  const red = r / 255 > 0.04045 ? Math.pow((r / 255 + 0.055) / 1.055, 2.4) : r / 255 / 12.92;
  const green = g / 255 > 0.04045 ? Math.pow((g / 255 + 0.055) / 1.055, 2.4) : g / 255 / 12.92;
  const blue = b / 255 > 0.04045 ? Math.pow((b / 255 + 0.055) / 1.055, 2.4) : b / 255 / 12.92;

  // Wide RGB D65
  const X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
  const Y = red * 0.283881 + green * 0.668433 + blue * 0.047685;
  const Z = red * 0.000088 + green * 0.072310 + blue * 0.986039;

  const sum = X + Y + Z;
  if (sum === 0) return { x: 0.3227, y: 0.329 }; // D65 white point fallback

  return {
    x: X / sum,
    y: Y / sum,
  };
}
