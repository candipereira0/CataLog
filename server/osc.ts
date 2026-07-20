// OSC over WebSocket — Light control message streaming
// Clients connect at /ws/osc and receive light control messages in a simple JSON-wrapped OSC format.
// Compatible with QLC+, Lightkey, Resolume (via bridge or direct WebSocket).

import type { ServerWebSocket } from "bun";
import { getLightParams, getOscMessages, type TrackLightInput, type OscLightMessage } from "./light-sync";

// ─── Types ───

export interface OscClient {
  ws: ServerWebSocket<{ type: "osc" }>;
  subscribed: boolean;
  lastBeatTime: number;
}

// ─── OSC Message Formatter (binary format) ───

function align4(n: number): number {
  return Math.ceil(n / 4) * 4;
}

function stringToBytes(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const padded = new Uint8Array(align4(bytes.length + 1));
  padded.set(bytes);
  return padded; // null-terminated + padding already included in align4
}

function int32Bytes(n: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setInt32(0, n, false);
  return new Uint8Array(buf);
}

function float32Bytes(n: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, n, false);
  return new Uint8Array(buf);
}

/**
 * Encode an OSC message into the binary OSC format.
 * Format: address (string, null-terminated, 4-byte aligned),
 *         type tag string ("," + types, null-terminated, 4-byte aligned),
 *         arguments (each 4-byte aligned)
 */
function encodeOscMessage(address: string, args: (number | string)[]): Uint8Array {
  const addressBytes = stringToBytes(address);

  let typeTag = ",";
  const argParts: Uint8Array[] = [];

  for (const arg of args) {
    if (typeof arg === "number") {
      if (Number.isInteger(arg)) {
        typeTag += "i";
        argParts.push(int32Bytes(arg));
      } else {
        typeTag += "f";
        argParts.push(float32Bytes(arg));
      }
    } else {
      typeTag += "s";
      argParts.push(stringToBytes(arg));
    }
  }

  const typeBytes = stringToBytes(typeTag);

  const totalLen = addressBytes.length + typeBytes.length + argParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;

  result.set(addressBytes, offset); offset += addressBytes.length;
  result.set(typeBytes, offset); offset += typeBytes.length;
  for (const part of argParts) {
    result.set(part, offset); offset += part.length;
  }

  return result;
}

/**
 * Encode an OSC bundle (timestamped messages).
 */
function encodeOscBundle(timetag: bigint, messages: Uint8Array[]): Uint8Array {
  const header = stringToBytes("#bundle");

  // 8-byte NTP timetag
  const timetagBuf = new ArrayBuffer(8);
  new DataView(timetagBuf).setBigUint64(0, timetag, false);
  const timetagBytes = new Uint8Array(timetagBuf);

  let totalLen = header.length + 8;
  const sizedMessages: { size: Uint8Array; body: Uint8Array }[] = [];

  for (const msg of messages) {
    const sizeBytes = int32Bytes(msg.length);
    totalLen += 4 + msg.length;
    sizedMessages.push({ size: sizeBytes, body: msg });
  }

  const result = new Uint8Array(totalLen);
  let offset = 0;

  result.set(header, offset); offset += header.length;
  result.set(timetagBytes, offset); offset += 8;

  for (const { size, body } of sizedMessages) {
    result.set(size, offset); offset += 4;
    result.set(body, offset); offset += body.length;
  }

  return result;
}

// ─── Connected Clients ───

const clients = new Set<ServerWebSocket<{ type: "osc" }>>();

// ─── WebSocket Handler ───

export function handleOscWebSocket(ws: ServerWebSocket<{ type: "osc" }>): void {
  ws.data = { type: "osc" };
  clients.add(ws);

  console.log(`[OSC] Client connected (total: ${clients.size})`);

  // Send welcome message
  const welcome = encodeOscMessage("/light/connected", [1]);
  try {
    ws.sendBinary(welcome);
  } catch {}

  // Send initial state
  broadcastMessage("/light/bpm", [120]);
  broadcastMessage("/light/intensity", [0.5]);
  broadcastMessage("/light/color", [0.3, 0.3, 0.8]);
  broadcastMessage("/light/strobe", [2]);
}

export function handleOscClose(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws as ServerWebSocket<{ type: "osc" }>);
  console.log(`[OSC] Client disconnected (total: ${clients.size})`);
}

export function handleOscMessage(ws: ServerWebSocket<unknown>, message: string | Buffer): void {
  // Clients can send simple requests
  try {
    const text = typeof message === "string" ? message : Buffer.from(message).toString("utf-8");
    if (text === "ping") {
      const pong = encodeOscMessage("/light/pong", [1]);
      ws.sendBinary(pong);
    }
  } catch {
    // Ignore malformed messages
  }
}

// ─── Broadcasting ───

export function broadcastOscMessage(address: string, args: (number | string)[]): void {
  const msg = encodeOscMessage(address, args);
  broadcastBinary(msg);
}

export function broadcastOscBundle(messages: { address: string; args: (number | string)[] }[]): void {
  const encoded = messages.map(m => encodeOscMessage(m.address, m.args));
  const bundle = encodeOscBundle(
    BigInt(Math.floor(Date.now() / 1000)) * BigInt(2 ** 32), // NTP timetag approximation
    encoded
  );
  broadcastBinary(bundle);
}

function broadcastBinary(data: Uint8Array): void {
  for (const client of clients) {
    try {
      client.sendBinary(data);
    } catch {
      clients.delete(client);
    }
  }
}

function broadcastMessage(address: string, args: (number | string)[]): void {
  broadcastOscMessage(address, args);
}

// ─── Track-Specific Broadcasting ───

export function broadcastTrackLights(track: TrackLightInput): void {
  const params = getLightParams(track);
  const messages = getOscMessages(params);

  const encoded = messages.map(m => encodeOscMessage(m.address, m.args as (number | string)[]));
  const bundle = encodeOscBundle(
    BigInt(Math.floor(Date.now() / 1000)) * BigInt(2 ** 32),
    encoded
  );

  broadcastBinary(bundle);
}

// ─── Client Count ───

export function getOscClientCount(): number {
  return clients.size;
}

// ─── Get WebSocket Config for Bun.serve ───

export function getOscWebSocketConfig() {
  return {
    open: handleOscWebSocket,
    close: handleOscClose,
    message: handleOscMessage,
  };
}
